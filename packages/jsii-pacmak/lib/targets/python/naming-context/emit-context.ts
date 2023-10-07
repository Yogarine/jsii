import { NamingContext } from '../naming-context';
import { TypeCheckingHelper } from '../type-checking-helper';
import { TypeResolver } from '../type-resolver';

export interface EmitContext extends NamingContext {
  /**
   * The TypeResolver.
   *
   * @deprecated
   */
  readonly resolver: TypeResolver;

  /**
   * Whether to emit runtime type checking code.
   */
  readonly runtimeTypeChecking: boolean;

  /**
   * Whether to runtime type check keyword arguments (i.e: struct constructors).
   */
  readonly runtimeTypeCheckKwargs?: boolean;

  /**
   * The numerical IDs used for type annotation data storing.
   */
  readonly typeCheckingHelper: TypeCheckingHelper;
}
