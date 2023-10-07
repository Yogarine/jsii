import { BaseMethod } from '../base-method';

export class Method extends BaseMethod {
  protected readonly implicitParameter: string = 'self';
  protected readonly jsiiMethod: string = 'invoke';
}
