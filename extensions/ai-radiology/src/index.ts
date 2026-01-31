import { Types } from '@ohif/core';
import {
  VLMService,
  ReportWorkflowService,
  ReportSubmissionService,
  AIAnalysisService,
  LocalStorageBackend,
} from './services';
import commandsModule from './commands/commandsModule';
import toolbarModule, { getToolbarButtons } from './toolbar/toolbarModule';
import AIReportPanel from './panels/AIReportPanel';
import getHangingProtocolModule from './hanging-protocols';

// Export types for external use
export * from './types';
export { VLMService, ReportWorkflowService, ReportSubmissionService, AIAnalysisService };

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
