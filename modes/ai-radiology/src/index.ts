import { Types } from '@ohif/core';

/**
 * AI Radiology Mode
 * Provides an AI-assisted radiology workflow with VLM report generation,
 * side-by-side image and report viewing, and external system integration
 */
const modeFactory: Types.ModeFactory = ({ modeConfiguration }) => {
  return {
    id: 'ai-radiology',
    routeName: 'ai-radiology',
    displayName: 'AI Radiology',

    /**
     * Validates if this mode can handle the given study
     */
    isValidMode: ({ modalities, study }) => {
      // Accept all imaging modalities
      const validModalities = ['CT', 'MR', 'CR', 'DX', 'XR', 'MG', 'US', 'PT', 'NM'];
      const studyModalities = modalities.split('\\');

      const isValid = studyModalities.some(modality =>
        validModalities.includes(modality)
      );

      return {
        valid: isValid,
        description: isValid
          ? 'AI-powered radiology workflow'
          : 'No supported imaging modalities found',
      };
    },

    /**
     * Routes configuration
     */
    routes: [
      {
        path: 'ai-radiology',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: 'ai-radiology-layout',
            props: {
              // Layout with study browser on left, viewports in center, AI report on right
              leftPanels: ['@ohif/extension-default.panelModule.seriesList'],
              rightPanels: ['@ohif/extension-ai-radiology.panelModule.ai-report-panel'],
              rightPanelDefaultClosed: false,
              viewports: [
                {
                  namespace: '@ohif/extension-cornerstone.viewportModule.cornerstone',
                  displaySetsToDisplay: ['@ohif/extension-default.sopClassHandlerModule.stack'],
                },
              ],
            },
          };
        },
      },
    ],

    /**
     * Required extensions
     */
    extensions: [
      '@ohif/extension-default',
      '@ohif/extension-cornerstone',
      '@ohif/extension-measurement-tracking',
      '@ohif/extension-ai-radiology',
    ],

    /**
     * Hanging protocols to use
     */
    hangingProtocol: [
      '@ohif/extension-ai-radiology.hangingProtocolModule.ai-radiology-standard',
      '@ohif/extension-ai-radiology.hangingProtocolModule.ai-report-side-by-side',
      '@ohif/extension-ai-radiology.hangingProtocolModule.ai-chest-ct-protocol',
      '@ohif/extension-default.hangingProtocolModule.default',
    ],

    /**
     * SOP Class handlers for display set creation
     */
    sopClassHandlers: [
      '@ohif/extension-default.sopClassHandlerModule.stack',
      '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr',
      '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
    ],

    /**
     * Hotkeys configuration
     */
    hotkeys: [
      // AI Report shortcuts
      {
        commandName: 'generateAIReport',
        label: 'Generate AI Report',
        keys: ['ctrl', 'shift', 'r'],
        context: 'AI_RADIOLOGY',
      },
      {
        commandName: 'saveReportDraft',
        label: 'Save Draft',
        keys: ['ctrl', 's'],
        context: 'AI_RADIOLOGY',
      },
      {
        commandName: 'approveReport',
        label: 'Approve Report',
        keys: ['ctrl', 'shift', 'a'],
        context: 'AI_RADIOLOGY',
      },
      {
        commandName: 'toggleAIReportPanel',
        label: 'Toggle AI Panel',
        keys: ['ctrl', 'shift', 'p'],
        context: 'AI_RADIOLOGY',
      },
      // AI Analysis shortcut
      {
        commandName: 'runAIAnalysis',
        label: 'Run AI Analysis',
        keys: ['ctrl', 'shift', 'i'],
        context: 'AI_RADIOLOGY',
      },
      // Standard navigation
      {
        commandName: 'incrementActiveViewport',
        label: 'Next Viewport',
        keys: ['right'],
        isEditable: true,
      },
      {
        commandName: 'decrementActiveViewport',
        label: 'Previous Viewport',
        keys: ['left'],
        isEditable: true,
      },
      // Window/Level presets for CT
      {
        commandName: 'setWindowLevel',
        label: 'Lung Window',
        keys: ['1'],
        commandOptions: { windowCenter: -600, windowWidth: 1500 },
      },
      {
        commandName: 'setWindowLevel',
        label: 'Mediastinal Window',
        keys: ['2'],
        commandOptions: { windowCenter: 40, windowWidth: 400 },
      },
      {
        commandName: 'setWindowLevel',
        label: 'Bone Window',
        keys: ['3'],
        commandOptions: { windowCenter: 400, windowWidth: 2000 },
      },
      // Standard viewer shortcuts
      {
        commandName: 'setToolActive',
        label: 'Zoom',
        keys: ['z'],
        commandOptions: { toolName: 'Zoom' },
      },
      {
        commandName: 'setToolActive',
        label: 'Pan',
        keys: ['p'],
        commandOptions: { toolName: 'Pan' },
      },
      {
        commandName: 'setToolActive',
        label: 'Window/Level',
        keys: ['w'],
        commandOptions: { toolName: 'WindowLevel' },
      },
      {
        commandName: 'resetViewport',
        label: 'Reset Viewport',
        keys: ['r'],
      },
    ],

    /**
     * Called when entering this mode
     */
    onModeEnter: ({ servicesManager, extensionManager, commandsManager }) => {
      const {
        toolbarService,
        toolGroupService,
        cornerstoneViewportService,
        panelService,
        measurementService,
      } = servicesManager.services;

      // Set up measurement service for findings
      measurementService.clearMeasurements();

      // Configure toolbar
      toolbarService.addButtons(getToolbarButtons());
      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'Capture',
        'Layout',
        'Crosshairs',
        'MoreTools',
      ]);
      toolbarService.createButtonSection('ai', [
        'AIReport',
        'AIAnalysis',
        'ExportReport',
        'SubmitReport',
      ]);

      // Open AI report panel by default
      panelService.addPanels('right', ['ai-report-panel']);

      // Set up tool groups
      const toolGroup = toolGroupService.createToolGroup('ai-radiology-default');

      // Add standard tools
      const tools = [
        { toolName: 'WindowLevel' },
        { toolName: 'Pan' },
        { toolName: 'Zoom' },
        { toolName: 'StackScrollMouseWheel' },
        { toolName: 'Length' },
        { toolName: 'Bidirectional' },
        { toolName: 'ArrowAnnotate' },
        { toolName: 'EllipticalROI' },
        { toolName: 'RectangleROI' },
      ];

      tools.forEach(({ toolName }) => {
        toolGroup.addTool(toolName);
      });

      // Set initial active tools
      toolGroup.setToolActive('WindowLevel', { bindings: [{ mouseButton: 1 }] });
      toolGroup.setToolActive('Pan', { bindings: [{ mouseButton: 2 }] });
      toolGroup.setToolActive('Zoom', { bindings: [{ mouseButton: 3 }] });
      toolGroup.setToolActive('StackScrollMouseWheel');

      // Register command context
      commandsManager.createContext('AI_RADIOLOGY');
    },

    /**
     * Called when exiting this mode
     */
    onModeExit: ({ servicesManager, extensionManager }) => {
      const {
        toolGroupService,
        toolbarService,
        measurementService,
        cineService,
        panelService,
      } = servicesManager.services;

      // Clean up
      cineService?.stopClip?.();
      toolGroupService.destroyToolGroup?.('ai-radiology-default');

      // Clear measurements
      measurementService.clearMeasurements?.();

      // Reset toolbar
      toolbarService.reset();

      // Remove AI panel
      panelService.removePanels?.('right', ['ai-report-panel']);
    },
  };
};

/**
 * Get toolbar buttons for AI Radiology mode
 */
function getToolbarButtons() {
  return [
    // Standard measurement tools (from measurement-tracking extension)
    {
      id: 'MeasurementTools',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'MeasurementTools',
        primary: {
          id: 'Length',
          icon: 'tool-length',
          label: 'Length',
          tooltip: 'Length Tool',
          commands: [
            {
              commandName: 'setToolActive',
              commandOptions: { toolName: 'Length' },
            },
          ],
        },
        secondary: {
          icon: 'chevron-down',
          items: [
            {
              id: 'Length',
              label: 'Length',
              icon: 'tool-length',
              commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'Length' } }],
            },
            {
              id: 'Bidirectional',
              label: 'Bidirectional',
              icon: 'tool-bidirectional',
              commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'Bidirectional' } }],
            },
            {
              id: 'EllipticalROI',
              label: 'Ellipse',
              icon: 'tool-ellipse',
              commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'EllipticalROI' } }],
            },
            {
              id: 'RectangleROI',
              label: 'Rectangle',
              icon: 'tool-rectangle',
              commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'RectangleROI' } }],
            },
            {
              id: 'ArrowAnnotate',
              label: 'Arrow',
              icon: 'tool-annotate',
              commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'ArrowAnnotate' } }],
            },
          ],
        },
      },
    },

    // Zoom tool
    {
      id: 'Zoom',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'tool-zoom',
        label: 'Zoom',
        commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'Zoom' } }],
      },
    },

    // Window/Level
    {
      id: 'WindowLevel',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'WindowLevel',
        primary: {
          id: 'WindowLevel',
          icon: 'tool-window-level',
          label: 'W/L',
          tooltip: 'Window/Level',
          commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'WindowLevel' } }],
        },
        secondary: {
          icon: 'chevron-down',
          items: [
            {
              id: 'LungWindow',
              label: 'Lung (-600/1500)',
              commands: [{ commandName: 'setWindowLevel', commandOptions: { windowCenter: -600, windowWidth: 1500 } }],
            },
            {
              id: 'MediastinalWindow',
              label: 'Mediastinal (40/400)',
              commands: [{ commandName: 'setWindowLevel', commandOptions: { windowCenter: 40, windowWidth: 400 } }],
            },
            {
              id: 'BoneWindow',
              label: 'Bone (400/2000)',
              commands: [{ commandName: 'setWindowLevel', commandOptions: { windowCenter: 400, windowWidth: 2000 } }],
            },
            {
              id: 'BrainWindow',
              label: 'Brain (40/80)',
              commands: [{ commandName: 'setWindowLevel', commandOptions: { windowCenter: 40, windowWidth: 80 } }],
            },
            {
              id: 'LiverWindow',
              label: 'Liver (60/150)',
              commands: [{ commandName: 'setWindowLevel', commandOptions: { windowCenter: 60, windowWidth: 150 } }],
            },
          ],
        },
      },
    },

    // Pan tool
    {
      id: 'Pan',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'tool-move',
        label: 'Pan',
        commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'Pan' } }],
      },
    },

    // AI Report button (from ai-radiology extension)
    {
      id: 'AIReport',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'AIReport',
        primary: {
          id: 'GenerateReport',
          icon: 'icon-clipboard-list',
          label: 'AI Report',
          tooltip: 'Generate AI Report',
          commands: [{ commandName: 'generateAIReport', context: 'AI_RADIOLOGY' }],
        },
        secondary: {
          icon: 'chevron-down',
          items: [
            {
              id: 'GenerateReport',
              label: 'Generate Report',
              icon: 'icon-clipboard-list',
              commands: [{ commandName: 'generateAIReport', context: 'AI_RADIOLOGY' }],
            },
            {
              id: 'SaveDraft',
              label: 'Save Draft',
              icon: 'icon-save',
              commands: [{ commandName: 'saveReportDraft', context: 'AI_RADIOLOGY' }],
            },
            {
              id: 'ApproveReport',
              label: 'Approve',
              icon: 'icon-check',
              commands: [{ commandName: 'approveReport', context: 'AI_RADIOLOGY' }],
            },
          ],
        },
      },
    },

    // AI Analysis button
    {
      id: 'AIAnalysis',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-tool-ai',
        label: 'Analyze',
        tooltip: 'Run AI Analysis',
        commands: [{ commandName: 'runAIAnalysis', context: 'AI_RADIOLOGY' }],
      },
    },

    // Export Report
    {
      id: 'ExportReport',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-download',
        label: 'Export',
        tooltip: 'Export Report',
        commands: [{ commandName: 'exportReport', context: 'AI_RADIOLOGY' }],
      },
    },

    // Submit Report
    {
      id: 'SubmitReport',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'icon-upload',
        label: 'Submit',
        tooltip: 'Submit to RIS/PACS',
        commands: [{ commandName: 'submitReport', context: 'AI_RADIOLOGY' }],
      },
    },

    // Layout selector
    {
      id: 'Layout',
      uiType: 'ohif.layoutSelector',
      props: {},
    },

    // Capture
    {
      id: 'Capture',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'tool-capture',
        label: 'Capture',
        commands: [{ commandName: 'showDownloadViewportModal' }],
      },
    },

    // Crosshairs (for MPR)
    {
      id: 'Crosshairs',
      uiType: 'ohif.radioGroup',
      props: {
        icon: 'tool-crosshair',
        label: 'Crosshairs',
        commands: [{ commandName: 'setToolActive', commandOptions: { toolName: 'Crosshairs' } }],
      },
    },

    // More tools dropdown
    {
      id: 'MoreTools',
      uiType: 'ohif.splitButton',
      props: {
        groupId: 'MoreTools',
        primary: {
          id: 'Reset',
          icon: 'tool-reset',
          label: 'Reset',
          tooltip: 'Reset Viewport',
          commands: [{ commandName: 'resetViewport' }],
        },
        secondary: {
          icon: 'chevron-down',
          items: [
            {
              id: 'Reset',
              label: 'Reset Viewport',
              icon: 'tool-reset',
              commands: [{ commandName: 'resetViewport' }],
            },
            {
              id: 'RotateRight',
              label: 'Rotate Right',
              icon: 'tool-rotate-right',
              commands: [{ commandName: 'rotateViewportCW' }],
            },
            {
              id: 'FlipH',
              label: 'Flip Horizontal',
              icon: 'tool-flip-horizontal',
              commands: [{ commandName: 'flipViewportHorizontal' }],
            },
            {
              id: 'FlipV',
              label: 'Flip Vertical',
              icon: 'tool-flip-vertical',
              commands: [{ commandName: 'flipViewportVertical' }],
            },
            {
              id: 'Invert',
              label: 'Invert',
              icon: 'tool-invert',
              commands: [{ commandName: 'invertViewport' }],
            },
            {
              id: 'Cine',
              label: 'Cine',
              icon: 'tool-cine',
              commands: [{ commandName: 'toggleCine' }],
            },
          ],
        },
      },
    },
  ];
}

const mode: Types.Mode = {
  id: 'ai-radiology',
  modeFactory,
  extensionDependencies: [
    '@ohif/extension-default',
    '@ohif/extension-cornerstone',
    '@ohif/extension-measurement-tracking',
    '@ohif/extension-ai-radiology',
  ],
};

export default mode;
