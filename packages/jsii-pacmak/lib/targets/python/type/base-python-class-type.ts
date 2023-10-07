import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as rosetta from 'jsii-rosetta';

import { nestedContext, openSignature, prepareMembers } from '../../python';
import { EmitContext } from '../naming-context/emit-context';
import { PythonBase } from '../python-base';
import { PythonGenerator } from '../python-generator';
import { PythonImports } from '../python-imports';
import { PythonType, PythonTypeOpts } from '../python-type';
import { mergePythonImports, toTypeName } from '../type-name';
import { TypeResolver } from '../type-resolver';
import { ISortableType } from './sortable-type';

export abstract class BasePythonClassType implements PythonType, ISortableType {
  protected bases: spec.TypeReference[];
  protected members: PythonBase[];
  protected readonly separateMembers: boolean = true;

  public constructor(
    protected readonly generator: PythonGenerator,
    public readonly pythonName: string,
    public readonly spec: spec.Type,
    public readonly fqn: string | undefined,
    opts: PythonTypeOpts,
    public readonly docs: spec.Docs | undefined,
  ) {
    const { bases = [] } = opts;

    this.bases = bases;
    this.members = [];
  }

  public dependsOn(resolver: TypeResolver): PythonType[] {
    const dependencies = new Array<PythonType>();
    const parent = resolver.getParent(this.fqn!);

    // We need to return any bases that are in the same module at the same level of
    // nesting.
    const seen = new Set<string>();
    for (const base of this.bases) {
      if (spec.isNamedTypeReference(base)) {
        if (resolver.isInModule(base)) {
          // Given a base, we need to locate the base's parent that is the same as
          // our parent, because we only care about dependencies that are at the
          // same level of our own.
          // TODO: We might need to recurse into our members to also find their
          //       dependencies.
          let baseItem = resolver.getType(base);
          let baseParent = resolver.getParent(base);
          while (baseParent !== parent) {
            baseItem = baseParent;
            baseParent = resolver.getParent(baseItem.fqn!);
          }

          if (!seen.has(baseItem.fqn!)) {
            dependencies.push(baseItem);
            seen.add(baseItem.fqn!);
          }
        }
      }
    }

    return dependencies;
  }

  public requiredImports(context: EmitContext): PythonImports {
    return mergePythonImports(
      ...this.bases.map((base) => toTypeName(base).requiredImports(context)),
      ...this.members.map((mem) => mem.requiredImports(context)),
    );
  }

  public addMember(member: PythonBase) {
    this.members.push(member);
  }

  public get apiLocation(): rosetta.ApiLocation {
    if (!this.fqn) {
      throw new Error(
        `Cannot make apiLocation for ${this.pythonName}, does not have FQN`,
      );
    }
    return { api: 'type', fqn: this.fqn };
  }

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    context = nestedContext(context, this.fqn);

    const classParams = this.getClassParams(context);
    openSignature(code, 'class', this.pythonName, classParams);

    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      documentableItem: `class-${this.pythonName}`,
      trailingNewLine: true,
    });

    if (this.members.length > 0) {
      const resolver = this.boundResolver(context.resolver);
      let shouldSeparate = false;
      for (const member of prepareMembers(this.members, resolver)) {
        if (shouldSeparate) {
          code.line();
        }
        shouldSeparate = this.separateMembers;
        member.emit(code, { ...context, resolver });
      }
    } else {
      code.line('pass');
    }

    code.closeBlock();

    if (this.fqn != null) {
      context.emittedTypes.add(this.fqn);
    }
  }

  protected boundResolver(resolver: TypeResolver): TypeResolver {
    if (this.fqn == null) {
      return resolver;
    }
    return resolver.bind(this.fqn);
  }

  protected abstract getClassParams(context: EmitContext): string[];
}
