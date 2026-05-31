import { lookup } from 'node:dns/promises';
import { BadRequestException } from '@nestjs/common';

export interface ScanUrlPolicyOptions {
  maxUrls?: number;
  maxUrlLength?: number;
  resolveHostAddresses?: (hostname: string) => Promise<string[]>;
}

const DEFAULT_MAX_URLS = 50;
const DEFAULT_MAX_URL_LENGTH = 2048;
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

async function defaultResolveHostAddresses(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: false });
  return records.map((record) => record.address);
}

function isIPv4Address(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isPrivateIPv4(value: string): boolean {
  if (!isIPv4Address(value)) return false;
  const [a, b] = value.split('.').map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');

  if (LOCAL_HOSTNAMES.has(normalized) || normalized.endsWith('.localhost')) return true;
  if (isPrivateIPv4(normalized) || isPrivateIPv6(normalized)) return true;

  return false;
}

function assertPublicAddress(address: string): void {
  if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
    throw new BadRequestException('Private or local network targets are not allowed');
  }
}

export async function validateScanTargetUrl(input: string, options: ScanUrlPolicyOptions = {}): Promise<string> {
  const maxUrlLength = options.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH;
  const rawUrl = typeof input === 'string' ? input.trim() : '';

  if (!rawUrl) throw new BadRequestException('URL is required');
  if (rawUrl.length > maxUrlLength) throw new BadRequestException(`URL must be ${maxUrlLength} characters or fewer`);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Only http and https URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException('URLs with embedded credentials are not allowed');
  }

  const hostname = parsed.hostname;
  if (!hostname || isPrivateOrLocalHost(hostname)) {
    throw new BadRequestException('Private or local network targets are not allowed');
  }

  if (!isIPv4Address(hostname) && !hostname.includes(':')) {
    const resolveHostAddresses = options.resolveHostAddresses ?? defaultResolveHostAddresses;
    let addresses: string[];
    try {
      addresses = await resolveHostAddresses(hostname);
    } catch {
      throw new BadRequestException('URL hostname could not be resolved');
    }

    if (!addresses.length) throw new BadRequestException('URL hostname could not be resolved');
    addresses.forEach(assertPublicAddress);
  }

  return parsed.toString();
}

export async function validateScanTargetUrls(inputs: string[], options: ScanUrlPolicyOptions = {}): Promise<string[]> {
  const maxUrls = options.maxUrls ?? DEFAULT_MAX_URLS;

  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new BadRequestException('At least one URL is required');
  }

  if (inputs.length > maxUrls) {
    throw new BadRequestException(`At most ${maxUrls} URLs are allowed per scan`);
  }

  const validatedUrls: string[] = [];
  for (const input of inputs) {
    validatedUrls.push(await validateScanTargetUrl(input, options));
  }

  return validatedUrls;
}
