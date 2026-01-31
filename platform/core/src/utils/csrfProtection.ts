/**
 * CSRF Protection Utilities for OHIF Viewer
 *
 * Provides utilities for generating, validating, and managing CSRF tokens
 * to protect against Cross-Site Request Forgery attacks.
 *
 * Usage:
 * 1. Generate a token on page load or session start
 * 2. Include the token in state-changing requests (POST, PUT, DELETE, PATCH)
 * 3. Validate the token on the server side
 *
 * @module csrfProtection
 */

const CSRF_TOKEN_KEY = 'ohif-csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const TOKEN_LENGTH = 32;

/**
 * Generates a cryptographically secure random token
 * Uses Web Crypto API when available, falls back to Math.random
 */
function generateSecureToken(length: number = TOKEN_LENGTH): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments without crypto API (less secure)
  console.warn('CSRF: Web Crypto API not available, using fallback token generation');
  let token = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length * 2; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Gets the current CSRF token from session storage
 * Creates a new one if it doesn't exist
 */
export function getCSRFToken(): string {
  if (typeof sessionStorage === 'undefined') {
    console.warn('CSRF: sessionStorage not available');
    return '';
  }

  let token = sessionStorage.getItem(CSRF_TOKEN_KEY);

  if (!token) {
    token = generateSecureToken();
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  }

  return token;
}

/**
 * Regenerates the CSRF token
 * Call this after login or when the session changes
 */
export function regenerateCSRFToken(): string {
  if (typeof sessionStorage === 'undefined') {
    console.warn('CSRF: sessionStorage not available');
    return '';
  }

  const token = generateSecureToken();
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  return token;
}

/**
 * Clears the CSRF token from session storage
 * Call this on logout
 */
export function clearCSRFToken(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  }
}

/**
 * Validates a CSRF token against the stored token
 */
export function validateCSRFToken(token: string): boolean {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);

  if (!storedToken || !token) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  if (token.length !== storedToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Gets the CSRF header name and value for use in fetch/axios requests
 */
export function getCSRFHeader(): { [CSRF_HEADER_NAME]: string } {
  return {
    [CSRF_HEADER_NAME]: getCSRFToken(),
  };
}

/**
 * Adds CSRF token to request headers
 * Use with fetch or axios interceptors
 *
 * @example
 * // With fetch
 * fetch(url, {
 *   method: 'POST',
 *   headers: {
 *     ...addCSRFToHeaders({}),
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(data),
 * });
 *
 * @example
 * // With axios interceptor
 * axios.interceptors.request.use((config) => {
 *   if (['post', 'put', 'delete', 'patch'].includes(config.method)) {
 *     config.headers = addCSRFToHeaders(config.headers);
 *   }
 *   return config;
 * });
 */
export function addCSRFToHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  return {
    ...headers,
    ...getCSRFHeader(),
  };
}

/**
 * Checks if a request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const methodUpper = method.toUpperCase();
  // Safe methods that don't require CSRF protection
  const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
  return !safeMethods.includes(methodUpper);
}

/**
 * Creates a hidden input element with the CSRF token for forms
 * Useful for traditional form submissions
 */
export function createCSRFInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = '_csrf';
  input.value = getCSRFToken();
  return input;
}

/**
 * Gets a meta tag with the CSRF token
 * Some frameworks read the token from a meta tag
 */
export function getCSRFMetaContent(): string {
  return getCSRFToken();
}

export const CSRF_HEADER = CSRF_HEADER_NAME;

export default {
  getCSRFToken,
  regenerateCSRFToken,
  clearCSRFToken,
  validateCSRFToken,
  getCSRFHeader,
  addCSRFToHeaders,
  requiresCSRFProtection,
  createCSRFInput,
  getCSRFMetaContent,
  CSRF_HEADER: CSRF_HEADER_NAME,
};
