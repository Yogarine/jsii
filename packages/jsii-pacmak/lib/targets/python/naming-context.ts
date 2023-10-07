import * as spec from '@jsii/spec';

/**
 * The context in which a PythonType is being considered.
 */
export interface NamingContext {
  /**
   * The assembly in which the PythonType is expressed.
   */
  readonly assembly: spec.Assembly;

  /**
   * A resolver to obtain complete information about a type.
   */
  readonly typeResolver: (fqn: string) => spec.Type;

  /**
   * The submodule of the assembly in which the PythonType is expressed (could
   * be the module root)
   */
  readonly submodule: string;

  /**
   * The declaration is made in the context of a type annotation (so it can be
   * quoted)
   *
   * @default true
   */
  readonly typeAnnotation?: boolean;

  /**
   * An array representing the stack of declarations currently being
   * initialized. All of these names can only be referred to using a forward
   * reference (stringified type name) in the context of type signatures (but
   * they can be used safely from implementations so long as those are not *run*
   * as part of the declaration).
   *
   * @default []
   */
  readonly surroundingTypeFqns?: readonly string[];

  /**
   * Disables generating typing.Optional wrappers
   * @default false
   * @internal
   */
  readonly ignoreOptional?: boolean;

  /**
   * The set of jsii type FQNs that have already been emitted so far. This is
   * used to determine whether a given type reference is a forward declaration
   * or not when emitting type signatures.
   */
  readonly emittedTypes: Set<string>;

  /**
   * Whether the type is emitted for a parameter or not. This may change the
   * exact type signature being emitted (e.g: Arrays are typing.Sequence[T] for
   * parameters, and typing.List[T] otherwise).
   */
  readonly parameterType?: boolean;
}
