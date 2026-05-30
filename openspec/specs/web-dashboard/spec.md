## Purpose
Define the web dashboard experience for monitoring accessibility projects, scan progress, manual review workflows, finding transparency, and role-based remediation views.

## Requirements

### Requirement: Dashboard Overview and Real-time Progress
The system SHALL provide a web dashboard displaying an aggregated accessibility score, compliance breakdown, and real-time scan progress via WebSockets.

#### Scenario: Viewing a running scan
- **WHEN** user initiates a large bulk scan
- **THEN** the dashboard connects via WebSockets to the NestJS API and updates a progress bar in real-time as workers process URLs

### Requirement: Semi-Automatic Evaluation UI
The system SHALL provide an interface for human auditors to manually pass or fail criteria that automated engines flagged as "Requires manual verification".

#### Scenario: Auditing sign language requirement
- **WHEN** the engine flags a video as needing sign language verification
- **THEN** a human auditor reviews the video in the dashboard, clicks "Approve", and the system updates the compliance score accordingly

### Requirement: Guided Manual Review with Context
The system SHALL provide explicit manual-review guidance for each alert/manual check.

#### Scenario: Auditor reviews manual finding
- **WHEN** a finding is categorized as "alert" or "manual_check"
- **THEN** the dashboard shows what to review, why it matters (WCAG + legal context), where to review (selector + HTML evidence), and expected decision format

### Requirement: Classification Transparency
The system SHALL display classification confidence and reason for every finding category decision.

#### Scenario: User validates finding reliability
- **WHEN** user opens finding details
- **THEN** the dashboard shows category, confidence level, and classification rationale

### Requirement: Error Filtering by Role
The system SHALL allow filtering identified errors by the responsible role (Desarrollador, Diseñador UX/UI, Redactor UX).

#### Scenario: Filtering errors for Developers
- **WHEN** user selects the "Desarrollador" filter
- **THEN** system shows only errors related to code implementation (e.g., missing ARIA, keyboard traps)

### Requirement: WCAG Criteria Table Header Filters
The system SHALL keep WCAG criteria table filters in the table header row so auditors can filter columns in a familiar Excel/Power BI-style layout without losing the column labels.

#### Scenario: Filtering WCAG criteria from the header
- **WHEN** user views the unified WCAG criteria and findings table
- **THEN** filter controls for level, applicability, result, severity, and responsible role appear inside the corresponding header cells
- **AND** the table does not render a separate filter-only row below the headers

### Requirement: WCAG Criteria Grouped View
The system SHALL provide a display mode for the WCAG criteria and findings table that preserves the normal criterion order by default and optionally groups criteria by ISO/IEC 40500 WCAG principle and guideline.

#### Scenario: Viewing criteria in normal order
- **WHEN** user opens the WCAG criteria and findings table
- **THEN** the default view shows criteria in their current normal order

#### Scenario: Viewing criteria grouped by principles and guidelines
- **WHEN** user selects the grouped-by-principles view
- **THEN** the table groups criteria under the WCAG principles Perceptible, Operable, Comprensible, and Robusto
- **AND** each principle group contains guideline subgroups such as 1.1 Alternativas textuales, 1.2 Medios temporales, 2.4 Navegable, 3.3 Asistencia en la entrada, and 4.1 Compatible
- **AND** criteria remain visible with the same data columns, filters, applicability editing, manual evaluation controls, and evidence expansion behavior

### Requirement: Consistent Action Button Spacing
The system SHALL apply consistent horizontal spacing to adjacent primary, green, and ghost action buttons without changing their established dimensions.

#### Scenario: Viewing adjacent dashboard actions
- **WHEN** multiple report action buttons are rendered next to each other
- **THEN** each button keeps its original size and has visual separation from neighboring action buttons
