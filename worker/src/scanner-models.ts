export type SeverityEs = 'critico' | 'alto' | 'medio' | 'bajo';
export type FindingCategory = 'violation' | 'alert' | 'manual_check';
export type FindingTool = 'axe' | 'lighthouse' | 'pa11y' | 'ibm-equal-access' | 'heuristic-dom';
export type FindingStatus = 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
export type PageState = 'initial' | 'post_overlay' | 'interactive_state';
export type OverlayAction = 'closed' | 'accepted' | 'skipped_sensitive' | 'not_found';
export type ScannerEngineName =
  | 'axe'
  | 'lighthouse'
  | 'pa11y'
  | 'ibm-equal-access'
  | 'heuristic-dom'
  | 'blocking-overlay';

export interface RawFinding {
  tool: FindingTool;
  ruleId: string;
  normalizedRuleId: string;
  category: FindingCategory;
  wcagCriterion?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  findingStatus?: FindingStatus;
  pageState?: PageState;
  description: string;
  selector: string;
  elementHtml: string;
  severity: SeverityEs;
  suggestedFix: string;
  elementFix?: string;
  // 'page': una corrección estructural única resuelve todos los elementos del grupo.
  fixScope?: 'page' | 'element';
  fixExample?: string;
}

export interface GroupedFinding {
  ruleId: string;
  normalizedRuleId: string;
  category: FindingCategory;
  wcagCriterion?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  findingStatus?: FindingStatus;
  pageState?: PageState;
  description: string;
  severity: SeverityEs;
  selectors: string[];
  elements: string[];
  tools: FindingTool[];
  suggestedFixes: string[];
}

export interface ScanOptions {
  viewport?: { width: number; height: number };
  preNavigationScript?: string;
  onProgress?: (progress: number) => Promise<void> | void;
}

export interface EngineRunSummary {
  engine: ScannerEngineName;
  pageState?: PageState;
  status: 'ok' | 'failed';
  durationMs: number;
  findingsCount: number;
  errorMessage?: string;
}

export interface EngineRunResult<T> {
  findings: T;
  report: EngineRunSummary[];
}

export type FocusTraversalStepStatus = 'ok' | 'warning' | 'error';

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
  status: FocusTraversalStepStatus;
  issue: string;
  suggestedFix: string;
}

export interface FocusTraversalReport {
  screenshotUrl: string | undefined;
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

export type SemanticStructureItemKind =
  | 'heading'
  | 'landmark'
  | 'form'
  | 'table'
  | 'iframe'
  | 'interactive';

export interface SemanticStructureItem {
  index: number;
  kind: SemanticStructureItemKind;
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

export interface OverlayCandidate {
  id: string;
  selector: string;
  html: string;
  text: string;
  kind: 'cookie' | 'terms' | 'age_gate' | 'announcement' | 'dialog' | 'overlay';
  blocksViewport: boolean;
  zIndex: number;
}
