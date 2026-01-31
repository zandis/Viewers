# AI Radiology Extension for OHIF Viewer

A comprehensive AI-powered radiology workflow extension that integrates Vision Language Models (VLM) for automated report generation, image analysis, and seamless integration with hospital systems (RIS/PACS/EHR).

## Features

### VLM Report Generation
- **Multi-provider support**: OpenAI GPT-4V, Anthropic Claude, Google Gemini, Azure OpenAI, AWS Bedrock
- **Structured reports**: Automatically generates reports with Technique, Comparison, Findings, and Impression sections
- **Confidence scoring**: AI provides confidence levels for each finding
- **Critical finding detection**: Automatic flagging of urgent findings

### Side-by-Side Workflow
- **Image + Report view**: View medical images alongside the AI-generated report
- **Interactive findings**: Click on findings to navigate to the relevant image location
- **Real-time editing**: Edit AI-generated text with full revision history

### AI Image Analysis
- **Abnormality detection**: General-purpose detection across modalities
- **Lung nodule detection**: Specialized for chest CT
- **Cardiac analysis**: CAC scoring and cardiac measurements
- **Segmentation**: AI-powered organ and lesion segmentation

### Report Submission
- **DICOM SR**: Native DICOM Structured Report format
- **HL7 ORU**: Standard HL7 v2.x message format
- **FHIR**: Modern FHIR DiagnosticReport resources
- **PDF/HTML**: Human-readable export formats

## Installation

```bash
# Add to your OHIF Viewer project
yarn add @ohif/extension-ai-radiology @ohif/mode-ai-radiology
```

## Configuration

Add to your `app-config.js`:

```javascript
window.config = {
  // ... other config

  aiRadiology: {
    // VLM Provider Configuration
    vlmProvider: 'openai', // 'openai' | 'anthropic' | 'google' | 'azure' | 'custom'
    vlmEndpoint: 'https://api.openai.com/v1/chat/completions',
    vlmApiKey: process.env.VLM_API_KEY, // Use environment variable
    vlmModel: 'gpt-4-vision-preview',
    vlmMaxTokens: 4096,
    vlmTemperature: 0.3,

    // AI Analysis Configuration
    autoAnalyze: false, // Auto-run analysis on study load
    analysisTypes: ['general_abnormality', 'lung_nodule_detection'],
    confidenceThreshold: 0.5,
    showOverlays: true,

    // Analysis Endpoints (if using separate AI services)
    analysisEndpoints: {
      lung_nodule_detection: 'https://your-ai-server/api/lung-nodule',
      chest_pathology: 'https://your-ai-server/api/chest',
      cardiac_analysis: 'https://your-ai-server/api/cardiac',
    },

    // Report Storage
    reportStorageBackend: 'localStorage', // 'localStorage' | 'server'

    // Report Submission Targets
    submissionTargets: [
      {
        id: 'hospital-ris',
        name: 'Hospital RIS',
        type: 'hl7',
        endpoint: 'https://ris.hospital.com/api/reports',
        authType: 'oauth2',
        config: {
          tokenEndpoint: 'https://auth.hospital.com/oauth/token',
          clientId: 'ohif-viewer',
          clientSecret: process.env.RIS_CLIENT_SECRET,
          scope: 'report.write',
        },
      },
      {
        id: 'pacs-server',
        name: 'PACS Server',
        type: 'pacs',
        endpoint: 'https://pacs.hospital.com/dcm4chee-arc/aets/DCM4CHEE/rs/studies',
        authType: 'basic',
        config: {
          username: 'ohif',
          password: process.env.PACS_PASSWORD,
        },
      },
      {
        id: 'fhir-server',
        name: 'FHIR Server',
        type: 'fhir',
        endpoint: 'https://fhir.hospital.com/DiagnosticReport',
        authType: 'api-key',
        config: {
          apiKeyHeader: 'X-API-Key',
          apiKey: process.env.FHIR_API_KEY,
        },
      },
    ],

    // Default submission format
    defaultSubmissionFormat: 'dicom-sr', // 'dicom-sr' | 'hl7-oru' | 'fhir' | 'pdf'
  },

  // Enable the AI Radiology mode
  modes: [
    '@ohif/mode-ai-radiology',
    // ... other modes
  ],

  extensions: [
    '@ohif/extension-ai-radiology',
    // ... other extensions
  ],
};
```

## Usage

### Accessing the AI Radiology Mode

1. Open a study in OHIF Viewer
2. Select "AI Radiology" mode from the mode selector
3. The AI Report panel will appear on the right side

### Generating an AI Report

1. Click the "AI Report" button in the toolbar
2. Wait for the VLM to analyze the images
3. Review and edit the generated report
4. Click "Approve" when satisfied

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Generate AI Report |
| `Ctrl+S` | Save Draft |
| `Ctrl+Shift+A` | Approve Report |
| `Ctrl+Shift+P` | Toggle AI Panel |
| `Ctrl+Shift+I` | Run AI Analysis |
| `1` | Lung Window (-600/1500) |
| `2` | Mediastinal Window (40/400) |
| `3` | Bone Window (400/2000) |

### Submitting Reports

1. Approve the report first
2. Click "Submit" button
3. Select target system (RIS/PACS/FHIR)
4. Choose export format
5. Confirm submission

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Radiology Extension                        │
├─────────────────────────────────────────────────────────────────┤
│  SERVICES                                                        │
│  ┌─────────────┐ ┌──────────────────┐ ┌─────────────────────┐   │
│  │ VLMService  │ │ReportWorkflowSvc │ │ReportSubmissionSvc  │   │
│  └─────────────┘ └──────────────────┘ └─────────────────────┘   │
│  ┌─────────────────┐                                             │
│  │AIAnalysisService│                                             │
│  └─────────────────┘                                             │
├─────────────────────────────────────────────────────────────────┤
│  PANELS                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               AIReportPanel                              │    │
│  │  ┌─────────────┐ ┌───────────────┐ ┌───────────────┐   │    │
│  │  │ReportEditor │ │FindingsList   │ │ActionButtons  │   │    │
│  │  └─────────────┘ └───────────────┘ └───────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  COMMANDS                                                        │
│  generateAIReport | runAIAnalysis | saveReportDraft             │
│  approveReport | submitReport | exportReport                     │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### VLMService

```typescript
// Generate report
const response = await vlmService.generateReport({
  images: [{ base64Data, mimeType, metadata }],
  studyInfo: { studyInstanceUID, modality, patient },
  prompt: 'Additional instructions',
  clinicalHistory: 'Patient history',
});

// Test connection
const result = await vlmService.testConnection();
```

### ReportWorkflowService

```typescript
// Create report workflow
const workflow = reportWorkflowService.createReport(studyInstanceUID);

// Update status
reportWorkflowService.updateStatus(studyInstanceUID, 'in_review', 'Dr. Smith');

// Approve report
reportWorkflowService.approveReport(studyInstanceUID, 'Dr. Smith', editedReport);

// Export
const html = reportWorkflowService.exportReport(studyInstanceUID, 'html');
```

### ReportSubmissionService

```typescript
// Register target
reportSubmissionService.registerTarget({
  id: 'hospital-ris',
  name: 'Hospital RIS',
  type: 'hl7',
  endpoint: 'https://ris.hospital.com/api',
  authType: 'oauth2',
  config: { ... },
});

// Submit report
const response = await reportSubmissionService.submitReport({
  reportId,
  targetId: 'hospital-ris',
  format: 'hl7-oru',
  report: finalReport,
  studyInfo,
});
```

## Security Considerations

1. **API Keys**: Never hardcode API keys. Use environment variables.
2. **HIPAA Compliance**: Ensure VLM providers are HIPAA-compliant (BAA required)
3. **Data Transmission**: Use HTTPS for all API communications
4. **Authentication**: Use OAuth2 or mTLS for production deployments
5. **Audit Logging**: Enable audit logging for all report actions

## Customization

### Custom VLM Provider

```typescript
vlmService.configure({
  provider: 'custom',
  apiEndpoint: 'https://your-vlm-api.com/generate',
  getAuthHeaders: async () => ({
    'Authorization': `Bearer ${await getCustomToken()}`,
    'X-Custom-Header': 'value',
  }),
});
```

### Custom Report Template

```typescript
const customTemplate = {
  id: 'chest-xray-template',
  name: 'Chest X-Ray Report',
  modality: ['CR', 'DX'],
  sections: [
    { id: 'technique', title: 'Technique', required: true },
    { id: 'comparison', title: 'Comparison', required: false },
    { id: 'cardiomediastinal', title: 'Cardiomediastinal', required: true },
    { id: 'lungs', title: 'Lungs', required: true },
    { id: 'bones', title: 'Bones', required: true },
    { id: 'impression', title: 'Impression', required: true },
  ],
  defaultPrompt: 'Analyze this chest radiograph...',
};
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: https://docs.ohif.org
- Community: https://community.ohif.org
