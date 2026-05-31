export type SeverityEs = 'critico' | 'alto' | 'medio' | 'bajo';
export type FindingCategory = 'violation' | 'alert' | 'manual_check';
export type FindingTool = 'axe' | 'lighthouse' | 'pa11y' | 'ibm-equal-access' | 'heuristic-dom';
export type FindingStatus = 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
export type PageState = 'initial' | 'post_overlay';
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
