import * as codemaker from 'codemaker';

import {
  emitList,
  emitParameterTypeChecks,
  nestedContext,
  openSignature,
  slugifyAsNeeded,
  TARGET_LINE_LENGTH,
  totalSizeOf,
} from '../../../python';
import { DocumentableArgument } from '../../documentable-argument';
import { EmitContext } from '../../naming-context/emit-context';
import { PythonBase } from '../../python-base';
import { StructField } from '../../struct-field';
import { mergePythonImports, toTypeName } from '../../type-name';
import { BasePythonClassType } from '../base-python-class-type';

export class Struct extends BasePythonClassType {
  protected directMembers = new Array<StructField>();

  public addMember(member: PythonBase): void {
    if (!(member instanceof StructField)) {
      throw new Error('Must add StructField to Struct');
    }
    this.directMembers.push(member);
  }

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    context = nestedContext(context, this.fqn);
    const baseInterfaces = this.getClassParams(context);

    code.indent('@jsii.data_type(');
    code.line(`jsii_type=${JSON.stringify(this.fqn)},`);
    emitList(code, 'jsii_struct_bases=[', baseInterfaces, '],');
    assignDictionary(code, 'name_mapping', this.propertyMap(), ',', true);
    code.unindent(')');
    openSignature(code, 'class', this.pythonName, baseInterfaces);
    this.emitConstructor(code, context);

    for (const member of this.allMembers) {
      code.line();
      this.emitGetter(member, code, context);
    }

    this.emitMagicMethods(code);

    code.closeBlock();

    if (this.fqn != null) {
      context.emittedTypes.add(this.fqn);
    }
  }

  public requiredImports(context: EmitContext) {
    return mergePythonImports(
      super.requiredImports(context),
      ...this.allMembers.map((mem) => mem.requiredImports(context)),
    );
  }

  protected getClassParams(context: EmitContext): string[] {
    return this.bases.map((b) =>
      toTypeName(b).pythonType({ ...context, typeAnnotation: false }),
    );
  }

  /**
   * Find all fields (inherited as well)
   */
  private get allMembers(): StructField[] {
    return this.thisInterface.allProperties.map(
      (x) => new StructField(this.generator, x.spec, x.definingType.spec),
    );
  }

  private get thisInterface() {
    if (this.fqn == null) {
      throw new Error('FQN not set');
    }
    return this.generator.reflectAssembly.system.findInterface(this.fqn);
  }

  private emitConstructor(code: codemaker.CodeMaker, context: EmitContext) {
    const members = this.allMembers;

    const kwargs = members.map((m) => m.constructorDecl(context));

    const implicitParameter = slugifyAsNeeded(
      'self',
      members.map((m) => m.pythonName),
    );
    const constructorArguments =
      kwargs.length > 0
        ? [implicitParameter, '*', ...kwargs]
        : [implicitParameter];

    openSignature(code, 'def', '__init__', constructorArguments, 'None');
    this.emitConstructorDocstring(code);

    // Re-type struct arguments that were passed as "dict". Do this before validating argument types...
    for (const member of members.filter((m) => m.isStruct(this.generator))) {
      // Note that "None" is NOT an instance of dict (that's convenient!)
      const typeName = toTypeName(member.type.type).pythonType({
        ...context,
        typeAnnotation: false,
      });
      code.openBlock(`if isinstance(${member.pythonName}, dict)`);
      code.line(`${member.pythonName} = ${typeName}(**${member.pythonName})`);
      code.closeBlock();
    }
    if (kwargs.length > 0) {
      emitParameterTypeChecks(
        code,
        // Runtime type check keyword args as this is a struct __init__ function.
        { ...context, runtimeTypeCheckKwargs: true },
        ['*', ...kwargs],
        `${this.fqn ?? this.pythonName}#__init__`,
      );
    }

    // Required properties, those will always be put into the dict
    assignDictionary(
      code,
      `${implicitParameter}._values: typing.Dict[builtins.str, typing.Any]`,
      members
        .filter((m) => !m.optional)
        .map(
          (member) =>
            `${JSON.stringify(member.pythonName)}: ${member.pythonName}`,
        ),
    );

    // Optional properties, will only be put into the dict if they're not None
    for (const member of members.filter((m) => m.optional)) {
      code.openBlock(`if ${member.pythonName} is not None`);
      code.line(
        `${implicitParameter}._values["${member.pythonName}"] = ${member.pythonName}`,
      );
      code.closeBlock();
    }

    code.closeBlock();
  }

  private emitConstructorDocstring(code: codemaker.CodeMaker) {
    const args: DocumentableArgument[] = this.allMembers.map((m) => ({
      name: m.pythonName,
      docs: m.docs,
      definingType: this.spec,
    }));
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      arguments: args,
      documentableItem: `class-${this.pythonName}`,
    });
  }

  private emitGetter(
    member: StructField,
    code: codemaker.CodeMaker,
    context: EmitContext,
  ) {
    const pythonType = member.typeAnnotation(context);

    code.line('@builtins.property');
    openSignature(code, 'def', member.pythonName, ['self'], pythonType);
    member.emitDocString(code);
    // NOTE: No parameter to validate here, this is a getter.
    code.line(
      `result = self._values.get(${JSON.stringify(member.pythonName)})`,
    );
    if (!member.optional) {
      // Add an assertion to maye MyPY happy!
      code.line(
        `assert result is not None, "Required property '${member.pythonName}' is missing"`,
      );
    }
    code.line(`return typing.cast(${pythonType}, result)`);
    code.closeBlock();
  }

  private emitMagicMethods(code: codemaker.CodeMaker) {
    code.line();
    code.openBlock('def __eq__(self, rhs: typing.Any) -> builtins.bool');
    code.line(
      'return isinstance(rhs, self.__class__) and rhs._values == self._values',
    );
    code.closeBlock();

    code.line();
    code.openBlock('def __ne__(self, rhs: typing.Any) -> builtins.bool');
    code.line('return not (rhs == self)');
    code.closeBlock();

    code.line();
    code.openBlock('def __repr__(self) -> str');
    code.indent(`return "${this.pythonName}(%s)" % ", ".join(`);
    code.line('k + "=" + repr(v) for k, v in self._values.items()');
    code.unindent(')');
    code.closeBlock();
  }

  private propertyMap() {
    const ret = new Array<string>();
    for (const member of this.allMembers) {
      ret.push(
        `${JSON.stringify(member.pythonName)}: ${JSON.stringify(
          member.jsiiName,
        )}`,
      );
    }
    return ret;
  }
}

function assignDictionary(
  code: codemaker.CodeMaker,
  variable: string,
  elements: readonly string[],
  trailing?: string,
  compact = false,
): void {
  const space = compact ? '' : ' ';

  const prefix = `${variable}${space}=${space}{`;
  const suffix = `}${trailing ?? ''}`;

  if (elements.length === 0) {
    code.line(`${prefix}${suffix}`);
    return;
  }

  if (compact) {
    const join = ', ';
    const { elementsSize, joinSize } = totalSizeOf(elements, join);
    if (
      TARGET_LINE_LENGTH >
      prefix.length +
        code.currentIndentLength +
        elementsSize +
        joinSize +
        suffix.length
    ) {
      code.line(`${prefix}${elements.join(join)}${suffix}`);
      return;
    }
  }

  code.indent(prefix);
  for (const elt of elements) {
    code.line(`${elt},`);
  }
  code.unindent(suffix);
}
