import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';

import { nestedContext, openSignature } from '../../../python';
import { BaseMethod } from '../../base-method';
import { BaseProperty } from '../../base-property';
import { EmitContext } from '../../naming-context/emit-context';
import { PythonGenerator } from '../../python-generator';
import { PythonImports } from '../../python-imports';
import { PythonType, PythonTypeOpts } from '../../python-type';
import { mergePythonImports, toTypeName } from '../../type-name';
import { TypeResolver } from '../../type-resolver';
import { BasePythonClassType } from '../base-python-class-type';
import { ISortableType } from '../sortable-type';

export interface ClassOpts extends PythonTypeOpts {
  abstract?: boolean;
  interfaces?: spec.NamedTypeReference[];
  abstractBases?: spec.ClassType[];
}

export class Class extends BasePythonClassType implements ISortableType {
  private readonly abstract: boolean;
  private readonly abstractBases: spec.ClassType[];
  private readonly interfaces: spec.NamedTypeReference[];

  public constructor(
    generator: PythonGenerator,
    name: string,
    spec: spec.Type,
    fqn: string,
    opts: ClassOpts,
    docs: spec.Docs | undefined,
  ) {
    super(generator, name, spec, fqn, opts, docs);

    const { abstract = false, interfaces = [], abstractBases = [] } = opts;

    this.abstract = abstract;
    this.interfaces = interfaces;
    this.abstractBases = abstractBases;
  }

  public dependsOn(resolver: TypeResolver): PythonType[] {
    const dependencies: PythonType[] = super.dependsOn(resolver);
    const parent = resolver.getParent(this.fqn!);

    // We need to return any ifaces that are in the same module at the same level of
    // nesting.
    const seen = new Set<string>();
    for (const iface of this.interfaces) {
      if (resolver.isInModule(iface)) {
        // Given a iface, we need to locate the ifaces's parent that is the same
        // as our parent, because we only care about dependencies that are at the
        // same level of our own.
        // TODO: We might need to recurse into our members to also find their
        //       dependencies.
        let ifaceItem = resolver.getType(iface);
        let ifaceParent = resolver.getParent(iface);
        while (ifaceParent !== parent) {
          ifaceItem = ifaceParent;
          ifaceParent = resolver.getParent(ifaceItem.fqn!);
        }

        if (!seen.has(ifaceItem.fqn!)) {
          dependencies.push(ifaceItem);
          seen.add(ifaceItem.fqn!);
        }
      }
    }

    return dependencies;
  }

  public requiredImports(context: EmitContext): PythonImports {
    return mergePythonImports(
      super.requiredImports(context), // Takes care of base & members
      ...this.interfaces.map((base) =>
        toTypeName(base).requiredImports(context),
      ),
    );
  }

  public emit(code: codemaker.CodeMaker, context: EmitContext) {
    // First we emit our implments decorator
    if (this.interfaces.length > 0) {
      const interfaces: string[] = this.interfaces.map((b) =>
        toTypeName(b).pythonType({ ...context, typeAnnotation: false }),
      );
      code.line(`@jsii.implements(${interfaces.join(', ')})`);
    }

    // Then we do our normal class logic for emitting our members.
    super.emit(code, context);

    // Then, if our class is Abstract, we have to go through and redo all of
    // this logic, except only emiting abstract methods and properties as non
    // abstract, and subclassing our initial class.
    if (this.abstract) {
      context = nestedContext(context, this.fqn);

      const proxyBases = [this.pythonName];
      for (const base of this.abstractBases) {
        // "# type: ignore[misc]" because MyPy cannot check dynamic base classes (naturally)
        proxyBases.push(
          `jsii.proxy_for(${toTypeName(base).pythonType({
            ...context,
            typeAnnotation: false,
          })}) # type: ignore[misc]`,
        );
      }

      code.line();
      code.line();
      openSignature(code, 'class', this.proxyClassName, proxyBases);

      // Filter our list of members to *only* be abstract members, and not any
      // other types.
      const abstractMembers = this.members.filter(
        (m) =>
          (m instanceof BaseMethod || m instanceof BaseProperty) && m.abstract,
      );
      if (abstractMembers.length > 0) {
        let first = true;
        for (const member of abstractMembers) {
          if (this.separateMembers) {
            if (first) {
              first = false;
            } else {
              code.line();
            }
          }
          member.emit(code, context, { renderAbstract: false });
        }
      } else {
        code.line('pass');
      }

      code.closeBlock();
      code.line();
      code.line(
        '# Adding a "__jsii_proxy_class__(): typing.Type" function to the abstract class',
      );
      code.line(
        `typing.cast(typing.Any, ${this.pythonName}).__jsii_proxy_class__ = lambda : ${this.proxyClassName}`,
      );
    }
  }

  protected getClassParams(context: EmitContext): string[] {
    const params: string[] = this.bases.map((b) =>
      toTypeName(b).pythonType({ ...context, typeAnnotation: false }),
    );
    const metaclass: string = this.abstract ? 'JSIIAbstractClass' : 'JSIIMeta';

    params.push(`metaclass=jsii.${metaclass}`);
    params.push(`jsii_type="${this.fqn}"`);

    return params;
  }

  private get proxyClassName(): string {
    return `_${this.pythonName}Proxy`;
  }
}
