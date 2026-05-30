# WCAG Applicability and Assisted Scan Design

Date: 2026-05-30

## Objective

Improve scan results so the system distinguishes confirmed WCAG violations from findings that require context, are not applicable, or represent incomplete coverage. Also add an assisted pre-scan flow that lets the auditor open the target site in a browser tab to inspect modals, terms, cookie banners, login gates, iframes, or other blockers before launching the automated scan.

## User Constraints

- Do not force every rule into a WCAG criterion when the criterion is not applicable.
- Do not count non-applicable or unevaluated checks as confirmed violations.
- Keep WCAG and Peruvian legal mapping precise when a criterion is known.
- Make the report easier to understand by separating WCAG level from severity.
- Opening the site in another tab must not imply that user clicks or cookies are automatically transferred to the worker scan.

## Core Principle

The scanner should classify each finding by evidence strength:

- `confirmed`: automated evidence supports a WCAG failure
- `needs_review`: the finding needs human judgment or page context
- `not_evaluated`: the scanner could not evaluate a relevant area, such as iframe content
- `not_applicable`: the criterion does not apply to this page or content

Only `confirmed` findings should be treated as confirmed violations. `needs_review` and `not_evaluated` should appear in the report, but they should not be mixed with confirmed violations without labeling.

## Current Problems

The current report output shows several issues:

- many known rules fall back to `Otros`
- the `Nivel` column shows severity such as `alto` or `medio` instead of WCAG level `A`, `AA`, or `AAA`
- suggested fixes often show technical fallbacks such as `Revisar regla axe:region`
- the legal article often falls back to `Resolucion N 001-2025-PCM/SGTD` instead of `Anexo 1 - Criterio X.X.X`
- coverage warnings such as `frame-tested` appear like WCAG violations even though they mean the iframe needs separate review

## Rule Applicability Model

Add rule metadata that can describe:

- WCAG criterion
- WCAG level
- severity
- responsible role
- result status
- suggested fix
- legal reference
- whether the rule is conditional or coverage-related

Examples:

- `axe:color-contrast`: confirmed, WCAG 1.4.3, level AA
- `axe:aria-dialog-name`: confirmed, WCAG 4.1.2, level A
- `axe:scrollable-region-focusable`: confirmed, WCAG 2.1.1, level A
- `axe:region`: needs_review or confirmed depending on context, WCAG 1.3.1, level A
- `axe:frame-tested`: not_evaluated, no direct WCAG failure
- `htmlcs ... table caption`: needs_review unless the table is known to be a data table
- `required-html5-attribute`: needs_review because `required` alone is not always a WCAG failure

## Report Presentation

The table should separate these concepts:

- `Criterio`: WCAG criterion, such as `1.4.3`, or `Revision manual` when no direct criterion is appropriate
- `Nivel WCAG`: `A`, `AA`, `AAA`, or `N/A`
- `Severidad`: `critico`, `alto`, `medio`, or `bajo`
- `Estado`: `Confirmado`, `Requiere revision`, `No evaluado`, or `No aplicable`
- `Descripcion`
- `Selector CSS`
- `Rol`
- `Solucion sugerida`
- `Articulo legal`
- `Evidencia`

Existing filters can keep working, but the severity filter should operate on severity only. A later enhancement can add an `Estado` filter.

## Suggested Fixes

Replace generic rule text with actionable guidance.

Examples:

- `axe:aria-dialog-name`: add an accessible name to the dialog with valid `aria-labelledby` or descriptive `aria-label`
- `axe:region`: place relevant content inside semantic landmarks such as `main`, `nav`, `header`, and `footer`
- `axe:scrollable-region-focusable`: make the scrollable container focusable with `tabindex="0"` and ensure keyboard access
- `axe:color-contrast`: adjust foreground/background colors to meet WCAG AA contrast thresholds
- `axe:frame-tested`: scan the iframe URL directly or manually review embedded content

## Legal Mapping

When a finding has an effective WCAG criterion, legal reference should be derived from it:

```text
Anexo 1 - Criterio X.X.X
```

Use the general resolution reference only when there is no direct criterion:

```text
Resolucion N 001-2025-PCM/SGTD - Revision manual
```

## Assisted Pre-Scan Flow

Add a lightweight user flow before scan launch:

- show an `Abrir URL` action next to each URL in the new scan modal
- open the target URL in a new browser tab
- explain that this helps the auditor inspect modals, login gates, terms, cookies, and blockers
- clearly state that actions in the user's browser are not automatically transferred to Playwright

This is an inspection aid, not session sharing.

## Worker Overlay Handling

Keep and improve the worker's existing overlay handling:

- attempt to close common cookie banners, terms dialogs, and blocking modals
- use conservative selectors and visible text such as `Aceptar`, `Acepto`, `Cerrar`, `Continuar`, `Entendido`
- do not bypass authentication, captcha, or legal consent in unsafe ways
- if a blocking modal remains, create a `needs_review` finding instead of assuming all content was fully evaluated

## Non-Goals

- No browser session synchronization between the user's tab and Playwright.
- No automatic credential capture.
- No forced WCAG criterion for coverage-only findings.
- No database migration unless existing JSON violation fields cannot support the status metadata.
- No removal of manual verification; this improves when manual verification is needed.

## Verification Plan

- Add tests or fixtures for rule metadata resolution.
- Verify `Nivel WCAG` shows `A`, `AA`, or `AAA`, not severity.
- Verify `Severidad` still shows `alto`, `medio`, etc.
- Verify known rules no longer fall back to `Otros`.
- Verify `frame-tested` is shown as `No evaluado` or `Revision manual`, not a confirmed WCAG violation.
- Run worker build.
- Run frontend test/build if the report table or scan modal changes.
- Run one real scan and compare that confirmed violations, review items, and coverage warnings are separated.
