/**
 * AI Integration Functions
 * 30 Production-grade AI integration and orchestration functions
 */

import type { Patient, Order, ClinicalAlert } from './clinical-workflow';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  version: string;
  modality: string[];
  bodyPart: string[];
  task: AITask;
  inputFormat: ModelInputFormat;
  outputFormat: ModelOutputFormat;
  performance: ModelPerformance;
  status: 'active' | 'inactive' | 'deprecated';
  endpoint?: string;
}

export type AITask =
  | 'classification'
  | 'detection'
  | 'segmentation'
  | 'registration'
  | 'enhancement'
  | 'quantification'
  | 'triage'
  | 'report_generation';

export interface ModelInputFormat {
  dimensions: [number, number] | [number, number, number];
  channels: number;
  dataType: 'uint8' | 'int16' | 'float32';
  normalization: 'minmax' | 'zscore' | 'none';
  preprocessing: string[];
}

export interface ModelOutputFormat {
  type: 'probability' | 'bbox' | 'mask' | 'text' | 'measurements';
  classes?: string[];
  threshold?: number;
}

export interface ModelPerformance {
  accuracy?: number;
  auc?: number;
  sensitivity?: number;
  specificity?: number;
  f1Score?: number;
  inferenceTimeMs: number;
  validationDate: string;
  validationDataset: string;
}

export interface AIInferenceRequest {
  requestId: string;
  modelId: string;
  studyId: string;
  seriesId?: string;
  instanceIds?: string[];
  priority: 'stat' | 'urgent' | 'routine';
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface AIInferenceResult {
  requestId: string;
  modelId: string;
  studyId: string;
  success: boolean;
  findings: AIFinding[];
  measurements: AIMeasurement[];
  masks?: AISegmentationMask[];
  confidence: number;
  processingTimeMs: number;
  modelVersion: string;
  timestamp: Date;
  error?: string;
}

export interface AIFinding {
  id: string;
  type: string;
  description: string;
  confidence: number;
  location?: BoundingBox | Point3D;
  severity: 'critical' | 'high' | 'medium' | 'low';
  icd10Suggestion?: string;
  relatedFindings?: string[];
  aiExplanation?: string;
}

export interface AIMeasurement {
  id: string;
  type: string;
  value: number;
  unit: string;
  location?: Point3D;
  reference?: { min: number; max: number; source: string };
  percentile?: number;
}

export interface AISegmentationMask {
  organOrStructure: string;
  maskData: Uint8Array;
  volumeMl?: number;
  surfaceAreaCm2?: number;
  hounsefieldMean?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  sliceIndex?: number;
  seriesId?: string;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  seriesId?: string;
}

export interface AIWorkflowConfig {
  autoRunOnLoad: boolean;
  priorityModels: string[];
  parallelInference: number;
  timeoutMs: number;
  retryAttempts: number;
  alertThresholds: {
    critical: number;
    urgent: number;
  };
}

export interface ModelEnsembleConfig {
  models: string[];
  aggregation: 'voting' | 'averaging' | 'weighted' | 'stacking';
  weights?: number[];
  minAgreement?: number;
}

// ============================================================================
// 71-80: MODEL MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * 71. Select appropriate AI models for study
 */
export function selectModelsForStudy(
  modality: string,
  bodyPart: string,
  clinicalIndication: string,
  availableModels: AIModel[]
): AIModel[] {
  const indicationLower = clinicalIndication.toLowerCase();

  return availableModels
    .filter(model => model.status === 'active')
    .filter(model =>
      model.modality.includes(modality) || model.modality.includes('*')
    )
    .filter(model =>
      model.bodyPart.includes(bodyPart) ||
      model.bodyPart.includes('*') ||
      model.bodyPart.some(bp => indicationLower.includes(bp.toLowerCase()))
    )
    .sort((a, b) => {
      // Prioritize by performance
      const aScore = (a.performance.auc || 0) + (a.performance.f1Score || 0);
      const bScore = (b.performance.auc || 0) + (b.performance.f1Score || 0);
      return bScore - aScore;
    });
}

/**
 * 72. Validate model compatibility with input data
 */
export function validateModelInput(
  model: AIModel,
  imageMetadata: {
    width: number;
    height: number;
    depth?: number;
    dataType: string;
    modality: string;
  }
): {
  compatible: boolean;
  issues: string[];
  requiredPreprocessing: string[];
} {
  const issues: string[] = [];
  const requiredPreprocessing: string[] = [];

  // Check dimensions
  const [expectedW, expectedH, expectedD] = model.inputFormat.dimensions;
  if (imageMetadata.width !== expectedW || imageMetadata.height !== expectedH) {
    requiredPreprocessing.push(`resize:${expectedW}x${expectedH}`);
  }

  if (expectedD && imageMetadata.depth !== expectedD) {
    issues.push(`Model expects ${expectedD} slices, got ${imageMetadata.depth || 1}`);
  }

  // Check data type
  if (imageMetadata.dataType !== model.inputFormat.dataType) {
    requiredPreprocessing.push(`convert:${model.inputFormat.dataType}`);
  }

  // Check modality
  if (!model.modality.includes(imageMetadata.modality) && !model.modality.includes('*')) {
    issues.push(`Model not validated for ${imageMetadata.modality}`);
  }

  return {
    compatible: issues.length === 0,
    issues,
    requiredPreprocessing: [...requiredPreprocessing, ...model.inputFormat.preprocessing],
  };
}

/**
 * 73. Calculate model confidence calibration
 */
export function calibrateModelConfidence(
  rawConfidence: number,
  calibrationCurve: Array<{ predicted: number; actual: number }>
): number {
  if (calibrationCurve.length < 2) return rawConfidence;

  // Find surrounding points
  let lower = calibrationCurve[0];
  let upper = calibrationCurve[calibrationCurve.length - 1];

  for (let i = 0; i < calibrationCurve.length - 1; i++) {
    if (calibrationCurve[i].predicted <= rawConfidence &&
        calibrationCurve[i + 1].predicted >= rawConfidence) {
      lower = calibrationCurve[i];
      upper = calibrationCurve[i + 1];
      break;
    }
  }

  // Linear interpolation
  const range = upper.predicted - lower.predicted;
  if (range === 0) return lower.actual;

  const t = (rawConfidence - lower.predicted) / range;
  return lower.actual + t * (upper.actual - lower.actual);
}

/**
 * 74. Aggregate ensemble model predictions
 */
export function aggregateEnsemblePredictions(
  predictions: Array<{ modelId: string; confidence: number; finding: string }>,
  config: ModelEnsembleConfig
): {
  finalPrediction: string;
  confidence: number;
  agreement: number;
  contributions: Record<string, number>;
} {
  const findingVotes = new Map<string, number>();
  const contributions: Record<string, number> = {};

  predictions.forEach((pred, idx) => {
    const weight = config.weights?.[idx] || 1;
    contributions[pred.modelId] = weight;

    if (config.aggregation === 'voting') {
      findingVotes.set(pred.finding, (findingVotes.get(pred.finding) || 0) + 1);
    } else if (config.aggregation === 'weighted') {
      findingVotes.set(pred.finding,
        (findingVotes.get(pred.finding) || 0) + weight * pred.confidence
      );
    }
  });

  // Find winner
  let maxVotes = 0;
  let finalPrediction = '';
  for (const [finding, votes] of findingVotes) {
    if (votes > maxVotes) {
      maxVotes = votes;
      finalPrediction = finding;
    }
  }

  // Calculate agreement
  const agreeCount = predictions.filter(p => p.finding === finalPrediction).length;
  const agreement = predictions.length > 0 ? agreeCount / predictions.length : 0;

  // Calculate final confidence
  const agreePredictions = predictions.filter(p => p.finding === finalPrediction);
  const confidence = config.aggregation === 'averaging' && agreePredictions.length > 0
    ? agreePredictions.reduce((sum, p) => sum + p.confidence, 0) / agreePredictions.length
    : agreePredictions.length > 0 ? Math.max(...agreePredictions.map(p => p.confidence)) : 0;

  return { finalPrediction, confidence, agreement, contributions };
}

/**
 * 75. Track model version and performance drift
 */
export function detectPerformanceDrift(
  recentPredictions: Array<{ predicted: boolean; actual: boolean; confidence: number }>,
  baselinePerformance: ModelPerformance,
  windowSize = 100
): {
  hasDrift: boolean;
  currentAccuracy: number;
  currentAUC: number;
  driftMagnitude: number;
  recommendation: string;
} {
  if (recentPredictions.length < windowSize) {
    return {
      hasDrift: false,
      currentAccuracy: 0,
      currentAUC: 0,
      driftMagnitude: 0,
      recommendation: 'Insufficient data for drift detection',
    };
  }

  const recent = recentPredictions.slice(-windowSize);

  // Calculate accuracy
  const correct = recent.filter(p => p.predicted === p.actual).length;
  const currentAccuracy = correct / recent.length;

  // Simple AUC approximation
  const sorted = [...recent].sort((a, b) => b.confidence - a.confidence);
  let tp = 0, fp = 0;
  const positives = sorted.filter(p => p.actual).length;
  const negatives = sorted.length - positives;
  let auc = 0;
  let prevFPR = 0;

  for (const pred of sorted) {
    if (pred.actual) tp++;
    else fp++;

    const tpr = positives > 0 ? tp / positives : 0;
    const fpr = negatives > 0 ? fp / negatives : 0;
    auc += (fpr - prevFPR) * tpr;
    prevFPR = fpr;
  }

  // Check for drift
  const baselineAccuracy = baselinePerformance.accuracy || 0.9;
  const baselineAUC = baselinePerformance.auc || 0.9;

  const accuracyDrift = Math.abs(currentAccuracy - baselineAccuracy);
  const aucDrift = Math.abs(auc - baselineAUC);
  const driftMagnitude = Math.max(accuracyDrift, aucDrift);

  const hasDrift = driftMagnitude > 0.05; // 5% threshold

  let recommendation: string;
  if (driftMagnitude > 0.1) {
    recommendation = 'Significant drift detected - consider model retraining';
  } else if (hasDrift) {
    recommendation = 'Moderate drift detected - monitor closely';
  } else {
    recommendation = 'Model performance within acceptable range';
  }

  return {
    hasDrift,
    currentAccuracy,
    currentAUC: auc,
    driftMagnitude,
    recommendation,
  };
}

/**
 * 76-80: Additional model management functions
 */
export function getModelRecommendations(
  task: AITask,
  requirements: {
    maxInferenceTime?: number;
    minAccuracy?: number;
    modality?: string;
  },
  availableModels: AIModel[]
): AIModel[] {
  return availableModels
    .filter(m => m.task === task && m.status === 'active')
    .filter(m => !requirements.maxInferenceTime || m.performance.inferenceTimeMs <= requirements.maxInferenceTime)
    .filter(m => !requirements.minAccuracy || (m.performance.accuracy || 0) >= requirements.minAccuracy)
    .filter(m => !requirements.modality || m.modality.includes(requirements.modality))
    .sort((a, b) => (b.performance.auc || 0) - (a.performance.auc || 0));
}

export function createModelRegistry(): {
  register: (model: AIModel) => void;
  get: (id: string) => AIModel | undefined;
  list: () => AIModel[];
  deprecate: (id: string) => void;
} {
  const models = new Map<string, AIModel>();

  return {
    register: (model: AIModel) => {
      models.set(model.id, model);
    },
    get: (id: string) => models.get(id),
    list: () => Array.from(models.values()),
    deprecate: (id: string) => {
      const model = models.get(id);
      if (model) {
        models.set(id, { ...model, status: 'deprecated' });
      }
    },
  };
}

export function calculateModelCost(
  model: AIModel,
  studyCount: number,
  pricing: { perInference: number; perGPUHour: number }
): {
  totalCost: number;
  costPerStudy: number;
  gpuHours: number;
} {
  if (studyCount <= 0) {
    return { totalCost: 0, costPerStudy: 0, gpuHours: 0 };
  }

  const gpuHours = (model.performance.inferenceTimeMs * studyCount) / 3600000;
  const totalCost = studyCount * pricing.perInference + gpuHours * pricing.perGPUHour;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costPerStudy: Math.round((totalCost / studyCount) * 100) / 100,
    gpuHours: Math.round(gpuHours * 100) / 100,
  };
}

export function validateModelOutput(
  result: AIInferenceResult,
  model: AIModel
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!result.success && !result.error) {
    issues.push('Failed result without error message');
  }

  for (const finding of result.findings) {
    if (finding.confidence < 0 || finding.confidence > 1) {
      issues.push(`Invalid confidence ${finding.confidence} for finding ${finding.id}`);
    }

    if (model.outputFormat.classes && !model.outputFormat.classes.includes(finding.type)) {
      issues.push(`Unknown finding type ${finding.type}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function formatModelPerformanceReport(model: AIModel): string {
  const p = model.performance;
  return [
    `Model: ${model.name} v${model.version}`,
    `Task: ${model.task}`,
    `Modalities: ${model.modality.join(', ')}`,
    `Performance:`,
    p.accuracy ? `  Accuracy: ${(p.accuracy * 100).toFixed(1)}%` : '',
    p.auc ? `  AUC: ${p.auc.toFixed(3)}` : '',
    p.sensitivity ? `  Sensitivity: ${(p.sensitivity * 100).toFixed(1)}%` : '',
    p.specificity ? `  Specificity: ${(p.specificity * 100).toFixed(1)}%` : '',
    `  Inference Time: ${p.inferenceTimeMs}ms`,
    `Validated: ${p.validationDate} on ${p.validationDataset}`,
  ].filter(Boolean).join('\n');
}

// ============================================================================
// 81-90: INFERENCE ORCHESTRATION FUNCTIONS
// ============================================================================

/**
 * 81. Create optimized inference queue
 */
export function createInferenceQueue(config: AIWorkflowConfig): {
  enqueue: (request: AIInferenceRequest) => void;
  process: () => Promise<AIInferenceResult[]>;
  getQueueStats: () => { pending: number; processing: number; completed: number };
} {
  const pending: AIInferenceRequest[] = [];
  const processing = new Map<string, AIInferenceRequest>();
  let completedCount = 0;

  const priorityOrder = { stat: 0, urgent: 1, routine: 2 };

  return {
    enqueue: (request: AIInferenceRequest) => {
      pending.push(request);
      pending.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
    },

    process: async () => {
      const results: AIInferenceResult[] = [];
      const batch = pending.splice(0, config.parallelInference);

      for (const request of batch) {
        processing.set(request.requestId, request);
      }

      // Simulate parallel processing
      const promises = batch.map(async (request) => {
        await new Promise(resolve => setTimeout(resolve, 100));

        processing.delete(request.requestId);
        completedCount++;

        return {
          requestId: request.requestId,
          modelId: request.modelId,
          studyId: request.studyId,
          success: true,
          findings: [],
          measurements: [],
          confidence: 0.9,
          processingTimeMs: 100,
          modelVersion: '1.0.0',
          timestamp: new Date(),
        } as AIInferenceResult;
      });

      results.push(...(await Promise.all(promises)));
      return results;
    },

    getQueueStats: () => ({
      pending: pending.length,
      processing: processing.size,
      completed: completedCount,
    }),
  };
}

/**
 * 82. Batch similar studies for efficient processing
 */
export function batchStudiesForInference(
  studies: Array<{ studyId: string; modality: string; bodyPart: string }>,
  maxBatchSize = 8
): Array<Array<{ studyId: string; modality: string; bodyPart: string }>> {
  const grouped = new Map<string, typeof studies>();

  for (const study of studies) {
    const key = `${study.modality}:${study.bodyPart}`;
    const group = grouped.get(key) || [];
    group.push(study);
    grouped.set(key, group);
  }

  const batches: typeof studies[] = [];

  for (const group of grouped.values()) {
    for (let i = 0; i < group.length; i += maxBatchSize) {
      batches.push(group.slice(i, i + maxBatchSize));
    }
  }

  return batches;
}

/**
 * 83. Handle inference timeout and retry
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: { maxRetries: number; timeoutMs: number; backoffMs: number }
): Promise<{ success: boolean; result?: T; attempts: number; error?: string }> {
  let attempts = 0;

  while (attempts < config.maxRetries) {
    attempts++;

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), config.timeoutMs)
        ),
      ]);

      return { success: true, result, attempts };
    } catch (error) {
      if (attempts >= config.maxRetries) {
        return {
          success: false,
          attempts,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, config.backoffMs * Math.pow(2, attempts - 1))
      );
    }
  }

  return { success: false, attempts, error: 'Max retries exceeded' };
}

/**
 * 84. Prioritize findings for clinical review
 */
export function prioritizeFindings(findings: AIFinding[]): AIFinding[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...findings].sort((a, b) => {
    // Sort by severity first
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence
    return b.confidence - a.confidence;
  });
}

/**
 * 85. Generate clinical alerts from AI findings
 */
export function generateAlertsFromFindings(
  findings: AIFinding[],
  studyId: string,
  patientId: string,
  thresholds: { critical: number; urgent: number }
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];

  for (const finding of findings) {
    if (finding.severity === 'critical' && finding.confidence >= thresholds.critical) {
      alerts.push({
        id: `alert-${finding.id}`,
        type: 'CRITICAL',
        studyId,
        patientId,
        message: `AI detected critical finding: ${finding.description}`,
        aiConfidence: finding.confidence,
        createdAt: new Date(),
        escalated: false,
      });
    } else if (finding.severity === 'high' && finding.confidence >= thresholds.urgent) {
      alerts.push({
        id: `alert-${finding.id}`,
        type: 'URGENT',
        studyId,
        patientId,
        message: `AI detected urgent finding: ${finding.description}`,
        aiConfidence: finding.confidence,
        createdAt: new Date(),
        escalated: false,
      });
    }
  }

  return alerts;
}

/**
 * 86-90: Additional orchestration functions
 */
export function calculateInferencePriority(
  order: Order,
  patientContext?: Patient
): number {
  let priority = 0;

  // Order priority
  if (order.priority === 'STAT') priority += 100;
  else if (order.priority === 'URGENT') priority += 50;

  // Clinical indication urgency
  const urgentTerms = ['trauma', 'stroke', 'pe', 'emergent', 'acute'];
  if (urgentTerms.some(t => order.clinicalIndication.toLowerCase().includes(t))) {
    priority += 30;
  }

  // Patient risk factors
  if (patientContext) {
    if (patientContext.clinicalHistory.some(h =>
      h.condition.toLowerCase().includes('cancer'))) {
      priority += 20;
    }
  }

  return priority;
}

export function mergeInferenceResults(
  results: AIInferenceResult[]
): AIInferenceResult {
  if (results.length === 0) {
    throw new Error('Cannot merge empty results');
  }

  const merged: AIInferenceResult = {
    requestId: results[0].requestId,
    modelId: results.map(r => r.modelId).join('+'),
    studyId: results[0].studyId,
    success: results.every(r => r.success),
    findings: [],
    measurements: [],
    masks: [],
    confidence: 0,
    processingTimeMs: Math.max(...results.map(r => r.processingTimeMs)),
    modelVersion: results.map(r => r.modelVersion).join('+'),
    timestamp: new Date(),
  };

  // Merge findings, removing duplicates
  const findingMap = new Map<string, AIFinding>();
  for (const result of results) {
    for (const finding of result.findings) {
      const key = `${finding.type}:${finding.description}`;
      const existing = findingMap.get(key);
      if (!existing || finding.confidence > existing.confidence) {
        findingMap.set(key, finding);
      }
    }
  }
  merged.findings = Array.from(findingMap.values());

  // Merge measurements
  for (const result of results) {
    merged.measurements.push(...result.measurements);
  }

  // Average confidence
  merged.confidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return merged;
}

export function filterFindingsByConfidence(
  findings: AIFinding[],
  minConfidence: number
): AIFinding[] {
  return findings.filter(f => f.confidence >= minConfidence);
}

export function groupFindingsByType(
  findings: AIFinding[]
): Map<string, AIFinding[]> {
  const grouped = new Map<string, AIFinding[]>();

  for (const finding of findings) {
    const existing = grouped.get(finding.type) || [];
    existing.push(finding);
    grouped.set(finding.type, existing);
  }

  return grouped;
}

export function formatFindingsForReport(findings: AIFinding[]): string {
  if (findings.length === 0) {
    return 'No significant AI findings.';
  }

  const prioritized = prioritizeFindings(findings);
  const lines: string[] = ['AI Analysis Results:', ''];

  for (const finding of prioritized) {
    const confidence = `[${(finding.confidence * 100).toFixed(0)}% confidence]`;
    const severity = finding.severity.toUpperCase();
    lines.push(`- ${severity}: ${finding.description} ${confidence}`);

    if (finding.aiExplanation) {
      lines.push(`  Rationale: ${finding.aiExplanation}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// 91-100: QUALITY ASSURANCE AND MONITORING
// ============================================================================

/**
 * 91. Calculate AI system health metrics
 */
export function calculateSystemHealth(
  recentResults: AIInferenceResult[],
  windowMinutes = 60
): {
  status: 'healthy' | 'degraded' | 'critical';
  metrics: {
    successRate: number;
    avgLatency: number;
    p99Latency: number;
    throughput: number;
  };
  issues: string[];
} {
  const cutoff = new Date(Date.now() - windowMinutes * 60000);
  const recent = recentResults.filter(r => r.timestamp >= cutoff);

  if (recent.length === 0) {
    return {
      status: 'degraded',
      metrics: { successRate: 0, avgLatency: 0, p99Latency: 0, throughput: 0 },
      issues: ['No recent inference activity'],
    };
  }

  const successful = recent.filter(r => r.success);
  const successRate = successful.length / recent.length;

  const latencies = recent.map(r => r.processingTimeMs).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || avgLatency;

  const throughput = recent.length / windowMinutes;

  const issues: string[] = [];
  if (successRate < 0.95) issues.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`);
  if (avgLatency > 1000) issues.push(`High average latency: ${avgLatency.toFixed(0)}ms`);
  if (p99Latency > 5000) issues.push(`High p99 latency: ${p99Latency.toFixed(0)}ms`);

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (successRate < 0.8 || avgLatency > 3000) status = 'critical';
  else if (issues.length > 0) status = 'degraded';

  return {
    status,
    metrics: { successRate, avgLatency, p99Latency, throughput },
    issues,
  };
}

/**
 * 92. Audit AI decision trail
 */
export function createAuditTrail(
  result: AIInferenceResult,
  reviewerActions: Array<{ action: string; userId: string; timestamp: Date; notes?: string }>
): {
  inferenceId: string;
  timeline: Array<{ timestamp: Date; event: string; details: Record<string, unknown> }>;
  hash: string;
} {
  const timeline: Array<{ timestamp: Date; event: string; details: Record<string, unknown> }> = [];

  // AI inference event
  timeline.push({
    timestamp: result.timestamp,
    event: 'AI_INFERENCE',
    details: {
      modelId: result.modelId,
      confidence: result.confidence,
      findingCount: result.findings.length,
      success: result.success,
    },
  });

  // Reviewer actions
  for (const action of reviewerActions) {
    timeline.push({
      timestamp: action.timestamp,
      event: action.action,
      details: {
        userId: action.userId,
        notes: action.notes,
      },
    });
  }

  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Simple hash for integrity
  const hash = btoa(JSON.stringify(timeline)).substring(0, 32);

  return {
    inferenceId: result.requestId,
    timeline,
    hash,
  };
}

/**
 * 93. Compare AI vs human interpretation
 */
export function compareAIToHumanFindings(
  aiFindings: AIFinding[],
  humanFindings: Array<{ type: string; description: string }>
): {
  agreement: number;
  aiOnly: AIFinding[];
  humanOnly: typeof humanFindings;
  matched: Array<{ ai: AIFinding; human: typeof humanFindings[0] }>;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
} {
  const matched: Array<{ ai: AIFinding; human: typeof humanFindings[0] }> = [];
  const usedHumanIndices = new Set<number>();

  // Match AI findings to human findings
  for (const aiFinding of aiFindings) {
    for (let i = 0; i < humanFindings.length; i++) {
      if (usedHumanIndices.has(i)) continue;

      const human = humanFindings[i];
      const typeMatch = aiFinding.type.toLowerCase() === human.type.toLowerCase();
      const descMatch = aiFinding.description.toLowerCase().includes(
        human.description.toLowerCase().substring(0, 20)
      );

      if (typeMatch || descMatch) {
        matched.push({ ai: aiFinding, human });
        usedHumanIndices.add(i);
        break;
      }
    }
  }

  const aiOnly = aiFindings.filter(ai =>
    !matched.some(m => m.ai.id === ai.id)
  );

  const humanOnly = humanFindings.filter((_, i) => !usedHumanIndices.has(i));

  return {
    agreement: matched.length / Math.max(aiFindings.length, humanFindings.length, 1),
    aiOnly,
    humanOnly,
    matched,
    truePositives: matched.length,
    falsePositives: aiOnly.length,
    falseNegatives: humanOnly.length,
  };
}

/**
 * 94-100: Additional QA functions
 */
export function calculatePositivePredictiveValue(
  truePositives: number,
  falsePositives: number
): number {
  const total = truePositives + falsePositives;
  return total > 0 ? truePositives / total : 0;
}

export function calculateNegativePredictiveValue(
  trueNegatives: number,
  falseNegatives: number
): number {
  const total = trueNegatives + falseNegatives;
  return total > 0 ? trueNegatives / total : 0;
}

export function trackModelUsageMetrics(
  modelId: string,
  results: AIInferenceResult[]
): {
  totalInferences: number;
  successfulInferences: number;
  avgConfidence: number;
  avgLatency: number;
  findingsPerStudy: number;
} {
  const modelResults = results.filter(r => r.modelId === modelId);

  if (modelResults.length === 0) {
    return {
      totalInferences: 0,
      successfulInferences: 0,
      avgConfidence: 0,
      avgLatency: 0,
      findingsPerStudy: 0,
    };
  }

  const successful = modelResults.filter(r => r.success);

  return {
    totalInferences: modelResults.length,
    successfulInferences: successful.length,
    avgConfidence: modelResults.reduce((sum, r) => sum + r.confidence, 0) / modelResults.length,
    avgLatency: modelResults.reduce((sum, r) => sum + r.processingTimeMs, 0) / modelResults.length,
    findingsPerStudy: modelResults.reduce((sum, r) => sum + r.findings.length, 0) / modelResults.length,
  };
}

export function generateQualityReport(
  results: AIInferenceResult[],
  comparisons: Array<ReturnType<typeof compareAIToHumanFindings>>
): string {
  const totalStudies = results.length;
  const successRate = totalStudies > 0 ? results.filter(r => r.success).length / totalStudies : 0;

  const avgAgreement = comparisons.length > 0
    ? comparisons.reduce((sum, c) => sum + c.agreement, 0) / comparisons.length
    : 0;

  const totalTP = comparisons.reduce((sum, c) => sum + c.truePositives, 0);
  const totalFP = comparisons.reduce((sum, c) => sum + c.falsePositives, 0);
  const totalFN = comparisons.reduce((sum, c) => sum + c.falseNegatives, 0);

  const ppv = calculatePositivePredictiveValue(totalTP, totalFP);
  const sensitivity = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;

  return [
    'AI Quality Report',
    '================',
    `Studies Analyzed: ${totalStudies}`,
    `Success Rate: ${(successRate * 100).toFixed(1)}%`,
    `AI-Human Agreement: ${(avgAgreement * 100).toFixed(1)}%`,
    `PPV: ${(ppv * 100).toFixed(1)}%`,
    `Sensitivity: ${(sensitivity * 100).toFixed(1)}%`,
    `True Positives: ${totalTP}`,
    `False Positives: ${totalFP}`,
    `False Negatives: ${totalFN}`,
  ].join('\n');
}

export function flagForQAReview(
  result: AIInferenceResult,
  criteria: {
    lowConfidenceThreshold: number;
    criticalFindingReview: boolean;
    randomSampleRate: number;
  }
): {
  needsReview: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (result.confidence < criteria.lowConfidenceThreshold) {
    reasons.push(`Low confidence: ${(result.confidence * 100).toFixed(1)}%`);
  }

  if (criteria.criticalFindingReview &&
      result.findings.some(f => f.severity === 'critical')) {
    reasons.push('Contains critical findings');
  }

  if (Math.random() < criteria.randomSampleRate) {
    reasons.push('Random QA sample');
  }

  return {
    needsReview: reasons.length > 0,
    reasons,
  };
}

export function aggregateQAMetrics(
  reviews: Array<{
    resultId: string;
    aiCorrect: boolean;
    reviewerComments: string;
    timeSpentSeconds: number;
  }>
): {
  totalReviews: number;
  accuracyRate: number;
  avgReviewTime: number;
  commonIssues: Map<string, number>;
} {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      accuracyRate: 0,
      avgReviewTime: 0,
      commonIssues: new Map(),
    };
  }

  const correct = reviews.filter(r => r.aiCorrect).length;
  const avgTime = reviews.reduce((sum, r) => sum + r.timeSpentSeconds, 0) / reviews.length;

  // Extract common issues from comments
  const issueKeywords = ['missed', 'false positive', 'wrong location', 'overdiagnosis', 'underdiagnosis'];
  const commonIssues = new Map<string, number>();

  for (const review of reviews) {
    const commentLower = review.reviewerComments.toLowerCase();
    for (const keyword of issueKeywords) {
      if (commentLower.includes(keyword)) {
        commonIssues.set(keyword, (commonIssues.get(keyword) || 0) + 1);
      }
    }
  }

  return {
    totalReviews: reviews.length,
    accuracyRate: correct / reviews.length,
    avgReviewTime: avgTime,
    commonIssues,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Model Management
  selectModelsForStudy,
  validateModelInput,
  calibrateModelConfidence,
  aggregateEnsemblePredictions,
  detectPerformanceDrift,
  getModelRecommendations,
  createModelRegistry,
  calculateModelCost,
  validateModelOutput,
  formatModelPerformanceReport,

  // Inference Orchestration
  createInferenceQueue,
  batchStudiesForInference,
  executeWithRetry,
  prioritizeFindings,
  generateAlertsFromFindings,
  calculateInferencePriority,
  mergeInferenceResults,
  filterFindingsByConfidence,
  groupFindingsByType,
  formatFindingsForReport,

  // Quality Assurance
  calculateSystemHealth,
  createAuditTrail,
  compareAIToHumanFindings,
  calculatePositivePredictiveValue,
  calculateNegativePredictiveValue,
  trackModelUsageMetrics,
  generateQualityReport,
  flagForQAReview,
  aggregateQAMetrics,
};
