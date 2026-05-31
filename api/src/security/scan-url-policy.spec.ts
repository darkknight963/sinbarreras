import { validateScanTargetUrl, validateScanTargetUrls } from './scan-url-policy';

describe('scan URL policy', () => {
  const resolveHostAddresses = jest.fn(async (hostname: string) => {
    if (hostname === 'public.example') return ['93.184.216.34'];
    if (hostname === 'internal.example') return ['10.10.10.10'];
    return [];
  });

  beforeEach(() => {
    resolveHostAddresses.mockClear();
  });

  it('allows public http and https URLs', async () => {
    await expect(
      validateScanTargetUrl('https://public.example/path?x=1', { resolveHostAddresses }),
    ).resolves.toBe('https://public.example/path?x=1');

    await expect(
      validateScanTargetUrl('http://93.184.216.34/', { resolveHostAddresses }),
    ).resolves.toBe('http://93.184.216.34/');
  });

  it('rejects unsupported schemes', async () => {
    await expect(
      validateScanTargetUrl('file:///etc/passwd', { resolveHostAddresses }),
    ).rejects.toThrow('Only http and https URLs are allowed');

    await expect(
      validateScanTargetUrl('javascript:alert(1)', { resolveHostAddresses }),
    ).rejects.toThrow('Only http and https URLs are allowed');
  });

  it('rejects localhost and private-network targets', async () => {
    await expect(
      validateScanTargetUrl('http://localhost:3000', { resolveHostAddresses }),
    ).rejects.toThrow('Private or local network targets are not allowed');

    await expect(
      validateScanTargetUrl('http://127.0.0.1:3000', { resolveHostAddresses }),
    ).rejects.toThrow('Private or local network targets are not allowed');

    await expect(
      validateScanTargetUrl('http://192.168.1.10', { resolveHostAddresses }),
    ).rejects.toThrow('Private or local network targets are not allowed');

    await expect(
      validateScanTargetUrl('http://169.254.169.254/latest/meta-data', { resolveHostAddresses }),
    ).rejects.toThrow('Private or local network targets are not allowed');
  });

  it('rejects hostnames that resolve to private-network addresses', async () => {
    await expect(
      validateScanTargetUrl('https://internal.example/dashboard', { resolveHostAddresses }),
    ).rejects.toThrow('Private or local network targets are not allowed');
  });

  it('limits scan batch size without changing accepted URL ordering', async () => {
    await expect(
      validateScanTargetUrls(
        ['https://public.example/a', 'https://public.example/b'],
        { resolveHostAddresses, maxUrls: 2 },
      ),
    ).resolves.toEqual(['https://public.example/a', 'https://public.example/b']);

    await expect(
      validateScanTargetUrls(
        ['https://public.example/a', 'https://public.example/b', 'https://public.example/c'],
        { resolveHostAddresses, maxUrls: 2 },
      ),
    ).rejects.toThrow('At most 2 URLs are allowed per scan');
  });
});
