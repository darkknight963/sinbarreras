export interface Project {
  id: string;
  name: string;
  domain: string;
  vo: number; // 2, 4, 6
  entityType: string; // Administración Pública Peruana, Empresa pública FONAFE, Gobierno Regional, Gobierno Local, Sector privado
  createdAt: string;
  scans?: Scan[];
}

export interface Scan {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  globalScore: number | null;
  ux: number; // 2, 4, 6
  vp: number | null; // Vo * Ux
  scanMode: 'rápido' | 'estándar' | 'profundo';
  createdAt: string;
  project?: Project;
  urlResults?: UrlResult[];
}

export interface Violation {
  ruleId: string;
  criterion: string;
  wcagCriterion?: string;
  nameEs: string;
  level: 'A' | 'AA' | 'AAA' | 'N/A';
  wcagLevel?: 'A' | 'AA' | 'AAA' | 'N/A';
  disability: string[];
  role: 'Desarrollador' | 'Diseñador UX/UI' | 'Redactor UX' | 'Compartido';
  severity: 'critico' | 'crítico' | 'alto' | 'medio' | 'bajo';
  findingStatus?: 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
  status?: 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
  statusLabel?: string;
  pageState?: 'initial' | 'post_overlay';
  pageStateLabel?: string;
  description: string;
  elementHtml: string;
  selector: string;
  screenshotUrl: string;
  suggestedFix: string;
  resolutionArticle: string;
  wcagUrl: string;
}

export interface ManualVerification {
  id: string;
  criterion: string;
  name: string;
  status: 'pending' | 'approved' | 'failed' | 'not_applicable';
  description: string;
}

export interface CriterionApplicability {
  id: string;
  nombre: string;
  nivel: 'A' | 'AA' | 'AAA';
  estado: 'aplica' | 'no_aplica';
  razon: string;
}

export interface ApplicabilitySummary {
  totalCriteria: number;
  applicableCount: number;
  notApplicableCount: number;
  failedCount: number;
  passedCount: number;
  score: number;
}

export interface ApplicabilityResult {
  criteria: CriterionApplicability[];
  summary: ApplicabilitySummary;
}

export interface UrlResult {
  id: string;
  url: string;
  score: number;
  violations: Violation[];
  manualVerifications: ManualVerification[];
  applicability?: ApplicabilityResult;
  status: 'completed' | 'failed' | 'scanning';
  createdAt: string;
  scan?: Scan;
}
