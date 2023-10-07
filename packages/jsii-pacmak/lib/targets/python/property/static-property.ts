import { BaseProperty } from '../base-property';

export class StaticProperty extends BaseProperty {
  protected readonly decorator: string = 'jsii.python.classproperty';
  protected readonly implicitParameter: string = 'cls';
  protected readonly jsiiGetMethod: string = 'sget';
  protected readonly jsiiSetMethod: string = 'sset';
}
