export interface PythonImports {
  /**
   * For a given source module, what elements to import. The empty string value
   * indicates a need to import the module fully ("import <name>") instead of
   * doing a piecemeal import ("from <name> import <item>").
   */
  readonly [sourcePackage: string]: ReadonlySet<string>;
}
