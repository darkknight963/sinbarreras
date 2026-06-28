import type { Page } from 'playwright';
import { uploadEvidence } from './storage.js';
import type { PageState, RawFinding } from './scanner-models.js';
import { labelPageState, normalizeRuleId } from './scanner-utils.js';

declare const document: any;
declare const window: any;

type VisualMarkerStatus = 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';

export interface VisualFindingMarker {
  id: string;
  ruleId: string;
  normalizedRuleId: string;
  criterion: string;
  selector: string;
  description: string;
  severity: string;
  status: VisualMarkerStatus;
  statusLabel: string;
  pageState: PageState;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualEvidenceState {
  pageState: PageState;
  pageStateLabel: string;
  screenshotUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  pageSize: {
    width: number;
    height: number;
  };
  markers: VisualFindingMarker[];
}

const statusLabel = (status: VisualMarkerStatus) => {
  if (status === 'confirmed') return 'Falla confirmada';
  if (status === 'not_applicable') return 'Confirmado cumple';
  if (status === 'not_evaluated') return 'No evaluado';
  return 'Requiere revisión';
};

const markerStatus = (finding: RawFinding): VisualMarkerStatus =>
  finding.findingStatus || (finding.category === 'violation' ? 'confirmed' : 'needs_review');

export async function captureVisualEvidence(
  page: Page,
  findings: RawFinding[],
  pageState: PageState,
): Promise<VisualEvidenceState | null> {
  const stateFindings = (findings || []).filter((finding) => {
    if (!finding.selector || finding.selector === 'document' || finding.selector === 'body') return false;
    return !finding.pageState || finding.pageState === pageState;
  });

  if (stateFindings.length === 0) return null;

  const markerInputs = stateFindings
    .flatMap((finding: RawFinding & { affectedElements?: string[]; criterion?: string; status?: VisualMarkerStatus }, findingIndex) => {
      const selectors = [
        finding.selector,
        ...(Array.isArray(finding.affectedElements) ? finding.affectedElements : []),
      ]
        .filter((selector) => selector && selector !== 'document' && selector !== 'body')
        .filter((selector, index, all) => all.indexOf(selector) === index)
        .slice(0, 25);

      return selectors.map((selector, selectorIndex) => ({
        index: `${findingIndex}-${selectorIndex}`,
        ruleId: finding.ruleId,
        normalizedRuleId: finding.normalizedRuleId || normalizeRuleId(finding.ruleId, finding.description),
        criterion: finding.wcagCriterion || finding.criterion || 'Otros',
        selector,
        description: finding.description,
        severity: finding.severity,
        status: finding.status || markerStatus(finding),
      }));
    })
    .slice(0, 80);

  const geometry = await page.evaluate((items) => {
    const isVisible = (el: any) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    };

    const pageSize = {
      width: Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth || 0,
        window.innerWidth,
      ),
      height: Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
        window.innerHeight,
      ),
    };

    const markers = [];
    const seen = new Set<string>();

    for (const item of items as Array<{
      index: string;
      ruleId: string;
      normalizedRuleId: string;
      criterion: string;
      selector: string;
      description: string;
      severity: string;
      status: VisualMarkerStatus;
    }>) {
      let el: any = null;
      try {
        el = document.querySelector(item.selector);
      } catch {
        el = null;
      }
      if (!el || !isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      const x = Math.max(0, rect.left + window.scrollX);
      const y = Math.max(0, rect.top + window.scrollY);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const key = `${item.normalizedRuleId}::${item.selector}::${Math.round(x)}::${Math.round(y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      markers.push({
        id: `${item.normalizedRuleId}-${item.index}`,
        ...item,
        x,
        y,
        width,
        height,
      });
    }

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      pageSize,
      markers,
    };
  }, markerInputs);

  if (!geometry.markers.length) return null;

  const buffer = await page.screenshot({
    fullPage: true,
    timeout: 15000,
    mask: [
      page.locator('input'),
      page.locator('textarea'),
      page.locator('[contenteditable="true"]'),
    ],
    maskColor: '#E2E8F0',
  }).catch(() => page.screenshot({ fullPage: false, timeout: 10000 }));
  const screenshotUrl = await uploadEvidence(`visual-map-${pageState}-${Date.now()}.png`, buffer, 'image/png');

  return {
    pageState,
    pageStateLabel: labelPageState(pageState),
    screenshotUrl,
    viewport: geometry.viewport,
    pageSize: geometry.pageSize,
    markers: geometry.markers.map((marker) => ({
      ...marker,
      pageState,
      statusLabel: statusLabel(marker.status),
    })),
  };
}
