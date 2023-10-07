import * as spec from '@jsii/spec';
import * as crypto from 'crypto';

import { NamingContext } from '../naming-context';
import { toPythonFqn, TypeName } from '../type-name';

export class UserType implements TypeName {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #fqn: string;

  public constructor(fqn: string) {
    this.#fqn = fqn;
  }

  public pythonType(context: NamingContext) {
    return this.resolve(context).pythonType;
  }

  public requiredImports(context: NamingContext) {
    const requiredImport = this.resolve(context).requiredImport;
    if (requiredImport == null) {
      return {};
    }
    return { [requiredImport.sourcePackage]: new Set([requiredImport.item]) };
  }

  private resolve({
    assembly,
    emittedTypes,
    submodule,
    surroundingTypeFqns,
    typeAnnotation = true,
    parameterType,
    typeResolver,
  }: NamingContext) {
    const { assemblyName, packageName, pythonFqn } = toPythonFqn(
      this.#fqn,
      assembly,
    );

    // If this is a type annotation for a parameter, allow dicts to be passed where structs are expected.
    const type = typeResolver(this.#fqn);
    const isStruct = spec.isInterfaceType(type) && !!type.datatype;
    const wrapType =
      typeAnnotation && parameterType && isStruct
        ? (pyType: string) =>
            `typing.Union[${pyType}, typing.Dict[builtins.str, typing.Any]]`
        : (pyType: string) => pyType;

    // Emit aliased imports for dependencies (this avoids name collisions)
    if (assemblyName !== assembly.name) {
      const aliasSuffix = crypto
        .createHash('sha256')
        .update(assemblyName)
        .update('.*')
        .digest('hex')
        .substring(0, 8);
      const alias = `_${packageName.replace(/\./g, '_')}_${aliasSuffix}`;

      const aliasedFqn = `${alias}${pythonFqn.slice(packageName.length)}`;

      return {
        // If it's a struct, then we allow passing as a dict, too...
        pythonType: wrapType(aliasedFqn),
        requiredImport: {
          sourcePackage: `${packageName} as ${alias}`,
          item: '',
        },
      };
    }

    const submodulePythonName = toPythonFqn(submodule, assembly).pythonFqn;
    const typeSubmodulePythonName = toPythonFqn(
      findParentSubmodule(type, assembly),
      assembly,
    ).pythonFqn;

    if (typeSubmodulePythonName === submodulePythonName) {
      // Identify declarations that are not yet initialized and hence cannot be
      // used as part of a type qualification. Since this is not a forward
      // reference, the type was already emitted and its un-qualified name must
      // be used instead of its locally qualified name.
      const nestingParent = surroundingTypeFqns
        ?.map((fqn) => toPythonFqn(fqn, assembly).pythonFqn)
        ?.reverse()
        ?.find((parent) => pythonFqn.startsWith(`${parent}.`));

      if (
        typeAnnotation &&
        (!emittedTypes.has(this.#fqn) || nestingParent != null)
      ) {
        // Possibly a forward reference, outputting the stringifierd python FQN
        return {
          pythonType: wrapType(
            JSON.stringify(pythonFqn.substring(submodulePythonName.length + 1)),
          ),
        };
      }

      if (!typeAnnotation && nestingParent) {
        // This is not for a type annotation, so we should be at a point in time
        // where the surrounding symbol has been defined entirely, so we can
        // refer to it "normally" now.
        return { pythonType: pythonFqn.slice(packageName.length + 1) };
      }

      // We'll just make a module-qualified reference at this point.
      return {
        pythonType: wrapType(
          pythonFqn.substring(submodulePythonName.length + 1),
        ),
      };
    }

    const [toImport, ...nested] = pythonFqn
      .substring(typeSubmodulePythonName.length + 1)
      .split('.');
    const aliasSuffix = crypto
      .createHash('sha256')
      .update(typeSubmodulePythonName)
      .update('.')
      .update(toImport)
      .digest('hex')
      .substring(0, 8);
    const alias = `_${toImport}_${aliasSuffix}`;

    return {
      pythonType: wrapType([alias, ...nested].join('.')),
      requiredImport: {
        sourcePackage: relativeImportPath(
          submodulePythonName,
          typeSubmodulePythonName,
        ),
        item: `${toImport} as ${alias}`,
      },
    };
  }
}

/**
 * Computes the python relative import path from `fromModule` to `toModule`.
 *
 * @param fromPkg the package where the relative import statement is located.
 * @param toPkg   the package that needs to be relatively imported.
 *
 * @returns a relative import path.
 *
 * @example
 *  relativeImportPath('A.B.C.D', 'A.B.E') === '...E';
 *  relativeImportPath('A.B.C', 'A.B')     === '..';
 *  relativeImportPath('A.B', 'A.B.C')     === '.C';
 */
function relativeImportPath(fromPkg: string, toPkg: string): string {
  if (toPkg.startsWith(fromPkg)) {
    // from A.B to A.B.C === .C
    return `.${toPkg.substring(fromPkg.length + 1)}`;
  }
  // from A.B.E to A.B.C === .<from A.B to A.B.C>
  const fromPkgParent = fromPkg.substring(0, fromPkg.lastIndexOf('.'));
  return `.${relativeImportPath(fromPkgParent, toPkg)}`;
}

function findParentSubmodule(type: spec.Type, assm: spec.Assembly): string {
  if (type.namespace == null) {
    return assm.name;
  }
  const namespaceFqn = `${assm.name}.${type.namespace}`;
  if (assm.types?.[namespaceFqn] != null) {
    return findParentSubmodule(assm.types?.[namespaceFqn], assm);
  }
  return namespaceFqn;
}
