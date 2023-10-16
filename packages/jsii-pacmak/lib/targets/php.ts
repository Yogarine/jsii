import { IGenerator } from '../generator';
import { Target, TargetOptions } from '../target';
import { PhpGenerator } from './php/php-generator';

export default class Php extends Target {
  protected readonly generator: IGenerator;

  public constructor(options: TargetOptions) {
    super(options);

    this.generator = new PhpGenerator(options);
  }

  /**
   * Builds the generated code.
   *
   * @param sourceDir the directory where the generated source was put.
   * @param outDir    the directory where the build artifacts will be placed.
   */
  public async build(sourceDir: string, outDir: string): Promise<void> {
    return Promise.resolve(undefined);
  }
}
