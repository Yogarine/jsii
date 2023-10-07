import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as reflect from 'jsii-reflect';
import * as rosetta from 'jsii-rosetta';

import { toPythonPropertyName } from '../python';
import { EmitContext } from './naming-context/emit-context';
import { PythonBase } from './python-base';
import { PythonGenerator } from './python-generator';
import { PythonImports } from './python-imports';
import { toTypeName } from './type-name';

export class StructField implements PythonBase {
  public readonly pythonName: string;
  public readonly jsiiName: string;
  public readonly docs?: spec.Docs;
  public readonly type: spec.OptionalValue;

  public constructor(
    private readonly generator: PythonGenerator,
    public readonly prop: spec.Property,
    private readonly definingType: spec.Type,
  ) {
    this.pythonName = toPythonPropertyName(prop.name);
    this.jsiiName = prop.name;
    this.type = prop;
    this.docs = prop.docs;
  }

  public get apiLocation(): rosetta.ApiLocation {
    return {
      api: 'member',
      fqn: this.definingType.fqn,
      memberName: this.jsiiName,
    };
  }

  public get optional(): boolean {
    return !!this.type.optional;
  }

  public requiredImports(context: EmitContext): PythonImports {
    return toTypeName(this.type).requiredImports(context);
  }

  public isStruct(generator: PythonGenerator): boolean {
    return isStruct(generator.reflectAssembly.system, this.type.type);
  }

  public constructorDecl(context: EmitContext) {
    const opt = this.optional ? ' = None' : '';
    return `${this.pythonName}: ${this.typeAnnotation({
      ...context,
      parameterType: true,
    })}${opt}`;
  }

  /**
   * Return the Python type annotation for this type
   */
  public typeAnnotation(context: EmitContext) {
    return toTypeName(this.type).pythonType(context);
  }

  public emitDocString(code: codemaker.CodeMaker) {
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      documentableItem: `prop-${this.pythonName}`,
    });
  }

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    const resolvedType = this.typeAnnotation(context);
    code.line(`${this.pythonName}: ${resolvedType}`);
    this.emitDocString(code);
  }
}

function isStruct(
  typeSystem: reflect.TypeSystem,
  ref: spec.TypeReference,
): boolean {
  if (!spec.isNamedTypeReference(ref)) {
    return false;
  }
  const type = typeSystem.tryFindFqn(ref.fqn);
  return !!(type?.isInterfaceType() && type?.isDataType());
}
