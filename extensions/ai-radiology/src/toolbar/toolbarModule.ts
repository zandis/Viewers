/**
 * Toolbar Module for AI Radiology Extension
 * Defines toolbar buttons for AI-powered radiology workflow
 */
const toolbarModule = ({ servicesManager }: withAppTypes): Types.ToolbarModule => {
  return [
    // AI Report Generation Button
    {
      name: 'AIReportButton',
      defaultComponent: null, // Uses built-in button rendering
      clickHandler: () => {},
    },
    // AI Analysis Button
    {
      name: 'AIAnalysisButton',
      defaultComponent: null,
      clickHandler: () => {},
    },
  ];
};

/**
 * Get toolbar button definitions for modes
 */
export function getToolbarButtons(): Types.ToolbarButton[] {
  return [
    // AI Report Generation
    {
      id: 'AIReport',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'AIReport',
        primary: createAIReportPrimaryButton(),
        secondary: createAIReportSecondaryButtons(),
      },
    },

    // AI Analysis
    {
      id: 'AIAnalysis',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'AIAnalysis',
        primary: createAIAnalysisPrimaryButton(),
        secondary: createAIAnalysisSecondaryButtons(),
      },
    },

    // Simple AI Report Button (for compact toolbars)
    {
      id: 'AIReportSimple',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-clipboard-list',
        label: 'AI Report',
        tooltip: 'Generate AI Report',
        commands: [
          {
            commandName: 'generateAIReport',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
    },

    // Toggle AI Panel Button
    {
      id: 'ToggleAIPanel',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-panel-right',
        label: 'AI Panel',
        tooltip: 'Toggle AI Report Panel',
        commands: [
          {
            commandName: 'toggleAIReportPanel',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
        evaluate: ({ servicesManager }: withAppTypes) => {
          const { panelService } = servicesManager.services;
          const isActive = panelService
            ?.getPanels?.('right')
            ?.some((p: { id: string }) => p.id === 'ai-report-panel');
          return { isActive };
        },
      },
    },

    // Export Report Button
    {
      id: 'ExportReport',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'ExportReport',
        primary: {
          id: 'ExportReportHTML',
          icon: 'icon-download',
          label: 'Export',
          tooltip: 'Export Report as HTML',
          commands: [
            {
              commandName: 'exportReport',
              commandOptions: { format: 'html' },
              context: 'AI_RADIOLOGY',
            },
          ],
        },
        secondary: {
          icon: 'chevron-down',
          tooltip: 'Export Options',
          items: [
            {
              id: 'ExportHTML',
              label: 'Export as HTML',
              commands: [
                {
                  commandName: 'exportReport',
                  commandOptions: { format: 'html' },
                  context: 'AI_RADIOLOGY',
                },
              ],
            },
            {
              id: 'ExportJSON',
              label: 'Export as JSON',
              commands: [
                {
                  commandName: 'exportReport',
                  commandOptions: { format: 'json' },
                  context: 'AI_RADIOLOGY',
                },
              ],
            },
            {
              id: 'ExportText',
              label: 'Export as Text',
              commands: [
                {
                  commandName: 'exportReport',
                  commandOptions: { format: 'text' },
                  context: 'AI_RADIOLOGY',
                },
              ],
            },
          ],
        },
      },
    },

    // Submit Report Button
    {
      id: 'SubmitReport',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-upload',
        label: 'Submit',
        tooltip: 'Submit Report to RIS/PACS',
        commands: [
          {
            commandName: 'submitReport',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
        evaluate: ({ servicesManager }: withAppTypes) => {
          // Only enable if report is approved
          const { reportWorkflowService, displaySetService } = servicesManager.services;
          const displaySets = displaySetService?.getActiveDisplaySets?.() || [];
          if (displaySets.length === 0) return { disabled: true };

          const report = reportWorkflowService?.getReport?.(displaySets[0].StudyInstanceUID);
          const isApproved = report?.status === 'approved' || report?.status === 'final';
          return { disabled: !isApproved };
        },
      },
    },
  ];
}

/**
 * Create primary AI Report button configuration
 */
function createAIReportPrimaryButton() {
  return {
    id: 'GenerateAIReport',
    icon: 'icon-clipboard-list',
    label: 'AI Report',
    tooltip: 'Generate AI Radiology Report',
    commands: [
      {
        commandName: 'generateAIReport',
        commandOptions: {},
        context: 'AI_RADIOLOGY',
      },
    ],
  };
}

/**
 * Create secondary AI Report button options
 */
function createAIReportSecondaryButtons() {
  return {
    icon: 'chevron-down',
    tooltip: 'AI Report Options',
    items: [
      {
        id: 'GenerateReport',
        label: 'Generate New Report',
        icon: 'icon-clipboard-list',
        commands: [
          {
            commandName: 'generateAIReport',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'SaveDraft',
        label: 'Save Draft',
        icon: 'icon-save',
        commands: [
          {
            commandName: 'saveReportDraft',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'ApproveReport',
        label: 'Approve Report',
        icon: 'icon-check',
        commands: [
          {
            commandName: 'approveReport',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'divider',
        type: 'divider',
      },
      {
        id: 'ConfigureVLM',
        label: 'Configure AI Settings',
        icon: 'icon-settings',
        commands: [
          {
            commandName: 'openAISettings',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'TestConnection',
        label: 'Test AI Connection',
        icon: 'icon-link',
        commands: [
          {
            commandName: 'testVLMConnection',
            commandOptions: {},
            context: 'AI_RADIOLOGY',
          },
        ],
      },
    ],
  };
}

/**
 * Create primary AI Analysis button configuration
 */
function createAIAnalysisPrimaryButton() {
  return {
    id: 'RunAIAnalysis',
    icon: 'icon-tool-ai',
    label: 'Analyze',
    tooltip: 'Run AI Image Analysis',
    commands: [
      {
        commandName: 'runAIAnalysis',
        commandOptions: {},
        context: 'AI_RADIOLOGY',
      },
    ],
  };
}

/**
 * Create secondary AI Analysis button options
 */
function createAIAnalysisSecondaryButtons() {
  return {
    icon: 'chevron-down',
    tooltip: 'Analysis Options',
    items: [
      {
        id: 'GeneralAnalysis',
        label: 'General Abnormality Detection',
        commands: [
          {
            commandName: 'runAIAnalysis',
            commandOptions: { analysisTypes: ['general_abnormality'] },
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'LungNodule',
        label: 'Lung Nodule Detection',
        commands: [
          {
            commandName: 'runAIAnalysis',
            commandOptions: { analysisTypes: ['lung_nodule_detection'] },
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'ChestPathology',
        label: 'Chest Pathology',
        commands: [
          {
            commandName: 'runAIAnalysis',
            commandOptions: { analysisTypes: ['chest_pathology'] },
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'CardiacAnalysis',
        label: 'Cardiac Analysis',
        commands: [
          {
            commandName: 'runAIAnalysis',
            commandOptions: { analysisTypes: ['cardiac_analysis'] },
            context: 'AI_RADIOLOGY',
          },
        ],
      },
      {
        id: 'divider',
        type: 'divider',
      },
      {
        id: 'AllAnalysis',
        label: 'Run All Analyses',
        commands: [
          {
            commandName: 'runAIAnalysis',
            commandOptions: {
              analysisTypes: [
                'general_abnormality',
                'lung_nodule_detection',
                'chest_pathology',
                'cardiac_analysis',
              ],
            },
            context: 'AI_RADIOLOGY',
          },
        ],
      },
    ],
  };
}

export default toolbarModule;
