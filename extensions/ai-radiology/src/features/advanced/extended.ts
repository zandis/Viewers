/**
 * Extended AI Features (Features 15-20)
 * Advanced capabilities for enterprise medical imaging
 */

import { PubSubService } from '@ohif/core';

// ============================================================================
// FEATURE 15: Teaching File Generator
// ============================================================================

export interface TeachingCase {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  modality: string;
  bodyPart: string;
  diagnosis: string;
  clinicalHistory: string;
  findings: Array<{
    description: string;
    location: string;
    keyImage?: string;
    annotations?: unknown[];
  }>;
  differentialDiagnosis: string[];
  discussionPoints: string[];
  references: Array<{ title: string; url?: string; citation?: string }>;
  keyImages: Array<{
    sopInstanceUID: string;
    description: string;
    annotations: unknown[];
  }>;
  metadata: {
    createdBy: string;
    createdAt: Date;
    institution?: string;
    tags: string[];
    viewCount: number;
    rating: number;
  };
}

export class TeachingFileService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'teachingFileService',
    create: (): TeachingFileService => new TeachingFileService(),
  };

  public static readonly EVENTS = {
    CASE_CREATED: 'event::teachingFile:caseCreated',
    CASE_UPDATED: 'event::teachingFile:caseUpdated',
    CASE_EXPORTED: 'event::teachingFile:caseExported',
    AI_SUGGESTION: 'event::teachingFile:aiSuggestion',
  };

  private cases: Map<string, TeachingCase> = new Map();
  private categories = [
    'Neuroradiology', 'Chest Imaging', 'Abdominal Imaging',
    'Musculoskeletal', 'Cardiovascular', 'Pediatric',
    'Emergency Radiology', 'Breast Imaging', 'Genitourinary'
  ];

  constructor() {
    super(TeachingFileService.EVENTS);
  }

  /**
   * Create teaching case from study
   */
  async createCase(
    studyData: {
      studyInstanceUID: string;
      patientAge?: number;
      patientSex?: string;
      modality: string;
      bodyPart: string;
      studyDescription: string;
      clinicalHistory?: string;
    },
    reportData?: {
      findings: string;
      impression: string;
    },
    selectedImages?: Array<{ sopInstanceUID: string; annotations?: unknown[] }>
  ): Promise<TeachingCase> {
    const caseId = `teaching-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // AI-assisted content generation
    const aiSuggestions = await this.generateAISuggestions(studyData, reportData);

    const teachingCase: TeachingCase = {
      id: caseId,
      title: aiSuggestions.suggestedTitle || `${studyData.modality} ${studyData.bodyPart} Case`,
      category: this.inferCategory(studyData.modality, studyData.bodyPart),
      difficulty: 'intermediate',
      modality: studyData.modality,
      bodyPart: studyData.bodyPart,
      diagnosis: aiSuggestions.suggestedDiagnosis || '',
      clinicalHistory: studyData.clinicalHistory || '',
      findings: aiSuggestions.suggestedFindings || [],
      differentialDiagnosis: aiSuggestions.differentials || [],
      discussionPoints: aiSuggestions.discussionPoints || [],
      references: [],
      keyImages: (selectedImages || []).map(img => ({
        sopInstanceUID: img.sopInstanceUID,
        description: '',
        annotations: img.annotations || [],
      })),
      metadata: {
        createdBy: 'current-user',
        createdAt: new Date(),
        tags: [studyData.modality, studyData.bodyPart],
        viewCount: 0,
        rating: 0,
      },
    };

    this.cases.set(caseId, teachingCase);
    this._broadcastEvent(TeachingFileService.EVENTS.CASE_CREATED, teachingCase);

    return teachingCase;
  }

  /**
   * Generate AI suggestions for teaching case
   */
  private async generateAISuggestions(
    studyData: Record<string, unknown>,
    reportData?: { findings: string; impression: string }
  ): Promise<{
    suggestedTitle: string;
    suggestedDiagnosis: string;
    suggestedFindings: TeachingCase['findings'];
    differentials: string[];
    discussionPoints: string[];
  }> {
    // AI-powered suggestion generation
    const suggestions = {
      suggestedTitle: '',
      suggestedDiagnosis: '',
      suggestedFindings: [] as TeachingCase['findings'],
      differentials: [] as string[],
      discussionPoints: [] as string[],
    };

    if (reportData?.impression) {
      suggestions.suggestedDiagnosis = reportData.impression.split('.')[0].trim();
      suggestions.suggestedTitle = `${studyData.modality}: ${suggestions.suggestedDiagnosis}`;
    }

    if (reportData?.findings) {
      const findingLines = reportData.findings.split('\n').filter(l => l.trim());
      suggestions.suggestedFindings = findingLines.map(f => ({
        description: f.trim(),
        location: '',
      }));
    }

    // Generate teaching points based on diagnosis
    if (suggestions.suggestedDiagnosis) {
      suggestions.discussionPoints = [
        `Key imaging features of ${suggestions.suggestedDiagnosis}`,
        'Differential considerations',
        'Clinical significance and management implications',
        'Pitfalls in diagnosis',
      ];
    }

    this._broadcastEvent(TeachingFileService.EVENTS.AI_SUGGESTION, suggestions);
    return suggestions;
  }

  private inferCategory(modality: string, bodyPart: string): string {
    const mapping: Record<string, string> = {
      'HEAD': 'Neuroradiology',
      'BRAIN': 'Neuroradiology',
      'CHEST': 'Chest Imaging',
      'ABDOMEN': 'Abdominal Imaging',
      'SPINE': 'Musculoskeletal',
      'KNEE': 'Musculoskeletal',
      'BREAST': 'Breast Imaging',
      'HEART': 'Cardiovascular',
    };
    return mapping[bodyPart.toUpperCase()] || 'General Radiology';
  }

  /**
   * Export case to MIRC Teaching File format
   */
  exportToMIRC(caseId: string): string {
    const teachingCase = this.cases.get(caseId);
    if (!teachingCase) return '';

    const mircXml = `<?xml version="1.0" encoding="UTF-8"?>
<MIRCdocument>
  <title>${this.escapeXml(teachingCase.title)}</title>
  <category>${this.escapeXml(teachingCase.category)}</category>
  <level>${teachingCase.difficulty}</level>
  <modality>${teachingCase.modality}</modality>
  <anatomy>${teachingCase.bodyPart}</anatomy>
  <diagnosis>${this.escapeXml(teachingCase.diagnosis)}</diagnosis>
  <history>${this.escapeXml(teachingCase.clinicalHistory)}</history>
  <findings>
    ${teachingCase.findings.map(f => `<finding>${this.escapeXml(f.description)}</finding>`).join('\n    ')}
  </findings>
  <differential>
    ${teachingCase.differentialDiagnosis.map(d => `<diagnosis>${this.escapeXml(d)}</diagnosis>`).join('\n    ')}
  </differential>
  <discussion>
    ${teachingCase.discussionPoints.map(p => `<point>${this.escapeXml(p)}</point>`).join('\n    ')}
  </discussion>
  <keywords>${teachingCase.metadata.tags.join(', ')}</keywords>
</MIRCdocument>`;

    this._broadcastEvent(TeachingFileService.EVENTS.CASE_EXPORTED, { caseId, format: 'MIRC' });
    return mircXml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Search teaching cases
   */
  searchCases(query: {
    text?: string;
    category?: string;
    modality?: string;
    difficulty?: string;
  }): TeachingCase[] {
    return Array.from(this.cases.values()).filter(c => {
      if (query.category && c.category !== query.category) return false;
      if (query.modality && c.modality !== query.modality) return false;
      if (query.difficulty && c.difficulty !== query.difficulty) return false;
      if (query.text) {
        const searchText = query.text.toLowerCase();
        return c.title.toLowerCase().includes(searchText) ||
               c.diagnosis.toLowerCase().includes(searchText) ||
               c.metadata.tags.some(t => t.toLowerCase().includes(searchText));
      }
      return true;
    });
  }

  getCase(caseId: string): TeachingCase | undefined {
    return this.cases.get(caseId);
  }

  getCategories(): string[] {
    return this.categories;
  }
}

// ============================================================================
// FEATURE 16: Speech-to-Structured Data
// ============================================================================

export interface StructuredField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'measurement';
  value: unknown;
  confidence: number;
  alternatives?: unknown[];
  source: 'speech' | 'inferred' | 'manual';
}

export interface StructuredDataTemplate {
  id: string;
  name: string;
  modality: string;
  bodyPart: string;
  fields: Array<{
    name: string;
    type: StructuredField['type'];
    required: boolean;
    options?: string[];
    unit?: string;
    triggers: string[]; // Speech triggers for this field
  }>;
}

export class SpeechToStructuredService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'speechToStructuredService',
    create: (): SpeechToStructuredService => new SpeechToStructuredService(),
  };

  public static readonly EVENTS = {
    FIELD_EXTRACTED: 'event::speechStructured:fieldExtracted',
    TEMPLATE_FILLED: 'event::speechStructured:templateFilled',
    CONFIRMATION_NEEDED: 'event::speechStructured:confirmationNeeded',
  };

  private templates: Map<string, StructuredDataTemplate> = new Map();

  constructor() {
    super(SpeechToStructuredService.EVENTS);
    this.initTemplates();
  }

  private initTemplates(): void {
    // CT Chest template
    this.templates.set('ct-chest', {
      id: 'ct-chest',
      name: 'CT Chest Structured Report',
      modality: 'CT',
      bodyPart: 'CHEST',
      fields: [
        {
          name: 'nodule_present',
          type: 'select',
          required: true,
          options: ['present', 'absent'],
          triggers: ['nodule', 'nodules', 'no nodule', 'nodule seen', 'no nodules'],
        },
        {
          name: 'nodule_size',
          type: 'measurement',
          required: false,
          unit: 'mm',
          triggers: ['measuring', 'measures', 'size', 'millimeter', 'centimeter'],
        },
        {
          name: 'nodule_location',
          type: 'select',
          required: false,
          options: ['RUL', 'RML', 'RLL', 'LUL', 'LLL'],
          triggers: ['right upper', 'right middle', 'right lower', 'left upper', 'left lower', 'lobe'],
        },
        {
          name: 'lung_rads',
          type: 'select',
          required: false,
          options: ['1', '2', '3', '4A', '4B', '4X'],
          triggers: ['lung rads', 'category'],
        },
        {
          name: 'pleural_effusion',
          type: 'select',
          required: true,
          options: ['none', 'small', 'moderate', 'large'],
          triggers: ['pleural effusion', 'effusion', 'no effusion'],
        },
        {
          name: 'lymphadenopathy',
          type: 'select',
          required: true,
          options: ['present', 'absent'],
          triggers: ['lymph node', 'lymphadenopathy', 'adenopathy', 'no adenopathy'],
        },
      ],
    });

    // MRI Brain template
    this.templates.set('mri-brain', {
      id: 'mri-brain',
      name: 'MRI Brain Structured Report',
      modality: 'MR',
      bodyPart: 'HEAD',
      fields: [
        {
          name: 'acute_stroke',
          type: 'select',
          required: true,
          options: ['present', 'absent'],
          triggers: ['acute stroke', 'acute infarct', 'diffusion restriction', 'no acute'],
        },
        {
          name: 'mass_lesion',
          type: 'select',
          required: true,
          options: ['present', 'absent'],
          triggers: ['mass', 'lesion', 'tumor', 'no mass'],
        },
        {
          name: 'mass_size',
          type: 'measurement',
          required: false,
          unit: 'cm',
          triggers: ['measuring', 'measures', 'size', 'dimension'],
        },
        {
          name: 'enhancement',
          type: 'select',
          required: false,
          options: ['none', 'mild', 'moderate', 'intense', 'ring'],
          triggers: ['enhancement', 'enhances', 'enhancing', 'no enhancement'],
        },
        {
          name: 'midline_shift',
          type: 'select',
          required: true,
          options: ['none', 'present'],
          triggers: ['midline', 'shift', 'no shift'],
        },
        {
          name: 'midline_shift_mm',
          type: 'measurement',
          required: false,
          unit: 'mm',
          triggers: ['millimeter shift', 'mm of shift'],
        },
      ],
    });
  }

  /**
   * Extract structured data from speech
   */
  extractFromSpeech(
    transcript: string,
    templateId: string
  ): Map<string, StructuredField> {
    const template = this.templates.get(templateId);
    if (!template) return new Map();

    const extracted = new Map<string, StructuredField>();
    const lowerTranscript = transcript.toLowerCase();

    for (const field of template.fields) {
      // Check if any trigger is present
      for (const trigger of field.triggers) {
        if (lowerTranscript.includes(trigger.toLowerCase())) {
          const value = this.extractFieldValue(lowerTranscript, field, trigger);
          if (value !== null) {
            extracted.set(field.name, {
              name: field.name,
              type: field.type,
              value,
              confidence: this.calculateConfidence(lowerTranscript, trigger, value),
              source: 'speech',
            });

            this._broadcastEvent(SpeechToStructuredService.EVENTS.FIELD_EXTRACTED, {
              fieldName: field.name,
              value,
              trigger,
            });
            break;
          }
        }
      }
    }

    return extracted;
  }

  private extractFieldValue(
    transcript: string,
    field: StructuredDataTemplate['fields'][0],
    trigger: string
  ): unknown {
    switch (field.type) {
      case 'select':
        // Look for positive/negative indicators
        const negativeIndicators = ['no ', 'absent', 'none', 'negative', 'without'];
        const isNegative = negativeIndicators.some(neg =>
          transcript.includes(neg + trigger) || transcript.includes(neg + ' ' + trigger)
        );

        if (field.options?.includes('absent') && isNegative) return 'absent';
        if (field.options?.includes('none') && isNegative) return 'none';
        if (field.options?.includes('present') && !isNegative) return 'present';

        // Try to match specific options
        for (const option of field.options || []) {
          if (transcript.includes(option.toLowerCase())) return option;
        }
        return field.options?.[0] || null;

      case 'measurement':
        // Extract number followed by unit
        const measurementPattern = /(\d+(?:\.\d+)?)\s*(?:mm|cm|millimeter|centimeter)/i;
        const match = transcript.match(measurementPattern);
        if (match) {
          let value = parseFloat(match[1]);
          if (match[0].toLowerCase().includes('cm') || match[0].toLowerCase().includes('centimeter')) {
            if (field.unit === 'mm') value *= 10;
          }
          return value;
        }
        return null;

      case 'text':
        // Extract text after trigger
        const triggerIndex = transcript.indexOf(trigger);
        if (triggerIndex >= 0) {
          const afterTrigger = transcript.slice(triggerIndex + trigger.length).trim();
          const endIndex = afterTrigger.search(/[.,;]/);
          return endIndex >= 0 ? afterTrigger.slice(0, endIndex).trim() : afterTrigger.split(' ').slice(0, 5).join(' ');
        }
        return null;

      default:
        return null;
    }
  }

  private calculateConfidence(transcript: string, trigger: string, value: unknown): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence for exact trigger match
    if (transcript.includes(trigger)) confidence += 0.1;

    // Increase confidence for clear value
    if (value !== null && value !== undefined) confidence += 0.1;

    // Increase confidence for explicit positive/negative language
    if (transcript.includes('definitely') || transcript.includes('clearly')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get template for study
   */
  getTemplate(modality: string, bodyPart: string): StructuredDataTemplate | null {
    for (const template of this.templates.values()) {
      if (template.modality === modality && template.bodyPart === bodyPart) {
        return template;
      }
    }
    return null;
  }

  /**
   * Validate extracted data against template
   */
  validateExtraction(
    extracted: Map<string, StructuredField>,
    templateId: string
  ): { valid: boolean; missing: string[]; lowConfidence: string[] } {
    const template = this.templates.get(templateId);
    if (!template) return { valid: false, missing: [], lowConfidence: [] };

    const missing: string[] = [];
    const lowConfidence: string[] = [];

    for (const field of template.fields) {
      const value = extracted.get(field.name);
      if (field.required && !value) {
        missing.push(field.name);
      } else if (value && value.confidence < 0.8) {
        lowConfidence.push(field.name);
      }
    }

    if (lowConfidence.length > 0) {
      this._broadcastEvent(SpeechToStructuredService.EVENTS.CONFIRMATION_NEEDED, {
        fields: lowConfidence,
      });
    }

    return {
      valid: missing.length === 0,
      missing,
      lowConfidence,
    };
  }

  addTemplate(template: StructuredDataTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplates(): StructuredDataTemplate[] {
    return Array.from(this.templates.values());
  }
}

// ============================================================================
// FEATURE 17: Second Opinion Network
// ============================================================================

export interface SecondOpinionRequest {
  id: string;
  studyInstanceUID: string;
  requestingRadiologist: string;
  requestingInstitution: string;
  urgency: 'routine' | 'urgent' | 'stat';
  clinicalQuestion: string;
  primaryInterpretation?: string;
  specialtyRequired: string;
  status: 'pending' | 'assigned' | 'in_review' | 'completed' | 'cancelled';
  createdAt: Date;
  assignedTo?: string;
  dueDate?: Date;
}

export interface SecondOpinionResponse {
  requestId: string;
  respondingRadiologist: string;
  respondingInstitution: string;
  agreement: 'agree' | 'partially_agree' | 'disagree';
  interpretation: string;
  additionalFindings?: string;
  recommendations?: string;
  confidence: 'high' | 'moderate' | 'low';
  completedAt: Date;
}

export class SecondOpinionNetworkService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'secondOpinionNetworkService',
    create: (): SecondOpinionNetworkService => new SecondOpinionNetworkService(),
  };

  public static readonly EVENTS = {
    REQUEST_CREATED: 'event::secondOpinion:requestCreated',
    REQUEST_ASSIGNED: 'event::secondOpinion:requestAssigned',
    RESPONSE_RECEIVED: 'event::secondOpinion:responseReceived',
    REQUEST_CANCELLED: 'event::secondOpinion:requestCancelled',
  };

  private requests: Map<string, SecondOpinionRequest> = new Map();
  private responses: Map<string, SecondOpinionResponse> = new Map();

  private specialties = [
    'Neuroradiology', 'Musculoskeletal Radiology', 'Cardiothoracic Radiology',
    'Abdominal Radiology', 'Breast Imaging', 'Pediatric Radiology',
    'Interventional Radiology', 'Nuclear Medicine', 'Emergency Radiology'
  ];

  constructor() {
    super(SecondOpinionNetworkService.EVENTS);
  }

  /**
   * Create second opinion request
   */
  createRequest(
    studyInstanceUID: string,
    requestingRadiologist: string,
    requestingInstitution: string,
    options: {
      urgency?: 'routine' | 'urgent' | 'stat';
      clinicalQuestion: string;
      primaryInterpretation?: string;
      specialtyRequired: string;
    }
  ): SecondOpinionRequest {
    const requestId = `2nd-opinion-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const request: SecondOpinionRequest = {
      id: requestId,
      studyInstanceUID,
      requestingRadiologist,
      requestingInstitution,
      urgency: options.urgency || 'routine',
      clinicalQuestion: options.clinicalQuestion,
      primaryInterpretation: options.primaryInterpretation,
      specialtyRequired: options.specialtyRequired,
      status: 'pending',
      createdAt: new Date(),
      dueDate: this.calculateDueDate(options.urgency || 'routine'),
    };

    this.requests.set(requestId, request);
    this._broadcastEvent(SecondOpinionNetworkService.EVENTS.REQUEST_CREATED, request);

    return request;
  }

  private calculateDueDate(urgency: string): Date {
    const dueDate = new Date();
    switch (urgency) {
      case 'stat':
        dueDate.setHours(dueDate.getHours() + 4);
        break;
      case 'urgent':
        dueDate.setHours(dueDate.getHours() + 24);
        break;
      default:
        dueDate.setDate(dueDate.getDate() + 3);
    }
    return dueDate;
  }

  /**
   * Assign request to reviewer
   */
  assignRequest(requestId: string, assignedTo: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') return false;

    request.assignedTo = assignedTo;
    request.status = 'assigned';

    this._broadcastEvent(SecondOpinionNetworkService.EVENTS.REQUEST_ASSIGNED, {
      requestId,
      assignedTo,
    });

    return true;
  }

  /**
   * Submit second opinion response
   */
  submitResponse(
    requestId: string,
    response: Omit<SecondOpinionResponse, 'requestId' | 'completedAt'>
  ): SecondOpinionResponse | null {
    const request = this.requests.get(requestId);
    if (!request || request.status === 'completed' || request.status === 'cancelled') {
      return null;
    }

    const fullResponse: SecondOpinionResponse = {
      ...response,
      requestId,
      completedAt: new Date(),
    };

    this.responses.set(requestId, fullResponse);
    request.status = 'completed';

    this._broadcastEvent(SecondOpinionNetworkService.EVENTS.RESPONSE_RECEIVED, fullResponse);

    return fullResponse;
  }

  /**
   * Cancel request
   */
  cancelRequest(requestId: string, reason: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status === 'completed') return false;

    request.status = 'cancelled';

    this._broadcastEvent(SecondOpinionNetworkService.EVENTS.REQUEST_CANCELLED, {
      requestId,
      reason,
    });

    return true;
  }

  /**
   * Get pending requests for a specialty
   */
  getPendingRequests(specialty?: string): SecondOpinionRequest[] {
    return Array.from(this.requests.values()).filter(r => {
      if (r.status !== 'pending') return false;
      if (specialty && r.specialtyRequired !== specialty) return false;
      return true;
    }).sort((a, b) => {
      // Sort by urgency then by date
      const urgencyOrder = { stat: 0, urgent: 1, routine: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  getRequest(requestId: string): SecondOpinionRequest | undefined {
    return this.requests.get(requestId);
  }

  getResponse(requestId: string): SecondOpinionResponse | undefined {
    return this.responses.get(requestId);
  }

  getSpecialties(): string[] {
    return this.specialties;
  }
}

// ============================================================================
// FEATURE 18: Lesion Tracking Service
// ============================================================================

export interface TrackedLesion {
  id: string;
  patientId: string;
  lesionType: string;
  location: string;
  measurements: Array<{
    date: Date;
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
    dimensions: {
      longAxis: number;
      shortAxis: number;
      volume?: number;
    };
    slice: number;
    annotations: unknown[];
  }>;
  status: 'new' | 'stable' | 'growing' | 'shrinking' | 'resolved';
  responseCriteria?: 'RECIST' | 'iRECIST' | 'mRECIST' | 'WHO';
  lastResponseCategory?: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LesionTrackingService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'lesionTrackingService',
    create: (): LesionTrackingService => new LesionTrackingService(),
  };

  public static readonly EVENTS = {
    LESION_CREATED: 'event::lesionTracking:lesionCreated',
    MEASUREMENT_ADDED: 'event::lesionTracking:measurementAdded',
    STATUS_CHANGED: 'event::lesionTracking:statusChanged',
    RESPONSE_CALCULATED: 'event::lesionTracking:responseCalculated',
  };

  private lesions: Map<string, TrackedLesion> = new Map();

  constructor() {
    super(LesionTrackingService.EVENTS);
  }

  /**
   * Create new tracked lesion
   */
  createLesion(
    patientId: string,
    initialMeasurement: {
      studyInstanceUID: string;
      seriesInstanceUID: string;
      sopInstanceUID: string;
      date: Date;
      dimensions: { longAxis: number; shortAxis: number; volume?: number };
      slice: number;
      annotations?: unknown[];
    },
    metadata: {
      lesionType: string;
      location: string;
      responseCriteria?: 'RECIST' | 'iRECIST' | 'mRECIST' | 'WHO';
      notes?: string;
    }
  ): TrackedLesion {
    const lesionId = `lesion-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const lesion: TrackedLesion = {
      id: lesionId,
      patientId,
      lesionType: metadata.lesionType,
      location: metadata.location,
      measurements: [{
        ...initialMeasurement,
        annotations: initialMeasurement.annotations || [],
      }],
      status: 'new',
      responseCriteria: metadata.responseCriteria,
      notes: metadata.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.lesions.set(lesionId, lesion);
    this._broadcastEvent(LesionTrackingService.EVENTS.LESION_CREATED, lesion);

    return lesion;
  }

  /**
   * Add measurement to existing lesion
   */
  addMeasurement(
    lesionId: string,
    measurement: {
      studyInstanceUID: string;
      seriesInstanceUID: string;
      sopInstanceUID: string;
      date: Date;
      dimensions: { longAxis: number; shortAxis: number; volume?: number };
      slice: number;
      annotations?: unknown[];
    }
  ): TrackedLesion | null {
    const lesion = this.lesions.get(lesionId);
    if (!lesion) return null;

    lesion.measurements.push({
      ...measurement,
      annotations: measurement.annotations || [],
    });

    // Sort measurements by date
    lesion.measurements.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Update status based on measurements
    lesion.status = this.calculateStatus(lesion);
    lesion.updatedAt = new Date();

    // Calculate response if criteria set
    if (lesion.responseCriteria) {
      lesion.lastResponseCategory = this.calculateResponse(lesion);
      this._broadcastEvent(LesionTrackingService.EVENTS.RESPONSE_CALCULATED, {
        lesionId,
        response: lesion.lastResponseCategory,
      });
    }

    this._broadcastEvent(LesionTrackingService.EVENTS.MEASUREMENT_ADDED, {
      lesionId,
      measurement,
      newStatus: lesion.status,
    });

    return lesion;
  }

  /**
   * Calculate lesion status based on measurements
   */
  private calculateStatus(lesion: TrackedLesion): TrackedLesion['status'] {
    if (lesion.measurements.length < 2) return 'new';

    const latest = lesion.measurements[lesion.measurements.length - 1];
    const baseline = lesion.measurements[0];

    const latestSize = latest.dimensions.longAxis;
    const baselineSize = baseline.dimensions.longAxis;

    const percentChange = ((latestSize - baselineSize) / baselineSize) * 100;

    if (latestSize < 5) return 'resolved'; // Too small to measure
    if (percentChange >= 20) return 'growing';
    if (percentChange <= -30) return 'shrinking';
    return 'stable';
  }

  /**
   * Calculate RECIST response
   */
  private calculateResponse(lesion: TrackedLesion): string {
    if (lesion.measurements.length < 2) return 'Not evaluable';

    const latest = lesion.measurements[lesion.measurements.length - 1];
    const baseline = lesion.measurements[0];
    const nadir = this.findNadir(lesion);

    const latestSize = latest.dimensions.longAxis;
    const baselineSize = baseline.dimensions.longAxis;
    const nadirSize = nadir.dimensions.longAxis;

    const changeFromBaseline = ((latestSize - baselineSize) / baselineSize) * 100;
    const changeFromNadir = ((latestSize - nadirSize) / nadirSize) * 100;

    switch (lesion.responseCriteria) {
      case 'RECIST':
      case 'iRECIST':
        if (latestSize < 5) return 'Complete Response (CR)';
        if (changeFromBaseline <= -30) return 'Partial Response (PR)';
        if (changeFromNadir >= 20 && (latestSize - nadirSize) >= 5) return 'Progressive Disease (PD)';
        return 'Stable Disease (SD)';

      case 'WHO':
        // WHO uses bidimensional (product of perpendicular diameters)
        const latestProduct = latest.dimensions.longAxis * latest.dimensions.shortAxis;
        const baselineProduct = baseline.dimensions.longAxis * baseline.dimensions.shortAxis;
        const productChange = ((latestProduct - baselineProduct) / baselineProduct) * 100;

        if (latestProduct === 0) return 'Complete Response (CR)';
        if (productChange <= -50) return 'Partial Response (PR)';
        if (productChange >= 25) return 'Progressive Disease (PD)';
        return 'Stable Disease (SD)';

      default:
        return 'Not evaluated';
    }
  }

  private findNadir(lesion: TrackedLesion): TrackedLesion['measurements'][0] {
    return lesion.measurements.reduce((min, m) =>
      m.dimensions.longAxis < min.dimensions.longAxis ? m : min
    );
  }

  /**
   * Get all lesions for a patient
   */
  getPatientLesions(patientId: string): TrackedLesion[] {
    return Array.from(this.lesions.values())
      .filter(l => l.patientId === patientId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Generate lesion summary report
   */
  generateSummary(patientId: string): string {
    const lesions = this.getPatientLesions(patientId);

    if (lesions.length === 0) return 'No tracked lesions for this patient.';

    let summary = `Lesion Tracking Summary (${lesions.length} lesions):\n\n`;

    for (const lesion of lesions) {
      const latest = lesion.measurements[lesion.measurements.length - 1];
      const baseline = lesion.measurements[0];

      summary += `${lesion.location} (${lesion.lesionType}):\n`;
      summary += `  Status: ${lesion.status}\n`;
      summary += `  Current: ${latest.dimensions.longAxis.toFixed(1)} mm`;
      if (lesion.measurements.length > 1) {
        summary += ` (baseline: ${baseline.dimensions.longAxis.toFixed(1)} mm)`;
      }
      summary += '\n';
      if (lesion.lastResponseCategory) {
        summary += `  Response (${lesion.responseCriteria}): ${lesion.lastResponseCategory}\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  getLesion(lesionId: string): TrackedLesion | undefined {
    return this.lesions.get(lesionId);
  }
}

// ============================================================================
// FEATURE 19: Clinical Decision Support (ACR Appropriateness Criteria)
// ============================================================================

export interface ClinicalScenario {
  id: string;
  title: string;
  category: string;
  clinicalCondition: string;
  variants: Array<{
    id: string;
    description: string;
    recommendations: Array<{
      procedure: string;
      rating: number; // 1-9 scale
      radiationLevel: 'none' | 'low' | 'medium' | 'high';
      contrast: 'none' | 'possible' | 'recommended';
      comments?: string;
    }>;
  }>;
  references: string[];
  lastUpdated: Date;
}

export interface CDSRecommendation {
  scenarioId: string;
  variantId: string;
  recommendations: Array<{
    procedure: string;
    appropriateness: 'usually_appropriate' | 'may_be_appropriate' | 'usually_not_appropriate';
    rating: number;
    radiation: string;
    contrast: string;
  }>;
  selectedProcedure?: string;
  decisionSupported: boolean;
}

export class ClinicalDecisionSupportService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'clinicalDecisionSupportService',
    create: (): ClinicalDecisionSupportService => new ClinicalDecisionSupportService(),
  };

  public static readonly EVENTS = {
    SCENARIO_MATCHED: 'event::cds:scenarioMatched',
    RECOMMENDATION_GENERATED: 'event::cds:recommendationGenerated',
    APPROPRIATENESS_CHECK: 'event::cds:appropriatenessCheck',
  };

  private scenarios: Map<string, ClinicalScenario> = new Map();

  constructor() {
    super(ClinicalDecisionSupportService.EVENTS);
    this.initACRCriteria();
  }

  private initACRCriteria(): void {
    // Sample ACR Appropriateness Criteria
    this.scenarios.set('headache', {
      id: 'headache',
      title: 'Headache',
      category: 'Neurologic',
      clinicalCondition: 'Headache',
      variants: [
        {
          id: 'headache-new-severe',
          description: 'New headache, worst of life, thunderclap',
          recommendations: [
            { procedure: 'CT Head without contrast', rating: 9, radiationLevel: 'medium', contrast: 'none', comments: 'Initial study of choice' },
            { procedure: 'CTA Head', rating: 9, radiationLevel: 'medium', contrast: 'recommended', comments: 'For aneurysm evaluation' },
            { procedure: 'MRI Head without contrast', rating: 8, radiationLevel: 'none', contrast: 'none' },
            { procedure: 'MRA Head without contrast', rating: 8, radiationLevel: 'none', contrast: 'none' },
            { procedure: 'Lumbar puncture', rating: 7, radiationLevel: 'none', contrast: 'none', comments: 'If imaging negative' },
          ],
        },
        {
          id: 'headache-chronic',
          description: 'Chronic headache, no red flags',
          recommendations: [
            { procedure: 'MRI Head without contrast', rating: 5, radiationLevel: 'none', contrast: 'none' },
            { procedure: 'CT Head without contrast', rating: 4, radiationLevel: 'medium', contrast: 'none' },
            { procedure: 'No imaging', rating: 7, radiationLevel: 'none', contrast: 'none', comments: 'May be appropriate to defer' },
          ],
        },
      ],
      references: ['ACR AC: Headache. J Am Coll Radiol. 2019'],
      lastUpdated: new Date('2023-01-01'),
    });

    this.scenarios.set('chest-pain', {
      id: 'chest-pain',
      title: 'Chest Pain',
      category: 'Cardiac',
      clinicalCondition: 'Acute Chest Pain',
      variants: [
        {
          id: 'chest-pain-low-risk',
          description: 'Low-risk chest pain, suspected ACS',
          recommendations: [
            { procedure: 'Coronary CTA', rating: 9, radiationLevel: 'medium', contrast: 'recommended' },
            { procedure: 'Stress echocardiography', rating: 8, radiationLevel: 'none', contrast: 'none' },
            { procedure: 'SPECT MPI', rating: 7, radiationLevel: 'medium', contrast: 'none' },
            { procedure: 'Stress CMR', rating: 7, radiationLevel: 'none', contrast: 'recommended' },
          ],
        },
        {
          id: 'chest-pain-pe-suspected',
          description: 'Chest pain with suspected pulmonary embolism',
          recommendations: [
            { procedure: 'CTA Chest', rating: 9, radiationLevel: 'medium', contrast: 'recommended' },
            { procedure: 'V/Q scan', rating: 7, radiationLevel: 'low', contrast: 'none' },
            { procedure: 'MRA Chest', rating: 5, radiationLevel: 'none', contrast: 'recommended' },
          ],
        },
      ],
      references: ['ACR AC: Acute Chest Pain. J Am Coll Radiol. 2022'],
      lastUpdated: new Date('2023-06-01'),
    });

    this.scenarios.set('low-back-pain', {
      id: 'low-back-pain',
      title: 'Low Back Pain',
      category: 'Musculoskeletal',
      clinicalCondition: 'Low Back Pain',
      variants: [
        {
          id: 'lbp-acute-no-red-flags',
          description: 'Acute low back pain, no red flags',
          recommendations: [
            { procedure: 'No imaging', rating: 9, radiationLevel: 'none', contrast: 'none', comments: 'Conservative management first' },
            { procedure: 'Radiographs Lumbar Spine', rating: 3, radiationLevel: 'low', contrast: 'none' },
            { procedure: 'MRI Lumbar Spine', rating: 2, radiationLevel: 'none', contrast: 'none' },
          ],
        },
        {
          id: 'lbp-red-flags',
          description: 'Low back pain with red flags (fever, weight loss, neuro deficit)',
          recommendations: [
            { procedure: 'MRI Lumbar Spine without contrast', rating: 9, radiationLevel: 'none', contrast: 'none' },
            { procedure: 'MRI Lumbar Spine with and without contrast', rating: 8, radiationLevel: 'none', contrast: 'recommended' },
            { procedure: 'CT Lumbar Spine without contrast', rating: 6, radiationLevel: 'medium', contrast: 'none' },
          ],
        },
      ],
      references: ['ACR AC: Low Back Pain. J Am Coll Radiol. 2021'],
      lastUpdated: new Date('2023-03-01'),
    });
  }

  /**
   * Find matching clinical scenario
   */
  findScenario(
    clinicalIndication: string,
    modality?: string
  ): ClinicalScenario[] {
    const lowerIndication = clinicalIndication.toLowerCase();
    const matches: ClinicalScenario[] = [];

    for (const scenario of this.scenarios.values()) {
      if (
        lowerIndication.includes(scenario.clinicalCondition.toLowerCase()) ||
        scenario.title.toLowerCase().includes(lowerIndication)
      ) {
        matches.push(scenario);
      }
    }

    if (matches.length > 0) {
      this._broadcastEvent(ClinicalDecisionSupportService.EVENTS.SCENARIO_MATCHED, {
        indication: clinicalIndication,
        matchCount: matches.length,
      });
    }

    return matches;
  }

  /**
   * Generate recommendation for a clinical scenario
   */
  generateRecommendation(
    scenarioId: string,
    variantId: string
  ): CDSRecommendation | null {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return null;

    const variant = scenario.variants.find(v => v.id === variantId);
    if (!variant) return null;

    const recommendation: CDSRecommendation = {
      scenarioId,
      variantId,
      recommendations: variant.recommendations.map(r => ({
        procedure: r.procedure,
        appropriateness: this.ratingToAppropriateness(r.rating),
        rating: r.rating,
        radiation: r.radiationLevel,
        contrast: r.contrast,
      })),
      decisionSupported: true,
    };

    this._broadcastEvent(ClinicalDecisionSupportService.EVENTS.RECOMMENDATION_GENERATED, recommendation);
    return recommendation;
  }

  private ratingToAppropriateness(rating: number): CDSRecommendation['recommendations'][0]['appropriateness'] {
    if (rating >= 7) return 'usually_appropriate';
    if (rating >= 4) return 'may_be_appropriate';
    return 'usually_not_appropriate';
  }

  /**
   * Check appropriateness of ordered study
   */
  checkAppropriateness(
    orderedProcedure: string,
    clinicalIndication: string
  ): {
    appropriate: boolean;
    rating?: number;
    alternatives?: string[];
    guidance?: string;
  } {
    const scenarios = this.findScenario(clinicalIndication);

    for (const scenario of scenarios) {
      for (const variant of scenario.variants) {
        const matchingRec = variant.recommendations.find(r =>
          orderedProcedure.toLowerCase().includes(r.procedure.toLowerCase()) ||
          r.procedure.toLowerCase().includes(orderedProcedure.toLowerCase())
        );

        if (matchingRec) {
          const appropriate = matchingRec.rating >= 7;
          const alternatives = variant.recommendations
            .filter(r => r.rating > matchingRec.rating)
            .map(r => r.procedure);

          const result = {
            appropriate,
            rating: matchingRec.rating,
            alternatives: appropriate ? [] : alternatives,
            guidance: matchingRec.comments,
          };

          this._broadcastEvent(ClinicalDecisionSupportService.EVENTS.APPROPRIATENESS_CHECK, {
            procedure: orderedProcedure,
            indication: clinicalIndication,
            ...result,
          });

          return result;
        }
      }
    }

    return { appropriate: true }; // Default to appropriate if no matching criteria
  }

  getScenario(scenarioId: string): ClinicalScenario | undefined {
    return this.scenarios.get(scenarioId);
  }

  getAllScenarios(): ClinicalScenario[] {
    return Array.from(this.scenarios.values());
  }
}

// ============================================================================
// FEATURE 20: Federated Learning Hub
// ============================================================================

export interface FederatedModel {
  id: string;
  name: string;
  version: string;
  task: string;
  architecture: string;
  inputShape: number[];
  outputShape: number[];
  metrics: {
    accuracy?: number;
    sensitivity?: number;
    specificity?: number;
    auc?: number;
  };
  participatingInstitutions: number;
  totalTrainingSamples: number;
  lastUpdated: Date;
}

export interface LocalTrainingResult {
  modelId: string;
  institutionId: string;
  epoch: number;
  loss: number;
  metrics: Record<string, number>;
  gradients?: ArrayBuffer;
  sampleCount: number;
  timestamp: Date;
}

export class FederatedLearningService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'federatedLearningService',
    create: (): FederatedLearningService => new FederatedLearningService(),
  };

  public static readonly EVENTS = {
    MODEL_REGISTERED: 'event::federated:modelRegistered',
    TRAINING_STARTED: 'event::federated:trainingStarted',
    TRAINING_PROGRESS: 'event::federated:trainingProgress',
    TRAINING_COMPLETED: 'event::federated:trainingCompleted',
    MODEL_UPDATED: 'event::federated:modelUpdated',
    AGGREGATION_COMPLETE: 'event::federated:aggregationComplete',
  };

  private models: Map<string, FederatedModel> = new Map();
  private trainingResults: Map<string, LocalTrainingResult[]> = new Map();
  private institutionId: string = '';

  constructor() {
    super(FederatedLearningService.EVENTS);
  }

  /**
   * Register institution for federated learning
   */
  registerInstitution(institutionId: string, institutionName: string): void {
    this.institutionId = institutionId;
    console.log(`Institution ${institutionName} registered for federated learning`);
  }

  /**
   * Register a model for federated training
   */
  registerModel(model: Omit<FederatedModel, 'participatingInstitutions' | 'totalTrainingSamples' | 'lastUpdated'>): FederatedModel {
    const fullModel: FederatedModel = {
      ...model,
      participatingInstitutions: 0,
      totalTrainingSamples: 0,
      lastUpdated: new Date(),
    };

    this.models.set(model.id, fullModel);
    this._broadcastEvent(FederatedLearningService.EVENTS.MODEL_REGISTERED, fullModel);

    return fullModel;
  }

  /**
   * Start local training round
   */
  async startLocalTraining(
    modelId: string,
    localData: Array<{ input: Float32Array; label: number }>,
    config: {
      epochs: number;
      batchSize: number;
      learningRate: number;
    }
  ): Promise<LocalTrainingResult> {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    this._broadcastEvent(FederatedLearningService.EVENTS.TRAINING_STARTED, {
      modelId,
      sampleCount: localData.length,
    });

    // Simulate local training
    let currentLoss = 1.0;
    const metrics: Record<string, number> = {};

    for (let epoch = 0; epoch < config.epochs; epoch++) {
      // Simulate training progress
      await new Promise(resolve => setTimeout(resolve, 100));

      currentLoss *= 0.9; // Simulate loss decrease
      metrics.accuracy = 0.7 + (epoch / config.epochs) * 0.2;

      this._broadcastEvent(FederatedLearningService.EVENTS.TRAINING_PROGRESS, {
        modelId,
        epoch: epoch + 1,
        totalEpochs: config.epochs,
        loss: currentLoss,
        metrics,
      });
    }

    const result: LocalTrainingResult = {
      modelId,
      institutionId: this.institutionId,
      epoch: config.epochs,
      loss: currentLoss,
      metrics,
      sampleCount: localData.length,
      timestamp: new Date(),
    };

    // Store result
    const results = this.trainingResults.get(modelId) || [];
    results.push(result);
    this.trainingResults.set(modelId, results);

    this._broadcastEvent(FederatedLearningService.EVENTS.TRAINING_COMPLETED, result);

    return result;
  }

  /**
   * Submit local model update for aggregation
   */
  async submitUpdate(
    modelId: string,
    gradients: ArrayBuffer,
    metrics: Record<string, number>
  ): Promise<boolean> {
    // In production, this would securely send gradients to aggregation server
    console.log(`Submitting update for model ${modelId}`);

    const model = this.models.get(modelId);
    if (model) {
      model.participatingInstitutions++;
      model.lastUpdated = new Date();
    }

    return true;
  }

  /**
   * Aggregate updates from all participants (server-side simulation)
   */
  async aggregateUpdates(modelId: string): Promise<FederatedModel | null> {
    const model = this.models.get(modelId);
    if (!model) return null;

    const results = this.trainingResults.get(modelId) || [];
    if (results.length === 0) return model;

    // Weighted average of metrics
    const totalSamples = results.reduce((sum, r) => sum + r.sampleCount, 0);

    const aggregatedMetrics: Record<string, number> = {};
    for (const result of results) {
      const weight = result.sampleCount / totalSamples;
      for (const [key, value] of Object.entries(result.metrics)) {
        aggregatedMetrics[key] = (aggregatedMetrics[key] || 0) + value * weight;
      }
    }

    model.metrics = aggregatedMetrics as FederatedModel['metrics'];
    model.totalTrainingSamples = totalSamples;
    model.lastUpdated = new Date();

    this._broadcastEvent(FederatedLearningService.EVENTS.AGGREGATION_COMPLETE, {
      modelId,
      participatingInstitutions: results.length,
      aggregatedMetrics,
    });

    return model;
  }

  /**
   * Get model status
   */
  getModelStatus(modelId: string): {
    model: FederatedModel | undefined;
    localResults: LocalTrainingResult[];
    isTraining: boolean;
  } {
    return {
      model: this.models.get(modelId),
      localResults: this.trainingResults.get(modelId) || [],
      isTraining: false, // Would track actual training status
    };
  }

  /**
   * Check differential privacy budget
   */
  checkPrivacyBudget(modelId: string): {
    epsilon: number;
    delta: number;
    remaining: number;
  } {
    // Simplified privacy budget tracking
    const results = this.trainingResults.get(modelId) || [];
    const usedBudget = results.length * 0.1; // Each round uses 0.1 epsilon

    return {
      epsilon: usedBudget,
      delta: 1e-5,
      remaining: Math.max(0, 10 - usedBudget), // Total budget of 10
    };
  }

  getAvailableModels(): FederatedModel[] {
    return Array.from(this.models.values());
  }

  getModel(modelId: string): FederatedModel | undefined {
    return this.models.get(modelId);
  }
}

// Export all extended features
export {
  TeachingFileService,
  SpeechToStructuredService,
  SecondOpinionNetworkService,
  LesionTrackingService,
  ClinicalDecisionSupportService,
  FederatedLearningService,
};
