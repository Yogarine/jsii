import * as spec from '@jsii/spec';

import { PythonBase } from './python-base';

export interface PythonTypeOpts {
  bases?: spec.TypeReference[];
}

export interface PythonType extends PythonBase {
  /**
   * The JSII FQN for this item, if this item doesn't exist as a JSII type, then
   * it doesn't have a FQN and it should be null;
   */
  readonly fqn?: string;

  addMember(member: PythonBase): void;
}
