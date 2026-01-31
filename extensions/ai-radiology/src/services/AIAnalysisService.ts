import { PubSubService } from '@ohif/core';
import {
  AIAnalysisConfig,
  AIAnalysisResult,
  AnalysisType,
  Finding,
  Segmentation,
  Measurement,
  Heatmap,
  DicomImageMetadata,
  AI_EVENTS,
} from '../types';

/**
 * AI Analysis Service
 * Handles AI-powered image analysis including detection, segmentation, and quantification
 */
export default class AIAnalysisService extends PubSubService {
  public static REGISTRATION = {
    name: 'aiAnalysisService',
    altName: 'AIAnalysisService',
    create: ({
      configuration,
    }: {
      configuration?: Partial<AIAnalysisConfig>;
    }): AIAnalysisService => {
      return new AIAnalysisService(configuration);
    },
  };

  private config: AIAnalysisConfig;
  private analysisEndpoints: Map<AnalysisType, string> = new Map();
  private activeAnalyses: Map<string, AbortController> = new Map();
  private cachedResults: Map<string, AIAnalysisResult[]> = new Map();

  constructor(configuration?: Partial<AIAnalysisConfig>) {
    super({
      [AI_EVENTS.ANALYSIS_STARTED]: AI_EVENTS.ANALYSIS_STARTED,
      [AI_EVENTS.ANALYSIS_PROGRESS]: AI_EVENTS.ANALYSIS_PROGRESS,
      [AI_EVENTS.ANALYSIS_COMPLETED]: AI_EVENTS.ANALYSIS_COMPLETED,
      [AI_EVENTS.ANALYSIS_ERROR]: AI_EVENTS.ANALYSIS_ERROR,
    });

    this.config = {
      autoAnalyze: false,
      analysisTypes: ['general_abnormality'],
      confidenceThreshold: 0.5,
      showOverlays: true,
      ...configuration,
    };
  }

  /**
   * Configure the AI Analysis service
   */
  public configure(config: Partial<AIAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Register an analysis endpoint
   */
  public registerEndpoint(analysisType: AnalysisType, endpoint: string): void {
    this.analysisEndpoints.set(analysisType, endpoint);
  }

  /**
   * Get available analysis types
   */
  public getAvailableAnalysisTypes(): AnalysisType[] {
    return Array.from(this.analysisEndpoints.keys());
  }

  /**
   * Run AI analysis on images
   */
  public async analyzeImages(
    images: ImageForAnalysis[],
    analysisTypes?: AnalysisType[]
  ): Promise<AIAnalysisResult[]> {
    const typesToRun = analysisTypes || this.config.analysisTypes;
    const results: AIAnalysisResult[] = [];
    const analysisId = this.generateAnalysisId();

    // Create abort controller for this analysis
    const abortController = new AbortController();
    this.activeAnalyses.set(analysisId, abortController);

    this._broadcastEvent(AI_EVENTS.ANALYSIS_STARTED, {
      analysisId,
      imageCount: images.length,
      analysisTypes: typesToRun,
    });

    try {
      for (let i = 0; i < typesToRun.length; i++) {
        const analysisType = typesToRun[i];

        // Check if cancelled
        if (abortController.signal.aborted) {
          break;
        }

        this._broadcastEvent(AI_EVENTS.ANALYSIS_PROGRESS, {
          analysisId,
          current: i + 1,
          total: typesToRun.length,
          analysisType,
        });

        const result = await this.runSingleAnalysis(
          images,
          analysisType,
          abortController.signal
        );

        if (result) {
          results.push(result);
        }
      }

      // Cache results
      const cacheKey = this.getCacheKey(images);
      this.cachedResults.set(cacheKey, results);

      this._broadcastEvent(AI_EVENTS.ANALYSIS_COMPLETED, {
        analysisId,
        results,
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this._broadcastEvent(AI_EVENTS.ANALYSIS_ERROR, {
        analysisId,
        error: errorMessage,
      });

      throw error;
    } finally {
      this.activeAnalyses.delete(analysisId);
    }
  }

  /**
   * Run a single type of analysis
   */
  private async runSingleAnalysis(
    images: ImageForAnalysis[],
    analysisType: AnalysisType,
    signal: AbortSignal
  ): Promise<AIAnalysisResult | null> {
    const endpoint = this.analysisEndpoints.get(analysisType);
    if (!endpoint) {
      console.warn(`No endpoint registered for analysis type: ${analysisType}`);
      return null;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: images.map(img => ({
            base64Data: img.base64Data,
            metadata: img.metadata,
          })),
          analysisType,
          config: {
            confidenceThreshold: this.config.confidenceThreshold,
          },
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: this.generateAnalysisId(),
        analysisType,
        timestamp: new Date().toISOString(),
        model: data.model || 'unknown',
        modelVersion: data.modelVersion || '1.0',
        processingTimeMs: Date.now() - startTime,
        findings: this.parseFindings(data.findings || []),
        segmentations: this.parseSegmentations(data.segmentations || []),
        measurements: this.parseMeasurements(data.measurements || []),
        heatmaps: this.parseHeatmaps(data.heatmaps || []),
        overallConfidence: data.confidence || 0.5,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Cancel ongoing analysis
   */
  public cancelAnalysis(analysisId?: string): void {
    if (analysisId) {
      const controller = this.activeAnalyses.get(analysisId);
      if (controller) {
        controller.abort();
        this.activeAnalyses.delete(analysisId);
      }
    } else {
      // Cancel all
      this.activeAnalyses.forEach(controller => controller.abort());
      this.activeAnalyses.clear();
    }
  }

  /**
   * Get cached results for images
   */
  public getCachedResults(images: ImageForAnalysis[]): AIAnalysisResult[] | undefined {
    const cacheKey = this.getCacheKey(images);
    return this.cachedResults.get(cacheKey);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cachedResults.clear();
  }

  /**
   * Parse findings from API response
   */
  private parseFindings(rawFindings: RawFinding[]): Finding[] {
    return rawFindings
      .filter(f => f.confidence >= this.config.confidenceThreshold)
      .map((f, index) => ({
        id: f.id || `finding-${index}`,
        description: f.description || f.label || 'Unknown finding',
        location: f.location
          ? {
              region: f.location.region || 'Unknown',
              laterality: f.location.laterality,
              radlexId: f.location.radlexId,
            }
          : undefined,
        severity: this.mapSeverity(f.severity),
        confidence: f.confidence,
        imageReference: f.imageReference,
        codes: f.codes,
        detectedBy: f.model,
      }));
  }

  /**
   * Parse segmentations from API response
   */
  private parseSegmentations(rawSegmentations: RawSegmentation[]): Segmentation[] {
    return rawSegmentations.map((s, index) => ({
      id: s.id || `seg-${index}`,
      label: s.label || `Segmentation ${index + 1}`,
      color: s.color || this.getDefaultColor(index),
      maskData: s.maskData,
      seriesInstanceUID: s.seriesInstanceUID,
      confidence: s.confidence || 1.0,
    }));
  }

  /**
   * Parse measurements from API response
   */
  private parseMeasurements(rawMeasurements: RawMeasurement[]): Measurement[] {
    return rawMeasurements.map((m, index) => ({
      id: m.id || `meas-${index}`,
      type: m.type || 'length',
      value: m.value,
      unit: m.unit || 'mm',
      label: m.label || `Measurement ${index + 1}`,
      location: m.location || { region: 'Unknown' },
      imageReference: m.imageReference,
    }));
  }

  /**
   * Parse heatmaps from API response
   */
  private parseHeatmaps(rawHeatmaps: RawHeatmap[]): Heatmap[] {
    return rawHeatmaps.map((h, index) => ({
      id: h.id || `heatmap-${index}`,
      type: h.type || 'attention',
      data: h.data,
      colormap: h.colormap || 'jet',
      opacity: h.opacity || 0.5,
      seriesInstanceUID: h.seriesInstanceUID,
      sopInstanceUID: h.sopInstanceUID,
    }));
  }

  /**
   * Map severity string to enum
   */
  private mapSeverity(severity?: string): Finding['severity'] {
    if (!severity) return 'moderate';
    const map: Record<string, Finding['severity']> = {
      normal: 'normal',
      mild: 'mild',
      moderate: 'moderate',
      severe: 'severe',
      critical: 'critical',
    };
    return map[severity.toLowerCase()] || 'moderate';
  }

  /**
   * Get default color for segmentation
   */
  private getDefaultColor(index: number): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
    ];
    return colors[index % colors.length];
  }

  /**
   * Generate cache key from images
   */
  private getCacheKey(images: ImageForAnalysis[]): string {
    return images.map(img => img.metadata?.sopInstanceUID || '').join('-');
  }

  /**
   * Generate analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Create findings display set for OHIF
   */
  public createFindingsDisplaySet(
    results: AIAnalysisResult[],
    studyInstanceUID: string
  ): AIFindingsDisplaySet {
    const allFindings = results.flatMap(r => r.findings);
    const allSegmentations = results.flatMap(r => r.segmentations || []);
    const allMeasurements = results.flatMap(r => r.measurements || []);

    return {
      displaySetInstanceUID: `ai-findings-${Date.now()}`,
      StudyInstanceUID: studyInstanceUID,
      SeriesDescription: 'AI Analysis Results',
      Modality: 'AI',
      numImages: allFindings.length,
      findings: allFindings,
      segmentations: allSegmentations,
      measurements: allMeasurements,
      analysisTimestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ImageForAnalysis {
  base64Data: string;
  mimeType?: string;
  metadata?: DicomImageMetadata;
}

interface RawFinding {
  id?: string;
  label?: string;
  description?: string;
  location?: {
    region?: string;
    laterality?: 'left' | 'right' | 'bilateral' | 'midline';
    radlexId?: string;
  };
  severity?: string;
  confidence: number;
  imageReference?: Finding['imageReference'];
  codes?: Finding['codes'];
  model?: string;
}

interface RawSegmentation {
  id?: string;
  label?: string;
  color?: string;
  maskData: string;
  seriesInstanceUID: string;
  confidence?: number;
}

interface RawMeasurement {
  id?: string;
  type?: Measurement['type'];
  value: number;
  unit?: string;
  label?: string;
  location?: Measurement['location'];
  imageReference?: Measurement['imageReference'];
}

interface RawHeatmap {
  id?: string;
  type?: Heatmap['type'];
  data: string;
  colormap?: string;
  opacity?: number;
  seriesInstanceUID: string;
  sopInstanceUID: string;
}

export interface AIFindingsDisplaySet {
  displaySetInstanceUID: string;
  StudyInstanceUID: string;
  SeriesDescription: string;
  Modality: string;
  numImages: number;
  findings: Finding[];
  segmentations: Segmentation[];
  measurements: Measurement[];
  analysisTimestamp: string;
}
