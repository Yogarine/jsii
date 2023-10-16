import { PhpDeclaration } from '../php-declaration';
import { PhpType } from '../php-type';
import { IPhpTyped } from './php-typed';

export abstract class PhpTypedDeclaration
  extends PhpDeclaration
  implements IPhpTyped
{
  public abstract readonly type: PhpType;
}
