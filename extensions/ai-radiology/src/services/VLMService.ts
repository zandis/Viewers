import { PubSubService } from '@ohif/core';
import {
  VLMConfig,
  VLMReportRequest,
  VLMReportResponse,
  VLMImageInput,
  GeneratedReport,
  ReportSection,
  Finding,
  AI_EVENTS,
  VLMProvider,
} from '../types';

/**
 * VLM (Vision Language Model) Service
 * Handles communication with VLM APIs for radiology report generation
 */
export default class VLMService extends PubSubService {
  public static REGISTRATION = {
    name: 'vlmService',
    altName: 'VLMService',
    create: ({
      configuration,
    }: {
      configuration?: Partial<VLMConfig>;
    }): VLMService => {
      return new VLMService(configuration);
    },
  };

  private config: VLMConfig;
  private abortController: AbortController | null = null;

  constructor(configuration?: Partial<VLMConfig>) {
    super({
      [AI_EVENTS.VLM_REPORT_STARTED]: AI_EVENTS.VLM_REPORT_STARTED,
      [AI_EVENTS.VLM_REPORT_PROGRESS]: AI_EVENTS.VLM_REPORT_PROGRESS,
      [AI_EVENTS.VLM_REPORT_COMPLETED]: AI_EVENTS.VLM_REPORT_COMPLETED,
      [AI_EVENTS.VLM_REPORT_ERROR]: AI_EVENTS.VLM_REPORT_ERROR,
    });

    this.config = {
      provider: 'openai',
      apiEndpoint: '',
      model: 'gpt-4-vision-preview',
      maxTokens: 4096,
      temperature: 0.3,
      timeout: 120000,
      ...configuration,
    };
  }

  /**
   * Configure the VLM service
   */
  public configure(config: Partial<VLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): VLMConfig {
    return { ...this.config };
  }

  /**
   * Generate a radiology report from images using VLM
   */
  public async generateReport(request: VLMReportRequest): Promise<VLMReportResponse> {
    const startTime = Date.now();
    const reportId = this.generateReportId();

    this._broadcastEvent(AI_EVENTS.VLM_REPORT_STARTED, {
      reportId,
      studyInstanceUID: request.studyInfo.studyInstanceUID,
      imageCount: request.images.length,
    });

    try {
      // Create abort controller for this request
      this.abortController = new AbortController();

      // Build the prompt
      const systemPrompt = this.buildSystemPrompt(request);
      const userPrompt = this.buildUserPrompt(request);

      // Get auth headers
      const authHeaders = await this.getAuthHeaders();

      // Make API request based on provider
      const response = await this.callVLMAPI(
        request.images,
        systemPrompt,
        userPrompt,
        authHeaders
      );

      // Parse the response into structured report
      const report = this.parseVLMResponse(response);

      const result: VLMReportResponse = {
        reportId,
        generatedAt: new Date().toISOString(),
        model: this.config.model,
        report,
        confidence: this.calculateOverallConfidence(report),
        processingTimeMs: Date.now() - startTime,
      };

      this._broadcastEvent(AI_EVENTS.VLM_REPORT_COMPLETED, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this._broadcastEvent(AI_EVENTS.VLM_REPORT_ERROR, {
        reportId,
        error: errorMessage,
        studyInstanceUID: request.studyInfo.studyInstanceUID,
      });

      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel ongoing report generation
   */
  public cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Build system prompt for VLM
   */
  private buildSystemPrompt(request: VLMReportRequest): string {
    const modality = request.studyInfo.modality;

    return `You are an expert radiologist AI assistant. Your task is to analyze medical images and generate structured radiology reports.

IMPORTANT GUIDELINES:
1. Be thorough but concise in your descriptions
2. Use standard radiology terminology
3. Structure findings by anatomical location
4. Note any abnormalities with their characteristics (size, location, density, etc.)
5. Provide differential diagnoses when appropriate
6. Flag any critical or urgent findings
7. Always mention limitations of the study if applicable

MODALITY: ${modality}
${request.studyInfo.studyDescription ? `STUDY: ${request.studyInfo.studyDescription}` : ''}

OUTPUT FORMAT:
Generate a structured report with the following sections:
1. TECHNIQUE: Brief description of imaging technique
2. COMPARISON: Reference to prior studies if mentioned
3. FINDINGS: Detailed findings organized by anatomy
4. IMPRESSION: Summary of key findings and recommendations

Also provide structured findings in JSON format at the end.`;
  }

  /**
   * Build user prompt with clinical context
   */
  private buildUserPrompt(request: VLMReportRequest): string {
    let prompt = 'Please analyze the following medical images and generate a radiology report.\n\n';

    if (request.clinicalHistory) {
      prompt += `CLINICAL HISTORY: ${request.clinicalHistory}\n\n`;
    }

    if (request.focusAreas && request.focusAreas.length > 0) {
      prompt += `AREAS OF CONCERN: ${request.focusAreas.join(', ')}\n\n`;
    }

    if (request.previousReports && request.previousReports.length > 0) {
      prompt += `PRIOR REPORTS:\n${request.previousReports.join('\n---\n')}\n\n`;
    }

    if (request.prompt) {
      prompt += `ADDITIONAL INSTRUCTIONS: ${request.prompt}\n\n`;
    }

    prompt += 'Please provide your analysis:';

    return prompt;
  }

  /**
   * Get authentication headers based on provider
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.config.getAuthHeaders) {
      return await this.config.getAuthHeaders();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.apiKey) {
      switch (this.config.provider) {
        case 'openai':
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          break;
        case 'anthropic':
          headers['x-api-key'] = this.config.apiKey;
          headers['anthropic-version'] = '2024-01-01';
          break;
        case 'google':
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          break;
        case 'azure':
          headers['api-key'] = this.config.apiKey;
          break;
        default:
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    return headers;
  }

  /**
   * Call the VLM API based on provider
   */
  private async callVLMAPI(
    images: VLMImageInput[],
    systemPrompt: string,
    userPrompt: string,
    headers: Record<string, string>
  ): Promise<string> {
    const body = this.buildRequestBody(images, systemPrompt, userPrompt);

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return this.extractResponseContent(data);
  }

  /**
   * Build request body based on provider format
   */
  private buildRequestBody(
    images: VLMImageInput[],
    systemPrompt: string,
    userPrompt: string
  ): Record<string, unknown> {
    switch (this.config.provider) {
      case 'openai':
        return this.buildOpenAIRequest(images, systemPrompt, userPrompt);
      case 'anthropic':
        return this.buildAnthropicRequest(images, systemPrompt, userPrompt);
      case 'google':
        return this.buildGoogleRequest(images, systemPrompt, userPrompt);
      default:
        return this.buildOpenAIRequest(images, systemPrompt, userPrompt);
    }
  }

  private buildOpenAIRequest(
    images: VLMImageInput[],
    systemPrompt: string,
    userPrompt: string
  ): Record<string, unknown> {
    const imageContent = images.map(img => ({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64Data}`,
        detail: 'high',
      },
    }));

    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [{ type: 'text', text: userPrompt }, ...imageContent],
        },
      ],
    };
  }

  private buildAnthropicRequest(
    images: VLMImageInput[],
    systemPrompt: string,
    userPrompt: string
  ): Record<string, unknown> {
    const imageContent = images.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.base64Data,
      },
    }));

    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userPrompt }, ...imageContent],
        },
      ],
    };
  }

  private buildGoogleRequest(
    images: VLMImageInput[],
    systemPrompt: string,
    userPrompt: string
  ): Record<string, unknown> {
    const parts = [
      { text: systemPrompt + '\n\n' + userPrompt },
      ...images.map(img => ({
        inline_data: {
          mime_type: img.mimeType,
          data: img.base64Data,
        },
      })),
    ];

    return {
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    };
  }

  /**
   * Extract response content based on provider format
   */
  private extractResponseContent(data: Record<string, unknown>): string {
    switch (this.config.provider) {
      case 'openai':
        return (data.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content || '';
      case 'anthropic':
        return (data.content as Array<{ text: string }>)?.[0]?.text || '';
      case 'google':
        return (
          (data.candidates as Array<{ content: { parts: Array<{ text: string }> } }>)?.[0]?.content
            ?.parts?.[0]?.text || ''
        );
      default:
        // Try common patterns
        if (typeof data === 'string') return data;
        if (data.content) return String(data.content);
        if (data.text) return String(data.text);
        if (data.response) return String(data.response);
        return JSON.stringify(data);
    }
  }

  /**
   * Parse VLM response into structured report
   */
  private parseVLMResponse(response: string): GeneratedReport {
    const sections: ReportSection[] = [];
    const findings: Finding[] = [];
    const impressions: string[] = [];

    // Parse sections using regex
    const sectionPatterns = [
      { title: 'Technique', pattern: /(?:TECHNIQUE|TECHNICAL)[:\s]*([^]*?)(?=(?:COMPARISON|FINDINGS|IMPRESSION|$))/i },
      { title: 'Comparison', pattern: /COMPARISON[:\s]*([^]*?)(?=(?:FINDINGS|IMPRESSION|$))/i },
      { title: 'Findings', pattern: /FINDINGS[:\s]*([^]*?)(?=(?:IMPRESSION|$))/i },
      { title: 'Impression', pattern: /IMPRESSION[:\s]*([^]*?)(?=(?:RECOMMENDATION|STRUCTURED|$))/i },
    ];

    sectionPatterns.forEach((sp, index) => {
      const match = response.match(sp.pattern);
      if (match && match[1]) {
        sections.push({
          id: `section-${index}`,
          title: sp.title,
          content: match[1].trim(),
          order: index,
          isEditable: true,
          aiGenerated: true,
          confidence: 0.85,
        });

        if (sp.title === 'Impression') {
          // Split impression into individual points
          const points = match[1]
            .split(/\d+\.|[-•]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
          impressions.push(...points);
        }
      }
    });

    // Try to extract structured findings from JSON block
    const jsonMatch = response.match(/```json\s*(\{[^]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (Array.isArray(jsonData.findings)) {
          jsonData.findings.forEach((f: Partial<Finding>, index: number) => {
            findings.push({
              id: f.id || `finding-${index}`,
              description: f.description || '',
              location: f.location,
              severity: f.severity || 'normal',
              confidence: f.confidence || 0.8,
              codes: f.codes,
            });
          });
        }
      } catch {
        // JSON parsing failed, extract findings from text
        this.extractFindingsFromText(response, findings);
      }
    } else {
      this.extractFindingsFromText(response, findings);
    }

    return {
      sections,
      findings,
      impressions,
      rawText: response,
    };
  }

  /**
   * Extract findings from unstructured text
   */
  private extractFindingsFromText(text: string, findings: Finding[]): void {
    // Look for common finding patterns
    const findingPatterns = [
      /(?:no |normal |unremarkable )([^.]+)/gi,
      /(?:there is |demonstrates |shows )([^.]+)/gi,
      /(\d+(?:\.\d+)?\s*(?:mm|cm)\s+[^.]+)/gi,
      /(nodule|mass|lesion|opacity|consolidation|effusion|fracture)[^.]+/gi,
    ];

    let findingIndex = 0;
    findingPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const description = match[1] || match[0];
        if (description.length > 10 && description.length < 500) {
          findings.push({
            id: `finding-${findingIndex++}`,
            description: description.trim(),
            severity: this.inferSeverity(description),
            confidence: 0.7,
          });
        }
      }
    });
  }

  /**
   * Infer severity from finding description
   */
  private inferSeverity(description: string): Finding['severity'] {
    const text = description.toLowerCase();
    if (text.includes('critical') || text.includes('urgent') || text.includes('emergent')) {
      return 'critical';
    }
    if (text.includes('severe') || text.includes('large') || text.includes('significant')) {
      return 'severe';
    }
    if (text.includes('moderate')) {
      return 'moderate';
    }
    if (text.includes('mild') || text.includes('small') || text.includes('minimal')) {
      return 'mild';
    }
    if (text.includes('normal') || text.includes('unremarkable') || text.includes('no ')) {
      return 'normal';
    }
    return 'moderate';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(report: GeneratedReport): number {
    const sectionConfidences = report.sections
      .map(s => s.confidence || 0.5)
      .filter(c => c > 0);

    const findingConfidences = report.findings.map(f => f.confidence);

    const allConfidences = [...sectionConfidences, ...findingConfidences];

    if (allConfidences.length === 0) return 0.5;

    return allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `vlm-report-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Test VLM connection
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          this.buildRequestBody(
            [],
            'You are a helpful assistant.',
            'Say "connection successful" to confirm the API is working.'
          )
        ),
      });

      if (response.ok) {
        return { success: true, message: 'VLM API connection successful' };
      } else {
        const error = await response.text();
        return { success: false, message: `Connection failed: ${error}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
