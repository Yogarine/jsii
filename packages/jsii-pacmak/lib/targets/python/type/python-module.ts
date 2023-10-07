import * as spec from '@jsii/spec';
import * as assert from 'assert';
import * as codemaker from 'codemaker';
import * as path from 'path';

import {
  DOCSTRING_QUOTES,
  emitList,
  prepareMembers,
  pythonModuleNameToFilename,
} from '../../python';
import { EmitContext } from '../naming-context/emit-context';
import { Package } from '../package';
import { PythonBase } from '../python-base';
import { PythonImports } from '../python-imports';
import { PythonType } from '../python-type';
import { mergePythonImports } from '../type-name';
import { die } from '../util';

export interface ModuleOpts {
  readonly assembly: spec.Assembly;

  readonly assemblyFilename: string;

  readonly loadAssembly?: boolean;

  readonly package?: Package;

  /**
   * The docstring to emit at the top of this module, if any.
   */
  readonly moduleDocumentation?: string;
}

/**
 * Python module
 *
 * Will be called for jsii submodules and namespaces.
 */
export class PythonModule implements PythonType {
  /**
   * Converted to put on the module
   *
   * The format is in markdown, with code samples converted from TS to Python.
   */
  public readonly moduleDocumentation?: string;

  private readonly assembly: spec.Assembly;
  private readonly assemblyFilename: string;
  private readonly loadAssembly: boolean;
  private readonly members = new Array<PythonBase>();

  private readonly modules = new Array<PythonModule>();

  public constructor(
    public readonly pythonName: string,
    public readonly fqn: string | undefined,
    opts: ModuleOpts,
  ) {
    this.assembly = opts.assembly;
    this.assemblyFilename = opts.assemblyFilename;
    this.loadAssembly = !!opts.loadAssembly;
    this.moduleDocumentation = opts.moduleDocumentation;
  }

  public addMember(member: PythonBase) {
    this.members.push(member);
  }

  public addPythonModule(pyMod: PythonModule) {
    assert(
      !this.loadAssembly,
      'PythonModule.addPythonModule CANNOT be called on assembly-loading modules (it would cause a load cycle)!',
    );

    assert(
      pyMod.pythonName.startsWith(`${this.pythonName}.`),
      `Attempted to register ${pyMod.pythonName} as a child module of ${this.pythonName}, but the names don't match!`,
    );

    const [firstLevel, ...rest] = pyMod.pythonName
      .substring(this.pythonName.length + 1)
      .split('.');
    if (rest.length === 0) {
      // This is a direct child module...
      this.modules.push(pyMod);
    } else {
      // This is a nested child module, so we delegate to the directly nested module...
      const parent = this.modules.find(
        (m) => m.pythonName === `${this.pythonName}.${firstLevel}`,
      );
      if (!parent) {
        throw new Error(
          `Attempted to register ${pyMod.pythonName} within ${this.pythonName}, but ${this.pythonName}.${firstLevel} wasn't registered yet!`,
        );
      }
      parent.addPythonModule(pyMod);
    }
  }

  public requiredImports(context: EmitContext): PythonImports {
    return mergePythonImports(
      ...this.members.map((mem) => mem.requiredImports(context)),
    );
  }

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    this.emitModuleDocumentation(code);

    const resolver = this.fqn
      ? context.resolver.bind(this.fqn, this.pythonName)
      : context.resolver;
    context = {
      ...context,
      submodule: this.fqn ?? context.submodule,
      resolver,
    };

    // Before we write anything else, we need to write out our module headers, this
    // is where we handle stuff like imports, any required initialization, etc.
    code.line('import abc');
    code.line('import builtins');
    code.line('import datetime');
    code.line('import enum');
    code.line('import typing');
    code.line();
    code.line('import jsii');
    code.line('import publication');
    code.line('import typing_extensions');
    code.line();
    code.line('from typeguard import check_type');

    // Determine if we need to write out the kernel load line.
    if (this.loadAssembly) {
      this.emitDependencyImports(code);

      code.line();
      emitList(
        code,
        '__jsii_assembly__ = jsii.JSIIAssembly.load(',
        [
          JSON.stringify(this.assembly.name),
          JSON.stringify(this.assembly.version),
          '__name__[0:-6]',
          `${JSON.stringify(this.assemblyFilename)}`,
        ],
        ')',
      );
    } else {
      // Then we must import the ._jsii subpackage.
      code.line();
      let distanceFromRoot = 0;
      for (
        let curr = this.fqn!;
        curr !== this.assembly.name;
        curr = curr.substring(0, curr.lastIndexOf('.'))
      ) {
        distanceFromRoot++;
      }
      code.line(`from ${'.'.repeat(distanceFromRoot + 1)}_jsii import *`);

      this.emitRequiredImports(code, context);
    }

    // Emit all of our members.
    for (const member of prepareMembers(this.members, resolver)) {
      code.line();
      code.line();
      member.emit(code, context);
    }

    /**
     * Whatever names we've exported, we'll write out our __all__ that lists
     * them.
     *
     * __all__ is normally used for when users write `from library import *`,
     * but we also use it with the `publication` module to hide everything
     * that's NOT in the list.
     *
     * Normally adding submodules to `__all__` has the (negative?) side effect
     * that all submodules get loaded when the user does `import *`, but we
     * already load submodules anyway, so it doesn't make a difference, and in
     * combination with the `publication` module NOT having them in this list
     * hides any submodules we import as part of typechecking.
     */
    const exportedMembers = [
      ...this.members.map((m) => `"${m.pythonName}"`),
      ...this.modules
        .filter((m) => this.isDirectChild(m))
        .map((m) => `"${lastComponent(m.pythonName)}"`),
    ];
    if (this.loadAssembly) {
      exportedMembers.push('"__jsii_assembly__"');
    }

    // Declare the list of "public" members this module exports
    if (this.members.length > 0) {
      code.line();
    }
    code.line();

    if (exportedMembers.length > 0) {
      code.indent('__all__ = [');
      for (const member of exportedMembers.sort()) {
        // Writing one by line might be _a lot_ of lines, but it'll make reviewing changes to the list easier. Trust me.
        code.line(`${member},`);
      }
      code.unindent(']');
    } else {
      code.line('__all__: typing.List[typing.Any] = []');
    }

    // Next up, we'll use publication to ensure that all the non-public names
    // get hidden from dir(), tab-complete, etc.
    code.line();
    code.line('publication.publish()');

    // Finally, we'll load all registered python modules
    if (this.modules.length > 0) {
      code.line();
      code.line(
        '# Loading modules to ensure their types are registered with the jsii runtime library',
      );
      for (const module of this.modules.sort((l, r) =>
        l.pythonName.localeCompare(r.pythonName),
      )) {
        // Rather than generating an absolute import like
        // "import jsii_calc.submodule" this builds a relative import like
        // "from . import submodule". This enables distributing python packages
        // and using the generated modules in the same codebase.
        const submodule = module.pythonName.substring(
          this.pythonName.length + 1,
        );
        code.line(`from . import ${submodule}`);
      }
    }
  }

  /**
   * Emit the bin scripts if bin section defined.
   */
  public emitBinScripts(code: codemaker.CodeMaker): string[] {
    const scripts = new Array<string>();
    if (this.loadAssembly) {
      if (this.assembly.bin != null) {
        for (const name of Object.keys(this.assembly.bin)) {
          const script_file = path.join(
            'src',
            pythonModuleNameToFilename(this.pythonName),
            'bin',
            name,
          );
          code.openFile(script_file);
          code.line('#!/usr/bin/env python');
          code.line();
          code.line('import jsii');
          code.line('import sys');
          code.line();
          emitList(
            code,
            '__jsii_assembly__ = jsii.JSIIAssembly.load(',
            [
              JSON.stringify(this.assembly.name),
              JSON.stringify(this.assembly.version),
              JSON.stringify(this.pythonName.replace('._jsii', '')),
              `${JSON.stringify(this.assemblyFilename)}`,
            ],
            ')',
          );
          code.line();
          emitList(
            code,
            'exit_code = __jsii_assembly__.invokeBinScript(',
            [
              JSON.stringify(this.assembly.name),
              JSON.stringify(name),
              'sys.argv[1:]',
            ],
            ')',
          );
          code.line('exit(exit_code)');
          code.closeFile(script_file);
          scripts.push(script_file.replace(/\\/g, '/'));
        }
      }
    }
    return scripts;
  }

  private isDirectChild(pyMod: PythonModule) {
    if (
      this.pythonName === pyMod.pythonName ||
      !pyMod.pythonName.startsWith(`${this.pythonName}.`)
    ) {
      return false;
    }
    // Must include only one more component
    return !pyMod.pythonName
      .substring(this.pythonName.length + 1)
      .includes('.');
  }

  /**
   * Emit the README as module docstring if this is the entry point module (it loads the assembly)
   */
  private emitModuleDocumentation(code: codemaker.CodeMaker) {
    if (this.moduleDocumentation) {
      code.line(DOCSTRING_QUOTES);
      code.line(this.moduleDocumentation);
      code.line(DOCSTRING_QUOTES);
    }
  }

  private emitDependencyImports(code: codemaker.CodeMaker) {
    // Collect all the (direct) dependencies' ._jsii packages.
    const deps = Object.keys(this.assembly.dependencies ?? {})
      .map(
        (dep) =>
          this.assembly.dependencyClosure?.[dep]?.targets?.python?.module ??
          die(`No Python target was configured for the dependency "${dep}".`),
      )
      .map((mod) => `${mod}._jsii`)
      .sort();

    // Now actually write the import statements...
    if (deps.length > 0) {
      code.line();
      for (const moduleName of deps) {
        code.line(`import ${moduleName}`);
      }
    }
  }

  private emitRequiredImports(code: codemaker.CodeMaker, context: EmitContext) {
    const requiredImports = this.requiredImports(context);
    const statements = Object.entries(requiredImports)
      .map(([sourcePackage, items]) => toImportStatements(sourcePackage, items))
      .reduce(
        (acc, elt) => [...acc, ...elt],
        new Array<{ emit: () => void; comparisonBase: string }>(),
      )
      .sort(importComparator);

    if (statements.length > 0) {
      code.line();
    }
    for (const statement of statements) {
      statement.emit(code);
    }

    function toImportStatements(
      sourcePkg: string,
      items: ReadonlySet<string>,
    ): Array<{
      emit: (code: codemaker.CodeMaker) => void;
      comparisonBase: string;
    }> {
      const result = new Array<{
        emit: (code: codemaker.CodeMaker) => void;
        comparisonBase: string;
      }>();
      if (items.has('')) {
        result.push({
          comparisonBase: `import ${sourcePkg}`,
          emit(code) {
            code.line(this.comparisonBase);
          },
        });
      }
      const pieceMeal = Array.from(items)
        .filter((i) => i !== '')
        .sort();
      if (pieceMeal.length > 0) {
        result.push({
          comparisonBase: `from ${sourcePkg} import`,
          emit: (code) =>
            emitList(code, `from ${sourcePkg} import `, pieceMeal, '', {
              ifMulti: ['(', ')'],
            }),
        });
      }
      return result;
    }

    function importComparator(
      left: { comparisonBase: string },
      right: { comparisonBase: string },
    ) {
      if (
        left.comparisonBase.startsWith('import') ===
        right.comparisonBase.startsWith('import')
      ) {
        return left.comparisonBase.localeCompare(right.comparisonBase);
      }
      // We want "from .foo import (...)" to be *after* "import bar"
      return right.comparisonBase.localeCompare(left.comparisonBase);
    }
  }
}

/**
 * Last component of a .-separated name
 */
function lastComponent(n: string) {
  const parts = n.split('.');
  return parts[parts.length - 1];
}
