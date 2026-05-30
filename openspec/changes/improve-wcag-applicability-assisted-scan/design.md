## Context

The scanner already combines multiple engines and stores normalized findings, but observed scan output shows that known axe/htmlcs rules can still fall back to `Otros`, suggested fixes can expose raw rule IDs, and the dashboard currently labels severity values as `Nivel`. The project also needs to account for WCAG applicability: some criteria depend on whether a page actually contains relevant content, while coverage warnings such as untested iframes are not confirmed accessibility failures.

The scan flow also needs a practical pre-scan aid for auditors. Opening the target site in the user's browser is useful for inspecting terms dialogs, modals, login gates, iframes, and cookie banners. It must be presented as inspection only because the Playwright worker runs in an isolated browser context and will not inherit user clicks or cookies from that tab.

## Goals / Non-Goals

**Goals:**

- Resolve known axe/htmlcs/heuristic findings to effective WCAG criteria, WCAG levels, legal references, roles, and actionable remediation guidance.
- Separate evidence status from severity using statuses such as confirmed, needs review, not evaluated, and not applicable.
- Keep coverage-only findings out of confirmed violation counts and scoring.
- Present WCAG level and severity as separate concepts in dashboard and reports.
- Add an assisted `Abrir URL` action in the scan flow so auditors can inspect the target site before launching analysis.
- Improve common overlay handling in the worker while preserving honest `needs_review` results when content remains blocked.

**Non-Goals:**

- No browser session synchronization between the user's opened tab and the Playwright worker.
- No automatic credential capture or bypass of authentication, captcha, or legal consent.
- No forced WCAG criterion for findings that only represent coverage gaps.
- No database migration unless the current JSON violation payload cannot carry the new metadata.

## Decisions

### Finding Status Is Stored With Each Finding

Each normalized finding will carry a status field representing evidence strength: `confirmed`, `needs_review`, `not_evaluated`, or `not_applicable`. This keeps scoring and reporting honest without losing useful audit context.

Alternative considered: keep only the existing `sourceCategory`. That is not enough because `alert` and `manual_check` do not distinguish conditional applicability from incomplete scan coverage.

### Effective WCAG Mapping Uses Rule Metadata Plus Finding Overrides

The enrichment layer will resolve criterion and level using finding-provided values first, then rule metadata, then a final fallback. Known axe/htmlcs rules from observed output will be added to rule metadata with criterion, level, role, suggested fix, legal reference behavior, and default status.

Alternative considered: map every `Otros` to the nearest WCAG criterion. This was rejected because rules such as `frame-tested` indicate untested iframe content, not a confirmed WCAG failure.

### Reports Derive Legal Reference From Effective Criterion

When an effective criterion exists, legal reference will render as `Anexo 1 - Criterio X.X.X`. When no direct criterion is appropriate, the report will show a review-oriented reference such as `Resolucion N 001-2025-PCM/SGTD - Revision manual`.

Alternative considered: keep the generic resolution text everywhere. This hides the link between technical finding and legal obligation.

### Assisted URL Opening Is Explicitly Inspection Only

The dashboard will open entered URLs in a new tab but state that this does not transfer browser state to Playwright. The worker remains responsible for automated overlay handling and pre-navigation scripts.

Alternative considered: attempt to reuse user browser cookies. This is out of scope and would create security, privacy, and reliability risks.

## Risks / Trade-offs

- Conditional rules may be classified too strictly or too leniently -> add fixtures for known rule IDs and keep status visible to auditors.
- Existing historical scans will not automatically change unless reprocessed -> communicate that mapping improvements apply to new scans or regenerated normalized data.
- Adding status columns may make the table wider -> keep labels concise and preserve existing filters initially.
- Overlay handling can accidentally click unsafe controls -> restrict selectors to common consent/close actions and never bypass login, captcha, or payment/legal workflows.
- Some reports may depend on current field names -> add new metadata while keeping current fields compatible where possible.

## Migration Plan

1. Add rule metadata and enrichment logic while preserving existing violation JSON fields.
2. Update dashboard rendering to show `Nivel WCAG`, `Severidad`, and `Estado`.
3. Update report generation to group confirmed findings separately from review and coverage findings.
4. Add the assisted URL opening action to the new scan modal.
5. Rebuild worker/API/frontend as needed and verify with a new scan.
6. Roll back by reverting the change; existing scans remain readable because the JSON shape is extended, not replaced.
