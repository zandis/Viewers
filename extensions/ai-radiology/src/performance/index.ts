/**
 * Enterprise Performance Layer
 * Handles high-volume DICOM data with request pooling, caching, and streaming
 * Designed for millions of radiology records
 */

// ============================================================================
// REQUEST POOL - Manages concurrent API requests with backpressure
// ============================================================================

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retryCount: number;
}

interface RequestPoolConfig {
  maxConcurrent: number;
  maxRetries: number;
  retryDelayMs: number;
  requestTimeoutMs: number;
  priorityLevels: number;
}

export class RequestPool {
  private queue: Map<number, QueuedRequest<unknown>[]> = new Map();
  private activeRequests = 0;
  private config: RequestPoolConfig;
  private metrics = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
    currentQueueSize: 0,
  };

  constructor(config: Partial<RequestPoolConfig> = {}) {
    this.config = {
      maxConcurrent: 6,
      maxRetries: 3,
      retryDelayMs: 1000,
      requestTimeoutMs: 30000,
      priorityLevels: 5,
      ...config,
    };

    // Initialize priority queues
    for (let i = 0; i < this.config.priorityLevels; i++) {
      this.queue.set(i, []);
    }
  }

  /**
   * Add a request to the pool with priority
   * Priority 0 = highest, priorityLevels-1 = lowest
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    priority = 2,
    id?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: id || this.generateId(),
        execute,
        priority: Math.min(priority, this.config.priorityLevels - 1),
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      const priorityQueue = this.queue.get(request.priority);
      if (priorityQueue) {
        priorityQueue.push(request);
        this.metrics.totalRequests++;
        this.metrics.currentQueueSize++;
      }

      this.processQueue();
    });
  }

  /**
   * Process queued requests respecting concurrency limits
   */
  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.config.maxConcurrent) {
      return;
    }

    // Get highest priority request
    const request = this.getNextRequest();
    if (!request) {
      return;
    }

    this.activeRequests++;
    this.metrics.currentQueueSize--;

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        request.execute(),
        this.createTimeout(request.id),
      ]);

      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.metrics.completedRequests++;

      request.resolve(result);
    } catch (error) {
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        await this.delay(this.config.retryDelayMs * request.retryCount);

        const priorityQueue = this.queue.get(request.priority);
        if (priorityQueue) {
          priorityQueue.unshift(request);
          this.metrics.currentQueueSize++;
        }
      } else {
        this.metrics.failedRequests++;
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private getNextRequest(): QueuedRequest<unknown> | undefined {
    for (let priority = 0; priority < this.config.priorityLevels; priority++) {
      const queue = this.queue.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  private createTimeout(requestId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request ${requestId} timed out`));
      }, this.config.requestTimeoutMs);
    });
  }

  private updateLatencyMetrics(latency: number): void {
    const total = this.metrics.completedRequests;
    this.metrics.averageLatencyMs =
      (this.metrics.averageLatencyMs * (total - 1) + latency) / total;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clearQueue(): void {
    this.queue.forEach(q => q.length = 0);
    this.metrics.currentQueueSize = 0;
  }
}

// ============================================================================
// LRU CACHE - Memory-efficient caching with size limits
// ============================================================================

interface CacheEntry<T> {
  value: T;
  size: number;
  accessCount: number;
  lastAccess: number;
  createdAt: number;
}

interface LRUCacheConfig {
  maxSize: number; // in bytes
  maxEntries: number;
  ttlMs: number;
  onEvict?: (key: string, value: unknown) => void;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private currentSize = 0;
  private config: LRUCacheConfig;

  constructor(config: Partial<LRUCacheConfig> = {}) {
    this.config = {
      maxSize: 500 * 1024 * 1024, // 500MB default
      maxEntries: 10000,
      ttlMs: 30 * 60 * 1000, // 30 minutes
      ...config,
    };
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.delete(key);
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.value;
  }

  set(key: string, value: T, sizeInBytes?: number): void {
    const size = sizeInBytes || this.estimateSize(value);

    // Evict if necessary
    while (
      (this.currentSize + size > this.config.maxSize ||
        this.cache.size >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry<T> = {
      value,
      size,
      accessCount: 1,
      lastAccess: Date.now(),
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.config.onEvict?.(key, entry.value);
      return this.cache.delete(key);
    }
    return false;
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < lruAccess) {
        lruAccess = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }

  private estimateSize(value: T): number {
    if (typeof value === 'string') return value.length * 2;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    return JSON.stringify(value).length * 2;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      maxSizeBytes: this.config.maxSize,
      utilizationPercent: (this.currentSize / this.config.maxSize) * 100,
    };
  }
}

// ============================================================================
// INDEXED DB STORAGE - Persistent storage for large datasets
// ============================================================================

interface IndexedDBConfig {
  dbName: string;
  version: number;
  stores: StoreConfig[];
}

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes: { name: string; keyPath: string; unique: boolean }[];
}

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private config: IndexedDBConfig;

  constructor(config: Partial<IndexedDBConfig> = {}) {
    this.config = {
      dbName: 'ohif-ai-radiology',
      version: 1,
      stores: [
        {
          name: 'studies',
          keyPath: 'studyInstanceUID',
          indexes: [
            { name: 'patientId', keyPath: 'patientId', unique: false },
            { name: 'studyDate', keyPath: 'studyDate', unique: false },
            { name: 'modality', keyPath: 'modality', unique: false },
            { name: 'accessionNumber', keyPath: 'accessionNumber', unique: false },
          ],
        },
        {
          name: 'series',
          keyPath: 'seriesInstanceUID',
          indexes: [
            { name: 'studyInstanceUID', keyPath: 'studyInstanceUID', unique: false },
            { name: 'modality', keyPath: 'modality', unique: false },
          ],
        },
        {
          name: 'reports',
          keyPath: 'reportId',
          indexes: [
            { name: 'studyInstanceUID', keyPath: 'studyInstanceUID', unique: false },
            { name: 'status', keyPath: 'status', unique: false },
            { name: 'createdAt', keyPath: 'createdAt', unique: false },
          ],
        },
        {
          name: 'aiResults',
          keyPath: 'analysisId',
          indexes: [
            { name: 'studyInstanceUID', keyPath: 'studyInstanceUID', unique: false },
            { name: 'analysisType', keyPath: 'analysisType', unique: false },
          ],
        },
        {
          name: 'cache',
          keyPath: 'key',
          indexes: [
            { name: 'expiry', keyPath: 'expiry', unique: false },
          ],
        },
      ],
      ...config,
    };
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        for (const storeConfig of this.config.stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
            });

            for (const index of storeConfig.indexes) {
              store.createIndex(index.name, index.keyPath, { unique: index.unique });
            }
          }
        }
      };
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as T);
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async query<T>(
    storeName: string,
    indexName: string,
    range: IDBKeyRange | null,
    limit = 100,
    offset = 0
  ): Promise<T[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const results: T[] = [];
      let skipped = 0;

      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
          } else if (results.length < limit) {
            results.push(cursor.value as T);
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          resolve(results);
        }
      };
    });
  }

  async count(storeName: string, indexName?: string, range?: IDBKeyRange): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const target = indexName ? store.index(indexName) : store;
      const request = target.count(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async bulkPut<T>(storeName: string, items: T[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      for (const item of items) {
        store.put(item);
      }
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// ============================================================================
// VIRTUAL SCROLLING - Efficient rendering for large lists
// ============================================================================

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  totalItems: number;
}

export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  visibleItems: number;
}

export function calculateVirtualScroll(
  scrollTop: number,
  config: VirtualScrollConfig
): VirtualScrollState {
  const { itemHeight, containerHeight, overscan, totalItems } = config;

  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    visibleItems,
  };
}

// ============================================================================
// STREAMING DATA PROCESSOR - Handle large DICOM datasets efficiently
// ============================================================================

export class StreamingDataProcessor {
  private chunkSize: number;
  private onProgress?: (progress: number) => void;

  constructor(chunkSize = 1000, onProgress?: (progress: number) => void) {
    this.chunkSize = chunkSize;
    this.onProgress = onProgress;
  }

  async *processInChunks<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): AsyncGenerator<R[], void, unknown> {
    const total = items.length;

    for (let i = 0; i < total; i += this.chunkSize) {
      const chunk = items.slice(i, i + this.chunkSize);
      const results = await Promise.all(chunk.map(processor));

      this.onProgress?.((i + chunk.length) / total);

      yield results;

      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  async processAll<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];

    for await (const chunk of this.processInChunks(items, processor)) {
      results.push(...chunk);
    }

    return results;
  }
}

// ============================================================================
// PAGINATION MANAGER - Handle paginated API responses
// ============================================================================

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationState;
}

export class PaginationManager<T> {
  private pageSize: number;
  private fetchFn: (offset: number, limit: number) => Promise<{ items: T[]; total: number }>;
  private cache: Map<number, T[]> = new Map();

  constructor(
    pageSize: number,
    fetchFn: (offset: number, limit: number) => Promise<{ items: T[]; total: number }>
  ) {
    this.pageSize = pageSize;
    this.fetchFn = fetchFn;
  }

  async getPage(page: number): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * this.pageSize;

    // Check cache
    if (this.cache.has(page)) {
      const items = this.cache.get(page)!;
      const { total } = await this.fetchFn(0, 1); // Get total count
      return this.buildResult(items, page, total);
    }

    const { items, total } = await this.fetchFn(offset, this.pageSize);
    this.cache.set(page, items);

    return this.buildResult(items, page, total);
  }

  private buildResult(items: T[], page: number, total: number): PaginatedResult<T> {
    const totalPages = Math.ceil(total / this.pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize: this.pageSize,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidatePage(page: number): void {
    this.cache.delete(page);
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE UTILITIES
// ============================================================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limitMs);
    }
  };
}

// ============================================================================
// MEMORY MONITOR - Track and prevent memory issues
// ============================================================================

export class MemoryMonitor {
  private warningThreshold: number;
  private criticalThreshold: number;
  private onWarning?: (usage: number) => void;
  private onCritical?: (usage: number) => void;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    warningThresholdMB = 500,
    criticalThresholdMB = 800,
    onWarning?: (usage: number) => void,
    onCritical?: (usage: number) => void
  ) {
    this.warningThreshold = warningThresholdMB * 1024 * 1024;
    this.criticalThreshold = criticalThresholdMB * 1024 * 1024;
    this.onWarning = onWarning;
    this.onCritical = onCritical;
  }

  start(intervalMs = 5000): void {
    if (typeof performance === 'undefined' || !(performance as unknown as { memory?: unknown }).memory) {
      console.warn('Memory monitoring not available in this environment');
      return;
    }

    this.intervalId = setInterval(() => this.check(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  check(): MemoryStats | null {
    if (typeof performance === 'undefined') return null;

    const memory = (performance as unknown as {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }).memory;

    if (!memory) return null;

    const stats: MemoryStats = {
      usedMB: memory.usedJSHeapSize / (1024 * 1024),
      totalMB: memory.totalJSHeapSize / (1024 * 1024),
      limitMB: memory.jsHeapSizeLimit / (1024 * 1024),
      utilizationPercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };

    if (memory.usedJSHeapSize > this.criticalThreshold) {
      this.onCritical?.(stats.usedMB);
    } else if (memory.usedJSHeapSize > this.warningThreshold) {
      this.onWarning?.(stats.usedMB);
    }

    return stats;
  }
}

interface MemoryStats {
  usedMB: number;
  totalMB: number;
  limitMB: number;
  utilizationPercent: number;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const performanceUtils = {
  RequestPool,
  LRUCache,
  IndexedDBStorage,
  StreamingDataProcessor,
  PaginationManager,
  MemoryMonitor,
  calculateVirtualScroll,
  debounce,
  throttle,
};

export default performanceUtils;
