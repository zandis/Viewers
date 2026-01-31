/**
 * AI Radiology Configuration Example
 *
 * This configuration file demonstrates how to set up the AI Radiology
 * extension with VLM report generation, PACS integration, and
 * external system submission.
 *
 * Copy this file to your deployment and customize the settings.
 */
window.config = {
  routerBasename: '/',
  showStudyList: true,

  // Data Sources - PACS/DICOMweb connection
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Hospital PACS',
        name: 'DCM4CHEE',
        wadoUriRoot: 'https://pacs.hospital.com/dcm4chee-arc/aets/DCM4CHEE/wado',
        qidoRoot: 'https://pacs.hospital.com/dcm4chee-arc/aets/DCM4CHEE/rs',
        wadoRoot: 'https://pacs.hospital.com/dcm4chee-arc/aets/DCM4CHEE/rs',
        qidoSupportsIncludeField: true,
        supportsReject: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],

  defaultDataSourceName: 'dicomweb',

  // =========================================================================
  // AI RADIOLOGY CONFIGURATION
  // =========================================================================
  aiRadiology: {
    // -----------------------------------------------------------------------
    // VLM (Vision Language Model) Configuration
    // -----------------------------------------------------------------------

    // Provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'aws-bedrock' | 'custom'
    vlmProvider: 'openai',

    // API endpoint for the VLM service
    // OpenAI: https://api.openai.com/v1/chat/completions
    // Anthropic: https://api.anthropic.com/v1/messages
    // Azure: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions
    vlmEndpoint: 'https://api.openai.com/v1/chat/completions',

    // API key - IMPORTANT: Use environment variables in production!
    // Set via: window.config.aiRadiology.vlmApiKey = process.env.VLM_API_KEY
    vlmApiKey: '', // Set via environment variable

    // Model to use
    // OpenAI: 'gpt-4-vision-preview', 'gpt-4o'
    // Anthropic: 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'
    // Google: 'gemini-pro-vision'
    vlmModel: 'gpt-4o',

    // Maximum tokens for response
    vlmMaxTokens: 4096,

    // Temperature (0.0-1.0, lower = more focused, higher = more creative)
    vlmTemperature: 0.3,

    // Request timeout in milliseconds
    vlmTimeout: 120000,

    // -----------------------------------------------------------------------
    // AI Analysis Configuration
    // -----------------------------------------------------------------------

    // Automatically run AI analysis when a study is loaded
    autoAnalyze: false,

    // Types of analysis to run
    // Options: 'general_abnormality', 'lung_nodule_detection', 'chest_pathology',
    //          'cardiac_analysis', 'brain_segmentation', 'mammography_cad'
    analysisTypes: ['general_abnormality'],

    // Minimum confidence threshold to display findings (0.0-1.0)
    confidenceThreshold: 0.5,

    // Show AI overlays (heatmaps, segmentations) on images
    showOverlays: true,

    // External AI analysis endpoints (if using separate services)
    analysisEndpoints: {
      // lung_nodule_detection: 'https://ai-server.hospital.com/api/v1/lung-nodule',
      // chest_pathology: 'https://ai-server.hospital.com/api/v1/chest-pathology',
      // cardiac_analysis: 'https://ai-server.hospital.com/api/v1/cardiac',
    },

    // -----------------------------------------------------------------------
    // Report Storage Configuration
    // -----------------------------------------------------------------------

    // Where to store reports
    // 'localStorage': Browser local storage (development/demo)
    // 'server': Custom server endpoint (production)
    reportStorageBackend: 'localStorage',

    // Server storage endpoint (if using 'server' backend)
    // reportStorageEndpoint: 'https://reports.hospital.com/api/reports',

    // -----------------------------------------------------------------------
    // Report Submission Targets
    // -----------------------------------------------------------------------

    // Configure targets for report submission (RIS, PACS, EHR, FHIR)
    submissionTargets: [
      // Example: Hospital RIS via HL7
      {
        id: 'hospital-ris',
        name: 'Hospital RIS',
        type: 'ris',
        endpoint: 'https://ris.hospital.com/api/reports',
        authType: 'oauth2',
        config: {
          tokenEndpoint: 'https://auth.hospital.com/oauth/token',
          clientId: 'ohif-ai-radiology',
          clientSecret: '', // Set via environment variable
          scope: 'report.write',
        },
      },

      // Example: PACS Server via DICOM SR
      {
        id: 'pacs-dicom-sr',
        name: 'PACS (DICOM SR)',
        type: 'pacs',
        endpoint: 'https://pacs.hospital.com/dcm4chee-arc/aets/DCM4CHEE/rs/studies',
        authType: 'basic',
        config: {
          username: 'ohif-reporter',
          password: '', // Set via environment variable
        },
      },

      // Example: FHIR Server
      {
        id: 'fhir-server',
        name: 'FHIR Server',
        type: 'fhir',
        endpoint: 'https://fhir.hospital.com/DiagnosticReport',
        authType: 'api-key',
        config: {
          apiKeyHeader: 'X-API-Key',
          apiKey: '', // Set via environment variable
        },
      },
    ],

    // Default format for report submission
    // Options: 'dicom-sr', 'hl7-oru', 'fhir', 'pdf', 'text'
    defaultSubmissionFormat: 'dicom-sr',

    // Number of retry attempts for failed submissions
    submissionRetryAttempts: 3,

    // -----------------------------------------------------------------------
    // UI Customization
    // -----------------------------------------------------------------------

    // Show confidence scores in the report panel
    showConfidenceScores: true,

    // Enable clickable links from findings to images
    showFindingLinks: true,

    // Auto-save report drafts
    autoSave: true,

    // Auto-save interval in milliseconds
    autoSaveIntervalMs: 30000,

    // Require approval before submission
    requireApproval: true,

    // Show confirmation dialog before submission
    showSubmissionConfirmation: true,
  },

  // =========================================================================
  // MODE AND EXTENSION CONFIGURATION
  // =========================================================================

  // Default mode to load
  defaultMode: 'ai-radiology',

  // Available modes
  modes: [
    '@ohif/mode-ai-radiology',
    '@ohif/mode-longitudinal',
    '@ohif/mode-basic',
  ],

  // Extensions to load
  extensions: [
    '@ohif/extension-default',
    '@ohif/extension-cornerstone',
    '@ohif/extension-measurement-tracking',
    '@ohif/extension-cornerstone-dicom-sr',
    '@ohif/extension-cornerstone-dicom-seg',
    '@ohif/extension-ai-radiology',
  ],

  // =========================================================================
  // AUTHENTICATION (OIDC)
  // =========================================================================

  // Uncomment and configure for OIDC authentication
  // oidc: [
  //   {
  //     authority: 'https://auth.hospital.com/realms/radiology',
  //     client_id: 'ohif-viewer',
  //     redirect_uri: '/callback',
  //     response_type: 'code',
  //     scope: 'openid profile email',
  //     post_logout_redirect_uri: '/',
  //   },
  // ],

  // =========================================================================
  // CUSTOMIZATION
  // =========================================================================

  // White labeling
  whiteLabeling: {
    createLogoComponentFn: function(React) {
      return React.createElement('span', { style: { color: 'white', fontSize: '18px' } }, 'AI Radiology');
    },
  },

  // Hotkeys
  hotkeys: [
    // AI-specific hotkeys are defined in the mode
  ],
};

// =========================================================================
// ENVIRONMENT VARIABLE INJECTION
// =========================================================================
// In production, inject secrets from environment variables:
//
// if (typeof process !== 'undefined' && process.env) {
//   window.config.aiRadiology.vlmApiKey = process.env.VLM_API_KEY;
//   window.config.aiRadiology.submissionTargets[0].config.clientSecret = process.env.RIS_CLIENT_SECRET;
//   window.config.aiRadiology.submissionTargets[1].config.password = process.env.PACS_PASSWORD;
//   window.config.aiRadiology.submissionTargets[2].config.apiKey = process.env.FHIR_API_KEY;
// }
