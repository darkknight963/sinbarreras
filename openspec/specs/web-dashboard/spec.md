## ADDED Requirements

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
