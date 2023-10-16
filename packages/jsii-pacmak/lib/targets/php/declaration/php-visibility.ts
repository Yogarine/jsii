/**
 * The visibility of a property, a method or a constant can be defined by
 * prefixing the declaration with the keywords `public`, `protected` or
 * `private`.
 *
 * Class members declared public can be accessed everywhere. Members declared
 * protected can be accessed only within the class itself and by inheriting and
 * parent classes. Members declared as private may only be accessed by the class
 * that defines the member.
 */
export enum PhpVisibility {
  PUBLIC = 'public',
  PROTECTED = 'protected',
  PRIVATE = 'private',
}

export interface IPhpVisibility {
  /**
   * The visibility of the member.
   */
  readonly visibility: PhpVisibility;

  /**
   * @returns `true` if the visibility is `public`, false otherwise.
   */
  isPublic(): boolean;

  /**
   * @returns `true` if the visibility is `protected`, false otherwise.
   */
  isProtected(): boolean;

  /**
   * @returns `true` if the visibility is `private`, false otherwise.
   */
  isPrivate(): boolean;
}
