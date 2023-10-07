import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';

import { NamingContext } from './naming-context';
import { PythonImports } from './python-imports';
import { Dict } from './type-name/dict';
import { List } from './type-name/list';
import { Optional } from './type-name/optional';
import { Primitive } from './type-name/primitive';
import { Union } from './type-name/union';
import { UserType } from './type-name/user-type';
import { die, toPythonIdentifier } from './util';

export interface TypeName {
  pythonType(context: NamingContext): string;
  requiredImports(context: NamingContext): PythonImports;
}

export function toTypeName(
  ref?: spec.OptionalValue | spec.TypeReference,
): TypeName {
  if (ref == null) {
    return Primitive.NONE;
  }

  const type = isOptionalValue(ref) ? ref.type : ref;
  const optional = isOptionalValue(ref) && ref.optional;

  let result: TypeName = Primitive.ANY;

  if (spec.isPrimitiveTypeReference(type)) {
    result = Primitive.of(type);
  } else if (spec.isCollectionTypeReference(type)) {
    const elt = toTypeName(type.collection.elementtype);
    if (type.collection.kind === spec.CollectionKind.Array) {
      result = new List(elt);
    } else {
      result = new Dict(elt);
    }
  } else if (spec.isUnionTypeReference(type)) {
    result = new Union(type.union.types.map(toTypeName));
  } else if (spec.isNamedTypeReference(type)) {
    result = new UserType(type.fqn);
  }

  return optional ? new Optional(result) : result;
}

export function mergePythonImports(
  ...pythonImports: readonly PythonImports[]
): PythonImports {
  const result: Record<string, Set<string>> = {};
  for (const bag of pythonImports) {
    for (const [packageName, items] of Object.entries(bag)) {
      if (!(packageName in result)) {
        result[packageName] = new Set();
      }
      for (const item of items) {
        result[packageName].add(item);
      }
    }
  }
  return result;
}

function isOptionalValue(
  type: spec.OptionalValue | spec.TypeReference,
): type is spec.OptionalValue {
  return (type as unknown as spec.OptionalValue).type != null;
}

export function toPythonFqn(fqn: string, rootAssm: spec.Assembly) {
  const { assemblyName, packageName, tail } = getPackageName(fqn, rootAssm);
  const fqnParts: string[] = [packageName];

  for (const part of tail) {
    fqnParts.push(toPythonIdentifier(part));
  }

  return { assemblyName, packageName, pythonFqn: fqnParts.join('.') };
}

export function getPackageName(fqn: string, rootAssm: spec.Assembly) {
  const segments = fqn.split('.');
  const assemblyName = segments[0];
  const config =
    assemblyName === rootAssm.name
      ? rootAssm
      : rootAssm.dependencyClosure?.[assemblyName] ??
        die(
          `Unable to find configuration for assembly "${assemblyName}" in dependency closure`,
        );
  const rootPkg =
    config.targets?.python?.module ??
    die(`No Python target was configured in assembly "${assemblyName}"`);

  const pkg = new Array<string>();
  const tail = new Array<string>();

  for (let len = segments.length; len > 0; len--) {
    const submodule = segments.slice(0, len).join('.');
    if (submodule === assemblyName) {
      pkg.unshift(rootPkg);
      break;
    }

    const submoduleConfig = config.submodules?.[submodule];
    if (submoduleConfig == null) {
      // Not in a submodule - so the current lead name is not a package name part.
      tail.unshift(segments[len - 1]);
      continue;
    }

    const subPackage: string | undefined =
      submoduleConfig.targets?.python?.module;
    if (subPackage != null) {
      // Found a sub-package. Confirm it's nested right in, and make this the head end of our package name.
      if (!subPackage.startsWith(`${rootPkg}.`)) {
        die(
          `Submodule "${submodule}" is mapped to Python sub-package "${subPackage}" which isn't nested under "${rootPkg}"!`,
        );
      }
      pkg.unshift(subPackage);
      break;
    }

    // Just use whatever the default name is for this package name part.
    pkg.unshift(codemaker.toSnakeCase(toPythonIdentifier(segments[len - 1])));
  }

  return { assemblyName, packageName: pkg.join('.'), tail };
}
