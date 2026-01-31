/**
 * Extensive API Layer
 * Complete REST/GraphQL API with WebSocket support
 * Enterprise-grade patterns: rate limiting, caching, circuit breaker, retry logic
 */

import { RateLimiter, SecurityAuditLogger, validateInput, ValidationRule } from '../core/security';

// ============================================================================
// API CLIENT CONFIGURATION
// ============================================================================

export interface APIConfig {
  baseUrl: string;
  version: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers: Record<string, string>;
  enableCaching: boolean;
  cacheTTL: number;
  enableLogging: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export const defaultAPIConfig: APIConfig = {
  baseUrl: '/api',
  version: 'v2',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  enableCaching: true,
  cacheTTL: 300000, // 5 minutes
  enableLogging: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 30000,
};

// ============================================================================
// CIRCUIT BREAKER PATTERN
// ============================================================================

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure: number = 0;
  private successCount = 0;

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ============================================================================
// REQUEST CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

export class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 1000;

  set<T>(key: string, data: T, etag?: string): void {
    // LRU eviction if needed
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
  }

  get<T>(key: string, ttl: number): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry as CacheEntry<T>;
  }

  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  cached: boolean;
  duration: number;
}

export interface APIError {
  message: string;
  code: string;
  status: number;
  details?: unknown;
}

export class HTTPClient {
  private config: APIConfig;
  private cache: RequestCache;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rateLimiter: RateLimiter;
  private auditLogger: SecurityAuditLogger;
  private requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];
  private responseInterceptors: Array<(response: Response) => Response> = [];

  constructor(config: Partial<APIConfig> = {}) {
    this.config = { ...defaultAPIConfig, ...config };
    this.cache = new RequestCache();
    this.rateLimiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60000,
    });
    this.auditLogger = SecurityAuditLogger.getInstance();
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: (config: RequestInit) => RequestInit): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: (response: Response) => Response): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Build full URL
   */
  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    let url = `${this.config.baseUrl}/${this.config.version}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    return url;
  }

  /**
   * Get or create circuit breaker for endpoint
   */
  private getCircuitBreaker(endpoint: string): CircuitBreaker {
    const key = endpoint.split('/')[1] || 'default';
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(
        key,
        new CircuitBreaker(
          this.config.circuitBreakerThreshold,
          this.config.circuitBreakerTimeout
        )
      );
    }
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          const delay = this.config.retryDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Make HTTP request
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      skipCache?: boolean;
      timeout?: number;
    } = {}
  ): Promise<APIResponse<T>> {
    const startTime = performance.now();
    const url = this.buildUrl(endpoint, options.params);
    const cacheKey = `${method}:${url}`;

    // Check rate limit
    const rateLimit = this.rateLimiter.isAllowed(endpoint);
    if (!rateLimit.allowed) {
      throw {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        status: 429,
        details: { resetTime: rateLimit.resetTime },
      } as APIError;
    }

    // Check cache for GET requests
    if (method === 'GET' && this.config.enableCaching && !options.skipCache) {
      const cached = this.cache.get<T>(cacheKey, this.config.cacheTTL);
      if (cached) {
        return {
          data: cached.data,
          status: 200,
          headers: new Headers(),
          cached: true,
          duration: performance.now() - startTime,
        };
      }
    }

    // Build request config
    let requestConfig: RequestInit = {
      method,
      headers: {
        ...this.config.headers,
        ...options.headers,
      },
    };

    if (options.body) {
      requestConfig.body = JSON.stringify(options.body);
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      requestConfig = interceptor(requestConfig);
    }

    // Execute with circuit breaker
    const circuitBreaker = this.getCircuitBreaker(endpoint);

    try {
      const response = await circuitBreaker.execute(() =>
        this.executeWithRetry(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            options.timeout || this.config.timeout
          );

          try {
            const res = await fetch(url, {
              ...requestConfig,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return res;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        })
      );

      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = interceptor(processedResponse);
      }

      if (!processedResponse.ok) {
        const errorBody = await processedResponse.json().catch(() => ({}));
        throw {
          message: errorBody.message || 'Request failed',
          code: errorBody.code || 'REQUEST_FAILED',
          status: processedResponse.status,
          details: errorBody,
        } as APIError;
      }

      const data = await processedResponse.json();

      // Cache successful GET responses
      if (method === 'GET' && this.config.enableCaching) {
        const etag = processedResponse.headers.get('ETag') || undefined;
        this.cache.set(cacheKey, data, etag);
      }

      // Log successful request
      if (this.config.enableLogging) {
        this.auditLogger.log({
          eventType: 'api_request',
          action: `${method} ${endpoint}`,
          outcome: 'success',
          details: { status: processedResponse.status, duration: performance.now() - startTime },
        });
      }

      return {
        data,
        status: processedResponse.status,
        headers: processedResponse.headers,
        cached: false,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      // Log failed request
      if (this.config.enableLogging) {
        this.auditLogger.log({
          eventType: 'api_request',
          action: `${method} ${endpoint}`,
          outcome: 'failure',
          details: { error: (error as Error).message },
        });
      }
      throw error;
    }
  }

  // Convenience methods
  get<T>(endpoint: string, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('GET', endpoint, options);
  }

  post<T>(endpoint: string, body?: unknown, options?: Omit<Parameters<typeof this.request>[2], 'body'>) {
    return this.request<T>('POST', endpoint, { ...options, body });
  }

  put<T>(endpoint: string, body?: unknown, options?: Omit<Parameters<typeof this.request>[2], 'body'>) {
    return this.request<T>('PUT', endpoint, { ...options, body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: Omit<Parameters<typeof this.request>[2], 'body'>) {
    return this.request<T>('PATCH', endpoint, { ...options, body });
  }

  delete<T>(endpoint: string, options?: Parameters<typeof this.request>[2]) {
    return this.request<T>('DELETE', endpoint, options);
  }
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageQueueSize: number;
}

export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'reconnect';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: unknown[] = [];
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private eventListeners = new Map<WebSocketEventType, Set<(data?: unknown) => void>>();

  constructor(config: Partial<WebSocketConfig> & { url: string }) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          this.reconnectCount = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.emit('open');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.stopHeartbeat();
          this.emit('close', event);
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch {
            this.emit('message', event.data);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.reconnectCount = this.config.reconnectAttempts; // Prevent reconnect
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message
   */
  send(type: string, payload: unknown): void {
    const message = { type, payload, timestamp: Date.now() };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      if (this.messageQueue.length < this.config.messageQueueSize) {
        this.messageQueue.push(message);
      }
    }
  }

  /**
   * Subscribe to message type
   */
  subscribe(type: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: WebSocketEventType, callback: (data?: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private handleMessage(data: { type: string; payload: unknown }): void {
    if (data.type === 'pong') {
      // Heartbeat response
      return;
    }

    const callbacks = this.listeners.get(data.type);
    if (callbacks) {
      callbacks.forEach(cb => cb(data.payload));
    }

    this.emit('message', data);
  }

  private emit(event: WebSocketEventType, data?: unknown): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  private handleReconnect(): void {
    if (this.reconnectCount < this.config.reconnectAttempts) {
      this.reconnectCount++;
      const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount - 1);
      setTimeout(() => {
        this.emit('reconnect', { attempt: this.reconnectCount });
        this.connect().catch(() => {});
      }, delay);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', {});
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// ============================================================================
// GRAPHQL CLIENT
// ============================================================================

export interface GraphQLConfig {
  endpoint: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface GraphQLResponse<T> {
  data: T | null;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

export class GraphQLClient {
  private config: GraphQLConfig;
  private httpClient: HTTPClient;

  constructor(config: GraphQLConfig) {
    this.config = config;
    this.httpClient = new HTTPClient({
      baseUrl: '',
      version: '',
      headers: config.headers,
      timeout: config.timeout,
    });
  }

  /**
   * Execute GraphQL query
   */
  async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({
        query,
        variables,
        operationName,
      }),
    });

    return response.json();
  }

  /**
   * Execute GraphQL mutation
   */
  async mutate<T>(
    mutation: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    return this.query<T>(mutation, variables, operationName);
  }

  /**
   * Create subscription (returns unsubscribe function)
   */
  subscribe<T>(
    subscription: string,
    variables: Record<string, unknown>,
    onData: (data: T) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Implementation would depend on WebSocket subscription transport
    const wsUrl = this.config.endpoint.replace(/^http/, 'ws');
    const ws = new WebSocketClient({ url: wsUrl });

    ws.connect()
      .then(() => {
        ws.send('subscribe', { query: subscription, variables });
        ws.subscribe('data', (data) => onData(data as T));
      })
      .catch(error => onError?.(error));

    return () => ws.disconnect();
  }
}

// ============================================================================
// API ENDPOINTS - STUDIES
// ============================================================================

export interface Study {
  studyInstanceUID: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  studyDescription: string;
  modalities: string[];
  numberOfSeries: number;
  numberOfInstances: number;
  accessionNumber?: string;
  referringPhysician?: string;
}

export interface Series {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfInstances: number;
  bodyPart?: string;
}

export interface Instance {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  sopClassUID: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  windowCenter?: number;
  windowWidth?: number;
}

export class StudiesAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Search studies (QIDO-RS)
   */
  async search(params: {
    patientId?: string;
    patientName?: string;
    studyDate?: string;
    modality?: string;
    accessionNumber?: string;
    studyDescription?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse<Study[]>> {
    const queryParams: Record<string, string> = {};
    if (params.patientId) queryParams.PatientID = params.patientId;
    if (params.patientName) queryParams.PatientName = params.patientName;
    if (params.studyDate) queryParams.StudyDate = params.studyDate;
    if (params.modality) queryParams.ModalitiesInStudy = params.modality;
    if (params.accessionNumber) queryParams.AccessionNumber = params.accessionNumber;
    if (params.studyDescription) queryParams.StudyDescription = params.studyDescription;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.offset) queryParams.offset = String(params.offset);

    return this.client.get<Study[]>('/studies', { params: queryParams });
  }

  /**
   * Get study by UID
   */
  async get(studyInstanceUID: string): Promise<APIResponse<Study>> {
    return this.client.get<Study>(`/studies/${studyInstanceUID}`);
  }

  /**
   * Get series for study
   */
  async getSeries(studyInstanceUID: string): Promise<APIResponse<Series[]>> {
    return this.client.get<Series[]>(`/studies/${studyInstanceUID}/series`);
  }

  /**
   * Get instances for series
   */
  async getInstances(
    studyInstanceUID: string,
    seriesInstanceUID: string
  ): Promise<APIResponse<Instance[]>> {
    return this.client.get<Instance[]>(
      `/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`
    );
  }

  /**
   * Delete study
   */
  async delete(studyInstanceUID: string): Promise<APIResponse<void>> {
    return this.client.delete<void>(`/studies/${studyInstanceUID}`);
  }
}

// ============================================================================
// API ENDPOINTS - AI ANALYSIS
// ============================================================================

export interface AIAnalysisRequest {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  modelId: string;
  options?: Record<string, unknown>;
}

export interface AIAnalysisResult {
  id: string;
  studyInstanceUID: string;
  modelId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  findings: AIFinding[];
  processingTime?: number;
  confidence: number;
  createdAt: string;
  completedAt?: string;
}

export interface AIFinding {
  id: string;
  type: string;
  description: string;
  confidence: number;
  location?: {
    seriesInstanceUID: string;
    instanceNumbers: number[];
    boundingBox?: { x: number; y: number; width: number; height: number };
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

export class AIAnalysisAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Request AI analysis
   */
  async analyze(request: AIAnalysisRequest): Promise<APIResponse<AIAnalysisResult>> {
    return this.client.post<AIAnalysisResult>('/ai/analyze', request);
  }

  /**
   * Get analysis result
   */
  async getResult(analysisId: string): Promise<APIResponse<AIAnalysisResult>> {
    return this.client.get<AIAnalysisResult>(`/ai/results/${analysisId}`);
  }

  /**
   * List analyses for study
   */
  async listForStudy(studyInstanceUID: string): Promise<APIResponse<AIAnalysisResult[]>> {
    return this.client.get<AIAnalysisResult[]>(`/ai/studies/${studyInstanceUID}/analyses`);
  }

  /**
   * Get available models
   */
  async getModels(): Promise<APIResponse<AIModel[]>> {
    return this.client.get<AIModel[]>('/ai/models');
  }

  /**
   * Cancel analysis
   */
  async cancel(analysisId: string): Promise<APIResponse<void>> {
    return this.client.post<void>(`/ai/results/${analysisId}/cancel`);
  }
}

export interface AIModel {
  id: string;
  name: string;
  version: string;
  description: string;
  modalities: string[];
  bodyParts: string[];
  conditions: string[];
  performance: {
    sensitivity: number;
    specificity: number;
    auc: number;
  };
  averageProcessingTime: number;
  enabled: boolean;
}

// ============================================================================
// API ENDPOINTS - REPORTS
// ============================================================================

export interface Report {
  id: string;
  studyInstanceUID: string;
  status: 'draft' | 'preliminary' | 'final' | 'amended' | 'cancelled';
  content: {
    sections: ReportSection[];
    impressions: string[];
  };
  author: string;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  signedBy?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  aiGenerated: boolean;
}

export class ReportsAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Create report
   */
  async create(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<Report>> {
    return this.client.post<Report>('/reports', report);
  }

  /**
   * Get report
   */
  async get(reportId: string): Promise<APIResponse<Report>> {
    return this.client.get<Report>(`/reports/${reportId}`);
  }

  /**
   * Update report
   */
  async update(reportId: string, updates: Partial<Report>): Promise<APIResponse<Report>> {
    return this.client.patch<Report>(`/reports/${reportId}`, updates);
  }

  /**
   * Sign report
   */
  async sign(reportId: string, signature: string): Promise<APIResponse<Report>> {
    return this.client.post<Report>(`/reports/${reportId}/sign`, { signature });
  }

  /**
   * Generate AI report
   */
  async generateAI(studyInstanceUID: string, options?: {
    template?: string;
    includeFindings?: boolean;
    includeMeasurements?: boolean;
  }): Promise<APIResponse<Report>> {
    return this.client.post<Report>('/reports/generate', {
      studyInstanceUID,
      ...options,
    });
  }

  /**
   * Export report
   */
  async export(reportId: string, format: 'pdf' | 'html' | 'dicom-sr'): Promise<APIResponse<Blob>> {
    return this.client.get<Blob>(`/reports/${reportId}/export`, {
      params: { format },
      headers: { Accept: format === 'pdf' ? 'application/pdf' : 'text/html' },
    });
  }

  /**
   * List reports for study
   */
  async listForStudy(studyInstanceUID: string): Promise<APIResponse<Report[]>> {
    return this.client.get<Report[]>(`/studies/${studyInstanceUID}/reports`);
  }
}

// ============================================================================
// API ENDPOINTS - WORKLIST
// ============================================================================

export interface WorklistItem {
  id: string;
  studyInstanceUID: string;
  patientId: string;
  patientName: string;
  priority: 'stat' | 'urgent' | 'routine';
  status: 'unread' | 'in-progress' | 'dictated' | 'signed';
  assignedTo?: string;
  scheduledTime?: string;
  modality: string;
  bodyPart?: string;
  reasonForStudy?: string;
  aiFindings?: number;
  createdAt: string;
}

export class WorklistAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Get worklist items
   */
  async list(params?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
    modality?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse<WorklistItem[]>> {
    return this.client.get<WorklistItem[]>('/worklist', {
      params: params as Record<string, string>,
    });
  }

  /**
   * Get single worklist item
   */
  async get(itemId: string): Promise<APIResponse<WorklistItem>> {
    return this.client.get<WorklistItem>(`/worklist/${itemId}`);
  }

  /**
   * Update worklist item
   */
  async update(itemId: string, updates: Partial<WorklistItem>): Promise<APIResponse<WorklistItem>> {
    return this.client.patch<WorklistItem>(`/worklist/${itemId}`, updates);
  }

  /**
   * Assign item to user
   */
  async assign(itemId: string, userId: string): Promise<APIResponse<WorklistItem>> {
    return this.client.post<WorklistItem>(`/worklist/${itemId}/assign`, { userId });
  }

  /**
   * Get worklist statistics
   */
  async getStats(): Promise<APIResponse<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byModality: Record<string, number>;
    avgTurnaroundTime: number;
  }>> {
    return this.client.get('/worklist/stats');
  }
}

// ============================================================================
// API ENDPOINTS - USERS
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'radiologist' | 'technologist' | 'referring' | 'viewer';
  permissions: string[];
  preferences: UserPreferences;
  lastLogin?: string;
  active: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultLayout: string;
  defaultWindowLevel?: { center: number; width: number };
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  aiAssist: {
    autoRun: boolean;
    showSuggestions: boolean;
    confidenceThreshold: number;
  };
}

export class UsersAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Get current user
   */
  async getCurrent(): Promise<APIResponse<User>> {
    return this.client.get<User>('/users/me');
  }

  /**
   * Update current user
   */
  async updateCurrent(updates: Partial<User>): Promise<APIResponse<User>> {
    return this.client.patch<User>('/users/me', updates);
  }

  /**
   * Update preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<APIResponse<UserPreferences>> {
    return this.client.patch<UserPreferences>('/users/me/preferences', preferences);
  }

  /**
   * List users (admin only)
   */
  async list(params?: {
    role?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse<User[]>> {
    return this.client.get<User[]>('/users', {
      params: params as Record<string, string>,
    });
  }

  /**
   * Create user (admin only)
   */
  async create(user: Omit<User, 'id'>): Promise<APIResponse<User>> {
    return this.client.post<User>('/users', user);
  }

  /**
   * Update user (admin only)
   */
  async update(userId: string, updates: Partial<User>): Promise<APIResponse<User>> {
    return this.client.patch<User>(`/users/${userId}`, updates);
  }

  /**
   * Delete user (admin only)
   */
  async delete(userId: string): Promise<APIResponse<void>> {
    return this.client.delete<void>(`/users/${userId}`);
  }
}

// ============================================================================
// API ENDPOINTS - AUDIT
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  outcome: 'success' | 'failure';
}

export class AuditAPI {
  constructor(private client: HTTPClient) {}

  /**
   * Search audit logs
   */
  async search(params: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse<AuditLogEntry[]>> {
    return this.client.get<AuditLogEntry[]>('/audit', {
      params: params as Record<string, string>,
    });
  }

  /**
   * Get study access history
   */
  async getStudyHistory(studyInstanceUID: string): Promise<APIResponse<AuditLogEntry[]>> {
    return this.client.get<AuditLogEntry[]>(`/audit/studies/${studyInstanceUID}`);
  }

  /**
   * Export audit logs
   */
  async export(params: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'json';
  }): Promise<APIResponse<Blob>> {
    return this.client.get<Blob>('/audit/export', {
      params: params as Record<string, string>,
    });
  }
}

// ============================================================================
// MAIN API CLIENT
// ============================================================================

export class APIClient {
  private httpClient: HTTPClient;
  public studies: StudiesAPI;
  public aiAnalysis: AIAnalysisAPI;
  public reports: ReportsAPI;
  public worklist: WorklistAPI;
  public users: UsersAPI;
  public audit: AuditAPI;

  constructor(config?: Partial<APIConfig>) {
    this.httpClient = new HTTPClient(config);
    this.studies = new StudiesAPI(this.httpClient);
    this.aiAnalysis = new AIAnalysisAPI(this.httpClient);
    this.reports = new ReportsAPI(this.httpClient);
    this.worklist = new WorklistAPI(this.httpClient);
    this.users = new UsersAPI(this.httpClient);
    this.audit = new AuditAPI(this.httpClient);
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string): void {
    this.httpClient.addRequestInterceptor(config => ({
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      },
    }));
  }

  /**
   * Create WebSocket connection for real-time updates
   */
  createWebSocket(path: string = '/ws'): WebSocketClient {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocketClient({
      url: `${protocol}//${window.location.host}${path}`,
    });
  }

  /**
   * Create GraphQL client
   */
  createGraphQLClient(endpoint: string = '/graphql'): GraphQLClient {
    return new GraphQLClient({
      endpoint: `${window.location.origin}${endpoint}`,
    });
  }

  /**
   * Get HTTP client for custom requests
   */
  getHttpClient(): HTTPClient {
    return this.httpClient;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let apiInstance: APIClient | null = null;

export function initializeAPI(config?: Partial<APIConfig>): APIClient {
  apiInstance = new APIClient(config);
  return apiInstance;
}

export function getAPI(): APIClient {
  if (!apiInstance) {
    apiInstance = new APIClient();
  }
  return apiInstance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  APIClient,
  HTTPClient,
  WebSocketClient,
  GraphQLClient,
  CircuitBreaker,
  RequestCache,
  initializeAPI,
  getAPI,
};
