import {
  VLMReportRequest,
  StudyInfo,
  VLMImageInput,
  GeneratedReport,
  ReportSubmissionRequest,
} from '../types';

/**
 * Commands Module for AI Radiology Extension
 * Defines all available commands for AI-powered radiology workflow
 */
const commandsModule = ({
  servicesManager,
  commandsManager,
}: withAppTypes): Types.CommandsModule => {
  const actions = {
    /**
     * Generate AI report from current study
     */
    generateAIReport: async ({
      images,
      studyInfo,
      prompt,
      clinicalHistory,
      focusAreas,
    }: {
      images?: VLMImageInput[];
      studyInfo?: StudyInfo;
      prompt?: string;
      clinicalHistory?: string;
      focusAreas?: string[];
    }) => {
      const { vlmService, displaySetService, uiNotificationService, reportWorkflowService } =
        servicesManager.services;

      try {
        // Get images if not provided
        let imagesToAnalyze = images;
        if (!imagesToAnalyze || imagesToAnalyze.length === 0) {
          imagesToAnalyze = await extractCurrentViewportImages(servicesManager);
        }

        // Get study info if not provided
        let study = studyInfo;
        if (!study) {
          const displaySets = displaySetService.getActiveDisplaySets();
          if (displaySets.length > 0) {
            study = buildStudyInfo(displaySets[0]);
          }
        }

        if (!study) {
          throw new Error('No study available for report generation');
        }

        // Create report request
        const request: VLMReportRequest = {
          images: imagesToAnalyze,
          studyInfo: study,
          prompt,
          clinicalHistory,
          focusAreas,
        };

        // Generate report
        const response = await vlmService.generateReport(request);

        // Store in workflow
        reportWorkflowService.setAIReport(study.studyInstanceUID, response.report);

        uiNotificationService.show({
          title: 'AI Report Generated',
          message: `Report generated in ${(response.processingTimeMs / 1000).toFixed(1)}s`,
          type: 'success',
          duration: 5000,
        });

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        uiNotificationService.show({
          title: 'Report Generation Failed',
          message,
          type: 'error',
          duration: 10000,
        });
        throw error;
      }
    },

    /**
     * Run AI analysis on current images
     */
    runAIAnalysis: async ({
      analysisTypes,
    }: {
      analysisTypes?: string[];
    } = {}) => {
      const { aiAnalysisService, displaySetService, uiNotificationService } =
        servicesManager.services;

      try {
        const images = await extractCurrentViewportImages(servicesManager);
        if (images.length === 0) {
          throw new Error('No images available for analysis');
        }

        uiNotificationService.show({
          title: 'AI Analysis',
          message: 'Starting image analysis...',
          type: 'info',
          duration: 3000,
        });

        const results = await aiAnalysisService.analyzeImages(
          images.map(img => ({
            base64Data: img.base64Data,
            mimeType: img.mimeType,
          })),
          analysisTypes
        );

        // Create findings display set
        const displaySets = displaySetService.getActiveDisplaySets();
        if (displaySets.length > 0) {
          const findingsDisplaySet = aiAnalysisService.createFindingsDisplaySet(
            results,
            displaySets[0].StudyInstanceUID
          );

          // Add as overlay or separate display set
          // This would integrate with OHIF's display set service
        }

        const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
        uiNotificationService.show({
          title: 'AI Analysis Complete',
          message: `Found ${totalFindings} finding(s)`,
          type: 'success',
          duration: 5000,
        });

        return results;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        uiNotificationService.show({
          title: 'Analysis Failed',
          message,
          type: 'error',
          duration: 10000,
        });
        throw error;
      }
    },

    /**
     * Save current report draft
     */
    saveReportDraft: ({
      studyInstanceUID,
      report,
    }: {
      studyInstanceUID?: string;
      report?: GeneratedReport;
    } = {}) => {
      const { reportWorkflowService, displaySetService, uiNotificationService } =
        servicesManager.services;

      let studyUID = studyInstanceUID;
      if (!studyUID) {
        const displaySets = displaySetService.getActiveDisplaySets();
        if (displaySets.length > 0) {
          studyUID = displaySets[0].StudyInstanceUID;
        }
      }

      if (!studyUID) {
        uiNotificationService.show({
          title: 'Save Failed',
          message: 'No active study',
          type: 'error',
        });
        return;
      }

      const currentReport = reportWorkflowService.getReport(studyUID);
      const reportToSave = report || currentReport?.editedReport;

      if (reportToSave) {
        reportWorkflowService.updateEditedReport(studyUID, reportToSave, 'current-user');
        uiNotificationService.show({
          title: 'Draft Saved',
          message: 'Report draft has been saved',
          type: 'success',
          duration: 3000,
        });
      }
    },

    /**
     * Approve and finalize report
     */
    approveReport: ({
      studyInstanceUID,
    }: {
      studyInstanceUID?: string;
    } = {}) => {
      const { reportWorkflowService, displaySetService, uiNotificationService } =
        servicesManager.services;

      let studyUID = studyInstanceUID;
      if (!studyUID) {
        const displaySets = displaySetService.getActiveDisplaySets();
        if (displaySets.length > 0) {
          studyUID = displaySets[0].StudyInstanceUID;
        }
      }

      if (!studyUID) {
        uiNotificationService.show({
          title: 'Approval Failed',
          message: 'No active study',
          type: 'error',
        });
        return;
      }

      reportWorkflowService.approveReport(studyUID, 'current-user');
      uiNotificationService.show({
        title: 'Report Approved',
        message: 'Report has been finalized and approved',
        type: 'success',
        duration: 5000,
      });
    },

    /**
     * Submit report to external system
     */
    submitReport: async ({
      studyInstanceUID,
      targetId,
      format,
    }: {
      studyInstanceUID?: string;
      targetId?: string;
      format?: 'dicom-sr' | 'hl7-oru' | 'fhir' | 'pdf' | 'text';
    } = {}) => {
      const {
        reportWorkflowService,
        reportSubmissionService,
        displaySetService,
        uiNotificationService,
        uiDialogService,
      } = servicesManager.services;

      let studyUID = studyInstanceUID;
      if (!studyUID) {
        const displaySets = displaySetService.getActiveDisplaySets();
        if (displaySets.length > 0) {
          studyUID = displaySets[0].StudyInstanceUID;
        }
      }

      if (!studyUID) {
        uiNotificationService.show({
          title: 'Submission Failed',
          message: 'No active study',
          type: 'error',
        });
        return;
      }

      const reportState = reportWorkflowService.getReport(studyUID);
      if (!reportState || !reportState.finalReport) {
        uiNotificationService.show({
          title: 'Submission Failed',
          message: 'Report must be approved before submission',
          type: 'error',
        });
        return;
      }

      // Get available targets
      const targets = reportSubmissionService.getTargets();
      if (targets.length === 0) {
        uiNotificationService.show({
          title: 'No Submission Targets',
          message: 'Please configure submission targets in settings',
          type: 'warning',
        });
        return;
      }

      // If no target specified, show selection dialog
      let selectedTargetId = targetId;
      let selectedFormat = format || 'dicom-sr';

      if (!selectedTargetId) {
        // Show dialog to select target
        const result = await new Promise<{ targetId: string; format: string } | null>(resolve => {
          uiDialogService.create({
            id: 'select-submission-target',
            centralize: true,
            isDraggable: false,
            showOverlay: true,
            content: SubmissionTargetDialog,
            contentProps: {
              targets,
              onSubmit: (data: { targetId: string; format: string }) => {
                uiDialogService.dismiss({ id: 'select-submission-target' });
                resolve(data);
              },
              onCancel: () => {
                uiDialogService.dismiss({ id: 'select-submission-target' });
                resolve(null);
              },
            },
          });
        });

        if (!result) return;
        selectedTargetId = result.targetId;
        selectedFormat = result.format as typeof selectedFormat;
      }

      // Build study info
      const displaySets = displaySetService.getActiveDisplaySets();
      const studyInfo = buildStudyInfo(displaySets[0]);

      // Submit
      try {
        const request: ReportSubmissionRequest = {
          reportId: reportState.reportId,
          targetId: selectedTargetId,
          format: selectedFormat,
          report: reportState.finalReport,
          studyInfo,
        };

        const response = await reportSubmissionService.submitReport(request);

        if (response.success) {
          reportWorkflowService.markSubmitted(studyUID, selectedTargetId, {
            submissionId: response.submissionId,
          });

          uiNotificationService.show({
            title: 'Report Submitted',
            message: `Successfully submitted to ${response.target}`,
            type: 'success',
            duration: 5000,
          });
        } else {
          throw new Error(response.error || 'Submission failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        uiNotificationService.show({
          title: 'Submission Failed',
          message,
          type: 'error',
          duration: 10000,
        });
      }
    },

    /**
     * Export report to file
     */
    exportReport: ({
      studyInstanceUID,
      format,
    }: {
      studyInstanceUID?: string;
      format?: 'json' | 'text' | 'html';
    } = {}) => {
      const { reportWorkflowService, displaySetService, uiNotificationService } =
        servicesManager.services;

      let studyUID = studyInstanceUID;
      if (!studyUID) {
        const displaySets = displaySetService.getActiveDisplaySets();
        if (displaySets.length > 0) {
          studyUID = displaySets[0].StudyInstanceUID;
        }
      }

      if (!studyUID) {
        uiNotificationService.show({
          title: 'Export Failed',
          message: 'No active study',
          type: 'error',
        });
        return;
      }

      const exportFormat = format || 'html';
      const content = reportWorkflowService.exportReport(studyUID, exportFormat);

      if (!content) {
        uiNotificationService.show({
          title: 'Export Failed',
          message: 'No report available to export',
          type: 'error',
        });
        return;
      }

      // Download file
      const blob = new Blob([content], {
        type:
          exportFormat === 'json'
            ? 'application/json'
            : exportFormat === 'html'
              ? 'text/html'
              : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${studyUID}.${exportFormat === 'json' ? 'json' : exportFormat === 'html' ? 'html' : 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);

      uiNotificationService.show({
        title: 'Report Exported',
        message: `Report saved as ${exportFormat.toUpperCase()}`,
        type: 'success',
        duration: 3000,
      });
    },

    /**
     * Toggle AI report panel
     */
    toggleAIReportPanel: () => {
      const { panelService } = servicesManager.services;
      panelService.togglePanel?.('ai-report-panel');
    },

    /**
     * Jump to finding location in viewport
     */
    jumpToFinding: ({
      findingId,
      sopInstanceUID,
      frameNumber,
    }: {
      findingId?: string;
      sopInstanceUID?: string;
      frameNumber?: number;
    }) => {
      const { cornerstoneViewportService, viewportGridService } = servicesManager.services;

      if (sopInstanceUID) {
        // Navigate to the specific image
        commandsManager.runCommand('displayImage', {
          sopInstanceUID,
          frameNumber,
        });
      }
    },

    /**
     * Configure VLM service
     */
    configureVLM: ({
      provider,
      apiEndpoint,
      apiKey,
      model,
    }: {
      provider?: string;
      apiEndpoint?: string;
      apiKey?: string;
      model?: string;
    }) => {
      const { vlmService } = servicesManager.services;
      vlmService.configure({
        provider,
        apiEndpoint,
        apiKey,
        model,
      });
    },

    /**
     * Test VLM connection
     */
    testVLMConnection: async () => {
      const { vlmService, uiNotificationService } = servicesManager.services;

      const result = await vlmService.testConnection();

      uiNotificationService.show({
        title: result.success ? 'Connection Successful' : 'Connection Failed',
        message: result.message,
        type: result.success ? 'success' : 'error',
        duration: 5000,
      });

      return result;
    },
  };

  const definitions = {
    generateAIReport: {
      commandFn: actions.generateAIReport,
    },
    runAIAnalysis: {
      commandFn: actions.runAIAnalysis,
    },
    saveReportDraft: {
      commandFn: actions.saveReportDraft,
    },
    approveReport: {
      commandFn: actions.approveReport,
    },
    submitReport: {
      commandFn: actions.submitReport,
    },
    exportReport: {
      commandFn: actions.exportReport,
    },
    toggleAIReportPanel: {
      commandFn: actions.toggleAIReportPanel,
    },
    jumpToFinding: {
      commandFn: actions.jumpToFinding,
    },
    configureVLM: {
      commandFn: actions.configureVLM,
    },
    testVLMConnection: {
      commandFn: actions.testVLMConnection,
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'AI_RADIOLOGY',
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

async function extractCurrentViewportImages(
  servicesManager: AppTypes.ServicesManager
): Promise<VLMImageInput[]> {
  const { cornerstoneViewportService, viewportGridService } = servicesManager.services;

  const images: VLMImageInput[] = [];
  const viewportIds = viewportGridService?.getState?.()?.viewports?.keys() || [];

  for (const viewportId of viewportIds) {
    try {
      // Get viewport canvas and convert to base64
      const viewport = cornerstoneViewportService?.getCornerstoneViewport?.(viewportId);
      if (!viewport) continue;

      const canvas = viewport.canvas;
      if (!canvas) continue;

      const base64Data = canvas.toDataURL('image/png').split(',')[1];

      images.push({
        base64Data,
        mimeType: 'image/png',
        metadata: {
          studyInstanceUID: viewport.studyInstanceUID,
          seriesInstanceUID: viewport.seriesInstanceUID,
          sopInstanceUID: viewport.sopInstanceUID,
          modality: viewport.modality || 'UNKNOWN',
          rows: canvas.height,
          columns: canvas.width,
          bitsAllocated: 8,
        },
      });
    } catch (err) {
      console.warn('Failed to extract viewport image:', err);
    }
  }

  return images;
}

function buildStudyInfo(displaySet: AppTypes.DisplaySet): StudyInfo {
  return {
    studyInstanceUID: displaySet.StudyInstanceUID,
    studyDate: displaySet.StudyDate,
    studyTime: displaySet.StudyTime,
    studyDescription: displaySet.StudyDescription,
    modality: displaySet.Modality,
    accessionNumber: displaySet.AccessionNumber,
    referringPhysician: displaySet.ReferringPhysicianName,
    institutionName: displaySet.InstitutionName,
    patient: {
      patientId: displaySet.PatientID,
      patientName: displaySet.PatientName,
      birthDate: displaySet.PatientBirthDate,
      sex: displaySet.PatientSex,
    },
    seriesCount: 1,
    instanceCount: displaySet.numImageFrames || displaySet.instances?.length || 0,
  };
}

// Stub component for submission target dialog
const SubmissionTargetDialog = ({
  targets,
  onSubmit,
  onCancel,
}: {
  targets: Array<{ id: string; name: string }>;
  onSubmit: (data: { targetId: string; format: string }) => void;
  onCancel: () => void;
}) => {
  return null; // Actual implementation would be in a separate component file
};

export default commandsModule;
