import * as codemaker from 'codemaker';
import * as fs from 'fs-extra';
import * as path from 'path';

import { Target, TargetOptions } from '../target';
import { shell } from '../util';
import { EmitContext } from './python/naming-context/emit-context';
import { PythonBase } from './python/python-base';
import { PythonGenerator } from './python/python-generator';
import { PythonType } from './python/python-type';
import { TypeResolver } from './python/type-resolver';
import { PythonModule } from './python/type/python-module';
import { ISortableType } from './python/type/sortable-type';
import { toPythonIdentifier } from './python/util';

export const requirementsFile = path.resolve(
  __dirname,
  'python',
  'requirements-dev.txt',
);

/**
 * We use single-quotes for multi-line strings to allow examples within the
 * docstrings themselves to include double-quotes.
 *
 * @see https://github.com/aws/jsii/issues/2569
 */
export const DOCSTRING_QUOTES = "'''";

export default class Python extends Target {
  protected readonly generator: PythonGenerator;

  public constructor(options: TargetOptions) {
    super(options);

    this.generator = new PythonGenerator(options.rosetta, options);
  }

  public async generateCode(outDir: string, tarball: string): Promise<void> {
    await super.generateCode(outDir, tarball);
  }

  public async build(sourceDir: string, outDir: string): Promise<void> {
    // Create a fresh virtual env
    const venv = await fs.mkdtemp(path.join(sourceDir, '.env-'));
    const venvBin = path.join(
      venv,
      process.platform === 'win32' ? 'Scripts' : 'bin',
    );
    // On Windows, there is usually no python3.exe (the GitHub action workers will have a python3
    // shim, but using this actually results in a WinError with Python 3.7 and 3.8 where venv will
    // fail to copy the python binary if it's not invoked as python.exe). More on this particular
    // issue can be read here: https://bugs.python.org/issue43749
    await shell(process.platform === 'win32' ? 'python' : 'python3', [
      '-m',
      'venv',
      '--system-site-packages', // Allow using globally installed packages (saves time & disk space)
      venv,
    ]);
    const env = {
      ...process.env,
      PATH: `${venvBin}:${process.env.PATH}`,
      VIRTUAL_ENV: venv,
    };
    const python = path.join(venvBin, 'python');

    // Install the necessary things
    await shell(
      python,
      ['-m', 'pip', 'install', '--no-input', '-r', requirementsFile],
      {
        cwd: sourceDir,
        env,
        retry: { maxAttempts: 5 },
      },
    );

    // Actually package up our code, both as a sdist and a wheel for publishing.
    await shell(python, ['setup.py', 'sdist', '--dist-dir', outDir], {
      cwd: sourceDir,
      env,
    });
    await shell(
      python,
      ['-m', 'pip', 'wheel', '--no-deps', '--wheel-dir', outDir, sourceDir],
      {
        cwd: sourceDir,
        env,
        retry: { maxAttempts: 5 },
      },
    );
    await shell(python, ['-m', 'twine', 'check', path.join(outDir, '*')], {
      cwd: sourceDir,
      env,
    });
  }
}

export const pythonModuleNameToFilename = (name: string): string => {
  return path.join(...name.split('.'));
};

export const toPythonPropertyName = (
  name: string,
  constant = false,
  protectedItem = false,
): string => {
  let value = toPythonIdentifier(codemaker.toSnakeCase(name));

  if (constant) {
    value = value.toUpperCase();
  }

  if (protectedItem) {
    value = `_${value}`;
  }

  return value;
};

/**
 * Converts a given signature's parameter name to what should be emitted in Python. It slugifies the
 * positional parameter names that collide with a lifted prop by appending trailing `_`. There is no
 * risk of conflicting with another positional parameter that ends with a `_` character because
 * this is prohibited by the `jsii` compiler (parameter names MUST be camelCase, and only a single
 * `_` is permitted when it is on **leading** position)
 *
 * @param name              the name of the parameter that needs conversion.
 * @param liftedParamNames  the list of "lifted" keyword parameters in this signature. This must be
 *                          omitted when generating a name for a parameter that **is** lifted.
 */
export function toPythonParameterName(
  name: string,
  liftedParamNames = new Set<string>(),
): string {
  let result = toPythonIdentifier(codemaker.toSnakeCase(name));

  while (liftedParamNames.has(result)) {
    result += '_';
  }

  return result;
}

const setDifference = <T>(setA: Set<T>, setB: Set<T>): Set<T> => {
  const result = new Set<T>();
  for (const item of setA) {
    if (!setB.has(item)) {
      result.add(item);
    }
  }
  return result;
};

/**
 * Prepare python members for emission.
 *
 * If there are multiple members of the same name, they will all map to the same python
 * name, so we will filter all deprecated members and expect that there will be only one
 * left.
 *
 * Returns the members in a sorted list.
 */
export function prepareMembers(members: PythonBase[], resolver: TypeResolver) {
  // create a map from python name to list of members
  const map: { [pythonName: string]: PythonBase[] } = {};
  for (const m of members) {
    let list = map[m.pythonName];
    if (!list) {
      list = map[m.pythonName] = [];
    }

    list.push(m);
  }

  // now return all the members
  const ret = new Array<PythonBase>();

  for (const [name, list] of Object.entries(map)) {
    let member;

    if (list.length === 1) {
      // if we have a single member for this normalized name, then use it
      member = list[0];
    } else {
      // we found more than one member with the same python name, filter all
      // deprecated versions and check that we are left with exactly one.
      // otherwise, they will overwrite each other
      // see https://github.com/aws/jsii/issues/2508
      const nonDeprecated = list.filter((x) => !isDeprecated(x));
      if (nonDeprecated.length > 1) {
        throw new Error(
          `Multiple non-deprecated members which map to the Python name "${name}"`,
        );
      }

      if (nonDeprecated.length === 0) {
        throw new Error(
          `Multiple members which map to the Python name "${name}", but all of them are deprecated`,
        );
      }

      member = nonDeprecated[0];
    }

    ret.push(member);
  }

  return sortMembers(ret, resolver);
}

const sortMembers = (
  members: PythonBase[],
  resolver: TypeResolver,
): PythonBase[] => {
  let sortable = new Array<{
    member: PythonBase & ISortableType;
    dependsOn: Set<PythonType>;
  }>();
  const sorted = new Array<PythonBase>();
  const seen = new Set<PythonBase>();

  // The first thing we want to do, is push any item which is not sortable to the very
  // front of the list. This will be things like methods, properties, etc.
  for (const member of members) {
    if (!isSortableType(member)) {
      sorted.push(member);
      seen.add(member);
    } else {
      sortable.push({ member, dependsOn: new Set(member.dependsOn(resolver)) });
    }
  }

  // Now that we've pulled out everything that couldn't possibly have dependencies,
  // we will go through the remaining items, and pull off any items which have no
  // dependencies that we haven't already sorted.
  while (sortable.length > 0) {
    for (const { member, dependsOn } of sortable) {
      const diff = setDifference(dependsOn, seen);
      if ([...diff].find((dep) => !(dep instanceof PythonModule)) == null) {
        sorted.push(member);
        seen.add(member);
      }
    }

    const leftover = sortable.filter(({ member }) => !seen.has(member));
    if (leftover.length === sortable.length) {
      throw new Error(
        `Could not sort members (circular dependency?). Leftover: ${leftover
          .map((lo) => lo.member.pythonName)
          .join(', ')}`,
      );
    } else {
      sortable = leftover;
    }
  }

  return sorted;
};

function isSortableType(arg: unknown): arg is ISortableType {
  return (arg as Partial<ISortableType>).dependsOn !== undefined;
}

/**
 * Appends `_` at the end of `name` until it no longer conflicts with any of the
 * entries in `inUse`.
 *
 * @param name  the name to be slugified.
 * @param inUse the names that are already being used.
 *
 * @returns the slugified name.
 */
export function slugifyAsNeeded(
  name: string,
  inUse: readonly string[],
): string {
  const inUseSet = new Set(inUse);
  while (inUseSet.has(name)) {
    name = `${name}_`;
  }
  return name;
}

////////////////////////////////////////////////////////////////////////////////
// BEHOLD: Helpers to output code that looks like what Black would format into...
//
// @see https://black.readthedocs.io/en/stable/the_black_code_style.html

export const TARGET_LINE_LENGTH = 88;

export function openSignature(
  code: codemaker.CodeMaker,
  keyword: 'class',
  name: string,
  params: readonly string[],
): void;
export function openSignature(
  code: codemaker.CodeMaker,
  keyword: 'def',
  name: string,
  params: readonly string[],
  returnType: string,
  comment?: string,
): void;
export function openSignature(
  code: codemaker.CodeMaker,
  keyword: 'class' | 'def',
  name: string,
  params: readonly string[],
  returnType?: string,
  lineComment?: string,
) {
  const prefix = `${keyword} ${name}`;
  const suffix = returnType ? ` -> ${returnType}` : '';
  if (params.length === 0) {
    code.openBlock(`${prefix}${returnType ? '()' : ''}${suffix}`);
    return;
  }

  const join = ', ';
  const { elementsSize, joinSize } = totalSizeOf(params, join);

  const hasComments = params.some((param) => /#\s*.+$/.exec(param) != null);

  if (
    !hasComments &&
    TARGET_LINE_LENGTH >
      code.currentIndentLength +
        prefix.length +
        elementsSize +
        joinSize +
        suffix.length +
        2
  ) {
    code.indent(
      `${prefix}(${params.join(join)})${suffix}:${
        lineComment ? `  # ${lineComment}` : ''
      }`,
    );
    return;
  }

  code.indent(`${prefix}(`);
  for (const param of params) {
    code.line(param.replace(/(\s*# .+)?$/, ',$1'));
  }
  code.unindent(false);
  code.indent(`)${suffix}:${lineComment ? `  # ${lineComment}` : ''}`);
}

/**
 * Emits runtime type checking code for parameters.
 *
 * @param code        the CodeMaker to use for emitting code.
 * @param context     the emit context used when emitting this code.
 * @param params      the parameter signatures to be type-checked.
 * @param fqn         the fully qualified name of the Python function being checked.
 * @params pythonName the name of the Python function being checked (qualified).
 */
export function emitParameterTypeChecks(
  code: codemaker.CodeMaker,
  context: EmitContext,
  params: readonly string[],
  fqn: string,
): boolean {
  if (!context.runtimeTypeChecking) {
    return false;
  }

  const paramInfo = params.map((param) => {
    const [name] = param.split(/\s*[:=#]\s*/, 1);
    if (name === '*') {
      return { kwargsMark: true };
    } else if (name.startsWith('*')) {
      return { name: name.slice(1), is_rest: true };
    }
    return { name };
  });

  const paramNames = paramInfo
    .filter((param) => param.name != null)
    .map((param) => param.name!.split(/\s*:\s*/)[0]);
  const typesVar = slugifyAsNeeded('type_hints', paramNames);

  let openedBlock = false;
  for (const { is_rest, kwargsMark, name } of paramInfo) {
    if (kwargsMark) {
      if (!context.runtimeTypeCheckKwargs) {
        // This is the keyword-args separator, we won't check keyword arguments here because the kwargs will be rolled
        // up into a struct instance, and that struct's constructor will be checking again...
        break;
      }
      // Skip this (there is nothing to be checked as this is just a marker...)
      continue;
    }

    if (!openedBlock) {
      code.openBlock('if __debug__');
      code.line(
        `${typesVar} = ${context.typeCheckingHelper.getTypeHints(fqn, params)}`,
      );
      openedBlock = true;
    }

    let expectedType = `${typesVar}[${JSON.stringify(name)}]`;
    let comment = '';
    if (is_rest) {
      // This is a vararg, so the value will appear as a tuple.
      expectedType = `typing.Tuple[${expectedType}, ...]`;
      // Need to ignore reportGeneralTypeIssues because pyright incorrectly parses that as a type annotation 😒
      comment = ' # pyright: ignore [reportGeneralTypeIssues]';
    }
    code.line(
      `check_type(argname=${JSON.stringify(
        `argument ${name}`,
      )}, value=${name}, expected_type=${expectedType})${comment}`,
    );
  }
  if (openedBlock) {
    code.closeBlock();
    return true;
  }
  // We did not reference type annotations data if we never opened a type-checking block.
  return false;
}

export function emitList(
  code: codemaker.CodeMaker,
  prefix: string,
  elements: readonly string[],
  suffix: string,
  opts?: { ifMulti: [string, string] },
) {
  if (elements.length === 0) {
    code.line(`${prefix}${suffix}`);
    return;
  }

  const join = ', ';
  const { elementsSize, joinSize } = totalSizeOf(elements, join);
  if (
    TARGET_LINE_LENGTH >
    code.currentIndentLength +
      prefix.length +
      elementsSize +
      joinSize +
      suffix.length
  ) {
    code.line(`${prefix}${elements.join(join)}${suffix}`);
    return;
  }

  const [before, after] = opts?.ifMulti ?? ['', ''];

  code.indent(`${prefix}${before}`);
  if (elements.length === 1) {
    code.line(elements[0]);
  } else {
    if (
      TARGET_LINE_LENGTH >
      code.currentIndentLength + elementsSize + joinSize
    ) {
      code.line(elements.join(join));
    } else {
      for (const elt of elements) {
        code.line(`${elt},`);
      }
    }
  }
  code.unindent(`${after}${suffix}`);
}

export function totalSizeOf(strings: readonly string[], join: string) {
  return {
    elementsSize: strings
      .map((str) => str.length)
      .reduce((acc, elt) => acc + elt, 0),
    joinSize: strings.length > 1 ? join.length * (strings.length - 1) : 0,
  };
}

export function nestedContext(
  context: EmitContext,
  fqn: string | undefined,
): EmitContext {
  return {
    ...context,
    surroundingTypeFqns:
      fqn != null
        ? [...(context.surroundingTypeFqns ?? []), fqn]
        : context.surroundingTypeFqns,
  };
}

const isDeprecated = (x: PythonBase) => x.docs?.deprecated !== undefined;
