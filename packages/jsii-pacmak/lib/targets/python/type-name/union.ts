import { NamingContext } from '../naming-context';
import { mergePythonImports, TypeName } from '../type-name';

export class Union implements TypeName {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #options: readonly TypeName[];

  public constructor(options: readonly TypeName[]) {
    this.#options = options;
  }

  public pythonType(context: NamingContext) {
    return `typing.Union[${this.#options
      .map((o) => o.pythonType(context))
      .join(', ')}]`;
  }

  public requiredImports(context: NamingContext) {
    return mergePythonImports(
      ...this.#options.map((o) => o.requiredImports(context)),
    );
  }
}
