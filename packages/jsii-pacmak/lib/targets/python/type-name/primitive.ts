import * as spec from '@jsii/spec';

import { TypeName } from '../type-name';

export class Primitive implements TypeName {
  private static readonly BOOL = new Primitive('builtins.bool');
  private static readonly DATE = new Primitive('datetime.datetime');
  private static readonly JSII_NUMBER = new Primitive('jsii.Number'); // "jsii" is always already imported!
  private static readonly STR = new Primitive('builtins.str');
  private static readonly JSON = new Primitive(
    'typing.Mapping[typing.Any, typing.Any]',
  );

  public static readonly ANY = new Primitive('typing.Any');
  public static readonly NONE = new Primitive('None');

  public static of(type: spec.PrimitiveTypeReference): TypeName {
    switch (type.primitive) {
      case spec.PrimitiveType.Boolean:
        return Primitive.BOOL;
      case spec.PrimitiveType.Date:
        return Primitive.DATE;
      case spec.PrimitiveType.Number:
        return Primitive.JSII_NUMBER;
      case spec.PrimitiveType.String:
        return Primitive.STR;
      case spec.PrimitiveType.Json:
        return Primitive.JSON;
      case spec.PrimitiveType.Any:
      default:
        return Primitive.ANY;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #pythonType: string;

  private constructor(pythonType: string) {
    this.#pythonType = pythonType;
  }

  public pythonType() {
    return this.#pythonType;
  }

  public requiredImports() {
    return {};
  }
}
