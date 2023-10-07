import * as spec from '@jsii/spec';
import * as escapeStringRegexp from 'escape-string-regexp';

import { PythonType } from './python-type';
import { PythonModule } from './type/python-module';
import { toPythonIdentifier } from './util';

export class TypeResolver {
  private readonly types: Map<string, PythonType>;
  private readonly boundTo?: string;
  private readonly boundRe!: RegExp;
  private readonly moduleName?: string;
  private readonly moduleRe!: RegExp;
  private readonly findModule: FindModuleCallback;
  private readonly findType: FindTypeCallback;

  public constructor(
    types: Map<string, PythonType>,
    findModule: FindModuleCallback,
    findType: FindTypeCallback,
    boundTo?: string,
    moduleName?: string,
  ) {
    this.types = types;
    this.findModule = findModule;
    this.findType = findType;
    this.moduleName = moduleName;
    this.boundTo = boundTo !== undefined ? this.toPythonFQN(boundTo) : boundTo;

    if (this.moduleName !== undefined) {
      this.moduleRe = new RegExp(
        `^(${escapeStringRegexp(this.moduleName)})\\.(.+)$`,
      );
    }

    if (this.boundTo !== undefined) {
      this.boundRe = new RegExp(
        `^(${escapeStringRegexp(this.boundTo)})\\.(.+)$`,
      );
    }
  }

  public bind(fqn: string, moduleName?: string): TypeResolver {
    return new TypeResolver(
      this.types,
      this.findModule,
      this.findType,
      fqn,
      moduleName !== undefined
        ? moduleName.startsWith('.')
          ? `${this.moduleName}${moduleName}`
          : moduleName
        : this.moduleName,
    );
  }

  public isInModule(typeRef: spec.NamedTypeReference | string): boolean {
    const pythonType =
      typeof typeRef !== 'string' ? this.toPythonFQN(typeRef.fqn) : typeRef;
    return this.moduleRe.test(pythonType);
  }

  public isInNamespace(typeRef: spec.NamedTypeReference | string): boolean {
    const pythonType =
      typeof typeRef !== 'string' ? this.toPythonFQN(typeRef.fqn) : typeRef;
    return this.boundRe.test(pythonType);
  }

  public getParent(typeRef: spec.NamedTypeReference | string): PythonType {
    const fqn = typeof typeRef !== 'string' ? typeRef.fqn : typeRef;
    const matches = /^(.+)\.[^.]+$/.exec(fqn);
    if (matches == null || !Array.isArray(matches)) {
      throw new Error(`Invalid FQN: ${fqn}`);
    }
    const [, parentFQN] = matches;
    const parent = this.types.get(parentFQN);

    if (parent === undefined) {
      throw new Error(`Could not find parent:  ${parentFQN}`);
    }

    return parent;
  }

  public getDefiningPythonModule(
    typeRef: spec.NamedTypeReference | string,
  ): string {
    const fqn = typeof typeRef !== 'string' ? typeRef.fqn : typeRef;
    const parent = this.types.get(fqn);

    if (parent) {
      let mod = parent;
      while (!(mod instanceof PythonModule)) {
        mod = this.getParent(mod.fqn!);
      }
      return mod.pythonName;
    }

    const matches = /^([^.]+)\./.exec(fqn);
    if (matches == null || !Array.isArray(matches)) {
      throw new Error(`Invalid FQN: ${fqn}`);
    }
    const [, assm] = matches;
    return this.findModule(assm).targets!.python!.module;
  }

  public getType(typeRef: spec.NamedTypeReference): PythonType {
    const type = this.types.get(typeRef.fqn);

    if (type === undefined) {
      throw new Error(`Could not locate type: "${typeRef.fqn}"`);
    }

    return type;
  }

  public dereference(typeRef: string | spec.NamedTypeReference): spec.Type {
    if (typeof typeRef !== 'string') {
      typeRef = typeRef.fqn;
    }
    return this.findType(typeRef);
  }

  private toPythonFQN(fqn: string): string {
    const [assemblyName, ...qualifiedIdentifiers] = fqn.split('.');
    const fqnParts: string[] = [
      this.findModule(assemblyName).targets!.python!.module,
    ];

    for (const part of qualifiedIdentifiers) {
      fqnParts.push(toPythonIdentifier(part));
    }

    return fqnParts.join('.');
  }
}

type FindModuleCallback = (fqn: string) => spec.AssemblyConfiguration;
type FindTypeCallback = (fqn: string) => spec.Type;
