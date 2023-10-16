import { PhpDeclaration } from '../php-declaration';
import { PhpNamedType } from '../php-named-type';

export interface PhpEnumProps {
  readonly backingType: PhpNamedType;
}

export class PhpEnum extends PhpDeclaration {
  public constructor(
    fqn: string,
    public readonly name: string,
    protected readonly props: PhpEnumProps,
  ) {
    super(fqn);
  }
}
