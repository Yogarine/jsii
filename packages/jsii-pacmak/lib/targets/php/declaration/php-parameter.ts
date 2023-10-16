import { IPhpDeclaration } from '../php-declaration';
import { IPhpObject } from '../php-object';
import { IPhpFunction } from './php-function';
import { IPhpTyped } from './php-typed';

/**
 * Represents a function parameter in PHP.
 */
export interface IPhpParameter extends IPhpTyped, IPhpDeclaration {
  /**
   * The function that declares this parameter.
   */
  readonly declaringFunction: IPhpFunction;

  /**
   * Default parameter values may be scalar values, arrays, the special type
   * `null`, and objects using the `new ClassName()` syntax.
   */
  readonly defaultValue?: string | number | boolean | null | void | IPhpObject;

  /**
   * Whether this parameter is passed by reference.
   */
  readonly byReference: boolean;

  /**
   * Whether this parameter is variadic.
   */
  readonly variadic: boolean;
}
