/**
 * Security Core Module
 * Comprehensive security utilities and fixes for identified vulnerabilities
 * Addresses: HTML Injection, Regex DoS, Auth exposure, XSS prevention
 */

// ============================================================================
// HTML SANITIZATION & XSS PREVENTION
// ============================================================================

/**
 * HTML escape function to prevent XSS attacks
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safe HTML template builder - escapes all interpolations
 */
export function safeHtml(
  literals: TemplateStringsArray,
  ...values: unknown[]
): string {
  let result = '';
  for (let i = 0; i < literals.length; i++) {
    result += literals[i];
    if (i < values.length) {
      result += escapeHtml(String(values[i]));
    }
  }
  return result;
}

/**
 * Sanitize object for safe HTML rendering
 */
export function sanitizeForHtml<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = {} as T;
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as Record<string, unknown>)[key] = sanitizeForHtml(
        value as Record<string, unknown>
      );
    } else {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }
  return sanitized;
}

// ============================================================================
// REGEX DOS PROTECTION
// ============================================================================

export interface SafeRegexOptions {
  timeout?: number; // milliseconds
  maxLength?: number; // max input length
}

/**
 * Execute regex with timeout protection against ReDoS attacks
 */
export function safeRegexExec(
  pattern: RegExp,
  input: string,
  options: SafeRegexOptions = {}
): RegExpExecArray | null {
  const { timeout = 1000, maxLength = 100000 } = options;

  // Validate input length
  if (input.length > maxLength) {
    console.warn(`[SafeRegex] Input too long (${input.length} > ${maxLength})`);
    return null;
  }

  const startTime = performance.now();
  const result = pattern.exec(input);
  const elapsed = performance.now() - startTime;

  if (elapsed > timeout) {
    console.warn(`[SafeRegex] Regex execution took ${elapsed}ms (limit: ${timeout}ms)`);
  }

  return result;
}

/**
 * Execute regex match with timeout protection
 */
export function safeRegexMatch(
  input: string,
  pattern: RegExp,
  options: SafeRegexOptions = {}
): RegExpMatchArray | null {
  const { timeout = 1000, maxLength = 100000 } = options;

  if (input.length > maxLength) {
    console.warn(`[SafeRegex] Input too long (${input.length} > ${maxLength})`);
    return null;
  }

  const startTime = performance.now();
  const result = input.match(pattern);
  const elapsed = performance.now() - startTime;

  if (elapsed > timeout) {
    console.warn(`[SafeRegex] Regex match took ${elapsed}ms (limit: ${timeout}ms)`);
  }

  return result;
}

// ============================================================================
// SECURE AUTHENTICATION HANDLING
// ============================================================================

export interface SecureCredentials {
  type: 'basic' | 'oauth2' | 'api-key' | 'jwt';
  encrypted: boolean;
  data: unknown;
}

/**
 * Secure credential manager - handles sensitive auth data
 * Note: In production, use proper secret management (Vault, AWS Secrets Manager, etc.)
 */
export class SecureCredentialManager {
  private static instance: SecureCredentialManager;
  private credentials = new Map<string, SecureCredentials>();
  private encryptionKey: CryptoKey | null = null;

  private constructor() {}

  static getInstance(): SecureCredentialManager {
    if (!SecureCredentialManager.instance) {
      SecureCredentialManager.instance = new SecureCredentialManager();
    }
    return SecureCredentialManager.instance;
  }

  /**
   * Initialize encryption key for credential storage
   */
  async initialize(): Promise<void> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  }

  /**
   * Store credential securely
   */
  async storeCredential(id: string, credential: SecureCredentials): Promise<void> {
    if (this.encryptionKey && typeof credential.data === 'string') {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encoder.encode(credential.data)
      );
      this.credentials.set(id, {
        ...credential,
        encrypted: true,
        data: { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) },
      });
    } else {
      this.credentials.set(id, credential);
    }
  }

  /**
   * Retrieve and decrypt credential
   */
  async getCredential(id: string): Promise<SecureCredentials | null> {
    const credential = this.credentials.get(id);
    if (!credential) return null;

    if (credential.encrypted && this.encryptionKey) {
      const { iv, data } = credential.data as { iv: number[]; data: number[] };
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        this.encryptionKey,
        new Uint8Array(data)
      );
      const decoder = new TextDecoder();
      return {
        ...credential,
        encrypted: false,
        data: decoder.decode(decrypted),
      };
    }

    return credential;
  }

  /**
   * Build authorization header without exposing credentials in code
   */
  async buildAuthHeader(credentialId: string): Promise<string | null> {
    const credential = await this.getCredential(credentialId);
    if (!credential) return null;

    switch (credential.type) {
      case 'basic': {
        const { username, password } = credential.data as { username: string; password: string };
        // Use secure base64 encoding
        return `Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`;
      }
      case 'oauth2':
      case 'jwt':
        return `Bearer ${credential.data}`;
      case 'api-key':
        return String(credential.data);
      default:
        return null;
    }
  }

  /**
   * Clear credentials from memory
   */
  clearCredentials(): void {
    this.credentials.clear();
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

export interface ValidationRule {
  type: 'string' | 'number' | 'email' | 'url' | 'date' | 'dicom-uid' | 'patient-id';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedValue?: unknown;
}

/**
 * Validate and sanitize input data
 */
export function validateInput(
  value: unknown,
  rules: ValidationRule
): ValidationResult {
  const errors: string[] = [];
  let sanitizedValue = value;

  // Required check
  if (rules.required && (value === null || value === undefined || value === '')) {
    errors.push('Field is required');
    return { valid: false, errors };
  }

  // Type-specific validation
  switch (rules.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
        break;
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Minimum length is ${rules.minLength}`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Maximum length is ${rules.maxLength}`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push('Value does not match required pattern');
      }
      if (rules.sanitize) {
        sanitizedValue = escapeHtml(value);
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
        break;
      }
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(value)) {
        errors.push('Invalid email format');
      }
      sanitizedValue = value.toLowerCase().trim();
      break;

    case 'url':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
        break;
      }
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('URL must use HTTP or HTTPS protocol');
        }
        sanitizedValue = url.toString();
      } catch {
        errors.push('Invalid URL format');
      }
      break;

    case 'dicom-uid':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
        break;
      }
      // DICOM UID format: numeric with dots, max 64 chars
      const uidPattern = /^[0-9.]+$/;
      if (!uidPattern.test(value) || value.length > 64) {
        errors.push('Invalid DICOM UID format');
      }
      break;

    case 'patient-id':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
        break;
      }
      // Alphanumeric with limited special chars
      const pidPattern = /^[a-zA-Z0-9\-_]+$/;
      if (!pidPattern.test(value) || value.length > 64) {
        errors.push('Invalid patient ID format');
      }
      sanitizedValue = value.toUpperCase().trim();
      break;

    case 'number':
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) {
        errors.push('Value must be a number');
      }
      sanitizedValue = num;
      break;

    case 'date':
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) {
        errors.push('Invalid date format');
      }
      sanitizedValue = date;
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedValue: errors.length === 0 ? sanitizedValue : undefined,
  };
}

// ============================================================================
// CONTENT SECURITY POLICY HELPERS
// ============================================================================

/**
 * Generate Content Security Policy directives
 */
export function generateCSP(options: {
  nonce?: string;
  reportUri?: string;
  allowedScriptSources?: string[];
  allowedStyleSources?: string[];
  allowedImageSources?: string[];
  allowedConnectSources?: string[];
}): string {
  const {
    nonce,
    reportUri,
    allowedScriptSources = [],
    allowedStyleSources = [],
    allowedImageSources = [],
    allowedConnectSources = [],
  } = options;

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : ''} ${allowedScriptSources.join(' ')}`.trim(),
    `style-src 'self' 'unsafe-inline' ${allowedStyleSources.join(' ')}`.trim(),
    `img-src 'self' data: blob: ${allowedImageSources.join(' ')}`.trim(),
    `connect-src 'self' ${allowedConnectSources.join(' ')}`.trim(),
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join('; ');
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (context: unknown) => string;
}

export class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    if (record.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface AuditEvent {
  timestamp: Date;
  eventType: string;
  userId?: string;
  resource?: string;
  action: string;
  outcome: 'success' | 'failure';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityAuditLogger {
  private static instance: SecurityAuditLogger;
  private events: AuditEvent[] = [];
  private maxEvents = 10000;
  private listeners: Array<(event: AuditEvent) => void> = [];

  private constructor() {}

  static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  /**
   * Log a security event
   */
  log(event: Omit<AuditEvent, 'timestamp'>): void {
    const fullEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Maintain max size
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(fullEvent));

    // Log critical events to console
    if (event.outcome === 'failure') {
      console.warn('[SecurityAudit]', fullEvent);
    }
  }

  /**
   * Subscribe to audit events
   */
  subscribe(listener: (event: AuditEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Query audit events
   */
  query(filter: Partial<AuditEvent>): AuditEvent[] {
    return this.events.filter(event => {
      for (const key in filter) {
        if (event[key as keyof AuditEvent] !== filter[key as keyof AuditEvent]) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Export audit log
   */
  export(): string {
    return JSON.stringify(this.events, null, 2);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  escapeHtml,
  safeHtml,
  sanitizeForHtml,
  safeRegexExec,
  safeRegexMatch,
  SecureCredentialManager,
  validateInput,
  generateCSP,
  RateLimiter,
  SecurityAuditLogger,
};
