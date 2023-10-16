import { PhpSymbolTable } from './php-symbol-table';
import { PhpType, PhpTypeProps } from './php-type';

export interface PhpNamedTypeProps extends PhpTypeProps {}

export class PhpNamedType extends PhpType {
  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    public readonly name: string,
    props: PhpNamedTypeProps,
  ) {
    super(symbolTable, fqn, props);
  }
}
