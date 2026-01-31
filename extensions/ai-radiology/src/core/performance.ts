/**
 * Performance Optimization Core
 * Production-grade performance utilities
 */

// ============================================================================
// MEMORY POOL - Zero-allocation pattern
// ============================================================================

export class TypedArrayPool<T extends Float32Array | Uint8Array | Int32Array> {
  private pool: T[] = [];
  private inUse = new Set<T>();
  private ArrayConstructor: new (length: number) => T;
  private maxPoolSize: number;

  constructor(ArrayType: new (length: number) => T, maxPoolSize = 100) {
    this.ArrayConstructor = ArrayType;
    this.maxPoolSize = maxPoolSize;
  }

  acquire(length: number): T {
    // Find existing array of matching size
    const idx = this.pool.findIndex(arr => arr.length >= length);
    if (idx !== -1) {
      const arr = this.pool.splice(idx, 1)[0];
      this.inUse.add(arr);
      return arr;
    }

    // Create new array
    const arr = new this.ArrayConstructor(length);
    this.inUse.add(arr);
    return arr;
  }

  release(arr: T): void {
    if (!this.inUse.has(arr)) return;
    this.inUse.delete(arr);

    if (this.pool.length < this.maxPoolSize) {
      arr.fill(0 as never);
      this.pool.push(arr);
    }
  }

  clear(): void {
    this.pool = [];
    this.inUse.clear();
  }

  getStats(): { pooled: number; inUse: number } {
    return { pooled: this.pool.length, inUse: this.inUse.size };
  }
}

// ============================================================================
// WORKER THREAD POOL
// ============================================================================

export interface WorkerTask<T, R> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  priority: number;
  timeout?: number;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask<unknown, unknown>[] = [];
  private activeJobs = new Map<string, { worker: Worker; task: WorkerTask<unknown, unknown>; timer?: ReturnType<typeof setTimeout> }>();
  private workerScript: string;
  private maxWorkers: number;

  constructor(workerScript: string, maxWorkers = navigator.hardwareConcurrency || 4) {
    this.workerScript = workerScript;
    this.maxWorkers = maxWorkers;
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(this.workerScript);
      worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
      worker.onerror = (e) => this.handleWorkerError(worker, e);
      this.workers.push(worker);
    }
  }

  submit<T, R>(type: string, data: T, priority = 0, timeout?: number): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type,
        data,
        resolve: resolve as (r: unknown) => void,
        reject: reject as (e: Error) => void,
        priority,
        timeout,
      };

      this.taskQueue.push(task as WorkerTask<unknown, unknown>);
      this.taskQueue.sort((a, b) => b.priority - a.priority);
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const availableWorker = this.workers.find(w => !this.isWorkerBusy(w));
      if (!availableWorker) break;

      const task = this.taskQueue.shift()!;
      this.executeTask(availableWorker, task);
    }
  }

  private isWorkerBusy(worker: Worker): boolean {
    for (const job of this.activeJobs.values()) {
      if (job.worker === worker) return true;
    }
    return false;
  }

  private executeTask(worker: Worker, task: WorkerTask<unknown, unknown>): void {
    const job = { worker, task, timer: undefined as ReturnType<typeof setTimeout> | undefined };

    if (task.timeout) {
      job.timer = setTimeout(() => {
        this.activeJobs.delete(task.id);
        task.reject(new Error('Task timeout'));
        this.processQueue();
      }, task.timeout);
    }

    this.activeJobs.set(task.id, job);
    worker.postMessage({ id: task.id, type: task.type, data: task.data });
  }

  private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
    const { id, result, error } = event.data;
    const job = this.activeJobs.get(id);

    if (job) {
      if (job.timer) clearTimeout(job.timer);
      this.activeJobs.delete(id);

      if (error) {
        job.task.reject(new Error(error));
      } else {
        job.task.resolve(result);
      }
    }

    this.processQueue();
  }

  private handleWorkerError(worker: Worker, event: ErrorEvent): void {
    console.error('[WorkerPool] Worker error:', event.message);

    // Find and fail active task
    for (const [id, job] of this.activeJobs) {
      if (job.worker === worker) {
        if (job.timer) clearTimeout(job.timer);
        job.task.reject(new Error(event.message));
        this.activeJobs.delete(id);
        break;
      }
    }

    // Replace failed worker
    const idx = this.workers.indexOf(worker);
    if (idx !== -1) {
      worker.terminate();
      const newWorker = new Worker(this.workerScript);
      newWorker.onmessage = (e) => this.handleWorkerMessage(newWorker, e);
      newWorker.onerror = (e) => this.handleWorkerError(newWorker, e);
      this.workers[idx] = newWorker;
    }

    this.processQueue();
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeJobs.clear();
  }

  getStats(): { workers: number; queued: number; active: number } {
    return {
      workers: this.workers.length,
      queued: this.taskQueue.length,
      active: this.activeJobs.size,
    };
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): T & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true, maxWait } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  let result: ReturnType<T>;

  function invokeFunc(): void {
    if (lastArgs) {
      result = fn(...lastArgs) as ReturnType<T>;
      lastArgs = null;
    }
  }

  function startTimer(wait: number): void {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (trailing && lastArgs) {
        invokeFunc();
      }
    }, wait);
  }

  function debounced(...args: Parameters<T>): ReturnType<T> {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (!timeoutId && leading) {
        invokeFunc();
      }
      if (maxWait && !maxTimeoutId) {
        maxTimeoutId = setTimeout(() => {
          maxTimeoutId = null;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          invokeFunc();
        }, maxWait);
      }
    }

    if (timeoutId) clearTimeout(timeoutId);
    startTimer(delay);

    return result;
  }

  function shouldInvoke(time: number): boolean {
    return lastCallTime === null || time - lastCallTime >= delay;
  }

  debounced.cancel = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    if (maxTimeoutId) clearTimeout(maxTimeoutId);
    timeoutId = maxTimeoutId = null;
    lastArgs = lastCallTime = null;
  };

  debounced.flush = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      invokeFunc();
    }
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function throttled(...args: Parameters<T>): ReturnType<T> | undefined {
    if (!inThrottle) {
      inThrottle = true;
      const result = fn(...args) as ReturnType<T>;

      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled(...lastArgs);
          lastArgs = null;
        }
      }, limit);

      return result;
    }
    lastArgs = args;
    return undefined;
  }

  throttled.cancel = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    inThrottle = false;
    lastArgs = null;
  };

  return throttled as T & { cancel: () => void };
}

// ============================================================================
// VIRTUAL LIST
// ============================================================================

export interface VirtualListConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
}

export interface VirtualListState {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  visibleItems: number[];
}

export class VirtualListManager {
  private config: VirtualListConfig;
  private totalItems = 0;

  constructor(config: VirtualListConfig) {
    this.config = config;
  }

  setTotalItems(count: number): void {
    this.totalItems = count;
  }

  getState(scrollTop: number): VirtualListState {
    const { itemHeight, containerHeight, overscan } = this.config;

    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(this.totalItems - 1, startIndex + visibleCount + overscan * 2);

    const visibleItems: number[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push(i);
    }

    return {
      startIndex,
      endIndex,
      offsetY: startIndex * itemHeight,
      visibleItems,
    };
  }

  getTotalHeight(): number {
    return this.totalItems * this.config.itemHeight;
  }

  scrollToIndex(index: number): number {
    return Math.max(0, index * this.config.itemHeight - this.config.containerHeight / 2);
  }
}

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

export class RequestDeduplicator<K, V> {
  private pending = new Map<string, Promise<V>>();
  private keyFn: (key: K) => string;

  constructor(keyFn: (key: K) => string = (k) => JSON.stringify(k)) {
    this.keyFn = keyFn;
  }

  async dedupe(key: K, requestFn: () => Promise<V>): Promise<V> {
    const cacheKey = this.keyFn(key);

    if (this.pending.has(cacheKey)) {
      return this.pending.get(cacheKey)!;
    }

    const promise = requestFn().finally(() => {
      this.pending.delete(cacheKey);
    });

    this.pending.set(cacheKey, promise);
    return promise;
  }

  clear(): void {
    this.pending.clear();
  }
}

// ============================================================================
// LAZY LOADER
// ============================================================================

export class LazyLoader<T> {
  private cache = new Map<string, T>();
  private loading = new Map<string, Promise<T>>();
  private loader: (id: string) => Promise<T>;
  private maxCacheSize: number;
  private accessOrder: string[] = [];

  constructor(loader: (id: string) => Promise<T>, maxCacheSize = 100) {
    this.loader = loader;
    this.maxCacheSize = maxCacheSize;
  }

  async get(id: string): Promise<T> {
    // Check cache
    if (this.cache.has(id)) {
      this.updateAccessOrder(id);
      return this.cache.get(id)!;
    }

    // Check if loading
    if (this.loading.has(id)) {
      return this.loading.get(id)!;
    }

    // Load
    const promise = this.loader(id);
    this.loading.set(id, promise);

    try {
      const result = await promise;
      this.loading.delete(id);
      this.addToCache(id, result);
      return result;
    } catch (error) {
      this.loading.delete(id);
      throw error;
    }
  }

  private addToCache(id: string, value: T): void {
    // Evict if necessary
    while (this.cache.size >= this.maxCacheSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.cache.delete(oldest);
    }

    this.cache.set(id, value);
    this.accessOrder.push(id);
  }

  private updateAccessOrder(id: string): void {
    const idx = this.accessOrder.indexOf(id);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(id);
    }
  }

  prefetch(ids: string[]): void {
    ids.forEach(id => {
      if (!this.cache.has(id) && !this.loading.has(id)) {
        this.get(id).catch(() => {});
      }
    });
  }

  clear(): void {
    this.cache.clear();
    this.loading.clear();
    this.accessOrder = [];
  }
}

// ============================================================================
// RENDER SCHEDULER
// ============================================================================

export class RenderScheduler {
  private static instance: RenderScheduler;
  private queue: Array<{ id: string; callback: () => void; priority: number }> = [];
  private frameId: number | null = null;
  private isProcessing = false;

  static getInstance(): RenderScheduler {
    return this.instance ??= new RenderScheduler();
  }

  schedule(id: string, callback: () => void, priority = 0): void {
    // Remove existing entry with same id
    this.queue = this.queue.filter(item => item.id !== id);
    this.queue.push({ id, callback, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.requestFrame();
  }

  private requestFrame(): void {
    if (this.frameId !== null || this.isProcessing) return;

    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const startTime = performance.now();
    const frameDeadline = 16; // Target 60fps

    while (this.queue.length > 0 && performance.now() - startTime < frameDeadline) {
      const item = this.queue.shift()!;
      try {
        item.callback();
      } catch (e) {
        console.error('[RenderScheduler] Callback error:', e);
      }
    }

    this.isProcessing = false;

    if (this.queue.length > 0) {
      this.requestFrame();
    }
  }

  cancel(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  clear(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.queue = [];
  }
}

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frames: number[] = [];
  private lastFrameTime = 0;
  private monitoring = false;
  private listeners = new Set<(metrics: PerformanceMetrics) => void>();

  static getInstance(): PerformanceMonitor {
    return this.instance ??= new PerformanceMonitor();
  }

  start(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.measureFrame();
  }

  stop(): void {
    this.monitoring = false;
  }

  private measureFrame(): void {
    if (!this.monitoring) return;

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.frames.push(now - this.lastFrameTime);
      if (this.frames.length > 60) this.frames.shift();
    }
    this.lastFrameTime = now;

    const metrics = this.getMetrics();
    this.listeners.forEach(l => l(metrics));

    requestAnimationFrame(() => this.measureFrame());
  }

  getMetrics(): PerformanceMetrics {
    const avgFrameTime = this.frames.length > 0
      ? this.frames.reduce((a, b) => a + b, 0) / this.frames.length
      : 16.67;

    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

    return {
      fps: Math.round(1000 / avgFrameTime),
      frameTime: Math.round(avgFrameTime * 100) / 100,
      memoryUsage: memory ? memory.usedJSHeapSize / memory.jsHeapSizeLimit : 0,
      cpuUsage: 0, // Not available in browser
      networkLatency: 0,
    };
  }

  subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): PerformanceMeasure | null {
    try {
      if (endMark) {
        return performance.measure(name, startMark, endMark);
      }
      return performance.measure(name, startMark);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TypedArrayPool,
  WorkerPool,
  debounce,
  throttle,
  VirtualListManager,
  RequestDeduplicator,
  LazyLoader,
  RenderScheduler,
  PerformanceMonitor,
};
