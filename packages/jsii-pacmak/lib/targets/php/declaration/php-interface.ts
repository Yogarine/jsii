import { IPhpDeclaration, PhpDeclaration } from '../php-declaration';
import { PhpSymbol } from '../php-symbol';
import { PhpSymbolTable } from '../php-symbol-table';
import { IPhpClassConstant } from './php-class-constant';
import { IPhpFinal } from './php-final';
import { IPhpMethod } from './php-method';

/**
 * Represents a PHP interface.
 */
export interface IPhpInterface extends IPhpDeclaration, IPhpFinal {
  readonly interfaces: IPhpInterface[];
  readonly constants: IPhpClassConstant[];
  readonly methods: IPhpMethod[];
  readonly staticMethods: IPhpMethod[];
}

export interface PhpInterfaceProps {
  readonly interfaceFqns?: string[];
  readonly final?: boolean;
}

/**
 * A PHP interface.
 */
export class PhpInterface extends PhpDeclaration implements IPhpInterface {
  /**
   * The base name of this class.
   */
  public readonly name: string;

  /**
   * Class constants.
   */
  public constants: IPhpClassConstant[] = [];

  /**
   * Methods of this class.
   */
  public methods: IPhpMethod[] = [];

  /**
   * Static methods of this class.
   */
  public staticMethods: IPhpMethod[] = [];

  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    protected readonly props: PhpInterfaceProps,
  ) {
    super(symbolTable, fqn);

    this.name = this.fqn.split(PhpSymbol.NAMESPACE_SEPARATOR).pop()!;
  }

  /**
   * Returns the interfaces this interface extends.
   */
  public get interfaces(): IPhpInterface[] {
    if (!this.props.interfaceFqns) {
      return [];
    }

    return this.props.interfaceFqns.map((fqn: string) => {
      return this.symbolTable.ensureOf(PhpInterface, fqn);
    });
  }

  /**
   * Whether this interface is final.
   */
  public isFinal(): boolean {
    return this.props.final ?? false;
  }
}
