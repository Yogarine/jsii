import { IPhpSymbol, PhpSymbol } from './php-symbol';

type PhpSymbolType<T extends IPhpSymbol> = new (...args: any[]) => T;

/**
 * Provides a symbol table to keep track of PHP symbols.
 */
export class PhpSymbolTable<T extends IPhpSymbol = PhpSymbol> extends Map<
  string,
  T
> {
  public constructor() {
    super();
  }

  /**
   * Filters the symbol table to contain only symbols of the given type.
   *
   * @param type The type to filter for.
   */
  public ofType<TFilter extends IPhpSymbol>(
    type: PhpSymbolType<TFilter>,
  ): PhpSymbolTable<TFilter> {
    const filteredSymbols = new PhpSymbolTable<TFilter>();

    this.forEach((symbol) => {
      if (symbol instanceof type) {
        filteredSymbols.set(symbol.fqn, symbol);
      }
    });

    return filteredSymbols;
  }

  /**
   * Get a symbol of the given type from the symbol table.
   *
   * @param type
   * @param fqn
   */
  public getOf<TFilter extends IPhpSymbol>(
    type: PhpSymbolType<TFilter>,
    fqn: string,
  ): TFilter | undefined {
    const symbol = this.get(fqn);
    if (!(symbol instanceof type)) {
      return undefined;
    }

    return symbol;
  }

  public ensureOf<TFilter extends IPhpSymbol>(
    type: PhpSymbolType<TFilter>,
    fqn: string,
  ): TFilter {
    const symbol = this.get(fqn);

    if (!symbol) {
      throw new Error(`Symbol ${fqn} does not exist`);
    }

    if (!(symbol instanceof type)) {
      throw new Error(`Symbol ${fqn} is not of type ${type.name}`);
    }

    return symbol;
  }
}
