## Purpose
Define the report generation capabilities for exporting accessibility findings, compliance summaries, evidence, manual-review guidance, and coverage metrics in stakeholder-ready formats.

## Requirements

### Requirement: Multi-format Export
The system SHALL generate and export analysis reports in PDF, Excel, JSON, and HTML formats.

#### Scenario: Exporting Technical PDF
- **WHEN** user requests a Technical PDF report
- **THEN** system generates a PDF containing error details, original HTML snippets, suggested corrections, and screenshots of affected elements

#### Scenario: Exporting Excel Report
- **WHEN** user requests an Excel export
- **THEN** system generates an XLSX file with multiple sheets segregating errors by role (Developer, Designer, Content Creator) and normative checklist

### Requirement: Executive Summary Generation
The system SHALL produce an executive PDF report tailored for high-level management, summarizing legal compliance and critical issues.

#### Scenario: Exporting Executive PDF
- **WHEN** user requests an Executive PDF report
- **THEN** system generates a report highlighting the global score, Vp metric, Sello de Accesibilidad eligibility, and a roadmap for critical fixes

### Requirement: Stakeholder-ready PDF Layouts
The system SHALL generate visually structured executive and technical PDFs with a cover page, scan metadata, score summary, legal context, pagination, and clearly separated sections for decision-making and remediation.

#### Scenario: Exporting enhanced Executive PDF
- **WHEN** user requests an Executive PDF report
- **THEN** system generates a management-oriented PDF with cover, score badge, project metadata, global metrics, executive verdict, WCAG applicability summary, findings by severity, responsible-role summary, recommended remediation plan, and highest-risk pages

#### Scenario: Exporting enhanced Technical PDF
- **WHEN** user requests a Technical PDF report
- **THEN** system generates an auditor/developer-oriented PDF with cover, scope, per-page summary, and a prioritized remediation matrix
- **AND** each remediation item includes criterion, level, severity, finding status, responsible role, evaluated view, selector, suggested action, and legal reference
- **AND** findings are ordered by remediation priority using severity and confirmation status

### Requirement: Finding Category Separation in Reports
The system SHALL clearly separate automatic violations from alerts and manual checks in all exported reports.

#### Scenario: Reading a technical report
- **WHEN** report is generated
- **THEN** findings are grouped by category (`violation`, `alert`, `manual_check`) and only automatic violations impact compliance scoring

### Requirement: Manual Guidance Export
The system SHALL include manual-review guidance for non-automatic findings in technical outputs.

#### Scenario: Exporting technical evidence for auditor team
- **WHEN** user exports technical report
- **THEN** each alert/manual check includes guidance fields: what to review, why, where, and expected decision

### Requirement: Coverage Summary Export
The system SHALL include automatic-coverage metrics in technical exports.

#### Scenario: Validating scan completeness
- **WHEN** user exports technical report
- **THEN** report includes tools used, raw findings count, unique normalized rules, and automatic coverage score
