/**
 * Core Module Exports
 * Production-grade clinical workflow, imaging algorithms, and AI integration
 */

// ============================================================================
// CLINICAL WORKFLOW (40 Functions)
// ============================================================================

export {
  // Types
  type Patient,
  type ClinicalHistoryEntry,
  type InsuranceInfo,
  type Order,
  type OrderStatus,
  type Radiologist,
  type RadiologistPreferences,
  type TimeSlot,
  type StudyAssignment,
  type ClinicalAlert,
  type ProtocolRule,
  type ProtocolCondition,
  type ProtocolAction,

  // Patient Management (1-10)
  validatePatientDemographics,
  calculatePatientAge,
  checkContrastContraindications,
  mergePatientRecords,
  generatePatientSummary,
  calculateBMI,
  estimateGFR,
  parseClinicalIndication,
  validateInsuranceAuthorization,
  generateAccessionNumber,

  // Order Management (11-20)
  calculateOrderPriority,
  validateOrderCompleteness,
  findDuplicateOrders,
  findOptimalSchedulingSlot,
  estimateExamDuration,
  generateOrderTimeline,
  calculateTurnaroundTime,
  validateCodeCombination,
  generatePrepInstructions,
  checkProtocolConflicts,

  // Radiologist Assignment (21-30)
  calculateWorkloadScore,
  matchRadiologistToStudy,
  balanceWorkload,
  checkRadiologistAvailability,
  calculateProductivityMetrics,
  getRadiologistSchedule,
  calculateAssignmentFairness,
  reassignStudy,
  getPendingAssignments,
  estimateQueueWaitTime,

  // Alerts (31-40)
  createClinicalAlert,
  prioritizeAlerts,
  checkAlertEscalation,
  formatAlertNotification,
  batchAlertsByPatient,
  acknowledgeAlert,
  filterActiveAlerts,
  getAlertStatistics,
  createAlertSummary,
  archiveOldAlerts,
} from './clinical-workflow';

// ============================================================================
// IMAGE ALGORITHMS (30 Functions)
// ============================================================================

export {
  // Types
  type ImageMetadata,
  type ROI,
  type HistogramData,
  type TextureFeatures,
  type EdgeDetectionResult,
  type SegmentationMask,

  // Histogram and Intensity (41-50)
  calculateHistogram,
  equalizeHistogram,
  applyCLAHE,
  calculateAutoWindowLevel,
  applyWindowLevel,
  normalizeIntensity,
  convertHUToDensity,
  otsuThreshold,
  calculatePercentiles,
  stretchContrast,

  // Filtering (51-60)
  gaussianBlur,
  medianFilter,
  bilateralFilter,
  unsharpMask,
  anisotropicDiffusion,
  laplacianOfGaussian,
  morphologicalOpen,
  morphologicalClose,
  morphologicalErode,
  morphologicalDilate,

  // Edge Detection and Segmentation (61-70)
  cannyEdgeDetection,
  labelConnectedComponents,
  regionGrowing,
  watershedSegmentation,
  calculateROIStatistics,
  calculateTextureFeatures,
  findContours,
  fillHoles,
  removeSmallObjects,
} from './image-algorithms';

// ============================================================================
// AI INTEGRATION (30 Functions)
// ============================================================================

export {
  // Types
  type AIModel,
  type AITask,
  type ModelInputFormat,
  type ModelOutputFormat,
  type ModelPerformance,
  type AIInferenceRequest,
  type AIInferenceResult,
  type AIFinding,
  type AIMeasurement,
  type AISegmentationMask,
  type BoundingBox,
  type Point3D,
  type AIWorkflowConfig,
  type ModelEnsembleConfig,

  // Model Management (71-80)
  selectModelsForStudy,
  validateModelInput,
  calibrateModelConfidence,
  aggregateEnsemblePredictions,
  detectPerformanceDrift,
  getModelRecommendations,
  createModelRegistry,
  calculateModelCost,
  validateModelOutput,
  formatModelPerformanceReport,

  // Inference Orchestration (81-90)
  createInferenceQueue,
  batchStudiesForInference,
  executeWithRetry,
  prioritizeFindings,
  generateAlertsFromFindings,
  calculateInferencePriority,
  mergeInferenceResults,
  filterFindingsByConfidence,
  groupFindingsByType,
  formatFindingsForReport,

  // Quality Assurance (91-100)
  calculateSystemHealth,
  createAuditTrail,
  compareAIToHumanFindings,
  calculatePositivePredictiveValue,
  calculateNegativePredictiveValue,
  trackModelUsageMetrics,
  generateQualityReport,
  flagForQAReview,
  aggregateQAMetrics,
} from './ai-integration';

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

export {
  TypedArrayPool,
  WorkerPool,
  debounce,
  throttle,
  VirtualListManager,
  RequestDeduplicator,
  LazyLoader,
  RenderScheduler,
  PerformanceMonitor,
} from './performance';

// ============================================================================
// CONVENIENCE INITIALIZER
// ============================================================================

/**
 * Initialize all core services with optimized defaults
 */
export function initializeCoreServices(config?: {
  workerScript?: string;
  maxWorkers?: number;
  cacheSize?: number;
}): {
  workerPool: InstanceType<typeof import('./performance').WorkerPool> | null;
  performanceMonitor: ReturnType<typeof import('./performance').PerformanceMonitor.getInstance>;
  renderScheduler: ReturnType<typeof import('./performance').RenderScheduler.getInstance>;
} {
  const { WorkerPool, PerformanceMonitor, RenderScheduler } = require('./performance');

  let workerPool = null;
  if (config?.workerScript) {
    workerPool = new WorkerPool(config.workerScript, config.maxWorkers || 4);
  }

  const performanceMonitor = PerformanceMonitor.getInstance();
  const renderScheduler = RenderScheduler.getInstance();

  // Start performance monitoring
  performanceMonitor.start();

  return { workerPool, performanceMonitor, renderScheduler };
}

// ============================================================================
// VERSION INFO
// ============================================================================

export const CORE_VERSION = '2.0.0';
export const FUNCTION_COUNT = 100;
export const MODULES = [
  'clinical-workflow',
  'image-algorithms',
  'ai-integration',
  'performance',
] as const;

export default {
  CORE_VERSION,
  FUNCTION_COUNT,
  MODULES,
  initializeCoreServices,
};
