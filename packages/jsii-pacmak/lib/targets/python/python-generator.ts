import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as rosetta from 'jsii-rosetta';
import * as path from 'path';

import { Generator, GeneratorOptions } from '../../generator';
import { md2rst } from '../../markdown';
import { renderSummary } from '../_utils';
import { TargetName } from '../index';
import {
  DOCSTRING_QUOTES,
  pythonModuleNameToFilename,
  toPythonParameterName,
  toPythonPropertyName,
} from '../python';
import { toReleaseVersion } from '../version-utils';
import { DocumentableArgument } from './documentable-argument';
import { EnumMember } from './enum-member';
import { AsyncMethod } from './method/async-method';
import { Initializer } from './method/initializer';
import { InterfaceMethod } from './method/interface-method';
import { Method } from './method/method';
import { StaticMethod } from './method/static-method';
import { Package } from './package';
import { InterfaceProperty } from './property/interface-property';
import { Property } from './property/property';
import { StaticProperty } from './property/static-property';
import { PythonType } from './python-type';
import { StructField } from './struct-field';
import { TypeCheckingHelper } from './type-checking-helper';
import { getPackageName } from './type-name';
import { TypeResolver } from './type-resolver';
import { Class } from './type/class/class';
import { Enum } from './type/class/enum';
import { Interface } from './type/class/interface';
import { Struct } from './type/class/struct';
import { PythonModule } from './type/python-module';
import { toPythonIdentifier } from './util';

/**
 * A jsii package generator for the Python language.
 */
export class PythonGenerator extends Generator {
  private package!: Package;

  /**
   * The root module of the assembly.
   */
  private rootModule?: PythonModule;

  /**
   * A map of fully JSII FQNs to PythonType objects.
   */
  private readonly types: Map<string, PythonType>;

  /**
   *
   * @param rosetta Is used to transpile the documentation examples to Python.
   * @param options Options for the code generator framework.
   */
  public constructor(
    private readonly rosetta: rosetta.Rosetta,
    options: GeneratorOptions,
  ) {
    super(options);

    this.code.openBlockFormatter = (s) => `${s}:`;
    this.code.closeBlockFormatter = (_s) => false;

    this.types = new Map();
  }

  /**
   * Adds a documentation string to the provided `code`.
   */
  public emitDocString(
    code: codemaker.CodeMaker,
    apiLocation: rosetta.ApiLocation,
    docs: spec.Docs | undefined,
    options: {
      arguments?: DocumentableArgument[];
      documentableItem?: string;
      trailingNewLine?: boolean;
    } = {},
  ): void {
    if ((!docs || Object.keys(docs).length === 0) && !options.arguments) {
      return;
    }
    if (!docs) {
      docs = {};
    }

    const lines = new Array<string>();

    if (docs.summary) {
      lines.push(md2rst(renderSummary(docs)));
      brk();
    } else {
      lines.push('');
    }

    function brk() {
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('');
      }
    }

    function block(heading: string, content: string, doBrk = true) {
      if (doBrk) {
        brk();
      }
      const contentLines = md2rst(content).split('\n');
      if (contentLines.length <= 1) {
        lines.push(`:${heading}: ${contentLines.join('')}`.trim());
      } else {
        lines.push(`:${heading}:`);
        brk();
        for (const line of contentLines) {
          lines.push(line.trim());
        }
      }
      if (doBrk) {
        brk();
      }
    }

    if (docs.remarks) {
      brk();
      lines.push(
        ...md2rst(this.convertMarkdown(docs.remarks ?? '', apiLocation)).split(
          '\n',
        ),
      );
      brk();
    }

    if (options.arguments?.length ?? 0 > 0) {
      brk();
      for (const param of options.arguments!) {
        // Add a line for every argument. Even if there is no description, we need
        // the docstring so that the Sphinx extension can add the type annotations.
        lines.push(
          `:param ${toPythonParameterName(param.name)}: ${onelineDescription(
            param.docs,
          )}`,
        );
      }
      brk();
    }

    if (docs.default) {
      block('default', docs.default);
    }
    if (docs.returns) {
      block('return', docs.returns);
    }
    if (docs.deprecated) {
      block('deprecated', docs.deprecated);
    }
    if (docs.see) {
      block('see', docs.see, false);
    }
    if (docs.stability && shouldMentionStability(docs.stability)) {
      block('stability', docs.stability, false);
    }
    if (docs.subclassable) {
      block('subclassable', 'Yes');
    }

    for (const [k, v] of Object.entries(docs.custom ?? {})) {
      block(k, v, false);
    }

    if (docs.example) {
      brk();
      lines.push('Example::');
      lines.push('');
      const exampleText = this.convertExample(docs.example, apiLocation);

      for (const line of exampleText.split('\n')) {
        lines.push(`    ${line}`);
      }
      brk();
    }

    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (lines.length === 0) {
      return;
    }

    if (lines.length === 1) {
      code.line(`${DOCSTRING_QUOTES}${lines[0]}${DOCSTRING_QUOTES}`);
    } else {
      code.line(`${DOCSTRING_QUOTES}${lines[0]}`);
      lines.splice(0, 1);

      for (const line of lines) {
        code.line(line);
      }

      code.line(DOCSTRING_QUOTES);
    }
    if (options.trailingNewLine) {
      code.line();
    }
  }

  /**
   * Converts the provided example documentation to Python using Rosetta.
   */
  public convertExample(example: string, apiLoc: rosetta.ApiLocation): string {
    const translated = this.rosetta.translateExample(
      apiLoc,
      example,
      rosetta.TargetLanguage.PYTHON,
      rosetta.enforcesStrictMode(this.assembly),
    );

    return translated.source;
  }

  /**
   * Converts the provided Markdown string to Python using Rosetta.
   * @param markdown
   * @param apiLoc
   */
  public convertMarkdown(
    markdown: string,
    apiLoc: rosetta.ApiLocation,
  ): string {
    return this.rosetta.translateSnippetsInMarkdown(
      apiLoc,
      markdown,
      rosetta.TargetLanguage.PYTHON,
      rosetta.enforcesStrictMode(this.assembly),
    );
  }

  public getPythonType(fqn: string): PythonType {
    const type = this.types.get(fqn);

    if (type === undefined) {
      throw new Error(`Could not locate type: "${fqn}"`);
    }

    return type;
  }

  protected getAssemblyOutputDir(assm: spec.Assembly) {
    return path.join(
      'src',
      pythonModuleNameToFilename(this.getAssemblyModuleName(assm)),
    );
  }

  protected onBeginAssembly(assm: spec.Assembly, _fingerprint: boolean) {
    this.package = new Package(
      assm.targets!.python!.distName,
      toReleaseVersion(assm.version, TargetName.PYTHON),
      assm,
    );

    // This is the '<packagename>._jsii' module for this assembly
    const assemblyModule = new PythonModule(
      this.getAssemblyModuleName(assm),
      undefined,
      {
        assembly: assm,
        assemblyFilename: this.getAssemblyFileName(),
        loadAssembly: true,
        package: this.package,
      },
    );

    this.package.addModule(assemblyModule);
    this.package.addData(assemblyModule, this.getAssemblyFileName(), undefined);
  }

  protected onEndAssembly(assm: spec.Assembly, _fingerprint: boolean) {
    const resolver = new TypeResolver(
      this.types,
      (fqn: string) => this.findModule(fqn),
      (fqn: string) => this.findType(fqn),
    );
    this.package.write(this.code, {
      assembly: assm,
      emittedTypes: new Set(),
      resolver,
      runtimeTypeChecking: this.runtimeTypeChecking,
      submodule: assm.name,
      typeCheckingHelper: new TypeCheckingHelper(),
      typeResolver: (fqn) => resolver.dereference(fqn),
    });
  }

  /**
   * Will be called for assembly root, namespaces and submodules (anything that contains other types, based on its FQN)
   */
  protected onBeginNamespace(ns: string) {
    // 'ns' contains something like '@scope/jsii-calc-base-of-base'
    const submoduleLike =
      ns === this.assembly.name
        ? this.assembly
        : this.assembly.submodules?.[ns];

    const readmeLocation: rosetta.ApiLocation = {
      api: 'moduleReadme',
      moduleFqn: ns,
    };

    const module = new PythonModule(toPackageName(ns, this.assembly), ns, {
      assembly: this.assembly,
      assemblyFilename: this.getAssemblyFileName(),
      package: this.package,
      moduleDocumentation: submoduleLike?.readme
        ? this.convertMarkdown(
            submoduleLike.readme?.markdown,
            readmeLocation,
          ).trim()
        : undefined,
    });

    this.package.addModule(module);
    this.types.set(ns, module);
    if (ns === this.assembly.name) {
      // This applies recursively to submodules, so no need to duplicate!
      this.package.addData(module, 'py.typed', '');
    }

    if (ns === this.assembly.name) {
      this.rootModule = module;
    } else {
      this.rootModule!.addPythonModule(module);
    }
  }

  protected onEndNamespace(ns: string) {
    if (ns === this.assembly.name) {
      delete this.rootModule;
    }
  }

  protected onBeginClass(cls: spec.ClassType, abstract: boolean | undefined) {
    const klass = new Class(
      this,
      toPythonIdentifier(cls.name),
      cls,
      cls.fqn,
      {
        abstract,
        bases: cls.base ? [this.findType(cls.base)] : undefined,
        interfaces: cls.interfaces?.map((base) => this.findType(base)),
        abstractBases: abstract ? this.getAbstractBases(cls) : [],
      },
      cls.docs,
    );

    if (cls.initializer !== undefined) {
      const { parameters = [] } = cls.initializer;

      klass.addMember(
        new Initializer(
          this,
          '__init__',
          undefined,
          parameters,
          undefined,
          cls.initializer.docs,
          false, // Never static
          klass,
          { liftedProp: this.getliftedProp(cls.initializer), parent: cls },
        ),
      );
    }

    this.addPythonType(klass);
  }

  protected onStaticMethod(cls: spec.ClassType, method: spec.Method) {
    const { parameters = [] } = method;

    const klass = this.getPythonType(cls.fqn);

    klass.addMember(
      new StaticMethod(
        this,
        toPythonMethodName(method.name),
        method.name,
        parameters,
        method.returns,
        method.docs,
        true, // Always static
        klass,
        {
          abstract: method.abstract,
          liftedProp: this.getliftedProp(method),
          parent: cls,
        },
      ),
    );
  }

  protected onStaticProperty(cls: spec.ClassType, prop: spec.Property) {
    const klass = this.getPythonType(cls.fqn);
    klass.addMember(
      new StaticProperty(
        this,
        toPythonPropertyName(prop.name, prop.const),
        prop.name,
        prop,
        prop.docs,
        klass,
        {
          abstract: prop.abstract,
          immutable: prop.immutable,
          isStatic: prop.static,
          parent: cls,
        },
      ),
    );
  }

  protected onMethod(cls: spec.ClassType, method: spec.Method) {
    const { parameters = [] } = method;

    const klass = this.getPythonType(cls.fqn);

    if (method.async) {
      klass.addMember(
        new AsyncMethod(
          this,
          toPythonMethodName(method.name, method.protected),
          method.name,
          parameters,
          method.returns,
          method.docs,
          !!method.static,
          klass,
          {
            abstract: method.abstract,
            liftedProp: this.getliftedProp(method),
            parent: cls,
          },
        ),
      );
    } else {
      klass.addMember(
        new Method(
          this,
          toPythonMethodName(method.name, method.protected),
          method.name,
          parameters,
          method.returns,
          method.docs,
          !!method.static,
          klass,
          {
            abstract: method.abstract,
            liftedProp: this.getliftedProp(method),
            parent: cls,
          },
        ),
      );
    }
  }

  protected onProperty(cls: spec.ClassType, prop: spec.Property) {
    const klass = this.getPythonType(cls.fqn);
    klass.addMember(
      new Property(
        this,
        toPythonPropertyName(prop.name, prop.const, prop.protected),
        prop.name,
        prop,
        prop.docs,
        klass,
        {
          abstract: prop.abstract,
          immutable: prop.immutable,
          isStatic: prop.static,
          parent: cls,
        },
      ),
    );
  }

  protected onUnionProperty(
    cls: spec.ClassType,
    prop: spec.Property,
    _union: spec.UnionTypeReference,
  ) {
    this.onProperty(cls, prop);
  }

  protected onBeginInterface(ifc: spec.InterfaceType) {
    let iface: Interface | Struct;

    if (ifc.datatype) {
      iface = new Struct(
        this,
        toPythonIdentifier(ifc.name),
        ifc,
        ifc.fqn,
        { bases: ifc.interfaces?.map((base) => this.findType(base)) },
        ifc.docs,
      );
    } else {
      iface = new Interface(
        this,
        toPythonIdentifier(ifc.name),
        ifc,
        ifc.fqn,
        { bases: ifc.interfaces?.map((base) => this.findType(base)) },
        ifc.docs,
      );
    }

    this.addPythonType(iface);
  }

  protected onEndInterface(_ifc: spec.InterfaceType) {
    return;
  }

  protected onInterfaceMethod(ifc: spec.InterfaceType, method: spec.Method) {
    const { parameters = [] } = method;
    const klass = this.getPythonType(ifc.fqn);

    klass.addMember(
      new InterfaceMethod(
        this,
        toPythonMethodName(method.name, method.protected),
        method.name,
        parameters,
        method.returns,
        method.docs,
        !!method.static,
        klass,
        { liftedProp: this.getliftedProp(method), parent: ifc },
      ),
    );
  }

  protected onInterfaceProperty(ifc: spec.InterfaceType, prop: spec.Property) {
    let ifaceProperty: InterfaceProperty | StructField;

    const klass = this.getPythonType(ifc.fqn);

    if (ifc.datatype) {
      ifaceProperty = new StructField(this, prop, ifc);
    } else {
      ifaceProperty = new InterfaceProperty(
        this,
        toPythonPropertyName(prop.name, prop.const, prop.protected),
        prop.name,
        prop,
        prop.docs,
        klass,
        { immutable: prop.immutable, isStatic: prop.static, parent: ifc },
      );
    }

    klass.addMember(ifaceProperty);
  }

  protected onBeginEnum(enm: spec.EnumType) {
    this.addPythonType(
      new Enum(this, toPythonIdentifier(enm.name), enm, enm.fqn, {}, enm.docs),
    );
  }

  protected onEnumMember(enm: spec.EnumType, member: spec.EnumMember) {
    this.getPythonType(enm.fqn).addMember(
      new EnumMember(
        this,
        toPythonIdentifier(member.name),
        member.name,
        member.docs,
        enm,
      ),
    );
  }

  protected onInterfaceMethodOverload(
    _ifc: spec.InterfaceType,
    _overload: spec.Method,
    _originalMethod: spec.Method,
  ) {
    throw new Error('Unhandled Type: InterfaceMethodOverload');
  }

  protected onMethodOverload(
    _cls: spec.ClassType,
    _overload: spec.Method,
    _originalMethod: spec.Method,
  ) {
    throw new Error('Unhandled Type: MethodOverload');
  }

  protected onStaticMethodOverload(
    _cls: spec.ClassType,
    _overload: spec.Method,
    _originalMethod: spec.Method,
  ) {
    throw new Error('Unhandled Type: StaticMethodOverload');
  }

  private getAssemblyModuleName(assm: spec.Assembly): string {
    return `${assm.targets!.python!.module}._jsii`;
  }

  private getParentFQN(fqn: string): string {
    const m = /^(.+)\.[^.]+$/.exec(fqn);

    if (m == null) {
      throw new Error(`Could not determine parent FQN of: ${fqn}`);
    }

    return m[1];
  }

  private getParent(fqn: string): PythonType {
    return this.getPythonType(this.getParentFQN(fqn));
  }

  private addPythonType(type: PythonType) {
    if (type.fqn == null) {
      throw new Error('Cannot add a Python type without a FQN.');
    }

    this.getParent(type.fqn).addMember(type);
    this.types.set(type.fqn, type);
  }

  private getliftedProp(
    method: spec.Method | spec.Initializer,
  ): spec.InterfaceType | undefined {
    // If there are parameters to this method, and if the last parameter's type is
    // a datatype interface, then we want to lift the members of that last parameter
    // as keyword arguments to this function.
    if (method.parameters?.length ?? 0 >= 1) {
      const lastParameter = method.parameters!.slice(-1)[0];
      if (
        !lastParameter.variadic &&
        spec.isNamedTypeReference(lastParameter.type)
      ) {
        const lastParameterType = this.findType(lastParameter.type.fqn);
        if (
          spec.isInterfaceType(lastParameterType) &&
          lastParameterType.datatype
        ) {
          return lastParameterType;
        }
      }
    }

    return undefined;
  }

  private getAbstractBases(cls: spec.ClassType): spec.ClassType[] {
    const abstractBases: spec.ClassType[] = [];

    if (cls.base !== undefined) {
      const base = this.findType(cls.base);

      if (!spec.isClassType(base)) {
        throw new Error("Class inheritance that isn't a class?");
      }

      if (base.abstract) {
        abstractBases.push(base);
      }
    }

    return abstractBases;
  }
}

const toPythonMethodName = (name: string, protectedItem = false): string => {
  let value = toPythonIdentifier(codemaker.toSnakeCase(name));
  if (protectedItem) {
    value = `_${value}`;
  }
  return value;
};

/**
 * Render a one-line description of the given docs, used for method arguments and inlined properties
 */
function onelineDescription(docs: spec.Docs | undefined) {
  // Only consider a subset of fields here, we don't have a lot of formatting space
  if (!docs || Object.keys(docs).length === 0) {
    return '-';
  }

  const parts = [];
  if (docs.summary) {
    parts.push(md2rst(renderSummary(docs)));
  }
  if (docs.remarks) {
    parts.push(md2rst(docs.remarks));
  }
  if (docs.default) {
    parts.push(`Default: ${md2rst(docs.default)}`);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}

function shouldMentionStability(s: spec.Stability) {
  // Don't render "stable" or "external", those are both stable by implication.
  return s === spec.Stability.Deprecated || s === spec.Stability.Experimental;
}

/**
 * Obtains the Python package name for a given submodule FQN.
 *
 * @param fqn      the submodule FQN for which a package name is needed.
 * @param rootAssm the assembly this FQN belongs to.
 */
export function toPackageName(fqn: string, rootAssm: spec.Assembly): string {
  return getPackageName(fqn, rootAssm).packageName;
}
