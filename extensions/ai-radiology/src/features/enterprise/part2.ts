/**
 * Enterprise Features Module - Part 2 (Features 6-10)
 * Best Practices: TypeScript strict mode, comprehensive error handling, performance optimization
 *
 * Features:
 * 6. Automated QA Workflow Engine
 * 7. Smart Scheduling System
 * 8. 3D Print Preparation Service
 * 9. Patient Portal Integration
 * 10. Research Data Export Pipeline
 */

import { SecurityAuditLogger, escapeHtml, validateInput } from '../core/security';

// ============================================================================
// FEATURE 6: AUTOMATED QA WORKFLOW ENGINE
// ============================================================================

export interface QAWorkflow {
  id: string;
  name: string;
  description: string;
  triggers: QATrigger[];
  steps: QAStep[];
  escalationRules: EscalationRule[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  statistics: QAStatistics;
}

export interface QATrigger {
  id: string;
  type: 'study-received' | 'report-created' | 'ai-complete' | 'scheduled' | 'manual';
  conditions: QACondition[];
}

export interface QACondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'in' | 'regex';
  value: unknown;
}

export interface QAStep {
  id: string;
  name: string;
  type: 'automated-check' | 'manual-review' | 'ai-analysis' | 'notification' | 'action';
  order: number;
  config: QAStepConfig;
  timeout?: number;
  retryCount?: number;
  onPass: string | null; // Next step ID or null for complete
  onFail: string | null; // Next step ID or escalation
}

export interface QAStepConfig {
  checkType?: string;
  parameters?: Record<string, unknown>;
  assignTo?: string | 'auto' | 'pool';
  notificationTemplate?: string;
  actionType?: string;
}

export interface EscalationRule {
  id: string;
  condition: 'timeout' | 'failure' | 'threshold';
  threshold?: number;
  escalateTo: string;
  notificationTemplate: string;
}

export interface QAStatistics {
  totalExecutions: number;
  passRate: number;
  averageCompletionTime: number;
  failuresByStep: Record<string, number>;
  escalationCount: number;
}

export interface QAExecution {
  id: string;
  workflowId: string;
  studyInstanceUID: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'escalated';
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  results: QAStepResult[];
  assignedTo?: string;
}

export interface QAStepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  startedAt: Date;
  completedAt?: Date;
  details: Record<string, unknown>;
  reviewer?: string;
  comments?: string;
}

export class QAWorkflowEngine {
  private static instance: QAWorkflowEngine;
  private workflows = new Map<string, QAWorkflow>();
  private executions = new Map<string, QAExecution>();
  private auditLogger = SecurityAuditLogger.getInstance();
  private eventListeners = new Map<string, Set<(execution: QAExecution) => void>>();

  private constructor() {
    this.initializeDefaultWorkflows();
  }

  static getInstance(): QAWorkflowEngine {
    if (!QAWorkflowEngine.instance) {
      QAWorkflowEngine.instance = new QAWorkflowEngine();
    }
    return QAWorkflowEngine.instance;
  }

  private initializeDefaultWorkflows(): void {
    // Image Quality QA Workflow
    const imageQualityWorkflow: QAWorkflow = {
      id: 'image-quality-qa',
      name: 'Image Quality Assessment',
      description: 'Automated image quality checks for all incoming studies',
      triggers: [
        {
          id: 'trigger-1',
          type: 'study-received',
          conditions: [],
        },
      ],
      steps: [
        {
          id: 'step-1',
          name: 'Technical Quality Check',
          type: 'automated-check',
          order: 1,
          config: {
            checkType: 'image-quality',
            parameters: {
              minResolution: 512,
              maxNoise: 0.3,
              contrastThreshold: 0.5,
              checkArtifacts: true,
            },
          },
          timeout: 60000,
          onPass: 'step-2',
          onFail: 'step-3',
        },
        {
          id: 'step-2',
          name: 'Protocol Compliance',
          type: 'automated-check',
          order: 2,
          config: {
            checkType: 'protocol-compliance',
            parameters: {
              checkSliceThickness: true,
              checkCoverage: true,
              checkContrast: true,
            },
          },
          onPass: null,
          onFail: 'step-3',
        },
        {
          id: 'step-3',
          name: 'Manual Review',
          type: 'manual-review',
          order: 3,
          config: {
            assignTo: 'pool',
          },
          timeout: 3600000,
          onPass: null,
          onFail: 'escalate',
        },
      ],
      escalationRules: [
        {
          id: 'esc-1',
          condition: 'timeout',
          escalateTo: 'qa-supervisor',
          notificationTemplate: 'qa-timeout-notification',
        },
        {
          id: 'esc-2',
          condition: 'failure',
          escalateTo: 'qa-supervisor',
          notificationTemplate: 'qa-failure-notification',
        },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        totalExecutions: 0,
        passRate: 0,
        averageCompletionTime: 0,
        failuresByStep: {},
        escalationCount: 0,
      },
    };

    this.workflows.set(imageQualityWorkflow.id, imageQualityWorkflow);

    // Report QA Workflow
    const reportQAWorkflow: QAWorkflow = {
      id: 'report-qa',
      name: 'Report Quality Assurance',
      description: 'Quality checks for radiology reports',
      triggers: [
        {
          id: 'trigger-1',
          type: 'report-created',
          conditions: [
            { field: 'status', operator: 'equals', value: 'preliminary' },
          ],
        },
      ],
      steps: [
        {
          id: 'step-1',
          name: 'Completeness Check',
          type: 'automated-check',
          order: 1,
          config: {
            checkType: 'report-completeness',
            parameters: {
              requiredSections: ['findings', 'impression'],
              minImpressionLength: 20,
            },
          },
          onPass: 'step-2',
          onFail: 'step-notify',
        },
        {
          id: 'step-2',
          name: 'AI Consistency Check',
          type: 'ai-analysis',
          order: 2,
          config: {
            checkType: 'ai-consistency',
            parameters: {
              compareToAIFindings: true,
              discrepancyThreshold: 0.3,
            },
          },
          onPass: null,
          onFail: 'step-3',
        },
        {
          id: 'step-3',
          name: 'Peer Review',
          type: 'manual-review',
          order: 3,
          config: {
            assignTo: 'auto', // Auto-assign based on expertise
          },
          onPass: null,
          onFail: 'escalate',
        },
        {
          id: 'step-notify',
          name: 'Notify Reporter',
          type: 'notification',
          order: 10,
          config: {
            notificationTemplate: 'report-incomplete-notification',
          },
          onPass: null,
          onFail: null,
        },
      ],
      escalationRules: [],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      statistics: {
        totalExecutions: 0,
        passRate: 0,
        averageCompletionTime: 0,
        failuresByStep: {},
        escalationCount: 0,
      },
    };

    this.workflows.set(reportQAWorkflow.id, reportQAWorkflow);
  }

  /**
   * Start workflow execution
   */
  async startExecution(workflowId: string, studyInstanceUID: string): Promise<QAExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (!workflow.enabled) throw new Error('Workflow is disabled');

    const execution: QAExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      studyInstanceUID,
      status: 'running',
      currentStep: workflow.steps[0]?.id || '',
      startedAt: new Date(),
      results: [],
    };

    this.executions.set(execution.id, execution);

    this.auditLogger.log({
      eventType: 'qa_workflow',
      action: 'execution_started',
      resource: studyInstanceUID,
      outcome: 'success',
      details: { workflowId, executionId: execution.id },
    });

    // Start processing first step
    this.processStep(execution, workflow.steps[0]);

    return execution;
  }

  /**
   * Process a workflow step
   */
  private async processStep(execution: QAExecution, step: QAStep): Promise<void> {
    const stepResult: QAStepResult = {
      stepId: step.id,
      status: 'pending',
      startedAt: new Date(),
      details: {},
    };

    execution.results.push(stepResult);
    execution.currentStep = step.id;
    this.notifyListeners(execution);

    try {
      let passed = false;

      switch (step.type) {
        case 'automated-check':
          passed = await this.runAutomatedCheck(step, execution, stepResult);
          break;
        case 'ai-analysis':
          passed = await this.runAIAnalysis(step, execution, stepResult);
          break;
        case 'manual-review':
          // Manual review - wait for human input
          stepResult.status = 'pending';
          this.assignForReview(execution, step);
          return; // Exit and wait for manual completion
        case 'notification':
          passed = await this.sendNotification(step, execution, stepResult);
          break;
        case 'action':
          passed = await this.executeAction(step, execution, stepResult);
          break;
      }

      stepResult.completedAt = new Date();
      stepResult.status = passed ? 'passed' : 'failed';

      // Determine next step
      const nextStepId = passed ? step.onPass : step.onFail;
      await this.advanceExecution(execution, nextStepId);

    } catch (error) {
      stepResult.status = 'failed';
      stepResult.details.error = (error as Error).message;
      await this.handleStepFailure(execution, step);
    }
  }

  private async runAutomatedCheck(
    step: QAStep,
    execution: QAExecution,
    result: QAStepResult
  ): Promise<boolean> {
    const checkType = step.config.checkType;
    const params = step.config.parameters || {};

    switch (checkType) {
      case 'image-quality':
        // Simulate image quality check
        const qualityScore = Math.random() * 0.5 + 0.5; // 0.5-1.0
        result.details = {
          qualityScore,
          resolution: 'passed',
          noise: qualityScore > 0.7 ? 'passed' : 'failed',
          artifacts: 'none detected',
        };
        return qualityScore > (params.contrastThreshold as number || 0.5);

      case 'protocol-compliance':
        // Simulate protocol compliance check
        result.details = {
          sliceThickness: 'compliant',
          coverage: 'compliant',
          contrast: params.checkContrast ? 'compliant' : 'n/a',
        };
        return true;

      case 'report-completeness':
        // Simulate report completeness check
        const requiredSections = params.requiredSections as string[] || [];
        result.details = {
          sectionsPresent: requiredSections,
          impressionLength: 150,
        };
        return true;

      default:
        result.details.warning = 'Unknown check type';
        return true;
    }
  }

  private async runAIAnalysis(
    step: QAStep,
    execution: QAExecution,
    result: QAStepResult
  ): Promise<boolean> {
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 500));

    const discrepancyScore = Math.random() * 0.5; // 0-0.5
    const threshold = (step.config.parameters?.discrepancyThreshold as number) || 0.3;

    result.details = {
      aiConsistencyScore: 1 - discrepancyScore,
      discrepancies: discrepancyScore > 0.2 ? ['Minor finding difference'] : [],
    };

    return discrepancyScore <= threshold;
  }

  private async sendNotification(
    step: QAStep,
    execution: QAExecution,
    result: QAStepResult
  ): Promise<boolean> {
    // Simulate notification
    result.details = {
      template: step.config.notificationTemplate,
      sentAt: new Date(),
    };
    return true;
  }

  private async executeAction(
    step: QAStep,
    execution: QAExecution,
    result: QAStepResult
  ): Promise<boolean> {
    // Execute configured action
    result.details = {
      actionType: step.config.actionType,
      executedAt: new Date(),
    };
    return true;
  }

  private assignForReview(execution: QAExecution, step: QAStep): void {
    const assignTo = step.config.assignTo;

    if (assignTo === 'auto') {
      // Auto-assign based on workload/expertise
      execution.assignedTo = 'reviewer-auto';
    } else if (assignTo === 'pool') {
      execution.assignedTo = 'review-pool';
    } else {
      execution.assignedTo = assignTo;
    }

    this.notifyListeners(execution);
  }

  private async advanceExecution(execution: QAExecution, nextStepId: string | null): Promise<void> {
    if (!nextStepId) {
      // Workflow complete
      const allPassed = execution.results.every(r => r.status === 'passed' || r.status === 'skipped');
      execution.status = allPassed ? 'passed' : 'failed';
      execution.completedAt = new Date();

      // Update statistics
      const workflow = this.workflows.get(execution.workflowId);
      if (workflow) {
        workflow.statistics.totalExecutions++;
        const passedCount = workflow.statistics.totalExecutions * workflow.statistics.passRate;
        workflow.statistics.passRate = (passedCount + (allPassed ? 1 : 0)) / workflow.statistics.totalExecutions;
      }

      this.auditLogger.log({
        eventType: 'qa_workflow',
        action: 'execution_completed',
        resource: execution.studyInstanceUID,
        outcome: allPassed ? 'success' : 'failure',
        details: { executionId: execution.id, status: execution.status },
      });

    } else if (nextStepId === 'escalate') {
      await this.escalate(execution);
    } else {
      // Move to next step
      const workflow = this.workflows.get(execution.workflowId);
      const nextStep = workflow?.steps.find(s => s.id === nextStepId);
      if (nextStep) {
        await this.processStep(execution, nextStep);
      }
    }

    this.notifyListeners(execution);
  }

  private async handleStepFailure(execution: QAExecution, step: QAStep): Promise<void> {
    if (step.onFail === 'escalate') {
      await this.escalate(execution);
    } else if (step.onFail) {
      await this.advanceExecution(execution, step.onFail);
    } else {
      execution.status = 'failed';
      execution.completedAt = new Date();
    }
  }

  private async escalate(execution: QAExecution): Promise<void> {
    execution.status = 'escalated';

    const workflow = this.workflows.get(execution.workflowId);
    if (workflow) {
      workflow.statistics.escalationCount++;
    }

    this.auditLogger.log({
      eventType: 'qa_workflow',
      action: 'execution_escalated',
      resource: execution.studyInstanceUID,
      outcome: 'failure',
      details: { executionId: execution.id },
    });
  }

  /**
   * Complete manual review step
   */
  completeManualReview(
    executionId: string,
    passed: boolean,
    reviewer: string,
    comments?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) throw new Error('Execution not found');

    const currentResult = execution.results.find(r => r.stepId === execution.currentStep);
    if (currentResult) {
      currentResult.status = passed ? 'passed' : 'failed';
      currentResult.completedAt = new Date();
      currentResult.reviewer = reviewer;
      currentResult.comments = comments;
    }

    const workflow = this.workflows.get(execution.workflowId);
    const currentStep = workflow?.steps.find(s => s.id === execution.currentStep);

    if (currentStep) {
      const nextStepId = passed ? currentStep.onPass : currentStep.onFail;
      this.advanceExecution(execution, nextStepId);
    }
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): QAWorkflow | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): QAWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): QAExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get executions for study
   */
  getExecutionsForStudy(studyInstanceUID: string): QAExecution[] {
    return Array.from(this.executions.values())
      .filter(e => e.studyInstanceUID === studyInstanceUID);
  }

  /**
   * Get pending reviews for user
   */
  getPendingReviews(userId: string): QAExecution[] {
    return Array.from(this.executions.values())
      .filter(e =>
        e.status === 'running' &&
        (e.assignedTo === userId || e.assignedTo === 'review-pool')
      );
  }

  /**
   * Subscribe to execution updates
   */
  subscribe(executionId: string, callback: (execution: QAExecution) => void): () => void {
    if (!this.eventListeners.has(executionId)) {
      this.eventListeners.set(executionId, new Set());
    }
    this.eventListeners.get(executionId)!.add(callback);
    return () => this.eventListeners.get(executionId)?.delete(callback);
  }

  private notifyListeners(execution: QAExecution): void {
    const listeners = this.eventListeners.get(execution.id);
    listeners?.forEach(cb => cb(execution));
  }
}

// ============================================================================
// FEATURE 7: SMART SCHEDULING SYSTEM
// ============================================================================

export interface ScheduledExam {
  id: string;
  patientId: string;
  patientName: string;
  examType: string;
  modality: string;
  scheduledTime: Date;
  duration: number; // minutes
  room: string;
  equipment: string;
  priority: 'stat' | 'urgent' | 'routine';
  status: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  preparationInstructions: string[];
  specialRequirements: string[];
  orderingPhysician: string;
  diagnosis: string;
  estimatedWaitTime?: number;
  actualStartTime?: Date;
  actualEndTime?: Date;
}

export interface SchedulingResource {
  id: string;
  type: 'room' | 'equipment' | 'staff';
  name: string;
  capabilities: string[];
  availability: AvailabilitySlot[];
  maintenanceSchedule: MaintenanceWindow[];
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  resourceId: string;
}

export interface MaintenanceWindow {
  id: string;
  resourceId: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

export interface SchedulingConstraint {
  id: string;
  type: 'time' | 'resource' | 'patient' | 'staff';
  rule: string;
  priority: number;
}

export interface OptimizationResult {
  schedule: ScheduledExam[];
  metrics: {
    utilizationRate: number;
    averageWaitTime: number;
    throughput: number;
    conflictsResolved: number;
  };
  suggestions: SchedulingSuggestion[];
}

export interface SchedulingSuggestion {
  type: 'reschedule' | 'add-resource' | 'extend-hours' | 'batch';
  description: string;
  impact: string;
  examIds?: string[];
}

export class SmartSchedulingSystem {
  private static instance: SmartSchedulingSystem;
  private exams = new Map<string, ScheduledExam>();
  private resources = new Map<string, SchedulingResource>();
  private constraints: SchedulingConstraint[] = [];
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor() {
    this.initializeResources();
  }

  static getInstance(): SmartSchedulingSystem {
    if (!SmartSchedulingSystem.instance) {
      SmartSchedulingSystem.instance = new SmartSchedulingSystem();
    }
    return SmartSchedulingSystem.instance;
  }

  private initializeResources(): void {
    // CT Scanner
    this.resources.set('ct-1', {
      id: 'ct-1',
      type: 'equipment',
      name: 'CT Scanner 1',
      capabilities: ['CT', 'CTA', 'CT Perfusion'],
      availability: [
        { dayOfWeek: 1, startTime: '07:00', endTime: '19:00', resourceId: 'ct-1' },
        { dayOfWeek: 2, startTime: '07:00', endTime: '19:00', resourceId: 'ct-1' },
        { dayOfWeek: 3, startTime: '07:00', endTime: '19:00', resourceId: 'ct-1' },
        { dayOfWeek: 4, startTime: '07:00', endTime: '19:00', resourceId: 'ct-1' },
        { dayOfWeek: 5, startTime: '07:00', endTime: '19:00', resourceId: 'ct-1' },
      ],
      maintenanceSchedule: [],
    });

    // MRI Scanner
    this.resources.set('mri-1', {
      id: 'mri-1',
      type: 'equipment',
      name: 'MRI Scanner 1',
      capabilities: ['MRI', 'MRA', 'fMRI'],
      availability: [
        { dayOfWeek: 1, startTime: '07:00', endTime: '21:00', resourceId: 'mri-1' },
        { dayOfWeek: 2, startTime: '07:00', endTime: '21:00', resourceId: 'mri-1' },
        { dayOfWeek: 3, startTime: '07:00', endTime: '21:00', resourceId: 'mri-1' },
        { dayOfWeek: 4, startTime: '07:00', endTime: '21:00', resourceId: 'mri-1' },
        { dayOfWeek: 5, startTime: '07:00', endTime: '21:00', resourceId: 'mri-1' },
      ],
      maintenanceSchedule: [],
    });
  }

  /**
   * Schedule new exam
   */
  scheduleExam(exam: Omit<ScheduledExam, 'id' | 'status' | 'estimatedWaitTime'>): ScheduledExam {
    // Validate time slot availability
    const conflicts = this.checkConflicts(exam.scheduledTime, exam.duration, exam.equipment);
    if (conflicts.length > 0) {
      throw new Error(`Scheduling conflict: ${conflicts.join(', ')}`);
    }

    const newExam: ScheduledExam = {
      ...exam,
      id: `exam-${Date.now()}`,
      status: 'scheduled',
      estimatedWaitTime: this.calculateEstimatedWaitTime(exam.scheduledTime),
    };

    this.exams.set(newExam.id, newExam);

    this.auditLogger.log({
      eventType: 'scheduling',
      action: 'exam_scheduled',
      resource: newExam.id,
      outcome: 'success',
      details: { patientId: exam.patientId, examType: exam.examType },
    });

    return newExam;
  }

  /**
   * Find available slots
   */
  findAvailableSlots(
    examType: string,
    duration: number,
    dateRange: { start: Date; end: Date },
    preferredTime?: { start: string; end: string }
  ): Date[] {
    const slots: Date[] = [];
    const resource = this.findResourceForExamType(examType);
    if (!resource) return slots;

    const current = new Date(dateRange.start);
    while (current <= dateRange.end) {
      const dayOfWeek = current.getDay();
      const availability = resource.availability.find(a => a.dayOfWeek === dayOfWeek);

      if (availability) {
        const startHour = parseInt(availability.startTime.split(':')[0], 10);
        const endHour = parseInt(availability.endTime.split(':')[0], 10);

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 15) {
            const slotTime = new Date(current);
            slotTime.setHours(hour, minute, 0, 0);

            // Check if slot is available
            const conflicts = this.checkConflicts(slotTime, duration, resource.id);
            if (conflicts.length === 0) {
              // Check preferred time if specified
              if (preferredTime) {
                const slotTimeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                if (slotTimeStr >= preferredTime.start && slotTimeStr <= preferredTime.end) {
                  slots.push(new Date(slotTime));
                }
              } else {
                slots.push(new Date(slotTime));
              }
            }
          }
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots.slice(0, 20); // Return first 20 available slots
  }

  /**
   * Optimize schedule
   */
  optimizeSchedule(date: Date): OptimizationResult {
    const dayExams = this.getExamsForDate(date);
    const suggestions: SchedulingSuggestion[] = [];

    // Analyze gaps
    const gaps = this.findScheduleGaps(dayExams);
    if (gaps.length > 0) {
      suggestions.push({
        type: 'batch',
        description: `${gaps.length} scheduling gaps found. Consider batching similar exams.`,
        impact: `Could improve throughput by ${Math.round(gaps.length * 15)}%`,
      });
    }

    // Analyze resource utilization
    const utilization = this.calculateUtilization(dayExams);
    if (utilization < 0.7) {
      suggestions.push({
        type: 'add-resource',
        description: 'Resource utilization below 70%',
        impact: 'Consider adding more appointments or reducing staffing',
      });
    }

    // Calculate metrics
    const metrics = {
      utilizationRate: utilization,
      averageWaitTime: this.calculateAverageWaitTime(dayExams),
      throughput: dayExams.length,
      conflictsResolved: 0,
    };

    return {
      schedule: dayExams,
      metrics,
      suggestions,
    };
  }

  /**
   * Reschedule exam
   */
  rescheduleExam(examId: string, newTime: Date): ScheduledExam {
    const exam = this.exams.get(examId);
    if (!exam) throw new Error('Exam not found');

    const conflicts = this.checkConflicts(newTime, exam.duration, exam.equipment, examId);
    if (conflicts.length > 0) {
      throw new Error(`Scheduling conflict: ${conflicts.join(', ')}`);
    }

    exam.scheduledTime = newTime;
    exam.estimatedWaitTime = this.calculateEstimatedWaitTime(newTime);

    this.auditLogger.log({
      eventType: 'scheduling',
      action: 'exam_rescheduled',
      resource: examId,
      outcome: 'success',
    });

    return exam;
  }

  /**
   * Cancel exam
   */
  cancelExam(examId: string, reason: string): void {
    const exam = this.exams.get(examId);
    if (!exam) throw new Error('Exam not found');

    exam.status = 'cancelled';

    this.auditLogger.log({
      eventType: 'scheduling',
      action: 'exam_cancelled',
      resource: examId,
      outcome: 'success',
      details: { reason },
    });
  }

  /**
   * Check in patient
   */
  checkInPatient(examId: string): ScheduledExam {
    const exam = this.exams.get(examId);
    if (!exam) throw new Error('Exam not found');

    exam.status = 'checked-in';
    exam.estimatedWaitTime = this.calculateEstimatedWaitTime(new Date());

    return exam;
  }

  /**
   * Start exam
   */
  startExam(examId: string): ScheduledExam {
    const exam = this.exams.get(examId);
    if (!exam) throw new Error('Exam not found');

    exam.status = 'in-progress';
    exam.actualStartTime = new Date();

    return exam;
  }

  /**
   * Complete exam
   */
  completeExam(examId: string): ScheduledExam {
    const exam = this.exams.get(examId);
    if (!exam) throw new Error('Exam not found');

    exam.status = 'completed';
    exam.actualEndTime = new Date();

    return exam;
  }

  private checkConflicts(time: Date, duration: number, resourceId: string, excludeExamId?: string): string[] {
    const conflicts: string[] = [];
    const endTime = new Date(time.getTime() + duration * 60000);

    for (const exam of this.exams.values()) {
      if (exam.id === excludeExamId) continue;
      if (exam.status === 'cancelled') continue;
      if (exam.equipment !== resourceId) continue;

      const examEnd = new Date(exam.scheduledTime.getTime() + exam.duration * 60000);

      if (
        (time >= exam.scheduledTime && time < examEnd) ||
        (endTime > exam.scheduledTime && endTime <= examEnd) ||
        (time <= exam.scheduledTime && endTime >= examEnd)
      ) {
        conflicts.push(`Conflict with exam ${exam.id} at ${exam.scheduledTime.toISOString()}`);
      }
    }

    return conflicts;
  }

  private findResourceForExamType(examType: string): SchedulingResource | undefined {
    for (const resource of this.resources.values()) {
      if (resource.capabilities.some(c => examType.toUpperCase().includes(c))) {
        return resource;
      }
    }
    return undefined;
  }

  private getExamsForDate(date: Date): ScheduledExam[] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.exams.values())
      .filter(e => e.scheduledTime >= startOfDay && e.scheduledTime <= endOfDay)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  private findScheduleGaps(exams: ScheduledExam[]): Array<{ start: Date; end: Date }> {
    const gaps: Array<{ start: Date; end: Date }> = [];

    for (let i = 0; i < exams.length - 1; i++) {
      const currentEnd = new Date(exams[i].scheduledTime.getTime() + exams[i].duration * 60000);
      const nextStart = exams[i + 1].scheduledTime;

      const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / 60000;
      if (gapMinutes > 30) { // Gap > 30 minutes
        gaps.push({ start: currentEnd, end: nextStart });
      }
    }

    return gaps;
  }

  private calculateUtilization(exams: ScheduledExam[]): number {
    if (exams.length === 0) return 0;

    const totalScheduledMinutes = exams.reduce((sum, e) => sum + e.duration, 0);
    const workdayMinutes = 12 * 60; // 12 hour workday

    return Math.min(totalScheduledMinutes / workdayMinutes, 1);
  }

  private calculateAverageWaitTime(exams: ScheduledExam[]): number {
    const completedExams = exams.filter(e => e.actualStartTime && e.status === 'completed');
    if (completedExams.length === 0) return 0;

    const totalWait = completedExams.reduce((sum, e) => {
      const waitTime = (e.actualStartTime!.getTime() - e.scheduledTime.getTime()) / 60000;
      return sum + Math.max(0, waitTime);
    }, 0);

    return totalWait / completedExams.length;
  }

  private calculateEstimatedWaitTime(scheduledTime: Date): number {
    const now = new Date();
    const diff = (scheduledTime.getTime() - now.getTime()) / 60000;
    return Math.max(0, Math.round(diff));
  }

  /**
   * Get exam
   */
  getExam(examId: string): ScheduledExam | null {
    return this.exams.get(examId) || null;
  }

  /**
   * Get patient schedule
   */
  getPatientSchedule(patientId: string): ScheduledExam[] {
    return Array.from(this.exams.values())
      .filter(e => e.patientId === patientId && e.status !== 'cancelled')
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  /**
   * Get resource schedule
   */
  getResourceSchedule(resourceId: string, date: Date): ScheduledExam[] {
    return this.getExamsForDate(date).filter(e => e.equipment === resourceId);
  }
}

// ============================================================================
// FEATURE 8: 3D PRINT PREPARATION SERVICE
// ============================================================================

export interface Print3DModel {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  name: string;
  description: string;
  format: '3mf' | 'stl' | 'obj' | 'ply';
  status: 'processing' | 'ready' | 'printing' | 'completed' | 'failed';
  fileSize: number;
  meshStatistics: MeshStatistics;
  segmentation: SegmentationData;
  printSettings: PrintSettings;
  createdAt: Date;
  createdBy: string;
  downloadUrl?: string;
}

export interface MeshStatistics {
  vertices: number;
  faces: number;
  volume: number; // mm³
  surfaceArea: number; // mm²
  boundingBox: { x: number; y: number; z: number };
  isWatertight: boolean;
  manifoldErrors: number;
}

export interface SegmentationData {
  method: 'threshold' | 'region-growing' | 'ai-segmentation' | 'manual';
  parameters: Record<string, unknown>;
  structures: Array<{
    id: string;
    name: string;
    color: string;
    visible: boolean;
    volume: number;
  }>;
}

export interface PrintSettings {
  scale: number;
  hollowShell: boolean;
  shellThickness: number; // mm
  supportStructures: boolean;
  infillPercentage: number;
  layerHeight: number; // mm
  material: string;
  estimatedPrintTime: number; // minutes
  estimatedMaterialUsage: number; // grams
}

export class Print3DPreparationService {
  private static instance: Print3DPreparationService;
  private models = new Map<string, Print3DModel>();
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor() {}

  static getInstance(): Print3DPreparationService {
    if (!Print3DPreparationService.instance) {
      Print3DPreparationService.instance = new Print3DPreparationService();
    }
    return Print3DPreparationService.instance;
  }

  /**
   * Create 3D model from segmentation
   */
  async createModel(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    segmentation: SegmentationData,
    options: {
      name: string;
      description?: string;
      format?: Print3DModel['format'];
      createdBy: string;
    }
  ): Promise<Print3DModel> {
    const model: Print3DModel = {
      id: `model-${Date.now()}`,
      studyInstanceUID,
      seriesInstanceUID,
      name: options.name,
      description: options.description || '',
      format: options.format || 'stl',
      status: 'processing',
      fileSize: 0,
      meshStatistics: {
        vertices: 0,
        faces: 0,
        volume: 0,
        surfaceArea: 0,
        boundingBox: { x: 0, y: 0, z: 0 },
        isWatertight: false,
        manifoldErrors: 0,
      },
      segmentation,
      printSettings: {
        scale: 1.0,
        hollowShell: false,
        shellThickness: 2,
        supportStructures: true,
        infillPercentage: 20,
        layerHeight: 0.2,
        material: 'PLA',
        estimatedPrintTime: 0,
        estimatedMaterialUsage: 0,
      },
      createdAt: new Date(),
      createdBy: options.createdBy,
    };

    this.models.set(model.id, model);

    // Process model asynchronously
    this.processModel(model.id);

    return model;
  }

  private async processModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    try {
      // Simulate mesh generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mesh statistics
      model.meshStatistics = {
        vertices: Math.floor(Math.random() * 100000) + 50000,
        faces: Math.floor(Math.random() * 200000) + 100000,
        volume: Math.floor(Math.random() * 500000) + 100000,
        surfaceArea: Math.floor(Math.random() * 100000) + 50000,
        boundingBox: {
          x: Math.floor(Math.random() * 100) + 50,
          y: Math.floor(Math.random() * 100) + 50,
          z: Math.floor(Math.random() * 100) + 50,
        },
        isWatertight: Math.random() > 0.2,
        manifoldErrors: model.meshStatistics.isWatertight ? 0 : Math.floor(Math.random() * 10),
      };

      // Calculate print estimates
      const volumeCm3 = model.meshStatistics.volume / 1000;
      model.printSettings.estimatedMaterialUsage = volumeCm3 * 1.25 * (model.printSettings.infillPercentage / 100);
      model.printSettings.estimatedPrintTime = Math.floor(volumeCm3 * 10 / model.printSettings.layerHeight);

      model.fileSize = model.meshStatistics.faces * 50; // Approximate file size
      model.status = 'ready';
      model.downloadUrl = `/api/3d-models/${model.id}/download`;

      this.auditLogger.log({
        eventType: '3d_print',
        action: 'model_created',
        resource: modelId,
        outcome: 'success',
        details: { studyInstanceUID: model.studyInstanceUID },
      });

    } catch (error) {
      model.status = 'failed';

      this.auditLogger.log({
        eventType: '3d_print',
        action: 'model_creation_failed',
        resource: modelId,
        outcome: 'failure',
        details: { error: (error as Error).message },
      });
    }
  }

  /**
   * Repair mesh issues
   */
  async repairMesh(modelId: string): Promise<Print3DModel> {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    model.status = 'processing';

    // Simulate repair process
    await new Promise(resolve => setTimeout(resolve, 1500));

    model.meshStatistics.isWatertight = true;
    model.meshStatistics.manifoldErrors = 0;
    model.status = 'ready';

    return model;
  }

  /**
   * Update print settings
   */
  updatePrintSettings(modelId: string, settings: Partial<PrintSettings>): Print3DModel {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    model.printSettings = { ...model.printSettings, ...settings };

    // Recalculate estimates
    const volumeCm3 = model.meshStatistics.volume / 1000;
    model.printSettings.estimatedMaterialUsage = volumeCm3 * 1.25 * (model.printSettings.infillPercentage / 100);
    model.printSettings.estimatedPrintTime = Math.floor(volumeCm3 * 10 / model.printSettings.layerHeight);

    return model;
  }

  /**
   * Export model
   */
  async exportModel(modelId: string, format: Print3DModel['format']): Promise<Blob> {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    // In real implementation, convert mesh to requested format
    // For now, return a placeholder blob
    return new Blob(['model data'], { type: 'application/octet-stream' });
  }

  /**
   * Get model
   */
  getModel(modelId: string): Print3DModel | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get models for study
   */
  getModelsForStudy(studyInstanceUID: string): Print3DModel[] {
    return Array.from(this.models.values())
      .filter(m => m.studyInstanceUID === studyInstanceUID);
  }

  /**
   * Delete model
   */
  deleteModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }
}

// ============================================================================
// FEATURE 9: PATIENT PORTAL INTEGRATION
// ============================================================================

export interface PatientPortalConfig {
  portalUrl: string;
  apiEndpoint: string;
  authMethod: 'oauth2' | 'saml' | 'api-key';
  features: PatientPortalFeatures;
}

export interface PatientPortalFeatures {
  viewStudies: boolean;
  downloadImages: boolean;
  shareStudies: boolean;
  viewReports: boolean;
  messaging: boolean;
  scheduling: boolean;
  requestRecords: boolean;
}

export interface PatientAccess {
  patientId: string;
  email: string;
  phoneNumber?: string;
  accessLevel: 'full' | 'limited' | 'view-only';
  studies: string[]; // Study UIDs
  accessExpiration?: Date;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  preferences: PatientPreferences;
}

export interface PatientPreferences {
  language: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  defaultViewer: 'basic' | 'advanced';
  autoShare: boolean;
}

export interface StudyShareLink {
  id: string;
  studyInstanceUID: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  maxAccesses?: number;
  password?: string;
  recipientEmail?: string;
  allowDownload: boolean;
}

export interface PatientMessage {
  id: string;
  patientId: string;
  providerId: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  content: string;
  attachments: Array<{ name: string; url: string; type: string }>;
  read: boolean;
  createdAt: Date;
  relatedStudyUID?: string;
}

export class PatientPortalIntegration {
  private static instance: PatientPortalIntegration;
  private config: PatientPortalConfig;
  private patientAccess = new Map<string, PatientAccess>();
  private shareLinks = new Map<string, StudyShareLink>();
  private messages = new Map<string, PatientMessage>();
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor(config: PatientPortalConfig) {
    this.config = config;
  }

  static getInstance(config?: PatientPortalConfig): PatientPortalIntegration {
    if (!PatientPortalIntegration.instance && config) {
      PatientPortalIntegration.instance = new PatientPortalIntegration(config);
    }
    if (!PatientPortalIntegration.instance) {
      throw new Error('PatientPortalIntegration not initialized');
    }
    return PatientPortalIntegration.instance;
  }

  /**
   * Grant patient access
   */
  grantAccess(
    patientId: string,
    email: string,
    options: Partial<PatientAccess> = {}
  ): PatientAccess {
    const access: PatientAccess = {
      patientId,
      email,
      accessLevel: options.accessLevel || 'view-only',
      studies: options.studies || [],
      accessExpiration: options.accessExpiration,
      twoFactorEnabled: options.twoFactorEnabled || false,
      preferences: options.preferences || {
        language: 'en-US',
        notifications: { email: true, sms: false, push: false },
        defaultViewer: 'basic',
        autoShare: false,
      },
      phoneNumber: options.phoneNumber,
    };

    this.patientAccess.set(patientId, access);

    this.auditLogger.log({
      eventType: 'patient_portal',
      action: 'access_granted',
      resource: patientId,
      outcome: 'success',
      details: { accessLevel: access.accessLevel },
    });

    return access;
  }

  /**
   * Revoke patient access
   */
  revokeAccess(patientId: string): boolean {
    const result = this.patientAccess.delete(patientId);

    if (result) {
      this.auditLogger.log({
        eventType: 'patient_portal',
        action: 'access_revoked',
        resource: patientId,
        outcome: 'success',
      });
    }

    return result;
  }

  /**
   * Create shareable link
   */
  createShareLink(
    studyInstanceUID: string,
    createdBy: string,
    options: {
      expiresIn?: number; // hours
      maxAccesses?: number;
      password?: string;
      recipientEmail?: string;
      allowDownload?: boolean;
    } = {}
  ): StudyShareLink {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (options.expiresIn || 72));

    const link: StudyShareLink = {
      id: `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      studyInstanceUID,
      createdBy,
      createdAt: new Date(),
      expiresAt,
      accessCount: 0,
      maxAccesses: options.maxAccesses,
      password: options.password,
      recipientEmail: options.recipientEmail,
      allowDownload: options.allowDownload || false,
    };

    this.shareLinks.set(link.id, link);

    this.auditLogger.log({
      eventType: 'patient_portal',
      action: 'share_link_created',
      resource: studyInstanceUID,
      outcome: 'success',
      details: { linkId: link.id, expiresAt: link.expiresAt },
    });

    return link;
  }

  /**
   * Validate share link
   */
  validateShareLink(linkId: string, password?: string): { valid: boolean; reason?: string } {
    const link = this.shareLinks.get(linkId);

    if (!link) {
      return { valid: false, reason: 'Link not found' };
    }

    if (new Date() > link.expiresAt) {
      return { valid: false, reason: 'Link has expired' };
    }

    if (link.maxAccesses && link.accessCount >= link.maxAccesses) {
      return { valid: false, reason: 'Maximum access count reached' };
    }

    if (link.password && link.password !== password) {
      return { valid: false, reason: 'Invalid password' };
    }

    // Increment access count
    link.accessCount++;

    return { valid: true };
  }

  /**
   * Send message to patient
   */
  sendMessage(
    patientId: string,
    providerId: string,
    subject: string,
    content: string,
    options: {
      attachments?: PatientMessage['attachments'];
      relatedStudyUID?: string;
    } = {}
  ): PatientMessage {
    const message: PatientMessage = {
      id: `msg-${Date.now()}`,
      patientId,
      providerId,
      direction: 'outbound',
      subject: escapeHtml(subject),
      content: escapeHtml(content),
      attachments: options.attachments || [],
      read: false,
      createdAt: new Date(),
      relatedStudyUID: options.relatedStudyUID,
    };

    this.messages.set(message.id, message);

    // Send notification to patient
    const access = this.patientAccess.get(patientId);
    if (access?.preferences.notifications.email) {
      this.sendNotification(access.email, 'New message from your healthcare provider', subject);
    }

    return message;
  }

  /**
   * Get patient messages
   */
  getPatientMessages(patientId: string): PatientMessage[] {
    return Array.from(this.messages.values())
      .filter(m => m.patientId === patientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get patient studies
   */
  async getPatientStudies(patientId: string): Promise<string[]> {
    const access = this.patientAccess.get(patientId);
    if (!access) return [];
    return access.studies;
  }

  /**
   * Request records
   */
  requestRecords(
    patientId: string,
    requestDetails: {
      dateRange?: { start: Date; end: Date };
      modalities?: string[];
      deliveryMethod: 'portal' | 'cd' | 'email';
      recipientAddress?: string;
      purpose: string;
    }
  ): string {
    const requestId = `req-${Date.now()}`;

    this.auditLogger.log({
      eventType: 'patient_portal',
      action: 'records_requested',
      resource: patientId,
      outcome: 'success',
      details: requestDetails,
    });

    return requestId;
  }

  private sendNotification(email: string, title: string, body: string): void {
    // In real implementation, integrate with notification service
    console.log(`[PatientPortal] Sending notification to ${email}: ${title}`);
  }

  /**
   * Get patient access
   */
  getPatientAccess(patientId: string): PatientAccess | null {
    return this.patientAccess.get(patientId) || null;
  }

  /**
   * Update patient preferences
   */
  updatePreferences(patientId: string, preferences: Partial<PatientPreferences>): PatientAccess | null {
    const access = this.patientAccess.get(patientId);
    if (!access) return null;

    access.preferences = { ...access.preferences, ...preferences };
    return access;
  }
}

// ============================================================================
// FEATURE 10: RESEARCH DATA EXPORT PIPELINE
// ============================================================================

export interface ResearchExportJob {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
  config: ExportConfig;
  statistics: ExportStatistics;
  outputFiles: ExportOutputFile[];
  errors: ExportError[];
}

export interface ExportConfig {
  studies: StudySelectionCriteria;
  deidentification: DeidentificationConfig;
  outputFormat: OutputFormatConfig;
  annotations: AnnotationExportConfig;
  validation: ValidationConfig;
}

export interface StudySelectionCriteria {
  studyUIDs?: string[];
  query?: {
    dateRange?: { start: Date; end: Date };
    modalities?: string[];
    bodyParts?: string[];
    diagnoses?: string[];
    ageRange?: { min: number; max: number };
  };
  maxStudies?: number;
  randomSample?: boolean;
  sampleSize?: number;
}

export interface DeidentificationConfig {
  method: 'full' | 'limited' | 'none';
  profile: 'hipaa' | 'gdpr' | 'custom';
  keepOriginalUIDs: boolean;
  dateShift: boolean;
  dateShiftDays?: number;
  preserveFields?: string[];
  removeFields?: string[];
  customRules?: DeidentificationRule[];
}

export interface DeidentificationRule {
  tag: string;
  action: 'remove' | 'replace' | 'hash' | 'shift' | 'keep';
  value?: string;
}

export interface OutputFormatConfig {
  format: 'dicom' | 'nifti' | 'png' | 'numpy' | 'tfrecord';
  compression?: 'none' | 'gzip' | 'lz4';
  splitBy?: 'study' | 'series' | 'instance';
  includeMetadata: boolean;
  metadataFormat?: 'json' | 'csv' | 'parquet';
}

export interface AnnotationExportConfig {
  includeAnnotations: boolean;
  annotationFormats: ('json' | 'coco' | 'voc' | 'yolo' | 'dicom-sr')[];
  includeAIResults: boolean;
  includeManualAnnotations: boolean;
}

export interface ValidationConfig {
  validateDICOM: boolean;
  validateDeidentification: boolean;
  validateCompleteness: boolean;
  generateReport: boolean;
}

export interface ExportStatistics {
  totalStudies: number;
  processedStudies: number;
  totalSeries: number;
  totalInstances: number;
  totalSizeBytes: number;
  processingTimeMs: number;
  deidentifiedFields: number;
  annotationsExported: number;
}

export interface ExportOutputFile {
  id: string;
  filename: string;
  path: string;
  sizeBytes: number;
  checksum: string;
  type: 'data' | 'metadata' | 'annotation' | 'report';
}

export interface ExportError {
  studyUID?: string;
  seriesUID?: string;
  instanceUID?: string;
  errorCode: string;
  message: string;
  timestamp: Date;
}

export class ResearchDataExportPipeline {
  private static instance: ResearchDataExportPipeline;
  private jobs = new Map<string, ResearchExportJob>();
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor() {}

  static getInstance(): ResearchDataExportPipeline {
    if (!ResearchDataExportPipeline.instance) {
      ResearchDataExportPipeline.instance = new ResearchDataExportPipeline();
    }
    return ResearchDataExportPipeline.instance;
  }

  /**
   * Create export job
   */
  async createJob(
    name: string,
    config: ExportConfig,
    createdBy: string,
    description?: string
  ): Promise<ResearchExportJob> {
    const job: ResearchExportJob = {
      id: `export-${Date.now()}`,
      name,
      description: description || '',
      status: 'pending',
      createdBy,
      createdAt: new Date(),
      config,
      statistics: {
        totalStudies: 0,
        processedStudies: 0,
        totalSeries: 0,
        totalInstances: 0,
        totalSizeBytes: 0,
        processingTimeMs: 0,
        deidentifiedFields: 0,
        annotationsExported: 0,
      },
      outputFiles: [],
      errors: [],
    };

    this.jobs.set(job.id, job);

    this.auditLogger.log({
      eventType: 'research_export',
      action: 'job_created',
      userId: createdBy,
      resource: job.id,
      outcome: 'success',
      details: { name, configSummary: this.summarizeConfig(config) },
    });

    return job;
  }

  /**
   * Start export job
   */
  async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'validating';
    const startTime = Date.now();

    try {
      // Validate configuration
      await this.validateConfig(job);

      job.status = 'processing';

      // Process studies
      await this.processStudies(job);

      // Generate output files
      await this.generateOutput(job);

      job.status = 'completed';
      job.completedAt = new Date();
      job.statistics.processingTimeMs = Date.now() - startTime;

      this.auditLogger.log({
        eventType: 'research_export',
        action: 'job_completed',
        resource: jobId,
        outcome: 'success',
        details: { statistics: job.statistics },
      });

    } catch (error) {
      job.status = 'failed';
      job.errors.push({
        errorCode: 'PROCESSING_ERROR',
        message: (error as Error).message,
        timestamp: new Date(),
      });

      this.auditLogger.log({
        eventType: 'research_export',
        action: 'job_failed',
        resource: jobId,
        outcome: 'failure',
        details: { error: (error as Error).message },
      });
    }
  }

  private async validateConfig(job: ResearchExportJob): Promise<void> {
    const { config } = job;

    // Validate study selection
    if (!config.studies.studyUIDs?.length && !config.studies.query) {
      throw new Error('No studies selected for export');
    }

    // Validate deidentification profile
    if (config.deidentification.method !== 'none' && !config.deidentification.profile) {
      throw new Error('Deidentification profile required');
    }

    // Validate output format
    const validFormats = ['dicom', 'nifti', 'png', 'numpy', 'tfrecord'];
    if (!validFormats.includes(config.outputFormat.format)) {
      throw new Error(`Invalid output format: ${config.outputFormat.format}`);
    }
  }

  private async processStudies(job: ResearchExportJob): Promise<void> {
    // Get list of studies to process
    const studyUIDs = await this.getStudyUIDs(job.config.studies);
    job.statistics.totalStudies = studyUIDs.length;

    for (const studyUID of studyUIDs) {
      try {
        // Process each study
        await this.processStudy(job, studyUID);
        job.statistics.processedStudies++;
      } catch (error) {
        job.errors.push({
          studyUID,
          errorCode: 'STUDY_PROCESSING_ERROR',
          message: (error as Error).message,
          timestamp: new Date(),
        });
      }
    }
  }

  private async getStudyUIDs(criteria: StudySelectionCriteria): Promise<string[]> {
    if (criteria.studyUIDs?.length) {
      return criteria.studyUIDs;
    }

    // In real implementation, query database based on criteria
    // For simulation, return sample UIDs
    const sampleSize = criteria.sampleSize || criteria.maxStudies || 10;
    return Array.from({ length: sampleSize }, (_, i) => `1.2.3.${i}`);
  }

  private async processStudy(job: ResearchExportJob, studyUID: string): Promise<void> {
    // Simulate study processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update statistics
    job.statistics.totalSeries += Math.floor(Math.random() * 5) + 1;
    job.statistics.totalInstances += Math.floor(Math.random() * 100) + 20;
    job.statistics.totalSizeBytes += Math.floor(Math.random() * 100000000) + 10000000;

    // Apply deidentification
    if (job.config.deidentification.method !== 'none') {
      job.statistics.deidentifiedFields += this.getDeidentificationFieldCount(
        job.config.deidentification.profile
      );
    }

    // Export annotations if configured
    if (job.config.annotations.includeAnnotations) {
      job.statistics.annotationsExported += Math.floor(Math.random() * 10);
    }
  }

  private getDeidentificationFieldCount(profile: string): number {
    switch (profile) {
      case 'hipaa':
        return 18; // HIPAA safe harbor identifiers
      case 'gdpr':
        return 25;
      default:
        return 10;
    }
  }

  private async generateOutput(job: ResearchExportJob): Promise<void> {
    const timestamp = Date.now();

    // Main data file
    job.outputFiles.push({
      id: `file-${timestamp}-data`,
      filename: `${job.name.replace(/\s+/g, '_')}_data.${job.config.outputFormat.format}`,
      path: `/exports/${job.id}/data/`,
      sizeBytes: job.statistics.totalSizeBytes,
      checksum: `sha256:${Math.random().toString(36).substr(2)}`,
      type: 'data',
    });

    // Metadata file
    if (job.config.outputFormat.includeMetadata) {
      job.outputFiles.push({
        id: `file-${timestamp}-meta`,
        filename: `${job.name.replace(/\s+/g, '_')}_metadata.${job.config.outputFormat.metadataFormat || 'json'}`,
        path: `/exports/${job.id}/metadata/`,
        sizeBytes: Math.floor(job.statistics.totalSizeBytes * 0.01),
        checksum: `sha256:${Math.random().toString(36).substr(2)}`,
        type: 'metadata',
      });
    }

    // Annotation files
    if (job.config.annotations.includeAnnotations) {
      for (const format of job.config.annotations.annotationFormats) {
        job.outputFiles.push({
          id: `file-${timestamp}-ann-${format}`,
          filename: `${job.name.replace(/\s+/g, '_')}_annotations.${format}`,
          path: `/exports/${job.id}/annotations/`,
          sizeBytes: Math.floor(job.statistics.totalSizeBytes * 0.001),
          checksum: `sha256:${Math.random().toString(36).substr(2)}`,
          type: 'annotation',
        });
      }
    }

    // Validation report
    if (job.config.validation.generateReport) {
      job.outputFiles.push({
        id: `file-${timestamp}-report`,
        filename: `${job.name.replace(/\s+/g, '_')}_validation_report.pdf`,
        path: `/exports/${job.id}/reports/`,
        sizeBytes: 50000,
        checksum: `sha256:${Math.random().toString(36).substr(2)}`,
        type: 'report',
      });
    }
  }

  private summarizeConfig(config: ExportConfig): Record<string, unknown> {
    return {
      studyCount: config.studies.studyUIDs?.length || 'query-based',
      deidentification: config.deidentification.method,
      outputFormat: config.outputFormat.format,
      includeAnnotations: config.annotations.includeAnnotations,
    };
  }

  /**
   * Get job
   */
  getJob(jobId: string): ResearchExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ResearchExportJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get jobs by user
   */
  getJobsByUser(userId: string): ResearchExportJob[] {
    return Array.from(this.jobs.values())
      .filter(j => j.createdBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'failed';
    job.errors.push({
      errorCode: 'CANCELLED',
      message: 'Job cancelled by user',
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Delete job
   */
  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get download URL for output file
   */
  getDownloadUrl(jobId: string, fileId: string): string | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const file = job.outputFiles.find(f => f.id === fileId);
    if (!file) return null;

    return `/api/exports/${jobId}/files/${fileId}/download`;
  }
}

// ============================================================================
// Export all features
// ============================================================================

export default {
  // Feature 6
  QAWorkflowEngine,
  // Feature 7
  SmartSchedulingSystem,
  // Feature 8
  Print3DPreparationService,
  // Feature 9
  PatientPortalIntegration,
  // Feature 10
  ResearchDataExportPipeline,
};
