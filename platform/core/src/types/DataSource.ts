/**
 * Configuration options for a data source
 */
export interface DataSourceConfiguration {
  /** Base URL for the data source */
  wadoUriRoot?: string;
  /** URL for QIDO-RS queries */
  qidoRoot?: string;
  /** URL for WADO-RS retrieval */
  wadoRoot?: string;
  /** URL for STOW-RS storage */
  stowRoot?: string;
  /** Whether to use shared array buffer */
  enableStudyLazyLoad?: boolean;
  /** Whether to support fuzzy matching */
  supportsFuzzyMatching?: boolean;
  /** Whether the data source requires authentication */
  supportsWildcard?: boolean;
  /** Static WADO root URL */
  staticWadoRoot?: string;
  /** Additional configuration options */
  [key: string]: unknown;
}

export type DataSourceDefinition = {
  /** Display name for the data source */
  friendlyName: string;
  /** Namespace/type of the data source (e.g., '@ohif/extension-default.dataSourcesModule.dicomweb') */
  namespace: string;
  /** Unique identifier for this data source instance */
  sourceName: string;
  /** Configuration options for the data source */
  configuration: DataSourceConfiguration;
};
