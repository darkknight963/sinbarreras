export interface Project {
  id: string;
  name: string;
  domain: string | null;
  vo: number; // 2, 4, 6
  entityType: string; // Sector público, Sector privado
  createdAt: string;
  scans?: Scan[];
}
export interface Scan {
  id: string;
  status: 'pending' | 'awaiting_login' | 'running' | 'completed' | 'failed';
  progress?: number;
  globalScore: number | null;
  ux: number; // 2, 4, 6
  vp: number | null; // Vo * Ux
  scanMode: 'rápido' | 'estándar' | 'profundo';
  loginMode?: 'none' | 'manual_assisted';
  scanUrls?: string[];
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
  sourceCategory?: 'violation' | 'alert' | 'manual_check';
  pageState?: 'initial' | 'post_overlay' | 'interactive_state';
  pageStateLabel?: string;
  description: string;
  elementHtml: string;
  selector: string;
  screenshotUrl: string;
  suggestedFix: string;
  resolutionArticle: string;
  wcagUrl: string;
  affectedElements?: string[];
  affectedHtmlSamples?: string[];
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
  reviewCount?: number;
  passedCount: number;
  score: number;
}

export interface ApplicabilityResult {
  criteria: CriterionApplicability[];
  summary: ApplicabilitySummary;
}

export interface FocusTraversalStep {
  index: number;
  selector: string;
  elementHtml: string;
  text: string;
  tagName: string;
  role: string;
  accessibleName: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  status: 'ok' | 'warning' | 'error';
  issue: string;
  suggestedFix: string;
}

export interface FocusTraversalReport {
  screenshotUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  pageSize: {
    width: number;
    height: number;
  };
  steps: FocusTraversalStep[];
  summary: {
    total: number;
    ok: number;
    warning: number;
    error: number;
  };
}

export interface SemanticStructureItem {
  index: number;
  kind: 'heading' | 'landmark' | 'form' | 'table' | 'iframe' | 'interactive';
  label: string;
  level?: number;
  role?: string;
  selector: string;
  accessibleName: string;
  text: string;
  status: 'ok' | 'warning' | 'error';
  issue: string;
  suggestedFix: string;
}

export interface SemanticStructureReport {
  items: SemanticStructureItem[];
  summary: {
    headings: number;
    landmarks: number;
    forms: number;
    tables: number;
    iframes: number;
    interactive: number;
    warnings: number;
    errors: number;
  };
}

export interface VisualFindingMarker {
  id: string;
  ruleId: string;
  normalizedRuleId: string;
  criterion: string;
  selector: string;
  description: string;
  severity: string;
  status: 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
  statusLabel: string;
  pageState: 'initial' | 'post_overlay' | 'interactive_state';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualMapState {
  pageState: 'initial' | 'post_overlay' | 'interactive_state';
  pageStateLabel: string;
  screenshotUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  pageSize: {
    width: number;
    height: number;
  };
  markers: VisualFindingMarker[];
}

export interface VisualMapReport {
  states: VisualMapState[];
}

export interface UrlResult {
  id: string;
  url: string;
  score: number;
  violations: Violation[];
  manualVerifications: ManualVerification[];
  applicability?: ApplicabilityResult;
  focusTraversal?: FocusTraversalReport | null;
  semanticStructure?: SemanticStructureReport | null;
  visualMap?: VisualMapReport | null;
  status: 'completed' | 'failed' | 'scanning';
  createdAt: string;
  scan?: Scan;
}
