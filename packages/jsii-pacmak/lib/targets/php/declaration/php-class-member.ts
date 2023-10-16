import { PhpDeclaration } from '../php-declaration';
import { PhpSymbolTable } from '../php-symbol-table';
import { IPhpType } from '../php-type';
import { IPhpTyped } from './php-typed';
import { PhpTypedDeclaration } from './php-typed-declaration';
import { IPhpVisibility, PhpVisibility } from './php-visibility';

export interface IPhpClassMember extends IPhpTyped, IPhpVisibility {}

export interface PhpClassMemberProps {
  readonly visibility?: PhpVisibility;
}

/**
 * A member is a declaration that is part of a greater language construct, such
 * as a class or namespace.
 */
export abstract class PhpClassMember
  extends PhpDeclaration
  implements IPhpClassMember
{
  public readonly memberSeparator = '::';

  protected constructor(
    symbolTable: PhpSymbolTable,
    fqcn: string,
    public readonly type: IPhpType,
    public readonly name: string,
    protected readonly props: PhpClassMemberProps,
  ) {
    super(symbolTable, fqcn);
  }

  protected normalizeFqn(fqn: string): string {
    const parts = this.normalizeFqn(fqn).split(
      PhpTypedDeclaration.NAMESPACE_SEPARATOR,
    );
    const name = parts.pop()!;

    return (
      parts.join(PhpTypedDeclaration.NAMESPACE_SEPARATOR) +
      this.memberSeparator +
      name
    );
  }

  public get visibility(): PhpVisibility {
    return this.props.visibility ?? PhpVisibility.PUBLIC;
  }

  public isPublic(): boolean {
    return PhpVisibility.PUBLIC === this.visibility;
  }

  public isProtected(): boolean {
    return PhpVisibility.PROTECTED === this.visibility;
  }

  public isPrivate(): boolean {
    return PhpVisibility.PRIVATE === this.visibility;
  }
}
