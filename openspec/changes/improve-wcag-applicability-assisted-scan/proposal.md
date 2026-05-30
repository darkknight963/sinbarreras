## Why

Current scan results detect real accessibility issues, but known rules from axe/htmlcs can fall back to `Otros`, WCAG level is displayed as severity, and coverage or context-dependent checks can appear as confirmed violations. This weakens the comparison with external tools and can overstate issues for criteria that do not apply to every site or page.

Auditors also need a lightweight way to inspect target pages before scanning because many sites show terms, cookie banners, login gates, modals, iframes, or other blockers that affect what automated tools can evaluate.

## What Changes

- Normalize known axe/htmlcs/heuristic rules to effective WCAG criteria, levels, legal references, roles, and actionable suggested fixes when the mapping is defensible.
- Add an applicability/status model for findings: confirmed, requires review, not evaluated, or not applicable.
- Keep coverage-only findings, such as untested iframe contents, out of confirmed violation counts.
- Separate WCAG level from severity in dashboard and reports.
- Add an assisted pre-scan action that opens entered URLs in a new browser tab for auditor inspection.
- Improve worker overlay handling for common modals and terms dialogs while preserving honest reporting when content remains blocked.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accessibility-scanner`: Normalize findings with applicability status, effective WCAG mapping, concrete suggested fixes, and honest treatment of coverage or context-dependent checks.
- `report-generator`: Export confirmed violations separately from review, non-applicable, and not-evaluated findings, with precise legal references.
- `web-dashboard`: Display WCAG level, severity, finding status, and assisted URL opening in the scan workflow.

## Impact

- Worker scanner normalization, rule metadata, scoring, overlay handling, and evidence classification.
- Existing JSON violation payloads saved in URL results.
- Dashboard table columns, labels, filters, and new-scan modal actions.
- PDF/Excel report grouping and legal reference rendering.
- Tests or fixtures for mapping known axe/htmlcs rules from the observed scan results.
