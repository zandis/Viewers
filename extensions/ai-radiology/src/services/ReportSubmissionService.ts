import { PubSubService } from '@ohif/core';
import {
  ReportSubmissionTarget,
  ReportSubmissionRequest,
  ReportSubmissionResponse,
  GeneratedReport,
  StudyInfo,
  AI_EVENTS,
} from '../types';

/**
 * Report Submission Service
 * Handles submission of finalized reports to external systems (RIS, PACS, EHR, FHIR)
 */
export default class ReportSubmissionService extends PubSubService {
  public static REGISTRATION = {
    name: 'reportSubmissionService',
    altName: 'ReportSubmissionService',
    create: ({
      configuration,
    }: {
      configuration?: ReportSubmissionServiceConfig;
    }): ReportSubmissionService => {
      return new ReportSubmissionService(configuration);
    },
  };

  private targets: Map<string, ReportSubmissionTarget> = new Map();
  private config: ReportSubmissionServiceConfig;

  constructor(configuration?: ReportSubmissionServiceConfig) {
    super({
      SUBMISSION_STARTED: 'submission:started',
      SUBMISSION_COMPLETED: 'submission:completed',
      SUBMISSION_FAILED: 'submission:failed',
    });

    this.config = {
      defaultFormat: 'dicom-sr',
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...configuration,
    };
  }

  /**
   * Register a submission target
   */
  public registerTarget(target: ReportSubmissionTarget): void {
    this.targets.set(target.id, target);
  }

  /**
   * Get all registered targets
   */
  public getTargets(): ReportSubmissionTarget[] {
    return Array.from(this.targets.values());
  }

  /**
   * Get a specific target by ID
   */
  public getTarget(targetId: string): ReportSubmissionTarget | undefined {
    return this.targets.get(targetId);
  }

  /**
   * Remove a target
   */
  public removeTarget(targetId: string): boolean {
    return this.targets.delete(targetId);
  }

  /**
   * Submit report to a target
   */
  public async submitReport(request: ReportSubmissionRequest): Promise<ReportSubmissionResponse> {
    const target = this.targets.get(request.targetId);
    if (!target) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        target: request.targetId,
        error: `Target not found: ${request.targetId}`,
      };
    }

    this._broadcastEvent('submission:started', {
      targetId: request.targetId,
      reportId: request.reportId,
      format: request.format,
    });

    try {
      // Format the report for the target
      const formattedReport = await this.formatReport(request, target);

      // Submit with retry logic
      const response = await this.submitWithRetry(target, formattedReport, request);

      this._broadcastEvent('submission:completed', {
        ...response,
        reportId: request.reportId,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response: ReportSubmissionResponse = {
        success: false,
        timestamp: new Date().toISOString(),
        target: target.name,
        error: errorMessage,
      };

      this._broadcastEvent('submission:failed', {
        ...response,
        reportId: request.reportId,
      });

      return response;
    }
  }

  /**
   * Format report for submission based on target type and format
   */
  private async formatReport(
    request: ReportSubmissionRequest,
    target: ReportSubmissionTarget
  ): Promise<FormattedReport> {
    switch (request.format) {
      case 'dicom-sr':
        return this.formatAsDicomSR(request.report, request.studyInfo);

      case 'hl7-oru':
        return this.formatAsHL7ORU(request.report, request.studyInfo);

      case 'fhir':
        return this.formatAsFHIR(request.report, request.studyInfo);

      case 'pdf':
        return this.formatAsPDF(request.report, request.studyInfo);

      case 'text':
        return this.formatAsText(request.report);

      default:
        return this.formatAsText(request.report);
    }
  }

  /**
   * Format as DICOM Structured Report
   */
  private formatAsDicomSR(report: GeneratedReport, studyInfo: StudyInfo): FormattedReport {
    // Create DICOM SR dataset
    const srDataset = {
      // Patient Module
      PatientID: studyInfo.patient.patientId,
      PatientName: studyInfo.patient.patientName,
      PatientBirthDate: studyInfo.patient.birthDate,
      PatientSex: studyInfo.patient.sex,

      // Study Module
      StudyInstanceUID: studyInfo.studyInstanceUID,
      StudyDate: studyInfo.studyDate,
      StudyTime: studyInfo.studyTime,
      AccessionNumber: studyInfo.accessionNumber,
      ReferringPhysicianName: studyInfo.referringPhysician,

      // Series Module (new series for SR)
      SeriesInstanceUID: this.generateUID(),
      SeriesNumber: '9999',
      Modality: 'SR',
      SeriesDescription: 'AI-Assisted Radiology Report',

      // SOP Common Module
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.33', // Comprehensive SR
      SOPInstanceUID: this.generateUID(),

      // SR Document Content Module
      ContentDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
      ContentTime: new Date().toTimeString().split(' ')[0].replace(/:/g, ''),
      ContentSequence: this.buildSRContentSequence(report),

      // Verifying Observer
      VerifyingObserverSequence: [],
    };

    return {
      contentType: 'application/dicom+json',
      data: JSON.stringify(srDataset),
    };
  }

  /**
   * Build SR Content Sequence from report
   */
  private buildSRContentSequence(report: GeneratedReport): SRContentItem[] {
    const contentSequence: SRContentItem[] = [];

    // Add sections as containers
    report.sections.forEach(section => {
      contentSequence.push({
        RelationshipType: 'CONTAINS',
        ValueType: 'CONTAINER',
        ConceptNameCodeSequence: [
          {
            CodeValue: section.id,
            CodingSchemeDesignator: 'OHIF',
            CodeMeaning: section.title,
          },
        ],
        ContinuityOfContent: 'SEPARATE',
        ContentSequence: [
          {
            RelationshipType: 'CONTAINS',
            ValueType: 'TEXT',
            TextValue: section.content,
          },
        ],
      });
    });

    // Add findings
    report.findings.forEach(finding => {
      contentSequence.push({
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: [
          {
            CodeValue: 'FINDING',
            CodingSchemeDesignator: 'DCM',
            CodeMeaning: 'Finding',
          },
        ],
        ConceptCodeSequence: [
          {
            CodeValue: finding.codes?.[0]?.code || finding.id,
            CodingSchemeDesignator: finding.codes?.[0]?.system?.toUpperCase() || 'OHIF',
            CodeMeaning: finding.description,
          },
        ],
      });
    });

    return contentSequence;
  }

  /**
   * Format as HL7 ORU (Observation Result) message
   */
  private formatAsHL7ORU(report: GeneratedReport, studyInfo: StudyInfo): FormattedReport {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14);
    const messageId = `MSG${timestamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Build HL7 v2.x ORU message
    const segments = [
      // Message Header
      `MSH|^~\\&|OHIF_AI|RADIOLOGY|RIS|HOSPITAL|${timestamp}||ORU^R01^ORU_R01|${messageId}|P|2.5.1|||AL|NE||UNICODE UTF-8`,

      // Patient Identification
      `PID|1||${studyInfo.patient.patientId}^^^HOSPITAL^MR||${studyInfo.patient.patientName?.replace(/\s+/g, '^')}||${studyInfo.patient.birthDate || ''}|${studyInfo.patient.sex || 'U'}`,

      // Patient Visit
      `PV1|1|O|RADIOLOGY||||||||||||||||${studyInfo.accessionNumber || ''}`,

      // Order
      `ORC|RE|${studyInfo.accessionNumber || ''}|${studyInfo.studyInstanceUID}|||||||${studyInfo.referringPhysician || ''}`,

      // Observation Request
      `OBR|1|${studyInfo.accessionNumber || ''}|${studyInfo.studyInstanceUID}|RAD^Radiology Report^L|||${timestamp}|||||||||${studyInfo.referringPhysician || ''}||||||||F`,
    ];

    // Add observations for each section
    let obxIndex = 1;
    report.sections.forEach(section => {
      // Split content into 80-char segments (HL7 limit)
      const lines = this.splitText(section.content, 80);
      lines.forEach((line, lineIndex) => {
        segments.push(
          `OBX|${obxIndex}|TX|${section.id}^${section.title}^L|${lineIndex + 1}|${this.escapeHL7(line)}||||||F`
        );
        obxIndex++;
      });
    });

    // Add impression as a special observation
    if (report.impressions.length > 0) {
      const impressionText = report.impressions.join('; ');
      segments.push(
        `OBX|${obxIndex}|TX|IMP^Impression^L|1|${this.escapeHL7(impressionText)}||||||F`
      );
    }

    return {
      contentType: 'application/hl7-v2',
      data: segments.join('\r'),
    };
  }

  /**
   * Format as FHIR DiagnosticReport
   */
  private formatAsFHIR(report: GeneratedReport, studyInfo: StudyInfo): FormattedReport {
    const fhirReport = {
      resourceType: 'DiagnosticReport',
      id: this.generateUID(),
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'RAD',
              display: 'Radiology',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '18748-4',
            display: 'Diagnostic imaging study',
          },
        ],
        text: studyInfo.studyDescription || 'Radiology Report',
      },
      subject: {
        reference: `Patient/${studyInfo.patient.patientId}`,
        display: studyInfo.patient.patientName,
      },
      effectiveDateTime: studyInfo.studyDate
        ? `${studyInfo.studyDate.slice(0, 4)}-${studyInfo.studyDate.slice(4, 6)}-${studyInfo.studyDate.slice(6, 8)}`
        : new Date().toISOString().split('T')[0],
      issued: new Date().toISOString(),
      conclusion: report.impressions.join(' '),
      conclusionCode: report.findings
        .filter(f => f.codes && f.codes.length > 0)
        .map(f => ({
          coding: f.codes!.map(c => ({
            system: this.getFHIRCodeSystem(c.system),
            code: c.code,
            display: c.display,
          })),
        })),
      presentedForm: [
        {
          contentType: 'text/plain',
          data: Buffer.from(report.rawText).toString('base64'),
        },
      ],
      extension: [
        {
          url: 'http://ohif.org/fhir/StructureDefinition/ai-generated',
          valueBoolean: true,
        },
      ],
    };

    return {
      contentType: 'application/fhir+json',
      data: JSON.stringify(fhirReport, null, 2),
    };
  }

  /**
   * Format as PDF (returns base64 encoded PDF)
   */
  private formatAsPDF(report: GeneratedReport, studyInfo: StudyInfo): FormattedReport {
    // Generate HTML and note that actual PDF generation would need a library
    const html = this.generateReportHTML(report, studyInfo);

    // In production, use jsPDF or similar library
    // For now, return HTML that can be converted
    return {
      contentType: 'text/html',
      data: html,
      metadata: {
        suggestedFilename: `report_${studyInfo.accessionNumber || studyInfo.studyInstanceUID}.pdf`,
        requiresPDFConversion: true,
      },
    };
  }

  /**
   * Format as plain text
   */
  private formatAsText(report: GeneratedReport): FormattedReport {
    let text = 'RADIOLOGY REPORT\n';
    text += '=' .repeat(50) + '\n\n';

    report.sections.forEach(section => {
      text += `${section.title.toUpperCase()}\n`;
      text += '-'.repeat(section.title.length) + '\n';
      text += section.content + '\n\n';
    });

    if (report.impressions.length > 0) {
      text += '\nIMPRESSION\n';
      text += '-'.repeat(10) + '\n';
      report.impressions.forEach((imp, i) => {
        text += `${i + 1}. ${imp}\n`;
      });
    }

    return {
      contentType: 'text/plain',
      data: text,
    };
  }

  /**
   * Generate HTML for report
   */
  private generateReportHTML(report: GeneratedReport, studyInfo: StudyInfo): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Radiology Report</title>
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 8.5in; margin: 0.5in auto; }
    .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; }
    .patient-info { display: flex; justify-content: space-between; margin: 20px 0; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
    .impression { background: #f5f5f5; padding: 10px; border-left: 3px solid #333; }
    .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 0.9em; }
    .ai-notice { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RADIOLOGY REPORT</h1>
    <p>${studyInfo.institutionName || 'Medical Imaging Center'}</p>
  </div>

  <div class="patient-info">
    <div>
      <strong>Patient:</strong> ${studyInfo.patient.patientName || 'N/A'}<br>
      <strong>MRN:</strong> ${studyInfo.patient.patientId}<br>
      <strong>DOB:</strong> ${studyInfo.patient.birthDate || 'N/A'}
    </div>
    <div>
      <strong>Accession:</strong> ${studyInfo.accessionNumber || 'N/A'}<br>
      <strong>Study Date:</strong> ${studyInfo.studyDate || 'N/A'}<br>
      <strong>Modality:</strong> ${studyInfo.modality}
    </div>
  </div>

  <div class="study-info">
    <strong>Exam:</strong> ${studyInfo.studyDescription || 'N/A'}<br>
    <strong>Referring:</strong> ${studyInfo.referringPhysician || 'N/A'}
  </div>

  ${report.sections.map(section => `
  <div class="section">
    <div class="section-title">${section.title}</div>
    <div class="section-content">${section.content.replace(/\n/g, '<br>')}</div>
  </div>
  `).join('')}

  ${report.impressions.length > 0 ? `
  <div class="section impression">
    <div class="section-title">IMPRESSION</div>
    <ol>
      ${report.impressions.map(imp => `<li>${imp}</li>`).join('')}
    </ol>
  </div>
  ` : ''}

  <div class="footer">
    <p class="ai-notice">This report was generated with AI assistance and has been reviewed by a qualified radiologist.</p>
    <p>Report generated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Submit with retry logic
   */
  private async submitWithRetry(
    target: ReportSubmissionTarget,
    formattedReport: FormattedReport,
    request: ReportSubmissionRequest
  ): Promise<ReportSubmissionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts!; attempt++) {
      try {
        return await this.doSubmit(target, formattedReport, request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts! - 1) {
          await this.delay(this.config.retryDelayMs! * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  /**
   * Perform actual submission
   */
  private async doSubmit(
    target: ReportSubmissionTarget,
    formattedReport: FormattedReport,
    request: ReportSubmissionRequest
  ): Promise<ReportSubmissionResponse> {
    const headers = await this.buildHeaders(target, formattedReport.contentType);

    const response = await fetch(target.endpoint, {
      method: 'POST',
      headers,
      body: formattedReport.data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submission failed (${response.status}): ${errorText}`);
    }

    const responseData = await response.json().catch(() => ({}));

    return {
      success: true,
      submissionId: responseData.id || this.generateUID(),
      timestamp: new Date().toISOString(),
      target: target.name,
      details: responseData,
    };
  }

  /**
   * Build request headers for target
   */
  private async buildHeaders(
    target: ReportSubmissionTarget,
    contentType: string
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };

    switch (target.authType) {
      case 'basic':
        const { username, password } = target.config as { username: string; password: string };
        headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        break;

      case 'oauth2':
        const token = await this.getOAuth2Token(target);
        headers['Authorization'] = `Bearer ${token}`;
        break;

      case 'api-key':
        const { apiKeyHeader, apiKey } = target.config as { apiKeyHeader: string; apiKey: string };
        headers[apiKeyHeader || 'X-API-Key'] = apiKey;
        break;
    }

    return headers;
  }

  /**
   * Get OAuth2 token (stub - implement based on your OAuth2 flow)
   */
  private async getOAuth2Token(target: ReportSubmissionTarget): Promise<string> {
    const { tokenEndpoint, clientId, clientSecret, scope } = target.config as {
      tokenEndpoint: string;
      clientId: string;
      clientSecret: string;
      scope: string;
    };

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope || '',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to obtain OAuth2 token');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Get FHIR code system URL
   */
  private getFHIRCodeSystem(system: string): string {
    const systems: Record<string, string> = {
      'radlex': 'http://radlex.org',
      'snomed-ct': 'http://snomed.info/sct',
      'icd-10': 'http://hl7.org/fhir/sid/icd-10',
      'loinc': 'http://loinc.org',
    };
    return systems[system] || `http://example.org/fhir/${system}`;
  }

  /**
   * Escape HL7 special characters
   */
  private escapeHL7(text: string): string {
    return text
      .replace(/\\/g, '\\E\\')
      .replace(/\|/g, '\\F\\')
      .replace(/\^/g, '\\S\\')
      .replace(/&/g, '\\T\\')
      .replace(/~/g, '\\R\\')
      .replace(/\r?\n/g, '\\.br\\');
  }

  /**
   * Split text into chunks
   */
  private splitText(text: string, maxLength: number): string[] {
    const lines: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        lines.push(remaining);
        break;
      }

      let splitIndex = remaining.lastIndexOf(' ', maxLength);
      if (splitIndex === -1) splitIndex = maxLength;

      lines.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex).trim();
    }

    return lines;
  }

  /**
   * Generate a pseudo-UID
   */
  private generateUID(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString().slice(2, 10);
    return `2.25.${timestamp}${random}`;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ReportSubmissionServiceConfig {
  defaultFormat?: 'dicom-sr' | 'hl7-oru' | 'fhir' | 'pdf' | 'text';
  retryAttempts?: number;
  retryDelayMs?: number;
}

interface FormattedReport {
  contentType: string;
  data: string;
  metadata?: Record<string, unknown>;
}

interface SRContentItem {
  RelationshipType: string;
  ValueType: string;
  ConceptNameCodeSequence?: Array<{
    CodeValue: string;
    CodingSchemeDesignator: string;
    CodeMeaning: string;
  }>;
  ConceptCodeSequence?: Array<{
    CodeValue: string;
    CodingSchemeDesignator: string;
    CodeMeaning: string;
  }>;
  TextValue?: string;
  ContinuityOfContent?: string;
  ContentSequence?: SRContentItem[];
}
