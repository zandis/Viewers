import { PubSubService } from '@ohif/core';
import {
  ReportWorkflowState,
  ReportStatus,
  GeneratedReport,
  ReportHistoryEntry,
  AI_EVENTS,
  StudyInfo,
} from '../types';

/**
 * Report Workflow Service
 * Manages the lifecycle of radiology reports from AI generation to final submission
 */
export default class ReportWorkflowService extends PubSubService {
  public static REGISTRATION = {
    name: 'reportWorkflowService',
    altName: 'ReportWorkflowService',
    create: (): ReportWorkflowService => {
      return new ReportWorkflowService();
    },
  };

  /** Active reports indexed by studyInstanceUID */
  private reports: Map<string, ReportWorkflowState> = new Map();

  /** Report storage backend (can be configured) */
  private storageBackend: ReportStorageBackend | null = null;

  constructor() {
    super({
      [AI_EVENTS.REPORT_STATUS_CHANGED]: AI_EVENTS.REPORT_STATUS_CHANGED,
      [AI_EVENTS.REPORT_SAVED]: AI_EVENTS.REPORT_SAVED,
      [AI_EVENTS.REPORT_APPROVED]: AI_EVENTS.REPORT_APPROVED,
      [AI_EVENTS.REPORT_SUBMITTED]: AI_EVENTS.REPORT_SUBMITTED,
    });
  }

  /**
   * Configure storage backend for report persistence
   */
  public setStorageBackend(backend: ReportStorageBackend): void {
    this.storageBackend = backend;
  }

  /**
   * Create a new report workflow for a study
   */
  public createReport(studyInstanceUID: string, studyInfo?: StudyInfo): ReportWorkflowState {
    const reportId = this.generateReportId();
    const now = new Date().toISOString();

    const state: ReportWorkflowState = {
      reportId,
      status: 'pending',
      studyInstanceUID,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          timestamp: now,
          action: 'Report workflow created',
          newStatus: 'pending',
        },
      ],
    };

    this.reports.set(studyInstanceUID, state);
    return state;
  }

  /**
   * Get report state for a study
   */
  public getReport(studyInstanceUID: string): ReportWorkflowState | undefined {
    return this.reports.get(studyInstanceUID);
  }

  /**
   * Get all active reports
   */
  public getAllReports(): ReportWorkflowState[] {
    return Array.from(this.reports.values());
  }

  /**
   * Update report status
   */
  public updateStatus(
    studyInstanceUID: string,
    newStatus: ReportStatus,
    user?: string,
    details?: string
  ): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const previousStatus = report.status;
    const now = new Date().toISOString();

    report.status = newStatus;
    report.updatedAt = now;
    report.history.push({
      timestamp: now,
      action: `Status changed to ${newStatus}`,
      user,
      details,
      previousStatus,
      newStatus,
    });

    this._broadcastEvent(AI_EVENTS.REPORT_STATUS_CHANGED, {
      reportId: report.reportId,
      studyInstanceUID,
      previousStatus,
      newStatus,
      user,
    });

    return report;
  }

  /**
   * Set AI-generated report
   */
  public setAIReport(studyInstanceUID: string, aiReport: GeneratedReport): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const now = new Date().toISOString();

    report.aiReport = aiReport;
    report.editedReport = JSON.parse(JSON.stringify(aiReport)); // Deep clone for editing
    report.status = 'ai_generated';
    report.updatedAt = now;
    report.history.push({
      timestamp: now,
      action: 'AI report generated',
      newStatus: 'ai_generated',
    });

    this._broadcastEvent(AI_EVENTS.REPORT_STATUS_CHANGED, {
      reportId: report.reportId,
      studyInstanceUID,
      previousStatus: 'ai_generating',
      newStatus: 'ai_generated',
    });

    return report;
  }

  /**
   * Update edited report content
   */
  public updateEditedReport(
    studyInstanceUID: string,
    editedReport: GeneratedReport,
    user?: string
  ): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const now = new Date().toISOString();

    report.editedReport = editedReport;
    report.status = 'in_review';
    report.updatedAt = now;
    report.history.push({
      timestamp: now,
      action: 'Report edited',
      user,
      newStatus: 'in_review',
    });

    this._broadcastEvent(AI_EVENTS.REPORT_SAVED, {
      reportId: report.reportId,
      studyInstanceUID,
      user,
    });

    // Persist to storage if configured
    this.persistReport(report);

    return report;
  }

  /**
   * Approve report for finalization
   */
  public approveReport(
    studyInstanceUID: string,
    approvedBy: string,
    finalReport?: GeneratedReport
  ): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const now = new Date().toISOString();

    report.finalReport = finalReport || report.editedReport;
    report.approvedBy = approvedBy;
    report.approvedAt = now;
    report.status = 'approved';
    report.updatedAt = now;
    report.history.push({
      timestamp: now,
      action: 'Report approved',
      user: approvedBy,
      newStatus: 'approved',
    });

    this._broadcastEvent(AI_EVENTS.REPORT_APPROVED, {
      reportId: report.reportId,
      studyInstanceUID,
      approvedBy,
    });

    // Persist to storage
    this.persistReport(report);

    return report;
  }

  /**
   * Mark report as submitted to external system
   */
  public markSubmitted(
    studyInstanceUID: string,
    submittedTo: string,
    submissionDetails?: Record<string, unknown>
  ): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const now = new Date().toISOString();

    report.submittedTo = submittedTo;
    report.submittedAt = now;
    report.status = 'submitted';
    report.updatedAt = now;
    report.history.push({
      timestamp: now,
      action: `Report submitted to ${submittedTo}`,
      newStatus: 'submitted',
      details: submissionDetails ? JSON.stringify(submissionDetails) : undefined,
    });

    this._broadcastEvent(AI_EVENTS.REPORT_SUBMITTED, {
      reportId: report.reportId,
      studyInstanceUID,
      submittedTo,
      submissionDetails,
    });

    // Persist to storage
    this.persistReport(report);

    return report;
  }

  /**
   * Get report history
   */
  public getHistory(studyInstanceUID: string): ReportHistoryEntry[] {
    const report = this.reports.get(studyInstanceUID);
    return report?.history || [];
  }

  /**
   * Amend a finalized report
   */
  public amendReport(
    studyInstanceUID: string,
    amendedReport: GeneratedReport,
    amendedBy: string,
    reason: string
  ): ReportWorkflowState | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report) return undefined;

    const now = new Date().toISOString();

    // Store previous final report in history
    report.history.push({
      timestamp: now,
      action: 'Report amended',
      user: amendedBy,
      details: `Reason: ${reason}. Previous report archived.`,
      previousStatus: report.status,
      newStatus: 'amended',
    });

    report.editedReport = amendedReport;
    report.finalReport = undefined;
    report.approvedBy = undefined;
    report.approvedAt = undefined;
    report.status = 'amended';
    report.updatedAt = now;

    // Persist to storage
    this.persistReport(report);

    return report;
  }

  /**
   * Load report from storage
   */
  public async loadReport(studyInstanceUID: string): Promise<ReportWorkflowState | undefined> {
    if (!this.storageBackend) return undefined;

    try {
      const report = await this.storageBackend.load(studyInstanceUID);
      if (report) {
        this.reports.set(studyInstanceUID, report);
      }
      return report;
    } catch (error) {
      console.error('Failed to load report:', error);
      return undefined;
    }
  }

  /**
   * Persist report to storage backend
   */
  private async persistReport(report: ReportWorkflowState): Promise<void> {
    if (!this.storageBackend) return;

    try {
      await this.storageBackend.save(report);
    } catch (error) {
      console.error('Failed to persist report:', error);
    }
  }

  /**
   * Delete report
   */
  public deleteReport(studyInstanceUID: string): boolean {
    const deleted = this.reports.delete(studyInstanceUID);
    if (deleted && this.storageBackend) {
      this.storageBackend.delete(studyInstanceUID).catch(console.error);
    }
    return deleted;
  }

  /**
   * Clear all reports
   */
  public clearAll(): void {
    this.reports.clear();
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export report in various formats
   */
  public exportReport(
    studyInstanceUID: string,
    format: 'json' | 'text' | 'html'
  ): string | undefined {
    const report = this.reports.get(studyInstanceUID);
    if (!report || !report.finalReport) return undefined;

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'text':
        return this.formatAsText(report.finalReport);

      case 'html':
        return this.formatAsHTML(report);

      default:
        return undefined;
    }
  }

  /**
   * Format report as plain text
   */
  private formatAsText(report: GeneratedReport): string {
    let text = '';

    report.sections.forEach(section => {
      text += `${section.title.toUpperCase()}\n`;
      text += `${'='.repeat(section.title.length)}\n`;
      text += `${section.content}\n\n`;
    });

    return text;
  }

  /**
   * Format report as HTML
   */
  private formatAsHTML(state: ReportWorkflowState): string {
    const report = state.finalReport || state.editedReport;
    if (!report) return '';

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Radiology Report - ${state.studyInstanceUID}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #333; }
    h2 { color: #666; margin-top: 20px; }
    .section { margin-bottom: 20px; }
    .metadata { color: #888; font-size: 0.9em; }
    .impression { background: #f5f5f5; padding: 15px; border-left: 4px solid #333; }
    .finding { padding: 8px; margin: 5px 0; background: #fafafa; }
    .finding.critical { background: #ffe0e0; border-left: 4px solid #d00; }
  </style>
</head>
<body>
  <h1>RADIOLOGY REPORT</h1>
  <div class="metadata">
    <p>Study: ${state.studyInstanceUID}</p>
    <p>Report ID: ${state.reportId}</p>
    <p>Generated: ${state.createdAt}</p>
    ${state.approvedBy ? `<p>Approved by: ${state.approvedBy} on ${state.approvedAt}</p>` : ''}
  </div>
`;

    report.sections.forEach(section => {
      html += `
  <div class="section">
    <h2>${section.title}</h2>
    <p>${section.content.replace(/\n/g, '<br>')}</p>
  </div>
`;
    });

    if (report.findings.length > 0) {
      html += `
  <div class="section">
    <h2>Structured Findings</h2>
`;
      report.findings.forEach(finding => {
        const criticalClass = finding.severity === 'critical' ? ' critical' : '';
        html += `
    <div class="finding${criticalClass}">
      <strong>${finding.severity?.toUpperCase() || 'FINDING'}:</strong> ${finding.description}
      ${finding.location ? `<br><em>Location: ${finding.location.region}</em>` : ''}
    </div>
`;
      });
      html += `  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }
}

/**
 * Interface for report storage backends
 */
export interface ReportStorageBackend {
  save(report: ReportWorkflowState): Promise<void>;
  load(studyInstanceUID: string): Promise<ReportWorkflowState | undefined>;
  delete(studyInstanceUID: string): Promise<void>;
  list(): Promise<ReportWorkflowState[]>;
}

/**
 * Local storage backend implementation
 */
export class LocalStorageBackend implements ReportStorageBackend {
  private readonly prefix = 'ohif-ai-report-';

  async save(report: ReportWorkflowState): Promise<void> {
    const key = this.prefix + report.studyInstanceUID;
    localStorage.setItem(key, JSON.stringify(report));
  }

  async load(studyInstanceUID: string): Promise<ReportWorkflowState | undefined> {
    const key = this.prefix + studyInstanceUID;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : undefined;
  }

  async delete(studyInstanceUID: string): Promise<void> {
    const key = this.prefix + studyInstanceUID;
    localStorage.removeItem(key);
  }

  async list(): Promise<ReportWorkflowState[]> {
    const reports: ReportWorkflowState[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          reports.push(JSON.parse(data));
        }
      }
    }
    return reports;
  }
}
