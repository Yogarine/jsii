import { PhpAttribute } from '../php-attribute';
import { IPhpType } from '../php-type';
import { IPhpAbstract } from './php-abstract';
import { IPhpClassMember, PhpClassMember } from './php-class-member';
import { IPhpFinal } from './php-final';
import { IPhpFunction } from './php-function';
import { IPhpParameter } from './php-parameter';
import { IPhpStatic } from './php-static';
import { PhpVisibility } from './php-visibility';

/**
 * Represents a PHP class method.
 */
export interface IPhpMethod
  extends IPhpFunction,
    IPhpClassMember,
    IPhpFinal,
    IPhpAbstract,
    IPhpStatic {}

export interface PhpMethodProps {
  readonly abstract?: boolean;
  readonly final?: boolean;
  readonly static?: boolean;
  readonly visibility: PhpVisibility;
}

/**
 * A PHP class method.
 */
export class PhpMethod extends PhpClassMember implements IPhpMethod {
  public parameters: IPhpParameter[] = [];
  public namespace: string;
  attributes: PhpAttribute[];
  fqn: string;

  public constructor(
    fqcn: string,
    public readonly name: string,
    public readonly type: IPhpType,
    protected readonly props: PhpMethodProps,
  ) {
    super(fqcn, type, name);
  }

  public isAbstract(): boolean {
    return this.props.abstract ?? false;
  }

  public isFinal(): boolean {
    return this.props.final ?? false;
  }

  public isStatic(): boolean {
    return this.props.static ?? false;
  }
}
