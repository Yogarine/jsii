import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as rosetta from 'jsii-rosetta';

import { EmitContext } from './naming-context/emit-context';
import { PythonBase } from './python-base';
import { PythonGenerator } from './python-generator';
import { PythonImports } from './python-imports';

export class EnumMember implements PythonBase {
  public constructor(
    private readonly generator: PythonGenerator,
    public readonly pythonName: string,
    private readonly value: string,
    public readonly docs: spec.Docs | undefined,
    private readonly parent: spec.NamedTypeReference,
  ) {
    this.pythonName = pythonName;
    this.value = value;
  }

  public get apiLocation(): rosetta.ApiLocation {
    return { api: 'member', fqn: this.parent.fqn, memberName: this.value };
  }

  public dependsOnModules() {
    return new Set<string>();
  }

  public emit(code: codemaker.CodeMaker, _context: EmitContext) {
    code.line(`${this.pythonName} = "${this.value}"`);
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      documentableItem: `enum-${this.pythonName}`,
    });
  }

  public requiredImports(_context: EmitContext): PythonImports {
    return {};
  }
}
