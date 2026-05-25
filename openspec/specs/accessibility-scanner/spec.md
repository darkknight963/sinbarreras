## ADDED Requirements

### Requirement: WCAG 2.2 Core Scanning via Worker
The system SHALL scan single or multiple URLs using isolated Worker containers to verify the 83 criteria of WCAG 2.2 using headless browsers.

#### Scenario: Single URL scanning in worker
- **WHEN** user initiates a scan
- **THEN** the API queues the job in Redis, a Worker picks it up, renders the page, executes axe-core, and saves evidence to MinIO

### Requirement: Maximum Automatic Coverage Across Engines
The system SHALL execute all supported automatic engines in the same scan job and preserve each raw finding before normalization.

#### Scenario: Multi-engine automatic scan
- **WHEN** a URL scan starts
- **THEN** the worker runs axe, Lighthouse, IBM Equal Access, and Pa11y on the same page instance and stores raw findings from all engines

### Requirement: Normalization and Deduplication by Rule + Selector
The system SHALL normalize findings to a common schema and deduplicate by normalized rule identifier and resolved selector.

#### Scenario: Same issue reported by multiple tools
- **WHEN** different engines report the same root issue for the same selector
- **THEN** the system stores one canonical finding with tool traceability and affected-element aggregation

### Requirement: Strict Violation Classification (Zero False Positives)
The system SHALL classify a finding as "violation" only when deterministic rule conditions and minimum evidence are present.

#### Scenario: Insufficient evidence for automatic violation
- **WHEN** a finding lacks reliable selector/HTML/WCAG mapping/tool traceability
- **THEN** the system downgrades it to "alert" or "manual_check" instead of reporting a false automatic violation

### Requirement: Coverage Metrics per Scan
The system SHALL generate an automatic coverage report for each scan.

#### Scenario: Measuring scanner completeness
- **WHEN** scan processing finishes
- **THEN** the system returns a coverage report containing tools used, raw findings, unique rules, and automatic coverage score

### Requirement: Authenticated Site Scanning (Pre-Navigation)
The system SHALL support the execution of user-defined interaction scripts prior to the accessibility scan to handle logins or navigation.

#### Scenario: Scanning an intranet portal
- **WHEN** user configures a pre-navigation script (e.g., fill username, fill password, click login)
- **THEN** Playwright executes the script successfully before initiating the axe-core evaluation

### Requirement: Evidence Object Storage
The system SHALL store heavy assets (screenshots and HTML dumps) in an object storage service (MinIO) instead of the relational database.

#### Scenario: Saving error evidence
- **WHEN** an accessibility violation is found
- **THEN** the worker takes a screenshot, uploads it to MinIO, and saves the resulting URL to the database
