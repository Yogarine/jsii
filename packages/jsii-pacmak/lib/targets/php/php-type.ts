import { PhpSymbol } from './php-symbol';
import { PhpSymbolTable } from './php-symbol-table';

/**
 * PHP uses a nominal type system with a strong behavioral subtyping relation.
 *
 * The subtyping relation is checked at compile time whereas the verification of
 * types is dynamically checked at run time.
 *
 * PHP's type system supports various atomic types that can be composed together
 * to create more complex types. Some of these types can be written as type
 * declarations.
 */
export interface IPhpType {
  /**
   * Whether null is allowed as a value.
   */
  readonly allowsNull: boolean;
}

export interface PhpTypeProps {
  /**
   * Whether null is allowed as a value.
   */
  readonly allowsNull: boolean;
}

/**
 * PHP uses a nominal type system with a strong behavioral subtyping relation.
 *
 * The subtyping relation is checked at compile time whereas the verification of
 * types is dynamically checked at run time.
 *
 * PHP's type system supports various atomic types that can be composed together
 * to create more complex types. Some of these types can be written as type
 * declarations.
 */
export class PhpType extends PhpSymbol implements IPhpType {
  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    protected readonly props: PhpTypeProps,
  ) {
    super(symbolTable, fqn);
  }

  /**
   * Returns whether null is allowed as a value.
   */
  public get allowsNull(): boolean {
    return this.props.allowsNull;
  }
}
