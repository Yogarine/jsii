import { IPhpDeclaration } from '../php-declaration';
import { PhpType } from '../php-type';
import { IPhpParameter } from './php-parameter';
import { IPhpTyped } from './php-typed';
import { PhpTypedDeclaration } from './php-typed-declaration';

export interface IPhpFunction extends IPhpTyped, IPhpDeclaration {
  readonly parameters: IPhpParameter[];
}

export class PhpFunction extends PhpTypedDeclaration implements IPhpFunction {
  public constructor(
    fqn: string,
    public readonly name: string,
    public readonly type: PhpType,
  ) {
    super(fqn);
  }
}
