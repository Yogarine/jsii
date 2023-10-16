import { PhpSymbolTable } from '../php-symbol-table';
import {
  IPhpInterface,
  PhpInterface,
  PhpInterfaceProps,
} from './php-interface';
import { IPhpProperty } from './php-property';

/**
 * Represents a PHP class.
 */
export interface IPhpClass extends IPhpInterface {
  readonly parent: IPhpClass | undefined;
  readonly properties: IPhpProperty[];
  readonly staticProperties: IPhpProperty[];
}

export interface PhpClassProps extends PhpInterfaceProps {
  readonly extendsFqn?: string;
  readonly abstract: boolean;
  readonly final: boolean;
}

/**
 * A PHP class.
 */
export class PhpClass extends PhpInterface implements IPhpClass {
  /**
   * This class' parent class, if any.
   */
  public readonly extendsFqn?: string;

  /**
   * Interfaces implemented by this class.
   */
  public implementsFqns: string[] = [];

  /**
   * Properties of this class.
   */
  public properties: IPhpProperty[] = [];

  /**
   * Static properties of this class.
   */
  public staticProperties: IPhpProperty[] = [];

  public constructor(
    symbolTable: PhpSymbolTable,
    fqn: string,
    protected readonly props: PhpClassProps,
  ) {
    super(symbolTable, fqn, props);
  }

  /**
   * Returns the parent class of this class, if any.
   */
  public get parent(): IPhpClass | undefined {
    if (!this.extendsFqn) {
      return undefined;
    }

    return this.symbolTable.getOf(PhpClass, this.extendsFqn);
  }
}
