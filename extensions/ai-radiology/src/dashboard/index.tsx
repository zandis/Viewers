/**
 * AI Radiology Dashboard
 * Modern enterprise dashboard for radiology workflow management
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardConfig {
  refreshInterval: number;
  defaultView: 'overview' | 'worklist' | 'analytics' | 'quality';
  widgets: WidgetConfig[];
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export type WidgetType =
  | 'study-volume'
  | 'turnaround-time'
  | 'ai-accuracy'
  | 'critical-findings'
  | 'worklist-status'
  | 'modality-distribution'
  | 'radiologist-productivity'
  | 'compliance-status';

export interface DashboardMetrics {
  studyVolume: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    trend: number;
  };
  turnaroundTime: {
    average: number;
    median: number;
    p95: number;
    target: number;
  };
  aiMetrics: {
    totalAnalyses: number;
    accuracy: number;
    sensitivityAvg: number;
    falsePositiveRate: number;
  };
  criticalFindings: {
    pending: number;
    acknowledged: number;
    averageAckTime: number;
  };
  worklistStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    onHold: number;
  };
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

interface AIRadiologyDashboardProps {
  servicesManager: AppTypes.ServicesManager;
  config?: Partial<DashboardConfig>;
}

export const AIRadiologyDashboard: React.FC<AIRadiologyDashboardProps> = ({
  servicesManager,
  config,
}) => {
  const { t } = useTranslation('AIRadiology');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  // Fetch metrics on mount and interval
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await loadDashboardMetrics(servicesManager);
        setMetrics(data);
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    const interval = setInterval(fetchMetrics, config?.refreshInterval || 60000);
    return () => clearInterval(interval);
  }, [servicesManager, config?.refreshInterval]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' && metrics && (
          <OverviewTab metrics={metrics} timeRange={timeRange} />
        )}
        {activeTab === 'worklist' && (
          <WorklistTab servicesManager={servicesManager} />
        )}
        {activeTab === 'analytics' && metrics && (
          <AnalyticsTab metrics={metrics} timeRange={timeRange} />
        )}
        {activeTab === 'quality' && (
          <QualityTab servicesManager={servicesManager} />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD HEADER
// ============================================================================

interface DashboardHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  timeRange: 'today' | 'week' | 'month';
  onTimeRangeChange: (range: 'today' | 'week' | 'month') => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  onTabChange,
  timeRange,
  onTimeRangeChange,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'worklist', label: 'Worklist', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'quality', label: 'Quality', icon: '✓' },
  ];

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">AI Radiology Dashboard</h1>
          <div className="flex rounded-lg bg-muted p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-background shadow-sm'
                    : 'hover:bg-background/50'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={e => onTimeRangeChange(e.target.value as typeof timeRange)}
            className="px-3 py-2 rounded-md border bg-background"
            aria-label="Select time range"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            aria-label="Refresh dashboard"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// OVERVIEW TAB
// ============================================================================

interface OverviewTabProps {
  metrics: DashboardMetrics;
  timeRange: 'today' | 'week' | 'month';
}

const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, timeRange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI Cards */}
      <KPICard
        title="Studies"
        value={metrics.studyVolume[timeRange === 'today' ? 'today' : timeRange === 'week' ? 'thisWeek' : 'thisMonth']}
        trend={metrics.studyVolume.trend}
        icon="📁"
      />
      <KPICard
        title="Avg Turnaround"
        value={`${metrics.turnaroundTime.average}m`}
        target={`Target: ${metrics.turnaroundTime.target}m`}
        icon="⏱️"
        status={metrics.turnaroundTime.average <= metrics.turnaroundTime.target ? 'good' : 'warning'}
      />
      <KPICard
        title="AI Accuracy"
        value={`${(metrics.aiMetrics.accuracy * 100).toFixed(1)}%`}
        subtitle={`${metrics.aiMetrics.totalAnalyses} analyses`}
        icon="🤖"
      />
      <KPICard
        title="Critical Findings"
        value={metrics.criticalFindings.pending}
        subtitle="Pending acknowledgment"
        icon="⚠️"
        status={metrics.criticalFindings.pending > 0 ? 'alert' : 'good'}
      />

      {/* Worklist Status */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2">
        <WorklistStatusWidget status={metrics.worklistStatus} />
      </div>

      {/* Modality Distribution */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2">
        <ModalityDistributionWidget />
      </div>

      {/* Recent Critical Findings */}
      <div className="col-span-full">
        <RecentCriticalFindingsWidget />
      </div>
    </div>
  );
};

// ============================================================================
// WORKLIST TAB
// ============================================================================

interface WorklistTabProps {
  servicesManager: AppTypes.ServicesManager;
}

const WorklistTab: React.FC<WorklistTabProps> = ({ servicesManager }) => {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'modality'>('priority');

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <input
          type="text"
          placeholder="Search patient, accession, or study..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 rounded-md border bg-background"
          aria-label="Search worklist"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 rounded-md border bg-background"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="inProgress">In Progress</option>
          <option value="stat">STAT Only</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2 rounded-md border bg-background"
          aria-label="Sort by"
        >
          <option value="priority">Sort by Priority</option>
          <option value="date">Sort by Date</option>
          <option value="modality">Sort by Modality</option>
        </select>
      </div>

      {/* Worklist Table */}
      <div className="bg-background rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Patient</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Modality</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Study</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date/Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">AI Findings</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Sample rows - would be populated from service */}
            <WorklistRow
              priority="STAT"
              patient={{ name: 'John Doe', id: 'MRN12345' }}
              modality="CT"
              study="CT HEAD W/O CONTRAST"
              dateTime="2025-01-31 10:30"
              status="pending"
              aiFindings={['Possible stroke', 'Large vessel occlusion']}
            />
            <WorklistRow
              priority="URGENT"
              patient={{ name: 'Jane Smith', id: 'MRN67890' }}
              modality="CT"
              study="CTPA"
              dateTime="2025-01-31 09:45"
              status="inProgress"
              aiFindings={['Pulmonary embolism suspected']}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface WorklistRowProps {
  priority: string;
  patient: { name: string; id: string };
  modality: string;
  study: string;
  dateTime: string;
  status: string;
  aiFindings: string[];
}

const WorklistRow: React.FC<WorklistRowProps> = ({
  priority,
  patient,
  modality,
  study,
  dateTime,
  status,
  aiFindings,
}) => {
  const priorityColors: Record<string, string> = {
    STAT: 'bg-red-500 text-white',
    URGENT: 'bg-orange-500 text-white',
    ROUTINE: 'bg-blue-500 text-white',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    inProgress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  return (
    <tr className="border-t hover:bg-muted/50">
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[priority] || 'bg-gray-500'}`}>
          {priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="font-medium">{patient.name}</div>
          <div className="text-sm text-muted-foreground">{patient.id}</div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono">{modality}</td>
      <td className="px-4 py-3">{study}</td>
      <td className="px-4 py-3 text-sm">{dateTime}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs ${statusColors[status] || ''}`}>
          {status}
        </span>
      </td>
      <td className="px-4 py-3">
        {aiFindings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {aiFindings.slice(0, 2).map((finding, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                {finding}
              </span>
            ))}
            {aiFindings.length > 2 && (
              <span className="text-xs text-muted-foreground">+{aiFindings.length - 2} more</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          aria-label={`Open study for ${patient.name}`}
        >
          Open
        </button>
      </td>
    </tr>
  );
};

// ============================================================================
// ANALYTICS TAB
// ============================================================================

interface AnalyticsTabProps {
  metrics: DashboardMetrics;
  timeRange: 'today' | 'week' | 'month';
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ metrics, timeRange }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Study Volume Trend */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Study Volume Trend</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          [Chart: Line chart showing study volume over time]
        </div>
      </div>

      {/* Turnaround Time Distribution */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Turnaround Time Distribution</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          [Chart: Histogram of report turnaround times]
        </div>
      </div>

      {/* AI Performance Metrics */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">AI Model Performance</h3>
        <div className="grid grid-cols-2 gap-4">
          <MetricBox label="Accuracy" value={`${(metrics.aiMetrics.accuracy * 100).toFixed(1)}%`} />
          <MetricBox label="Sensitivity" value={`${(metrics.aiMetrics.sensitivityAvg * 100).toFixed(1)}%`} />
          <MetricBox label="False Positive Rate" value={`${(metrics.aiMetrics.falsePositiveRate * 100).toFixed(1)}%`} />
          <MetricBox label="Total Analyses" value={metrics.aiMetrics.totalAnalyses.toLocaleString()} />
        </div>
      </div>

      {/* Radiologist Productivity */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Radiologist Productivity</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          [Chart: Bar chart of studies per radiologist]
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// QUALITY TAB
// ============================================================================

interface QualityTabProps {
  servicesManager: AppTypes.ServicesManager;
}

const QualityTab: React.FC<QualityTabProps> = ({ servicesManager }) => {
  return (
    <div className="space-y-4">
      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComplianceCard
          title="HIPAA Compliance"
          status="compliant"
          lastAudit="2025-01-15"
          issues={0}
        />
        <ComplianceCard
          title="ACR Accreditation"
          status="compliant"
          lastAudit="2024-12-01"
          issues={2}
        />
        <ComplianceCard
          title="Critical Finding Policy"
          status="warning"
          lastAudit="2025-01-30"
          issues={5}
        />
      </div>

      {/* Peer Review Statistics */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Peer Review Statistics</h3>
        <div className="grid grid-cols-4 gap-4">
          <MetricBox label="Cases Reviewed" value="156" />
          <MetricBox label="Discrepancy Rate" value="3.2%" />
          <MetricBox label="Major Discrepancies" value="2" />
          <MetricBox label="Review Completion" value="98%" />
        </div>
      </div>

      {/* Image Quality Metrics */}
      <div className="bg-background rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Image Quality Metrics</h3>
        <div className="grid grid-cols-4 gap-4">
          <MetricBox label="Average IQ Score" value="87/100" />
          <MetricBox label="Repeat Rate" value="2.1%" />
          <MetricBox label="Artifact Rate" value="1.5%" />
          <MetricBox label="Positioning Issues" value="0.8%" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  target?: string;
  subtitle?: string;
  icon: string;
  status?: 'good' | 'warning' | 'alert';
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  trend,
  target,
  subtitle,
  icon,
  status = 'good',
}) => {
  const statusColors = {
    good: 'border-green-500',
    warning: 'border-yellow-500',
    alert: 'border-red-500',
  };

  return (
    <div className={`bg-background rounded-lg border-l-4 ${statusColors[status]} p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend !== undefined && (
          <span className={`text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{title}</div>
      {(target || subtitle) && (
        <div className="text-xs text-muted-foreground mt-1">{target || subtitle}</div>
      )}
    </div>
  );
};

interface WorklistStatusWidgetProps {
  status: DashboardMetrics['worklistStatus'];
}

const WorklistStatusWidget: React.FC<WorklistStatusWidgetProps> = ({ status }) => {
  const total = status.pending + status.inProgress + status.completed + status.onHold;

  return (
    <div className="bg-background rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Worklist Status</h3>
      <div className="space-y-3">
        <StatusBar label="Pending" value={status.pending} total={total} color="bg-yellow-500" />
        <StatusBar label="In Progress" value={status.inProgress} total={total} color="bg-blue-500" />
        <StatusBar label="Completed" value={status.completed} total={total} color="bg-green-500" />
        <StatusBar label="On Hold" value={status.onHold} total={total} color="bg-gray-500" />
      </div>
    </div>
  );
};

interface StatusBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ label, value, total, color }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const ModalityDistributionWidget: React.FC = () => {
  return (
    <div className="bg-background rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Modality Distribution</h3>
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        [Chart: Pie chart of studies by modality]
      </div>
    </div>
  );
};

const RecentCriticalFindingsWidget: React.FC = () => {
  return (
    <div className="bg-background rounded-lg border p-4">
      <h3 className="font-semibold mb-4">Recent Critical Findings</h3>
      <div className="space-y-2">
        <CriticalFindingRow
          finding="Stroke - Large vessel occlusion"
          patient="John Doe"
          time="10 min ago"
          status="pending"
        />
        <CriticalFindingRow
          finding="Pulmonary embolism"
          patient="Jane Smith"
          time="25 min ago"
          status="acknowledged"
        />
      </div>
    </div>
  );
};

interface CriticalFindingRowProps {
  finding: string;
  patient: string;
  time: string;
  status: 'pending' | 'acknowledged';
}

const CriticalFindingRow: React.FC<CriticalFindingRowProps> = ({
  finding,
  patient,
  time,
  status,
}) => {
  return (
    <div className={`p-3 rounded-lg ${status === 'pending' ? 'bg-red-50' : 'bg-green-50'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{finding}</div>
          <div className="text-sm text-muted-foreground">
            {patient} • {time}
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs ${
            status === 'pending' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {status === 'pending' ? 'Pending' : 'Acknowledged'}
        </span>
      </div>
    </div>
  );
};

interface ComplianceCardProps {
  title: string;
  status: 'compliant' | 'warning' | 'non-compliant';
  lastAudit: string;
  issues: number;
}

const ComplianceCard: React.FC<ComplianceCardProps> = ({
  title,
  status,
  lastAudit,
  issues,
}) => {
  const statusConfig = {
    compliant: { color: 'bg-green-500', label: 'Compliant' },
    warning: { color: 'bg-yellow-500', label: 'Attention Needed' },
    'non-compliant': { color: 'bg-red-500', label: 'Non-Compliant' },
  };

  return (
    <div className="bg-background rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">{title}</h4>
        <span className={`w-3 h-3 rounded-full ${statusConfig[status].color}`} />
      </div>
      <div className="text-sm text-muted-foreground mb-2">
        Last Audit: {lastAudit}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">{statusConfig[status].label}</span>
        {issues > 0 && (
          <span className="text-sm text-orange-600">{issues} issues</span>
        )}
      </div>
    </div>
  );
};

interface MetricBoxProps {
  label: string;
  value: string | number;
}

const MetricBox: React.FC<MetricBoxProps> = ({ label, value }) => {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
};

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-background animate-pulse">
      <div className="h-16 border-b bg-muted" />
      <div className="flex-1 p-4 grid grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loadDashboardMetrics(
  servicesManager: AppTypes.ServicesManager
): Promise<DashboardMetrics> {
  // In production, this would fetch from services
  return {
    studyVolume: {
      today: 156,
      thisWeek: 892,
      thisMonth: 3456,
      trend: 12.5,
    },
    turnaroundTime: {
      average: 45,
      median: 38,
      p95: 120,
      target: 60,
    },
    aiMetrics: {
      totalAnalyses: 15234,
      accuracy: 0.94,
      sensitivityAvg: 0.92,
      falsePositiveRate: 0.08,
    },
    criticalFindings: {
      pending: 3,
      acknowledged: 47,
      averageAckTime: 12,
    },
    worklistStatus: {
      pending: 45,
      inProgress: 12,
      completed: 99,
      onHold: 5,
    },
  };
}

export default AIRadiologyDashboard;
