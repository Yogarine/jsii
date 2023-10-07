import * as spec from '@jsii/spec';

/**
 * Positional argument or keyword parameter
 */
export interface DocumentableArgument {
  name: string;
  definingType: spec.Type;
  docs?: spec.Docs;
}
