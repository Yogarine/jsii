import { BaseMethod } from '../base-method';

export class InterfaceMethod extends BaseMethod {
  protected readonly implicitParameter: string = 'self';
  protected readonly jsiiMethod: string = 'invoke';
  protected readonly shouldEmitBody: boolean = false;
}
