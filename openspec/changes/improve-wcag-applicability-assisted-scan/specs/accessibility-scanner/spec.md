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
