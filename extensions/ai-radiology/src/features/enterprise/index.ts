/**
 * Enterprise Features - Unified Exports
 * Production-grade medical imaging AI platform
 */

// ============================================================================
// PART 1: Core Enterprise Features (1-5)
// ============================================================================

export {
  // Feature 1: Multi-language Internationalization
  InternationalizationService,
  type SupportedLocale,
  type TranslationNamespace,
  type I18nConfig,

  // Feature 2: Advanced NLP Search
  NLPSearchEngine,
  type SearchQuery,
  type ParsedQuery,
  type SearchFilter,
  type SearchSort,
  type SearchResult,
  type SearchFacet,

  // Feature 3: Custom Report Templates
  ReportTemplateEngine,
  type ReportTemplate,
  type TemplateSection,
  type TemplateVariable,
  type TemplateMacro,
  type TemplateStyles,

  // Feature 4: Real-time Collaboration
  CollaborationService,
  type CollaborationUser,
  type CollaborationSession,
  type CollaborationPermissions,
  type ChatMessage,
  type SharedAnnotation,
  type SharedViewState,
  type CollaborationEventType,

  // Feature 5: AI Model Marketplace
  AIModelMarketplace,
  type AIMarketplaceModel,
  type AIModelCategory,
  type AIModelPerformance,
  type AIModelPricing,
  type InstalledModel,
  type AIModelReview,
} from './part1';

// ============================================================================
// PART 2: Workflow & Integration Features (6-10)
// ============================================================================

export {
  // Feature 6: Automated QA Workflows
  QAWorkflowEngine,
  type QAWorkflow,
  type QATrigger,
  type QAStep,
  type QAExecution,
  type QAStepResult,
  type EscalationRule,

  // Feature 7: Smart Scheduling
  SmartSchedulingSystem,
  type ScheduledExam,
  type SchedulingResource,
  type AvailabilitySlot,
  type OptimizationResult,
  type SchedulingSuggestion,

  // Feature 8: 3D Print Preparation
  Print3DPreparationService,
  type Print3DModel,
  type MeshStatistics,
  type SegmentationData,
  type PrintSettings,

  // Feature 9: Patient Portal Integration
  PatientPortalIntegration,
  type PatientPortalConfig,
  type PatientAccess,
  type PatientPreferences,
  type StudyShareLink,
  type PatientMessage,

  // Feature 10: Research Data Export
  ResearchDataExportPipeline,
  type ResearchExportJob,
  type ExportConfig,
  type StudySelectionCriteria,
  type DeidentificationConfig,
  type OutputFormatConfig,
  type ExportStatistics,
} from './part2';

// ============================================================================
// PART 3: Clinical & Analysis Features (11-20)
// ============================================================================

export {
  // Feature 11: Clinical Trial Matching
  ClinicalTrialMatcher,
  type ClinicalTrial,
  type EligibilityCriteria,
  type TrialMatch,

  // Feature 12: Outcome Tracking
  OutcomeTrackingSystem,
  type PatientOutcome,
  type OutcomeMetrics,
  type AggregatedOutcomes,

  // Feature 13: Peer Review
  PeerReviewSystem,
  type PeerReviewCase,
  type ReviewFindings,

  // Feature 14: Teaching Mode
  TeachingModeService,
  type TeachingCase,
  type TeachingPoint,
  type TeachingAnnotation,
  type TeachingQuiz,

  // Feature 15: Emergency Alerts
  EmergencyAlertSystem,
  type EmergencyAlert,
  type AlertNotification,
  type EscalationPolicy,

  // Feature 16: EHR Integration
  EHRIntegrationService,
  type EHRConfig,
  type PatientContext,
  type FieldMapping,

  // Feature 17: Voice Dictation
  VoiceDictationEngine,
  type DictationSession,
  type TranscriptSegment,
  type VoiceCommand,

  // Feature 18: Advanced Annotations
  AdvancedAnnotationTools,
  type Annotation,
  type AnnotationType,
  type AnnotationData,
  type AnnotationStyle,

  // Feature 19: Measurement Engine
  MeasurementEngine,
  type Measurement,
  type MeasurementType,
  type CalibrationData,
  type MeasurementStatistics,

  // Feature 20: Comparison Engine
  ComparisonEngine,
  type ComparisonSession,
  type ComparisonLayout,
  type ComparisonFinding,
  type ChangeDetectionResult,
  type SyncSettings,
} from './part3';

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

/**
 * Initialize all enterprise services
 */
export function initializeEnterpriseFeatures(config?: {
  locale?: string;
  ehrConfig?: import('./part2').PatientPortalConfig;
}): {
  i18n: InstanceType<typeof InternationalizationService>;
  search: InstanceType<typeof NLPSearchEngine>;
  templates: InstanceType<typeof ReportTemplateEngine>;
  collaboration: InstanceType<typeof CollaborationService>;
  marketplace: InstanceType<typeof AIModelMarketplace>;
  qa: InstanceType<typeof QAWorkflowEngine>;
  scheduling: InstanceType<typeof SmartSchedulingSystem>;
  print3d: InstanceType<typeof Print3DPreparationService>;
  research: InstanceType<typeof ResearchDataExportPipeline>;
  trials: InstanceType<typeof ClinicalTrialMatcher>;
  outcomes: InstanceType<typeof OutcomeTrackingSystem>;
  peerReview: InstanceType<typeof PeerReviewSystem>;
  teaching: InstanceType<typeof TeachingModeService>;
  alerts: InstanceType<typeof EmergencyAlertSystem>;
  ehr: InstanceType<typeof EHRIntegrationService>;
  dictation: InstanceType<typeof VoiceDictationEngine>;
  annotations: InstanceType<typeof AdvancedAnnotationTools>;
  measurements: InstanceType<typeof MeasurementEngine>;
  comparison: InstanceType<typeof ComparisonEngine>;
} {
  const i18n = InternationalizationService.getInstance();
  if (config?.locale) {
    i18n.setLocale(config.locale as import('./part1').SupportedLocale);
  }

  return {
    i18n,
    search: NLPSearchEngine.getInstance(),
    templates: ReportTemplateEngine.getInstance(),
    collaboration: CollaborationService.getInstance(),
    marketplace: AIModelMarketplace.getInstance(),
    qa: QAWorkflowEngine.getInstance(),
    scheduling: SmartSchedulingSystem.getInstance(),
    print3d: Print3DPreparationService.getInstance(),
    research: ResearchDataExportPipeline.getInstance(),
    trials: ClinicalTrialMatcher.getInstance(),
    outcomes: OutcomeTrackingSystem.getInstance(),
    peerReview: PeerReviewSystem.getInstance(),
    teaching: TeachingModeService.getInstance(),
    alerts: EmergencyAlertSystem.getInstance(),
    ehr: EHRIntegrationService.getInstance(),
    dictation: VoiceDictationEngine.getInstance(),
    annotations: AdvancedAnnotationTools.getInstance(),
    measurements: MeasurementEngine.getInstance(),
    comparison: ComparisonEngine.getInstance(),
  };
}

// ============================================================================
// VERSION INFO
// ============================================================================

export const ENTERPRISE_VERSION = '2.0.0';
export const FEATURE_COUNT = 20;

export default {
  initializeEnterpriseFeatures,
  ENTERPRISE_VERSION,
  FEATURE_COUNT,
};
