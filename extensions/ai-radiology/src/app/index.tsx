/**
 * Complete AI Radiology Web Application
 * Production-grade React 18 application with optimized UX
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy, createContext, useContext, useTransition, useDeferredValue } from 'react';

// ============================================================================
// APPLICATION STATE MANAGEMENT
// ============================================================================

export interface AppState {
  user: User | null;
  studies: Study[];
  selectedStudy: Study | null;
  worklist: WorklistItem[];
  aiResults: Map<string, AIResult>;
  notifications: Notification[];
  settings: UserSettings;
  theme: 'light' | 'dark' | 'auto';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'radiologist' | 'technologist' | 'admin';
  avatar?: string;
}

export interface Study {
  id: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  description: string;
  status: 'unread' | 'in-progress' | 'completed';
  aiStatus: 'pending' | 'analyzing' | 'complete' | 'error';
  findings: number;
  priority: 'stat' | 'urgent' | 'routine';
}

export interface WorklistItem extends Study {
  assignedTo?: string;
  dueTime?: string;
}

export interface AIResult {
  studyId: string;
  findings: Finding[];
  confidence: number;
  processingTime: number;
  modelVersion: string;
}

export interface Finding {
  id: string;
  type: string;
  description: string;
  confidence: number;
  location?: { seriesIndex: number; instanceIndex: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'ai';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: { label: string; onClick: () => void };
}

export interface UserSettings {
  autoRunAI: boolean;
  showAIOverlays: boolean;
  confidenceThreshold: number;
  defaultLayout: string;
  soundEnabled: boolean;
  language: string;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_STUDIES'; payload: Study[] }
  | { type: 'SELECT_STUDY'; payload: Study | null }
  | { type: 'UPDATE_STUDY'; payload: Study }
  | { type: 'SET_WORKLIST'; payload: WorklistItem[] }
  | { type: 'SET_AI_RESULT'; payload: { studyId: string; result: AIResult } }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'auto' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_STUDIES':
      return { ...state, studies: action.payload };
    case 'SELECT_STUDY':
      return { ...state, selectedStudy: action.payload };
    case 'UPDATE_STUDY':
      return {
        ...state,
        studies: state.studies.map(s => s.id === action.payload.id ? action.payload : s),
        selectedStudy: state.selectedStudy?.id === action.payload.id ? action.payload : state.selectedStudy,
      };
    case 'SET_WORKLIST':
      return { ...state, worklist: action.payload };
    case 'SET_AI_RESULT':
      const newResults = new Map(state.aiResults);
      newResults.set(action.payload.studyId, action.payload.result);
      return { ...state, aiResults: newResults };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications].slice(0, 50) };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

const initialState: AppState = {
  user: null,
  studies: [],
  selectedStudy: null,
  worklist: [],
  aiResults: new Map(),
  notifications: [],
  settings: {
    autoRunAI: true,
    showAIOverlays: true,
    confidenceThreshold: 0.5,
    defaultLayout: '1x1',
    soundEnabled: true,
    language: 'en-US',
  },
  theme: 'dark',
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue];
}

export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options.threshold, options.root, options.rootMargin]);

  return isIntersecting;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useKeyboardShortcut(key: string, callback: () => void, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (modifiers.ctrl && !e.ctrlKey && !e.metaKey) return;
      if (modifiers.shift && !e.shiftKey) return;
      if (modifiers.alt && !e.altKey) return;

      e.preventDefault();
      callback();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, modifiers.ctrl, modifiers.shift, modifiers.alt]);
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

// Loading Spinner
export function Spinner({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// Button
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary: 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:opacity-90 focus:ring-purple-500',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500',
    ghost: 'bg-transparent text-gray-300 hover:bg-gray-700 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} /> : icon}
      {children}
    </button>
  );
}

// Input
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
          <input
            ref={ref}
            className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${icon ? 'pl-10' : ''} ${error ? 'border-red-500' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Card
export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 ${hover ? 'hover:bg-gray-700/50 cursor-pointer transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Badge
export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'ai';
}) {
  const variants = {
    default: 'bg-gray-700 text-gray-300',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
    ai: 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-300',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

// Sidebar
export function Sidebar({ collapsed = false, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { state, dispatch } = useApp();

  const navItems = [
    { id: 'worklist', icon: '📋', label: 'Worklist', badge: state.worklist.length },
    { id: 'studies', icon: '🏥', label: 'Studies' },
    { id: 'ai-dashboard', icon: '🤖', label: 'AI Dashboard' },
    { id: 'reports', icon: '📄', label: 'Reports' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'teaching', icon: '📚', label: 'Teaching' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-full bg-gray-900/95 backdrop-blur-lg border-r border-gray-800 transition-all duration-300 z-40 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
        {!collapsed && (
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            AI Radiology
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          type="button"
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1" role="navigation" aria-label="Main navigation">
        {navItems.map(item => (
          <button
            key={item.id}
            type="button"
            aria-label={collapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="text-xl">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sm">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="ai">{item.badge}</Badge>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* User */}
      {state.user && (
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 ${collapsed ? 'text-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {state.user.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{state.user.name}</p>
                <p className="text-xs text-gray-400 truncate">{state.user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

// Header
export function Header() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  return (
    <header className="h-16 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <Input
          placeholder="Search patients, studies, reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<span>🔍</span>}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* AI Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-300">AI Online</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label={`Notifications${state.notifications.filter(n => !n.read).length > 0 ? ` (${state.notifications.filter(n => !n.read).length} unread)` : ''}`}
          className="relative p-2 rounded-lg hover:bg-gray-800 text-gray-400"
        >
          <span className="text-xl" aria-hidden="true">🔔</span>
          {state.notifications.filter(n => !n.read).length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
          )}
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })}
          aria-label={state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
        >
          <span aria-hidden="true">{state.theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>
    </header>
  );
}

// ============================================================================
// MAIN PAGES
// ============================================================================

// Study List
export function StudyList() {
  const { state, dispatch } = useApp();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'all' | 'unread' | 'ai-findings'>('all');

  const filteredStudies = useMemo(() => {
    switch (filter) {
      case 'unread':
        return state.studies.filter(s => s.status === 'unread');
      case 'ai-findings':
        return state.studies.filter(s => s.findings > 0);
      default:
        return state.studies;
    }
  }, [state.studies, filter]);

  const handleSelectStudy = useCallback((study: Study) => {
    startTransition(() => {
      dispatch({ type: 'SELECT_STUDY', payload: study });
    });
  }, [dispatch]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'unread', 'ai-findings'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All Studies' : f === 'unread' ? 'Unread' : 'AI Findings'}
          </Button>
        ))}
      </div>

      {/* Study Cards */}
      <div className="grid gap-3">
        {filteredStudies.map(study => (
          <Card key={study.id} hover onClick={() => handleSelectStudy(study)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Priority Indicator */}
                <div className={`w-1 h-12 rounded-full ${
                  study.priority === 'stat' ? 'bg-red-500' :
                  study.priority === 'urgent' ? 'bg-yellow-500' : 'bg-gray-600'
                }`} />

                {/* Patient Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{study.patientName}</span>
                    <Badge>{study.modality}</Badge>
                    {study.findings > 0 && (
                      <Badge variant="ai">🤖 {study.findings} findings</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{study.description}</p>
                  <p className="text-xs text-gray-500">{study.studyDate}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <Badge variant={
                  study.status === 'completed' ? 'success' :
                  study.status === 'in-progress' ? 'warning' : 'default'
                }>
                  {study.status}
                </Badge>
                {study.aiStatus === 'analyzing' && <Spinner size={16} />}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isPending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Spinner size={48} color="#8B5CF6" />
        </div>
      )}
    </div>
  );
}

// AI Dashboard
export function AIDashboard() {
  const { state } = useApp();

  const metrics = useMemo(() => ({
    totalAnalyzed: state.aiResults.size,
    avgConfidence: Array.from(state.aiResults.values()).reduce((sum, r) => sum + r.confidence, 0) / (state.aiResults.size || 1),
    criticalFindings: Array.from(state.aiResults.values()).flatMap(r => r.findings).filter(f => f.severity === 'critical').length,
    avgProcessingTime: Array.from(state.aiResults.values()).reduce((sum, r) => sum + r.processingTime, 0) / (state.aiResults.size || 1),
  }), [state.aiResults]);

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Studies Analyzed"
          value={metrics.totalAnalyzed}
          icon="🔬"
          trend={{ value: 12, positive: true }}
        />
        <MetricCard
          title="Avg Confidence"
          value={`${(metrics.avgConfidence * 100).toFixed(1)}%`}
          icon="📊"
        />
        <MetricCard
          title="Critical Findings"
          value={metrics.criticalFindings}
          icon="⚠️"
          variant={metrics.criticalFindings > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Avg Processing"
          value={`${metrics.avgProcessingTime.toFixed(0)}ms`}
          icon="⚡"
        />
      </div>

      {/* AI Models Status */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Active AI Models</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'Chest X-Ray Analyzer', status: 'active', accuracy: 0.96 },
            { name: 'CT Lung Nodule', status: 'active', accuracy: 0.94 },
            { name: 'Brain MRI Stroke', status: 'active', accuracy: 0.92 },
          ].map(model => (
            <div key={model.name} className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{model.name}</span>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <div className="text-2xl font-bold text-white">{(model.accuracy * 100).toFixed(0)}%</div>
              <p className="text-xs text-gray-400">Accuracy</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent AI Findings */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Recent AI Findings</h3>
        <div className="space-y-3">
          {Array.from(state.aiResults.values()).slice(0, 5).flatMap(r =>
            r.findings.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-gray-700/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    f.severity === 'critical' ? 'bg-red-500' :
                    f.severity === 'high' ? 'bg-orange-500' :
                    f.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{f.type}</p>
                    <p className="text-xs text-gray-400">{f.description}</p>
                  </div>
                </div>
                <Badge variant={f.confidence > 0.9 ? 'success' : f.confidence > 0.7 ? 'warning' : 'default'}>
                  {(f.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: number; positive: boolean };
  variant?: 'default' | 'warning';
}) {
  return (
    <Card className={variant === 'warning' ? 'border-yellow-500/50' : ''}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}% from last week
            </p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export function App() {
  const [state, dispatch] = React.useReducer(appReducer, initialState);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Initialize demo data
  useEffect(() => {
    const demoStudies: Study[] = [
      { id: '1', patientId: 'P001', patientName: 'John Smith', studyDate: '2024-01-15', modality: 'CT', description: 'CT Chest with Contrast', status: 'unread', aiStatus: 'complete', findings: 2, priority: 'urgent' },
      { id: '2', patientId: 'P002', patientName: 'Jane Doe', studyDate: '2024-01-15', modality: 'MRI', description: 'MRI Brain without Contrast', status: 'in-progress', aiStatus: 'analyzing', findings: 0, priority: 'routine' },
      { id: '3', patientId: 'P003', patientName: 'Robert Johnson', studyDate: '2024-01-14', modality: 'XR', description: 'Chest X-Ray PA and Lateral', status: 'completed', aiStatus: 'complete', findings: 1, priority: 'stat' },
    ];

    dispatch({ type: 'SET_STUDIES', payload: demoStudies });
    dispatch({ type: 'SET_USER', payload: { id: 'U001', name: 'Dr. Sarah Wilson', email: 'sarah@hospital.com', role: 'radiologist' } });
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcut('k', () => document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus(), { ctrl: true });

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Sidebar */}
        <Sidebar collapsed={isMobile || sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

        {/* Main Content */}
        <main
          className={`transition-all duration-300 ${isMobile || sidebarCollapsed ? 'ml-16' : 'ml-64'}`}
          role="main"
          aria-label="Main content"
        >
          <Header />

          <div className="p-6">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size={48} /></div>}>
              {/* Page Content - In a real app, this would be router-based */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h2 className="text-2xl font-bold mb-4">Study Worklist</h2>
                  <StudyList />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-4">AI Overview</h2>
                  <AIDashboard />
                </div>
              </div>
            </Suspense>
          </div>
        </main>

        {/* Global Styles */}
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
          .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
        `}</style>
      </div>
    </AppContext.Provider>
  );
}

// Wrapped App with ErrorBoundary for production
export function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
