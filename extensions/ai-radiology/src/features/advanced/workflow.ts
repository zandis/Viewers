/**
 * Advanced Workflow Features (Features 8-14)
 * Based on competitor analysis: Enlitic, Tempus/Arterys, and industry standards
 */

import { PubSubService } from '@ohif/core';

// ============================================================================
// FEATURE 8: Hanging Protocol Optimizer (inspired by Enlitic)
// ============================================================================

export interface HangingProtocolRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    modality?: string[];
    bodyPart?: string[];
    studyDescription?: RegExp;
    seriesCount?: { min?: number; max?: number };
    priorStudyAvailable?: boolean;
  };
  layout: {
    rows: number;
    columns: number;
    viewports: Array<{
      seriesSelector: string;
      orientation?: string;
      windowPreset?: string;
      colormap?: string;
    }>;
  };
}

export class HangingProtocolOptimizerService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'hangingProtocolOptimizerService',
    create: (): HangingProtocolOptimizerService => new HangingProtocolOptimizerService(),
  };

  public static readonly EVENTS = {
    PROTOCOL_SELECTED: 'event::hangingOptimizer:protocolSelected',
    PROTOCOL_APPLIED: 'event::hangingOptimizer:protocolApplied',
    LEARNING_UPDATE: 'event::hangingOptimizer:learningUpdate',
  };

  private protocols: HangingProtocolRule[] = [];
  private usageHistory: Map<string, { protocolId: string; accepted: boolean; timestamp: number }[]> = new Map();

  constructor() {
    super(HangingProtocolOptimizerService.EVENTS);
    this.initDefaultProtocols();
  }

  private initDefaultProtocols(): void {
    // CT Chest with/without contrast
    this.protocols.push({
      id: 'ct-chest-comparison',
      name: 'CT Chest Comparison',
      priority: 100,
      conditions: {
        modality: ['CT'],
        bodyPart: ['CHEST'],
        seriesCount: { min: 2 },
      },
      layout: {
        rows: 1,
        columns: 2,
        viewports: [
          { seriesSelector: 'contrast=false', orientation: 'axial', windowPreset: 'lung' },
          { seriesSelector: 'contrast=true', orientation: 'axial', windowPreset: 'mediastinum' },
        ],
      },
    });

    // MRI Brain with multiple sequences
    this.protocols.push({
      id: 'mri-brain-multisequence',
      name: 'MRI Brain Multi-sequence',
      priority: 90,
      conditions: {
        modality: ['MR'],
        bodyPart: ['HEAD', 'BRAIN'],
        seriesCount: { min: 4 },
      },
      layout: {
        rows: 2,
        columns: 2,
        viewports: [
          { seriesSelector: 'sequence=T1', orientation: 'axial' },
          { seriesSelector: 'sequence=T2', orientation: 'axial' },
          { seriesSelector: 'sequence=FLAIR', orientation: 'axial' },
          { seriesSelector: 'sequence=DWI', orientation: 'axial' },
        ],
      },
    });

    // Chest X-ray with prior
    this.protocols.push({
      id: 'cxr-comparison',
      name: 'Chest X-ray with Prior',
      priority: 85,
      conditions: {
        modality: ['CR', 'DX'],
        bodyPart: ['CHEST'],
        priorStudyAvailable: true,
      },
      layout: {
        rows: 1,
        columns: 2,
        viewports: [
          { seriesSelector: 'current', orientation: 'frontal' },
          { seriesSelector: 'prior', orientation: 'frontal' },
        ],
      },
    });

    // Mammography 4-up
    this.protocols.push({
      id: 'mammo-4up',
      name: 'Mammography 4-Up',
      priority: 95,
      conditions: {
        modality: ['MG'],
        bodyPart: ['BREAST'],
      },
      layout: {
        rows: 2,
        columns: 2,
        viewports: [
          { seriesSelector: 'view=MLO&laterality=R' },
          { seriesSelector: 'view=MLO&laterality=L' },
          { seriesSelector: 'view=CC&laterality=R' },
          { seriesSelector: 'view=CC&laterality=L' },
        ],
      },
    });
  }

  /**
   * Select optimal hanging protocol for a study
   */
  selectProtocol(
    studyMetadata: {
      modality: string;
      bodyPart: string;
      studyDescription: string;
      seriesCount: number;
      hasPrior: boolean;
    }
  ): HangingProtocolRule | null {
    const matchingProtocols = this.protocols.filter(protocol =>
      this.matchesConditions(protocol.conditions, studyMetadata)
    );

    if (matchingProtocols.length === 0) return null;

    // Sort by priority and learning score
    const scored = matchingProtocols.map(protocol => ({
      protocol,
      score: protocol.priority + this.getLearningScore(studyMetadata.modality, protocol.id),
    }));

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0].protocol;

    this._broadcastEvent(HangingProtocolOptimizerService.EVENTS.PROTOCOL_SELECTED, {
      protocolId: selected.id,
      protocolName: selected.name,
    });

    return selected;
  }

  private matchesConditions(
    conditions: HangingProtocolRule['conditions'],
    metadata: {
      modality: string;
      bodyPart: string;
      studyDescription: string;
      seriesCount: number;
      hasPrior: boolean;
    }
  ): boolean {
    if (conditions.modality && !conditions.modality.includes(metadata.modality)) return false;
    if (conditions.bodyPart && !conditions.bodyPart.includes(metadata.bodyPart)) return false;
    if (conditions.studyDescription && !conditions.studyDescription.test(metadata.studyDescription)) return false;
    if (conditions.seriesCount) {
      if (conditions.seriesCount.min && metadata.seriesCount < conditions.seriesCount.min) return false;
      if (conditions.seriesCount.max && metadata.seriesCount > conditions.seriesCount.max) return false;
    }
    if (conditions.priorStudyAvailable !== undefined && conditions.priorStudyAvailable !== metadata.hasPrior) return false;
    return true;
  }

  /**
   * Record user acceptance/rejection for learning
   */
  recordUsage(modality: string, protocolId: string, accepted: boolean): void {
    const key = modality;
    const history = this.usageHistory.get(key) || [];
    history.push({ protocolId, accepted, timestamp: Date.now() });

    // Keep only last 100 entries
    if (history.length > 100) history.shift();
    this.usageHistory.set(key, history);

    this._broadcastEvent(HangingProtocolOptimizerService.EVENTS.LEARNING_UPDATE, {
      modality,
      protocolId,
      accepted,
    });
  }

  private getLearningScore(modality: string, protocolId: string): number {
    const history = this.usageHistory.get(modality) || [];
    const protocolHistory = history.filter(h => h.protocolId === protocolId);

    if (protocolHistory.length === 0) return 0;

    const acceptanceRate = protocolHistory.filter(h => h.accepted).length / protocolHistory.length;
    return acceptanceRate * 20; // Max 20 points from learning
  }

  addProtocol(protocol: HangingProtocolRule): void {
    this.protocols.push(protocol);
  }

  getProtocols(): HangingProtocolRule[] {
    return [...this.protocols];
  }
}

// ============================================================================
// FEATURE 9: T1/T2 Map Generation (inspired by Tempus Pixel)
// ============================================================================

export interface TissueMap {
  id: string;
  type: 'T1' | 'T2' | 'T2*' | 'ADC';
  seriesInstanceUID: string;
  data: Float32Array;
  width: number;
  height: number;
  slices: number;
  unit: 'ms' | 'mm²/s';
  referenceRanges: {
    myocardium?: { min: number; max: number };
    bloodPool?: { min: number; max: number };
    liver?: { min: number; max: number };
  };
  statistics: {
    mean: number;
    std: number;
    min: number;
    max: number;
  };
}

export interface CardiacSegment {
  name: string;
  ahaSegment: number;
  value: number;
  status: 'normal' | 'elevated' | 'reduced';
}

export class TissueMapService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'tissueMapService',
    create: (): TissueMapService => new TissueMapService(),
  };

  public static readonly EVENTS = {
    MAP_GENERATED: 'event::tissueMap:generated',
    ANALYSIS_COMPLETE: 'event::tissueMap:analysisComplete',
    ABNORMALITY_DETECTED: 'event::tissueMap:abnormalityDetected',
  };

  // Reference ranges for cardiac MRI (1.5T)
  private static readonly T1_REFERENCE = {
    myocardium: { min: 950, max: 1050 }, // Native T1 in ms
    bloodPool: { min: 1500, max: 1700 },
  };

  private static readonly T2_REFERENCE = {
    myocardium: { min: 45, max: 55 }, // T2 in ms
  };

  private maps: Map<string, TissueMap> = new Map();

  constructor() {
    super(TissueMapService.EVENTS);
  }

  /**
   * Generate T1 map from multi-TI/TR images
   */
  async generateT1Map(
    images: Array<{ data: Float32Array; TI: number }>,
    width: number,
    height: number
  ): Promise<TissueMap> {
    const t1Data = new Float32Array(width * height);

    // Fit T1 relaxation curve for each pixel
    for (let i = 0; i < width * height; i++) {
      const signals = images.map(img => ({ TI: img.TI, signal: img.data[i] }));
      t1Data[i] = this.fitT1Recovery(signals);
    }

    const map: TissueMap = {
      id: `t1-map-${Date.now()}`,
      type: 'T1',
      seriesInstanceUID: `generated-${Date.now()}`,
      data: t1Data,
      width,
      height,
      slices: 1,
      unit: 'ms',
      referenceRanges: TissueMapService.T1_REFERENCE,
      statistics: this.calculateStatistics(t1Data),
    };

    this.maps.set(map.id, map);
    this._broadcastEvent(TissueMapService.EVENTS.MAP_GENERATED, map);

    return map;
  }

  /**
   * Generate T2 map from multi-TE images
   */
  async generateT2Map(
    images: Array<{ data: Float32Array; TE: number }>,
    width: number,
    height: number
  ): Promise<TissueMap> {
    const t2Data = new Float32Array(width * height);

    // Fit T2 decay curve for each pixel
    for (let i = 0; i < width * height; i++) {
      const signals = images.map(img => ({ TE: img.TE, signal: img.data[i] }));
      t2Data[i] = this.fitT2Decay(signals);
    }

    const map: TissueMap = {
      id: `t2-map-${Date.now()}`,
      type: 'T2',
      seriesInstanceUID: `generated-${Date.now()}`,
      data: t2Data,
      width,
      height,
      slices: 1,
      unit: 'ms',
      referenceRanges: TissueMapService.T2_REFERENCE,
      statistics: this.calculateStatistics(t2Data),
    };

    this.maps.set(map.id, map);
    this._broadcastEvent(TissueMapService.EVENTS.MAP_GENERATED, map);

    return map;
  }

  /**
   * Fit T1 recovery curve: S(TI) = S0 * (1 - 2*exp(-TI/T1))
   */
  private fitT1Recovery(signals: Array<{ TI: number; signal: number }>): number {
    // Simplified least squares fitting
    // In production, use proper non-linear least squares (Levenberg-Marquardt)
    let bestT1 = 1000;
    let bestError = Infinity;

    for (let t1 = 500; t1 <= 2000; t1 += 10) {
      let error = 0;
      const S0 = Math.max(...signals.map(s => Math.abs(s.signal)));

      for (const { TI, signal } of signals) {
        const predicted = S0 * Math.abs(1 - 2 * Math.exp(-TI / t1));
        error += (signal - predicted) ** 2;
      }

      if (error < bestError) {
        bestError = error;
        bestT1 = t1;
      }
    }

    return bestT1;
  }

  /**
   * Fit T2 decay curve: S(TE) = S0 * exp(-TE/T2)
   */
  private fitT2Decay(signals: Array<{ TE: number; signal: number }>): number {
    // Linear regression in log space: ln(S) = ln(S0) - TE/T2
    const n = signals.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (const { TE, signal } of signals) {
      if (signal <= 0) continue;
      const logS = Math.log(signal);
      sumX += TE;
      sumY += logS;
      sumXY += TE * logS;
      sumX2 += TE * TE;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return -1 / slope;
  }

  /**
   * Analyze cardiac segments (AHA 17-segment model)
   */
  analyzeCardiacSegments(
    map: TissueMap,
    segmentation: Uint8Array
  ): CardiacSegment[] {
    const segments: CardiacSegment[] = [];
    const segmentNames = [
      'Basal Anterior', 'Basal Anteroseptal', 'Basal Inferoseptal',
      'Basal Inferior', 'Basal Inferolateral', 'Basal Anterolateral',
      'Mid Anterior', 'Mid Anteroseptal', 'Mid Inferoseptal',
      'Mid Inferior', 'Mid Inferolateral', 'Mid Anterolateral',
      'Apical Anterior', 'Apical Septal', 'Apical Inferior', 'Apical Lateral',
      'Apex'
    ];

    const referenceRange = map.type === 'T1'
      ? TissueMapService.T1_REFERENCE.myocardium
      : TissueMapService.T2_REFERENCE.myocardium;

    for (let seg = 1; seg <= 17; seg++) {
      const segmentValues: number[] = [];

      for (let i = 0; i < segmentation.length; i++) {
        if (segmentation[i] === seg) {
          segmentValues.push(map.data[i]);
        }
      }

      if (segmentValues.length === 0) continue;

      const mean = segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length;
      let status: 'normal' | 'elevated' | 'reduced' = 'normal';

      if (referenceRange) {
        if (mean > referenceRange.max) status = 'elevated';
        else if (mean < referenceRange.min) status = 'reduced';
      }

      segments.push({
        name: segmentNames[seg - 1],
        ahaSegment: seg,
        value: Math.round(mean),
        status,
      });
    }

    // Detect abnormalities
    const abnormalSegments = segments.filter(s => s.status !== 'normal');
    if (abnormalSegments.length > 0) {
      this._broadcastEvent(TissueMapService.EVENTS.ABNORMALITY_DETECTED, {
        mapId: map.id,
        abnormalSegments,
      });
    }

    this._broadcastEvent(TissueMapService.EVENTS.ANALYSIS_COMPLETE, { mapId: map.id, segments });
    return segments;
  }

  private calculateStatistics(data: Float32Array): { mean: number; std: number; min: number; max: number } {
    let sum = 0, min = Infinity, max = -Infinity;
    const validValues: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (isFinite(value) && value > 0) {
        validValues.push(value);
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }

    const mean = sum / validValues.length;
    const variance = validValues.reduce((acc, v) => acc + (v - mean) ** 2, 0) / validValues.length;

    return { mean, std: Math.sqrt(variance), min, max };
  }

  getMap(id: string): TissueMap | undefined {
    return this.maps.get(id);
  }
}

// ============================================================================
// FEATURE 10: Real-time Collaboration
// ============================================================================

export interface CollaborationSession {
  id: string;
  studyInstanceUID: string;
  participants: Array<{
    userId: string;
    name: string;
    role: 'owner' | 'reviewer' | 'observer';
    cursor?: { x: number; y: number; viewport: string };
    joinedAt: Date;
  }>;
  annotations: Array<{
    id: string;
    userId: string;
    type: string;
    data: unknown;
    timestamp: Date;
  }>;
  chat: Array<{
    userId: string;
    message: string;
    timestamp: Date;
  }>;
  createdAt: Date;
}

export class CollaborationService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'collaborationService',
    create: (): CollaborationService => new CollaborationService(),
  };

  public static readonly EVENTS = {
    SESSION_CREATED: 'event::collaboration:sessionCreated',
    PARTICIPANT_JOINED: 'event::collaboration:participantJoined',
    PARTICIPANT_LEFT: 'event::collaboration:participantLeft',
    CURSOR_MOVED: 'event::collaboration:cursorMoved',
    ANNOTATION_ADDED: 'event::collaboration:annotationAdded',
    CHAT_MESSAGE: 'event::collaboration:chatMessage',
    SESSION_ENDED: 'event::collaboration:sessionEnded',
  };

  private sessions: Map<string, CollaborationSession> = new Map();
  private websocket: WebSocket | null = null;
  private currentSessionId: string | null = null;
  private userId: string = '';

  constructor() {
    super(CollaborationService.EVENTS);
  }

  /**
   * Create a new collaboration session
   */
  createSession(studyInstanceUID: string, userName: string): CollaborationSession {
    this.userId = `user-${Date.now()}`;

    const session: CollaborationSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      studyInstanceUID,
      participants: [{
        userId: this.userId,
        name: userName,
        role: 'owner',
        joinedAt: new Date(),
      }],
      annotations: [],
      chat: [],
      createdAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    this._broadcastEvent(CollaborationService.EVENTS.SESSION_CREATED, session);
    return session;
  }

  /**
   * Join an existing session
   */
  joinSession(sessionId: string, userName: string, role: 'reviewer' | 'observer' = 'reviewer'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.userId = `user-${Date.now()}`;

    session.participants.push({
      userId: this.userId,
      name: userName,
      role,
      joinedAt: new Date(),
    });

    this.currentSessionId = sessionId;

    this._broadcastEvent(CollaborationService.EVENTS.PARTICIPANT_JOINED, {
      sessionId,
      userId: this.userId,
      name: userName,
    });

    return true;
  }

  /**
   * Leave current session
   */
  leaveSession(): void {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.participants = session.participants.filter(p => p.userId !== this.userId);

      this._broadcastEvent(CollaborationService.EVENTS.PARTICIPANT_LEFT, {
        sessionId: this.currentSessionId,
        userId: this.userId,
      });

      // End session if no participants left
      if (session.participants.length === 0) {
        this.sessions.delete(this.currentSessionId);
        this._broadcastEvent(CollaborationService.EVENTS.SESSION_ENDED, {
          sessionId: this.currentSessionId,
        });
      }
    }

    this.currentSessionId = null;
  }

  /**
   * Update cursor position
   */
  updateCursor(x: number, y: number, viewport: string): void {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === this.userId);
    if (participant) {
      participant.cursor = { x, y, viewport };

      this._broadcastEvent(CollaborationService.EVENTS.CURSOR_MOVED, {
        sessionId: this.currentSessionId,
        userId: this.userId,
        cursor: participant.cursor,
      });
    }
  }

  /**
   * Add annotation
   */
  addAnnotation(type: string, data: unknown): string {
    if (!this.currentSessionId) return '';

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return '';

    const annotation = {
      id: `annotation-${Date.now()}`,
      userId: this.userId,
      type,
      data,
      timestamp: new Date(),
    };

    session.annotations.push(annotation);

    this._broadcastEvent(CollaborationService.EVENTS.ANNOTATION_ADDED, {
      sessionId: this.currentSessionId,
      annotation,
    });

    return annotation.id;
  }

  /**
   * Send chat message
   */
  sendMessage(message: string): void {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return;

    const chatMessage = {
      userId: this.userId,
      message,
      timestamp: new Date(),
    };

    session.chat.push(chatMessage);

    this._broadcastEvent(CollaborationService.EVENTS.CHAT_MESSAGE, {
      sessionId: this.currentSessionId,
      ...chatMessage,
    });
  }

  /**
   * Generate shareable link
   */
  getShareableLink(sessionId: string): string {
    return `${window.location.origin}/collaborate/${sessionId}`;
  }

  getCurrentSession(): CollaborationSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// ============================================================================
// FEATURE 11: Auto Prior Comparison
// ============================================================================

export interface PriorStudy {
  studyInstanceUID: string;
  studyDate: Date;
  studyDescription: string;
  modality: string;
  bodyPart: string;
  seriesCount: number;
  relevanceScore: number;
  timeDelta: number; // days
}

export interface ComparisonResult {
  currentStudyUID: string;
  priorStudyUID: string;
  linkedSeries: Array<{
    currentSeriesUID: string;
    priorSeriesUID: string;
    matchConfidence: number;
    seriesDescription: string;
  }>;
  changes: Array<{
    type: 'new' | 'improved' | 'worsened' | 'stable';
    description: string;
    location?: string;
    measurements?: { current: number; prior: number; unit: string };
  }>;
}

export class AutoPriorComparisonService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'autoPriorComparisonService',
    create: (): AutoPriorComparisonService => new AutoPriorComparisonService(),
  };

  public static readonly EVENTS = {
    PRIORS_FOUND: 'event::priorComparison:priorsFound',
    COMPARISON_READY: 'event::priorComparison:comparisonReady',
    SERIES_LINKED: 'event::priorComparison:seriesLinked',
    NO_PRIORS: 'event::priorComparison:noPriors',
  };

  private cache: Map<string, PriorStudy[]> = new Map();

  constructor() {
    super(AutoPriorComparisonService.EVENTS);
  }

  /**
   * Find relevant prior studies for a given study
   */
  async findPriors(
    patientId: string,
    currentStudy: {
      studyInstanceUID: string;
      studyDate: Date;
      modality: string;
      bodyPart: string;
      studyDescription: string;
    },
    dataSource: {
      query: (params: Record<string, unknown>) => Promise<unknown[]>;
    }
  ): Promise<PriorStudy[]> {
    // Check cache
    const cacheKey = `${patientId}-${currentStudy.modality}-${currentStudy.bodyPart}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Query for prior studies
    const priors = await dataSource.query({
      patientId,
      modality: currentStudy.modality,
      studyDateBefore: currentStudy.studyDate,
    });

    const scoredPriors: PriorStudy[] = (priors as Array<Record<string, unknown>>)
      .filter(p => p.studyInstanceUID !== currentStudy.studyInstanceUID)
      .map(prior => {
        const priorDate = new Date(prior.studyDate as string);
        const timeDelta = Math.floor(
          (currentStudy.studyDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          studyInstanceUID: prior.studyInstanceUID as string,
          studyDate: priorDate,
          studyDescription: prior.studyDescription as string || '',
          modality: prior.modality as string,
          bodyPart: prior.bodyPart as string || '',
          seriesCount: (prior.numberOfSeries as number) || 0,
          relevanceScore: this.calculateRelevance(currentStudy, prior as Record<string, unknown>, timeDelta),
          timeDelta,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    this.cache.set(cacheKey, scoredPriors);

    if (scoredPriors.length > 0) {
      this._broadcastEvent(AutoPriorComparisonService.EVENTS.PRIORS_FOUND, {
        currentStudyUID: currentStudy.studyInstanceUID,
        priors: scoredPriors,
      });
    } else {
      this._broadcastEvent(AutoPriorComparisonService.EVENTS.NO_PRIORS, {
        currentStudyUID: currentStudy.studyInstanceUID,
      });
    }

    return scoredPriors;
  }

  /**
   * Calculate relevance score for prior study
   */
  private calculateRelevance(
    current: Record<string, unknown>,
    prior: Record<string, unknown>,
    timeDelta: number
  ): number {
    let score = 0;

    // Same modality bonus
    if (current.modality === prior.modality) score += 40;

    // Same body part bonus
    if (current.bodyPart === prior.bodyPart) score += 30;

    // Similar description bonus
    if (this.similarDescription(current.studyDescription as string, prior.studyDescription as string)) {
      score += 20;
    }

    // Time proximity (prefer recent, but not too recent)
    if (timeDelta >= 30 && timeDelta <= 365) score += 10;
    else if (timeDelta > 365 && timeDelta <= 730) score += 5;

    return score;
  }

  private similarDescription(desc1: string, desc2: string): boolean {
    if (!desc1 || !desc2) return false;
    const words1 = new Set(desc1.toLowerCase().split(/\s+/));
    const words2 = new Set(desc2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    return intersection.size >= 2;
  }

  /**
   * Link series between current and prior study
   */
  async linkSeries(
    currentSeries: Array<{ seriesInstanceUID: string; seriesDescription: string; modality: string }>,
    priorSeries: Array<{ seriesInstanceUID: string; seriesDescription: string; modality: string }>
  ): Promise<ComparisonResult['linkedSeries']> {
    const links: ComparisonResult['linkedSeries'] = [];

    for (const current of currentSeries) {
      let bestMatch: { uid: string; confidence: number; description: string } | null = null;

      for (const prior of priorSeries) {
        const confidence = this.calculateSeriesMatch(current, prior);
        if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            uid: prior.seriesInstanceUID,
            confidence,
            description: current.seriesDescription,
          };
        }
      }

      if (bestMatch) {
        links.push({
          currentSeriesUID: current.seriesInstanceUID,
          priorSeriesUID: bestMatch.uid,
          matchConfidence: bestMatch.confidence,
          seriesDescription: bestMatch.description,
        });
      }
    }

    this._broadcastEvent(AutoPriorComparisonService.EVENTS.SERIES_LINKED, { links });
    return links;
  }

  private calculateSeriesMatch(
    current: { seriesDescription: string; modality: string },
    prior: { seriesDescription: string; modality: string }
  ): number {
    if (current.modality !== prior.modality) return 0;

    const currentDesc = current.seriesDescription.toLowerCase();
    const priorDesc = prior.seriesDescription.toLowerCase();

    // Exact match
    if (currentDesc === priorDesc) return 1.0;

    // Check for key terms
    const keyTerms = ['axial', 'sagittal', 'coronal', 'contrast', 't1', 't2', 'flair', 'dwi'];
    let matches = 0;
    let total = 0;

    for (const term of keyTerms) {
      const inCurrent = currentDesc.includes(term);
      const inPrior = priorDesc.includes(term);
      if (inCurrent || inPrior) {
        total++;
        if (inCurrent && inPrior) matches++;
      }
    }

    return total > 0 ? matches / total : 0.3;
  }

  /**
   * Get best prior for comparison
   */
  getBestPrior(studyInstanceUID: string): PriorStudy | null {
    for (const [, priors] of this.cache) {
      const found = priors.find(p => p.studyInstanceUID !== studyInstanceUID);
      if (found) return found;
    }
    return null;
  }
}

// ============================================================================
// FEATURE 12: 3D/MPR Reconstruction Service
// ============================================================================

export interface MPRView {
  id: string;
  orientation: 'axial' | 'sagittal' | 'coronal' | 'oblique';
  slicePosition: number;
  thickness: number;
  spacing: number;
  imageData: Float32Array;
  width: number;
  height: number;
  windowCenter: number;
  windowWidth: number;
}

export interface VolumeData {
  id: string;
  seriesInstanceUID: string;
  dimensions: { x: number; y: number; z: number };
  spacing: { x: number; y: number; z: number };
  origin: { x: number; y: number; z: number };
  data: Float32Array;
}

export class MPRReconstructionService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'mprReconstructionService',
    create: (): MPRReconstructionService => new MPRReconstructionService(),
  };

  public static readonly EVENTS = {
    VOLUME_LOADED: 'event::mpr:volumeLoaded',
    MPR_GENERATED: 'event::mpr:mprGenerated',
    MIP_GENERATED: 'event::mpr:mipGenerated',
    RENDERING_UPDATED: 'event::mpr:renderingUpdated',
  };

  private volumes: Map<string, VolumeData> = new Map();
  private mprCache: Map<string, MPRView> = new Map();

  constructor() {
    super(MPRReconstructionService.EVENTS);
  }

  /**
   * Load volume from series
   */
  async loadVolume(
    seriesInstanceUID: string,
    slices: Array<{
      pixelData: Float32Array;
      imagePositionPatient: number[];
      pixelSpacing: number[];
      rows: number;
      columns: number;
    }>
  ): Promise<VolumeData> {
    // Sort slices by position
    const sorted = slices.sort((a, b) =>
      a.imagePositionPatient[2] - b.imagePositionPatient[2]
    );

    const firstSlice = sorted[0];
    const dimensions = {
      x: firstSlice.columns,
      y: firstSlice.rows,
      z: sorted.length,
    };

    const spacing = {
      x: firstSlice.pixelSpacing[0],
      y: firstSlice.pixelSpacing[1],
      z: Math.abs(sorted[1].imagePositionPatient[2] - sorted[0].imagePositionPatient[2]),
    };

    const origin = {
      x: firstSlice.imagePositionPatient[0],
      y: firstSlice.imagePositionPatient[1],
      z: firstSlice.imagePositionPatient[2],
    };

    // Stack slices into volume
    const volumeSize = dimensions.x * dimensions.y * dimensions.z;
    const data = new Float32Array(volumeSize);

    for (let z = 0; z < sorted.length; z++) {
      const sliceData = sorted[z].pixelData;
      const offset = z * dimensions.x * dimensions.y;
      data.set(sliceData, offset);
    }

    const volume: VolumeData = {
      id: `volume-${seriesInstanceUID}`,
      seriesInstanceUID,
      dimensions,
      spacing,
      origin,
      data,
    };

    this.volumes.set(volume.id, volume);
    this._broadcastEvent(MPRReconstructionService.EVENTS.VOLUME_LOADED, { volumeId: volume.id });

    return volume;
  }

  /**
   * Generate MPR slice
   */
  generateMPR(
    volumeId: string,
    orientation: 'axial' | 'sagittal' | 'coronal',
    slicePosition: number,
    thickness = 1
  ): MPRView | null {
    const volume = this.volumes.get(volumeId);
    if (!volume) return null;

    const cacheKey = `${volumeId}-${orientation}-${slicePosition}-${thickness}`;
    if (this.mprCache.has(cacheKey)) {
      return this.mprCache.get(cacheKey)!;
    }

    let width: number, height: number;
    const imageData = new Float32Array(0);

    switch (orientation) {
      case 'axial':
        width = volume.dimensions.x;
        height = volume.dimensions.y;
        break;
      case 'sagittal':
        width = volume.dimensions.y;
        height = volume.dimensions.z;
        break;
      case 'coronal':
        width = volume.dimensions.x;
        height = volume.dimensions.z;
        break;
    }

    const mprView: MPRView = {
      id: cacheKey,
      orientation,
      slicePosition,
      thickness,
      spacing: volume.spacing.x,
      imageData: this.extractSlice(volume, orientation, slicePosition, thickness),
      width,
      height,
      windowCenter: 40,
      windowWidth: 400,
    };

    this.mprCache.set(cacheKey, mprView);
    this._broadcastEvent(MPRReconstructionService.EVENTS.MPR_GENERATED, mprView);

    return mprView;
  }

  /**
   * Extract slice from volume
   */
  private extractSlice(
    volume: VolumeData,
    orientation: string,
    position: number,
    thickness: number
  ): Float32Array {
    const { dimensions, data } = volume;
    let width: number, height: number;

    switch (orientation) {
      case 'axial': {
        width = dimensions.x;
        height = dimensions.y;
        const sliceData = new Float32Array(width * height);
        const z = Math.min(Math.floor(position), dimensions.z - 1);
        const offset = z * width * height;

        if (thickness === 1) {
          sliceData.set(data.subarray(offset, offset + width * height));
        } else {
          // MIP/Average over thickness
          for (let i = 0; i < width * height; i++) {
            let maxVal = -Infinity;
            for (let dz = 0; dz < thickness && z + dz < dimensions.z; dz++) {
              const val = data[offset + dz * width * height + i];
              maxVal = Math.max(maxVal, val);
            }
            sliceData[i] = maxVal;
          }
        }
        return sliceData;
      }
      case 'sagittal': {
        width = dimensions.y;
        height = dimensions.z;
        const sliceData = new Float32Array(width * height);
        const x = Math.min(Math.floor(position), dimensions.x - 1);

        for (let z = 0; z < dimensions.z; z++) {
          for (let y = 0; y < dimensions.y; y++) {
            sliceData[z * width + y] = data[z * dimensions.x * dimensions.y + y * dimensions.x + x];
          }
        }
        return sliceData;
      }
      case 'coronal': {
        width = dimensions.x;
        height = dimensions.z;
        const sliceData = new Float32Array(width * height);
        const y = Math.min(Math.floor(position), dimensions.y - 1);

        for (let z = 0; z < dimensions.z; z++) {
          for (let x = 0; x < dimensions.x; x++) {
            sliceData[z * width + x] = data[z * dimensions.x * dimensions.y + y * dimensions.x + x];
          }
        }
        return sliceData;
      }
      default:
        return new Float32Array(0);
    }
  }

  /**
   * Generate Maximum Intensity Projection (MIP)
   */
  generateMIP(
    volumeId: string,
    orientation: 'axial' | 'sagittal' | 'coronal',
    startSlice: number,
    endSlice: number
  ): MPRView | null {
    const volume = this.volumes.get(volumeId);
    if (!volume) return null;

    const thickness = endSlice - startSlice + 1;
    const mip = this.generateMPR(volumeId, orientation, startSlice, thickness);

    if (mip) {
      this._broadcastEvent(MPRReconstructionService.EVENTS.MIP_GENERATED, mip);
    }

    return mip;
  }

  getVolume(volumeId: string): VolumeData | undefined {
    return this.volumes.get(volumeId);
  }

  clearCache(): void {
    this.mprCache.clear();
  }
}

// ============================================================================
// FEATURE 13: Natural Language Query
// ============================================================================

export interface QueryResult {
  query: string;
  interpretation: string;
  filters: Record<string, unknown>;
  results: Array<{
    studyInstanceUID: string;
    patientName: string;
    studyDate: Date;
    modality: string;
    studyDescription: string;
    relevanceScore: number;
  }>;
  totalCount: number;
  executionTime: number;
}

export class NaturalLanguageQueryService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'naturalLanguageQueryService',
    create: (): NaturalLanguageQueryService => new NaturalLanguageQueryService(),
  };

  public static readonly EVENTS = {
    QUERY_PARSED: 'event::nlQuery:parsed',
    RESULTS_READY: 'event::nlQuery:resultsReady',
    SUGGESTION_READY: 'event::nlQuery:suggestionReady',
  };

  private queryPatterns: Array<{
    pattern: RegExp;
    extractor: (matches: RegExpMatchArray) => Record<string, unknown>;
  }> = [];

  constructor() {
    super(NaturalLanguageQueryService.EVENTS);
    this.initPatterns();
  }

  private initPatterns(): void {
    // Date patterns
    this.queryPatterns.push({
      pattern: /(?:from|after|since)\s+(?:the\s+)?(?:last\s+)?(\d+)\s+(day|week|month|year)s?/i,
      extractor: (matches) => {
        const amount = parseInt(matches[1]);
        const unit = matches[2].toLowerCase();
        const date = new Date();

        switch (unit) {
          case 'day': date.setDate(date.getDate() - amount); break;
          case 'week': date.setDate(date.getDate() - amount * 7); break;
          case 'month': date.setMonth(date.getMonth() - amount); break;
          case 'year': date.setFullYear(date.getFullYear() - amount); break;
        }

        return { studyDateFrom: date };
      },
    });

    // Modality patterns
    this.queryPatterns.push({
      pattern: /\b(CT|MR|MRI|CR|DX|US|MG|NM|PT|XA)\b/gi,
      extractor: (matches) => {
        let modality = matches[1].toUpperCase();
        if (modality === 'MRI') modality = 'MR';
        return { modality };
      },
    });

    // Body part patterns
    this.queryPatterns.push({
      pattern: /\b(chest|abdomen|brain|head|spine|knee|shoulder|pelvis|cardiac|heart)\b/i,
      extractor: (matches) => {
        const bodyPartMap: Record<string, string> = {
          'chest': 'CHEST',
          'abdomen': 'ABDOMEN',
          'brain': 'HEAD',
          'head': 'HEAD',
          'spine': 'SPINE',
          'knee': 'KNEE',
          'shoulder': 'SHOULDER',
          'pelvis': 'PELVIS',
          'cardiac': 'HEART',
          'heart': 'HEART',
        };
        return { bodyPart: bodyPartMap[matches[1].toLowerCase()] };
      },
    });

    // Finding patterns
    this.queryPatterns.push({
      pattern: /(?:with|showing|contains?)\s+(nodule|mass|fracture|hemorrhage|effusion|pneumonia)/i,
      extractor: (matches) => ({ finding: matches[1].toLowerCase() }),
    });

    // Priority patterns
    this.queryPatterns.push({
      pattern: /\b(stat|urgent|critical|routine)\b/i,
      extractor: (matches) => ({ priority: matches[1].toLowerCase() }),
    });

    // Patient name pattern
    this.queryPatterns.push({
      pattern: /(?:patient|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
      extractor: (matches) => ({ patientName: matches[1] }),
    });
  }

  /**
   * Parse natural language query
   */
  parseQuery(query: string): Record<string, unknown> {
    const filters: Record<string, unknown> = {};

    for (const { pattern, extractor } of this.queryPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        Object.assign(filters, extractor(matches));
      }
    }

    this._broadcastEvent(NaturalLanguageQueryService.EVENTS.QUERY_PARSED, {
      query,
      filters,
    });

    return filters;
  }

  /**
   * Execute natural language query
   */
  async executeQuery(
    query: string,
    dataSource: { query: (filters: Record<string, unknown>) => Promise<unknown[]> }
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const filters = this.parseQuery(query);

    const results = await dataSource.query(filters);

    const queryResult: QueryResult = {
      query,
      interpretation: this.generateInterpretation(filters),
      filters,
      results: (results as Array<Record<string, unknown>>).map(r => ({
        studyInstanceUID: r.studyInstanceUID as string,
        patientName: r.patientName as string || 'Unknown',
        studyDate: new Date(r.studyDate as string),
        modality: r.modality as string,
        studyDescription: r.studyDescription as string || '',
        relevanceScore: this.calculateRelevance(r, filters),
      })).sort((a, b) => b.relevanceScore - a.relevanceScore),
      totalCount: results.length,
      executionTime: Date.now() - startTime,
    };

    this._broadcastEvent(NaturalLanguageQueryService.EVENTS.RESULTS_READY, queryResult);
    return queryResult;
  }

  private generateInterpretation(filters: Record<string, unknown>): string {
    const parts: string[] = [];

    if (filters.modality) parts.push(`${filters.modality} studies`);
    if (filters.bodyPart) parts.push(`of ${filters.bodyPart}`);
    if (filters.studyDateFrom) {
      parts.push(`from ${(filters.studyDateFrom as Date).toLocaleDateString()}`);
    }
    if (filters.finding) parts.push(`with ${filters.finding}`);
    if (filters.priority) parts.push(`(${filters.priority} priority)`);
    if (filters.patientName) parts.push(`for patient ${filters.patientName}`);

    return parts.length > 0 ? `Searching for ${parts.join(' ')}` : 'Searching all studies';
  }

  private calculateRelevance(result: Record<string, unknown>, filters: Record<string, unknown>): number {
    let score = 50; // Base score

    if (filters.modality && result.modality === filters.modality) score += 20;
    if (filters.bodyPart && result.bodyPart === filters.bodyPart) score += 20;
    if (filters.priority && result.priority === filters.priority) score += 10;

    return Math.min(100, score);
  }

  /**
   * Get query suggestions
   */
  getSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];

    if (partialQuery.length < 2) return suggestions;

    const lowerQuery = partialQuery.toLowerCase();

    // Modality suggestions
    if ('ct chest'.startsWith(lowerQuery)) suggestions.push('CT Chest from last week');
    if ('mri'.startsWith(lowerQuery)) suggestions.push('MRI Brain from last month');
    if ('urgent'.startsWith(lowerQuery)) suggestions.push('Urgent CT studies today');
    if ('stat'.startsWith(lowerQuery)) suggestions.push('STAT studies pending review');

    this._broadcastEvent(NaturalLanguageQueryService.EVENTS.SUGGESTION_READY, { suggestions });
    return suggestions.slice(0, 5);
  }
}

// ============================================================================
// FEATURE 14: Patient Timeline View
// ============================================================================

export interface TimelineEvent {
  id: string;
  date: Date;
  type: 'study' | 'report' | 'finding' | 'procedure' | 'lab';
  title: string;
  description: string;
  data: {
    studyInstanceUID?: string;
    reportId?: string;
    findingType?: string;
    severity?: string;
    modality?: string;
    bodyPart?: string;
  };
  aiAnnotations?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
}

export interface PatientTimeline {
  patientId: string;
  patientName: string;
  events: TimelineEvent[];
  dateRange: { start: Date; end: Date };
  eventCounts: Record<string, number>;
  trends: Array<{
    metric: string;
    values: Array<{ date: Date; value: number }>;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
}

export class PatientTimelineService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'patientTimelineService',
    create: (): PatientTimelineService => new PatientTimelineService(),
  };

  public static readonly EVENTS = {
    TIMELINE_LOADED: 'event::timeline:loaded',
    EVENT_SELECTED: 'event::timeline:eventSelected',
    TREND_DETECTED: 'event::timeline:trendDetected',
  };

  private timelines: Map<string, PatientTimeline> = new Map();

  constructor() {
    super(PatientTimelineService.EVENTS);
  }

  /**
   * Load patient timeline
   */
  async loadTimeline(
    patientId: string,
    dataSource: {
      getStudies: (patientId: string) => Promise<unknown[]>;
      getReports?: (patientId: string) => Promise<unknown[]>;
      getFindings?: (patientId: string) => Promise<unknown[]>;
    }
  ): Promise<PatientTimeline> {
    const events: TimelineEvent[] = [];

    // Load studies
    const studies = await dataSource.getStudies(patientId);
    for (const study of studies as Array<Record<string, unknown>>) {
      events.push({
        id: `study-${study.studyInstanceUID}`,
        date: new Date(study.studyDate as string),
        type: 'study',
        title: study.studyDescription as string || `${study.modality} Study`,
        description: `${study.modality} examination of ${study.bodyPart || 'unspecified region'}`,
        data: {
          studyInstanceUID: study.studyInstanceUID as string,
          modality: study.modality as string,
          bodyPart: study.bodyPart as string,
        },
      });
    }

    // Load reports if available
    if (dataSource.getReports) {
      const reports = await dataSource.getReports(patientId);
      for (const report of reports as Array<Record<string, unknown>>) {
        events.push({
          id: `report-${report.id}`,
          date: new Date(report.date as string),
          type: 'report',
          title: report.title as string || 'Radiology Report',
          description: report.impression as string || '',
          data: {
            reportId: report.id as string,
            studyInstanceUID: report.studyInstanceUID as string,
          },
        });
      }
    }

    // Sort by date
    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate event counts
    const eventCounts: Record<string, number> = {};
    for (const event of events) {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    }

    // Detect trends
    const trends = this.detectTrends(events);

    const timeline: PatientTimeline = {
      patientId,
      patientName: (studies[0] as Record<string, unknown>)?.patientName as string || 'Unknown',
      events,
      dateRange: {
        start: events.length > 0 ? events[events.length - 1].date : new Date(),
        end: events.length > 0 ? events[0].date : new Date(),
      },
      eventCounts,
      trends,
    };

    this.timelines.set(patientId, timeline);
    this._broadcastEvent(PatientTimelineService.EVENTS.TIMELINE_LOADED, timeline);

    return timeline;
  }

  /**
   * Detect trends in patient data
   */
  private detectTrends(events: TimelineEvent[]): PatientTimeline['trends'] {
    const trends: PatientTimeline['trends'] = [];

    // Count studies per month
    const studyCountsByMonth = new Map<string, number>();
    for (const event of events.filter(e => e.type === 'study')) {
      const monthKey = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
      studyCountsByMonth.set(monthKey, (studyCountsByMonth.get(monthKey) || 0) + 1);
    }

    if (studyCountsByMonth.size >= 3) {
      const values = Array.from(studyCountsByMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => ({
          date: new Date(key + '-01'),
          value: count,
        }));

      const trend = this.calculateTrend(values.map(v => v.value));

      trends.push({
        metric: 'Study Frequency',
        values,
        trend,
      });

      if (trend === 'increasing') {
        this._broadcastEvent(PatientTimelineService.EVENTS.TREND_DETECTED, {
          metric: 'Study Frequency',
          trend: 'increasing',
          message: 'Patient study frequency has been increasing',
        });
      }
    }

    return trends;
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';

    let increasing = 0, decreasing = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increasing++;
      else if (values[i] < values[i - 1]) decreasing++;
    }

    const total = values.length - 1;
    if (increasing > total * 0.6) return 'increasing';
    if (decreasing > total * 0.6) return 'decreasing';
    return 'stable';
  }

  /**
   * Get timeline for patient
   */
  getTimeline(patientId: string): PatientTimeline | undefined {
    return this.timelines.get(patientId);
  }

  /**
   * Filter timeline events
   */
  filterEvents(
    patientId: string,
    filters: {
      type?: string;
      dateFrom?: Date;
      dateTo?: Date;
      modality?: string;
    }
  ): TimelineEvent[] {
    const timeline = this.timelines.get(patientId);
    if (!timeline) return [];

    return timeline.events.filter(event => {
      if (filters.type && event.type !== filters.type) return false;
      if (filters.dateFrom && event.date < filters.dateFrom) return false;
      if (filters.dateTo && event.date > filters.dateTo) return false;
      if (filters.modality && event.data.modality !== filters.modality) return false;
      return true;
    });
  }
}

// Export all workflow features
export {
  HangingProtocolOptimizerService,
  TissueMapService,
  CollaborationService,
  AutoPriorComparisonService,
  MPRReconstructionService,
  NaturalLanguageQueryService,
  PatientTimelineService,
};
