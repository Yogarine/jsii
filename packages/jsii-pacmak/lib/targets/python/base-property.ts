import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as rosetta from 'jsii-rosetta';

import { emitParameterTypeChecks, openSignature } from '../python';
import { EmitContext } from './naming-context/emit-context';
import { PythonBase } from './python-base';
import { PythonGenerator } from './python-generator';
import { PythonImports } from './python-imports';
import { PythonType } from './python-type';
import { toTypeName } from './type-name';

export interface BasePropertyOpts {
  abstract?: boolean;
  immutable?: boolean;
  isStatic?: boolean;
  parent: spec.NamedTypeReference;
}

export interface BasePropertyEmitOpts {
  renderAbstract?: boolean;
  forceEmitBody?: boolean;
}

export abstract class BaseProperty implements PythonBase {
  public readonly abstract: boolean;
  public readonly isStatic: boolean;

  protected abstract readonly decorator: string;
  protected abstract readonly implicitParameter: string;
  protected readonly jsiiGetMethod!: string;
  protected readonly jsiiSetMethod!: string;
  protected readonly shouldEmitBody: boolean = true;

  private readonly immutable: boolean;
  private readonly parent: spec.NamedTypeReference;

  public constructor(
    private readonly generator: PythonGenerator,
    public readonly pythonName: string,
    private readonly jsName: string,
    private readonly type: spec.OptionalValue,
    public readonly docs: spec.Docs | undefined,
    private readonly pythonParent: PythonType,
    opts: BasePropertyOpts,
  ) {
    const { abstract = false, immutable = false, isStatic = false } = opts;

    this.abstract = abstract;
    this.immutable = immutable;
    this.isStatic = isStatic;
    this.parent = opts.parent;
  }

  public get apiLocation(): rosetta.ApiLocation {
    return { api: 'member', fqn: this.parent.fqn, memberName: this.jsName };
  }

  public requiredImports(context: EmitContext): PythonImports {
    return toTypeName(this.type).requiredImports(context);
  }

  public emit(
    code: codemaker.CodeMaker,
    context: EmitContext,
    opts?: BasePropertyEmitOpts,
  ) {
    const { renderAbstract = true, forceEmitBody = false } = opts ?? {};
    const pythonType = toTypeName(this.type).pythonType(context);

    code.line(`@${this.decorator}`);
    code.line(`@jsii.member(jsii_name="${this.jsName}")`);
    if (renderAbstract && this.abstract) {
      code.line('@abc.abstractmethod');
    }
    openSignature(
      code,
      'def',
      this.pythonName,
      [this.implicitParameter],
      pythonType,
      // PyRight and MyPY both special-case @property, but not custom implementations such as our @classproperty...
      // MyPY reports on the re-declaration, but PyRight reports on the initial declaration (duh!)
      this.isStatic && !this.immutable
        ? 'pyright: ignore [reportGeneralTypeIssues]'
        : undefined,
    );
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      documentableItem: `prop-${this.pythonName}`,
    });
    // NOTE: No parameters to validate here, this is a getter...
    if (
      (this.shouldEmitBody || forceEmitBody) &&
      (!renderAbstract || !this.abstract)
    ) {
      code.line(
        `return typing.cast(${pythonType}, jsii.${this.jsiiGetMethod}(${this.implicitParameter}, "${this.jsName}"))`,
      );
    } else {
      code.line('...');
    }
    code.closeBlock();

    if (!this.immutable) {
      code.line();
      // PyRight and MyPY both special-case @property, but not custom implementations such as our @classproperty...
      // MyPY reports on the re-declaration, but PyRight reports on the initial declaration (duh!)
      code.line(
        `@${this.pythonName}.setter${
          this.isStatic ? ' # type: ignore[no-redef]' : ''
        }`,
      );
      if (renderAbstract && this.abstract) {
        code.line('@abc.abstractmethod');
      }
      openSignature(
        code,
        'def',
        this.pythonName,
        [this.implicitParameter, `value: ${pythonType}`],
        'None',
      );
      if (
        (this.shouldEmitBody || forceEmitBody) &&
        (!renderAbstract || !this.abstract)
      ) {
        emitParameterTypeChecks(
          code,
          context,
          [`value: ${pythonType}`],
          `${this.pythonParent.fqn ?? this.pythonParent.pythonName}#${
            this.pythonName
          }`,
        );
        code.line(
          `jsii.${this.jsiiSetMethod}(${this.implicitParameter}, "${this.jsName}", value)`,
        );
      } else {
        code.line('...');
      }
      code.closeBlock();
    }
  }
}
