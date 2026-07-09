import type { Project, Scan } from '../types';

export const parseScanUrls = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean);

export const canonicalizePlanUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

export const isScanInProgress = (scan: Scan) =>
  scan.status === 'pending' || scan.status === 'awaiting_login' || scan.status === 'running';

export const getProjectReservedFreeUrl = (project: Project | null) => {
  if (!project) return null;
  if (project.domain) return project.domain;

  for (const scan of project.scans || []) {
    for (const result of scan.urlResults || []) {
      if (result.url) return result.url;
    }
  }

  return null;
};
