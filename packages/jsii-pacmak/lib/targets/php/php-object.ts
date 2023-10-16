import { IPhpClass } from './declaration/php-class';
import { PhpValue } from './php-value';

/**
 * Represents a PHP object.
 */
export interface IPhpObject {
  /**
   * The class of the object.
   */
  readonly class: IPhpClass;

  /**
   * The arguments to pass to the constructor.
   */
  readonly arguments: { [name: string]: PhpValue };
}
