import { Types } from '@ohif/core';
import {
  VLMService,
  ReportWorkflowService,
  ReportSubmissionService,
  AIAnalysisService,
  LocalStorageBackend,
  // Performance layer
  RequestPool,
  LRUCache,
  IndexedDBStorage,
  PaginationManager,
  MemoryMonitor,
  StreamingDataProcessor,
  // AI Features
  StudyTriageService,
  CriticalFindingService,
  SmartWorklistService,
  LungNoduleService,
  CACScoreService,
  StrokeDetectionService,
  MammographyService,
  FractureDetectionService,
  OrganVolumeService,
  TumorResponseService,
  ImageQualityService,
  AuditTrailService,
  // Analytics
  AnalyticsService,
} from './services';
import commandsModule from './commands/commandsModule';
import toolbarModule, { getToolbarButtons } from './toolbar/toolbarModule';
import AIReportPanel from './panels/AIReportPanel';
import { AIRadiologyDashboard } from './dashboard';
import getHangingProtocolModule from './hanging-protocols';
import { getWorkerPool, shutdownWorkerPool } from './workers';

// Export types for external use
export * from './types';
export * from './services';
export { AIRadiologyDashboard } from './dashboard';

/**
 * AI Radiology Extension
 * Provides AI-powered radiology workflow with VLM report generation
 */
const extension: Types.Extensions.Extension = {
  id: '@ohif/extension-ai-radiology',

  /**
   * Pre-registration hook - register services before other modules
   */
  async preRegistration({
    servicesManager,
    commandsManager,
    extensionManager,
    appConfig,
  }: Types.Extensions.ExtensionParams): Promise<void> {
    const aiConfig = appConfig.aiRadiology || {};

    // Initialize worker pool for parallel DICOM processing
    const workerPool = getWorkerPool({
      minWorkers: aiConfig.minWorkers || 2,
      maxWorkers: aiConfig.maxWorkers || navigator.hardwareConcurrency || 4,
      taskTimeout: aiConfig.workerTimeout || 60000,
    });
    console.log('[AI Radiology] Worker pool initialized:', workerPool.getStats());

    // Register VLM Service
    servicesManager.registerService(VLMService.REGISTRATION, {
      provider: aiConfig.vlmProvider || 'openai',
      apiEndpoint: aiConfig.vlmEndpoint || '',
      apiKey: aiConfig.vlmApiKey || '',
      model: aiConfig.vlmModel || 'gpt-4-vision-preview',
      maxTokens: aiConfig.vlmMaxTokens || 4096,
      temperature: aiConfig.vlmTemperature || 0.3,
    });

    // Register Report Workflow Service
    servicesManager.registerService(ReportWorkflowService.REGISTRATION);

    // Configure storage backend
    const { reportWorkflowService } = servicesManager.services;
    if (aiConfig.reportStorageBackend === 'localStorage') {
      (reportWorkflowService as ReportWorkflowService).setStorageBackend(
        new LocalStorageBackend()
      );
    }

    // Register Report Submission Service
    servicesManager.registerService(ReportSubmissionService.REGISTRATION, {
      defaultFormat: aiConfig.defaultSubmissionFormat || 'dicom-sr',
      retryAttempts: aiConfig.submissionRetryAttempts || 3,
    });

    // Configure submission targets from config
    const { reportSubmissionService } = servicesManager.services;
    if (aiConfig.submissionTargets) {
      aiConfig.submissionTargets.forEach((target: Parameters<ReportSubmissionService['registerTarget']>[0]) => {
        (reportSubmissionService as ReportSubmissionService).registerTarget(target);
      });
    }

    // Register AI Analysis Service
    servicesManager.registerService(AIAnalysisService.REGISTRATION, {
      autoAnalyze: aiConfig.autoAnalyze || false,
      analysisTypes: aiConfig.analysisTypes || ['general_abnormality'],
      confidenceThreshold: aiConfig.confidenceThreshold || 0.5,
      showOverlays: aiConfig.showOverlays !== false,
    });

    // Register analysis endpoints
    const { aiAnalysisService } = servicesManager.services;
    if (aiConfig.analysisEndpoints) {
      Object.entries(aiConfig.analysisEndpoints).forEach(([type, endpoint]) => {
        (aiAnalysisService as AIAnalysisService).registerEndpoint(
          type as Parameters<AIAnalysisService['registerEndpoint']>[0],
          endpoint as string
        );
      });
    }

    // Register Analytics Service
    servicesManager.registerService(AnalyticsService.REGISTRATION, {
      cacheTimeout: aiConfig.analyticsCacheTimeout || 300000,
      refreshInterval: aiConfig.analyticsRefreshInterval || 60000,
    });

    // Register AI Feature Services (triage, detection, quantification, workflow)
    servicesManager.registerService(StudyTriageService.REGISTRATION, {
      autoTriage: aiConfig.autoTriage !== false,
      priorityThresholds: aiConfig.priorityThresholds || { critical: 0.9, urgent: 0.7, stat: 0.5 },
    });

    servicesManager.registerService(CriticalFindingService.REGISTRATION, {
      alertEndpoint: aiConfig.criticalAlertEndpoint,
      notificationMethods: aiConfig.criticalNotificationMethods || ['ui', 'sound'],
    });

    servicesManager.registerService(SmartWorklistService.REGISTRATION, {
      balancingStrategy: aiConfig.worklistStrategy || 'priority-weighted',
    });

    servicesManager.registerService(LungNoduleService.REGISTRATION, {
      modelEndpoint: aiConfig.lungNoduleEndpoint,
      confidenceThreshold: aiConfig.lungNoduleThreshold || 0.5,
    });

    servicesManager.registerService(CACScoreService.REGISTRATION, {
      modelEndpoint: aiConfig.cacScoreEndpoint,
    });

    servicesManager.registerService(StrokeDetectionService.REGISTRATION, {
      modelEndpoint: aiConfig.strokeDetectionEndpoint,
      alertOnPositive: aiConfig.strokeAlertOnPositive !== false,
    });

    servicesManager.registerService(MammographyService.REGISTRATION, {
      modelEndpoint: aiConfig.mammographyEndpoint,
    });

    servicesManager.registerService(FractureDetectionService.REGISTRATION, {
      modelEndpoint: aiConfig.fractureEndpoint,
    });

    servicesManager.registerService(OrganVolumeService.REGISTRATION, {
      modelEndpoint: aiConfig.organVolumeEndpoint,
    });

    servicesManager.registerService(TumorResponseService.REGISTRATION, {
      modelEndpoint: aiConfig.tumorResponseEndpoint,
      criteria: aiConfig.tumorResponseCriteria || 'RECIST',
    });

    servicesManager.registerService(ImageQualityService.REGISTRATION, {
      autoCheck: aiConfig.autoQualityCheck !== false,
      thresholds: aiConfig.qualityThresholds,
    });

    servicesManager.registerService(AuditTrailService.REGISTRATION, {
      storageBackend: aiConfig.auditStorageBackend || 'indexeddb',
      retentionDays: aiConfig.auditRetentionDays || 365,
    });

    // Initialize IndexedDB for large dataset storage
    if (aiConfig.enablePersistentStorage !== false) {
      try {
        const storage = new IndexedDBStorage('ohif_ai_radiology', 1);
        await storage.initialize();
        console.log('[AI Radiology] IndexedDB storage initialized');
      } catch (error) {
        console.warn('[AI Radiology] IndexedDB initialization failed, using memory storage:', error);
      }
    }

    // Initialize memory monitor for large studies
    const memoryMonitor = new MemoryMonitor(
      aiConfig.memoryWarningThreshold || 0.7,
      aiConfig.memoryCriticalThreshold || 0.85
    );
    memoryMonitor.startMonitoring(aiConfig.memoryCheckInterval || 30000);

    console.log('[AI Radiology] Extension pre-registration complete');
  },

  /**
   * Called when entering a mode that uses this extension
   */
  onModeEnter({ servicesManager }: withAppTypes): void {
    const { panelService } = servicesManager.services;

    // Optionally auto-open AI panel
    // panelService.addPanel('right', 'ai-report-panel');
  },

  /**
   * Called when exiting a mode that uses this extension
   */
  onModeExit({ servicesManager }: withAppTypes): void {
    const { vlmService, aiAnalysisService } = servicesManager.services;

    // Cancel any ongoing operations
    (vlmService as VLMService)?.cancelGeneration();
    (aiAnalysisService as AIAnalysisService)?.cancelAnalysis();

    // Cleanup worker pool on mode exit (graceful shutdown)
    shutdownWorkerPool(true).catch(err => {
      console.warn('[AI Radiology] Worker pool shutdown error:', err);
    });
  },

  /**
   * Get commands module
   */
  getCommandsModule,

  /**
   * Get panel module
   */
  getPanelModule({ servicesManager, commandsManager }): Types.Panel[] {
    return [
      {
        name: 'ai-report-panel',
        iconName: 'icon-clipboard-list',
        iconLabel: 'AI Report',
        label: 'AI Report',
        component: AIReportPanel,
      },
      {
        name: 'ai-dashboard-panel',
        iconName: 'icon-chart-bar',
        iconLabel: 'AI Dashboard',
        label: 'AI Dashboard',
        component: AIRadiologyDashboard,
      },
    ];
  },

  /**
   * Get toolbar module
   */
  getToolbarModule,

  /**
   * Get hanging protocol module
   */
  getHangingProtocolModule,

  /**
   * Get utility module - exports for use by other extensions
   */
  getUtilityModule(): Record<string, unknown> {
    return {
      getToolbarButtons,
    };
  },

  /**
   * Get customization module
   */
  getCustomizationModule(): Record<string, unknown>[] {
    return [
      {
        name: 'ai-radiology-settings',
        value: {
          // Customization for AI report panel
          'aiReport.showConfidenceScores': true,
          'aiReport.showFindingLinks': true,
          'aiReport.autoSave': true,
          'aiReport.autoSaveIntervalMs': 30000,

          // Customization for AI analysis
          'aiAnalysis.showOverlays': true,
          'aiAnalysis.overlayOpacity': 0.5,
          'aiAnalysis.highlightCritical': true,

          // Report submission customization
          'reportSubmission.requireApproval': true,
          'reportSubmission.showConfirmation': true,
        },
      },
    ];
  },
};

/**
 * Commands module factory
 */
function getCommandsModule(params: withAppTypes): Types.CommandsModule {
  return commandsModule(params);
}

export default extension;
