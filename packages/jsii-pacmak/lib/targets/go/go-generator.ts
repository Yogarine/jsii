import * as codemaker from 'codemaker';
import * as fs from 'fs-extra';
import * as reflect from 'jsii-reflect';
import * as rosetta from 'jsii-rosetta';
import * as path from 'path';

import { IGenerator, Legalese } from '../../generator';
import { Documentation } from './documentation';
import { RootPackage } from './package';
import { JSII_INIT_PACKAGE } from './runtime';
import { tarballName } from './util';

export class GoGenerator implements IGenerator {
  private assembly!: reflect.Assembly;
  public rootPackage!: RootPackage;

  private readonly code = new codemaker.CodeMaker({
    indentCharacter: '\t',
    indentationLevel: 1,
  });
  private readonly documenter: Documentation;

  private readonly rosetta: rosetta.Rosetta;
  private readonly runtimeTypeChecking: boolean;

  public constructor(options: {
    readonly rosetta: rosetta.Rosetta;
    readonly runtimeTypeChecking: boolean;
  }) {
    this.rosetta = options.rosetta;
    this.documenter = new Documentation(this.code, this.rosetta);
    this.runtimeTypeChecking = options.runtimeTypeChecking;
  }

  public async load(_: string, assembly: reflect.Assembly): Promise<void> {
    this.assembly = assembly;
    return Promise.resolve();
  }

  public async upToDate(_outDir: string) {
    return Promise.resolve(false);
  }

  public generate(): void {
    this.rootPackage = new RootPackage(this.assembly);

    return this.rootPackage.emit({
      code: this.code,
      documenter: this.documenter,
      runtimeTypeChecking: this.runtimeTypeChecking,
    });
  }

  public async save(
    outDir: string,
    tarball: string,
    { license, notice }: Legalese,
  ): Promise<any> {
    const output = path.join(outDir, this.rootPackage.packageName);
    await this.code.save(output);
    await fs.copyFile(
      tarball,
      path.join(output, JSII_INIT_PACKAGE, tarballName(this.assembly)),
    );

    if (license) {
      await fs.writeFile(path.join(output, 'LICENSE'), license, {
        encoding: 'utf8',
      });
    }

    if (notice) {
      await fs.writeFile(path.join(output, 'NOTICE'), notice, {
        encoding: 'utf8',
      });
    }
  }
}
