import { BaseProperty } from '../base-property';

export class Property extends BaseProperty {
  protected readonly decorator: string = 'builtins.property';
  protected readonly implicitParameter: string = 'self';
  protected readonly jsiiGetMethod: string = 'get';
  protected readonly jsiiSetMethod: string = 'set';
}
