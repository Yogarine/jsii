import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as rosetta from 'jsii-rosetta';

import { PropertyDefinition } from '../_utils';
import {
  emitParameterTypeChecks,
  openSignature,
  slugifyAsNeeded,
  TARGET_LINE_LENGTH,
  toPythonParameterName,
  totalSizeOf,
} from '../python';
import { DocumentableArgument } from './documentable-argument';
import { EmitContext } from './naming-context/emit-context';
import { PythonBase } from './python-base';
import { PythonGenerator } from './python-generator';
import { PythonImports } from './python-imports';
import { PythonType } from './python-type';
import { StructField } from './struct-field';
import { mergePythonImports, toTypeName } from './type-name';
import { TypeResolver } from './type-resolver';

export interface BaseMethodOpts {
  abstract?: boolean;
  liftedProp?: spec.InterfaceType;
  parent: spec.NamedTypeReference;
}

export interface BaseMethodEmitOpts {
  renderAbstract?: boolean;
  forceEmitBody?: boolean;
}

export abstract class BaseMethod implements PythonBase {
  public readonly abstract: boolean;

  protected abstract readonly implicitParameter: string;
  protected readonly jsiiMethod!: string;
  protected readonly decorator?: string;
  protected readonly classAsFirstParameter: boolean = false;
  protected readonly returnFromJSIIMethod: boolean = true;
  protected readonly shouldEmitBody: boolean = true;

  private readonly liftedProp?: spec.InterfaceType;
  private readonly parent: spec.NamedTypeReference;

  public constructor(
    protected readonly generator: PythonGenerator,
    public readonly pythonName: string,
    private readonly jsName: string | undefined,
    private readonly parameters: spec.Parameter[],
    private readonly returns: spec.OptionalValue | undefined,
    public readonly docs: spec.Docs | undefined,
    public readonly isStatic: boolean,
    private readonly pythonParent: PythonType,
    opts: BaseMethodOpts,
  ) {
    this.abstract = !!opts.abstract;
    this.liftedProp = opts.liftedProp;
    this.parent = opts.parent;
  }

  public get apiLocation(): rosetta.ApiLocation {
    return {
      api: 'member',
      fqn: this.parent.fqn,
      memberName: this.jsName ?? '',
    };
  }

  public requiredImports(context: EmitContext): PythonImports {
    return mergePythonImports(
      toTypeName(this.returns).requiredImports(context),
      ...this.parameters.map((param) =>
        toTypeName(param).requiredImports(context),
      ),
      ...liftedProperties(this.liftedProp),
    );

    function* liftedProperties(
      struct: spec.InterfaceType | undefined,
    ): IterableIterator<PythonImports> {
      if (struct == null) {
        return;
      }
      for (const prop of struct.properties ?? []) {
        yield toTypeName(prop.type).requiredImports(context);
      }
      for (const base of struct.interfaces ?? []) {
        const iface = context.resolver.dereference(base) as spec.InterfaceType;
        for (const imports of liftedProperties(iface)) {
          yield imports;
        }
      }
    }
  }

  public emit(
    code: codemaker.CodeMaker,
    context: EmitContext,
    opts?: BaseMethodEmitOpts,
  ) {
    const { renderAbstract = true, forceEmitBody = false } = opts ?? {};

    const returnType: string = toTypeName(this.returns).pythonType(context);

    // We cannot (currently?) blindly use the names given to us by the JSII for
    // initializers, because our keyword lifting will allow two names to clash.
    // This can hopefully be removed once we get https://github.com/aws/jsii/issues/288
    // resolved, so build up a list of all the prop names, so we can check against
    // them later.
    const liftedPropNames = new Set<string>();
    if (this.liftedProp?.properties != null) {
      for (const prop of this.liftedProp.properties) {
        liftedPropNames.add(toPythonParameterName(prop.name));
      }
    }

    // We need to turn a list of JSII parameters, into Python style arguments with
    // gradual typing, so we'll have to iterate over the list of parameters, and
    // build the list, converting as we go.
    const pythonParams: string[] = [];
    for (const param of this.parameters) {
      // We cannot (currently?) blindly use the names given to us by the JSII for
      // initializers, because our keyword lifting will allow two names to clash.
      // This can hopefully be removed once we get https://github.com/aws/jsii/issues/288
      // resolved.
      const paramName: string = toPythonParameterName(
        param.name,
        liftedPropNames,
      );

      const paramType = toTypeName(param).pythonType({
        ...context,
        parameterType: true,
      });
      const paramDefault = param.optional ? ' = None' : '';

      pythonParams.push(`${paramName}: ${paramType}${paramDefault}`);
    }

    const documentableArgs: DocumentableArgument[] = this.parameters
      .map(
        (p) =>
          ({
            name: p.name,
            docs: p.docs,
            definingType: this.parent,
          }) as DocumentableArgument,
      )
      // If there's liftedProps, the last argument is the struct, and it won't be _actually_ emitted.
      .filter((_, index) =>
        this.liftedProp != null ? index < this.parameters.length - 1 : true,
      )
      .map((param) => ({
        ...param,
        name: toPythonParameterName(param.name, liftedPropNames),
      }));

    // If we have a lifted parameter, then we'll drop the last argument to our params,
    // and then we'll lift all the params of the lifted type as keyword arguments
    // to the function.
    if (this.liftedProp !== undefined) {
      // Remove our last item.
      pythonParams.pop();
      const liftedProperties = this.getLiftedProperties(context.resolver);

      if (liftedProperties.length >= 1) {
        // All of these parameters are keyword only arguments, so we'll mark them
        // as such.
        pythonParams.push('*');

        // Iterate over all of our props, and reflect them into our params.
        for (const prop of liftedProperties) {
          const paramName = toPythonParameterName(prop.prop.name);
          const paramType = toTypeName(prop.prop).pythonType({
            ...context,
            parameterType: true,
            typeAnnotation: true,
          });
          const paramDefault = prop.prop.optional ? ' = None' : '';

          pythonParams.push(`${paramName}: ${paramType}${paramDefault}`);
        }
      }

      // Document them as keyword arguments
      documentableArgs.push(
        ...liftedProperties.map(
          (p) =>
            ({
              name: p.prop.name,
              docs: p.prop.docs,
              definingType: p.definingType,
            }) as DocumentableArgument,
        ),
      );
    } else if (
      this.parameters.length >= 1 &&
      this.parameters[this.parameters.length - 1].variadic
    ) {
      // Another situation we could be in, is that instead of having a plain parameter
      // we have a variadic parameter where we need to expand the last parameter as a
      // *args.
      pythonParams.pop();

      const lastParameter = this.parameters.slice(-1)[0];
      const paramName = toPythonParameterName(lastParameter.name);
      const paramType = toTypeName(lastParameter.type).pythonType(context);

      pythonParams.push(`*${paramName}: ${paramType}`);
    }

    const decorators = new Array<string>();

    if (this.jsName !== undefined) {
      decorators.push(`@jsii.member(jsii_name="${this.jsName}")`);
    }

    if (this.decorator !== undefined) {
      decorators.push(`@${this.decorator}`);
    }

    if (renderAbstract && this.abstract) {
      decorators.push('@abc.abstractmethod');
    }

    if (decorators.length > 0) {
      for (const decorator of decorators) {
        code.line(decorator);
      }
    }

    pythonParams.unshift(
      slugifyAsNeeded(
        this.implicitParameter,
        pythonParams.map((param) => param.split(':')[0].trim()),
      ),
    );

    openSignature(code, 'def', this.pythonName, pythonParams, returnType);
    this.generator.emitDocString(code, this.apiLocation, this.docs, {
      arguments: documentableArgs,
      documentableItem: `method-${this.pythonName}`,
    });
    if (
      (this.shouldEmitBody || forceEmitBody) &&
      (!renderAbstract || !this.abstract)
    ) {
      emitParameterTypeChecks(
        code,
        context,
        pythonParams.slice(1),
        `${this.pythonParent.fqn ?? this.pythonParent.pythonName}#${
          this.pythonName
        }`,
      );
    }
    this.emitBody(
      code,
      context,
      renderAbstract,
      forceEmitBody,
      liftedPropNames,
      pythonParams[0],
      returnType,
    );
    code.closeBlock();
  }

  private emitBody(
    code: codemaker.CodeMaker,
    context: EmitContext,
    renderAbstract: boolean,
    forceEmitBody: boolean,
    liftedPropNames: Set<string>,
    implicitParameter: string,
    returnType: string,
  ) {
    if (
      (!this.shouldEmitBody && !forceEmitBody) ||
      (renderAbstract && this.abstract)
    ) {
      code.line('...');
    } else {
      if (this.liftedProp !== undefined) {
        this.emitAutoProps(code, context, liftedPropNames);
      }

      this.emitJsiiMethodCall(
        code,
        context,
        liftedPropNames,
        implicitParameter,
        returnType,
      );
    }
  }

  private emitAutoProps(
    code: codemaker.CodeMaker,
    context: EmitContext,
    liftedPropNames: Set<string>,
  ) {
    const lastParameter = this.parameters.slice(-1)[0];
    const argName = toPythonParameterName(lastParameter.name, liftedPropNames);
    const typeName = toTypeName(lastParameter.type).pythonType({
      ...context,
      typeAnnotation: false,
    });

    // We need to build up a list of properties, which are mandatory, these are the
    // ones we will specify to start with in our dictionary literal.
    const liftedProps = this.getLiftedProperties(context.resolver).map(
      (p) => new StructField(this.generator, p.prop, p.definingType),
    );
    const assignments = liftedProps
      .map((p) => p.pythonName)
      .map((v) => `${v}=${v}`);

    assignCallResult(code, argName, typeName, assignments);
    code.line();
  }

  private emitJsiiMethodCall(
    code: codemaker.CodeMaker,
    context: EmitContext,
    liftedPropNames: Set<string>,
    implicitParameter: string,
    returnType: string,
  ) {
    const methodPrefix: string = this.returnFromJSIIMethod ? 'return ' : '';

    const jsiiMethodParams: string[] = [];
    if (this.classAsFirstParameter) {
      if (this.parent === undefined) {
        throw new Error('Parent not known.');
      }
      if (this.isStatic) {
        jsiiMethodParams.push(
          toTypeName(this.parent).pythonType({
            ...context,
            typeAnnotation: false,
          }),
        );
      } else {
        // Using the dynamic class of `self`.
        jsiiMethodParams.push(`${implicitParameter}.__class__`);
      }
    }
    jsiiMethodParams.push(implicitParameter);
    if (this.jsName !== undefined) {
      jsiiMethodParams.push(`"${this.jsName}"`);
    }

    // If the last arg is variadic, expand the tuple
    const params: string[] = [];
    for (const param of this.parameters) {
      let expr = toPythonParameterName(param.name, liftedPropNames);
      if (param.variadic) {
        expr = `*${expr}`;
      }
      params.push(expr);
    }

    const value = `jsii.${this.jsiiMethod}(${jsiiMethodParams.join(
      ', ',
    )}, [${params.join(', ')}])`;
    code.line(
      `${methodPrefix}${
        this.returnFromJSIIMethod && returnType
          ? `typing.cast(${returnType}, ${value})`
          : value
      }`,
    );
  }

  private getLiftedProperties(resolver: TypeResolver): PropertyDefinition[] {
    const liftedProperties: PropertyDefinition[] = [];

    const stack = [this.liftedProp];
    const knownIfaces = new Set<string>();
    const knownProps = new Set<string>();
    for (
      let current = stack.shift();
      current != null;
      current = stack.shift()
    ) {
      knownIfaces.add(current.fqn);

      // Add any interfaces that this interface depends on, to the list.
      if (current.interfaces !== undefined) {
        for (const iface of current.interfaces) {
          if (knownIfaces.has(iface)) {
            continue;
          }
          stack.push(resolver.dereference(iface) as spec.InterfaceType);
          knownIfaces.add(iface);
        }
      }

      // Add all the properties of this interface to our list of properties.
      if (current.properties !== undefined) {
        for (const prop of current.properties) {
          if (knownProps.has(prop.name)) {
            continue;
          }
          liftedProperties.push({ prop, definingType: current });
          knownProps.add(prop.name);
        }
      }
    }

    return liftedProperties;
  }
}

function assignCallResult(
  code: codemaker.CodeMaker,
  variable: string,
  funct: string,
  params: readonly string[],
) {
  const prefix = `${variable} = ${funct}(`;
  const suffix = ')';

  if (params.length === 0) {
    code.line(`${prefix}${suffix}`);
    return;
  }

  const join = ', ';
  const { elementsSize, joinSize } = totalSizeOf(params, join);

  if (
    TARGET_LINE_LENGTH >
    code.currentIndentLength +
      prefix.length +
      elementsSize +
      joinSize +
      suffix.length
  ) {
    code.line(`${prefix}${params.join(join)}${suffix}`);
    return;
  }

  code.indent(prefix);
  if (TARGET_LINE_LENGTH > code.currentIndentLength + elementsSize + joinSize) {
    code.line(params.join(join));
  } else {
    for (const param of params) {
      code.line(`${param},`);
    }
  }
  code.unindent(suffix);
}
