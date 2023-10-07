import { BaseMethod } from '../base-method';

export class StaticMethod extends BaseMethod {
  protected readonly decorator?: string = 'builtins.classmethod';
  protected readonly implicitParameter: string = 'cls';
  protected readonly jsiiMethod: string = 'sinvoke';
}
