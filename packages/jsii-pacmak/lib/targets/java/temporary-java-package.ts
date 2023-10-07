export interface TemporaryJavaPackage {
  /**
   * Where the sources are (relative to the source root)
   */
  relativeSourceDir: string;

  /**
   * Where the artifacts will be stored after build (relative to build dir)
   */
  relativeArtifactsDir: string;

  /**
   * Where the artifacts ought to go for this particular module
   */
  outputTargetDirectory: string;
}
