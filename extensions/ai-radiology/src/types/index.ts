/**
 * AI Radiology Extension Types
 * Defines all interfaces and types for the AI-powered radiology workflow
 */

// ============================================================================
// VLM API Types
// ============================================================================

/**
 * Supported VLM providers
 */
export type VLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'aws-bedrock'
  | 'custom';

/**
 * Configuration for VLM API connection
 */
export interface VLMConfig {
  provider: VLMProvider;
  apiKey?: string;
  apiEndpoint: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  headers?: Record<string, string>;
  /** Custom authentication function */
  getAuthHeaders?: () => Promise<Record<string, string>>;
}

/**
 * Image data for VLM analysis
 */
export interface VLMImageInput {
  /** Base64 encoded image data */
  base64Data: string;
  /** MIME type (e.g., 'image/png', 'image/jpeg') */
  mimeType: string;
  /** Original DICOM metadata */
  metadata?: DicomImageMetadata;
}

/**
 * Request to VLM for report generation
 */
export interface VLMReportRequest {
  images: VLMImageInput[];
  studyInfo: StudyInfo;
  prompt?: string;
  templateId?: string;
  previousReports?: string[];
  clinicalHistory?: string;
  /** Specific findings to focus on */
  focusAreas?: string[];
}

/**
 * VLM API response
 */
export interface VLMReportResponse {
  reportId: string;
  generatedAt: string;
  model: string;
  report: GeneratedReport;
  confidence: number;
  processingTimeMs: number;
  warnings?: string[];
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Structure of an AI-generated radiology report
 */
export interface GeneratedReport {
  /** Report sections following standard radiology format */
  sections: ReportSection[];
  /** Structured findings with codes */
  findings: Finding[];
  /** AI-suggested impressions */
  impressions: string[];
  /** Recommended follow-up actions */
  recommendations?: string[];
  /** Critical findings requiring immediate attention */
  criticalFindings?: CriticalFinding[];
  /** Raw text version */
  rawText: string;
}

/**
 * Report section (e.g., Technique, Comparison, Findings, Impression)
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  isEditable: boolean;
  aiGenerated: boolean;
  /** Confidence score 0-1 */
  confidence?: number;
}

/**
 * Structured finding with medical coding
 */
export interface Finding {
  id: string;
  description: string;
  location?: AnatomicalLocation;
  severity?: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  confidence: number;
  /** Reference to image/series */
  imageReference?: ImageReference;
  /** Medical codes (RadLex, SNOMED, ICD-10) */
  codes?: MedicalCode[];
  /** AI model that detected this */
  detectedBy?: string;
}

/**
 * Critical finding requiring immediate attention
 */
export interface CriticalFinding extends Finding {
  urgency: 'stat' | 'urgent' | 'routine';
  notificationRequired: boolean;
  notificationSentAt?: string;
}

/**
 * Anatomical location reference
 */
export interface AnatomicalLocation {
  region: string;
  laterality?: 'left' | 'right' | 'bilateral' | 'midline';
  /** RadLex code */
  radlexId?: string;
}

/**
 * Reference to a specific image or region
 */
export interface ImageReference {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID?: string;
  frameNumber?: number;
  /** Bounding box or ROI coordinates */
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Medical coding (RadLex, SNOMED-CT, ICD-10)
 */
export interface MedicalCode {
  system: 'radlex' | 'snomed-ct' | 'icd-10' | 'loinc';
  code: string;
  display: string;
}

// ============================================================================
// Study & Patient Types
// ============================================================================

/**
 * Study information for context
 */
export interface StudyInfo {
  studyInstanceUID: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  modality: string;
  accessionNumber?: string;
  referringPhysician?: string;
  institutionName?: string;
  patient: PatientInfo;
  seriesCount: number;
  instanceCount: number;
}

/**
 * Patient demographics
 */
export interface PatientInfo {
  patientId: string;
  patientName?: string;
  birthDate?: string;
  sex?: 'M' | 'F' | 'O';
  age?: string;
}

/**
 * DICOM image metadata
 */
export interface DicomImageMetadata {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  sopClassUID: string;
  modality: string;
  imageType?: string[];
  rows: number;
  columns: number;
  bitsAllocated: number;
  photometricInterpretation?: string;
  windowCenter?: number | number[];
  windowWidth?: number | number[];
  sliceLocation?: number;
  sliceThickness?: number;
  pixelSpacing?: [number, number];
}

// ============================================================================
// Report Workflow Types
// ============================================================================

/**
 * Report status in the workflow
 */
export type ReportStatus =
  | 'pending'
  | 'ai_generating'
  | 'ai_generated'
  | 'in_review'
  | 'approved'
  | 'amended'
  | 'final'
  | 'submitted';

/**
 * Report workflow state
 */
export interface ReportWorkflowState {
  reportId: string;
  status: ReportStatus;
  studyInstanceUID: string;
  createdAt: string;
  updatedAt: string;
  aiReport?: GeneratedReport;
  editedReport?: GeneratedReport;
  /** Radiologist who reviewed */
  reviewedBy?: string;
  reviewedAt?: string;
  /** Final approved report */
  finalReport?: GeneratedReport;
  approvedBy?: string;
  approvedAt?: string;
  /** Submission to RIS/PACS */
  submittedTo?: string;
  submittedAt?: string;
  /** Audit trail */
  history: ReportHistoryEntry[];
}

/**
 * Report history entry for audit trail
 */
export interface ReportHistoryEntry {
  timestamp: string;
  action: string;
  user?: string;
  details?: string;
  previousStatus?: ReportStatus;
  newStatus?: ReportStatus;
}

// ============================================================================
// AI Analysis Types
// ============================================================================

/**
 * AI analysis configuration
 */
export interface AIAnalysisConfig {
  /** Enable automatic analysis on study load */
  autoAnalyze: boolean;
  /** Analysis types to run */
  analysisTypes: AnalysisType[];
  /** Minimum confidence threshold */
  confidenceThreshold: number;
  /** Show AI overlays on images */
  showOverlays: boolean;
}

/**
 * Types of AI analysis available
 */
export type AnalysisType =
  | 'lung_nodule_detection'
  | 'chest_pathology'
  | 'brain_segmentation'
  | 'cardiac_analysis'
  | 'bone_age'
  | 'mammography_cad'
  | 'liver_lesion'
  | 'general_abnormality';

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  id: string;
  analysisType: AnalysisType;
  timestamp: string;
  model: string;
  modelVersion: string;
  processingTimeMs: number;
  findings: Finding[];
  segmentations?: Segmentation[];
  measurements?: Measurement[];
  heatmaps?: Heatmap[];
  overallConfidence: number;
}

/**
 * AI-generated segmentation
 */
export interface Segmentation {
  id: string;
  label: string;
  color: string;
  /** Encoded mask data */
  maskData: string;
  seriesInstanceUID: string;
  confidence: number;
}

/**
 * AI measurement
 */
export interface Measurement {
  id: string;
  type: 'length' | 'area' | 'volume' | 'diameter' | 'angle';
  value: number;
  unit: string;
  label: string;
  location: AnatomicalLocation;
  imageReference: ImageReference;
}

/**
 * AI heatmap/attention map
 */
export interface Heatmap {
  id: string;
  type: 'attention' | 'probability' | 'uncertainty';
  /** Base64 encoded heatmap image */
  data: string;
  colormap: string;
  opacity: number;
  seriesInstanceUID: string;
  sopInstanceUID: string;
}

// ============================================================================
// Report Template Types
// ============================================================================

/**
 * Report template for different modalities/procedures
 */
export interface ReportTemplate {
  id: string;
  name: string;
  modality: string[];
  bodyPart?: string[];
  sections: TemplateSectionConfig[];
  defaultPrompt: string;
  /** Macros for common phrases */
  macros?: ReportMacro[];
}

/**
 * Template section configuration
 */
export interface TemplateSectionConfig {
  id: string;
  title: string;
  required: boolean;
  defaultContent?: string;
  placeholder?: string;
  order: number;
}

/**
 * Report macro for quick text insertion
 */
export interface ReportMacro {
  id: string;
  shortcut: string;
  text: string;
  category: string;
}

// ============================================================================
// External System Integration Types
// ============================================================================

/**
 * Report submission target (RIS, PACS, EHR)
 */
export interface ReportSubmissionTarget {
  id: string;
  name: string;
  type: 'ris' | 'pacs' | 'ehr' | 'fhir' | 'hl7';
  endpoint: string;
  authType: 'none' | 'basic' | 'oauth2' | 'api-key';
  config: Record<string, unknown>;
}

/**
 * Report submission request
 */
export interface ReportSubmissionRequest {
  reportId: string;
  targetId: string;
  format: 'dicom-sr' | 'hl7-oru' | 'fhir' | 'pdf' | 'text';
  report: GeneratedReport;
  studyInfo: StudyInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Report submission response
 */
export interface ReportSubmissionResponse {
  success: boolean;
  submissionId?: string;
  timestamp: string;
  target: string;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Service Events
// ============================================================================

/**
 * Events emitted by AI services
 */
export const AI_EVENTS = {
  // VLM Service Events
  VLM_REPORT_STARTED: 'vlm:report:started',
  VLM_REPORT_PROGRESS: 'vlm:report:progress',
  VLM_REPORT_COMPLETED: 'vlm:report:completed',
  VLM_REPORT_ERROR: 'vlm:report:error',

  // Analysis Service Events
  ANALYSIS_STARTED: 'ai:analysis:started',
  ANALYSIS_PROGRESS: 'ai:analysis:progress',
  ANALYSIS_COMPLETED: 'ai:analysis:completed',
  ANALYSIS_ERROR: 'ai:analysis:error',

  // Report Workflow Events
  REPORT_STATUS_CHANGED: 'report:status:changed',
  REPORT_SAVED: 'report:saved',
  REPORT_APPROVED: 'report:approved',
  REPORT_SUBMITTED: 'report:submitted',

  // UI Events
  PANEL_ACTIVATED: 'ui:panel:activated',
  FINDINGS_SELECTED: 'ui:findings:selected',
} as const;

export type AIEventType = (typeof AI_EVENTS)[keyof typeof AI_EVENTS];
