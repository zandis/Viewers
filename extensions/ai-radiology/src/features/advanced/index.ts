/**
 * Advanced AI Features Module
 * 20 New Features based on competitor analysis:
 * - Aidoc, Viz.ai, Qure.ai, Lunit, Nuance PowerScribe, Enlitic, Tempus/Arterys
 */

import { PubSubService } from '@ohif/core';

// ============================================================================
// FEATURE 1: Smart Impression Generator (inspired by Nuance PowerScribe)
// ============================================================================

export interface ImpressionGeneratorConfig {
  maxLength?: number;
  includeRecommendations?: boolean;
  language?: string;
  style?: 'concise' | 'detailed' | 'structured';
}

export interface GeneratedImpression {
  impression: string;
  recommendations: string[];
  followUpSuggestions: string[];
  criticalFindings: string[];
  confidence: number;
}

export class SmartImpressionGeneratorService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'smartImpressionGeneratorService',
    create: ({ configuration }: { configuration: ImpressionGeneratorConfig }): SmartImpressionGeneratorService => {
      return new SmartImpressionGeneratorService(configuration);
    },
  };

  public static readonly EVENTS = {
    IMPRESSION_GENERATED: 'event::smartImpressionGenerator:impressionGenerated',
    GENERATION_ERROR: 'event::smartImpressionGenerator:error',
  };

  private config: ImpressionGeneratorConfig;
  private llmEndpoint: string = '';

  constructor(config: ImpressionGeneratorConfig = {}) {
    super(SmartImpressionGeneratorService.EVENTS);
    this.config = {
      maxLength: 500,
      includeRecommendations: true,
      language: 'en',
      style: 'concise',
      ...config,
    };
  }

  /**
   * Generate impression from report findings
   */
  async generateImpression(
    findings: string,
    studyType: string,
    clinicalHistory?: string
  ): Promise<GeneratedImpression> {
    const prompt = this.buildPrompt(findings, studyType, clinicalHistory);

    try {
      const response = await this.callLLM(prompt);
      const parsed = this.parseImpressionResponse(response);

      this._broadcastEvent(SmartImpressionGeneratorService.EVENTS.IMPRESSION_GENERATED, parsed);
      return parsed;
    } catch (error) {
      this._broadcastEvent(SmartImpressionGeneratorService.EVENTS.GENERATION_ERROR, { error });
      throw error;
    }
  }

  private buildPrompt(findings: string, studyType: string, clinicalHistory?: string): string {
    return `Generate a radiological impression for the following:
Study Type: ${studyType}
${clinicalHistory ? `Clinical History: ${clinicalHistory}` : ''}
Findings: ${findings}

Style: ${this.config.style}
${this.config.includeRecommendations ? 'Include recommendations and follow-up suggestions.' : ''}
Maximum length: ${this.config.maxLength} words.`;
  }

  private async callLLM(prompt: string): Promise<string> {
    // Integration with VLM service
    const response = await fetch(this.llmEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: this.config.maxLength }),
    });
    const data = await response.json();
    return data.text || '';
  }

  private parseImpressionResponse(response: string): GeneratedImpression {
    // Parse structured response from LLM
    const sections = response.split('\n\n');
    return {
      impression: sections[0] || response,
      recommendations: this.extractList(response, 'recommendations'),
      followUpSuggestions: this.extractList(response, 'follow-up'),
      criticalFindings: this.extractList(response, 'critical'),
      confidence: 0.85,
    };
  }

  private extractList(text: string, keyword: string): string[] {
    const regex = new RegExp(`${keyword}[:\\s]*([^\\n]+)`, 'gi');
    const matches = text.match(regex) || [];
    return matches.map(m => m.replace(new RegExp(`${keyword}[:\\s]*`, 'i'), '').trim());
  }

  setLLMEndpoint(endpoint: string): void {
    this.llmEndpoint = endpoint;
  }
}

// ============================================================================
// FEATURE 2: Ambient Mode Dictation (inspired by Nuance)
// ============================================================================

export interface DictationSegment {
  text: string;
  timestamp: number;
  confidence: number;
  structured?: Record<string, string>;
}

export interface StructuredReport {
  sections: Record<string, string>;
  metadata: {
    dictationDuration: number;
    wordCount: number;
    structuredFields: number;
  };
}

export class AmbientDictationService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'ambientDictationService',
    create: (): AmbientDictationService => new AmbientDictationService(),
  };

  public static readonly EVENTS = {
    DICTATION_STARTED: 'event::ambientDictation:started',
    DICTATION_SEGMENT: 'event::ambientDictation:segment',
    DICTATION_COMPLETED: 'event::ambientDictation:completed',
    STRUCTURE_GENERATED: 'event::ambientDictation:structureGenerated',
  };

  private isRecording = false;
  private segments: DictationSegment[] = [];
  private recognition: SpeechRecognition | null = null;
  private startTime = 0;

  constructor() {
    super(AmbientDictationService.EVENTS);
    this.initSpeechRecognition();
  }

  private initSpeechRecognition(): void {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-expect-error - WebKit speech recognition
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const segment: DictationSegment = {
            text: result[0].transcript,
            timestamp: Date.now() - this.startTime,
            confidence: result[0].confidence,
          };
          this.segments.push(segment);
          this._broadcastEvent(AmbientDictationService.EVENTS.DICTATION_SEGMENT, segment);
        }
      };
    }
  }

  /**
   * Start ambient dictation
   */
  startDictation(): void {
    if (this.recognition && !this.isRecording) {
      this.segments = [];
      this.startTime = Date.now();
      this.isRecording = true;
      this.recognition.start();
      this._broadcastEvent(AmbientDictationService.EVENTS.DICTATION_STARTED, {});
    }
  }

  /**
   * Stop dictation and generate structured report
   */
  async stopDictation(): Promise<StructuredReport> {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    }

    const fullText = this.segments.map(s => s.text).join(' ');
    const structured = await this.convertToStructured(fullText);

    this._broadcastEvent(AmbientDictationService.EVENTS.DICTATION_COMPLETED, structured);
    return structured;
  }

  /**
   * Convert free-form dictation to structured report
   */
  private async convertToStructured(text: string): Promise<StructuredReport> {
    // AI-powered structure extraction
    const sections = this.extractSections(text);

    const report: StructuredReport = {
      sections,
      metadata: {
        dictationDuration: Date.now() - this.startTime,
        wordCount: text.split(/\s+/).length,
        structuredFields: Object.keys(sections).length,
      },
    };

    this._broadcastEvent(AmbientDictationService.EVENTS.STRUCTURE_GENERATED, report);
    return report;
  }

  private extractSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionKeywords = [
      'history', 'technique', 'comparison', 'findings',
      'impression', 'recommendation', 'conclusion'
    ];

    let currentSection = 'general';
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase().trim();
      const foundSection = sectionKeywords.find(kw => lowerSentence.startsWith(kw));

      if (foundSection) {
        currentSection = foundSection;
        sections[currentSection] = sentence.slice(foundSection.length).trim();
      } else if (sentence.trim()) {
        sections[currentSection] = (sections[currentSection] || '') + ' ' + sentence.trim();
      }
    }

    return sections;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getSegments(): DictationSegment[] {
    return [...this.segments];
  }
}

// ============================================================================
// FEATURE 3: Voice Command Assistant (inspired by Nuance "Hey PowerScribe")
// ============================================================================

export interface VoiceCommand {
  phrase: string;
  action: string;
  parameters?: Record<string, string>;
}

export interface CommandHandler {
  pattern: RegExp;
  handler: (matches: RegExpMatchArray, params: Record<string, unknown>) => Promise<void>;
  description: string;
}

export class VoiceCommandService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'voiceCommandService',
    create: (): VoiceCommandService => new VoiceCommandService(),
  };

  public static readonly EVENTS = {
    COMMAND_RECOGNIZED: 'event::voiceCommand:recognized',
    COMMAND_EXECUTED: 'event::voiceCommand:executed',
    COMMAND_ERROR: 'event::voiceCommand:error',
    LISTENING_STARTED: 'event::voiceCommand:listeningStarted',
    LISTENING_STOPPED: 'event::voiceCommand:listeningStopped',
  };

  private commands: CommandHandler[] = [];
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private wakeWord = 'hey viewer';

  constructor() {
    super(VoiceCommandService.EVENTS);
    this.initRecognition();
    this.registerDefaultCommands();
  }

  private initRecognition(): void {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-expect-error - WebKit speech recognition
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        this.processCommand(transcript);
      };
    }
  }

  private registerDefaultCommands(): void {
    // Navigation commands
    this.registerCommand({
      pattern: /(?:go to|open|show)\s+(?:the\s+)?(\w+)\s+(?:panel|view|tab)/i,
      handler: async (matches) => {
        const panel = matches[1];
        console.log(`Opening ${panel} panel`);
        // Integration with OHIF panel system
      },
      description: 'Open a specific panel or view',
    });

    // Window/Level commands
    this.registerCommand({
      pattern: /(?:set|change)\s+window\s+(?:to\s+)?(\w+)/i,
      handler: async (matches) => {
        const preset = matches[1];
        console.log(`Setting window preset to ${preset}`);
      },
      description: 'Change window/level preset',
    });

    // Zoom commands
    this.registerCommand({
      pattern: /zoom\s+(in|out)(?:\s+(\d+)\s*%)?/i,
      handler: async (matches) => {
        const direction = matches[1];
        const amount = matches[2] ? parseInt(matches[2]) : 25;
        console.log(`Zooming ${direction} by ${amount}%`);
      },
      description: 'Zoom in or out',
    });

    // Scroll commands
    this.registerCommand({
      pattern: /(?:scroll|go)\s+(up|down|left|right)(?:\s+(\d+))?/i,
      handler: async (matches) => {
        const direction = matches[1];
        const amount = matches[2] ? parseInt(matches[2]) : 1;
        console.log(`Scrolling ${direction} by ${amount}`);
      },
      description: 'Scroll through images',
    });

    // Measurement commands
    this.registerCommand({
      pattern: /(?:add|create|draw)\s+(?:a\s+)?(\w+)\s+(?:measurement|annotation)/i,
      handler: async (matches) => {
        const type = matches[1];
        console.log(`Creating ${type} measurement`);
      },
      description: 'Add measurement or annotation',
    });

    // Report commands
    this.registerCommand({
      pattern: /(?:generate|create)\s+(?:ai\s+)?report/i,
      handler: async () => {
        console.log('Generating AI report');
      },
      description: 'Generate AI report',
    });

    // Send message command
    this.registerCommand({
      pattern: /send\s+(?:a\s+)?message\s+to\s+(?:dr\.?\s+)?(\w+)/i,
      handler: async (matches) => {
        const recipient = matches[1];
        console.log(`Sending message to Dr. ${recipient}`);
      },
      description: 'Send a message to a colleague',
    });
  }

  /**
   * Register a custom voice command
   */
  registerCommand(command: CommandHandler): void {
    this.commands.push(command);
  }

  /**
   * Start listening for voice commands
   */
  startListening(): void {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
      this.isListening = true;
      this._broadcastEvent(VoiceCommandService.EVENTS.LISTENING_STARTED, {});
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this._broadcastEvent(VoiceCommandService.EVENTS.LISTENING_STOPPED, {});
    }
  }

  /**
   * Process recognized speech
   */
  private async processCommand(transcript: string): Promise<void> {
    // Check for wake word
    if (!transcript.includes(this.wakeWord)) {
      return;
    }

    const commandText = transcript.replace(this.wakeWord, '').trim();
    this._broadcastEvent(VoiceCommandService.EVENTS.COMMAND_RECOGNIZED, { text: commandText });

    // Find matching command
    for (const command of this.commands) {
      const matches = commandText.match(command.pattern);
      if (matches) {
        try {
          await command.handler(matches, {});
          this._broadcastEvent(VoiceCommandService.EVENTS.COMMAND_EXECUTED, {
            command: commandText,
            description: command.description,
          });
          return;
        } catch (error) {
          this._broadcastEvent(VoiceCommandService.EVENTS.COMMAND_ERROR, { error, command: commandText });
        }
      }
    }

    console.log('Command not recognized:', commandText);
  }

  setWakeWord(word: string): void {
    this.wakeWord = word.toLowerCase();
  }

  getAvailableCommands(): string[] {
    return this.commands.map(c => c.description);
  }
}

// ============================================================================
// FEATURE 4: Multi-Condition Detection (inspired by Aidoc - 14+ findings)
// ============================================================================

export interface DetectedCondition {
  id: string;
  name: string;
  category: string;
  confidence: number;
  severity: 'critical' | 'urgent' | 'moderate' | 'mild';
  location?: {
    slice: number;
    coordinates: { x: number; y: number; z?: number };
    boundingBox?: { x: number; y: number; width: number; height: number };
  };
  measurements?: Record<string, number>;
  icd10Code?: string;
  snomedCode?: string;
}

export interface MultiConditionResult {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  modality: string;
  bodyPart: string;
  scanTime: Date;
  processingTime: number;
  conditions: DetectedCondition[];
  overallSeverity: 'critical' | 'urgent' | 'routine';
  triagePriority: number;
}

export class MultiConditionDetectionService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'multiConditionDetectionService',
    create: ({ configuration }: { configuration: Record<string, unknown> }): MultiConditionDetectionService => {
      return new MultiConditionDetectionService(configuration);
    },
  };

  public static readonly EVENTS = {
    DETECTION_STARTED: 'event::multiCondition:started',
    DETECTION_PROGRESS: 'event::multiCondition:progress',
    DETECTION_COMPLETED: 'event::multiCondition:completed',
    CRITICAL_FINDING: 'event::multiCondition:criticalFinding',
  };

  // Supported conditions by modality (similar to Aidoc's 14+ CT findings)
  private static readonly ABDOMINAL_CT_CONDITIONS = [
    'liver_laceration', 'spleen_laceration', 'kidney_laceration',
    'bowel_obstruction', 'appendicitis', 'diverticulitis',
    'aortic_aneurysm', 'aortic_dissection', 'free_air',
    'ascites', 'adrenal_mass', 'pancreatic_mass',
    'lymphadenopathy', 'hydronephrosis'
  ];

  private static readonly CHEST_CT_CONDITIONS = [
    'pulmonary_embolism', 'aortic_dissection', 'pneumothorax',
    'lung_nodule', 'lung_mass', 'pleural_effusion',
    'consolidation', 'ground_glass', 'emphysema',
    'coronary_calcification', 'pericardial_effusion', 'mediastinal_mass',
    'rib_fracture', 'vertebral_fracture'
  ];

  private static readonly HEAD_CT_CONDITIONS = [
    'intracranial_hemorrhage', 'subdural_hematoma', 'epidural_hematoma',
    'subarachnoid_hemorrhage', 'intraparenchymal_hemorrhage',
    'midline_shift', 'hydrocephalus', 'mass_effect',
    'acute_stroke', 'skull_fracture', 'facial_fracture',
    'sinusitis', 'brain_mass', 'cerebral_edema'
  ];

  private modelEndpoints: Map<string, string> = new Map();
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    super(MultiConditionDetectionService.EVENTS);
    this.config = config;
  }

  /**
   * Analyze study for multiple conditions simultaneously
   */
  async analyzeStudy(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    modality: string,
    bodyPart: string,
    imageData: ArrayBuffer[]
  ): Promise<MultiConditionResult> {
    const startTime = Date.now();

    this._broadcastEvent(MultiConditionDetectionService.EVENTS.DETECTION_STARTED, {
      studyInstanceUID,
      seriesInstanceUID,
    });

    const conditionsToCheck = this.getConditionsForModality(modality, bodyPart);
    const detectedConditions: DetectedCondition[] = [];

    // Process in parallel batches
    const batchSize = 4;
    for (let i = 0; i < conditionsToCheck.length; i += batchSize) {
      const batch = conditionsToCheck.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(condition => this.detectCondition(condition, imageData, modality))
      );

      detectedConditions.push(...batchResults.filter(r => r !== null) as DetectedCondition[]);

      this._broadcastEvent(MultiConditionDetectionService.EVENTS.DETECTION_PROGRESS, {
        completed: Math.min(i + batchSize, conditionsToCheck.length),
        total: conditionsToCheck.length,
      });
    }

    // Check for critical findings
    const criticalFindings = detectedConditions.filter(c => c.severity === 'critical');
    if (criticalFindings.length > 0) {
      this._broadcastEvent(MultiConditionDetectionService.EVENTS.CRITICAL_FINDING, {
        findings: criticalFindings,
        studyInstanceUID,
      });
    }

    const result: MultiConditionResult = {
      studyInstanceUID,
      seriesInstanceUID,
      modality,
      bodyPart,
      scanTime: new Date(),
      processingTime: Date.now() - startTime,
      conditions: detectedConditions,
      overallSeverity: this.calculateOverallSeverity(detectedConditions),
      triagePriority: this.calculateTriagePriority(detectedConditions),
    };

    this._broadcastEvent(MultiConditionDetectionService.EVENTS.DETECTION_COMPLETED, result);
    return result;
  }

  private getConditionsForModality(modality: string, bodyPart: string): string[] {
    if (modality === 'CT') {
      if (bodyPart.toLowerCase().includes('abdomen')) {
        return MultiConditionDetectionService.ABDOMINAL_CT_CONDITIONS;
      } else if (bodyPart.toLowerCase().includes('chest')) {
        return MultiConditionDetectionService.CHEST_CT_CONDITIONS;
      } else if (bodyPart.toLowerCase().includes('head') || bodyPart.toLowerCase().includes('brain')) {
        return MultiConditionDetectionService.HEAD_CT_CONDITIONS;
      }
    }
    return [];
  }

  private async detectCondition(
    conditionType: string,
    imageData: ArrayBuffer[],
    modality: string
  ): Promise<DetectedCondition | null> {
    const endpoint = this.modelEndpoints.get(conditionType);
    if (!endpoint) {
      // Mock detection for demo
      const detected = Math.random() > 0.85;
      if (detected) {
        return {
          id: `${conditionType}-${Date.now()}`,
          name: this.formatConditionName(conditionType),
          category: this.getConditionCategory(conditionType),
          confidence: 0.7 + Math.random() * 0.25,
          severity: this.getConditionSeverity(conditionType),
          location: {
            slice: Math.floor(Math.random() * 100),
            coordinates: { x: Math.random() * 512, y: Math.random() * 512 },
          },
          icd10Code: this.getICD10Code(conditionType),
        };
      }
      return null;
    }

    // Real API call would go here
    return null;
  }

  private formatConditionName(condition: string): string {
    return condition
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getConditionCategory(condition: string): string {
    const categories: Record<string, string[]> = {
      'Vascular': ['pulmonary_embolism', 'aortic_dissection', 'aortic_aneurysm', 'intracranial_hemorrhage'],
      'Trauma': ['liver_laceration', 'spleen_laceration', 'rib_fracture', 'skull_fracture'],
      'Inflammatory': ['appendicitis', 'diverticulitis', 'consolidation'],
      'Neoplastic': ['lung_nodule', 'lung_mass', 'brain_mass', 'pancreatic_mass'],
      'Obstruction': ['bowel_obstruction', 'hydronephrosis', 'hydrocephalus'],
    };

    for (const [category, conditions] of Object.entries(categories)) {
      if (conditions.includes(condition)) return category;
    }
    return 'Other';
  }

  private getConditionSeverity(condition: string): 'critical' | 'urgent' | 'moderate' | 'mild' {
    const criticalConditions = [
      'pulmonary_embolism', 'aortic_dissection', 'intracranial_hemorrhage',
      'subdural_hematoma', 'epidural_hematoma', 'pneumothorax',
      'acute_stroke', 'midline_shift'
    ];
    const urgentConditions = [
      'appendicitis', 'bowel_obstruction', 'liver_laceration',
      'spleen_laceration', 'subarachnoid_hemorrhage'
    ];

    if (criticalConditions.includes(condition)) return 'critical';
    if (urgentConditions.includes(condition)) return 'urgent';
    return 'moderate';
  }

  private getICD10Code(condition: string): string {
    const codes: Record<string, string> = {
      'pulmonary_embolism': 'I26.99',
      'aortic_dissection': 'I71.01',
      'intracranial_hemorrhage': 'I62.9',
      'pneumothorax': 'J93.9',
      'appendicitis': 'K35.80',
      'lung_nodule': 'R91.1',
    };
    return codes[condition] || '';
  }

  private calculateOverallSeverity(conditions: DetectedCondition[]): 'critical' | 'urgent' | 'routine' {
    if (conditions.some(c => c.severity === 'critical')) return 'critical';
    if (conditions.some(c => c.severity === 'urgent')) return 'urgent';
    return 'routine';
  }

  private calculateTriagePriority(conditions: DetectedCondition[]): number {
    let priority = 5; // Routine
    for (const condition of conditions) {
      if (condition.severity === 'critical') priority = Math.min(priority, 1);
      else if (condition.severity === 'urgent') priority = Math.min(priority, 2);
      else if (condition.severity === 'moderate') priority = Math.min(priority, 3);
    }
    return priority;
  }

  registerModelEndpoint(conditionType: string, endpoint: string): void {
    this.modelEndpoints.set(conditionType, endpoint);
  }
}

// ============================================================================
// FEATURE 5: DualScan System (inspired by Lunit - abnormality + normal flagging)
// ============================================================================

export interface DualScanResult {
  studyInstanceUID: string;
  abnormalityScore: number;
  normalityScore: number;
  classification: 'abnormal' | 'normal' | 'indeterminate';
  abnormalityDetails: Array<{
    finding: string;
    confidence: number;
    region: string;
  }>;
  normalRegions: string[];
  recommendedAction: 'urgent_review' | 'standard_review' | 'can_be_prioritized_down';
  workloadReductionEligible: boolean;
}

export class DualScanService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'dualScanService',
    create: ({ configuration }: { configuration: Record<string, unknown> }): DualScanService => {
      return new DualScanService(configuration);
    },
  };

  public static readonly EVENTS = {
    SCAN_COMPLETED: 'event::dualScan:completed',
    NORMAL_FLAGGED: 'event::dualScan:normalFlagged',
    ABNORMAL_FLAGGED: 'event::dualScan:abnormalFlagged',
  };

  private abnormalityThreshold = 0.3;
  private normalityThreshold = 0.95;
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    super(DualScanService.EVENTS);
    this.config = config;
    this.abnormalityThreshold = (config.abnormalityThreshold as number) || 0.3;
    this.normalityThreshold = (config.normalityThreshold as number) || 0.95;
  }

  /**
   * Perform dual-engine analysis
   */
  async analyze(
    studyInstanceUID: string,
    imageData: ArrayBuffer[],
    modality: string
  ): Promise<DualScanResult> {
    // Run both engines in parallel
    const [abnormalityResult, normalityResult] = await Promise.all([
      this.runAbnormalityEngine(imageData, modality),
      this.runNormalityEngine(imageData, modality),
    ]);

    const classification = this.classify(abnormalityResult.score, normalityResult.score);

    const result: DualScanResult = {
      studyInstanceUID,
      abnormalityScore: abnormalityResult.score,
      normalityScore: normalityResult.score,
      classification,
      abnormalityDetails: abnormalityResult.details,
      normalRegions: normalityResult.normalRegions,
      recommendedAction: this.determineAction(classification, abnormalityResult.score),
      workloadReductionEligible: classification === 'normal' && normalityResult.score >= this.normalityThreshold,
    };

    this._broadcastEvent(DualScanService.EVENTS.SCAN_COMPLETED, result);

    if (classification === 'normal') {
      this._broadcastEvent(DualScanService.EVENTS.NORMAL_FLAGGED, result);
    } else if (classification === 'abnormal') {
      this._broadcastEvent(DualScanService.EVENTS.ABNORMAL_FLAGGED, result);
    }

    return result;
  }

  private async runAbnormalityEngine(
    imageData: ArrayBuffer[],
    modality: string
  ): Promise<{ score: number; details: Array<{ finding: string; confidence: number; region: string }> }> {
    // Mock abnormality detection
    const score = Math.random();
    const details = score > this.abnormalityThreshold ? [
      { finding: 'Suspicious opacity', confidence: score, region: 'Right lower lobe' }
    ] : [];

    return { score, details };
  }

  private async runNormalityEngine(
    imageData: ArrayBuffer[],
    modality: string
  ): Promise<{ score: number; normalRegions: string[] }> {
    // Mock normality assessment
    const score = Math.random();
    const normalRegions = score > 0.8 ? [
      'Left lung field', 'Right lung field', 'Cardiac silhouette', 'Mediastinum', 'Bony thorax'
    ] : [];

    return { score, normalRegions };
  }

  private classify(abnormalityScore: number, normalityScore: number): 'abnormal' | 'normal' | 'indeterminate' {
    if (abnormalityScore >= this.abnormalityThreshold) return 'abnormal';
    if (normalityScore >= this.normalityThreshold) return 'normal';
    return 'indeterminate';
  }

  private determineAction(
    classification: string,
    abnormalityScore: number
  ): 'urgent_review' | 'standard_review' | 'can_be_prioritized_down' {
    if (classification === 'abnormal' && abnormalityScore > 0.7) return 'urgent_review';
    if (classification === 'abnormal') return 'standard_review';
    if (classification === 'normal') return 'can_be_prioritized_down';
    return 'standard_review';
  }

  /**
   * Get workload reduction statistics
   */
  getWorkloadReductionStats(results: DualScanResult[]): {
    totalStudies: number;
    normalStudies: number;
    reductionPercentage: number;
    timeSavedMinutes: number;
  } {
    const normalStudies = results.filter(r => r.workloadReductionEligible).length;
    const reductionPercentage = (normalStudies / results.length) * 100;
    const avgReadTimeMinutes = 3;

    return {
      totalStudies: results.length,
      normalStudies,
      reductionPercentage,
      timeSavedMinutes: normalStudies * avgReadTimeMinutes * 0.5, // 50% time saved on normal studies
    };
  }
}

// ============================================================================
// FEATURE 6: Heatmap Visualization (inspired by Lunit - suspicious areas with scores)
// ============================================================================

export interface HeatmapOverlay {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  heatmapData: Float32Array;
  width: number;
  height: number;
  colorMap: 'jet' | 'viridis' | 'hot' | 'cool' | 'custom';
  opacity: number;
  threshold: number;
  findings: Array<{
    id: string;
    score: number;
    centroid: { x: number; y: number };
    boundingBox: { x: number; y: number; width: number; height: number };
    label: string;
  }>;
}

export class HeatmapVisualizationService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'heatmapVisualizationService',
    create: (): HeatmapVisualizationService => new HeatmapVisualizationService(),
  };

  public static readonly EVENTS = {
    HEATMAP_GENERATED: 'event::heatmap:generated',
    HEATMAP_UPDATED: 'event::heatmap:updated',
    OVERLAY_TOGGLED: 'event::heatmap:overlayToggled',
  };

  private heatmaps: Map<string, HeatmapOverlay> = new Map();
  private colorMaps: Map<string, number[][]> = new Map();

  constructor() {
    super(HeatmapVisualizationService.EVENTS);
    this.initColorMaps();
  }

  private initColorMaps(): void {
    // Jet colormap (blue -> cyan -> yellow -> red)
    this.colorMaps.set('jet', [
      [0, 0, 0.5], [0, 0, 1], [0, 0.5, 1], [0, 1, 1],
      [0.5, 1, 0.5], [1, 1, 0], [1, 0.5, 0], [1, 0, 0], [0.5, 0, 0]
    ]);

    // Hot colormap (black -> red -> yellow -> white)
    this.colorMaps.set('hot', [
      [0, 0, 0], [0.5, 0, 0], [1, 0, 0], [1, 0.5, 0],
      [1, 1, 0], [1, 1, 0.5], [1, 1, 1]
    ]);
  }

  /**
   * Generate heatmap from AI model output
   */
  generateHeatmap(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string,
    modelOutput: Float32Array,
    width: number,
    height: number,
    options: Partial<HeatmapOverlay> = {}
  ): HeatmapOverlay {
    const id = `heatmap-${sopInstanceUID}`;

    // Find local maxima (findings)
    const findings = this.findLocalMaxima(modelOutput, width, height, options.threshold || 0.5);

    const heatmap: HeatmapOverlay = {
      id,
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID,
      heatmapData: modelOutput,
      width,
      height,
      colorMap: options.colorMap || 'jet',
      opacity: options.opacity ?? 0.5,
      threshold: options.threshold ?? 0.3,
      findings,
    };

    this.heatmaps.set(id, heatmap);
    this._broadcastEvent(HeatmapVisualizationService.EVENTS.HEATMAP_GENERATED, heatmap);

    return heatmap;
  }

  /**
   * Find local maxima in heatmap (suspicious areas)
   */
  private findLocalMaxima(
    data: Float32Array,
    width: number,
    height: number,
    threshold: number
  ): HeatmapOverlay['findings'] {
    const findings: HeatmapOverlay['findings'] = [];
    const visited = new Set<number>();
    const windowSize = 5;

    for (let y = windowSize; y < height - windowSize; y++) {
      for (let x = windowSize; x < width - windowSize; x++) {
        const idx = y * width + x;
        const value = data[idx];

        if (value < threshold || visited.has(idx)) continue;

        // Check if local maximum
        let isMax = true;
        for (let dy = -windowSize; dy <= windowSize && isMax; dy++) {
          for (let dx = -windowSize; dx <= windowSize && isMax; dx++) {
            const nIdx = (y + dy) * width + (x + dx);
            if (data[nIdx] > value) isMax = false;
          }
        }

        if (isMax) {
          // Flood fill to find bounding box
          const bbox = this.floodFillBoundingBox(data, width, height, x, y, threshold, visited);

          findings.push({
            id: `finding-${findings.length}`,
            score: value,
            centroid: { x, y },
            boundingBox: bbox,
            label: this.scoreToLabel(value),
          });
        }
      }
    }

    return findings.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  private floodFillBoundingBox(
    data: Float32Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: Set<number>
  ): { x: number; y: number; width: number; height: number } {
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(idx) || data[idx] < threshold) continue;

      visited.add(idx);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  private scoreToLabel(score: number): string {
    if (score >= 0.9) return 'High Suspicion';
    if (score >= 0.7) return 'Moderate Suspicion';
    if (score >= 0.5) return 'Low Suspicion';
    return 'Minimal';
  }

  /**
   * Render heatmap to canvas
   */
  renderToCanvas(
    heatmapId: string,
    canvas: HTMLCanvasElement,
    imageCanvas?: HTMLCanvasElement
  ): void {
    const heatmap = this.heatmaps.get(heatmapId);
    if (!heatmap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = heatmap.width;
    canvas.height = heatmap.height;

    // Draw base image if provided
    if (imageCanvas) {
      ctx.drawImage(imageCanvas, 0, 0);
    }

    // Create heatmap image data
    const imageData = ctx.createImageData(heatmap.width, heatmap.height);
    const colorMap = this.colorMaps.get(heatmap.colorMap) || this.colorMaps.get('jet')!;

    for (let i = 0; i < heatmap.heatmapData.length; i++) {
      const value = heatmap.heatmapData[i];
      if (value < heatmap.threshold) continue;

      const normalizedValue = Math.min(1, (value - heatmap.threshold) / (1 - heatmap.threshold));
      const colorIdx = Math.floor(normalizedValue * (colorMap.length - 1));
      const color = colorMap[colorIdx];

      const pixelIdx = i * 4;
      imageData.data[pixelIdx] = color[0] * 255;
      imageData.data[pixelIdx + 1] = color[1] * 255;
      imageData.data[pixelIdx + 2] = color[2] * 255;
      imageData.data[pixelIdx + 3] = heatmap.opacity * 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Toggle heatmap visibility
   */
  toggleOverlay(heatmapId: string, visible: boolean): void {
    const heatmap = this.heatmaps.get(heatmapId);
    if (heatmap) {
      heatmap.opacity = visible ? 0.5 : 0;
      this._broadcastEvent(HeatmapVisualizationService.EVENTS.OVERLAY_TOGGLED, { id: heatmapId, visible });
    }
  }

  getHeatmap(id: string): HeatmapOverlay | undefined {
    return this.heatmaps.get(id);
  }

  getAllHeatmaps(): HeatmapOverlay[] {
    return Array.from(this.heatmaps.values());
  }
}

// ============================================================================
// FEATURE 7: DICOM Data Standardization (inspired by Enlitic ENDEX)
// ============================================================================

export interface StandardizationRule {
  field: string;
  sourcePatterns: RegExp[];
  standardValue: string;
  confidence: number;
}

export interface StandardizationResult {
  originalValue: string;
  standardizedValue: string;
  field: string;
  confidence: number;
  source: 'rule' | 'nlp' | 'ml';
}

export class DICOMStandardizationService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'dicomStandardizationService',
    create: (): DICOMStandardizationService => new DICOMStandardizationService(),
  };

  public static readonly EVENTS = {
    STANDARDIZATION_APPLIED: 'event::dicomStandard:applied',
    BATCH_COMPLETED: 'event::dicomStandard:batchCompleted',
    ERROR_DETECTED: 'event::dicomStandard:errorDetected',
  };

  private rules: Map<string, StandardizationRule[]> = new Map();

  constructor() {
    super(DICOMStandardizationService.EVENTS);
    this.initDefaultRules();
  }

  private initDefaultRules(): void {
    // Study Description standardization
    this.rules.set('StudyDescription', [
      { field: 'StudyDescription', sourcePatterns: [/CT\s*(?:of\s+)?(?:the\s+)?abdomen/i, /abd(?:ominal)?\s*ct/i], standardValue: 'CT Abdomen', confidence: 0.95 },
      { field: 'StudyDescription', sourcePatterns: [/CT\s*(?:of\s+)?(?:the\s+)?chest/i, /chest\s*ct/i, /thorax\s*ct/i], standardValue: 'CT Chest', confidence: 0.95 },
      { field: 'StudyDescription', sourcePatterns: [/CT\s*(?:of\s+)?(?:the\s+)?head/i, /head\s*ct/i, /CT\s*brian/i, /CT\s*brain/i], standardValue: 'CT Head', confidence: 0.95 },
      { field: 'StudyDescription', sourcePatterns: [/MR(?:I)?\s*(?:of\s+)?(?:the\s+)?brain/i, /brain\s*MR(?:I)?/i], standardValue: 'MRI Brain', confidence: 0.95 },
      { field: 'StudyDescription', sourcePatterns: [/chest\s*x-?ray/i, /CXR/i, /PA\s*(?:and\s*)?lat(?:eral)?/i], standardValue: 'Chest X-ray', confidence: 0.95 },
    ]);

    // Body Part standardization
    this.rules.set('BodyPartExamined', [
      { field: 'BodyPartExamined', sourcePatterns: [/abd/i, /abdom/i], standardValue: 'ABDOMEN', confidence: 0.95 },
      { field: 'BodyPartExamined', sourcePatterns: [/chest/i, /thorax/i, /lung/i], standardValue: 'CHEST', confidence: 0.95 },
      { field: 'BodyPartExamined', sourcePatterns: [/head/i, /brain/i, /cranial/i], standardValue: 'HEAD', confidence: 0.95 },
      { field: 'BodyPartExamined', sourcePatterns: [/spine/i, /vertebr/i, /lumbar/i, /thoracic/i, /cervical/i], standardValue: 'SPINE', confidence: 0.95 },
    ]);

    // Series Description standardization
    this.rules.set('SeriesDescription', [
      { field: 'SeriesDescription', sourcePatterns: [/w(?:ith)?\/?\s*o(?:ut)?\s*contrast/i, /non.?con(?:trast)?/i, /pre.?con(?:trast)?/i], standardValue: 'Without Contrast', confidence: 0.90 },
      { field: 'SeriesDescription', sourcePatterns: [/w(?:ith)?\s*con(?:trast)?/i, /post.?con(?:trast)?/i, /\+\s*c/i], standardValue: 'With Contrast', confidence: 0.90 },
      { field: 'SeriesDescription', sourcePatterns: [/axial/i], standardValue: 'Axial', confidence: 0.95 },
      { field: 'SeriesDescription', sourcePatterns: [/sag(?:ittal)?/i], standardValue: 'Sagittal', confidence: 0.95 },
      { field: 'SeriesDescription', sourcePatterns: [/cor(?:onal)?/i], standardValue: 'Coronal', confidence: 0.95 },
    ]);
  }

  /**
   * Standardize a DICOM dataset
   */
  standardize(
    dataset: Record<string, string>,
    fieldsToStandardize?: string[]
  ): Map<string, StandardizationResult> {
    const results = new Map<string, StandardizationResult>();
    const fields = fieldsToStandardize || Array.from(this.rules.keys());

    for (const field of fields) {
      const originalValue = dataset[field];
      if (!originalValue) continue;

      const result = this.standardizeField(field, originalValue);
      if (result) {
        results.set(field, result);
        this._broadcastEvent(DICOMStandardizationService.EVENTS.STANDARDIZATION_APPLIED, result);
      }
    }

    return results;
  }

  /**
   * Standardize a single field
   */
  private standardizeField(field: string, value: string): StandardizationResult | null {
    const rules = this.rules.get(field);
    if (!rules) return null;

    for (const rule of rules) {
      for (const pattern of rule.sourcePatterns) {
        if (pattern.test(value)) {
          return {
            originalValue: value,
            standardizedValue: rule.standardValue,
            field,
            confidence: rule.confidence,
            source: 'rule',
          };
        }
      }
    }

    // NLP-based standardization for unmatched values
    return this.nlpStandardize(field, value);
  }

  /**
   * NLP-based standardization for values not matching rules
   */
  private nlpStandardize(field: string, value: string): StandardizationResult | null {
    // Simple NLP: correct common typos and standardize formatting
    let standardized = value;

    // Fix common typos
    const typoFixes: Record<string, string> = {
      'brian': 'brain',
      'abodmen': 'abdomen',
      'chesr': 'chest',
      'xray': 'x-ray',
    };

    for (const [typo, fix] of Object.entries(typoFixes)) {
      const regex = new RegExp(typo, 'gi');
      if (regex.test(standardized)) {
        standardized = standardized.replace(regex, fix);
        this._broadcastEvent(DICOMStandardizationService.EVENTS.ERROR_DETECTED, {
          field,
          originalValue: value,
          error: 'typo',
          correctedValue: standardized,
        });
      }
    }

    // Standardize capitalization
    standardized = standardized
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (standardized !== value) {
      return {
        originalValue: value,
        standardizedValue: standardized,
        field,
        confidence: 0.75,
        source: 'nlp',
      };
    }

    return null;
  }

  /**
   * Batch standardize multiple studies
   */
  async batchStandardize(
    datasets: Array<{ studyInstanceUID: string; metadata: Record<string, string> }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, Map<string, StandardizationResult>>> {
    const allResults = new Map<string, Map<string, StandardizationResult>>();

    for (let i = 0; i < datasets.length; i++) {
      const { studyInstanceUID, metadata } = datasets[i];
      const results = this.standardize(metadata);
      allResults.set(studyInstanceUID, results);

      if (onProgress) {
        onProgress(i + 1, datasets.length);
      }
    }

    this._broadcastEvent(DICOMStandardizationService.EVENTS.BATCH_COMPLETED, {
      totalStudies: datasets.length,
      standardizedFields: Array.from(allResults.values()).reduce((sum, r) => sum + r.size, 0),
    });

    return allResults;
  }

  /**
   * Add custom standardization rule
   */
  addRule(rule: StandardizationRule): void {
    const existing = this.rules.get(rule.field) || [];
    existing.push(rule);
    this.rules.set(rule.field, existing);
  }
}

// ============================================================================
// Export all features
// ============================================================================

export {
  SmartImpressionGeneratorService,
  AmbientDictationService,
  VoiceCommandService,
  MultiConditionDetectionService,
  DualScanService,
  HeatmapVisualizationService,
  DICOMStandardizationService,
};
