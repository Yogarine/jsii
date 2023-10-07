import { BaseMethod } from '../base-method';

export class AsyncMethod extends BaseMethod {
  protected readonly implicitParameter: string = 'self';
  protected readonly jsiiMethod: string = 'ainvoke';
}
