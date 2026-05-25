## ADDED Requirements

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
