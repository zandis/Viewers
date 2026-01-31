/**
 * Image Processing Algorithms
 * 30 Production-grade image analysis functions
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ImageMetadata {
  width: number;
  height: number;
  depth?: number;
  spacing: [number, number, number?];
  origin: [number, number, number?];
  modality: string;
  bitsAllocated: number;
  bitsStored: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number;
  windowWidth: number;
}

export interface ROI {
  id: string;
  type: 'rectangle' | 'ellipse' | 'freehand' | 'polygon';
  points: Array<{ x: number; y: number }>;
  sliceIndex?: number;
  label?: string;
}

export interface HistogramData {
  bins: number[];
  counts: number[];
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  mode: number;
  median: number;
}

export interface TextureFeatures {
  contrast: number;
  correlation: number;
  energy: number;
  homogeneity: number;
  entropy: number;
  dissimilarity: number;
  clusterShade: number;
  clusterProminence: number;
}

export interface EdgeDetectionResult {
  magnitude: Float32Array;
  direction: Float32Array;
  edges: Uint8Array;
  edgePixelCount: number;
}

export interface SegmentationMask {
  data: Uint8Array;
  width: number;
  height: number;
  labels: Map<number, string>;
  statistics: Map<number, { area: number; perimeter: number; centroid: [number, number] }>;
}

// ============================================================================
// 41-50: HISTOGRAM AND INTENSITY FUNCTIONS
// ============================================================================

/**
 * 41. Calculate comprehensive histogram
 */
export function calculateHistogram(
  pixelData: Int16Array | Float32Array | Uint8Array,
  numBins = 256,
  range?: [number, number]
): HistogramData {
  const n = pixelData.length;

  // Handle empty input
  if (n === 0) {
    return {
      bins: [],
      counts: [],
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      mode: 0,
      median: 0,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;

  // First pass: find min, max, mean
  for (let i = 0; i < n; i++) {
    const val = pixelData[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
    sumSq += val * val;
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Use provided range or calculated
  const rangeMin = range ? range[0] : min;
  const rangeMax = range ? range[1] : max;

  // Guard against zero range (all values identical)
  const binWidth = rangeMax > rangeMin ? (rangeMax - rangeMin) / numBins : 1;

  // Build histogram
  const counts = new Array(numBins).fill(0);
  for (let i = 0; i < n; i++) {
    const val = pixelData[i];
    if (val >= rangeMin && val <= rangeMax) {
      const bin = Math.min(Math.floor((val - rangeMin) / binWidth), numBins - 1);
      counts[bin]++;
    }
  }

  // Find mode
  let modeIndex = 0;
  let maxCount = counts[0];
  for (let i = 1; i < numBins; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      modeIndex = i;
    }
  }
  const mode = rangeMin + (modeIndex + 0.5) * binWidth;

  // Calculate median
  const sorted = [...pixelData].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const bins = Array.from({ length: numBins }, (_, i) => rangeMin + (i + 0.5) * binWidth);

  return { bins, counts, min, max, mean, stdDev, mode, median };
}

/**
 * 42. Histogram equalization
 */
export function equalizeHistogram(
  pixelData: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const histogram = new Array(256).fill(0);
  const n = width * height;

  // Build histogram
  for (let i = 0; i < n; i++) {
    histogram[pixelData[i]]++;
  }

  // Build CDF
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Find CDF min
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }

  // Create lookup table
  const lut = new Uint8Array(256);
  const scale = 255 / (n - cdfMin);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round((cdf[i] - cdfMin) * scale);
  }

  // Apply equalization
  const output = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    output[i] = lut[pixelData[i]];
  }

  return output;
}

/**
 * 43. Contrast Limited Adaptive Histogram Equalization (CLAHE)
 */
export function applyCLAHE(
  pixelData: Uint8Array,
  width: number,
  height: number,
  clipLimit = 2.0,
  tileSize = 8
): Uint8Array {
  const output = new Uint8Array(pixelData.length);
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);

  // Process each tile
  const tileLUTs: Uint8Array[][] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    tileLUTs[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const startX = tx * tileSize;
      const startY = ty * tileSize;
      const endX = Math.min(startX + tileSize, width);
      const endY = Math.min(startY + tileSize, height);

      // Extract tile histogram
      const histogram = new Array(256).fill(0);
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          histogram[pixelData[y * width + x]]++;
          count++;
        }
      }

      // Clip histogram
      const clipValue = Math.floor(clipLimit * count / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipValue) {
          excess += histogram[i] - clipValue;
          histogram[i] = clipValue;
        }
      }

      // Redistribute excess
      const redistribution = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) {
        histogram[i] += redistribution;
      }

      // Build CDF and LUT
      const lut = new Uint8Array(256);
      let cdf = 0;
      const scale = 255 / count;
      for (let i = 0; i < 256; i++) {
        cdf += histogram[i];
        lut[i] = Math.round(cdf * scale);
      }

      tileLUTs[ty][tx] = lut;
    }
  }

  // Bilinear interpolation between tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tx = x / tileSize - 0.5;
      const ty = y / tileSize - 0.5;

      const tx0 = Math.max(0, Math.floor(tx));
      const ty0 = Math.max(0, Math.floor(ty));
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const ty1 = Math.min(tilesY - 1, ty0 + 1);

      const fx = tx - tx0;
      const fy = ty - ty0;

      const val = pixelData[y * width + x];

      const v00 = tileLUTs[ty0][tx0][val];
      const v10 = tileLUTs[ty0][tx1][val];
      const v01 = tileLUTs[ty1][tx0][val];
      const v11 = tileLUTs[ty1][tx1][val];

      output[y * width + x] = Math.round(
        (1 - fx) * (1 - fy) * v00 +
        fx * (1 - fy) * v10 +
        (1 - fx) * fy * v01 +
        fx * fy * v11
      );
    }
  }

  return output;
}

/**
 * 44. Automatic window/level calculation
 */
export function calculateAutoWindowLevel(
  pixelData: Int16Array | Float32Array,
  percentileLow = 0.02,
  percentileHigh = 0.98
): { windowCenter: number; windowWidth: number } {
  const sorted = [...pixelData].sort((a, b) => a - b);
  const n = sorted.length;

  const lowIndex = Math.floor(n * percentileLow);
  const highIndex = Math.floor(n * percentileHigh);

  const lowValue = sorted[lowIndex];
  const highValue = sorted[highIndex];

  const windowWidth = highValue - lowValue;
  const windowCenter = lowValue + windowWidth / 2;

  return {
    windowCenter: Math.round(windowCenter),
    windowWidth: Math.round(windowWidth),
  };
}

/**
 * 45. Apply window/level transformation
 */
export function applyWindowLevel(
  pixelData: Int16Array | Float32Array,
  windowCenter: number,
  windowWidth: number,
  outputRange = 255
): Uint8Array {
  const output = new Uint8Array(pixelData.length);
  const minValue = windowCenter - windowWidth / 2;
  const maxValue = windowCenter + windowWidth / 2;
  const scale = outputRange / windowWidth;

  for (let i = 0; i < pixelData.length; i++) {
    const val = pixelData[i];
    if (val <= minValue) {
      output[i] = 0;
    } else if (val >= maxValue) {
      output[i] = outputRange;
    } else {
      output[i] = Math.round((val - minValue) * scale);
    }
  }

  return output;
}

/**
 * 46. Normalize image intensity
 */
export function normalizeIntensity(
  pixelData: Float32Array,
  targetMean = 0,
  targetStd = 1
): Float32Array {
  const n = pixelData.length;
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    sum += pixelData[i];
    sumSq += pixelData[i] * pixelData[i];
  }

  const mean = sum / n;
  const std = Math.sqrt(sumSq / n - mean * mean) || 1;

  const output = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    output[i] = ((pixelData[i] - mean) / std) * targetStd + targetMean;
  }

  return output;
}

/**
 * 47. Convert HU to density
 */
export function convertHUToDensity(huValue: number): {
  density: number;
  tissue: string;
} {
  // Approximate linear relationship
  const density = (huValue + 1000) / 1000;

  let tissue: string;
  if (huValue < -950) tissue = 'Air';
  else if (huValue < -500) tissue = 'Lung';
  else if (huValue < -100) tissue = 'Fat';
  else if (huValue < 20) tissue = 'Water/Fluid';
  else if (huValue < 80) tissue = 'Soft Tissue';
  else if (huValue < 300) tissue = 'Blood/Contrast';
  else tissue = 'Bone';

  return { density: Math.round(density * 1000) / 1000, tissue };
}

/**
 * 48. Intensity thresholding with Otsu's method
 */
export function otsuThreshold(pixelData: Uint8Array): {
  threshold: number;
  mask: Uint8Array;
} {
  const histogram = new Array(256).fill(0);
  const n = pixelData.length;

  for (let i = 0; i < n; i++) {
    histogram[pixelData[i]]++;
  }

  let total = n;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) {
    sumTotal += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    const variance = weightBackground * weightForeground *
      Math.pow(meanBackground - meanForeground, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    mask[i] = pixelData[i] > threshold ? 255 : 0;
  }

  return { threshold, mask };
}

/**
 * 49-50: Additional intensity functions
 */
export function calculatePercentiles(
  pixelData: Int16Array | Float32Array,
  percentiles: number[]
): number[] {
  const sorted = [...pixelData].sort((a, b) => a - b);
  const n = sorted.length;

  return percentiles.map(p => {
    const index = Math.floor((p / 100) * (n - 1));
    return sorted[index];
  });
}

export function stretchContrast(
  pixelData: Uint8Array,
  lowPercentile = 1,
  highPercentile = 99
): Uint8Array {
  const sorted = [...pixelData].sort((a, b) => a - b);
  const n = sorted.length;

  const lowValue = sorted[Math.floor(n * lowPercentile / 100)];
  const highValue = sorted[Math.floor(n * highPercentile / 100)];
  const range = highValue - lowValue || 1;

  const output = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const val = pixelData[i];
    if (val <= lowValue) output[i] = 0;
    else if (val >= highValue) output[i] = 255;
    else output[i] = Math.round((val - lowValue) / range * 255);
  }

  return output;
}

// ============================================================================
// 51-60: FILTERING AND SMOOTHING FUNCTIONS
// ============================================================================

/**
 * 51. Gaussian blur
 */
export function gaussianBlur(
  pixelData: Uint8Array,
  width: number,
  height: number,
  sigma = 1.0
): Uint8Array {
  const kernelSize = Math.ceil(sigma * 6) | 1; // Ensure odd
  const halfSize = Math.floor(kernelSize / 2);

  // Generate Gaussian kernel
  const kernel = new Float32Array(kernelSize);
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - halfSize;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  // Horizontal pass
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const srcX = Math.min(Math.max(x + k - halfSize, 0), width - 1);
        value += pixelData[y * width + srcX] * kernel[k];
      }
      temp[y * width + x] = value;
    }
  }

  // Vertical pass
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const srcY = Math.min(Math.max(y + k - halfSize, 0), height - 1);
        value += temp[srcY * width + x] * kernel[k];
      }
      output[y * width + x] = Math.round(value);
    }
  }

  return output;
}

/**
 * 52. Median filter (noise reduction)
 */
export function medianFilter(
  pixelData: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const output = new Uint8Array(width * height);
  const halfSize = Math.floor(kernelSize / 2);
  const window: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      window.length = 0;

      for (let ky = -halfSize; ky <= halfSize; ky++) {
        for (let kx = -halfSize; kx <= halfSize; kx++) {
          const srcX = Math.min(Math.max(x + kx, 0), width - 1);
          const srcY = Math.min(Math.max(y + ky, 0), height - 1);
          window.push(pixelData[srcY * width + srcX]);
        }
      }

      window.sort((a, b) => a - b);
      output[y * width + x] = window[Math.floor(window.length / 2)];
    }
  }

  return output;
}

/**
 * 53. Bilateral filter (edge-preserving smoothing)
 */
export function bilateralFilter(
  pixelData: Uint8Array,
  width: number,
  height: number,
  spatialSigma = 3,
  rangeSigma = 50
): Uint8Array {
  const output = new Uint8Array(width * height);
  const kernelSize = Math.ceil(spatialSigma * 3) * 2 + 1;
  const halfSize = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerValue = pixelData[y * width + x];
      let sum = 0;
      let weightSum = 0;

      for (let ky = -halfSize; ky <= halfSize; ky++) {
        for (let kx = -halfSize; kx <= halfSize; kx++) {
          const srcX = Math.min(Math.max(x + kx, 0), width - 1);
          const srcY = Math.min(Math.max(y + ky, 0), height - 1);
          const neighborValue = pixelData[srcY * width + srcX];

          const spatialWeight = Math.exp(
            -(kx * kx + ky * ky) / (2 * spatialSigma * spatialSigma)
          );
          const rangeWeight = Math.exp(
            -Math.pow(neighborValue - centerValue, 2) / (2 * rangeSigma * rangeSigma)
          );
          const weight = spatialWeight * rangeWeight;

          sum += neighborValue * weight;
          weightSum += weight;
        }
      }

      output[y * width + x] = Math.round(sum / weightSum);
    }
  }

  return output;
}

/**
 * 54. Unsharp masking (sharpening)
 */
export function unsharpMask(
  pixelData: Uint8Array,
  width: number,
  height: number,
  amount = 1.5,
  radius = 1.0
): Uint8Array {
  const blurred = gaussianBlur(pixelData, width, height, radius);
  const output = new Uint8Array(width * height);

  for (let i = 0; i < pixelData.length; i++) {
    const diff = pixelData[i] - blurred[i];
    output[i] = Math.max(0, Math.min(255, Math.round(pixelData[i] + amount * diff)));
  }

  return output;
}

/**
 * 55. Anisotropic diffusion (Perona-Malik)
 */
export function anisotropicDiffusion(
  pixelData: Float32Array,
  width: number,
  height: number,
  iterations = 10,
  kappa = 30,
  lambda = 0.25
): Float32Array {
  let current = new Float32Array(pixelData);
  const next = new Float32Array(pixelData.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const center = current[idx];

        // Calculate gradients
        const gN = y > 0 ? current[(y - 1) * width + x] - center : 0;
        const gS = y < height - 1 ? current[(y + 1) * width + x] - center : 0;
        const gE = x < width - 1 ? current[y * width + x + 1] - center : 0;
        const gW = x > 0 ? current[y * width + x - 1] - center : 0;

        // Conduction coefficients
        const cN = Math.exp(-(gN * gN) / (kappa * kappa));
        const cS = Math.exp(-(gS * gS) / (kappa * kappa));
        const cE = Math.exp(-(gE * gE) / (kappa * kappa));
        const cW = Math.exp(-(gW * gW) / (kappa * kappa));

        next[idx] = center + lambda * (cN * gN + cS * gS + cE * gE + cW * gW);
      }
    }

    [current, next].reverse();
  }

  return current;
}

/**
 * 56-60: Additional filtering functions
 */
export function laplacianOfGaussian(
  pixelData: Uint8Array,
  width: number,
  height: number,
  sigma = 1.4
): Float32Array {
  const blurred = gaussianBlur(pixelData, width, height, sigma);
  const output = new Float32Array(width * height);

  // Laplacian kernel
  const kernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += blurred[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      output[y * width + x] = sum;
    }
  }

  return output;
}

export function morphologicalOpen(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const eroded = morphologicalErode(mask, width, height, kernelSize);
  return morphologicalDilate(eroded, width, height, kernelSize);
}

export function morphologicalClose(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const dilated = morphologicalDilate(mask, width, height, kernelSize);
  return morphologicalErode(dilated, width, height, kernelSize);
}

export function morphologicalErode(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const output = new Uint8Array(mask.length);
  const half = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          min = Math.min(min, mask[sy * width + sx]);
        }
      }
      output[y * width + x] = min;
    }
  }

  return output;
}

export function morphologicalDilate(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize = 3
): Uint8Array {
  const output = new Uint8Array(mask.length);
  const half = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          max = Math.max(max, mask[sy * width + sx]);
        }
      }
      output[y * width + x] = max;
    }
  }

  return output;
}

// ============================================================================
// 61-70: EDGE DETECTION AND SEGMENTATION
// ============================================================================

/**
 * 61. Canny edge detection
 */
export function cannyEdgeDetection(
  pixelData: Uint8Array,
  width: number,
  height: number,
  lowThreshold = 50,
  highThreshold = 150
): EdgeDetectionResult {
  // Gaussian blur
  const blurred = gaussianBlur(pixelData, width, height, 1.4);

  // Sobel gradients
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = blurred[(y + ky) * width + (x + kx)];
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += val * sobelX[ki];
          gy += val * sobelY[ki];
        }
      }

      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  // Non-maximum suppression
  const suppressed = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx] * 180 / Math.PI;
      const mag = magnitude[idx];

      let neighbor1 = 0;
      let neighbor2 = 0;

      if ((angle >= -22.5 && angle < 22.5) || angle >= 157.5 || angle < -157.5) {
        neighbor1 = magnitude[idx - 1];
        neighbor2 = magnitude[idx + 1];
      } else if ((angle >= 22.5 && angle < 67.5) || (angle >= -157.5 && angle < -112.5)) {
        neighbor1 = magnitude[(y - 1) * width + (x + 1)];
        neighbor2 = magnitude[(y + 1) * width + (x - 1)];
      } else if ((angle >= 67.5 && angle < 112.5) || (angle >= -112.5 && angle < -67.5)) {
        neighbor1 = magnitude[(y - 1) * width + x];
        neighbor2 = magnitude[(y + 1) * width + x];
      } else {
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }

      suppressed[idx] = (mag >= neighbor1 && mag >= neighbor2) ? mag : 0;
    }
  }

  // Hysteresis thresholding
  const edges = new Uint8Array(width * height);
  let edgePixelCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (suppressed[idx] >= highThreshold) {
        edges[idx] = 255;
        edgePixelCount++;
      } else if (suppressed[idx] >= lowThreshold) {
        // Check if connected to strong edge
        let hasStrongNeighbor = false;
        for (let ky = -1; ky <= 1 && !hasStrongNeighbor; ky++) {
          for (let kx = -1; kx <= 1 && !hasStrongNeighbor; kx++) {
            if (suppressed[(y + ky) * width + (x + kx)] >= highThreshold) {
              hasStrongNeighbor = true;
            }
          }
        }
        if (hasStrongNeighbor) {
          edges[idx] = 255;
          edgePixelCount++;
        }
      }
    }
  }

  return { magnitude, direction, edges, edgePixelCount };
}

/**
 * 62. Connected component labeling
 */
export function labelConnectedComponents(
  binaryMask: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; numComponents: number; sizes: Map<number, number> } {
  const labels = new Int32Array(width * height);
  let currentLabel = 0;
  const sizes = new Map<number, number>();

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 0 || labels[idx] !== 0) continue;

      currentLabel++;
      let size = 0;
      const queue: [number, number][] = [[x, y]];

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const cIdx = cy * width + cx;

        if (labels[cIdx] !== 0) continue;
        if (binaryMask[cIdx] === 0) continue;

        labels[cIdx] = currentLabel;
        size++;

        for (const [dy, dx] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (binaryMask[nIdx] > 0 && labels[nIdx] === 0) {
              queue.push([nx, ny]);
            }
          }
        }
      }

      sizes.set(currentLabel, size);
    }
  }

  return { labels, numComponents: currentLabel, sizes };
}

/**
 * 63. Region growing segmentation
 */
export function regionGrowing(
  pixelData: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  threshold = 20
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const seedValue = pixelData[seedY * width + seedX];
  const visited = new Set<number>();

  const queue: [number, number][] = [[seedX, seedY]];
  const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const idx = y * width + x;

    if (visited.has(idx)) continue;
    visited.add(idx);

    const value = pixelData[idx];
    if (Math.abs(value - seedValue) <= threshold) {
      mask[idx] = 255;

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited.has(nIdx)) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  return mask;
}

/**
 * 64. Watershed segmentation
 */
export function watershedSegmentation(
  pixelData: Uint8Array,
  markers: Int32Array,
  width: number,
  height: number
): Int32Array {
  const labels = new Int32Array(markers);
  const WSHED = -1;

  // Priority queue (simplified with array)
  const queue: Array<{ x: number; y: number; priority: number }> = [];

  const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  // Initialize queue with marker boundaries
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] > 0) {
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (labels[nIdx] === 0) {
              queue.push({ x: nx, y: ny, priority: pixelData[nIdx] });
            }
          }
        }
      }
    }
  }

  // Sort by priority (intensity)
  queue.sort((a, b) => a.priority - b.priority);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const idx = y * width + x;

    if (labels[idx] !== 0) continue;

    // Check neighbors
    const neighborLabels = new Set<number>();
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nLabel = labels[ny * width + nx];
        if (nLabel > 0) neighborLabels.add(nLabel);
      }
    }

    if (neighborLabels.size === 1) {
      labels[idx] = neighborLabels.values().next().value;

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (labels[nIdx] === 0) {
            queue.push({ x: nx, y: ny, priority: pixelData[nIdx] });
            queue.sort((a, b) => a.priority - b.priority);
          }
        }
      }
    } else if (neighborLabels.size > 1) {
      labels[idx] = WSHED;
    }
  }

  return labels;
}

/**
 * 65-70: Additional segmentation functions
 */
export function calculateROIStatistics(
  pixelData: Int16Array | Float32Array,
  roi: ROI,
  width: number
): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  area: number;
  perimeter: number;
} {
  const values: number[] = [];

  // Get bounding box
  const xs = roi.points.map(p => p.x);
  const ys = roi.points.map(p => p.y);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isPointInPolygon(x, y, roi.points)) {
        values.push(pixelData[y * width + x]);
      }
    }
  }

  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, area: 0, perimeter: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 0; i < roi.points.length; i++) {
    const p1 = roi.points[i];
    const p2 = roi.points[(i + 1) % roi.points.length];
    perimeter += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  return {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    area: values.length,
    perimeter,
  };
}

function isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function calculateTextureFeatures(
  pixelData: Uint8Array,
  width: number,
  height: number,
  roi?: ROI
): TextureFeatures {
  // Build GLCM (Gray Level Co-occurrence Matrix)
  const levels = 8;
  const glcm = new Float32Array(levels * levels);
  const scale = 256 / levels;

  let count = 0;

  const minX = roi ? Math.floor(Math.min(...roi.points.map(p => p.x))) : 0;
  const maxX = roi ? Math.ceil(Math.max(...roi.points.map(p => p.x))) : width - 1;
  const minY = roi ? Math.floor(Math.min(...roi.points.map(p => p.y))) : 0;
  const maxY = roi ? Math.ceil(Math.max(...roi.points.map(p => p.y))) : height - 1;

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX - 1; x++) {
      if (roi && !isPointInPolygon(x, y, roi.points)) continue;

      const i = Math.floor(pixelData[y * width + x] / scale);
      const j = Math.floor(pixelData[y * width + x + 1] / scale);

      glcm[i * levels + j]++;
      glcm[j * levels + i]++;
      count += 2;
    }
  }

  // Normalize
  if (count > 0) {
    for (let i = 0; i < glcm.length; i++) {
      glcm[i] /= count;
    }
  }

  // Calculate features
  let contrast = 0;
  let correlation = 0;
  let energy = 0;
  let homogeneity = 0;
  let entropy = 0;
  let dissimilarity = 0;

  let muI = 0, muJ = 0, sigmaI = 0, sigmaJ = 0;

  for (let i = 0; i < levels; i++) {
    for (let j = 0; j < levels; j++) {
      const p = glcm[i * levels + j];
      muI += i * p;
      muJ += j * p;
    }
  }

  for (let i = 0; i < levels; i++) {
    for (let j = 0; j < levels; j++) {
      const p = glcm[i * levels + j];
      sigmaI += (i - muI) ** 2 * p;
      sigmaJ += (j - muJ) ** 2 * p;
    }
  }

  sigmaI = Math.sqrt(sigmaI);
  sigmaJ = Math.sqrt(sigmaJ);

  for (let i = 0; i < levels; i++) {
    for (let j = 0; j < levels; j++) {
      const p = glcm[i * levels + j];
      if (p > 0) {
        contrast += (i - j) ** 2 * p;
        if (sigmaI > 0 && sigmaJ > 0) {
          correlation += (i - muI) * (j - muJ) * p / (sigmaI * sigmaJ);
        }
        energy += p ** 2;
        homogeneity += p / (1 + Math.abs(i - j));
        entropy -= p * Math.log2(p);
        dissimilarity += Math.abs(i - j) * p;
      }
    }
  }

  return {
    contrast,
    correlation,
    energy,
    homogeneity,
    entropy,
    dissimilarity,
    clusterShade: 0,
    clusterProminence: 0,
  };
}

export function findContours(
  binaryMask: Uint8Array,
  width: number,
  height: number
): Array<Array<{ x: number; y: number }>> {
  const contours: Array<Array<{ x: number; y: number }>> = [];
  const visited = new Uint8Array(width * height);

  const directions = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 0 || visited[idx]) continue;

      // Check if boundary pixel
      let isBoundary = false;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height ||
            binaryMask[ny * width + nx] === 0) {
          isBoundary = true;
          break;
        }
      }

      if (!isBoundary) continue;

      // Trace contour
      const contour: Array<{ x: number; y: number }> = [];
      let cx = x;
      let cy = y;
      let dir = 0;

      do {
        contour.push({ x: cx, y: cy });
        visited[cy * width + cx] = 1;

        // Find next boundary pixel
        let found = false;
        for (let i = 0; i < 8; i++) {
          const d = (dir + i) % 8;
          const [dx, dy] = directions[d];
          const nx = cx + dx;
          const ny = cy + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
              binaryMask[ny * width + nx] > 0) {
            cx = nx;
            cy = ny;
            dir = (d + 5) % 8;
            found = true;
            break;
          }
        }

        if (!found) break;
      } while (cx !== x || cy !== y);

      if (contour.length > 2) {
        contours.push(contour);
      }
    }
  }

  return contours;
}

export function fillHoles(
  binaryMask: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const output = new Uint8Array(binaryMask);

  // Flood fill from edges
  const filled = new Uint8Array(width * height);
  const queue: [number, number][] = [];

  // Add edge pixels to queue
  for (let x = 0; x < width; x++) {
    if (binaryMask[x] === 0) queue.push([x, 0]);
    if (binaryMask[(height - 1) * width + x] === 0) queue.push([x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    if (binaryMask[y * width] === 0) queue.push([0, y]);
    if (binaryMask[y * width + width - 1] === 0) queue.push([width - 1, y]);
  }

  const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const idx = y * width + x;

    if (filled[idx] || binaryMask[idx] > 0) continue;
    filled[idx] = 1;

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        queue.push([nx, ny]);
      }
    }
  }

  // Invert: unfilled background pixels are holes
  for (let i = 0; i < output.length; i++) {
    if (filled[i] === 0 && binaryMask[i] === 0) {
      output[i] = 255;
    }
  }

  return output;
}

export function removeSmallObjects(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  minSize: number
): Uint8Array {
  const { labels, sizes } = labelConnectedComponents(binaryMask, width, height);
  const output = new Uint8Array(width * height);

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label > 0 && (sizes.get(label) || 0) >= minSize) {
      output[i] = 255;
    }
  }

  return output;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Histogram and Intensity
  calculateHistogram,
  equalizeHistogram,
  applyCLAHE,
  calculateAutoWindowLevel,
  applyWindowLevel,
  normalizeIntensity,
  convertHUToDensity,
  otsuThreshold,
  calculatePercentiles,
  stretchContrast,

  // Filtering
  gaussianBlur,
  medianFilter,
  bilateralFilter,
  unsharpMask,
  anisotropicDiffusion,
  laplacianOfGaussian,
  morphologicalOpen,
  morphologicalClose,
  morphologicalErode,
  morphologicalDilate,

  // Edge Detection and Segmentation
  cannyEdgeDetection,
  labelConnectedComponents,
  regionGrowing,
  watershedSegmentation,
  calculateROIStatistics,
  calculateTextureFeatures,
  findContours,
  fillHoles,
  removeSmallObjects,
};
