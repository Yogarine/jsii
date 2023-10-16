import { PhpSymbolTable } from '../php-symbol-table';
import { PhpType } from '../php-type';
import {
  IPhpClassMember,
  PhpClassMember,
  PhpClassMemberProps,
} from './php-class-member';
import { IPhpFinal } from './php-final';
import { PhpVisibility } from './php-visibility';

/**
 * Represents a PHP class constant.
 */
export interface IPhpClassConstant extends IPhpClassMember, IPhpFinal {}

/**
 * Properties for a PHP class constant.
 */
export interface PhpClassConstantProps extends PhpClassMemberProps {
  readonly final?: boolean;
}

/**
 * A PHP class constant.
 */
export class PhpClassConstant
  extends PhpClassMember
  implements IPhpClassConstant
{
  public constructor(
    symbolTable: PhpSymbolTable,
    fqcn: string,
    type: PhpType,
    name: string,
    private readonly props: PhpClassConstantProps,
  ) {
    super(symbolTable, fqcn, type, name, props);
  }

  /**
   * The visibility of this class constant.
   */
  public get visibility(): PhpVisibility {
    return this.props.visibility ?? PhpVisibility.PUBLIC;
  }

  public isFinal(): boolean {
    return this.props.final ?? false;
  }

  public isPublic(): boolean {
    return this.visibility === PhpVisibility.PUBLIC;
  }

  public isProtected(): boolean {
    return this.visibility === PhpVisibility.PROTECTED;
  }

  public isPrivate(): boolean {
    return this.visibility === PhpVisibility.PRIVATE;
  }
}
