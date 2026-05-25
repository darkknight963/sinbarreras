## ADDED Requirements

### Requirement: WCAG 2.2 Core Scanning via Worker
The system SHALL scan single or multiple URLs using isolated Worker containers to verify the 83 criteria of WCAG 2.2 using headless browsers.

#### Scenario: Single URL scanning in worker
- **WHEN** user initiates a scan
- **THEN** the API queues the job in Redis, a Worker picks it up, renders the page, executes axe-core, and saves evidence to MinIO

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
