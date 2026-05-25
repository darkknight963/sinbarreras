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
  nameEs: string;
  level: 'A' | 'AA' | 'AAA';
  disability: string[];
  role: 'Desarrollador' | 'Diseñador UX/UI' | 'Redactor UX' | 'Compartido';
  severity: 'crítico' | 'alto' | 'medio' | 'bajo';
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

export interface UrlResult {
  id: string;
  url: string;
  score: number;
  violations: Violation[];
  manualVerifications: ManualVerification[];
  status: 'completed' | 'failed' | 'scanning';
  createdAt: string;
  scan?: Scan;
}
