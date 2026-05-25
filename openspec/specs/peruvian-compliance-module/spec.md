## ADDED Requirements

### Requirement: Prioritization Value (Vp) Calculation and Bulk Upload
The system SHALL automatically calculate the Valor de Priorización (Vp = Vo × Ux) and support bulk uploads (CSV) of Vo (Volumen de visitas) metrics.

#### Scenario: Calculating Vp for thousands of URLs
- **WHEN** user uploads a CSV containing URLs and their corresponding Vo scores
- **THEN** system calculates Vp automatically for all scans matching those URLs without requiring manual input per scan

### Requirement: Peruvian Normative Checks
The system SHALL check for specific requirements outlined in Resolución N° 001-2025-PCM/SGTD, such as Peruvian Sign Language and native languages.

#### Scenario: Checking multimedia for sign language
- **WHEN** the system detects a `<video>` element on the page
- **THEN** it flags the element to verify the presence of an interpreter in Lengua de Señas Peruana (criterion 1.2.6)

### Requirement: Public Administration Domain Detection
The system SHALL automatically detect if the analyzed URL belongs to a Peruvian public administration entity.

#### Scenario: Analyzing a .gob.pe domain
- **WHEN** the target URL ends with `.gob.pe`
- **THEN** the system strictly enforces the mandatory public administration criteria and assesses eligibility for the Sello de Accesibilidad Digital

### Requirement: Normative Scoring Uses Verified Automatic Violations
The system SHALL compute compliance score using only findings classified as verified automatic violations.

#### Scenario: Mixed automatic and manual findings
- **WHEN** scan returns violations, alerts, and manual checks
- **THEN** only `violation` findings affect score, while `alert/manual_check` are shown as guided review workload

### Requirement: Traceable Compliance Decisions
The system SHALL preserve tool and evidence traceability for each compliance-related finding.

#### Scenario: Auditing legal defensibility
- **WHEN** a finding is reviewed for compliance decisions
- **THEN** the system provides normalized rule ID, source tool(s), selector, HTML evidence, and legal/WCAG reference
