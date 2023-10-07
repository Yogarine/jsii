import * as codemaker from 'codemaker';
import * as crypto from 'crypto';

import { openSignature } from '../python';

export class TypeCheckingStub {
  static readonly #PREFIX = '_typecheckingstub__';

  readonly #arguments: readonly string[];
  readonly #hash: string;

  public constructor(fqn: string, args: readonly string[]) {
    // Removing the quoted type names -- this will be emitted at the very end of the module.
    this.#arguments = args.map((arg) => arg.replace(/"/g, ''));
    this.#hash = crypto
      .createHash('sha256')
      .update(TypeCheckingStub.#PREFIX)
      .update(fqn)
      .digest('hex');
  }

  public get name(): string {
    return `${TypeCheckingStub.#PREFIX}${this.#hash}`;
  }

  public emit(code: codemaker.CodeMaker) {
    code.line();
    openSignature(code, 'def', this.name, this.#arguments, 'None');
    code.line(`"""Type checking stubs"""`);
    code.line('pass');
    code.closeBlock();
  }
}
