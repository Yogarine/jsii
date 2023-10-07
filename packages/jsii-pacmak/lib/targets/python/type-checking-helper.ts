import * as codemaker from 'codemaker';

import { TypeCheckingStub } from './type-checking-stub';

export class TypeCheckingHelper {
  #stubs = new Array<TypeCheckingStub>();

  public getTypeHints(fqn: string, args: readonly string[]): string {
    const stub = new TypeCheckingStub(fqn, args);
    this.#stubs.push(stub);
    return `typing.get_type_hints(${stub.name})`;
  }

  /**
   * Emits instructions that create the annotations data.
   */
  public flushStubs(code: codemaker.CodeMaker) {
    for (const stub of this.#stubs) {
      stub.emit(code);
    }
    // Reset the stubs list
    this.#stubs = [];
  }
}
