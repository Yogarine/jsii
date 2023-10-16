import { PhpSymbolTable } from './php-symbol-table';
import { PhpType, PhpTypeProps } from './php-type';

export interface PhpUnionTypeProps extends PhpTypeProps {}

/**
 * A union type accepts values of multiple different types, rather than a single
 * one.
 *
 * Individual types which form the union type are joined by the | symbol.
 * Therefore, a union type comprised of the types T, U, and V will be written as
 * T|U|V. If one of the types is an intersection type, it needs to be bracketed
 * with parenthesis for it to written in Disjunctive Normal Form: `T|(X&Y)`.
 */
export class PhpUnionType extends PhpType {
  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    public readonly types: PhpType[],
    props: PhpUnionTypeProps,
  ) {
    super(symbolTable, fqn, props);
  }
}
