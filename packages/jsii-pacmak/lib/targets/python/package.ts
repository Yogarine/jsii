import * as spec from '@jsii/spec';
import * as codemaker from 'codemaker';
import * as fs from 'fs-extra';
import * as path from 'path';

import { warn } from '../../logging';
import { VERSION } from '../../version';
import { pythonModuleNameToFilename, requirementsFile } from '../python';
import { toPythonVersionRange } from '../version-utils';
import { EmitContext } from './naming-context/emit-context';
import { PythonModule } from './type/python-module';

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
const spdxLicenseList = require('spdx-license-list');

export interface PackageData {
  filename: string;
  data: string | undefined;
}

export class Package {
  /**
   * The PythonModule that represents the root module of the package
   */
  public rootModule?: PythonModule;

  public readonly name: string;
  public readonly version: string;
  public readonly metadata: spec.Assembly;

  private readonly modules = new Map<string, PythonModule>();
  private readonly data = new Map<string, PackageData[]>();

  public constructor(name: string, version: string, metadata: spec.Assembly) {
    this.name = name;
    this.version = version;
    this.metadata = metadata;
  }

  public addModule(module: PythonModule) {
    this.modules.set(module.pythonName, module);

    // This is the module that represents the assembly
    if (module.fqn === this.metadata.name) {
      this.rootModule = module;
    }
  }

  public addData(
    module: PythonModule,
    filename: string,
    data: string | undefined,
  ) {
    if (!this.data.has(module.pythonName)) {
      this.data.set(module.pythonName, []);
    }

    this.data.get(module.pythonName)!.push({ filename, data });
  }

  public write(code: codemaker.CodeMaker, context: EmitContext) {
    const modules = [...this.modules.values()].sort((a, b) =>
      a.pythonName.localeCompare(b.pythonName),
    );

    const scripts = new Array<string>();

    // Iterate over all of our modules, and write them out to disk.
    for (const mod of modules) {
      const filename = path.join(
        'src',
        pythonModuleNameToFilename(mod.pythonName),
        '__init__.py',
      );

      code.openFile(filename);
      mod.emit(code, context);
      context.typeCheckingHelper.flushStubs(code);
      code.closeFile(filename);

      scripts.push(...mod.emitBinScripts(code));
    }

    // Handle our package data.
    const packageData: { [key: string]: string[] } = {};
    for (const [mod, pdata] of this.data) {
      for (const data of pdata) {
        if (data.data != null) {
          const filepath = path.join(
            'src',
            pythonModuleNameToFilename(mod),
            data.filename,
          );

          code.openFile(filepath);
          code.line(data.data);
          code.closeFile(filepath);
        }
      }

      packageData[mod] = pdata.map((pd) => pd.filename);
    }

    // Compute our list of dependencies
    const dependencies: string[] = [];
    for (const [depName, version] of Object.entries(
      this.metadata.dependencies ?? {},
    )) {
      const depInfo = this.metadata.dependencyClosure![depName];
      dependencies.push(
        `${depInfo.targets!.python!.distName}${toPythonVersionRange(version)}`,
      );
    }

    // Need to always write this file as the build process depends on it.
    // Make up some contents if we don't have anything useful to say.
    code.openFile('README.md');
    code.line(
      this.rootModule?.moduleDocumentation ??
        `${this.name}\n${'='.repeat(this.name.length)}`,
    );
    code.closeFile('README.md');

    const setupKwargs = {
      name: this.name,
      version: this.version,
      description: this.metadata.description,
      license: this.metadata.license,
      url: this.metadata.homepage,
      long_description_content_type: 'text/markdown',
      author:
        this.metadata.author.name +
        (this.metadata.author.email !== undefined
          ? `<${this.metadata.author.email}>`
          : ''),
      bdist_wheel: {
        universal: true,
      },
      project_urls: {
        Source: this.metadata.repository.url,
      },
      package_dir: { '': 'src' },
      packages: modules.map((m) => m.pythonName),
      package_data: packageData,
      python_requires: '~=3.7',
      install_requires: [
        `jsii${toPythonVersionRange(`^${VERSION}`)}`,
        'publication>=0.0.3',
        'typeguard~=2.13.3',
      ]
        .concat(dependencies)
        .sort(),
      classifiers: [
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: JavaScript',
        'Programming Language :: Python :: 3 :: Only',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Typing :: Typed',
      ],
      scripts,
    };

    // Packages w/ a deprecated message may have a non-deprecated stability (e.g: when EoL happens
    // for a stable package). We pretend it's deprecated for the purpose of trove classifiers when
    // this happens.
    switch (
      this.metadata.docs?.deprecated
        ? spec.Stability.Deprecated
        : this.metadata.docs?.stability
    ) {
      case spec.Stability.Experimental:
        setupKwargs.classifiers.push('Development Status :: 4 - Beta');
        break;
      case spec.Stability.Stable:
        setupKwargs.classifiers.push(
          'Development Status :: 5 - Production/Stable',
        );
        break;
      case spec.Stability.Deprecated:
        setupKwargs.classifiers.push('Development Status :: 7 - Inactive');
        break;
      default:
      // No 'Development Status' trove classifier for you!
    }

    if (spdxLicenseList[this.metadata.license]?.osiApproved) {
      setupKwargs.classifiers.push('License :: OSI Approved');
    }

    const additionalClassifiers = this.metadata.targets?.python?.classifiers;
    if (additionalClassifiers != null) {
      if (!Array.isArray(additionalClassifiers)) {
        throw new Error(
          `The "jsii.targets.python.classifiers" value must be an array of strings if provided, but found ${JSON.stringify(
            additionalClassifiers,
            null,
            2,
          )}`,
        );
      }
      // We discourage using those since we automatically set a value for them
      for (let classifier of additionalClassifiers.sort()) {
        if (typeof classifier !== 'string') {
          throw new Error(
            `The "jsii.targets.python.classifiers" value can only contain strings, but found ${JSON.stringify(
              classifier,
              null,
              2,
            )}`,
          );
        }
        // We'll split on `::` and re-join later so classifiers are "normalized" to a standard spacing
        const parts = classifier.split('::').map((part) => part.trim());
        const reservedClassifiers = [
          'Development Status',
          'License',
          'Operating System',
          'Typing',
        ];
        if (reservedClassifiers.includes(parts[0])) {
          warn(
            `Classifiers starting with ${reservedClassifiers
              .map((x) => `"${x} ::"`)
              .join(
                ', ',
              )} are automatically set and should not be manually configured`,
          );
        }
        classifier = parts.join(' :: ');
        if (setupKwargs.classifiers.includes(classifier)) {
          continue;
        }
        setupKwargs.classifiers.push(classifier);
      }
    }

    // We Need a setup.py to make this Package, actually a Package.
    code.openFile('setup.py');
    code.line('import json');
    code.line('import setuptools');
    code.line();
    code.line('kwargs = json.loads(');
    code.line('    """');
    code.line(JSON.stringify(setupKwargs, null, 4));
    code.line('"""');
    code.line(')');
    code.line();
    code.openBlock('with open("README.md", encoding="utf8") as fp');
    code.line('kwargs["long_description"] = fp.read()');
    code.closeBlock();
    code.line();
    code.line();
    code.line('setuptools.setup(**kwargs)');
    code.closeFile('setup.py');

    // Because we're good citizens, we're going to go ahead and support pyproject.toml
    // as well.
    // TODO: Might be easier to just use a TOML library to write this out.
    code.openFile('pyproject.toml');
    code.line('[build-system]');
    const buildTools = fs
      .readFileSync(requirementsFile, { encoding: 'utf-8' })
      .split('\n')
      .map((line) => /^\s*(.+)\s*#\s*build-system\s*$/.exec(line)?.[1]?.trim())
      .reduce(
        (buildTools, entry) => (entry ? [...buildTools, entry] : buildTools),
        new Array<string>(),
      );
    code.line(`requires = [${buildTools.map((x) => `"${x}"`).join(', ')}]`);
    code.line('build-backend = "setuptools.build_meta"');
    code.line();
    code.line('[tool.pyright]');
    code.line('defineConstant = { DEBUG = true }');
    code.line('pythonVersion = "3.7"');
    code.line('pythonPlatform = "All"');
    code.line('reportSelfClsParameterName = false');
    code.closeFile('pyproject.toml');

    // We also need to write out a MANIFEST.in to ensure that all of our required
    // files are included.
    code.openFile('MANIFEST.in');
    code.line('include pyproject.toml');
    code.closeFile('MANIFEST.in');
  }
}
