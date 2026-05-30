## ADDED Requirements

### Requirement: Finding Table Status and Level Clarity
The dashboard SHALL display WCAG level, severity, and finding status as separate concepts in the violations table.

#### Scenario: Viewing a WCAG AA contrast finding
- **WHEN** the user views a `1.4.3` finding with severity `alto`
- **THEN** the table shows WCAG level `AA`, severity `alto`, and status `Confirmado`

#### Scenario: Viewing an unevaluated iframe finding
- **WHEN** the user views a `frame-tested` finding
- **THEN** the table identifies it as `No evaluado` or equivalent review status instead of a confirmed violation

### Requirement: Assisted URL Inspection Before Scan
The dashboard SHALL let the auditor open entered scan URLs in a new browser tab before launching the scan.

#### Scenario: Opening a URL from new scan modal
- **WHEN** the user enters a valid URL in the new scan modal and clicks `Abrir URL`
- **THEN** the dashboard opens that URL in a new tab for inspection

#### Scenario: Communicating browser isolation
- **WHEN** the new scan modal offers the `Abrir URL` action
- **THEN** the dashboard informs the user that actions in that browser tab are not automatically transferred to the Playwright worker scan

### Requirement: Severity Filtering Uses Severity Only
The dashboard SHALL use the severity filter only for severity values and not for WCAG level.

#### Scenario: Filtering high severity findings
- **WHEN** the user selects severity `alto`
- **THEN** the table filters by severity `alto` without treating `alto` as the WCAG level
