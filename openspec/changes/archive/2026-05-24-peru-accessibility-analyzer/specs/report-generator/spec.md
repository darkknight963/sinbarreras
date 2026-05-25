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
