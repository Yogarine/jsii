import * as spec from '@jsii/spec';

import { Generator } from '../../generator';
import { PhpClass } from './declaration/php-class';
import { PhpDeclaration } from './php-declaration';

export class PhpGenerator extends Generator {
  private readonly symbols: { [fqn: string]: PhpDeclaration } = {};

  //
  // Bundled assembly
  // jsii modules should bundle the assembly itself as a resource and use the load() kernel API to load it.
  //

  /**
   * Returns the destination directory for the assembly file.
   */
  protected getAssemblyOutputDir(_mod: spec.Assembly): string | undefined {
    return super.getAssemblyOutputDir(_mod);
  }

  //
  // Assembly

  protected onBeginAssembly(_assm: spec.Assembly, _fingerprint: boolean) {
    return super.onBeginAssembly(_assm, _fingerprint);
  }

  protected onEndAssembly(_assm: spec.Assembly, _fingerprint: boolean) {
    return super.onEndAssembly(_assm, _fingerprint);
  }

  //
  // Namespaces

  protected onBeginNamespace(_ns: string) {
    return super.onBeginNamespace(_ns);
  }

  protected onEndNamespace(_ns: string) {
    return super.onEndNamespace(_ns);
  }

  //
  // Classes

  protected onBeginClass(_cls: spec.ClassType, _abstract: boolean | undefined) {
    super.onBeginClass(_cls, _abstract);

    this.symbols[_cls.fqn] = new PhpClass(_cls.fqn, {});
  }

  protected onEndClass(_cls: spec.ClassType) {
    return super.onEndClass(_cls);
  }

  //
  // Interfaces

  protected onBeginInterface(ifc: spec.InterfaceType): void {
    /* TODO: noop */
  }

  protected onEndInterface(ifc: spec.InterfaceType): void {
    /* TODO: noop */
  }

  protected onInterfaceMethod(
    ifc: spec.InterfaceType,
    method: spec.Method,
  ): void {
    /* TODO: noop */
  }

  protected onInterfaceMethodOverload(
    ifc: spec.InterfaceType,
    overload: spec.Method,
    originalMethod: spec.Method,
  ): void {
    /* TODO: noop */
  }

  protected onInterfaceProperty(
    ifc: spec.InterfaceType,
    prop: spec.Property,
  ): void {
    /* TODO: noop */
  }

  //
  // Initializers (constructos)

  protected onInitializer(
    _cls: spec.ClassType,
    _initializer: spec.Initializer,
  ) {
    super.onInitializer(_cls, _initializer);
  }
  protected onInitializerOverload(
    _cls: spec.ClassType,
    _overload: spec.Initializer,
    _originalInitializer: spec.Initializer,
  ) {
    super.onInitializerOverload(_cls, _overload, _originalInitializer);
  }

  //
  // Properties

  protected onBeginProperties(_cls: spec.ClassType) {
    return super.onBeginProperties(_cls);
  }

  protected onProperty(cls: spec.ClassType, prop: spec.Property): void {
    /* TODO: noop */
  }

  protected onStaticProperty(cls: spec.ClassType, prop: spec.Property): void {
    /* TODO: noop */
  }

  protected onEndProperties(_cls: spec.ClassType) {
    super.onEndProperties(_cls);
  }

  //
  // Union Properties
  // Those are properties that can accept more than a single type (i.e. String | Token). If the option `expandUnionProperties` is enabled
  // instead of onUnionProperty, the method onExpandedUnionProperty will be called for each of the types defined in the property.
  // `primaryName` indicates the original name of the union property (without the 'AsXxx' postfix).

  protected onUnionProperty(
    cls: spec.ClassType,
    prop: spec.Property,
    union: spec.UnionTypeReference,
  ): void {
    /* TODO: noop */
  }

  protected onExpandedUnionProperty(
    _cls: spec.ClassType,
    _prop: spec.Property,
    _primaryName: string,
  ): void {
    return super.onExpandedUnionProperty(_cls, _prop, _primaryName);
  }

  //
  // Methods

  protected onBeginMethods(_cls: spec.ClassType) {
    return super.onBeginMethods(_cls);
  }

  protected onMethod(cls: spec.ClassType, method: spec.Method): void {
    /* TODO: noop */
  }

  /**
   * Create overloads for methods with optional arguments.
   *
   * Triggered if the option `generateOverloadsForMethodWithOptionals` is
   * enabled for each overload of the original method.
   *
   * The original method will be emitted via `onMethod()`.
   */
  protected onMethodOverload(
    _cls: spec.ClassType,
    _overload: spec.Method,
    _originalMethod: spec.Method,
  ): void {
    /* TODO: noop */
  }

  protected onStaticMethod(cls: spec.ClassType, method: spec.Method): void {
    /* TODO: noop */
  }

  protected onStaticMethodOverload(
    cls: spec.ClassType,
    overload: spec.Method,
    originalMethod: spec.Method,
  ): void {
    /* TODO: noop */
  }

  protected onEndMethods(_cls: spec.ClassType) {
    return super.onEndMethods(_cls);
  }

  //
  // Enums

  protected onBeginEnum(_enm: spec.EnumType) {
    return super.onBeginEnum(_enm);
  }
  protected onEndEnum(_enm: spec.EnumType) {
    return super.onEndEnum(_enm);
  }
  protected onEnumMember(_enm: spec.EnumType, _member: spec.EnumMember) {
    return super.onEnumMember(_enm, _member);
  }
}
