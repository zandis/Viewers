/**
 * Analytics Module
 * Provides data aggregation, metrics calculation, and visualization data
 * for AI radiology workflows with millions of records
 */

import { PubSubService } from '@ohif/core';

// Analytics data types
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface CategoryDataPoint {
  category: string;
  value: number;
  percentage?: number;
  color?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  target?: number;
  status: 'good' | 'warning' | 'critical';
}

export interface RadiologistMetrics {
  radiologistId: string;
  name: string;
  studiesRead: number;
  averageTurnaround: number;
  aiAgreementRate: number;
  criticalFindings: number;
  qualityScore: number;
}

export interface AIModelMetrics {
  modelId: string;
  name: string;
  sensitivity: number;
  specificity: number;
  accuracy: number;
  auc: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  averageInferenceTime: number;
  totalInferences: number;
}

export interface WorkloadMetrics {
  date: Date;
  totalStudies: number;
  pendingStudies: number;
  completedStudies: number;
  avgWaitTime: number;
  avgReadTime: number;
  criticalCount: number;
  statCount: number;
  routineCount: number;
}

export interface ModalityDistribution {
  modality: string;
  count: number;
  percentage: number;
  avgProcessingTime: number;
  aiUtilization: number;
}

// Aggregation functions for large datasets
type AggregationType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface AggregationConfig {
  type: AggregationType;
  startDate: Date;
  endDate: Date;
  groupBy?: string[];
  metrics: string[];
}

/**
 * Analytics Service
 * Handles data aggregation and metrics calculation for millions of records
 */
export class AnalyticsService extends PubSubService {
  public static readonly REGISTRATION = {
    name: 'analyticsService',
    create: ({ configuration }: { configuration: Record<string, unknown> }): AnalyticsService => {
      return new AnalyticsService(configuration);
    },
  };

  public static readonly EVENTS = {
    METRICS_UPDATED: 'event::analyticsService:metricsUpdated',
    AGGREGATION_COMPLETE: 'event::analyticsService:aggregationComplete',
    DASHBOARD_REFRESH: 'event::analyticsService:dashboardRefresh',
  };

  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private aggregationWorker: Worker | null = null;
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    super(AnalyticsService.EVENTS);
    this.config = config;
  }

  /**
   * Get cached data or compute if expired
   */
  private async getCachedOrCompute<T>(
    key: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }

    const data = await compute();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Invalidate cache for a specific key or all keys
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get dashboard KPIs
   */
  async getDashboardKPIs(): Promise<PerformanceMetric[]> {
    return this.getCachedOrCompute('dashboard_kpis', async () => {
      // In production, this would query the database
      // Using mock data for demonstration
      return [
        {
          name: 'Studies Today',
          value: 847,
          unit: 'studies',
          trend: 'up',
          trendPercentage: 12,
          target: 800,
          status: 'good',
        },
        {
          name: 'Average Turnaround',
          value: 24,
          unit: 'minutes',
          trend: 'down',
          trendPercentage: 8,
          target: 30,
          status: 'good',
        },
        {
          name: 'AI Agreement Rate',
          value: 94.5,
          unit: '%',
          trend: 'up',
          trendPercentage: 2.3,
          target: 90,
          status: 'good',
        },
        {
          name: 'Critical Findings',
          value: 23,
          unit: 'studies',
          trend: 'stable',
          trendPercentage: 0,
          status: 'warning',
        },
        {
          name: 'Pending Queue',
          value: 156,
          unit: 'studies',
          trend: 'up',
          trendPercentage: 15,
          target: 100,
          status: 'warning',
        },
        {
          name: 'AI Utilization',
          value: 78,
          unit: '%',
          trend: 'up',
          trendPercentage: 5,
          target: 80,
          status: 'good',
        },
      ];
    });
  }

  /**
   * Get study volume time series data
   */
  async getStudyVolumeTrend(
    aggregation: AggregationType = 'daily',
    days = 30
  ): Promise<TimeSeriesDataPoint[]> {
    const cacheKey = `study_volume_${aggregation}_${days}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const data: TimeSeriesDataPoint[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Simulate realistic volume with some variation
        const baseVolume = 800;
        const dayOfWeek = date.getDay();
        const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1;
        const randomVariation = 0.8 + Math.random() * 0.4;

        data.push({
          timestamp: date,
          value: Math.round(baseVolume * weekendFactor * randomVariation),
          label: date.toLocaleDateString(),
        });
      }

      return data;
    });
  }

  /**
   * Get modality distribution
   */
  async getModalityDistribution(): Promise<ModalityDistribution[]> {
    return this.getCachedOrCompute('modality_distribution', async () => {
      return [
        { modality: 'CT', count: 3245, percentage: 32.5, avgProcessingTime: 45, aiUtilization: 85 },
        { modality: 'MR', count: 2156, percentage: 21.6, avgProcessingTime: 60, aiUtilization: 72 },
        { modality: 'CR', count: 1987, percentage: 19.9, avgProcessingTime: 15, aiUtilization: 90 },
        { modality: 'US', count: 1234, percentage: 12.3, avgProcessingTime: 20, aiUtilization: 45 },
        { modality: 'MG', count: 876, percentage: 8.8, avgProcessingTime: 25, aiUtilization: 88 },
        { modality: 'NM', count: 345, percentage: 3.5, avgProcessingTime: 55, aiUtilization: 30 },
        { modality: 'Other', count: 157, percentage: 1.6, avgProcessingTime: 35, aiUtilization: 20 },
      ];
    });
  }

  /**
   * Get workload metrics over time
   */
  async getWorkloadMetrics(days = 7): Promise<WorkloadMetrics[]> {
    const cacheKey = `workload_metrics_${days}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const data: WorkloadMetrics[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        const totalStudies = 700 + Math.floor(Math.random() * 300);
        const pendingStudies = Math.floor(totalStudies * (0.1 + Math.random() * 0.1));
        const completedStudies = totalStudies - pendingStudies;

        data.push({
          date,
          totalStudies,
          pendingStudies,
          completedStudies,
          avgWaitTime: 15 + Math.floor(Math.random() * 20),
          avgReadTime: 8 + Math.floor(Math.random() * 10),
          criticalCount: Math.floor(totalStudies * 0.03),
          statCount: Math.floor(totalStudies * 0.15),
          routineCount: Math.floor(totalStudies * 0.82),
        });
      }

      return data;
    });
  }

  /**
   * Get radiologist performance metrics
   */
  async getRadiologistMetrics(): Promise<RadiologistMetrics[]> {
    return this.getCachedOrCompute('radiologist_metrics', async () => {
      return [
        { radiologistId: 'RAD001', name: 'Dr. Smith', studiesRead: 156, averageTurnaround: 22, aiAgreementRate: 95, criticalFindings: 4, qualityScore: 98 },
        { radiologistId: 'RAD002', name: 'Dr. Johnson', studiesRead: 142, averageTurnaround: 25, aiAgreementRate: 92, criticalFindings: 3, qualityScore: 96 },
        { radiologistId: 'RAD003', name: 'Dr. Williams', studiesRead: 138, averageTurnaround: 28, aiAgreementRate: 91, criticalFindings: 5, qualityScore: 94 },
        { radiologistId: 'RAD004', name: 'Dr. Brown', studiesRead: 125, averageTurnaround: 30, aiAgreementRate: 93, criticalFindings: 2, qualityScore: 97 },
        { radiologistId: 'RAD005', name: 'Dr. Davis', studiesRead: 118, averageTurnaround: 26, aiAgreementRate: 94, criticalFindings: 3, qualityScore: 95 },
      ];
    });
  }

  /**
   * Get AI model performance metrics
   */
  async getAIModelMetrics(): Promise<AIModelMetrics[]> {
    return this.getCachedOrCompute('ai_model_metrics', async () => {
      return [
        {
          modelId: 'LUNG_NODULE_V2',
          name: 'Lung Nodule Detection v2.0',
          sensitivity: 0.96,
          specificity: 0.92,
          accuracy: 0.94,
          auc: 0.97,
          falsePositiveRate: 0.08,
          falseNegativeRate: 0.04,
          averageInferenceTime: 2.3,
          totalInferences: 45678,
        },
        {
          modelId: 'CHEST_PATHOLOGY_V3',
          name: 'Chest Pathology v3.1',
          sensitivity: 0.94,
          specificity: 0.89,
          accuracy: 0.91,
          auc: 0.95,
          falsePositiveRate: 0.11,
          falseNegativeRate: 0.06,
          averageInferenceTime: 1.8,
          totalInferences: 67890,
        },
        {
          modelId: 'BRAIN_BLEED_V1',
          name: 'Brain Hemorrhage v1.5',
          sensitivity: 0.98,
          specificity: 0.95,
          accuracy: 0.96,
          auc: 0.99,
          falsePositiveRate: 0.05,
          falseNegativeRate: 0.02,
          averageInferenceTime: 3.1,
          totalInferences: 23456,
        },
        {
          modelId: 'MAMMO_CAD_V2',
          name: 'Mammography CAD v2.2',
          sensitivity: 0.93,
          specificity: 0.87,
          accuracy: 0.90,
          auc: 0.94,
          falsePositiveRate: 0.13,
          falseNegativeRate: 0.07,
          averageInferenceTime: 2.7,
          totalInferences: 34567,
        },
      ];
    });
  }

  /**
   * Get priority distribution
   */
  async getPriorityDistribution(): Promise<CategoryDataPoint[]> {
    return this.getCachedOrCompute('priority_distribution', async () => {
      return [
        { category: 'Critical', value: 23, percentage: 2.7, color: '#ef4444' },
        { category: 'STAT', value: 127, percentage: 15.0, color: '#f97316' },
        { category: 'Urgent', value: 198, percentage: 23.4, color: '#eab308' },
        { category: 'Routine', value: 499, percentage: 58.9, color: '#22c55e' },
      ];
    });
  }

  /**
   * Get turnaround time distribution
   */
  async getTurnaroundDistribution(): Promise<CategoryDataPoint[]> {
    return this.getCachedOrCompute('turnaround_distribution', async () => {
      return [
        { category: '< 15 min', value: 234, percentage: 27.6, color: '#22c55e' },
        { category: '15-30 min', value: 312, percentage: 36.8, color: '#84cc16' },
        { category: '30-60 min', value: 189, percentage: 22.3, color: '#eab308' },
        { category: '1-2 hrs', value: 78, percentage: 9.2, color: '#f97316' },
        { category: '> 2 hrs', value: 34, percentage: 4.0, color: '#ef4444' },
      ];
    });
  }

  /**
   * Get hourly volume heatmap data
   */
  async getHourlyVolumeHeatmap(days = 7): Promise<number[][]> {
    const cacheKey = `hourly_heatmap_${days}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const data: number[][] = [];

      for (let day = 0; day < 7; day++) {
        const dayData: number[] = [];
        for (let hour = 0; hour < 24; hour++) {
          // Simulate realistic hourly volume
          let volume: number;
          if (hour >= 8 && hour <= 17) {
            volume = 30 + Math.floor(Math.random() * 20);
          } else if (hour >= 6 && hour <= 20) {
            volume = 15 + Math.floor(Math.random() * 15);
          } else {
            volume = 5 + Math.floor(Math.random() * 10);
          }

          // Weekend reduction
          if (day === 0 || day === 6) {
            volume = Math.floor(volume * 0.6);
          }

          dayData.push(volume);
        }
        data.push(dayData);
      }

      return data;
    });
  }

  /**
   * Aggregate large dataset with streaming
   */
  async aggregateLargeDataset<T, R>(
    dataIterator: AsyncIterable<T>,
    aggregator: (acc: R, item: T) => R,
    initialValue: R,
    onProgress?: (count: number) => void
  ): Promise<R> {
    let result = initialValue;
    let count = 0;

    for await (const item of dataIterator) {
      result = aggregator(result, item);
      count++;

      if (count % 10000 === 0 && onProgress) {
        onProgress(count);
      }
    }

    return result;
  }

  /**
   * Calculate statistical summary for numeric array
   */
  calculateStatistics(values: number[]): {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    p25: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return {
        count: 0, min: 0, max: 0, mean: 0, median: 0,
        stdDev: 0, p25: 0, p75: 0, p90: 0, p95: 0, p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sumSq = values.reduce((a, b) => a + b * b, 0);
    const variance = sumSq / n - mean * mean;

    const percentile = (p: number): number => {
      const index = Math.floor((p / 100) * n);
      return sorted[Math.min(index, n - 1)];
    };

    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median: percentile(50),
      stdDev: Math.sqrt(variance),
      p25: percentile(25),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Generate chart-ready data for time series
   */
  formatTimeSeriesForChart(
    data: TimeSeriesDataPoint[],
    options: {
      labelFormat?: 'date' | 'time' | 'datetime';
      valueFormat?: 'number' | 'percentage' | 'duration';
    } = {}
  ): { labels: string[]; values: number[] } {
    const { labelFormat = 'date' } = options;

    const labels = data.map(d => {
      const date = d.timestamp;
      switch (labelFormat) {
        case 'time':
          return date.toLocaleTimeString();
        case 'datetime':
          return date.toLocaleString();
        default:
          return date.toLocaleDateString();
      }
    });

    const values = data.map(d => d.value);

    return { labels, values };
  }

  /**
   * Generate compliance report data
   */
  async getComplianceReport(startDate: Date, endDate: Date): Promise<{
    period: { start: Date; end: Date };
    metrics: {
      turnaroundCompliance: number;
      criticalFindingCompliance: number;
      reportQualityScore: number;
      aiUtilizationRate: number;
      peerReviewRate: number;
    };
    violations: Array<{ type: string; count: number; severity: string }>;
    trends: TimeSeriesDataPoint[];
  }> {
    const cacheKey = `compliance_${startDate.toISOString()}_${endDate.toISOString()}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      return {
        period: { start: startDate, end: endDate },
        metrics: {
          turnaroundCompliance: 94.5,
          criticalFindingCompliance: 99.2,
          reportQualityScore: 96.8,
          aiUtilizationRate: 78.3,
          peerReviewRate: 12.5,
        },
        violations: [
          { type: 'Turnaround Exceeded', count: 47, severity: 'warning' },
          { type: 'Critical Finding Delay', count: 3, severity: 'critical' },
          { type: 'Report Quality Issue', count: 12, severity: 'warning' },
          { type: 'Missing Comparison', count: 8, severity: 'minor' },
        ],
        trends: await this.getStudyVolumeTrend('daily', 30),
      };
    });
  }

  /**
   * Export analytics data to CSV format
   */
  exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    columns: Array<{ key: keyof T; label: string }>
  ): string {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
      columns.map(c => {
        const value = row[c.key];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return String(value ?? '');
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Subscribe to real-time analytics updates
   */
  subscribeToUpdates(callback: (metrics: PerformanceMetric[]) => void): () => void {
    const handler = (event: { detail: PerformanceMetric[] }) => {
      callback(event.detail);
    };

    this._subscribe(AnalyticsService.EVENTS.METRICS_UPDATED, handler);

    return () => {
      this._unsubscribe(AnalyticsService.EVENTS.METRICS_UPDATED, handler);
    };
  }

  /**
   * Trigger a dashboard refresh
   */
  refreshDashboard(): void {
    this.invalidateCache();
    this._broadcastEvent(AnalyticsService.EVENTS.DASHBOARD_REFRESH, {});
  }
}

export default AnalyticsService;
