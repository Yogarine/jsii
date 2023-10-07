import { NamingContext } from '../naming-context';
import { TypeName } from '../type-name';
import { Primitive } from './primitive';

export class Optional implements TypeName {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #wrapped: TypeName;

  public constructor(wrapped: TypeName) {
    this.#wrapped = wrapped;
  }

  public pythonType(context: NamingContext) {
    const optionalType = this.#wrapped.pythonType({
      ...context,
      ignoreOptional: true,
    });
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (context.ignoreOptional || this.#wrapped === Primitive.ANY) {
      return optionalType;
    }
    return `typing.Optional[${optionalType}]`;
  }

  public requiredImports(context: NamingContext) {
    return this.#wrapped.requiredImports({ ...context, ignoreOptional: true });
  }
}
