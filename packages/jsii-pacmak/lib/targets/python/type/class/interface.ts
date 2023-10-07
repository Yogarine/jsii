import * as codemaker from 'codemaker';

import { emitList, nestedContext, openSignature } from '../../../python';
import { EmitContext } from '../../naming-context/emit-context';
import { toTypeName } from '../../type-name';
import { BasePythonClassType } from '../base-python-class-type';

export class Interface extends BasePythonClassType {
  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    context = nestedContext(context, this.fqn);
    emitList(code, '@jsii.interface(', [`jsii_type="${this.fqn}"`], ')');

    // First we do our normal class logic for emitting our members.
    super.emit(code, context);

    code.line();
    code.line();

    // Then, we have to emit a Proxy class which implements our proxy interface.
    const proxyBases: string[] = this.bases.map(
      (b) =>
        // "# type: ignore[misc]" because MyPy cannot check dynamic base classes (naturally)
        `jsii.proxy_for(${toTypeName(b).pythonType({
          ...context,
          typeAnnotation: false,
        })}) # type: ignore[misc]`,
    );
    openSignature(code, 'class', this.proxyClassName, proxyBases);
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      documentableItem: `class-${this.pythonName}`,
      trailingNewLine: true,
    });
    code.line(`__jsii_type__: typing.ClassVar[str] = "${this.fqn}"`);

    if (this.members.length > 0) {
      for (const member of this.members) {
        if (this.separateMembers) {
          code.line();
        }
        member.emit(code, context, { forceEmitBody: true });
      }
    } else {
      code.line('pass');
    }

    code.closeBlock();
    code.line();
    code.line(
      '# Adding a "__jsii_proxy_class__(): typing.Type" function to the interface',
    );
    code.line(
      `typing.cast(typing.Any, ${this.pythonName}).__jsii_proxy_class__ = lambda : ${this.proxyClassName}`,
    );

    if (this.fqn != null) {
      context.emittedTypes.add(this.fqn);
    }
  }

  protected getClassParams(context: EmitContext): string[] {
    const params: string[] = this.bases.map((b) =>
      toTypeName(b).pythonType({ ...context, typeAnnotation: false }),
    );

    params.push('typing_extensions.Protocol');

    return params;
  }

  private get proxyClassName(): string {
    return `_${this.pythonName}Proxy`;
  }
}
