## ADDED Requirements

### Requirement: Report Finding Status Separation
The report generator SHALL separate confirmed violations from findings that require review, are not evaluated, or are not applicable.

#### Scenario: Technical report includes mixed finding statuses
- **WHEN** a scan contains `confirmed`, `needs_review`, and `not_evaluated` findings
- **THEN** the generated report groups or labels them distinctly and only confirmed findings are presented as confirmed violations

### Requirement: Effective Legal Reference Rendering
The report generator SHALL render legal references from the effective WCAG criterion when one exists.

#### Scenario: Known criterion is available
- **WHEN** a finding has effective criterion `1.4.3`
- **THEN** the report shows `Anexo 1 - Criterio 1.4.3`

#### Scenario: No direct WCAG criterion is appropriate
- **WHEN** a finding is coverage-only or requires manual review without a direct criterion
- **THEN** the report shows a review-oriented legal reference instead of inventing a WCAG criterion

### Requirement: WCAG Level and Severity Separation in Exports
The report generator SHALL export WCAG level separately from severity.

#### Scenario: Contrast failure export
- **WHEN** a finding is WCAG `1.4.3` with severity `alto`
- **THEN** exported reports show WCAG level `AA` and severity `alto` in separate fields
