import { PhpSymbolTable } from './php-symbol-table';

export interface IPhpSymbol {
  readonly fqn: string;
}

/**
 * Represents a PHP symbol (class, interface, enum, etc.)
 */
export abstract class PhpSymbol implements IPhpSymbol {
  /**
   * The PHP namespace separator.
   */
  public static readonly NAMESPACE_SEPARATOR = '\\';

  /**
   * Name of the Symbol.
   */
  public readonly fqn: string;

  protected constructor(
    public readonly symbolTable: PhpSymbolTable,
    fqn: string,
  ) {
    this.fqn = this.normalizeFqn(fqn);
    symbolTable.set(this.fqn, this);
  }

  /**
   * Normalizes the given namespace to a PHP-compatible namespace.
   *
   * @param  fqn  Fully-qualified name to normalize. May be period-separated.
   */
  protected normalizeFqn(fqn: string): string {
    return fqn
      .split('.')
      .map((part) => {
        return part
          .split('-')
          .map((word) => {
            return word[0].toUpperCase() + word.slice(1);
          })
          .join('');
      })
      .join(PhpSymbol.NAMESPACE_SEPARATOR);
  }
}
