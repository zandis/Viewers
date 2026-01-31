// Core services
export { default as VLMService } from './VLMService';
export { default as ReportWorkflowService, LocalStorageBackend } from './ReportWorkflowService';
export { default as ReportSubmissionService } from './ReportSubmissionService';
export { default as AIAnalysisService } from './AIAnalysisService';

// Type exports
export type { ReportStorageBackend } from './ReportWorkflowService';
export type { ImageForAnalysis, AIFindingsDisplaySet } from './AIAnalysisService';

// Re-export performance layer
export * from '../performance';

// Re-export AI features
export * from '../features';

// Re-export analytics
export { AnalyticsService, default as AnalyticsServiceDefault } from '../analytics';
export type {
  TimeSeriesDataPoint,
  CategoryDataPoint,
  PerformanceMetric,
  RadiologistMetrics,
  AIModelMetrics,
  WorkloadMetrics,
  ModalityDistribution,
} from '../analytics';

// Re-export workers
export { WorkerPool, getWorkerPool, shutdownWorkerPool } from '../workers';
export type { WorkerMessage, WorkerResponse, WorkerMessageType } from '../workers';
