/**
 * Clinical Workflow Functions
 * 40 Production-grade functions for clinical radiology workflows
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O';
  allergies: string[];
  clinicalHistory: ClinicalHistoryEntry[];
  insuranceInfo?: InsuranceInfo;
}

export interface ClinicalHistoryEntry {
  date: string;
  condition: string;
  icd10Code: string;
  notes: string;
  provider: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  authorizationRequired: boolean;
  preAuthNumber?: string;
}

export interface Order {
  id: string;
  accessionNumber: string;
  patientId: string;
  orderingPhysician: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  scheduledTime?: Date;
  examCode: string;
  examDescription: string;
  clinicalIndication: string;
  icd10Codes: string[];
  cptCodes: string[];
  status: OrderStatus;
  createdAt: Date;
  modifiedAt: Date;
}

export type OrderStatus =
  | 'ORDERED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REPORTED'
  | 'FINALIZED'
  | 'CANCELLED';

export interface Radiologist {
  id: string;
  name: string;
  npi: string;
  specialties: string[];
  workload: number;
  availableSlots: TimeSlot[];
  preferences: RadiologistPreferences;
}

export interface RadiologistPreferences {
  modalityPreferences: string[];
  maxDailyStudies: number;
  breakTimes: TimeSlot[];
  subspecialtyFocus: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface StudyAssignment {
  studyId: string;
  radiologistId: string;
  assignedAt: Date;
  expectedCompletionTime: Date;
  priority: number;
  reason: string;
}

export interface ClinicalAlert {
  id: string;
  type: 'CRITICAL' | 'URGENT' | 'INFO';
  studyId: string;
  patientId: string;
  message: string;
  aiConfidence?: number;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalated: boolean;
}

export interface ProtocolRule {
  id: string;
  name: string;
  condition: ProtocolCondition;
  action: ProtocolAction;
  priority: number;
  enabled: boolean;
}

export interface ProtocolCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'regex';
  value: string | number;
}

export interface ProtocolAction {
  type: 'SET_PROTOCOL' | 'ADD_SERIES' | 'NOTIFY' | 'ASSIGN';
  parameters: Record<string, unknown>;
}

// ============================================================================
// 1-10: PATIENT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * 1. Validate patient demographics
 */
export function validatePatientDemographics(patient: Partial<Patient>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!patient.mrn || patient.mrn.length < 4) {
    errors.push('MRN must be at least 4 characters');
  }
  if (!patient.name || patient.name.trim().length === 0) {
    errors.push('Patient name is required');
  }
  if (!patient.dateOfBirth || !isValidDate(patient.dateOfBirth)) {
    errors.push('Valid date of birth is required');
  }
  if (patient.dateOfBirth && new Date(patient.dateOfBirth) > new Date()) {
    errors.push('Date of birth cannot be in the future');
  }
  if (!patient.gender || !['M', 'F', 'O'].includes(patient.gender)) {
    errors.push('Valid gender is required');
  }

  return { valid: errors.length === 0, errors };
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * 2. Calculate patient age
 */
export function calculatePatientAge(dateOfBirth: string): {
  years: number;
  months: number;
  days: number;
  ageString: string;
} {
  const birth = new Date(dateOfBirth);

  // Validate date
  if (isNaN(birth.getTime())) {
    return { years: 0, months: 0, days: 0, ageString: 'Unknown' };
  }

  const today = new Date();

  // Ensure birth date is not in the future
  if (birth > today) {
    return { years: 0, months: 0, days: 0, ageString: 'Invalid' };
  }

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let ageString: string;
  if (years === 0 && months === 0) {
    ageString = `${days} day${days !== 1 ? 's' : ''}`;
  } else if (years === 0) {
    ageString = `${months} month${months !== 1 ? 's' : ''}`;
  } else {
    ageString = `${years} year${years !== 1 ? 's' : ''}`;
  }

  return { years, months, days, ageString };
}

/**
 * 3. Check allergy contraindications for contrast
 */
export function checkContrastContraindications(patient: Patient, contrastAgent: string): {
  safe: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const contrastAllergies = ['iodine', 'contrast', 'gadolinium', 'iohexol', 'iopamidol'];
  const hasContrastAllergy = patient.allergies.some(allergy =>
    contrastAllergies.some(ca => allergy.toLowerCase().includes(ca))
  );

  if (hasContrastAllergy) {
    warnings.push(`Patient has documented contrast allergy: ${patient.allergies.join(', ')}`);
    recommendations.push('Consider premedication protocol if contrast is necessary');
    recommendations.push('Have emergency medications readily available');
    recommendations.push('Consider alternative non-contrast study if clinically appropriate');
  }

  // Check for shellfish allergy (historical but still commonly flagged)
  if (patient.allergies.some(a => a.toLowerCase().includes('shellfish'))) {
    warnings.push('Patient has shellfish allergy - Note: No longer considered contraindication per ACR guidelines');
  }

  // Check for metformin
  const history = patient.clinicalHistory.find(h =>
    h.condition.toLowerCase().includes('diabetes') ||
    h.notes.toLowerCase().includes('metformin')
  );
  if (history && contrastAgent.toLowerCase().includes('iodine')) {
    warnings.push('Patient may be on metformin - verify and consider holding if eGFR concerns');
    recommendations.push('Check renal function before iodinated contrast');
  }

  return {
    safe: !hasContrastAllergy,
    warnings,
    recommendations,
  };
}

/**
 * 4. Merge patient records
 */
export function mergePatientRecords(
  primary: Patient,
  secondary: Patient
): Patient {
  return {
    ...primary,
    allergies: [...new Set([...primary.allergies, ...secondary.allergies])],
    clinicalHistory: [
      ...primary.clinicalHistory,
      ...secondary.clinicalHistory,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    insuranceInfo: primary.insuranceInfo || secondary.insuranceInfo,
  };
}

/**
 * 5. Generate patient summary for AI context
 */
export function generatePatientSummary(patient: Patient): string {
  const age = calculatePatientAge(patient.dateOfBirth);
  const recentHistory = patient.clinicalHistory.slice(0, 5);

  let summary = `${age.ageString} old ${patient.gender === 'M' ? 'male' : patient.gender === 'F' ? 'female' : 'patient'}`;

  if (patient.allergies.length > 0) {
    summary += ` with allergies to ${patient.allergies.join(', ')}`;
  }

  if (recentHistory.length > 0) {
    summary += `. Relevant history: ${recentHistory.map(h => h.condition).join(', ')}`;
  }

  return summary;
}

/**
 * 6. Calculate BMI from patient measurements
 */
export function calculateBMI(weightKg: number, heightCm: number): {
  bmi: number;
  category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese Class I' | 'Obese Class II' | 'Obese Class III';
  recommendation: string;
} {
  // Input validation
  if (heightCm <= 0 || weightKg <= 0) {
    return { bmi: 0, category: 'Normal', recommendation: 'Invalid measurements provided' };
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let category: ReturnType<typeof calculateBMI>['category'];
  let recommendation: string;

  if (bmi < 18.5) {
    category = 'Underweight';
    recommendation = 'Standard protocols appropriate';
  } else if (bmi < 25) {
    category = 'Normal';
    recommendation = 'Standard protocols appropriate';
  } else if (bmi < 30) {
    category = 'Overweight';
    recommendation = 'Consider increased mA for CT';
  } else if (bmi < 35) {
    category = 'Obese Class I';
    recommendation = 'Increase mA, consider larger FOV';
  } else if (bmi < 40) {
    category = 'Obese Class II';
    recommendation = 'Bariatric protocols may be needed';
  } else {
    category = 'Obese Class III';
    recommendation = 'Bariatric protocols required, verify table weight limit';
  }

  return { bmi: Math.round(bmi * 10) / 10, category, recommendation };
}

/**
 * 7. Estimate renal function for contrast safety
 */
export function estimateGFR(
  creatinine: number,
  age: number,
  gender: 'M' | 'F' | 'O',
  race?: string
): {
  egfr: number;
  ckdStage: number;
  contrastSafe: boolean;
  recommendation: string;
} {
  // Input validation
  if (creatinine <= 0 || age <= 0 || age > 120) {
    return {
      egfr: 0,
      ckdStage: 0,
      contrastSafe: false,
      recommendation: 'Invalid input values - unable to calculate eGFR',
    };
  }

  // CKD-EPI equation (2021 race-free)
  let egfr: number;
  const kappa = gender === 'F' ? 0.7 : 0.9;
  const alpha = gender === 'F' ? -0.241 : -0.302;
  const factor = gender === 'F' ? 1.012 : 1.0;

  const creatRatio = creatinine / kappa;
  egfr = 142 * Math.pow(Math.min(creatRatio, 1), alpha) *
         Math.pow(Math.max(creatRatio, 1), -1.200) *
         Math.pow(0.9938, age) * factor;

  egfr = Math.round(egfr);

  let ckdStage: number;
  let contrastSafe: boolean;
  let recommendation: string;

  if (egfr >= 90) {
    ckdStage = 1;
    contrastSafe = true;
    recommendation = 'Normal renal function, contrast safe';
  } else if (egfr >= 60) {
    ckdStage = 2;
    contrastSafe = true;
    recommendation = 'Mildly reduced function, contrast generally safe';
  } else if (egfr >= 45) {
    ckdStage = 3;
    contrastSafe = true;
    recommendation = 'Moderately reduced, use lowest effective contrast dose';
  } else if (egfr >= 30) {
    ckdStage = 3;
    contrastSafe = false;
    recommendation = 'Consider risk/benefit, hydration protocol recommended';
  } else if (egfr >= 15) {
    ckdStage = 4;
    contrastSafe = false;
    recommendation = 'High risk for CIN, avoid contrast if possible';
  } else {
    ckdStage = 5;
    contrastSafe = false;
    recommendation = 'ESRD, consult nephrology before contrast';
  }

  return { egfr, ckdStage, contrastSafe, recommendation };
}

/**
 * 8. Parse clinical indication for key terms
 */
export function parseClinicalIndication(indication: string): {
  keywords: string[];
  urgencyIndicators: string[];
  suggestedProtocol: string | null;
  followUp: boolean;
} {
  const lowerIndication = indication.toLowerCase();

  const urgencyTerms = ['acute', 'emergent', 'stat', 'rule out', 'r/o', 'trauma', 'stroke', 'chest pain', 'shortness of breath'];
  const urgencyIndicators = urgencyTerms.filter(term => lowerIndication.includes(term));

  const anatomyKeywords: Record<string, string[]> = {
    chest: ['lung', 'pulmonary', 'chest', 'thorax', 'cardiac', 'heart', 'mediastin'],
    abdomen: ['abdomen', 'liver', 'spleen', 'pancreas', 'kidney', 'renal', 'bowel'],
    head: ['head', 'brain', 'cerebr', 'stroke', 'headache', 'neuro'],
    spine: ['spine', 'vertebr', 'back pain', 'disc', 'cervical', 'lumbar', 'thoracic'],
    msk: ['fracture', 'joint', 'bone', 'arthritis', 'ortho'],
  };

  const keywords: string[] = [];
  let suggestedProtocol: string | null = null;

  for (const [region, terms] of Object.entries(anatomyKeywords)) {
    if (terms.some(t => lowerIndication.includes(t))) {
      keywords.push(region);
    }
  }

  // Suggest protocol based on keywords
  if (lowerIndication.includes('pe') || lowerIndication.includes('pulmonary embolism')) {
    suggestedProtocol = 'CT Pulmonary Angiography';
  } else if (lowerIndication.includes('stroke') || lowerIndication.includes('cva')) {
    suggestedProtocol = 'CT Head + CTA + Perfusion';
  } else if (lowerIndication.includes('appendicitis')) {
    suggestedProtocol = 'CT Abdomen/Pelvis with Contrast';
  } else if (lowerIndication.includes('kidney stone') || lowerIndication.includes('renal colic')) {
    suggestedProtocol = 'CT Abdomen/Pelvis without Contrast';
  }

  const followUp = lowerIndication.includes('follow') || lowerIndication.includes('f/u') || lowerIndication.includes('prior');

  return { keywords, urgencyIndicators, suggestedProtocol, followUp };
}

/**
 * 9. Validate insurance authorization
 */
export function validateInsuranceAuthorization(
  order: Order,
  patient: Patient
): {
  authorized: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!patient.insuranceInfo) {
    issues.push('No insurance information on file');
    recommendations.push('Verify patient insurance coverage');
    return { authorized: false, issues, recommendations };
  }

  if (patient.insuranceInfo.authorizationRequired && !patient.insuranceInfo.preAuthNumber) {
    issues.push('Pre-authorization required but not obtained');
    recommendations.push('Obtain pre-authorization before proceeding');
    recommendations.push('Contact insurance at provider number');
    return { authorized: false, issues, recommendations };
  }

  // High-cost exams often need auth
  const highCostExams = ['MRI', 'PET', 'CT ANGIO', 'NUCLEAR'];
  const needsAuth = highCostExams.some(exam =>
    order.examDescription.toUpperCase().includes(exam)
  );

  if (needsAuth && !patient.insuranceInfo.preAuthNumber) {
    issues.push('This exam type typically requires pre-authorization');
    recommendations.push('Verify authorization requirements with payer');
  }

  return {
    authorized: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * 10. Generate unique accession number
 */
export function generateAccessionNumber(prefix = 'ACC'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// 11-20: ORDER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * 11. Prioritize order based on clinical context
 */
export function calculateOrderPriority(order: Order): {
  score: number;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Base priority
  if (order.priority === 'STAT') {
    score += 100;
    factors.push('Ordered as STAT');
  } else if (order.priority === 'URGENT') {
    score += 50;
    factors.push('Ordered as URGENT');
  }

  // Clinical indication analysis
  const indication = parseClinicalIndication(order.clinicalIndication);
  score += indication.urgencyIndicators.length * 20;
  if (indication.urgencyIndicators.length > 0) {
    factors.push(`Urgent terms: ${indication.urgencyIndicators.join(', ')}`);
  }

  // Time-sensitive exams
  const timeSensitive = ['stroke', 'pe', 'trauma', 'aortic'];
  if (timeSensitive.some(t => order.clinicalIndication.toLowerCase().includes(t))) {
    score += 30;
    factors.push('Time-sensitive condition');
  }

  // Inpatient vs outpatient
  if (order.examCode.startsWith('IP')) {
    score += 10;
    factors.push('Inpatient study');
  }

  // Age-based adjustment (pediatric, elderly)
  const priority: 'STAT' | 'URGENT' | 'ROUTINE' =
    score >= 80 ? 'STAT' : score >= 40 ? 'URGENT' : 'ROUTINE';

  return { score, priority, factors };
}

/**
 * 12. Validate order completeness
 */
export function validateOrderCompleteness(order: Partial<Order>): {
  complete: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const required = [
    'patientId', 'orderingPhysician', 'examCode',
    'examDescription', 'clinicalIndication'
  ];

  for (const field of required) {
    if (!order[field as keyof Order]) {
      missing.push(field);
    }
  }

  if (!order.icd10Codes || order.icd10Codes.length === 0) {
    warnings.push('No ICD-10 diagnosis codes provided');
  }

  if (!order.cptCodes || order.cptCodes.length === 0) {
    warnings.push('No CPT codes provided - may affect billing');
  }

  if (order.clinicalIndication && order.clinicalIndication.length < 10) {
    warnings.push('Clinical indication may be too brief');
  }

  return {
    complete: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * 13. Find duplicate orders
 */
export function findDuplicateOrders(
  newOrder: Order,
  existingOrders: Order[],
  windowDays = 30
): Order[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  return existingOrders.filter(existing => {
    if (existing.patientId !== newOrder.patientId) return false;
    if (existing.status === 'CANCELLED') return false;
    if (new Date(existing.createdAt) < cutoffDate) return false;

    // Same exam code
    if (existing.examCode === newOrder.examCode) return true;

    // Similar exam description
    const similarity = calculateStringSimilarity(
      existing.examDescription.toLowerCase(),
      newOrder.examDescription.toLowerCase()
    );
    return similarity > 0.8;
  });
}

function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longer.length;
}

/**
 * 14. Calculate optimal scheduling slot
 */
export function findOptimalSchedulingSlot(
  order: Order,
  availableSlots: TimeSlot[],
  constraints: {
    preferredTimeOfDay?: 'morning' | 'afternoon';
    minimumPrepTime?: number;
    maxWaitDays?: number;
  } = {}
): TimeSlot | null {
  const now = new Date();
  const minStartTime = new Date(now.getTime() + (constraints.minimumPrepTime || 0) * 60000);
  const maxEndDate = new Date(now);
  maxEndDate.setDate(maxEndDate.getDate() + (constraints.maxWaitDays || 14));

  const validSlots = availableSlots.filter(slot => {
    if (slot.start < minStartTime) return false;
    if (slot.start > maxEndDate) return false;

    if (constraints.preferredTimeOfDay) {
      const hour = slot.start.getHours();
      if (constraints.preferredTimeOfDay === 'morning' && hour >= 12) return false;
      if (constraints.preferredTimeOfDay === 'afternoon' && hour < 12) return false;
    }

    return true;
  });

  if (validSlots.length === 0) return null;

  // Sort by priority considerations
  validSlots.sort((a, b) => {
    if (order.priority === 'STAT') {
      return a.start.getTime() - b.start.getTime();
    }
    return a.start.getTime() - b.start.getTime();
  });

  return validSlots[0];
}

/**
 * 15. Estimate exam duration
 */
export function estimateExamDuration(examCode: string, modality: string): {
  estimatedMinutes: number;
  setupMinutes: number;
  totalMinutes: number;
} {
  const durations: Record<string, number> = {
    'XR': 10,
    'CT': 15,
    'MRI': 45,
    'US': 30,
    'NM': 60,
    'PET': 90,
    'FLUORO': 20,
    'MAMMO': 15,
    'DEXA': 15,
  };

  const setupTimes: Record<string, number> = {
    'XR': 5,
    'CT': 10,
    'MRI': 15,
    'US': 5,
    'NM': 30,
    'PET': 30,
    'FLUORO': 10,
    'MAMMO': 5,
    'DEXA': 5,
  };

  const estimatedMinutes = durations[modality] || 30;
  const setupMinutes = setupTimes[modality] || 10;

  return {
    estimatedMinutes,
    setupMinutes,
    totalMinutes: estimatedMinutes + setupMinutes,
  };
}

/**
 * 16. Generate order tracking events
 */
export function generateOrderTimeline(order: Order): Array<{
  timestamp: Date;
  event: string;
  status: OrderStatus;
  details?: string;
}> {
  const timeline: Array<{
    timestamp: Date;
    event: string;
    status: OrderStatus;
    details?: string;
  }> = [];

  timeline.push({
    timestamp: order.createdAt,
    event: 'Order Created',
    status: 'ORDERED',
    details: `Ordered by ${order.orderingPhysician}`,
  });

  if (order.scheduledTime) {
    timeline.push({
      timestamp: order.scheduledTime,
      event: 'Exam Scheduled',
      status: 'SCHEDULED',
    });
  }

  timeline.push({
    timestamp: order.modifiedAt,
    event: `Status: ${order.status}`,
    status: order.status,
  });

  return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * 17. Calculate order turnaround time
 */
export function calculateTurnaroundTime(order: Order): {
  totalMinutes: number | null;
  withinSLA: boolean;
  slaTarget: number;
  breakdown: Record<string, number>;
} {
  const slaTargets: Record<string, number> = {
    'STAT': 60,
    'URGENT': 240,
    'ROUTINE': 1440,
  };

  const slaTarget = slaTargets[order.priority];

  if (order.status !== 'FINALIZED' && order.status !== 'REPORTED') {
    return {
      totalMinutes: null,
      withinSLA: true,
      slaTarget,
      breakdown: {},
    };
  }

  const totalMinutes = Math.round(
    (order.modifiedAt.getTime() - order.createdAt.getTime()) / 60000
  );

  return {
    totalMinutes,
    withinSLA: totalMinutes <= slaTarget,
    slaTarget,
    breakdown: {
      total: totalMinutes,
    },
  };
}

/**
 * 18. Validate CPT/ICD code combination
 */
export function validateCodeCombination(
  cptCode: string,
  icd10Codes: string[]
): {
  valid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Common valid combinations (simplified)
  const validCombinations: Record<string, string[]> = {
    '71046': ['J18', 'R05', 'R06'], // Chest X-ray
    '74177': ['R10', 'K80', 'K56'], // CT Abdomen
    '70553': ['G43', 'R51', 'G40'], // MRI Brain
  };

  const cptPrefix = cptCode.substring(0, 5);
  const expectedDiagnoses = validCombinations[cptPrefix];

  if (expectedDiagnoses) {
    const hasValidDiagnosis = icd10Codes.some(icd =>
      expectedDiagnoses.some(expected => icd.startsWith(expected))
    );

    if (!hasValidDiagnosis) {
      warnings.push('ICD-10 codes may not support medical necessity for this exam');
      suggestions.push(`Consider diagnoses starting with: ${expectedDiagnoses.join(', ')}`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
    suggestions,
  };
}

/**
 * 19. Generate patient prep instructions
 */
export function generatePrepInstructions(
  examCode: string,
  modality: string,
  withContrast: boolean
): string[] {
  const instructions: string[] = [];

  // Fasting requirements
  if (withContrast || ['PET', 'NM'].includes(modality)) {
    instructions.push('Do not eat or drink anything except water for 4 hours before the exam');
  }

  // Contrast-specific
  if (withContrast) {
    instructions.push('Stay well hydrated - drink plenty of water before and after the exam');
    instructions.push('Inform staff if you have any allergies, especially to contrast dye');
    instructions.push('Inform staff if you have kidney problems or diabetes');
  }

  // MRI-specific
  if (modality === 'MRI') {
    instructions.push('Remove all metal objects including jewelry, watches, and piercings');
    instructions.push('Inform staff of any implanted medical devices');
    instructions.push('Arrive 15 minutes early to complete safety screening');
  }

  // CT-specific
  if (modality === 'CT') {
    instructions.push('Wear comfortable, loose-fitting clothing without metal');
    instructions.push('You may be asked to hold your breath during the scan');
  }

  // Ultrasound
  if (modality === 'US' && examCode.includes('ABD')) {
    instructions.push('Do not eat or drink for 8 hours before the exam');
    instructions.push('For pelvic ultrasound: drink 32 oz of water 1 hour before and do not urinate');
  }

  return instructions;
}

/**
 * 20. Check for order protocol conflicts
 */
export function checkProtocolConflicts(
  order: Order,
  recentOrders: Order[]
): {
  hasConflict: boolean;
  conflicts: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }>;
} {
  const conflicts: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }> = [];

  // Check for recent contrast
  const recentContrast = recentOrders.find(o => {
    const hoursSince = (Date.now() - o.createdAt.getTime()) / 3600000;
    return hoursSince < 48 && o.examDescription.toLowerCase().includes('contrast');
  });

  if (recentContrast && order.examDescription.toLowerCase().includes('contrast')) {
    conflicts.push({
      type: 'CONTRAST_TIMING',
      message: 'Patient received contrast within 48 hours',
      severity: 'medium',
    });
  }

  // Check for nuclear medicine timing
  const recentNuclear = recentOrders.find(o => {
    const daysSince = (Date.now() - o.createdAt.getTime()) / 86400000;
    return daysSince < 3 && o.examDescription.includes('NM');
  });

  if (recentNuclear) {
    conflicts.push({
      type: 'NUCLEAR_TIMING',
      message: 'Recent nuclear medicine study may affect imaging',
      severity: 'high',
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

// ============================================================================
// 21-30: RADIOLOGIST ASSIGNMENT FUNCTIONS
// ============================================================================

/**
 * 21. Calculate radiologist workload score
 */
export function calculateWorkloadScore(radiologist: Radiologist): {
  currentLoad: number;
  maxCapacity: number;
  utilizationPercent: number;
  canAcceptMore: boolean;
} {
  const maxCapacity = radiologist.preferences.maxDailyStudies;
  const currentLoad = radiologist.workload;
  const utilizationPercent = Math.round((currentLoad / maxCapacity) * 100);

  return {
    currentLoad,
    maxCapacity,
    utilizationPercent,
    canAcceptMore: currentLoad < maxCapacity * 0.9,
  };
}

/**
 * 22. Match radiologist specialty to study
 */
export function matchRadiologistToStudy(
  order: Order,
  radiologists: Radiologist[]
): Array<{ radiologist: Radiologist; matchScore: number; reasons: string[] }> {
  const indication = parseClinicalIndication(order.clinicalIndication);

  return radiologists.map(radiologist => {
    let matchScore = 0;
    const reasons: string[] = [];

    // Specialty match
    const specialtyMatch = radiologist.specialties.some(specialty =>
      indication.keywords.some(keyword =>
        specialty.toLowerCase().includes(keyword)
      )
    );
    if (specialtyMatch) {
      matchScore += 50;
      reasons.push('Specialty match');
    }

    // Modality preference
    const modality = order.examCode.substring(0, 2);
    if (radiologist.preferences.modalityPreferences.includes(modality)) {
      matchScore += 30;
      reasons.push('Preferred modality');
    }

    // Workload consideration
    const workload = calculateWorkloadScore(radiologist);
    if (workload.canAcceptMore) {
      matchScore += 20;
      reasons.push('Available capacity');
    }

    return { radiologist, matchScore, reasons };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 23. Balance workload across radiologists
 */
export function balanceWorkload(
  pendingStudies: Order[],
  radiologists: Radiologist[]
): StudyAssignment[] {
  const assignments: StudyAssignment[] = [];
  const workloads = new Map<string, number>();

  // Initialize workloads
  radiologists.forEach(r => workloads.set(r.id, r.workload));

  // Sort studies by priority
  const sortedStudies = [...pendingStudies].sort((a, b) => {
    const priorityOrder = { STAT: 0, URGENT: 1, ROUTINE: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  for (const study of sortedStudies) {
    // Find best match with lowest workload
    const matches = matchRadiologistToStudy(study, radiologists);

    const bestMatch = matches.find(m => {
      const currentWorkload = workloads.get(m.radiologist.id) || 0;
      return currentWorkload < m.radiologist.preferences.maxDailyStudies;
    });

    if (bestMatch) {
      assignments.push({
        studyId: study.id,
        radiologistId: bestMatch.radiologist.id,
        assignedAt: new Date(),
        expectedCompletionTime: calculateExpectedCompletion(study),
        priority: bestMatch.matchScore,
        reason: bestMatch.reasons.join(', '),
      });

      workloads.set(
        bestMatch.radiologist.id,
        (workloads.get(bestMatch.radiologist.id) || 0) + 1
      );
    }
  }

  return assignments;
}

function calculateExpectedCompletion(order: Order): Date {
  const now = new Date();
  const minutes = order.priority === 'STAT' ? 30 : order.priority === 'URGENT' ? 120 : 480;
  return new Date(now.getTime() + minutes * 60000);
}

/**
 * 24. Check radiologist availability
 */
export function checkRadiologistAvailability(
  radiologist: Radiologist,
  requestedTime: Date
): {
  available: boolean;
  nextAvailableSlot: TimeSlot | null;
  reason?: string;
} {
  // Check if in break time
  const isInBreak = radiologist.preferences.breakTimes.some(slot =>
    requestedTime >= slot.start && requestedTime <= slot.end
  );

  if (isInBreak) {
    const nextSlot = radiologist.availableSlots.find(s => s.start > requestedTime);
    return {
      available: false,
      nextAvailableSlot: nextSlot || null,
      reason: 'Radiologist is on break',
    };
  }

  // Check available slots
  const isInSlot = radiologist.availableSlots.some(slot =>
    requestedTime >= slot.start && requestedTime <= slot.end
  );

  if (!isInSlot) {
    const nextSlot = radiologist.availableSlots.find(s => s.start > requestedTime);
    return {
      available: false,
      nextAvailableSlot: nextSlot || null,
      reason: 'Outside available hours',
    };
  }

  return { available: true, nextAvailableSlot: null };
}

/**
 * 25. Calculate radiologist productivity metrics
 */
export function calculateProductivityMetrics(
  radiologistId: string,
  completedStudies: Array<{ completedAt: Date; rvu: number; complexity: number }>
): {
  studiesPerHour: number;
  totalRVU: number;
  avgComplexity: number;
  efficiencyScore: number;
} {
  if (completedStudies.length === 0) {
    return { studiesPerHour: 0, totalRVU: 0, avgComplexity: 0, efficiencyScore: 0 };
  }

  const sortedStudies = [...completedStudies].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
  );

  const firstStudy = sortedStudies[0].completedAt;
  const lastStudy = sortedStudies[sortedStudies.length - 1].completedAt;
  const hoursWorked = (lastStudy.getTime() - firstStudy.getTime()) / 3600000 || 1;

  const totalRVU = completedStudies.reduce((sum, s) => sum + s.rvu, 0);
  const avgComplexity = completedStudies.reduce((sum, s) => sum + s.complexity, 0) / completedStudies.length;

  return {
    studiesPerHour: Math.round((completedStudies.length / hoursWorked) * 10) / 10,
    totalRVU: Math.round(totalRVU * 10) / 10,
    avgComplexity: Math.round(avgComplexity * 10) / 10,
    efficiencyScore: Math.round((totalRVU / hoursWorked) * 10) / 10,
  };
}

/**
 * 26-30: Additional assignment helper functions
 */

export function getRadiologistSchedule(radiologist: Radiologist, date: Date): TimeSlot[] {
  return radiologist.availableSlots.filter(slot => {
    const slotDate = new Date(slot.start);
    return slotDate.toDateString() === date.toDateString();
  });
}

export function calculateAssignmentFairness(assignments: StudyAssignment[], radiologists: Radiologist[]): number {
  const counts = new Map<string, number>();
  radiologists.forEach(r => counts.set(r.id, 0));
  assignments.forEach(a => counts.set(a.radiologistId, (counts.get(a.radiologistId) || 0) + 1));

  const values = Array.from(counts.values());
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;

  return 1 / (1 + Math.sqrt(variance));
}

export function reassignStudy(
  studyId: string,
  fromRadiologistId: string,
  toRadiologistId: string,
  reason: string
): StudyAssignment {
  return {
    studyId,
    radiologistId: toRadiologistId,
    assignedAt: new Date(),
    expectedCompletionTime: new Date(Date.now() + 3600000),
    priority: 0,
    reason: `Reassigned from ${fromRadiologistId}: ${reason}`,
  };
}

export function getPendingAssignments(radiologistId: string, assignments: StudyAssignment[]): StudyAssignment[] {
  return assignments.filter(a => a.radiologistId === radiologistId);
}

export function estimateQueueWaitTime(radiologistId: string, assignments: StudyAssignment[]): number {
  const pending = getPendingAssignments(radiologistId, assignments);
  return pending.reduce((total, a) => {
    const remaining = a.expectedCompletionTime.getTime() - Date.now();
    return total + Math.max(0, remaining);
  }, 0) / 60000;
}

// ============================================================================
// 31-40: ALERT AND NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * 31. Create clinical alert
 */
export function createClinicalAlert(
  type: ClinicalAlert['type'],
  studyId: string,
  patientId: string,
  message: string,
  aiConfidence?: number
): ClinicalAlert {
  return {
    id: `ALERT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    type,
    studyId,
    patientId,
    message,
    aiConfidence,
    createdAt: new Date(),
    escalated: false,
  };
}

/**
 * 32. Prioritize alerts for display
 */
export function prioritizeAlerts(alerts: ClinicalAlert[]): ClinicalAlert[] {
  return [...alerts].sort((a, b) => {
    const typeOrder = { CRITICAL: 0, URGENT: 1, INFO: 2 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    if (a.acknowledgedAt && !b.acknowledgedAt) return 1;
    if (!a.acknowledgedAt && b.acknowledgedAt) return -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * 33. Check if alert needs escalation
 */
export function checkAlertEscalation(alert: ClinicalAlert): {
  needsEscalation: boolean;
  escalationLevel: number;
  reason: string;
} {
  const ageMinutes = (Date.now() - alert.createdAt.getTime()) / 60000;

  if (alert.acknowledgedAt) {
    return { needsEscalation: false, escalationLevel: 0, reason: 'Already acknowledged' };
  }

  if (alert.type === 'CRITICAL' && ageMinutes > 5) {
    return { needsEscalation: true, escalationLevel: 2, reason: 'Critical alert unacknowledged >5 min' };
  }

  if (alert.type === 'URGENT' && ageMinutes > 15) {
    return { needsEscalation: true, escalationLevel: 1, reason: 'Urgent alert unacknowledged >15 min' };
  }

  return { needsEscalation: false, escalationLevel: 0, reason: 'Within SLA' };
}

/**
 * 34. Format alert for notification
 */
export function formatAlertNotification(alert: ClinicalAlert): {
  title: string;
  body: string;
  urgency: 'high' | 'normal' | 'low';
  actions: Array<{ id: string; label: string }>;
} {
  const urgencyMap = { CRITICAL: 'high' as const, URGENT: 'normal' as const, INFO: 'low' as const };

  return {
    title: `${alert.type}: Study Alert`,
    body: alert.message + (alert.aiConfidence ? ` (AI Confidence: ${Math.round(alert.aiConfidence * 100)}%)` : ''),
    urgency: urgencyMap[alert.type],
    actions: [
      { id: 'acknowledge', label: 'Acknowledge' },
      { id: 'view', label: 'View Study' },
    ],
  };
}

/**
 * 35. Batch alerts by patient
 */
export function batchAlertsByPatient(alerts: ClinicalAlert[]): Map<string, ClinicalAlert[]> {
  const batched = new Map<string, ClinicalAlert[]>();

  for (const alert of alerts) {
    const existing = batched.get(alert.patientId) || [];
    existing.push(alert);
    batched.set(alert.patientId, existing);
  }

  return batched;
}

/**
 * 36-40: Additional alert functions
 */

export function acknowledgeAlert(alert: ClinicalAlert, userId: string): ClinicalAlert {
  return {
    ...alert,
    acknowledgedAt: new Date(),
    acknowledgedBy: userId,
  };
}

export function filterActiveAlerts(alerts: ClinicalAlert[]): ClinicalAlert[] {
  return alerts.filter(a => !a.acknowledgedAt);
}

export function getAlertStatistics(alerts: ClinicalAlert[]): {
  total: number;
  critical: number;
  urgent: number;
  info: number;
  acknowledged: number;
  avgResponseTime: number;
} {
  const acknowledged = alerts.filter(a => a.acknowledgedAt);
  const responseTimes = acknowledged.map(a =>
    (a.acknowledgedAt!.getTime() - a.createdAt.getTime()) / 60000
  );

  return {
    total: alerts.length,
    critical: alerts.filter(a => a.type === 'CRITICAL').length,
    urgent: alerts.filter(a => a.type === 'URGENT').length,
    info: alerts.filter(a => a.type === 'INFO').length,
    acknowledged: acknowledged.length,
    avgResponseTime: responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0,
  };
}

export function createAlertSummary(alerts: ClinicalAlert[]): string {
  const stats = getAlertStatistics(alerts);
  return `${stats.total} alerts (${stats.critical} critical, ${stats.urgent} urgent). ${stats.acknowledged} acknowledged. Avg response: ${stats.avgResponseTime.toFixed(1)} min`;
}

export function archiveOldAlerts(alerts: ClinicalAlert[], daysOld = 7): {
  active: ClinicalAlert[];
  archived: ClinicalAlert[];
} {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return {
    active: alerts.filter(a => a.createdAt >= cutoff),
    archived: alerts.filter(a => a.createdAt < cutoff),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Patient Management
  validatePatientDemographics,
  calculatePatientAge,
  checkContrastContraindications,
  mergePatientRecords,
  generatePatientSummary,
  calculateBMI,
  estimateGFR,
  parseClinicalIndication,
  validateInsuranceAuthorization,
  generateAccessionNumber,

  // Order Management
  calculateOrderPriority,
  validateOrderCompleteness,
  findDuplicateOrders,
  findOptimalSchedulingSlot,
  estimateExamDuration,
  generateOrderTimeline,
  calculateTurnaroundTime,
  validateCodeCombination,
  generatePrepInstructions,
  checkProtocolConflicts,

  // Radiologist Assignment
  calculateWorkloadScore,
  matchRadiologistToStudy,
  balanceWorkload,
  checkRadiologistAvailability,
  calculateProductivityMetrics,
  getRadiologistSchedule,
  calculateAssignmentFairness,
  reassignStudy,
  getPendingAssignments,
  estimateQueueWaitTime,

  // Alerts
  createClinicalAlert,
  prioritizeAlerts,
  checkAlertEscalation,
  formatAlertNotification,
  batchAlertsByPatient,
  acknowledgeAlert,
  filterActiveAlerts,
  getAlertStatistics,
  createAlertSummary,
  archiveOldAlerts,
};
