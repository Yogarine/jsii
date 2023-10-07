import * as spec from '@jsii/spec';
import * as xmlbuilder from 'xmlbuilder';

import { PackageInfo, Target, TargetOptions } from '../target';
import { shell } from '../util';
import { JavaGenerator } from './java/java-generator';
import { toReleaseVersion } from './version-utils';

import { TargetName } from './index';

export default class Java extends Target {
  public static toPackageInfos(assm: spec.Assembly): {
    [language: string]: PackageInfo;
  } {
    const groupId = assm.targets!.java!.maven.groupId;
    const artifactId = assm.targets!.java!.maven.artifactId;
    const releaseVersion = toReleaseVersion(assm.version, TargetName.JAVA);
    const url = `https://repo1.maven.org/maven2/${groupId.replace(
      /\./g,
      '/',
    )}/${artifactId}/${assm.version}/`;
    return {
      java: {
        repository: 'Maven Central',
        url,
        usage: {
          'Apache Maven': {
            language: 'xml',
            code: xmlbuilder
              .create({
                dependency: { groupId, artifactId, version: releaseVersion },
              })
              .end({ pretty: true })
              .replace(/<\?\s*xml(\s[^>]+)?>\s*/m, ''),
          },
          'Apache Buildr': `'${groupId}:${artifactId}:jar:${releaseVersion}'`,
          'Apache Ivy': {
            language: 'xml',
            code: xmlbuilder
              .create({
                dependency: {
                  '@groupId': groupId,
                  '@name': artifactId,
                  '@rev': releaseVersion,
                },
              })
              .end({ pretty: true })
              .replace(/<\?\s*xml(\s[^>]+)?>\s*/m, ''),
          },
          'Groovy Grape': `@Grapes(\n@Grab(group='${groupId}', module='${artifactId}', version='${releaseVersion}')\n)`,
          'Gradle / Grails': `compile '${groupId}:${artifactId}:${releaseVersion}'`,
        },
      },
    };
  }

  public static toNativeReference(type: spec.Type, options: any) {
    const [, ...name] = type.fqn.split('.');
    return { java: `import ${[options.package, ...name].join('.')};` };
  }

  protected readonly generator: JavaGenerator;

  public constructor(options: TargetOptions) {
    super(options);

    this.generator = new JavaGenerator(options);
  }

  public async build(sourceDir: string, outDir: string): Promise<void> {
    const url = `file://${outDir}`;
    const mvnArguments = new Array<string>();
    for (const arg of Object.keys(this.arguments)) {
      if (!arg.startsWith('mvn-')) {
        continue;
      }
      mvnArguments.push(`--${arg.slice(4)}`);
      mvnArguments.push(this.arguments[arg].toString());
    }

    await shell(
      'mvn',
      [
        // If we don't run in verbose mode, turn on quiet mode
        ...(this.arguments.verbose ? [] : ['--quiet']),
        '--batch-mode',
        ...mvnArguments,
        'deploy',
        `-D=altDeploymentRepository=local::default::${url}`,
        '--settings=user.xml',
      ],
      {
        cwd: sourceDir,
        env: {
          // Twiddle the JVM settings a little for Maven. Delaying JIT compilation
          // brings down Maven execution time by about 1/3rd (15->10s, 30->20s)
          MAVEN_OPTS: `${
            process.env.MAVEN_OPTS ?? ''
          } -XX:+TieredCompilation -XX:TieredStopAtLevel=1`,
        },
        retry: { maxAttempts: 5 },
      },
    );
  }
}
