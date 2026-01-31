/**
 * DICOM Processing Web Worker
 * Offloads heavy computation from the main thread for better UI responsiveness
 * Handles: pixel data processing, image analysis preprocessing, bulk operations
 */

// Worker message types
export interface WorkerMessage {
  id: string;
  type: WorkerMessageType;
  payload: unknown;
}

export type WorkerMessageType =
  | 'PROCESS_PIXEL_DATA'
  | 'CALCULATE_HISTOGRAM'
  | 'APPLY_WINDOWING'
  | 'EXTRACT_ROI'
  | 'BATCH_METADATA_PARSE'
  | 'COMPRESS_IMAGE'
  | 'CALCULATE_STATISTICS'
  | 'NORMALIZE_FOR_AI'
  | 'CANCEL';

export interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  progress?: number;
}

// Pixel data processing
interface PixelDataPayload {
  pixelData: ArrayBuffer;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number;
  photometricInterpretation: string;
  rescaleSlope?: number;
  rescaleIntercept?: number;
}

interface HistogramResult {
  bins: number[];
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  median: number;
  p1: number;
  p99: number;
}

interface WindowingPayload {
  pixelData: ArrayBuffer;
  windowCenter: number;
  windowWidth: number;
  rows: number;
  columns: number;
  outputFormat: 'uint8' | 'uint16';
}

interface ROIPayload {
  pixelData: ArrayBuffer;
  rows: number;
  columns: number;
  roi: { x: number; y: number; width: number; height: number };
}

interface MetadataParsePayload {
  datasets: ArrayBuffer[];
  extractFields: string[];
}

interface NormalizePayload {
  pixelData: ArrayBuffer;
  rows: number;
  columns: number;
  targetSize: { width: number; height: number };
  normalize: 'minmax' | 'zscore' | 'histogram';
}

// Worker implementation
const pendingTasks = new Map<string, { cancelled: boolean }>();

/**
 * Process incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  // Track task for cancellation
  pendingTasks.set(id, { cancelled: false });

  try {
    let result: unknown;

    switch (type) {
      case 'PROCESS_PIXEL_DATA':
        result = await processPixelData(id, payload as PixelDataPayload);
        break;

      case 'CALCULATE_HISTOGRAM':
        result = calculateHistogram(id, payload as PixelDataPayload);
        break;

      case 'APPLY_WINDOWING':
        result = applyWindowing(id, payload as WindowingPayload);
        break;

      case 'EXTRACT_ROI':
        result = extractROI(payload as ROIPayload);
        break;

      case 'BATCH_METADATA_PARSE':
        result = await batchMetadataParse(id, payload as MetadataParsePayload);
        break;

      case 'CALCULATE_STATISTICS':
        result = calculateStatistics(payload as PixelDataPayload);
        break;

      case 'NORMALIZE_FOR_AI':
        result = normalizeForAI(id, payload as NormalizePayload);
        break;

      case 'CANCEL':
        cancelTask(payload as string);
        result = { cancelled: true };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    if (!pendingTasks.get(id)?.cancelled) {
      const response: WorkerResponse = { id, success: true, result };
      self.postMessage(response);
    }
  } catch (error) {
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  } finally {
    pendingTasks.delete(id);
  }
};

/**
 * Process raw DICOM pixel data with rescale and modality LUT
 */
async function processPixelData(
  taskId: string,
  payload: PixelDataPayload
): Promise<Float32Array> {
  const {
    pixelData,
    rows,
    columns,
    bitsAllocated,
    pixelRepresentation,
    rescaleSlope = 1,
    rescaleIntercept = 0,
  } = payload;

  const numPixels = rows * columns;
  const result = new Float32Array(numPixels);

  // Create typed array view based on bits allocated
  let sourceData: Int16Array | Uint16Array | Int8Array | Uint8Array;
  if (bitsAllocated === 16) {
    sourceData = pixelRepresentation === 1
      ? new Int16Array(pixelData)
      : new Uint16Array(pixelData);
  } else {
    sourceData = pixelRepresentation === 1
      ? new Int8Array(pixelData)
      : new Uint8Array(pixelData);
  }

  // Process in chunks for better responsiveness
  const chunkSize = 100000;
  for (let i = 0; i < numPixels; i += chunkSize) {
    if (pendingTasks.get(taskId)?.cancelled) {
      throw new Error('Task cancelled');
    }

    const end = Math.min(i + chunkSize, numPixels);
    for (let j = i; j < end; j++) {
      result[j] = sourceData[j] * rescaleSlope + rescaleIntercept;
    }

    // Report progress
    if (i % (chunkSize * 10) === 0) {
      self.postMessage({
        id: taskId,
        success: true,
        progress: (i / numPixels) * 100,
      } as WorkerResponse);
    }
  }

  return result;
}

/**
 * Calculate histogram and statistics for pixel data
 */
function calculateHistogram(taskId: string, payload: PixelDataPayload): HistogramResult {
  const { pixelData, bitsStored, pixelRepresentation } = payload;

  // Determine data range
  const maxValue = Math.pow(2, bitsStored) - 1;
  const minValue = pixelRepresentation === 1 ? -Math.pow(2, bitsStored - 1) : 0;

  // Create histogram bins
  const numBins = 256;
  const bins = new Array(numBins).fill(0);
  const binWidth = (maxValue - minValue + 1) / numBins;

  // Use appropriate typed array
  const data = pixelRepresentation === 1
    ? new Int16Array(pixelData)
    : new Uint16Array(pixelData);

  // Calculate histogram and statistics
  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;
  const sortedValues: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (pendingTasks.get(taskId)?.cancelled) {
      throw new Error('Task cancelled');
    }

    const value = data[i];
    const binIndex = Math.floor((value - minValue) / binWidth);
    bins[Math.max(0, Math.min(numBins - 1, binIndex))]++;

    sum += value;
    sumSq += value * value;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sortedValues.push(value);
  }

  const n = data.length;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdDev = Math.sqrt(variance);

  // Calculate percentiles
  sortedValues.sort((a, b) => a - b);
  const median = sortedValues[Math.floor(n / 2)];
  const p1 = sortedValues[Math.floor(n * 0.01)];
  const p99 = sortedValues[Math.floor(n * 0.99)];

  return { bins, min, max, mean, stdDev, median, p1, p99 };
}

/**
 * Apply window/level to pixel data and output 8-bit or 16-bit image
 */
function applyWindowing(taskId: string, payload: WindowingPayload): ArrayBuffer {
  const { pixelData, windowCenter, windowWidth, rows, columns, outputFormat } = payload;

  const numPixels = rows * columns;
  const sourceData = new Int16Array(pixelData);

  const minVal = windowCenter - windowWidth / 2;
  const maxVal = windowCenter + windowWidth / 2;
  const outputMax = outputFormat === 'uint8' ? 255 : 65535;

  const output = outputFormat === 'uint8'
    ? new Uint8Array(numPixels)
    : new Uint16Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    if (i % 100000 === 0 && pendingTasks.get(taskId)?.cancelled) {
      throw new Error('Task cancelled');
    }

    const value = sourceData[i];
    if (value <= minVal) {
      output[i] = 0;
    } else if (value >= maxVal) {
      output[i] = outputMax;
    } else {
      output[i] = Math.round(((value - minVal) / windowWidth) * outputMax);
    }
  }

  return output.buffer;
}

/**
 * Extract a region of interest from pixel data
 */
function extractROI(payload: ROIPayload): ArrayBuffer {
  const { pixelData, rows, columns, roi } = payload;
  const sourceData = new Int16Array(pixelData);

  const roiPixels = roi.width * roi.height;
  const result = new Int16Array(roiPixels);

  let destIndex = 0;
  for (let y = roi.y; y < roi.y + roi.height; y++) {
    for (let x = roi.x; x < roi.x + roi.width; x++) {
      const sourceIndex = y * columns + x;
      if (sourceIndex >= 0 && sourceIndex < sourceData.length) {
        result[destIndex] = sourceData[sourceIndex];
      }
      destIndex++;
    }
  }

  return result.buffer;
}

/**
 * Batch parse DICOM metadata from multiple datasets
 */
async function batchMetadataParse(
  taskId: string,
  payload: MetadataParsePayload
): Promise<Record<string, unknown>[]> {
  const { datasets, extractFields } = payload;
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < datasets.length; i++) {
    if (pendingTasks.get(taskId)?.cancelled) {
      throw new Error('Task cancelled');
    }

    // Parse DICOM dataset (simplified - actual implementation would use dcmjs)
    const metadata: Record<string, unknown> = {
      index: i,
      size: datasets[i].byteLength,
    };

    // In real implementation, parse DICOM tags here
    extractFields.forEach(field => {
      metadata[field] = null; // Would extract actual value
    });

    results.push(metadata);

    // Report progress
    if (i % 100 === 0) {
      self.postMessage({
        id: taskId,
        success: true,
        progress: (i / datasets.length) * 100,
      } as WorkerResponse);
    }
  }

  return results;
}

/**
 * Calculate detailed statistics for pixel data
 */
function calculateStatistics(payload: PixelDataPayload): Record<string, number> {
  const { pixelData, pixelRepresentation } = payload;

  const data = pixelRepresentation === 1
    ? new Int16Array(pixelData)
    : new Uint16Array(pixelData);

  const n = data.length;
  let sum = 0;
  let sumSq = 0;
  let sumCube = 0;
  let sumQuad = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < n; i++) {
    const v = data[i];
    sum += v;
    sumSq += v * v;
    sumCube += v * v * v;
    sumQuad += v * v * v * v;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdDev = Math.sqrt(variance);
  const skewness = (sumCube / n - 3 * mean * variance - mean * mean * mean) / Math.pow(stdDev, 3);
  const kurtosis = (sumQuad / n - 4 * mean * sumCube / n + 6 * mean * mean * variance + 3 * Math.pow(mean, 4)) / Math.pow(stdDev, 4) - 3;

  return {
    count: n,
    min,
    max,
    range: max - min,
    mean,
    variance,
    stdDev,
    skewness,
    kurtosis,
    sum,
  };
}

/**
 * Normalize pixel data for AI model input
 */
function normalizeForAI(taskId: string, payload: NormalizePayload): Float32Array {
  const { pixelData, rows, columns, targetSize, normalize } = payload;

  const sourceData = new Int16Array(pixelData);

  // First, calculate normalization parameters
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < sourceData.length; i++) {
    const v = sourceData[i];
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
    sumSq += v * v;
  }

  const mean = sum / sourceData.length;
  const stdDev = Math.sqrt(sumSq / sourceData.length - mean * mean);

  // Resize using bilinear interpolation
  const result = new Float32Array(targetSize.width * targetSize.height);
  const scaleX = columns / targetSize.width;
  const scaleY = rows / targetSize.height;

  for (let y = 0; y < targetSize.height; y++) {
    if (y % 50 === 0 && pendingTasks.get(taskId)?.cancelled) {
      throw new Error('Task cancelled');
    }

    for (let x = 0; x < targetSize.width; x++) {
      const srcX = x * scaleX;
      const srcY = y * scaleY;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, columns - 1);
      const y1 = Math.min(y0 + 1, rows - 1);

      const fx = srcX - x0;
      const fy = srcY - y0;

      // Bilinear interpolation
      const v00 = sourceData[y0 * columns + x0];
      const v10 = sourceData[y0 * columns + x1];
      const v01 = sourceData[y1 * columns + x0];
      const v11 = sourceData[y1 * columns + x1];

      let value = v00 * (1 - fx) * (1 - fy) +
                  v10 * fx * (1 - fy) +
                  v01 * (1 - fx) * fy +
                  v11 * fx * fy;

      // Apply normalization
      switch (normalize) {
        case 'minmax':
          value = (value - min) / (max - min);
          break;
        case 'zscore':
          value = (value - mean) / stdDev;
          break;
        case 'histogram':
          // Simplified histogram equalization
          value = (value - min) / (max - min);
          break;
      }

      result[y * targetSize.width + x] = value;
    }
  }

  return result;
}

/**
 * Cancel a pending task
 */
function cancelTask(taskId: string): void {
  const task = pendingTasks.get(taskId);
  if (task) {
    task.cancelled = true;
  }
}

// Export types for main thread
export type {
  PixelDataPayload,
  HistogramResult,
  WindowingPayload,
  ROIPayload,
  MetadataParsePayload,
  NormalizePayload,
};
