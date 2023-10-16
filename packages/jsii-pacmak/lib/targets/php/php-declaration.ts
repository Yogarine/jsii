import { PhpAttribute } from './php-attribute';
import { IPhpSymbol, PhpSymbol } from './php-symbol';
import { PhpSymbolTable } from './php-symbol-table';

/**
 * Represents a static declaration in PHP.
 *
 * e.g.: a class, method, function, parameter, property or class constants.
 */
export interface IPhpDeclaration extends IPhpSymbol {
  readonly name: string;
  readonly namespace: string;
  attributes: PhpAttribute[];
}

/**
 * A static declaration in PHP.
 */
export abstract class PhpDeclaration
  extends PhpSymbol
  implements IPhpDeclaration
{
  public abstract readonly name: string;

  /**
   * Attributes of this Declaration.
   */
  public attributes: PhpAttribute[] = [];

  /**
   * The namespace of this Declaration.
   */
  protected namespaceParts: string[];

  public constructor(symbolTable: PhpSymbolTable, fqn: string) {
    super(symbolTable, fqn);

    const parts = this.fqn.split(PhpDeclaration.NAMESPACE_SEPARATOR);
    parts.pop();

    this.namespaceParts = parts;
  }

  /**
   * The PHP namespace of the Symbol.
   */
  public get namespace(): string {
    return this.namespaceParts.join(PhpDeclaration.NAMESPACE_SEPARATOR);
  }
}
