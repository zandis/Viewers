/**
 * Modern Professional Web Design with AI
 * Enterprise-grade UI components with glassmorphism, AI-powered interactions
 * Built with React 18, TypeScript, and modern CSS features
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext, Suspense } from 'react';

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

export const designTokens = {
  colors: {
    // Primary palette
    primary: {
      50: '#E3F2FD',
      100: '#BBDEFB',
      200: '#90CAF9',
      300: '#64B5F6',
      400: '#42A5F5',
      500: '#2196F3',
      600: '#1E88E5',
      700: '#1976D2',
      800: '#1565C0',
      900: '#0D47A1',
    },
    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    // Neutral palette
    gray: {
      50: '#FAFAFA',
      100: '#F4F4F5',
      200: '#E4E4E7',
      300: '#D4D4D8',
      400: '#A1A1AA',
      500: '#71717A',
      600: '#52525B',
      700: '#3F3F46',
      800: '#27272A',
      900: '#18181B',
    },
    // AI accent colors
    ai: {
      glow: 'rgba(139, 92, 246, 0.5)',
      primary: '#8B5CF6',
      secondary: '#06B6D4',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(139, 92, 246, 0.3)',
    'glow-intense': '0 0 40px rgba(139, 92, 246, 0.5)',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  typography: {
    fontFamily: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
};

// ============================================================================
// THEME CONTEXT
// ============================================================================

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  tokens: typeof designTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('auto');
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedMode = mode === 'auto' ? systemPreference : mode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode);
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, tokens: designTokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

// ============================================================================
// GLASSMORPHISM COMPONENTS
// ============================================================================

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'light' | 'dark' | 'colored';
  blur?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function GlassCard({
  children,
  variant = 'light',
  blur = 'md',
  className = '',
  style,
  onClick,
}: GlassCardProps) {
  const blurValues = { sm: '8px', md: '12px', lg: '20px' };
  const bgColors = {
    light: 'rgba(255, 255, 255, 0.7)',
    dark: 'rgba(17, 24, 39, 0.7)',
    colored: 'rgba(139, 92, 246, 0.1)',
  };

  return (
    <div
      className={`glass-card ${className}`}
      onClick={onClick}
      style={{
        backdropFilter: `blur(${blurValues[blur]})`,
        WebkitBackdropFilter: `blur(${blurValues[blur]})`,
        backgroundColor: bgColors[variant],
        borderRadius: designTokens.borderRadius.lg,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: designTokens.shadows.lg,
        padding: designTokens.spacing.lg,
        transition: designTokens.transitions.normal,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface GlassPanelProps extends GlassCardProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function GlassPanel({ header, footer, children, ...props }: GlassPanelProps) {
  return (
    <GlassCard {...props}>
      {header && (
        <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: designTokens.spacing.md, marginBottom: designTokens.spacing.md }}>
          {header}
        </div>
      )}
      <div style={{ flex: 1 }}>{children}</div>
      {footer && (
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: designTokens.spacing.md, marginTop: designTokens.spacing.md }}>
          {footer}
        </div>
      )}
    </GlassCard>
  );
}

// ============================================================================
// AI-POWERED COMPONENTS
// ============================================================================

interface AIAssistantButtonProps {
  onActivate: () => void;
  isListening?: boolean;
  isProcessing?: boolean;
}

export function AIAssistantButton({ onActivate, isListening, isProcessing }: AIAssistantButtonProps) {
  return (
    <button
      onClick={onActivate}
      aria-label={isListening ? 'AI listening' : isProcessing ? 'AI processing' : 'Activate AI assistant'}
      aria-busy={isProcessing}
      type="button"
      style={{
        width: '56px',
        height: '56px',
        borderRadius: designTokens.borderRadius.full,
        background: designTokens.colors.ai.gradient,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isListening || isProcessing ? designTokens.shadows['glow-intense'] : designTokens.shadows.glow,
        transition: designTokens.transitions.normal,
        animation: isProcessing ? 'pulse 1.5s infinite' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isListening ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      )}
      {isProcessing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      )}
    </button>
  );
}

interface AISuggestionCardProps {
  suggestion: {
    id: string;
    type: 'finding' | 'measurement' | 'recommendation' | 'comparison';
    title: string;
    description: string;
    confidence: number;
    action?: () => void;
    actionLabel?: string;
  };
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function AISuggestionCard({ suggestion, onAccept, onDismiss }: AISuggestionCardProps) {
  const typeColors = {
    finding: designTokens.colors.error,
    measurement: designTokens.colors.info,
    recommendation: designTokens.colors.success,
    comparison: designTokens.colors.warning,
  };

  const typeIcons = {
    finding: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    measurement: 'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v3H5z',
    recommendation: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
    comparison: 'M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  };

  return (
    <GlassCard
      variant="colored"
      style={{
        borderLeft: `4px solid ${typeColors[suggestion.type]}`,
        marginBottom: designTokens.spacing.md,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: designTokens.spacing.md }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: designTokens.borderRadius.full,
            background: `${typeColors[suggestion.type]}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={typeColors[suggestion.type]}>
            <path d={typeIcons[suggestion.type]} />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.sm, marginBottom: designTokens.spacing.xs }}>
            <span style={{ fontSize: designTokens.typography.fontSize.sm, fontWeight: designTokens.typography.fontWeight.semibold }}>
              {suggestion.title}
            </span>
            <span
              style={{
                fontSize: designTokens.typography.fontSize.xs,
                background: designTokens.colors.ai.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              AI {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>

          <p style={{ fontSize: designTokens.typography.fontSize.sm, color: designTokens.colors.gray[400], margin: 0 }}>
            {suggestion.description}
          </p>

          <div style={{ display: 'flex', gap: designTokens.spacing.sm, marginTop: designTokens.spacing.md }}>
            {onAccept && (
              <button
                onClick={onAccept}
                style={{
                  padding: `${designTokens.spacing.xs} ${designTokens.spacing.md}`,
                  borderRadius: designTokens.borderRadius.md,
                  background: designTokens.colors.ai.gradient,
                  border: 'none',
                  color: 'white',
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.medium,
                  cursor: 'pointer',
                  transition: designTokens.transitions.fast,
                }}
              >
                {suggestion.actionLabel || 'Accept'}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  padding: `${designTokens.spacing.xs} ${designTokens.spacing.md}`,
                  borderRadius: designTokens.borderRadius.md,
                  background: 'transparent',
                  border: `1px solid ${designTokens.colors.gray[600]}`,
                  color: designTokens.colors.gray[400],
                  fontSize: designTokens.typography.fontSize.sm,
                  cursor: 'pointer',
                  transition: designTokens.transitions.fast,
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================================
// NAVIGATION COMPONENTS
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
}

interface ModernNavbarProps {
  logo?: React.ReactNode;
  items: NavItem[];
  user?: {
    name: string;
    avatar?: string;
    role: string;
  };
  onSearch?: (query: string) => void;
}

export function ModernNavbar({ logo, items, user, onSearch }: ModernNavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${designTokens.spacing.xl}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        gap: designTokens.spacing.xl,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.md }}>
        {logo || (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: designTokens.borderRadius.lg,
              background: designTokens.colors.ai.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        <span
          style={{
            fontSize: designTokens.typography.fontSize.xl,
            fontWeight: designTokens.typography.fontWeight.bold,
            background: designTokens.colors.ai.gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI Radiology
        </span>
      </div>

      {/* Search */}
      {onSearch && (
        <div
          style={{
            flex: 1,
            maxWidth: '400px',
            position: 'relative',
          }}
        >
          <input
            type="text"
            placeholder="Search studies, patients, reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(searchQuery)}
            style={{
              width: '100%',
              padding: `${designTokens.spacing.sm} ${designTokens.spacing.lg}`,
              paddingLeft: '40px',
              borderRadius: designTokens.borderRadius.full,
              border: 'none',
              backgroundColor: searchFocused ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: designTokens.typography.fontSize.sm,
              outline: 'none',
              transition: designTokens.transitions.fast,
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={designTokens.colors.gray[400]}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </div>
      )}

      {/* Navigation Items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.sm }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            type="button"
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: designTokens.spacing.sm,
              padding: `${designTokens.spacing.sm} ${designTokens.spacing.md}`,
              borderRadius: designTokens.borderRadius.md,
              border: 'none',
              backgroundColor: item.active ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              color: item.active ? designTokens.colors.ai.primary : designTokens.colors.gray[300],
              fontSize: designTokens.typography.fontSize.sm,
              fontWeight: designTokens.typography.fontWeight.medium,
              cursor: 'pointer',
              transition: designTokens.transitions.fast,
              position: 'relative',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: designTokens.borderRadius.full,
                  backgroundColor: designTokens.colors.error,
                  color: 'white',
                  fontSize: designTokens.typography.fontSize.xs,
                  fontWeight: designTokens.typography.fontWeight.bold,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* User Menu */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.md, marginLeft: 'auto' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: designTokens.typography.fontSize.sm, fontWeight: designTokens.typography.fontWeight.medium, color: 'white' }}>
              {user.name}
            </div>
            <div style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.gray[400] }}>
              {user.role}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: designTokens.borderRadius.full,
              background: user.avatar ? `url(${user.avatar}) center/cover` : designTokens.colors.ai.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: designTokens.typography.fontWeight.bold,
            }}
          >
            {!user.avatar && user.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </nav>
  );
}

// ============================================================================
// DATA VISUALIZATION COMPONENTS
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

export function MetricCard({ title, value, change, changeLabel, icon, trend, loading }: MetricCardProps) {
  const trendColors = {
    up: designTokens.colors.success,
    down: designTokens.colors.error,
    neutral: designTokens.colors.gray[400],
  };

  return (
    <GlassCard variant="dark">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: designTokens.typography.fontSize.sm, color: designTokens.colors.gray[400], marginBottom: designTokens.spacing.sm }}>
            {title}
          </div>
          {loading ? (
            <div
              style={{
                width: '120px',
                height: '32px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                borderRadius: designTokens.borderRadius.sm,
              }}
            />
          ) : (
            <div style={{ fontSize: designTokens.typography.fontSize['3xl'], fontWeight: designTokens.typography.fontWeight.bold, color: 'white' }}>
              {value}
            </div>
          )}
          {change !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.xs, marginTop: designTokens.spacing.sm }}>
              <span style={{ color: trendColors[trend || 'neutral'], fontSize: designTokens.typography.fontSize.sm, fontWeight: designTokens.typography.fontWeight.medium }}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(change)}%
              </span>
              {changeLabel && (
                <span style={{ color: designTokens.colors.gray[500], fontSize: designTokens.typography.fontSize.xs }}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: designTokens.borderRadius.lg,
              background: 'rgba(139, 92, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = designTokens.colors.ai.primary,
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: designTokens.typography.fontSize['2xl'], fontWeight: designTokens.typography.fontWeight.bold, color: 'white' }}>
          {Math.round(progress)}%
        </span>
        {label && (
          <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.gray[400] }}>
            {label}
          </span>
        )}
        {sublabel && (
          <span style={{ fontSize: designTokens.typography.fontSize.xs, color: designTokens.colors.gray[500] }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LOADING & SKELETON COMPONENTS
// ============================================================================

export function SkeletonLoader({ width = '100%', height = '20px', rounded = false }: {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: rounded ? designTokens.borderRadius.full : designTokens.borderRadius.sm,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

export function ImageViewerSkeleton() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: designTokens.spacing.md }}>
      <div style={{ display: 'flex', gap: designTokens.spacing.md }}>
        <SkeletonLoader width={120} height={24} />
        <SkeletonLoader width={80} height={24} />
        <SkeletonLoader width={100} height={24} />
      </div>
      <SkeletonLoader width="100%" height="calc(100% - 48px)" />
    </div>
  );
}

// ============================================================================
// ANIMATION KEYFRAMES (inject into document)
// ============================================================================

if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(0.98); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideIn {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
      50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6); }
    }

    .glass-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3);
    }
  `;
  document.head.appendChild(styleEl);
}

// ============================================================================
// STUDY LIST TABLE
// ============================================================================

interface StudyListProps {
  studies: Array<{
    id: string;
    patientName: string;
    patientId: string;
    studyDate: string;
    modality: string;
    description: string;
    status: 'unread' | 'in-progress' | 'completed';
    aiFindings?: number;
    priority?: 'stat' | 'urgent' | 'routine';
  }>;
  onStudyClick?: (studyId: string) => void;
  loading?: boolean;
}

export function StudyListTable({ studies, onStudyClick, loading }: StudyListProps) {
  const statusColors = {
    'unread': designTokens.colors.warning,
    'in-progress': designTokens.colors.info,
    'completed': designTokens.colors.success,
  };

  const priorityStyles = {
    'stat': { bg: `${designTokens.colors.error}20`, color: designTokens.colors.error },
    'urgent': { bg: `${designTokens.colors.warning}20`, color: designTokens.colors.warning },
    'routine': { bg: `${designTokens.colors.gray[700]}`, color: designTokens.colors.gray[400] },
  };

  if (loading) {
    return (
      <GlassCard variant="dark">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: designTokens.spacing.lg, padding: designTokens.spacing.md, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <SkeletonLoader width={150} height={20} />
            <SkeletonLoader width={100} height={20} />
            <SkeletonLoader width={80} height={20} />
            <SkeletonLoader width={200} height={20} />
          </div>
        ))}
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="dark" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {['Patient', 'MRN', 'Date', 'Modality', 'Description', 'Status', 'AI'].map((header) => (
              <th
                key={header}
                style={{
                  padding: designTokens.spacing.md,
                  textAlign: 'left',
                  fontSize: designTokens.typography.fontSize.xs,
                  fontWeight: designTokens.typography.fontWeight.semibold,
                  color: designTokens.colors.gray[400],
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {studies.map((study) => (
            <tr
              key={study.id}
              onClick={() => onStudyClick?.(study.id)}
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: designTokens.transitions.fast,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <td style={{ padding: designTokens.spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.sm }}>
                  {study.priority && (
                    <span
                      style={{
                        padding: `2px ${designTokens.spacing.xs}`,
                        borderRadius: designTokens.borderRadius.sm,
                        fontSize: designTokens.typography.fontSize.xs,
                        fontWeight: designTokens.typography.fontWeight.bold,
                        textTransform: 'uppercase',
                        ...priorityStyles[study.priority],
                      }}
                    >
                      {study.priority}
                    </span>
                  )}
                  <span style={{ color: 'white', fontWeight: designTokens.typography.fontWeight.medium }}>
                    {study.patientName}
                  </span>
                </div>
              </td>
              <td style={{ padding: designTokens.spacing.md, color: designTokens.colors.gray[400], fontSize: designTokens.typography.fontSize.sm }}>
                {study.patientId}
              </td>
              <td style={{ padding: designTokens.spacing.md, color: designTokens.colors.gray[400], fontSize: designTokens.typography.fontSize.sm }}>
                {study.studyDate}
              </td>
              <td style={{ padding: designTokens.spacing.md }}>
                <span
                  style={{
                    padding: `${designTokens.spacing.xs} ${designTokens.spacing.sm}`,
                    borderRadius: designTokens.borderRadius.sm,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    color: designTokens.colors.ai.primary,
                    fontSize: designTokens.typography.fontSize.xs,
                    fontWeight: designTokens.typography.fontWeight.medium,
                  }}
                >
                  {study.modality}
                </span>
              </td>
              <td style={{ padding: designTokens.spacing.md, color: designTokens.colors.gray[300], fontSize: designTokens.typography.fontSize.sm, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {study.description}
              </td>
              <td style={{ padding: designTokens.spacing.md }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: designTokens.spacing.xs,
                    fontSize: designTokens.typography.fontSize.sm,
                    color: statusColors[study.status],
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColors[study.status] }} />
                  {study.status.replace('-', ' ')}
                </span>
              </td>
              <td style={{ padding: designTokens.spacing.md }}>
                {study.aiFindings !== undefined && study.aiFindings > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: designTokens.spacing.xs,
                      padding: `${designTokens.spacing.xs} ${designTokens.spacing.sm}`,
                      borderRadius: designTokens.borderRadius.full,
                      background: designTokens.colors.ai.gradient,
                      color: 'white',
                      fontSize: designTokens.typography.fontSize.xs,
                      fontWeight: designTokens.typography.fontWeight.medium,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    {study.aiFindings}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Theme
  ThemeProvider,
  useTheme,
  designTokens,
  // Glassmorphism
  GlassCard,
  GlassPanel,
  // AI Components
  AIAssistantButton,
  AISuggestionCard,
  // Navigation
  ModernNavbar,
  // Data Visualization
  MetricCard,
  ProgressRing,
  // Loading
  SkeletonLoader,
  ImageViewerSkeleton,
  // Tables
  StudyListTable,
};
