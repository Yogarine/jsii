import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';

import { EmitContext } from './naming-context/emit-context';
import { PythonImports } from './python-imports';

export interface PythonBase {
  readonly pythonName: string;
  readonly docs?: spec.Docs;

  emit(code: codemaker.CodeMaker, context: EmitContext, opts?: any): void;

  requiredImports(context: EmitContext): PythonImports;
}
