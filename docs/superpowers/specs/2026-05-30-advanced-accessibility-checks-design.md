# Advanced Accessibility Checks Design

Date: 2026-05-30

## Objective

Add three advanced Playwright-based accessibility checks to the existing scanner:

- real keyboard navigation
- 400% zoom/reflow
- full Chrome accessibility tree validation

The checks must strengthen WCAG coverage without changing the user interface, database schema, or project data model. Their findings should be stored and reported as normal WCAG-related violations in the existing violation flow.

## User Constraints

- Do not add new user-facing fields.
- Do not change current UI flows.
- Do not duplicate Playwright page loading.
- Keep the current scanner behavior working if any advanced check fails.
- Make every advanced finding map to a WCAG criterion where defensible.
- Keep "Otros" only as a final fallback when no reliable WCAG mapping exists.

## Current Problem

Some findings can appear with criterion "Otros" because the scanner currently enriches violations using rule metadata first in some places, even when the raw finding already has a more precise WCAG criterion. That creates weak report data and makes manual review harder.

The fix should make the effective criterion resolution explicit:

1. use the finding's `wcagCriterion` when present
2. otherwise use the rule metadata criterion
3. otherwise use `Otros`

The same precedence should apply to WCAG level when available.

## Architecture

The advanced checks should run inside the worker scanner on the same Playwright `page` already used for the URL scan.

Recommended structure:

- keep the orchestration in `worker/src/scanner.ts`
- add a focused helper module for advanced checks if it keeps `scanner.ts` readable
- return normal raw findings from each advanced check
- let the existing grouping, enrichment, scoring, and persistence flow process those findings

The advanced checks should not persist raw summary objects such as `keyboardScore` or `reflowPassed`. Those can exist internally while calculating findings, but the saved output should remain the existing violations array.

## Keyboard Navigation Check

Run after the normal page analysis has loaded and stabilized.

Behavior:

- start from the beginning of the page focus order
- press `Tab` up to 50 times
- record the focused element identity and visible focus evidence internally
- detect focus traps when the same focus target repeats for 10 consecutive Tab presses
- detect interactive elements that are visible and enabled but never reached by Tab
- detect missing visible focus indicators
- approximate WCAG 2.4.11 by comparing focus indicator area against a 2px perimeter equivalent

Findings should be emitted as existing violation objects with rule IDs like:

- `keyboard-focus-trap`
- `keyboard-unreachable-control`
- `keyboard-focus-not-visible`
- `keyboard-focus-appearance-insufficient`

WCAG mapping:

- `keyboard-focus-trap`: WCAG 2.1.2
- `keyboard-unreachable-control`: WCAG 2.1.1 and, when ordering is the issue, WCAG 2.4.3
- `keyboard-focus-not-visible`: WCAG 2.4.7
- `keyboard-focus-appearance-insufficient`: WCAG 2.4.11

## Reflow 400% Check

Run on the same page after saving the original viewport.

Behavior:

- set viewport to `320x256`
- wait 1500 ms for responsive CSS to settle
- verify there is no horizontal document scroll
- detect visible text clipped by `overflow: hidden`
- detect visible controls that overlap other controls
- detect main content hidden at mobile size
- restore the original viewport in `finally`

Findings should be emitted as existing violation objects with rule IDs like:

- `reflow-horizontal-scroll`
- `reflow-text-clipped`
- `reflow-control-overlap`
- `reflow-main-content-hidden`

WCAG mapping:

- all reflow findings: WCAG 1.4.10

## Accessibility Tree Check

Use Playwright's CDP session for the current browser page:

- call `Accessibility.getFullAXTree`
- inspect meaningful AX nodes
- focus on interactive roles and media/semantic roles

Behavior:

- detect interactive roles without accessible names
- detect `img` roles without names
- detect `figure` roles without useful description
- detect names equal to placeholder text when available
- detect accessible names that are full URLs
- detect generic names such as `click here`, `read more`, `ver mas`, `aqui`, `link`, and `button`

Findings should be emitted as existing violation objects with rule IDs like:

- `ax-missing-accessible-name`
- `ax-non-descriptive-name`
- `ax-placeholder-as-name`
- `ax-url-as-name`
- `ax-image-missing-name`
- `ax-figure-missing-description`

WCAG mapping:

- missing accessible name on controls: WCAG 4.1.2
- image missing name: WCAG 1.1.1
- non-descriptive name: WCAG 2.4.6
- placeholder used as accessible name: WCAG 4.1.2
- URL used as accessible name: WCAG 2.4.6
- figure without useful description: WCAG 1.1.1

## Error Handling

Each advanced check should run behind its own try/catch wrapper.

If one check fails:

- log a concise warning
- return no findings for that check
- continue with the remaining checks
- do not fail the whole scan unless the existing scanner would already fail

The reflow check must restore the viewport even when assertions or DOM evaluation fail.

## Reporting

The existing report should include a section named `Analisis Avanzado`.

This section should be derived from existing violations, filtered by `detectedBy` or equivalent tool IDs:

- `keyboard-navigation`
- `reflow`
- `accessibility-tree`

The section should group or list the same persisted violations; it should not require new persisted fields.

If the PDF and spreadsheet reports have separate report builders, both should use the same advanced-tool filter so the report output remains consistent.

## Criterion Mapping Fix

The scanner enrichment step should compute an effective criterion and level once per finding:

```ts
const effectiveCriterion = finding.wcagCriterion || ruleDetails.criterion || 'Otros';
const effectiveLevel = finding.wcagLevel || ruleDetails.level || 'A';
```

Then all saved/displayed fields should use `effectiveCriterion` and `effectiveLevel`, including:

- `criterion`
- `wcagCriterion`
- classification text
- manual guidance
- Peruvian resolution mapping when the criterion is not `Otros`

`worker/src/wcagRules.ts` should include explicit mappings for the new advanced rule IDs and any known heuristic IDs currently falling through to `Otros`.

## Risks and Tradeoffs

- WCAG 2.4.11 focus appearance can only be approximated from computed CSS and element geometry. It is useful as an automated signal, but manual review may still be needed.
- Keyboard testing can produce false positives on custom widgets or pages that intentionally manage focus. The check should prefer concrete evidence and conservative messages.
- Reflow overlap detection can be noisy if every visible element is compared with every other element. Limit checks to visible text, buttons, inputs, links, selects, textareas, and main landmarks.
- AX tree data may include ignored or structural nodes. Filter ignored nodes and inspect roles that map to meaningful user-facing controls or media.
- The scan will take slightly longer. Keep hard limits on Tab count, DOM candidates, and overlap comparisons.

## Verification Plan

- Run `npm run build` in `worker`.
- Run `npm run build` in `api` if report or DTO code changes.
- Run frontend tests/build only if UI or frontend types are touched.
- Run a real scan against a local or reachable test page.
- Verify the saved URL result contains advanced findings as normal violations.
- Verify the total violation count includes advanced findings.
- Verify no advanced finding with a known rule ID appears as `Otros`.
- Generate or inspect the report output and confirm `Analisis Avanzado` appears.

## Non-Goals

- No database migration.
- No new dashboard fields.
- No change to the user's project list UI.
- No separate browser/page load for these checks.
- No invented WCAG criterion when the evidence is not strong enough.
