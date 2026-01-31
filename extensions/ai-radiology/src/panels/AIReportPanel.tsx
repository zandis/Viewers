import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GeneratedReport,
  ReportSection,
  Finding,
  ReportStatus,
  ReportWorkflowState,
  AI_EVENTS,
} from '../types';

interface AIReportPanelProps {
  servicesManager: AppTypes.ServicesManager;
  commandsManager: AppTypes.CommandsManager;
}

/**
 * AI Report Panel
 * Main panel for viewing and editing AI-generated radiology reports
 */
const AIReportPanel: React.FC<AIReportPanelProps> = ({
  servicesManager,
  commandsManager,
}) => {
  const { t } = useTranslation('AIRadiology');
  const [activeStudyUID, setActiveStudyUID] = useState<string | null>(null);
  const [reportState, setReportState] = useState<ReportWorkflowState | null>(null);
  const [editedReport, setEditedReport] = useState<GeneratedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const {
    vlmService,
    reportWorkflowService,
    displaySetService,
    uiNotificationService,
  } = servicesManager.services as {
    vlmService: AppTypes.VLMService;
    reportWorkflowService: AppTypes.ReportWorkflowService;
    displaySetService: AppTypes.DisplaySetService;
    uiNotificationService: AppTypes.UINotificationService;
  };

  // Get current study from display sets
  useEffect(() => {
    const displaySets = displaySetService.getActiveDisplaySets?.() || [];
    if (displaySets.length > 0) {
      const studyUID = displaySets[0].StudyInstanceUID;
      setActiveStudyUID(studyUID);

      // Load existing report if available
      const existingReport = reportWorkflowService?.getReport(studyUID);
      if (existingReport) {
        setReportState(existingReport);
        setEditedReport(existingReport.editedReport || existingReport.aiReport || null);
      }
    }
  }, [displaySetService, reportWorkflowService]);

  // Subscribe to VLM events
  useEffect(() => {
    if (!vlmService) return;

    const subscriptions = [
      vlmService.subscribe(AI_EVENTS.VLM_REPORT_STARTED, () => {
        setIsGenerating(true);
        setError(null);
      }),
      vlmService.subscribe(AI_EVENTS.VLM_REPORT_COMPLETED, (data: { report: GeneratedReport }) => {
        setIsGenerating(false);
        if (activeStudyUID) {
          reportWorkflowService?.setAIReport(activeStudyUID, data.report);
          setEditedReport(data.report);
        }
      }),
      vlmService.subscribe(AI_EVENTS.VLM_REPORT_ERROR, (data: { error: string }) => {
        setIsGenerating(false);
        setError(data.error);
      }),
    ];

    return () => {
      subscriptions.forEach(unsub => unsub?.());
    };
  }, [vlmService, reportWorkflowService, activeStudyUID]);

  // Subscribe to report workflow events
  useEffect(() => {
    if (!reportWorkflowService) return;

    const subscription = reportWorkflowService.subscribe(
      AI_EVENTS.REPORT_STATUS_CHANGED,
      (data: { studyInstanceUID: string }) => {
        if (data.studyInstanceUID === activeStudyUID) {
          const updated = reportWorkflowService.getReport(activeStudyUID);
          setReportState(updated || null);
        }
      }
    );

    return () => subscription?.();
  }, [reportWorkflowService, activeStudyUID]);

  // Generate report handler
  const handleGenerateReport = useCallback(async () => {
    if (!activeStudyUID) return;

    try {
      // Create or get report workflow
      let workflow = reportWorkflowService?.getReport(activeStudyUID);
      if (!workflow) {
        workflow = reportWorkflowService?.createReport(activeStudyUID);
      }

      reportWorkflowService?.updateStatus(activeStudyUID, 'ai_generating');

      // Get images for analysis
      const displaySets = displaySetService.getActiveDisplaySets?.() || [];
      const images = await extractImagesForVLM(displaySets, servicesManager);

      // Get study info
      const studyInfo = getStudyInfo(displaySets[0]);

      // Call VLM service
      await commandsManager.runCommand('generateAIReport', {
        images,
        studyInfo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setIsGenerating(false);
    }
  }, [activeStudyUID, reportWorkflowService, displaySetService, commandsManager, servicesManager]);

  // Update section content
  const handleSectionChange = useCallback(
    (sectionId: string, newContent: string) => {
      if (!editedReport) return;

      const updatedSections = editedReport.sections.map(section =>
        section.id === sectionId
          ? { ...section, content: newContent, aiGenerated: false }
          : section
      );

      const updatedReport = { ...editedReport, sections: updatedSections };
      setEditedReport(updatedReport);
    },
    [editedReport]
  );

  // Save edited report
  const handleSave = useCallback(() => {
    if (!activeStudyUID || !editedReport) return;

    reportWorkflowService?.updateEditedReport(activeStudyUID, editedReport, 'current-user');
    uiNotificationService?.show({
      title: t('Report Saved'),
      message: t('Your changes have been saved'),
      type: 'success',
      duration: 3000,
    });
  }, [activeStudyUID, editedReport, reportWorkflowService, uiNotificationService, t]);

  // Approve report
  const handleApprove = useCallback(() => {
    if (!activeStudyUID || !editedReport) return;

    reportWorkflowService?.approveReport(activeStudyUID, 'current-user', editedReport);
    uiNotificationService?.show({
      title: t('Report Approved'),
      message: t('The report has been finalized'),
      type: 'success',
      duration: 3000,
    });
  }, [activeStudyUID, editedReport, reportWorkflowService, uiNotificationService, t]);

  // Submit report
  const handleSubmit = useCallback(async () => {
    if (!activeStudyUID) return;

    await commandsManager.runCommand('submitReport', {
      studyInstanceUID: activeStudyUID,
    });
  }, [activeStudyUID, commandsManager]);

  // Navigate to finding in viewport
  const handleFindingClick = useCallback(
    (finding: Finding) => {
      if (finding.imageReference) {
        commandsManager.runCommand('jumpToImage', {
          sopInstanceUID: finding.imageReference.sopInstanceUID,
          frameNumber: finding.imageReference.frameNumber,
        });
      }
    },
    [commandsManager]
  );

  // Render loading state
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <p className="text-lg">{t('Generating AI Report...')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('This may take a moment')}
        </p>
        <button
          className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
          onClick={() => vlmService?.cancelGeneration()}
        >
          {t('Cancel')}
        </button>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-destructive text-lg mb-4">{t('Error')}</div>
        <p className="text-sm text-center mb-4">{error}</p>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80"
          onClick={() => {
            setError(null);
            handleGenerateReport();
          }}
        >
          {t('Try Again')}
        </button>
      </div>
    );
  }

  // Render empty state
  if (!editedReport) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">{t('AI Report Generation')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Generate an AI-assisted radiology report for the current study')}
          </p>
        </div>
        <button
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 font-medium"
          onClick={handleGenerateReport}
          disabled={!activeStudyUID}
        >
          {t('Generate Report')}
        </button>
      </div>
    );
  }

  // Render report editor
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="font-semibold">{t('AI Radiology Report')}</h3>
          <StatusBadge status={reportState?.status || 'ai_generated'} />
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-sm bg-secondary rounded hover:bg-secondary/80"
            onClick={handleGenerateReport}
            title={t('Regenerate')}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto p-3">
        {/* Sections */}
        {editedReport.sections.map(section => (
          <ReportSectionEditor
            key={section.id}
            section={section}
            isActive={activeSection === section.id}
            onFocus={() => setActiveSection(section.id)}
            onChange={content => handleSectionChange(section.id, content)}
          />
        ))}

        {/* Findings Summary */}
        {editedReport.findings.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">{t('AI Findings')}</h4>
            <div className="space-y-2">
              {editedReport.findings.map(finding => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onClick={() => handleFindingClick(finding)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Impressions */}
        {editedReport.impressions.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded">
            <h4 className="font-medium mb-2">{t('Impression')}</h4>
            <ol className="list-decimal list-inside space-y-1">
              {editedReport.impressions.map((impression, i) => (
                <li key={i} className="text-sm">
                  {impression}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-t flex gap-2">
        <button
          className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
          onClick={handleSave}
        >
          {t('Save Draft')}
        </button>
        {reportState?.status !== 'approved' && reportState?.status !== 'submitted' && (
          <button
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80"
            onClick={handleApprove}
          >
            {t('Approve')}
          </button>
        )}
        {reportState?.status === 'approved' && (
          <button
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={handleSubmit}
          >
            {t('Submit')}
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface StatusBadgeProps {
  status: ReportStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig: Record<ReportStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-gray-500' },
    ai_generating: { label: 'Generating', className: 'bg-blue-500 animate-pulse' },
    ai_generated: { label: 'AI Draft', className: 'bg-blue-500' },
    in_review: { label: 'In Review', className: 'bg-yellow-500' },
    approved: { label: 'Approved', className: 'bg-green-500' },
    amended: { label: 'Amended', className: 'bg-orange-500' },
    final: { label: 'Final', className: 'bg-green-600' },
    submitted: { label: 'Submitted', className: 'bg-purple-500' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${config.className}`}>
      {config.label}
    </span>
  );
};

interface ReportSectionEditorProps {
  section: ReportSection;
  isActive: boolean;
  onFocus: () => void;
  onChange: (content: string) => void;
}

const ReportSectionEditor: React.FC<ReportSectionEditorProps> = ({
  section,
  isActive,
  onFocus,
  onChange,
}) => {
  return (
    <div className={`mb-4 ${isActive ? 'ring-2 ring-primary rounded' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-medium text-sm uppercase">{section.title}</h4>
        {section.aiGenerated && (
          <span className="text-xs text-muted-foreground">AI Generated</span>
        )}
      </div>
      {section.isEditable ? (
        <textarea
          className="w-full min-h-[100px] p-2 border rounded bg-background resize-y text-sm"
          value={section.content}
          onFocus={onFocus}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${section.title.toLowerCase()}...`}
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap">{section.content}</p>
      )}
      {section.confidence !== undefined && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${section.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round(section.confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface FindingCardProps {
  finding: Finding;
  onClick: () => void;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding, onClick }) => {
  const severityColors: Record<string, string> = {
    normal: 'border-green-500 bg-green-50',
    mild: 'border-yellow-500 bg-yellow-50',
    moderate: 'border-orange-500 bg-orange-50',
    severe: 'border-red-500 bg-red-50',
    critical: 'border-red-700 bg-red-100 animate-pulse',
  };

  const colorClass = severityColors[finding.severity || 'moderate'] || severityColors.moderate;

  return (
    <button
      className={`w-full text-left p-2 rounded border-l-4 ${colorClass} hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium">{finding.description}</span>
        <span className="text-xs text-muted-foreground">
          {Math.round(finding.confidence * 100)}%
        </span>
      </div>
      {finding.location && (
        <span className="text-xs text-muted-foreground">
          {finding.location.region}
          {finding.location.laterality && ` (${finding.location.laterality})`}
        </span>
      )}
    </button>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

async function extractImagesForVLM(
  displaySets: AppTypes.DisplaySet[],
  servicesManager: AppTypes.ServicesManager
): Promise<Array<{ base64Data: string; mimeType: string; metadata: Record<string, unknown> }>> {
  const images: Array<{ base64Data: string; mimeType: string; metadata: Record<string, unknown> }> = [];

  for (const displaySet of displaySets) {
    if (!displaySet.instances || displaySet.instances.length === 0) continue;

    // Get key images (first, middle, last for multi-slice)
    const keyIndices = getKeyImageIndices(displaySet.instances.length);

    for (const index of keyIndices) {
      const instance = displaySet.instances[index];
      if (!instance) continue;

      try {
        // Get rendered image from viewport or cornerstone
        const imageData = await getRenderedImage(instance, servicesManager);
        if (imageData) {
          images.push({
            base64Data: imageData,
            mimeType: 'image/png',
            metadata: {
              sopInstanceUID: instance.SOPInstanceUID,
              seriesInstanceUID: instance.SeriesInstanceUID,
              studyInstanceUID: instance.StudyInstanceUID,
              modality: displaySet.Modality,
            },
          });
        }
      } catch (err) {
        console.warn('Failed to extract image:', err);
      }
    }
  }

  return images;
}

function getKeyImageIndices(totalImages: number): number[] {
  if (totalImages <= 3) {
    return Array.from({ length: totalImages }, (_, i) => i);
  }
  // Return first, middle, and last indices
  return [0, Math.floor(totalImages / 2), totalImages - 1];
}

async function getRenderedImage(
  instance: Record<string, unknown>,
  servicesManager: AppTypes.ServicesManager
): Promise<string | null> {
  // This would integrate with Cornerstone to get rendered images
  // For now, return null - actual implementation would use cornerstone viewport service
  const { cornerstoneViewportService } = servicesManager.services as {
    cornerstoneViewportService?: {
      getViewportImageData?: (sopInstanceUID: string) => Promise<string>;
    };
  };

  if (cornerstoneViewportService?.getViewportImageData) {
    return cornerstoneViewportService.getViewportImageData(instance.SOPInstanceUID as string);
  }

  return null;
}

function getStudyInfo(displaySet: AppTypes.DisplaySet): Record<string, unknown> {
  return {
    studyInstanceUID: displaySet.StudyInstanceUID,
    studyDate: displaySet.StudyDate,
    studyDescription: displaySet.StudyDescription,
    modality: displaySet.Modality,
    patient: {
      patientId: displaySet.PatientID,
      patientName: displaySet.PatientName,
    },
    seriesCount: 1,
    instanceCount: displaySet.instances?.length || 0,
  };
}

export default AIReportPanel;
