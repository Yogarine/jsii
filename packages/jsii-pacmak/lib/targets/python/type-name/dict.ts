import { NamingContext } from '../naming-context';
import { TypeName } from '../type-name';

export class Dict implements TypeName {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #element: TypeName;

  public constructor(element: TypeName) {
    this.#element = element;
  }

  public pythonType(context: NamingContext) {
    return `typing.Mapping[builtins.str, ${this.#element.pythonType(context)}]`;
  }

  public requiredImports(context: NamingContext) {
    return this.#element.requiredImports(context);
  }
}
