/**
 * Mobile System Module
 * Comprehensive mobile support for OHIF Viewer
 *
 * Features:
 * - Touch gesture handling (pinch, swipe, rotate)
 * - Responsive layouts
 * - Mobile-optimized panels
 * - Offline support
 * - Battery-aware rendering
 * - Network-adaptive streaming
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// DEVICE DETECTION & CAPABILITIES
// ============================================================================

export interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  hasMouse: boolean;
  screenSize: 'small' | 'medium' | 'large' | 'xlarge';
  pixelRatio: number;
  maxTextureSize: number;
  supportsWebGL2: boolean;
  supportsWebGPU: boolean;
  memoryGB: number;
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'ethernet' | 'unknown';
  batteryLevel: number;
  isCharging: boolean;
  orientation: 'portrait' | 'landscape';
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  const ua = navigator.userAgent;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Device type detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Android/i.test(ua) && Math.min(screenWidth, screenHeight) >= 600;
  const isDesktop = !isMobile && !isTablet;

  // Touch capabilities
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasMouse = window.matchMedia('(hover: hover)').matches;

  // Screen size classification
  let screenSize: DeviceCapabilities['screenSize'] = 'small';
  const maxDim = Math.max(screenWidth, screenHeight);
  if (maxDim >= 1920) screenSize = 'xlarge';
  else if (maxDim >= 1280) screenSize = 'large';
  else if (maxDim >= 768) screenSize = 'medium';

  // WebGL capabilities
  let maxTextureSize = 2048;
  let supportsWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      supportsWebGL2 = true;
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }
  } catch (e) {
    // WebGL not available
  }

  // WebGPU support
  const supportsWebGPU = 'gpu' in navigator;

  // Memory estimation (if available)
  const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;

  // Network connection
  let connectionType: DeviceCapabilities['connectionType'] = 'unknown';
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  if (connection?.effectiveType) {
    connectionType = connection.effectiveType as DeviceCapabilities['connectionType'];
  }

  // Orientation
  const orientation: DeviceCapabilities['orientation'] =
    screenWidth > screenHeight ? 'landscape' : 'portrait';

  return {
    isMobile,
    isTablet,
    isDesktop,
    hasTouch,
    hasMouse,
    screenSize,
    pixelRatio: window.devicePixelRatio || 1,
    maxTextureSize,
    supportsWebGL2,
    supportsWebGPU,
    memoryGB,
    connectionType,
    batteryLevel: 1,
    isCharging: true,
    orientation,
  };
}

// ============================================================================
// TOUCH GESTURE HANDLER
// ============================================================================

export interface GestureState {
  type: 'none' | 'pan' | 'pinch' | 'rotate' | 'swipe' | 'tap' | 'doubleTap' | 'longPress';
  startTime: number;
  startCenter: { x: number; y: number };
  currentCenter: { x: number; y: number };
  delta: { x: number; y: number };
  scale: number;
  rotation: number;
  velocity: { x: number; y: number };
  touchCount: number;
}

export interface TouchGestureConfig {
  tapThreshold: number; // Max movement for tap (px)
  doubleTapDelay: number; // Max time between taps (ms)
  longPressDelay: number; // Min time for long press (ms)
  swipeThreshold: number; // Min velocity for swipe
  pinchThreshold: number; // Min scale change for pinch
  rotateThreshold: number; // Min rotation for rotate gesture (degrees)
}

export class TouchGestureHandler {
  private element: HTMLElement;
  private config: TouchGestureConfig;
  private touches = new Map<number, Touch>();
  private gestureState: GestureState;
  private lastTapTime = 0;
  private longPressTimer: NodeJS.Timeout | null = null;
  private listeners: {
    onPan?: (delta: { x: number; y: number }) => void;
    onPinch?: (scale: number, center: { x: number; y: number }) => void;
    onRotate?: (angle: number, center: { x: number; y: number }) => void;
    onSwipe?: (direction: 'up' | 'down' | 'left' | 'right', velocity: number) => void;
    onTap?: (position: { x: number; y: number }) => void;
    onDoubleTap?: (position: { x: number; y: number }) => void;
    onLongPress?: (position: { x: number; y: number }) => void;
    onGestureStart?: (type: GestureState['type']) => void;
    onGestureEnd?: (type: GestureState['type']) => void;
  } = {};

  constructor(element: HTMLElement, config?: Partial<TouchGestureConfig>) {
    this.element = element;
    this.config = {
      tapThreshold: config?.tapThreshold ?? 10,
      doubleTapDelay: config?.doubleTapDelay ?? 300,
      longPressDelay: config?.longPressDelay ?? 500,
      swipeThreshold: config?.swipeThreshold ?? 0.5,
      pinchThreshold: config?.pinchThreshold ?? 0.05,
      rotateThreshold: config?.rotateThreshold ?? 5,
    };
    this.gestureState = this.createInitialState();
    this.attachListeners();
  }

  private createInitialState(): GestureState {
    return {
      type: 'none',
      startTime: 0,
      startCenter: { x: 0, y: 0 },
      currentCenter: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      velocity: { x: 0, y: 0 },
      touchCount: 0,
    };
  }

  private attachListeners(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
  }

  private handleTouchStart = (event: TouchEvent): void => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }

    const center = this.calculateCenter();
    this.gestureState = {
      ...this.createInitialState(),
      startTime: Date.now(),
      startCenter: center,
      currentCenter: center,
      touchCount: this.touches.size,
    };

    // Start long press timer for single touch
    if (this.touches.size === 1) {
      this.longPressTimer = setTimeout(() => {
        this.gestureState.type = 'longPress';
        this.listeners.onLongPress?.(center);
        this.listeners.onGestureStart?.('longPress');
      }, this.config.longPressDelay);
    }

    this.listeners.onGestureStart?.('none');
  };

  private handleTouchMove = (event: TouchEvent): void => {
    event.preventDefault();

    // Update touch positions
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }

    // Cancel long press on movement
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const prevCenter = this.gestureState.currentCenter;
    const center = this.calculateCenter();
    const delta = {
      x: center.x - prevCenter.x,
      y: center.y - prevCenter.y,
    };

    this.gestureState.currentCenter = center;
    this.gestureState.delta = delta;

    if (this.touches.size === 1) {
      // Single touch - pan
      this.gestureState.type = 'pan';
      this.listeners.onPan?.(delta);
    } else if (this.touches.size === 2) {
      // Two touches - pinch/rotate
      const touchArr = Array.from(this.touches.values());
      const prevScale = this.gestureState.scale;
      const scale = this.calculateScale(touchArr);
      const rotation = this.calculateRotation(touchArr);

      this.gestureState.scale = scale;
      this.gestureState.rotation = rotation;

      if (Math.abs(scale - prevScale) > this.config.pinchThreshold) {
        this.gestureState.type = 'pinch';
        this.listeners.onPinch?.(scale, center);
      }

      if (Math.abs(rotation) > this.config.rotateThreshold) {
        this.gestureState.type = 'rotate';
        this.listeners.onRotate?.(rotation, center);
      }
    }
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    // Remove ended touches
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches.delete(touch.identifier);
    }

    // Cancel long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.touches.size === 0) {
      const duration = Date.now() - this.gestureState.startTime;
      const distance = Math.hypot(
        this.gestureState.currentCenter.x - this.gestureState.startCenter.x,
        this.gestureState.currentCenter.y - this.gestureState.startCenter.y
      );

      // Check for tap
      if (distance < this.config.tapThreshold && duration < this.config.longPressDelay) {
        const now = Date.now();
        if (now - this.lastTapTime < this.config.doubleTapDelay) {
          // Double tap
          this.gestureState.type = 'doubleTap';
          this.listeners.onDoubleTap?.(this.gestureState.currentCenter);
          this.lastTapTime = 0;
        } else {
          // Single tap
          this.gestureState.type = 'tap';
          this.listeners.onTap?.(this.gestureState.currentCenter);
          this.lastTapTime = now;
        }
      }

      // Check for swipe
      const velocity = {
        x: this.gestureState.delta.x / (duration / 1000),
        y: this.gestureState.delta.y / (duration / 1000),
      };

      if (Math.abs(velocity.x) > this.config.swipeThreshold || Math.abs(velocity.y) > this.config.swipeThreshold) {
        this.gestureState.type = 'swipe';
        let direction: 'up' | 'down' | 'left' | 'right';
        if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
          direction = velocity.x > 0 ? 'right' : 'left';
        } else {
          direction = velocity.y > 0 ? 'down' : 'up';
        }
        this.listeners.onSwipe?.(direction, Math.hypot(velocity.x, velocity.y));
      }

      this.listeners.onGestureEnd?.(this.gestureState.type);
      this.gestureState = this.createInitialState();
    }
  };

  private calculateCenter(): { x: number; y: number } {
    if (this.touches.size === 0) {
      return { x: 0, y: 0 };
    }

    let sumX = 0, sumY = 0;
    for (const touch of this.touches.values()) {
      sumX += touch.clientX;
      sumY += touch.clientY;
    }

    return {
      x: sumX / this.touches.size,
      y: sumY / this.touches.size,
    };
  }

  private calculateScale(touches: Touch[]): number {
    if (touches.length < 2) return 1;

    const distance = Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );

    // Store initial distance on first calculation
    if (this.gestureState.scale === 1) {
      return 1;
    }

    return distance / 100; // Normalized scale
  }

  private calculateRotation(touches: Touch[]): number {
    if (touches.length < 2) return 0;

    const angle = Math.atan2(
      touches[1].clientY - touches[0].clientY,
      touches[1].clientX - touches[0].clientX
    );

    return (angle * 180) / Math.PI;
  }

  on<K extends keyof typeof this.listeners>(
    event: K,
    callback: (typeof this.listeners)[K]
  ): void {
    this.listeners[event] = callback;
  }

  off<K extends keyof typeof this.listeners>(event: K): void {
    delete this.listeners[event];
  }

  destroy(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchEnd);
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
  }
}

// ============================================================================
// MOBILE VIEWPORT COMPONENT
// ============================================================================

export interface MobileViewportProps {
  viewportId: string;
  children: React.ReactNode;
  onPan?: (delta: { x: number; y: number }) => void;
  onZoom?: (scale: number, center: { x: number; y: number }) => void;
  onScroll?: (direction: 'up' | 'down') => void;
  onDoubleTap?: () => void;
  className?: string;
}

export const MobileViewport: React.FC<MobileViewportProps> = ({
  viewportId,
  children,
  onPan,
  onZoom,
  onScroll,
  onDoubleTap,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureHandlerRef = useRef<TouchGestureHandler | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    gestureHandlerRef.current = new TouchGestureHandler(containerRef.current);

    gestureHandlerRef.current.on('onPan', (delta) => {
      onPan?.(delta);
    });

    gestureHandlerRef.current.on('onPinch', (scale, center) => {
      onZoom?.(scale, center);
    });

    gestureHandlerRef.current.on('onSwipe', (direction) => {
      if (direction === 'up' || direction === 'down') {
        onScroll?.(direction);
      }
    });

    gestureHandlerRef.current.on('onDoubleTap', () => {
      onDoubleTap?.();
    });

    gestureHandlerRef.current.on('onGestureStart', () => {
      setIsInteracting(true);
    });

    gestureHandlerRef.current.on('onGestureEnd', () => {
      setIsInteracting(false);
    });

    return () => {
      gestureHandlerRef.current?.destroy();
    };
  }, [onPan, onZoom, onScroll, onDoubleTap]);

  return (
    <div
      ref={containerRef}
      className={`mobile-viewport relative w-full h-full touch-none select-none ${className}`}
      data-viewport-id={viewportId}
      data-interacting={isInteracting}
    >
      {children}
      {isInteracting && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
      )}
    </div>
  );
};

// ============================================================================
// RESPONSIVE PANEL
// ============================================================================

export interface ResponsivePanelProps {
  children: React.ReactNode;
  position: 'left' | 'right' | 'bottom';
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  className?: string;
}

export const ResponsivePanel: React.FC<ResponsivePanelProps> = ({
  children,
  position,
  isOpen,
  onToggle,
  title,
  className = '',
}) => {
  const capabilities = detectDeviceCapabilities();
  const isMobileView = capabilities.isMobile || capabilities.isTablet;

  // On mobile, panels become bottom sheets
  if (isMobileView) {
    return (
      <div
        className={`
          fixed inset-x-0 bottom-0 z-50
          transform transition-transform duration-300 ease-out
          bg-gray-900 rounded-t-xl shadow-xl
          ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}
          ${className}
        `}
        style={{ maxHeight: '80vh' }}
      >
        {/* Handle bar */}
        <button
          onClick={onToggle}
          className="w-full h-12 flex items-center justify-center"
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </button>

        {/* Title */}
        {title && (
          <div className="px-4 py-2 border-b border-gray-700">
            <h3 className="text-white font-medium">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {children}
        </div>
      </div>
    );
  }

  // Desktop panels
  const positionClasses = {
    left: 'left-0 top-0 h-full w-80',
    right: 'right-0 top-0 h-full w-80',
    bottom: 'bottom-0 left-0 right-0 h-64',
  };

  return (
    <div
      className={`
        fixed z-40
        transform transition-transform duration-300 ease-out
        bg-gray-900 shadow-xl
        ${positionClasses[position]}
        ${isOpen ? 'translate-x-0 translate-y-0' : position === 'left' ? '-translate-x-full' : position === 'right' ? 'translate-x-full' : 'translate-y-full'}
        ${className}
      `}
    >
      <div className="h-full flex flex-col">
        {title && (
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-medium">{title}</h3>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MOBILE TOOLBAR
// ============================================================================

export interface MobileToolbarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export interface MobileToolbarProps {
  items: MobileToolbarItem[];
  position?: 'top' | 'bottom';
  className?: string;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  items,
  position = 'bottom',
  className = '',
}) => {
  return (
    <div
      className={`
        fixed left-0 right-0 z-40
        bg-gray-900/95 backdrop-blur-sm
        border-gray-700
        safe-area-inset
        ${position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t'}
        ${className}
      `}
    >
      <div className="flex items-center justify-around h-14 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`
              flex flex-col items-center justify-center
              min-w-[60px] h-full px-2
              transition-colors duration-150
              ${item.isActive ? 'text-blue-400' : 'text-gray-400'}
              ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-gray-800'}
            `}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// NETWORK-ADAPTIVE IMAGE LOADER
// ============================================================================

export interface AdaptiveLoaderConfig {
  maxConcurrent: {
    'slow-2g': number;
    '2g': number;
    '3g': number;
    '4g': number;
    'wifi': number;
    'ethernet': number;
    'unknown': number;
  };
  qualityPresets: {
    'slow-2g': number;
    '2g': number;
    '3g': number;
    '4g': number;
    'wifi': number;
    'ethernet': number;
    'unknown': number;
  };
}

export class NetworkAdaptiveLoader {
  private config: AdaptiveLoaderConfig;
  private currentConnection: DeviceCapabilities['connectionType'];
  private activeLoads = 0;
  private queue: Array<{
    load: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(config?: Partial<AdaptiveLoaderConfig>) {
    this.config = {
      maxConcurrent: {
        'slow-2g': 1,
        '2g': 2,
        '3g': 4,
        '4g': 8,
        'wifi': 12,
        'ethernet': 16,
        'unknown': 4,
        ...config?.maxConcurrent,
      },
      qualityPresets: {
        'slow-2g': 0.25,
        '2g': 0.5,
        '3g': 0.75,
        '4g': 1.0,
        'wifi': 1.0,
        'ethernet': 1.0,
        'unknown': 0.75,
        ...config?.qualityPresets,
      },
    };

    this.currentConnection = this.detectConnection();
    this.listenForConnectionChanges();
  }

  private detectConnection(): DeviceCapabilities['connectionType'] {
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    return (connection?.effectiveType as DeviceCapabilities['connectionType']) || 'unknown';
  }

  private listenForConnectionChanges(): void {
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string; addEventListener: (event: string, handler: () => void) => void } }).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.currentConnection = this.detectConnection();
        console.log(`[NetworkAdaptiveLoader] Connection changed to ${this.currentConnection}`);
      });
    }
  }

  /**
   * Queue a load operation with adaptive concurrency
   */
  async load<T>(loader: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        load: loader,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    const maxConcurrent = this.config.maxConcurrent[this.currentConnection];

    while (this.queue.length > 0 && this.activeLoads < maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeLoads++;
      try {
        const result = await item.load();
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      } finally {
        this.activeLoads--;
        this.processQueue();
      }
    }
  }

  /**
   * Get recommended image quality for current connection
   */
  getRecommendedQuality(): number {
    return this.config.qualityPresets[this.currentConnection];
  }

  /**
   * Get current max concurrent loads
   */
  getMaxConcurrent(): number {
    return this.config.maxConcurrent[this.currentConnection];
  }

  getCurrentConnection(): DeviceCapabilities['connectionType'] {
    return this.currentConnection;
  }
}

// ============================================================================
// BATTERY-AWARE RENDERER
// ============================================================================

export class BatteryAwareRenderer {
  private batteryLevel = 1;
  private isCharging = true;
  private listeners: Array<(mode: 'full' | 'balanced' | 'powersave') => void> = [];

  constructor() {
    this.initBatteryMonitoring();
  }

  private async initBatteryMonitoring(): Promise<void> {
    try {
      const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (event: string, handler: () => void) => void }> }).getBattery?.();
      if (battery) {
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.notifyModeChange();
        });

        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.notifyModeChange();
        });
      }
    } catch (e) {
      // Battery API not available
    }
  }

  /**
   * Get recommended rendering mode based on battery
   */
  getRecommendedMode(): 'full' | 'balanced' | 'powersave' {
    if (this.isCharging) return 'full';
    if (this.batteryLevel > 0.5) return 'full';
    if (this.batteryLevel > 0.2) return 'balanced';
    return 'powersave';
  }

  /**
   * Get rendering config for current mode
   */
  getRenderingConfig(): {
    fps: number;
    quality: number;
    enableEffects: boolean;
    enableAnimations: boolean;
  } {
    const mode = this.getRecommendedMode();

    switch (mode) {
      case 'full':
        return { fps: 60, quality: 1.0, enableEffects: true, enableAnimations: true };
      case 'balanced':
        return { fps: 30, quality: 0.75, enableEffects: false, enableAnimations: true };
      case 'powersave':
        return { fps: 15, quality: 0.5, enableEffects: false, enableAnimations: false };
    }
  }

  onModeChange(callback: (mode: 'full' | 'balanced' | 'powersave') => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyModeChange(): void {
    const mode = this.getRecommendedMode();
    this.listeners.forEach(l => l(mode));
  }

  getBatteryStatus(): { level: number; isCharging: boolean } {
    return { level: this.batteryLevel, isCharging: this.isCharging };
  }
}

// ============================================================================
// OFFLINE SUPPORT
// ============================================================================

export interface CachedStudy {
  studyInstanceUID: string;
  studyDescription: string;
  modality: string;
  patientName: string;
  studyDate: string;
  cachedAt: Date;
  size: number;
  seriesUIDs: string[];
}

export class OfflineStudyManager {
  private dbName = 'ohif-offline-studies';
  private db: IDBDatabase | null = null;
  private cacheQuota = 500 * 1024 * 1024; // 500 MB default

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('studies')) {
          const studyStore = db.createObjectStore('studies', { keyPath: 'studyInstanceUID' });
          studyStore.createIndex('cachedAt', 'cachedAt');
        }

        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'sopInstanceUID' });
          imageStore.createIndex('studyInstanceUID', 'studyInstanceUID');
        }
      };
    });
  }

  /**
   * Cache a study for offline access
   */
  async cacheStudy(
    studyMetadata: Omit<CachedStudy, 'cachedAt' | 'size'>,
    imageLoader: (sopInstanceUID: string) => Promise<ArrayBuffer>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check quota
    const currentSize = await this.getCacheSize();
    if (currentSize >= this.cacheQuota) {
      await this.evictOldest();
    }

    const study: CachedStudy = {
      ...studyMetadata,
      cachedAt: new Date(),
      size: 0,
    };

    // Cache images
    let totalSize = 0;
    for (const seriesUID of study.seriesUIDs) {
      // In production, iterate through instances in series
      try {
        const imageData = await imageLoader(seriesUID);
        totalSize += imageData.byteLength;

        await this.storeImage(study.studyInstanceUID, seriesUID, imageData);
      } catch (error) {
        console.error(`Failed to cache image ${seriesUID}:`, error);
      }
    }

    study.size = totalSize;
    await this.storeStudy(study);
  }

  /**
   * Check if study is cached
   */
  async isStudyCached(studyInstanceUID: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['studies'], 'readonly');
      const store = transaction.objectStore('studies');
      const request = store.get(studyInstanceUID);

      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => resolve(false);
    });
  }

  /**
   * Get cached study metadata
   */
  async getCachedStudy(studyInstanceUID: string): Promise<CachedStudy | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['studies'], 'readonly');
      const store = transaction.objectStore('studies');
      const request = store.get(studyInstanceUID);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Get all cached studies
   */
  async getAllCachedStudies(): Promise<CachedStudy[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['studies'], 'readonly');
      const store = transaction.objectStore('studies');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  /**
   * Remove a cached study
   */
  async removeStudy(studyInstanceUID: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['studies', 'images'], 'readwrite');

    // Delete study metadata
    transaction.objectStore('studies').delete(studyInstanceUID);

    // Delete associated images
    const imageStore = transaction.objectStore('images');
    const index = imageStore.index('studyInstanceUID');
    const request = index.openCursor(IDBKeyRange.only(studyInstanceUID));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  private async storeStudy(study: CachedStudy): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['studies'], 'readwrite');
      const store = transaction.objectStore('studies');
      const request = store.put(study);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async storeImage(
    studyInstanceUID: string,
    sopInstanceUID: string,
    data: ArrayBuffer
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.put({ sopInstanceUID, studyInstanceUID, data });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getCacheSize(): Promise<number> {
    const studies = await this.getAllCachedStudies();
    return studies.reduce((sum, s) => sum + s.size, 0);
  }

  private async evictOldest(): Promise<void> {
    const studies = await this.getAllCachedStudies();
    studies.sort((a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime());

    if (studies.length > 0) {
      await this.removeStudy(studies[0].studyInstanceUID);
      console.log(`[OfflineStudyManager] Evicted ${studies[0].studyInstanceUID}`);
    }
  }

  setCacheQuota(bytes: number): void {
    this.cacheQuota = bytes;
  }
}

// ============================================================================
// USE MOBILE HOOKS
// ============================================================================

export function useMobileCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(detectDeviceCapabilities);

  useEffect(() => {
    const handleResize = () => {
      setCapabilities(detectDeviceCapabilities());
    };

    const handleOrientationChange = () => {
      setCapabilities(detectDeviceCapabilities());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return capabilities;
}

export function useNetworkStatus(): {
  isOnline: boolean;
  connectionType: DeviceCapabilities['connectionType'];
} {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<DeviceCapabilities['connectionType']>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const updateConnection = () => {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      setConnectionType((connection?.effectiveType as DeviceCapabilities['connectionType']) || 'unknown');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    updateConnection();

    const connection = (navigator as Navigator & { connection?: { addEventListener: (event: string, handler: () => void) => void } }).connection;
    if (connection) {
      connection.addEventListener('change', updateConnection);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}

export function useBatteryStatus(): {
  level: number;
  isCharging: boolean;
  renderMode: 'full' | 'balanced' | 'powersave';
} {
  const [status, setStatus] = useState({ level: 1, isCharging: true });
  const renderer = useRef(new BatteryAwareRenderer());

  useEffect(() => {
    const updateStatus = () => {
      setStatus(renderer.current.getBatteryStatus());
    };

    updateStatus();
    const unsubscribe = renderer.current.onModeChange(updateStatus);

    return unsubscribe;
  }, []);

  return {
    ...status,
    renderMode: renderer.current.getRecommendedMode(),
  };
}

// Export all mobile components
export default {
  detectDeviceCapabilities,
  TouchGestureHandler,
  MobileViewport,
  ResponsivePanel,
  MobileToolbar,
  NetworkAdaptiveLoader,
  BatteryAwareRenderer,
  OfflineStudyManager,
  useMobileCapabilities,
  useNetworkStatus,
  useBatteryStatus,
};
