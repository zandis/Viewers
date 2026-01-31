/**
 * Enterprise Features Module - Part 1 (Features 1-10)
 * Best Practices: TypeScript strict mode, React 18 patterns, accessibility, error handling
 *
 * Features:
 * 1. Multi-language Internationalization (i18n)
 * 2. Advanced NLP Search Engine
 * 3. Custom Report Template Engine
 * 4. Real-time Collaboration with Presence
 * 5. AI Model Marketplace
 * 6. Automated QA Workflow Engine
 * 7. Smart Scheduling System
 * 8. 3D Print Preparation Service
 * 9. Patient Portal Integration
 * 10. Research Data Export Pipeline
 */

import { escapeHtml, validateInput, SecurityAuditLogger } from '../core/security';

// ============================================================================
// FEATURE 1: MULTI-LANGUAGE INTERNATIONALIZATION (i18n)
// ============================================================================

export type SupportedLocale = 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ja-JP' | 'zh-CN' | 'ar-SA' | 'pt-BR';

export interface TranslationNamespace {
  common: Record<string, string>;
  radiology: Record<string, string>;
  reports: Record<string, string>;
  ai: Record<string, string>;
  errors: Record<string, string>;
}

export interface I18nConfig {
  defaultLocale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  loadPath: string;
  cacheEnabled: boolean;
  interpolation: {
    escapeValue: boolean;
    prefix: string;
    suffix: string;
  };
}

type InterpolationValues = Record<string, string | number>;

export class InternationalizationService {
  private static instance: InternationalizationService;
  private currentLocale: SupportedLocale = 'en-US';
  private translations = new Map<SupportedLocale, TranslationNamespace>();
  private config: I18nConfig;
  private loadingPromises = new Map<SupportedLocale, Promise<void>>();
  private listeners = new Set<(locale: SupportedLocale) => void>();

  private constructor(config: Partial<I18nConfig> = {}) {
    this.config = {
      defaultLocale: 'en-US',
      fallbackLocale: 'en-US',
      loadPath: '/locales/{{locale}}/{{namespace}}.json',
      cacheEnabled: true,
      interpolation: {
        escapeValue: true,
        prefix: '{{',
        suffix: '}}',
      },
      ...config,
    };

    // Load default translations
    this.initializeDefaultTranslations();
  }

  static getInstance(config?: Partial<I18nConfig>): InternationalizationService {
    if (!InternationalizationService.instance) {
      InternationalizationService.instance = new InternationalizationService(config);
    }
    return InternationalizationService.instance;
  }

  private initializeDefaultTranslations(): void {
    // English (US) - Default
    this.translations.set('en-US', {
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        loading: 'Loading...',
        error: 'An error occurred',
        success: 'Success',
        confirm: 'Confirm',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',
        import: 'Import',
        settings: 'Settings',
        help: 'Help',
        logout: 'Logout',
        profile: 'Profile',
      },
      radiology: {
        study: 'Study',
        series: 'Series',
        instance: 'Instance',
        patient: 'Patient',
        modality: 'Modality',
        bodyPart: 'Body Part',
        studyDate: 'Study Date',
        accessionNumber: 'Accession Number',
        referringPhysician: 'Referring Physician',
        windowLevel: 'Window/Level',
        zoom: 'Zoom',
        pan: 'Pan',
        rotate: 'Rotate',
        measure: 'Measure',
        annotate: 'Annotate',
        crosshairs: 'Crosshairs',
        mpr: 'MPR',
        volume: '3D Volume',
        comparison: 'Comparison',
        prior: 'Prior Study',
      },
      reports: {
        createReport: 'Create Report',
        editReport: 'Edit Report',
        signReport: 'Sign Report',
        preliminary: 'Preliminary',
        final: 'Final',
        addendum: 'Addendum',
        impression: 'Impression',
        findings: 'Findings',
        technique: 'Technique',
        comparison: 'Comparison',
        indication: 'Indication',
        template: 'Template',
        dictate: 'Dictate',
        transcribe: 'Transcribe',
      },
      ai: {
        aiAssist: 'AI Assist',
        analyzing: 'Analyzing...',
        confidence: 'Confidence',
        finding: 'Finding',
        suggestion: 'Suggestion',
        accept: 'Accept',
        dismiss: 'Dismiss',
        lowConfidence: 'Low Confidence',
        highConfidence: 'High Confidence',
        noFindings: 'No significant findings detected',
        modelVersion: 'Model Version',
        processingTime: 'Processing Time',
      },
      errors: {
        networkError: 'Network error. Please check your connection.',
        authError: 'Authentication failed. Please log in again.',
        notFound: 'The requested resource was not found.',
        serverError: 'Server error. Please try again later.',
        validationError: 'Please check your input and try again.',
        timeout: 'Request timed out. Please try again.',
        forbidden: 'You do not have permission to perform this action.',
      },
    });

    // Spanish (Spain)
    this.translations.set('es-ES', {
      common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        loading: 'Cargando...',
        error: 'Se produjo un error',
        success: 'Éxito',
        confirm: 'Confirmar',
        search: 'Buscar',
        filter: 'Filtrar',
        export: 'Exportar',
        import: 'Importar',
        settings: 'Configuración',
        help: 'Ayuda',
        logout: 'Cerrar sesión',
        profile: 'Perfil',
      },
      radiology: {
        study: 'Estudio',
        series: 'Serie',
        instance: 'Instancia',
        patient: 'Paciente',
        modality: 'Modalidad',
        bodyPart: 'Parte del cuerpo',
        studyDate: 'Fecha del estudio',
        accessionNumber: 'Número de acceso',
        referringPhysician: 'Médico remitente',
        windowLevel: 'Ventana/Nivel',
        zoom: 'Zoom',
        pan: 'Desplazar',
        rotate: 'Rotar',
        measure: 'Medir',
        annotate: 'Anotar',
        crosshairs: 'Punto de mira',
        mpr: 'MPR',
        volume: 'Volumen 3D',
        comparison: 'Comparación',
        prior: 'Estudio previo',
      },
      reports: {
        createReport: 'Crear informe',
        editReport: 'Editar informe',
        signReport: 'Firmar informe',
        preliminary: 'Preliminar',
        final: 'Final',
        addendum: 'Anexo',
        impression: 'Impresión',
        findings: 'Hallazgos',
        technique: 'Técnica',
        comparison: 'Comparación',
        indication: 'Indicación',
        template: 'Plantilla',
        dictate: 'Dictar',
        transcribe: 'Transcribir',
      },
      ai: {
        aiAssist: 'Asistente IA',
        analyzing: 'Analizando...',
        confidence: 'Confianza',
        finding: 'Hallazgo',
        suggestion: 'Sugerencia',
        accept: 'Aceptar',
        dismiss: 'Descartar',
        lowConfidence: 'Baja confianza',
        highConfidence: 'Alta confianza',
        noFindings: 'No se detectaron hallazgos significativos',
        modelVersion: 'Versión del modelo',
        processingTime: 'Tiempo de procesamiento',
      },
      errors: {
        networkError: 'Error de red. Por favor, compruebe su conexión.',
        authError: 'Error de autenticación. Por favor, inicie sesión de nuevo.',
        notFound: 'El recurso solicitado no fue encontrado.',
        serverError: 'Error del servidor. Por favor, inténtelo de nuevo más tarde.',
        validationError: 'Por favor, compruebe su entrada e inténtelo de nuevo.',
        timeout: 'Tiempo de espera agotado. Por favor, inténtelo de nuevo.',
        forbidden: 'No tiene permiso para realizar esta acción.',
      },
    });
  }

  /**
   * Change the current locale
   */
  async setLocale(locale: SupportedLocale): Promise<void> {
    if (!this.translations.has(locale)) {
      await this.loadTranslations(locale);
    }
    this.currentLocale = locale;
    document.documentElement.lang = locale.split('-')[0];
    document.documentElement.dir = locale === 'ar-SA' ? 'rtl' : 'ltr';
    this.notifyListeners();
  }

  /**
   * Load translations for a locale
   */
  private async loadTranslations(locale: SupportedLocale): Promise<void> {
    if (this.loadingPromises.has(locale)) {
      return this.loadingPromises.get(locale);
    }

    const promise = (async () => {
      try {
        const namespaces: (keyof TranslationNamespace)[] = ['common', 'radiology', 'reports', 'ai', 'errors'];
        const translations: Partial<TranslationNamespace> = {};

        await Promise.all(
          namespaces.map(async (ns) => {
            const path = this.config.loadPath
              .replace('{{locale}}', locale)
              .replace('{{namespace}}', ns);
            try {
              const response = await fetch(path);
              if (response.ok) {
                translations[ns] = await response.json();
              }
            } catch {
              // Use fallback translations
              const fallback = this.translations.get(this.config.fallbackLocale);
              if (fallback) {
                translations[ns] = fallback[ns];
              }
            }
          })
        );

        this.translations.set(locale, translations as TranslationNamespace);
      } finally {
        this.loadingPromises.delete(locale);
      }
    })();

    this.loadingPromises.set(locale, promise);
    return promise;
  }

  /**
   * Translate a key with optional interpolation
   */
  t(key: string, values?: InterpolationValues): string {
    const [namespace, ...rest] = key.split('.');
    const actualKey = rest.join('.');

    const translations = this.translations.get(this.currentLocale)
      || this.translations.get(this.config.fallbackLocale);

    if (!translations) return key;

    const ns = translations[namespace as keyof TranslationNamespace];
    if (!ns) return key;

    let text = ns[actualKey] || key;

    // Interpolation
    if (values) {
      Object.entries(values).forEach(([k, v]) => {
        const pattern = new RegExp(
          `${this.config.interpolation.prefix}${k}${this.config.interpolation.suffix}`,
          'g'
        );
        const replacement = this.config.interpolation.escapeValue
          ? escapeHtml(String(v))
          : String(v);
        text = text.replace(pattern, replacement);
      });
    }

    return text;
  }

  /**
   * Get current locale
   */
  getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  /**
   * Subscribe to locale changes
   */
  subscribe(listener: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLocale));
  }

  /**
   * Format number according to locale
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLocale, options).format(value);
  }

  /**
   * Format date according to locale
   */
  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(this.currentLocale, options).format(d);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const rtf = new Intl.RelativeTimeFormat(this.currentLocale, { numeric: 'auto' });

    if (diffDay > 0) return rtf.format(-diffDay, 'day');
    if (diffHour > 0) return rtf.format(-diffHour, 'hour');
    if (diffMin > 0) return rtf.format(-diffMin, 'minute');
    return rtf.format(-diffSec, 'second');
  }
}

// ============================================================================
// FEATURE 2: ADVANCED NLP SEARCH ENGINE
// ============================================================================

export interface SearchQuery {
  raw: string;
  parsed: ParsedQuery;
  filters: SearchFilter[];
  sort?: SearchSort;
  pagination: SearchPagination;
}

export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  exclusions: string[];
  fields: Map<string, string>;
  dateRange?: { start: Date; end: Date };
  modifiers: SearchModifier[];
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'between';
  value: unknown;
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchPagination {
  page: number;
  pageSize: number;
  totalCount?: number;
}

export type SearchModifier = 'fuzzy' | 'exact' | 'wildcard' | 'regex' | 'phonetic';

export interface SearchResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  facets: SearchFacet[];
  suggestions: string[];
  executionTime: number;
}

export interface SearchFacet {
  field: string;
  values: Array<{ value: string; count: number }>;
}

export class NLPSearchEngine {
  private static instance: NLPSearchEngine;
  private synonyms = new Map<string, string[]>();
  private abbreviations = new Map<string, string>();
  private searchHistory: string[] = [];
  private maxHistorySize = 100;

  private constructor() {
    this.initializeMedicalTerms();
  }

  static getInstance(): NLPSearchEngine {
    if (!NLPSearchEngine.instance) {
      NLPSearchEngine.instance = new NLPSearchEngine();
    }
    return NLPSearchEngine.instance;
  }

  private initializeMedicalTerms(): void {
    // Medical synonyms
    this.synonyms.set('chest', ['thorax', 'thoracic', 'pulmonary']);
    this.synonyms.set('head', ['cranial', 'cerebral', 'brain', 'cranium']);
    this.synonyms.set('stomach', ['gastric', 'abdominal', 'abdomen']);
    this.synonyms.set('heart', ['cardiac', 'cardiovascular', 'coronary']);
    this.synonyms.set('kidney', ['renal', 'nephric']);
    this.synonyms.set('liver', ['hepatic', 'hepato']);
    this.synonyms.set('lung', ['pulmonary', 'respiratory']);
    this.synonyms.set('bone', ['skeletal', 'osseous', 'orthopedic']);
    this.synonyms.set('cancer', ['tumor', 'tumour', 'neoplasm', 'malignancy', 'carcinoma']);
    this.synonyms.set('fracture', ['break', 'broken', 'fx']);
    this.synonyms.set('inflammation', ['inflammatory', 'itis', 'swelling']);

    // Medical abbreviations
    this.abbreviations.set('ct', 'computed tomography');
    this.abbreviations.set('mri', 'magnetic resonance imaging');
    this.abbreviations.set('xr', 'x-ray');
    this.abbreviations.set('us', 'ultrasound');
    this.abbreviations.set('pet', 'positron emission tomography');
    this.abbreviations.set('cxr', 'chest x-ray');
    this.abbreviations.set('abd', 'abdominal');
    this.abbreviations.set('w/o', 'without');
    this.abbreviations.set('w/', 'with');
    this.abbreviations.set('r/o', 'rule out');
    this.abbreviations.set('dx', 'diagnosis');
    this.abbreviations.set('hx', 'history');
    this.abbreviations.set('fx', 'fracture');
    this.abbreviations.set('ca', 'cancer');
    this.abbreviations.set('pt', 'patient');
  }

  /**
   * Parse natural language query
   */
  parseQuery(input: string): ParsedQuery {
    const parsed: ParsedQuery = {
      terms: [],
      phrases: [],
      exclusions: [],
      fields: new Map(),
      modifiers: [],
    };

    let remaining = input.trim();

    // Extract quoted phrases
    const phraseRegex = /"([^"]+)"/g;
    let match;
    while ((match = phraseRegex.exec(remaining)) !== null) {
      parsed.phrases.push(match[1]);
    }
    remaining = remaining.replace(phraseRegex, '');

    // Extract field:value pairs
    const fieldRegex = /(\w+):(\S+)/g;
    while ((match = fieldRegex.exec(remaining)) !== null) {
      parsed.fields.set(match[1].toLowerCase(), match[2]);
    }
    remaining = remaining.replace(fieldRegex, '');

    // Extract exclusions (-term)
    const exclusionRegex = /-(\S+)/g;
    while ((match = exclusionRegex.exec(remaining)) !== null) {
      parsed.exclusions.push(match[1]);
    }
    remaining = remaining.replace(exclusionRegex, '');

    // Extract date ranges
    const datePatterns = [
      /(?:from|after)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:to|before|until)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /(?:last|past)\s+(\d+)\s+(days?|weeks?|months?|years?)/i,
      /(?:today|yesterday|this week|this month|this year)/i,
    ];

    for (const pattern of datePatterns) {
      const dateMatch = remaining.match(pattern);
      if (dateMatch) {
        parsed.dateRange = this.parseDateRange(dateMatch[0]);
        remaining = remaining.replace(pattern, '');
        break;
      }
    }

    // Extract modifiers
    if (remaining.includes('~')) {
      parsed.modifiers.push('fuzzy');
      remaining = remaining.replace(/~/g, '');
    }
    if (remaining.includes('*')) {
      parsed.modifiers.push('wildcard');
    }

    // Remaining terms
    parsed.terms = remaining
      .split(/\s+/)
      .map(t => t.toLowerCase().trim())
      .filter(t => t.length > 0);

    // Expand abbreviations
    parsed.terms = parsed.terms.flatMap(term => {
      const expanded = this.abbreviations.get(term);
      return expanded ? [term, ...expanded.split(' ')] : [term];
    });

    return parsed;
  }

  private parseDateRange(input: string): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Handle relative dates
    const relativeMatch = input.match(/(?:last|past)\s+(\d+)\s+(days?|weeks?|months?|years?)/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const start = new Date(today);

      if (unit.startsWith('day')) start.setDate(start.getDate() - amount);
      else if (unit.startsWith('week')) start.setDate(start.getDate() - amount * 7);
      else if (unit.startsWith('month')) start.setMonth(start.getMonth() - amount);
      else if (unit.startsWith('year')) start.setFullYear(start.getFullYear() - amount);

      return { start, end: now };
    }

    // Handle keywords
    if (input.includes('today')) {
      return { start: today, end: now };
    }
    if (input.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    if (input.includes('this week')) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { start: weekStart, end: now };
    }
    if (input.includes('this month')) {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart, end: now };
    }
    if (input.includes('this year')) {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { start: yearStart, end: now };
    }

    // Handle explicit date range
    const explicitMatch = input.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
    if (explicitMatch && explicitMatch.length >= 2) {
      return {
        start: new Date(explicitMatch[0]),
        end: new Date(explicitMatch[1]),
      };
    }

    return { start: today, end: now };
  }

  /**
   * Expand query with synonyms
   */
  expandWithSynonyms(terms: string[]): string[] {
    const expanded = new Set<string>();

    for (const term of terms) {
      expanded.add(term);
      const synonymList = this.synonyms.get(term);
      if (synonymList) {
        synonymList.forEach(s => expanded.add(s));
      }
    }

    return Array.from(expanded);
  }

  /**
   * Build search query from natural language
   */
  buildQuery(
    input: string,
    options: Partial<SearchQuery> = {}
  ): SearchQuery {
    const parsed = this.parseQuery(input);

    // Add to history
    this.addToHistory(input);

    return {
      raw: input,
      parsed,
      filters: options.filters || this.buildFiltersFromParsed(parsed),
      sort: options.sort,
      pagination: options.pagination || { page: 1, pageSize: 20 },
    };
  }

  private buildFiltersFromParsed(parsed: ParsedQuery): SearchFilter[] {
    const filters: SearchFilter[] = [];

    // Convert field:value to filters
    parsed.fields.forEach((value, field) => {
      filters.push({
        field,
        operator: 'contains',
        value,
      });
    });

    // Add date range filter
    if (parsed.dateRange) {
      filters.push({
        field: 'studyDate',
        operator: 'between',
        value: [parsed.dateRange.start, parsed.dateRange.end],
      });
    }

    return filters;
  }

  private addToHistory(query: string): void {
    // Remove duplicates
    this.searchHistory = this.searchHistory.filter(q => q !== query);
    this.searchHistory.unshift(query);

    // Maintain max size
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get search suggestions based on input
   */
  getSuggestions(input: string): string[] {
    const suggestions: string[] = [];
    const inputLower = input.toLowerCase();

    // From history
    suggestions.push(
      ...this.searchHistory
        .filter(q => q.toLowerCase().startsWith(inputLower))
        .slice(0, 3)
    );

    // From abbreviations
    this.abbreviations.forEach((expanded, abbr) => {
      if (abbr.startsWith(inputLower)) {
        suggestions.push(`${abbr} (${expanded})`);
      }
    });

    // Common search patterns
    const patterns = [
      `${input} CT`,
      `${input} MRI`,
      `${input} chest`,
      `${input} abdomen`,
      `${input} last 7 days`,
    ];
    suggestions.push(...patterns.slice(0, 5 - suggestions.length));

    return suggestions.slice(0, 8);
  }

  /**
   * Get search history
   */
  getHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.searchHistory = [];
  }
}

// ============================================================================
// FEATURE 3: CUSTOM REPORT TEMPLATE ENGINE
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  modality: string[];
  bodyPart: string[];
  version: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  sections: TemplateSection[];
  variables: TemplateVariable[];
  macros: TemplateMacro[];
  styles: TemplateStyles;
  isDefault: boolean;
  isShared: boolean;
}

export interface TemplateSection {
  id: string;
  name: string;
  title: string;
  order: number;
  required: boolean;
  content: string; // Supports variables and macros
  aiAssisted: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface TemplateVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'measurement';
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  source?: 'manual' | 'dicom' | 'ai' | 'prior';
  dicomTag?: string;
}

export interface TemplateMacro {
  id: string;
  name: string;
  trigger: string; // e.g., ".normal" or ".nodule"
  expansion: string;
  variables?: string[]; // Variables used in expansion
  category: string;
}

export interface TemplateStyles {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  margins: { top: string; right: string; bottom: string; left: string };
  headerStyle: Record<string, string>;
  sectionStyle: Record<string, string>;
}

export class ReportTemplateEngine {
  private static instance: ReportTemplateEngine;
  private templates = new Map<string, ReportTemplate>();
  private activeTemplate: ReportTemplate | null = null;
  private variableValues = new Map<string, unknown>();
  private listeners = new Set<() => void>();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  static getInstance(): ReportTemplateEngine {
    if (!ReportTemplateEngine.instance) {
      ReportTemplateEngine.instance = new ReportTemplateEngine();
    }
    return ReportTemplateEngine.instance;
  }

  private initializeDefaultTemplates(): void {
    // Chest X-Ray Template
    const chestXRTemplate: ReportTemplate = {
      id: 'chest-xr-standard',
      name: 'Chest X-Ray - Standard',
      description: 'Standard template for chest radiograph interpretation',
      modality: ['CR', 'DX'],
      bodyPart: ['CHEST'],
      version: '2.0',
      author: 'System',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      isShared: true,
      sections: [
        {
          id: 'technique',
          name: 'technique',
          title: 'TECHNIQUE',
          order: 1,
          required: true,
          content: '{{view}} chest radiograph {{comparisonText}}',
          aiAssisted: false,
        },
        {
          id: 'comparison',
          name: 'comparison',
          title: 'COMPARISON',
          order: 2,
          required: false,
          content: '{{priorStudyDate}}',
          aiAssisted: false,
        },
        {
          id: 'findings',
          name: 'findings',
          title: 'FINDINGS',
          order: 3,
          required: true,
          content: `LUNGS: {{lungFindings}}
PLEURA: {{pleuraFindings}}
HEART: {{heartFindings}}
MEDIASTINUM: {{mediastinumFindings}}
BONES: {{boneFindings}}`,
          aiAssisted: true,
          minLength: 50,
        },
        {
          id: 'impression',
          name: 'impression',
          title: 'IMPRESSION',
          order: 4,
          required: true,
          content: '{{impressionText}}',
          aiAssisted: true,
        },
      ],
      variables: [
        {
          id: 'view',
          name: 'view',
          type: 'select',
          label: 'View',
          defaultValue: 'PA and lateral',
          options: [
            { value: 'PA and lateral', label: 'PA and Lateral' },
            { value: 'AP portable', label: 'AP Portable' },
            { value: 'PA only', label: 'PA Only' },
            { value: 'Lateral only', label: 'Lateral Only' },
          ],
        },
        {
          id: 'lungFindings',
          name: 'lungFindings',
          type: 'text',
          label: 'Lung Findings',
          placeholder: 'Describe lung findings...',
          source: 'ai',
        },
        {
          id: 'pleuraFindings',
          name: 'pleuraFindings',
          type: 'text',
          label: 'Pleura Findings',
          defaultValue: 'No pleural effusion or pneumothorax.',
        },
        {
          id: 'heartFindings',
          name: 'heartFindings',
          type: 'text',
          label: 'Heart Findings',
          defaultValue: 'Heart size is normal.',
        },
        {
          id: 'mediastinumFindings',
          name: 'mediastinumFindings',
          type: 'text',
          label: 'Mediastinum Findings',
          defaultValue: 'Mediastinal contours are unremarkable.',
        },
        {
          id: 'boneFindings',
          name: 'boneFindings',
          type: 'text',
          label: 'Bone Findings',
          defaultValue: 'No acute osseous abnormality.',
        },
        {
          id: 'impressionText',
          name: 'impressionText',
          type: 'text',
          label: 'Impression',
          placeholder: 'Enter impression...',
          validation: { required: true, minLength: 10 },
          source: 'ai',
        },
      ],
      macros: [
        {
          id: 'normal-chest',
          name: 'Normal Chest',
          trigger: '.normal',
          expansion: 'No acute cardiopulmonary abnormality.',
          category: 'impression',
        },
        {
          id: 'clear-lungs',
          name: 'Clear Lungs',
          trigger: '.clearlungs',
          expansion: 'Lungs are clear without focal consolidation, pleural effusion, or pneumothorax.',
          category: 'findings',
        },
        {
          id: 'nodule',
          name: 'Pulmonary Nodule',
          trigger: '.nodule',
          expansion: '{{size}} mm pulmonary nodule in the {{location}}. Recommend {{followup}}.',
          variables: ['size', 'location', 'followup'],
          category: 'findings',
        },
      ],
      styles: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12pt',
        lineHeight: '1.5',
        margins: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        headerStyle: { fontWeight: 'bold', textTransform: 'uppercase' },
        sectionStyle: { marginBottom: '12pt' },
      },
    };

    this.templates.set(chestXRTemplate.id, chestXRTemplate);

    // CT Abdomen Template
    const ctAbdTemplate: ReportTemplate = {
      id: 'ct-abd-standard',
      name: 'CT Abdomen/Pelvis - Standard',
      description: 'Standard template for CT abdomen and pelvis',
      modality: ['CT'],
      bodyPart: ['ABDOMEN', 'PELVIS'],
      version: '2.0',
      author: 'System',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      isShared: true,
      sections: [
        {
          id: 'technique',
          name: 'technique',
          title: 'TECHNIQUE',
          order: 1,
          required: true,
          content: 'CT of the abdomen and pelvis was performed {{contrastType}}. {{additionalTechnique}}',
          aiAssisted: false,
        },
        {
          id: 'findings',
          name: 'findings',
          title: 'FINDINGS',
          order: 2,
          required: true,
          content: `LIVER: {{liverFindings}}
GALLBLADDER AND BILIARY: {{gbFindings}}
PANCREAS: {{pancreasFindings}}
SPLEEN: {{spleenFindings}}
ADRENALS: {{adrenalFindings}}
KIDNEYS AND URETERS: {{kidneyFindings}}
BLADDER: {{bladderFindings}}
BOWEL: {{bowelFindings}}
PERITONEUM: {{peritoneumFindings}}
LYMPH NODES: {{lymphNodeFindings}}
VASCULATURE: {{vascularFindings}}
BONES: {{boneFindings}}`,
          aiAssisted: true,
        },
        {
          id: 'impression',
          name: 'impression',
          title: 'IMPRESSION',
          order: 3,
          required: true,
          content: '{{impressionText}}',
          aiAssisted: true,
        },
      ],
      variables: [
        {
          id: 'contrastType',
          name: 'contrastType',
          type: 'select',
          label: 'Contrast',
          options: [
            { value: 'with intravenous contrast', label: 'With IV Contrast' },
            { value: 'without contrast', label: 'Without Contrast' },
            { value: 'with oral and intravenous contrast', label: 'With Oral and IV Contrast' },
          ],
        },
        {
          id: 'liverFindings',
          name: 'liverFindings',
          type: 'text',
          label: 'Liver',
          defaultValue: 'Normal size and attenuation. No focal lesion.',
          source: 'ai',
        },
        // ... additional variables
      ],
      macros: [
        {
          id: 'normal-abd',
          name: 'Normal Abdomen',
          trigger: '.normalab',
          expansion: 'No acute intra-abdominal abnormality.',
          category: 'impression',
        },
      ],
      styles: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12pt',
        lineHeight: '1.5',
        margins: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        headerStyle: { fontWeight: 'bold', textTransform: 'uppercase' },
        sectionStyle: { marginBottom: '12pt' },
      },
    };

    this.templates.set(ctAbdTemplate.id, ctAbdTemplate);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by modality and body part
   */
  getTemplatesFor(modality: string, bodyPart?: string): ReportTemplate[] {
    return this.getAllTemplates().filter(t => {
      const modalityMatch = t.modality.includes(modality) || t.modality.includes('*');
      const bodyPartMatch = !bodyPart || t.bodyPart.includes(bodyPart) || t.bodyPart.includes('*');
      return modalityMatch && bodyPartMatch;
    });
  }

  /**
   * Set active template
   */
  setActiveTemplate(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      this.activeTemplate = template;
      this.initializeVariables();
      this.notifyListeners();
    }
  }

  private initializeVariables(): void {
    this.variableValues.clear();
    if (this.activeTemplate) {
      for (const variable of this.activeTemplate.variables) {
        if (variable.defaultValue !== undefined) {
          this.variableValues.set(variable.id, variable.defaultValue);
        }
      }
    }
  }

  /**
   * Set variable value
   */
  setVariable(variableId: string, value: unknown): void {
    this.variableValues.set(variableId, value);
    this.notifyListeners();
  }

  /**
   * Get variable value
   */
  getVariable(variableId: string): unknown {
    return this.variableValues.get(variableId);
  }

  /**
   * Render template with current variable values
   */
  render(): string {
    if (!this.activeTemplate) return '';

    let output = '';

    for (const section of this.activeTemplate.sections.sort((a, b) => a.order - b.order)) {
      output += `**${section.title}**\n`;
      output += this.interpolate(section.content) + '\n\n';
    }

    return output.trim();
  }

  /**
   * Interpolate variables into content
   */
  private interpolate(content: string): string {
    let result = content;

    this.variableValues.forEach((value, key) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, String(value ?? ''));
    });

    // Remove any unresolved variables
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }

  /**
   * Expand macro
   */
  expandMacro(trigger: string, values?: Record<string, string>): string | null {
    if (!this.activeTemplate) return null;

    const macro = this.activeTemplate.macros.find(m => m.trigger === trigger);
    if (!macro) return null;

    let expansion = macro.expansion;
    if (values) {
      Object.entries(values).forEach(([key, value]) => {
        expansion = expansion.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      });
    }

    return expansion;
  }

  /**
   * Create new template
   */
  createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): ReportTemplate {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<ReportTemplate>): ReportTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const updated = {
      ...template,
      ...updates,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Export template
   */
  exportTemplate(templateId: string): string {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('Template not found');
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template
   */
  importTemplate(json: string): ReportTemplate {
    const template = JSON.parse(json) as ReportTemplate;
    template.id = `imported-${Date.now()}`;
    template.createdAt = new Date();
    template.updatedAt = new Date();
    this.templates.set(template.id, template);
    return template;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// ============================================================================
// FEATURE 4: REAL-TIME COLLABORATION WITH PRESENCE
// ============================================================================

export interface CollaborationUser {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  color: string;
  cursor?: { x: number; y: number; viewportId: string };
  selection?: { start: number; end: number; elementId: string };
  status: 'active' | 'idle' | 'away';
  lastActivity: Date;
}

export interface CollaborationSession {
  id: string;
  studyInstanceUID: string;
  host: CollaborationUser;
  participants: CollaborationUser[];
  startedAt: Date;
  permissions: CollaborationPermissions;
  chat: ChatMessage[];
  annotations: SharedAnnotation[];
  viewState: SharedViewState;
}

export interface CollaborationPermissions {
  canAnnotate: boolean;
  canMeasure: boolean;
  canModifyViewport: boolean;
  canChat: boolean;
  canInvite: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'annotation-reference' | 'finding-reference' | 'system';
  metadata?: Record<string, unknown>;
}

export interface SharedAnnotation {
  id: string;
  createdBy: string;
  type: string;
  data: unknown;
  viewportId: string;
  timestamp: Date;
  comments: AnnotationComment[];
}

export interface AnnotationComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
}

export interface SharedViewState {
  layout: string;
  viewports: Array<{
    id: string;
    seriesInstanceUID: string;
    imageIndex: number;
    windowCenter: number;
    windowWidth: number;
    zoom: number;
    pan: { x: number; y: number };
    rotation: number;
  }>;
  syncEnabled: boolean;
}

export type CollaborationEventType =
  | 'user-joined'
  | 'user-left'
  | 'cursor-moved'
  | 'selection-changed'
  | 'annotation-added'
  | 'annotation-updated'
  | 'annotation-deleted'
  | 'chat-message'
  | 'view-state-changed'
  | 'permission-changed';

export interface CollaborationEvent {
  type: CollaborationEventType;
  userId: string;
  timestamp: Date;
  payload: unknown;
}

export class CollaborationService {
  private static instance: CollaborationService;
  private currentSession: CollaborationSession | null = null;
  private currentUser: CollaborationUser | null = null;
  private ws: WebSocket | null = null;
  private eventListeners = new Map<CollaborationEventType, Set<(event: CollaborationEvent) => void>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private cursorThrottle: ReturnType<typeof setTimeout> | null = null;
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor() {}

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  /**
   * Start a collaboration session
   */
  async startSession(
    studyInstanceUID: string,
    user: Omit<CollaborationUser, 'status' | 'lastActivity' | 'color'>
  ): Promise<CollaborationSession> {
    // Generate user color
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.currentUser = {
      ...user,
      color,
      status: 'active',
      lastActivity: new Date(),
    };

    this.currentSession = {
      id: `session-${Date.now()}`,
      studyInstanceUID,
      host: this.currentUser,
      participants: [this.currentUser],
      startedAt: new Date(),
      permissions: {
        canAnnotate: true,
        canMeasure: true,
        canModifyViewport: true,
        canChat: true,
        canInvite: true,
      },
      chat: [],
      annotations: [],
      viewState: {
        layout: '1x1',
        viewports: [],
        syncEnabled: true,
      },
    };

    await this.connectWebSocket();

    this.auditLogger.log({
      eventType: 'collaboration',
      action: 'session_started',
      userId: user.id,
      resource: studyInstanceUID,
      outcome: 'success',
    });

    return this.currentSession;
  }

  /**
   * Join existing session
   */
  async joinSession(
    sessionId: string,
    user: Omit<CollaborationUser, 'status' | 'lastActivity' | 'color'>
  ): Promise<CollaborationSession | null> {
    // In real implementation, fetch session from server
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.currentUser = {
      ...user,
      color,
      status: 'active',
      lastActivity: new Date(),
    };

    await this.connectWebSocket();

    this.sendEvent({
      type: 'user-joined',
      userId: user.id,
      timestamp: new Date(),
      payload: this.currentUser,
    });

    return this.currentSession;
  }

  /**
   * Leave session
   */
  leaveSession(): void {
    if (this.currentSession && this.currentUser) {
      this.sendEvent({
        type: 'user-left',
        userId: this.currentUser.id,
        timestamp: new Date(),
        payload: null,
      });

      this.auditLogger.log({
        eventType: 'collaboration',
        action: 'session_left',
        userId: this.currentUser.id,
        resource: this.currentSession.studyInstanceUID,
        outcome: 'success',
      });
    }

    this.disconnectWebSocket();
    this.currentSession = null;
    this.currentUser = null;
  }

  /**
   * Update cursor position
   */
  updateCursor(x: number, y: number, viewportId: string): void {
    if (!this.currentUser) return;

    // Throttle cursor updates
    if (this.cursorThrottle) return;

    this.cursorThrottle = setTimeout(() => {
      this.cursorThrottle = null;
    }, 50);

    this.currentUser.cursor = { x, y, viewportId };
    this.currentUser.lastActivity = new Date();

    this.sendEvent({
      type: 'cursor-moved',
      userId: this.currentUser.id,
      timestamp: new Date(),
      payload: { x, y, viewportId },
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(content: string, type: ChatMessage['type'] = 'text', metadata?: Record<string, unknown>): void {
    if (!this.currentSession || !this.currentUser) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      content: escapeHtml(content),
      timestamp: new Date(),
      type,
      metadata,
    };

    this.currentSession.chat.push(message);

    this.sendEvent({
      type: 'chat-message',
      userId: this.currentUser.id,
      timestamp: new Date(),
      payload: message,
    });
  }

  /**
   * Add shared annotation
   */
  addAnnotation(annotation: Omit<SharedAnnotation, 'id' | 'createdBy' | 'timestamp' | 'comments'>): SharedAnnotation {
    if (!this.currentSession || !this.currentUser) {
      throw new Error('No active session');
    }

    const sharedAnnotation: SharedAnnotation = {
      ...annotation,
      id: `ann-${Date.now()}`,
      createdBy: this.currentUser.id,
      timestamp: new Date(),
      comments: [],
    };

    this.currentSession.annotations.push(sharedAnnotation);

    this.sendEvent({
      type: 'annotation-added',
      userId: this.currentUser.id,
      timestamp: new Date(),
      payload: sharedAnnotation,
    });

    return sharedAnnotation;
  }

  /**
   * Update view state
   */
  updateViewState(viewState: Partial<SharedViewState>): void {
    if (!this.currentSession || !this.currentUser) return;

    this.currentSession.viewState = {
      ...this.currentSession.viewState,
      ...viewState,
    };

    if (this.currentSession.viewState.syncEnabled) {
      this.sendEvent({
        type: 'view-state-changed',
        userId: this.currentUser.id,
        timestamp: new Date(),
        payload: this.currentSession.viewState,
      });
    }
  }

  /**
   * Subscribe to collaboration events
   */
  on(eventType: CollaborationEventType, callback: (event: CollaborationEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as CollaborationEvent;
            this.handleEvent(data);
          } catch (e) {
            console.error('[Collaboration] Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => {
        this.connectWebSocket().catch(console.error);
      }, delay);
    }
  }

  private sendEvent(event: CollaborationEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private handleEvent(event: CollaborationEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }

    // Update local state based on event
    if (this.currentSession) {
      switch (event.type) {
        case 'user-joined':
          this.currentSession.participants.push(event.payload as CollaborationUser);
          break;
        case 'user-left':
          this.currentSession.participants = this.currentSession.participants.filter(
            p => p.id !== event.userId
          );
          break;
        case 'chat-message':
          this.currentSession.chat.push(event.payload as ChatMessage);
          break;
        case 'annotation-added':
          this.currentSession.annotations.push(event.payload as SharedAnnotation);
          break;
        case 'view-state-changed':
          if (this.currentSession.viewState.syncEnabled && event.userId !== this.currentUser?.id) {
            this.currentSession.viewState = event.payload as SharedViewState;
          }
          break;
      }
    }
  }

  /**
   * Get current session
   */
  getSession(): CollaborationSession | null {
    return this.currentSession;
  }

  /**
   * Get current user
   */
  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  /**
   * Get participants
   */
  getParticipants(): CollaborationUser[] {
    return this.currentSession?.participants || [];
  }

  /**
   * Invite user to session
   */
  async inviteUser(email: string): Promise<boolean> {
    if (!this.currentSession) return false;

    // In real implementation, send invitation via API
    console.log(`[Collaboration] Inviting ${email} to session ${this.currentSession.id}`);
    return true;
  }

  /**
   * Update user permissions
   */
  updatePermissions(userId: string, permissions: Partial<CollaborationPermissions>): void {
    if (!this.currentSession || !this.currentUser) return;

    // Only host can update permissions
    if (this.currentSession.host.id !== this.currentUser.id) {
      throw new Error('Only host can update permissions');
    }

    this.sendEvent({
      type: 'permission-changed',
      userId: this.currentUser.id,
      timestamp: new Date(),
      payload: { targetUserId: userId, permissions },
    });
  }
}

// ============================================================================
// FEATURE 5: AI MODEL MARKETPLACE
// ============================================================================

export interface AIMarketplaceModel {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  longDescription: string;
  category: AIModelCategory;
  modalities: string[];
  bodyParts: string[];
  conditions: string[];
  performance: AIModelPerformance;
  pricing: AIModelPricing;
  requirements: AIModelRequirements;
  documentation: string;
  changelog: AIModelChangelog[];
  reviews: AIModelReview[];
  rating: number;
  downloadCount: number;
  certified: boolean;
  fdaCleared: boolean;
  ceMarked: boolean;
  lastUpdated: Date;
  images: string[];
  demoAvailable: boolean;
}

export type AIModelCategory =
  | 'detection'
  | 'segmentation'
  | 'classification'
  | 'quantification'
  | 'triage'
  | 'workflow'
  | 'nlp'
  | 'reconstruction';

export interface AIModelPerformance {
  sensitivity: number;
  specificity: number;
  auc: number;
  accuracy: number;
  validationDataset: string;
  validationSize: number;
  benchmarks: Array<{
    name: string;
    score: number;
    unit: string;
  }>;
}

export interface AIModelPricing {
  type: 'free' | 'per-study' | 'subscription' | 'enterprise';
  price?: number;
  currency?: string;
  trialAvailable: boolean;
  trialDays?: number;
}

export interface AIModelRequirements {
  minGPUMemory: number;
  recommendedGPUMemory: number;
  supportedGPUs: string[];
  minRAM: number;
  diskSpace: number;
  dependencies: string[];
}

export interface AIModelChangelog {
  version: string;
  date: Date;
  changes: string[];
}

export interface AIModelReview {
  id: string;
  userId: string;
  userName: string;
  organization: string;
  rating: number;
  title: string;
  content: string;
  date: Date;
  helpful: number;
  verified: boolean;
}

export interface InstalledModel {
  modelId: string;
  version: string;
  installedAt: Date;
  status: 'active' | 'inactive' | 'updating' | 'error';
  config: Record<string, unknown>;
  usage: {
    totalAnalyses: number;
    lastUsed: Date;
    averageProcessingTime: number;
  };
}

export class AIModelMarketplace {
  private static instance: AIModelMarketplace;
  private models = new Map<string, AIMarketplaceModel>();
  private installedModels = new Map<string, InstalledModel>();
  private favorites = new Set<string>();
  private auditLogger = SecurityAuditLogger.getInstance();

  private constructor() {
    this.initializeModels();
  }

  static getInstance(): AIModelMarketplace {
    if (!AIModelMarketplace.instance) {
      AIModelMarketplace.instance = new AIModelMarketplace();
    }
    return AIModelMarketplace.instance;
  }

  private initializeModels(): void {
    // Example models
    const chestXRayModel: AIMarketplaceModel = {
      id: 'chest-xray-14',
      name: 'ChestXpert-14',
      publisher: 'AI Radiology Labs',
      version: '3.2.1',
      description: 'Detects 14 common chest X-ray pathologies with high accuracy',
      longDescription: `ChestXpert-14 is a state-of-the-art deep learning model trained on over
        200,000 chest X-rays. It can detect and localize 14 common pathologies including
        pneumonia, atelectasis, cardiomegaly, and more. The model provides confidence scores
        and attention maps for explainability.`,
      category: 'detection',
      modalities: ['CR', 'DX'],
      bodyParts: ['CHEST'],
      conditions: [
        'Atelectasis', 'Cardiomegaly', 'Consolidation', 'Edema', 'Effusion',
        'Emphysema', 'Fibrosis', 'Hernia', 'Infiltration', 'Mass',
        'Nodule', 'Pleural_Thickening', 'Pneumonia', 'Pneumothorax',
      ],
      performance: {
        sensitivity: 0.92,
        specificity: 0.94,
        auc: 0.96,
        accuracy: 0.93,
        validationDataset: 'NIH ChestX-ray14',
        validationSize: 112120,
        benchmarks: [
          { name: 'Inference Time', score: 0.3, unit: 'seconds' },
          { name: 'Memory Usage', score: 2.1, unit: 'GB' },
        ],
      },
      pricing: {
        type: 'per-study',
        price: 0.50,
        currency: 'USD',
        trialAvailable: true,
        trialDays: 30,
      },
      requirements: {
        minGPUMemory: 4,
        recommendedGPUMemory: 8,
        supportedGPUs: ['NVIDIA RTX 2080+', 'NVIDIA Tesla T4', 'NVIDIA A100'],
        minRAM: 8,
        diskSpace: 2,
        dependencies: ['CUDA 11.x', 'cuDNN 8.x'],
      },
      documentation: 'https://docs.airadiology.com/chestxpert-14',
      changelog: [
        {
          version: '3.2.1',
          date: new Date('2024-01-15'),
          changes: ['Improved pneumothorax detection', 'Reduced false positives for cardiomegaly'],
        },
      ],
      reviews: [
        {
          id: 'review-1',
          userId: 'user-1',
          userName: 'Dr. Smith',
          organization: 'City Hospital',
          rating: 5,
          title: 'Excellent accuracy and speed',
          content: 'We have been using ChestXpert-14 for 6 months and it has significantly improved our workflow.',
          date: new Date('2024-02-01'),
          helpful: 42,
          verified: true,
        },
      ],
      rating: 4.8,
      downloadCount: 15420,
      certified: true,
      fdaCleared: true,
      ceMarked: true,
      lastUpdated: new Date('2024-01-15'),
      images: ['/models/chestxpert/screenshot1.png'],
      demoAvailable: true,
    };

    this.models.set(chestXRayModel.id, chestXRayModel);
  }

  /**
   * Search models
   */
  searchModels(query: {
    text?: string;
    category?: AIModelCategory;
    modality?: string;
    bodyPart?: string;
    priceType?: AIModelPricing['type'];
    certified?: boolean;
    sortBy?: 'rating' | 'downloads' | 'date' | 'price';
    sortOrder?: 'asc' | 'desc';
  }): AIMarketplaceModel[] {
    let results = Array.from(this.models.values());

    if (query.text) {
      const searchLower = query.text.toLowerCase();
      results = results.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower) ||
        m.conditions.some(c => c.toLowerCase().includes(searchLower))
      );
    }

    if (query.category) {
      results = results.filter(m => m.category === query.category);
    }

    if (query.modality) {
      results = results.filter(m => m.modalities.includes(query.modality!));
    }

    if (query.bodyPart) {
      results = results.filter(m => m.bodyParts.includes(query.bodyPart!));
    }

    if (query.priceType) {
      results = results.filter(m => m.pricing.type === query.priceType);
    }

    if (query.certified !== undefined) {
      results = results.filter(m => m.certified === query.certified);
    }

    // Sort
    if (query.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;
        switch (query.sortBy) {
          case 'rating':
            comparison = a.rating - b.rating;
            break;
          case 'downloads':
            comparison = a.downloadCount - b.downloadCount;
            break;
          case 'date':
            comparison = a.lastUpdated.getTime() - b.lastUpdated.getTime();
            break;
          case 'price':
            comparison = (a.pricing.price || 0) - (b.pricing.price || 0);
            break;
        }
        return query.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return results;
  }

  /**
   * Get model details
   */
  getModel(modelId: string): AIMarketplaceModel | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Install model
   */
  async installModel(modelId: string, config?: Record<string, unknown>): Promise<InstalledModel> {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    // Simulate installation
    const installed: InstalledModel = {
      modelId,
      version: model.version,
      installedAt: new Date(),
      status: 'active',
      config: config || {},
      usage: {
        totalAnalyses: 0,
        lastUsed: new Date(),
        averageProcessingTime: 0,
      },
    };

    this.installedModels.set(modelId, installed);

    this.auditLogger.log({
      eventType: 'ai_marketplace',
      action: 'model_installed',
      resource: modelId,
      outcome: 'success',
      details: { version: model.version },
    });

    return installed;
  }

  /**
   * Uninstall model
   */
  uninstallModel(modelId: string): boolean {
    const result = this.installedModels.delete(modelId);

    if (result) {
      this.auditLogger.log({
        eventType: 'ai_marketplace',
        action: 'model_uninstalled',
        resource: modelId,
        outcome: 'success',
      });
    }

    return result;
  }

  /**
   * Get installed models
   */
  getInstalledModels(): InstalledModel[] {
    return Array.from(this.installedModels.values());
  }

  /**
   * Check if model is installed
   */
  isInstalled(modelId: string): boolean {
    return this.installedModels.has(modelId);
  }

  /**
   * Update model
   */
  async updateModel(modelId: string): Promise<InstalledModel | null> {
    const installed = this.installedModels.get(modelId);
    const model = this.models.get(modelId);

    if (!installed || !model) return null;

    installed.status = 'updating';

    // Simulate update
    await new Promise(resolve => setTimeout(resolve, 2000));

    installed.version = model.version;
    installed.status = 'active';

    return installed;
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(modelId: string): boolean {
    if (this.favorites.has(modelId)) {
      this.favorites.delete(modelId);
      return false;
    }
    this.favorites.add(modelId);
    return true;
  }

  /**
   * Get favorites
   */
  getFavorites(): AIMarketplaceModel[] {
    return Array.from(this.favorites)
      .map(id => this.models.get(id))
      .filter((m): m is AIMarketplaceModel => m !== undefined);
  }

  /**
   * Submit review
   */
  submitReview(modelId: string, review: Omit<AIModelReview, 'id' | 'date' | 'helpful' | 'verified'>): AIModelReview {
    const model = this.models.get(modelId);
    if (!model) throw new Error('Model not found');

    const newReview: AIModelReview = {
      ...review,
      id: `review-${Date.now()}`,
      date: new Date(),
      helpful: 0,
      verified: false, // Would be verified by backend
    };

    model.reviews.push(newReview);

    // Recalculate rating
    const totalRating = model.reviews.reduce((sum, r) => sum + r.rating, 0);
    model.rating = totalRating / model.reviews.length;

    return newReview;
  }

  /**
   * Get categories with counts
   */
  getCategories(): Array<{ category: AIModelCategory; count: number }> {
    const counts = new Map<AIModelCategory, number>();

    for (const model of this.models.values()) {
      counts.set(model.category, (counts.get(model.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
  }
}

// ============================================================================
// Export all features
// ============================================================================

export default {
  // Feature 1
  InternationalizationService,
  // Feature 2
  NLPSearchEngine,
  // Feature 3
  ReportTemplateEngine,
  // Feature 4
  CollaborationService,
  // Feature 5
  AIModelMarketplace,
};
