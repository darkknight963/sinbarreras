## 1. Rule Metadata and Normalization

- [x] 1.1 Add rule metadata for observed axe, htmlcs, and heuristic rule IDs, including effective WCAG criterion, level, default status, role, legal reference behavior, and actionable fix text.
- [x] 1.2 Update scanner enrichment to prefer finding-provided WCAG data, then rule metadata, then fallback values.
- [x] 1.3 Add finding status metadata for `confirmed`, `needs_review`, `not_evaluated`, and `not_applicable`.
- [x] 1.4 Ensure coverage-only rules such as `frame-tested` are not counted as confirmed WCAG violations.

## 2. Worker Scan Behavior

- [x] 2.1 Improve common overlay handling for consent, terms, and close actions using conservative selectors and visible text.
- [x] 2.2 Add a `needs_review` finding when a blocking modal or gate remains after conservative overlay handling.
- [x] 2.3 Verify scoring uses confirmed violations only and preserves review/coverage findings for reports.

## 3. Dashboard Presentation

- [x] 3.1 Update the finding table to show `Nivel WCAG`, `Severidad`, and `Estado` as separate columns.
- [x] 3.2 Update severity filtering so it only filters severity values.
- [x] 3.3 Add `Abrir URL` actions in the new scan modal for entered URLs.
- [x] 3.4 Add concise copy explaining that the opened browser tab is for inspection and does not transfer state to Playwright.

## 4. Report Generation

- [x] 4.1 Update PDF and Excel exports to separate confirmed violations from review, not-evaluated, and not-applicable findings.
- [x] 4.2 Render legal references from the effective WCAG criterion when available.
- [x] 4.3 Render review-oriented legal references for findings without direct WCAG criteria.

## 5. Verification

- [x] 5.1 Add or update tests/fixtures for known rule mapping from the observed scan output.
- [x] 5.2 Run worker build.
- [x] 5.3 Run API build if report generation or DTO logic changes.
- [x] 5.4 Run frontend tests/build if dashboard code changes.
- [x] 5.5 Run a real scan and verify known rules no longer fall back to `Otros`, WCAG level is not severity, and `frame-tested` is not a confirmed violation.
