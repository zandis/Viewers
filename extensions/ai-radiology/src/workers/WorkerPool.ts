/**
 * Worker Pool Manager
 * Manages a pool of Web Workers for parallel DICOM processing
 * Features: auto-scaling, task queuing, load balancing, graceful degradation
 */

import type { WorkerMessage, WorkerResponse, WorkerMessageType } from './dicomWorker';

interface QueuedTask {
  id: string;
  message: WorkerMessage;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
  priority: number;
  timestamp: number;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
  processedCount: number;
  errorCount: number;
}

export interface WorkerPoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  taskTimeout?: number;
  workerScript?: string;
}

const DEFAULT_CONFIG: Required<WorkerPoolConfig> = {
  minWorkers: 2,
  maxWorkers: navigator.hardwareConcurrency || 4,
  idleTimeout: 30000,
  taskTimeout: 60000,
  workerScript: '/workers/dicomWorker.js',
};

/**
 * Worker Pool for managing parallel DICOM processing tasks
 */
export class WorkerPool {
  private config: Required<WorkerPoolConfig>;
  private workers: WorkerInstance[] = [];
  private taskQueue: QueuedTask[] = [];
  private taskMap = new Map<string, QueuedTask>();
  private idleTimers = new Map<Worker, NodeJS.Timeout>();
  private taskTimeouts = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;
  private taskIdCounter = 0;
  private totalProcessed = 0;
  private totalErrors = 0;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeMinWorkers();
  }

  /**
   * Initialize minimum number of workers
   */
  private initializeMinWorkers(): void {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Create a new worker instance
   */
  private createWorker(): WorkerInstance | null {
    if (this.workers.length >= this.config.maxWorkers) {
      return null;
    }

    try {
      // Use inline worker if external script fails
      const workerCode = this.getInlineWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const instance: WorkerInstance = {
        worker,
        busy: false,
        currentTaskId: null,
        processedCount: 0,
        errorCount: 0,
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(instance, event.data);
      };

      worker.onerror = (error: ErrorEvent) => {
        this.handleWorkerError(instance, error);
      };

      this.workers.push(instance);
      return instance;
    } catch (error) {
      console.error('[WorkerPool] Failed to create worker:', error);
      return null;
    }
  }

  /**
   * Get inline worker code for fallback
   */
  private getInlineWorkerCode(): string {
    return `
      const pendingTasks = new Map();

      self.onmessage = async (event) => {
        const { id, type, payload } = event.data;
        pendingTasks.set(id, { cancelled: false });

        try {
          let result;

          switch (type) {
            case 'PROCESS_PIXEL_DATA':
              result = processPixelData(id, payload);
              break;
            case 'CALCULATE_HISTOGRAM':
              result = calculateHistogram(payload);
              break;
            case 'APPLY_WINDOWING':
              result = applyWindowing(payload);
              break;
            case 'CALCULATE_STATISTICS':
              result = calculateStatistics(payload);
              break;
            case 'CANCEL':
              const task = pendingTasks.get(payload);
              if (task) task.cancelled = true;
              result = { cancelled: true };
              break;
            default:
              throw new Error('Unknown message type: ' + type);
          }

          if (!pendingTasks.get(id)?.cancelled) {
            self.postMessage({ id, success: true, result });
          }
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        } finally {
          pendingTasks.delete(id);
        }
      };

      function processPixelData(taskId, payload) {
        const { pixelData, rescaleSlope = 1, rescaleIntercept = 0 } = payload;
        const sourceData = new Int16Array(pixelData);
        const result = new Float32Array(sourceData.length);

        for (let i = 0; i < sourceData.length; i++) {
          if (pendingTasks.get(taskId)?.cancelled) throw new Error('Cancelled');
          result[i] = sourceData[i] * rescaleSlope + rescaleIntercept;
        }

        return result;
      }

      function calculateHistogram(payload) {
        const { pixelData } = payload;
        const data = new Int16Array(pixelData);
        const bins = new Array(256).fill(0);

        let min = Infinity, max = -Infinity, sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          min = Math.min(min, v);
          max = Math.max(max, v);
          sum += v;
        }

        const range = max - min || 1;
        for (let i = 0; i < data.length; i++) {
          const bin = Math.floor(((data[i] - min) / range) * 255);
          bins[Math.max(0, Math.min(255, bin))]++;
        }

        return { bins, min, max, mean: sum / data.length };
      }

      function applyWindowing(payload) {
        const { pixelData, windowCenter, windowWidth } = payload;
        const sourceData = new Int16Array(pixelData);
        const result = new Uint8Array(sourceData.length);

        const minVal = windowCenter - windowWidth / 2;
        const maxVal = windowCenter + windowWidth / 2;

        for (let i = 0; i < sourceData.length; i++) {
          const v = sourceData[i];
          if (v <= minVal) result[i] = 0;
          else if (v >= maxVal) result[i] = 255;
          else result[i] = Math.round(((v - minVal) / windowWidth) * 255);
        }

        return result.buffer;
      }

      function calculateStatistics(payload) {
        const { pixelData } = payload;
        const data = new Int16Array(pixelData);

        let sum = 0, sumSq = 0, min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          sum += v;
          sumSq += v * v;
          min = Math.min(min, v);
          max = Math.max(max, v);
        }

        const mean = sum / data.length;
        const variance = sumSq / data.length - mean * mean;

        return { count: data.length, min, max, mean, stdDev: Math.sqrt(variance), sum };
      }
    `;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(instance: WorkerInstance, response: WorkerResponse): void {
    const task = this.taskMap.get(response.id);

    if (!task) {
      return;
    }

    // Handle progress updates
    if (response.progress !== undefined && task.onProgress) {
      task.onProgress(response.progress);
      return;
    }

    // Clear timeout
    const timeout = this.taskTimeouts.get(response.id);
    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(response.id);
    }

    // Mark worker as available
    instance.busy = false;
    instance.currentTaskId = null;
    instance.processedCount++;
    this.totalProcessed++;

    // Remove from task map
    this.taskMap.delete(response.id);

    // Resolve or reject the task
    if (response.success) {
      task.resolve(response.result);
    } else {
      instance.errorCount++;
      this.totalErrors++;
      task.reject(new Error(response.error || 'Unknown worker error'));
    }

    // Process next task in queue
    this.processQueue();

    // Set idle timer
    this.setIdleTimer(instance);
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(instance: WorkerInstance, error: ErrorEvent): void {
    console.error('[WorkerPool] Worker error:', error);

    instance.errorCount++;
    this.totalErrors++;

    // Reject current task
    if (instance.currentTaskId) {
      const task = this.taskMap.get(instance.currentTaskId);
      if (task) {
        task.reject(new Error(`Worker error: ${error.message}`));
        this.taskMap.delete(instance.currentTaskId);
      }
    }

    // Replace failed worker if error count is too high
    if (instance.errorCount > 5) {
      this.replaceWorker(instance);
    } else {
      instance.busy = false;
      instance.currentTaskId = null;
      this.processQueue();
    }
  }

  /**
   * Replace a problematic worker
   */
  private replaceWorker(instance: WorkerInstance): void {
    const index = this.workers.indexOf(instance);
    if (index !== -1) {
      instance.worker.terminate();
      this.workers.splice(index, 1);
    }

    // Create replacement if below minimum
    if (this.workers.length < this.config.minWorkers) {
      this.createWorker();
    }

    this.processQueue();
  }

  /**
   * Set idle timer for worker
   */
  private setIdleTimer(instance: WorkerInstance): void {
    const existingTimer = this.idleTimers.get(instance.worker);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Don't set timer for minimum workers
    if (this.workers.length <= this.config.minWorkers) {
      return;
    }

    const timer = setTimeout(() => {
      if (!instance.busy && this.workers.length > this.config.minWorkers) {
        const index = this.workers.indexOf(instance);
        if (index !== -1) {
          instance.worker.terminate();
          this.workers.splice(index, 1);
        }
      }
    }, this.config.idleTimeout);

    this.idleTimers.set(instance.worker, timer);
  }

  /**
   * Execute a task in the worker pool
   */
  async execute<T>(
    type: WorkerMessageType,
    payload: unknown,
    options: { priority?: number; onProgress?: (progress: number) => void } = {}
  ): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const id = `task_${++this.taskIdCounter}_${Date.now()}`;
    const { priority = 2, onProgress } = options;

    return new Promise((resolve, reject) => {
      const task: QueuedTask = {
        id,
        message: { id, type, payload },
        resolve: resolve as (result: unknown) => void,
        reject,
        onProgress,
        priority,
        timestamp: Date.now(),
      };

      this.taskQueue.push(task);
      this.taskMap.set(id, task);

      // Sort queue by priority (lower number = higher priority)
      this.taskQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    let availableWorker = this.workers.find(w => !w.busy);

    // Create new worker if needed and allowed
    if (!availableWorker && this.workers.length < this.config.maxWorkers) {
      availableWorker = this.createWorker() || undefined;
    }

    if (!availableWorker) {
      return;
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Clear idle timer
    const idleTimer = this.idleTimers.get(availableWorker.worker);
    if (idleTimer) {
      clearTimeout(idleTimer);
      this.idleTimers.delete(availableWorker.worker);
    }

    // Assign task to worker
    availableWorker.busy = true;
    availableWorker.currentTaskId = task.id;

    // Set task timeout
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, this.config.taskTimeout);
    this.taskTimeouts.set(task.id, timeout);

    // Send task to worker
    availableWorker.worker.postMessage(task.message);

    // Continue processing queue
    if (this.taskQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task) {
      return;
    }

    // Find worker running this task
    const instance = this.workers.find(w => w.currentTaskId === taskId);
    if (instance) {
      // Send cancel message
      instance.worker.postMessage({
        id: `cancel_${taskId}`,
        type: 'CANCEL',
        payload: taskId,
      });

      instance.busy = false;
      instance.currentTaskId = null;
      instance.errorCount++;
    }

    this.taskMap.delete(taskId);
    this.taskTimeouts.delete(taskId);
    task.reject(new Error('Task timeout'));

    this.processQueue();
  }

  /**
   * Cancel a pending task
   */
  cancel(taskId: string): void {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue.splice(queueIndex, 1)[0];
      task.reject(new Error('Task cancelled'));
      this.taskMap.delete(taskId);
      return;
    }

    // Cancel running task
    const instance = this.workers.find(w => w.currentTaskId === taskId);
    if (instance) {
      instance.worker.postMessage({
        id: `cancel_${taskId}`,
        type: 'CANCEL',
        payload: taskId,
      });
    }
  }

  /**
   * Cancel all pending tasks
   */
  cancelAll(): void {
    // Cancel queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('All tasks cancelled'));
      this.taskMap.delete(task.id);
    }
    this.taskQueue = [];

    // Cancel running tasks
    for (const instance of this.workers) {
      if (instance.currentTaskId) {
        instance.worker.postMessage({
          id: `cancel_${instance.currentTaskId}`,
          type: 'CANCEL',
          payload: instance.currentTaskId,
        });
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    workers: number;
    busyWorkers: number;
    queueLength: number;
    totalProcessed: number;
    totalErrors: number;
  } {
    return {
      workers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.taskQueue.length,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
    };
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(graceful = true): Promise<void> {
    this.isShuttingDown = true;

    if (graceful) {
      // Wait for queue to drain
      while (this.taskQueue.length > 0 || this.workers.some(w => w.busy)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      this.cancelAll();
    }

    // Clear all timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.taskTimeouts.values()) {
      clearTimeout(timer);
    }

    // Terminate all workers
    for (const instance of this.workers) {
      instance.worker.terminate();
    }

    this.workers = [];
    this.taskQueue = [];
    this.taskMap.clear();
    this.idleTimers.clear();
    this.taskTimeouts.clear();
  }
}

// Singleton instance
let poolInstance: WorkerPool | null = null;

/**
 * Get the shared worker pool instance
 */
export function getWorkerPool(config?: WorkerPoolConfig): WorkerPool {
  if (!poolInstance) {
    poolInstance = new WorkerPool(config);
  }
  return poolInstance;
}

/**
 * Shutdown the shared worker pool
 */
export async function shutdownWorkerPool(graceful = true): Promise<void> {
  if (poolInstance) {
    await poolInstance.shutdown(graceful);
    poolInstance = null;
  }
}
