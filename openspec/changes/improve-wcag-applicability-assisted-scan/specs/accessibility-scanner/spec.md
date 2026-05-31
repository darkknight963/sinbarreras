## ADDED Requirements

### Requirement: Effective WCAG Rule Mapping
The scanner SHALL resolve each finding to an effective WCAG criterion and WCAG level when the source rule or finding provides a defensible mapping.

#### Scenario: Known axe rule is normalized
- **WHEN** a source finding has rule `axe:aria-dialog-name`
- **THEN** the normalized finding uses WCAG criterion `4.1.2`, level `A`, role `Desarrollador`, and legal reference `Anexo 1 - Criterio 4.1.2`

#### Scenario: Finding-provided WCAG value takes precedence
- **WHEN** a finding includes a specific `wcagCriterion`
- **THEN** the scanner uses that criterion before falling back to rule metadata or `Otros`

### Requirement: Finding Applicability Status
The scanner SHALL assign each normalized finding an applicability status of `confirmed`, `needs_review`, `not_evaluated`, or `not_applicable`.

#### Scenario: Confirmed automatic violation
- **WHEN** a deterministic rule such as `axe:color-contrast` reports a failing element with evidence
- **THEN** the finding status is `confirmed` and it can impact violation counts and scoring

#### Scenario: Coverage-only iframe finding
- **WHEN** a source finding has rule `axe:frame-tested`
- **THEN** the finding status is `not_evaluated` and it is not counted as a confirmed WCAG violation

#### Scenario: Conditional applicability finding
- **WHEN** a finding depends on page context, such as whether a table is a data table
- **THEN** the finding status is `needs_review` unless the scanner has enough evidence to confirm a violation

### Requirement: Actionable Suggested Fixes
The scanner SHALL replace generic rule fallbacks with actionable suggested fixes for known rule IDs.

#### Scenario: Raw rule fallback is received
- **WHEN** a source finding suggested fix is only `Revisar regla axe:region`
- **THEN** the normalized finding provides concrete remediation guidance for semantic landmarks

### Requirement: Assisted Overlay Handling
The scanner SHALL attempt conservative handling of common blocking overlays before running accessibility checks.

#### Scenario: Common consent dialog appears
- **WHEN** the rendered page contains visible controls such as `Aceptar`, `Acepto`, `Cerrar`, `Continuar`, or `Entendido`
- **THEN** the worker may click the matching control before analysis and continue scanning

#### Scenario: Blocking content remains
- **WHEN** the page remains blocked by a modal, login gate, captcha, or terms flow after conservative handling
- **THEN** the scanner records a `needs_review` finding instead of assuming the full page was evaluated

### Requirement: Private Evidence Access
The system SHALL keep stored evidence private and expose it only through controlled application access.

#### Scenario: Evidence is requested from the UI
- **WHEN** a user opens a report that references screenshots or HTML evidence
- **THEN** the application serves the evidence through authenticated application logic or equivalent controlled access, not as a public bucket object

### Requirement: Versioned Scan Traceability
The system SHALL persist the normative and rule-set versions used for each scan so reports remain historically traceable.

#### Scenario: Historical analysis is opened
- **WHEN** a previously completed scan is viewed or exported
- **THEN** the stored scan metadata includes the WCAG version, normative version, and rule-set version used for that analysis

### Requirement: Structured Engine Failure Reporting
The system SHALL record structured failure information when an individual accessibility engine fails without aborting the full scan.

#### Scenario: One engine throws during analysis
- **WHEN** a browser-based engine fails with an exception
- **THEN** the scan result includes the engine status and error details, and the remaining engines can still complete the scan

### Requirement: Controlled Engine Concurrency
The system SHALL avoid concurrent access to the same page instance by multiple engines during a single scan.

#### Scenario: Multiple engines run on the same URL
- **WHEN** the worker executes engine checks for one page
- **THEN** page access is serialized or otherwise constrained so engines do not race for the same browser context

### Requirement: Scan Admission Guardrails
The system SHALL validate and rate-limit scan submissions before they are enqueued for processing.

#### Scenario: Public scan submission is received
- **WHEN** an unauthenticated or repeated scan request is submitted
- **THEN** the API validates the target URL, rejects unsupported inputs, and applies request limits before queueing the job
