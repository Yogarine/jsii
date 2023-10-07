import * as spec from '@jsii/spec';

/**
 * Struct that stores metadata about a property that can be used in Java code generation.
 */
export interface JavaProp {
  /**
   * Documentation for the property.
   */
  docs?: spec.Docs;

  /**
   * The original JSII property spec this struct was derived from.
   */
  spec: spec.Property;

  /**
   * The original JSII type this property was defined on.
   */
  definingType: spec.Type;

  /**
   * Canonical name of the Java property (eg: 'MyProperty').
   */
  propName: string;

  /**
   * The original canonical name of the JSII property.
   */
  jsiiName: string;

  /**
   * Field name of the Java property (eg: 'myProperty').
   */
  fieldName: string;

  /**
   * The java type for the property (eg: 'List<String>').
   */
  fieldJavaType: string;

  /**
   * The java type for the parameter (e.g: 'List<? extends SomeType>').
   */
  paramJavaType: string;

  /**
   * The NativeType representation of the property's type.
   */
  fieldNativeType: string;

  /**
   * The raw class type of the property that can be used for marshalling (eg: 'List.class').
   */
  fieldJavaClass: string;

  /**
   * List of types that the property is assignable from. Used to overload setters.
   */
  javaTypes: string[];

  /**
   * True if the property is optional.
   */
  nullable: boolean;

  /**
   * True if the property has been transitively inherited from a base class.
   */
  inherited: boolean;

  /**
   * True if the property is read-only once initialized.
   */
  immutable: boolean;
}
