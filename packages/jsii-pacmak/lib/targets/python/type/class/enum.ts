import * as codemaker from 'codemaker';

import { emitList, nestedContext } from '../../../python';
import { EmitContext } from '../../naming-context/emit-context';
import { PythonImports } from '../../python-imports';
import { BasePythonClassType } from '../base-python-class-type';

export class Enum extends BasePythonClassType {
  protected readonly separateMembers = false;

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    context = nestedContext(context, this.fqn);
    emitList(code, '@jsii.enum(', [`jsii_type="${this.fqn}"`], ')');
    return super.emit(code, context);
  }

  protected getClassParams(_context: EmitContext): string[] {
    return ['enum.Enum'];
  }

  public requiredImports(context: EmitContext): PythonImports {
    return super.requiredImports(context);
  }
}
