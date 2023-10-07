import { PythonType } from '../python-type';
import { TypeResolver } from '../type-resolver';

export interface ISortableType {
  dependsOn(resolver: TypeResolver): PythonType[];
}
