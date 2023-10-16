import { PhpSymbolTable } from './php-symbol-table';
import { PhpType, PhpTypeProps } from './php-type';

export interface PhpIntersectionTypeProps extends PhpTypeProps {}

/**
 * An intersection type accepts values which satisfies multiple class-type
 * declarations, rather than a single one.
 *
 * Individual types which form the intersection type are joined by the & symbol.
 * Therefore, an intersection type comprised of the types T, U, and V will be
 * written as `T&U&V`.
 */
export class PhpIntersectionType extends PhpType {
  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    public readonly types: PhpType[],
    props: PhpIntersectionTypeProps,
  ) {
    super(symbolTable, fqn, props);
  }
}
