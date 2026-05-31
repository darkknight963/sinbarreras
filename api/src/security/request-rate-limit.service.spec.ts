import { RequestRateLimitService } from './request-rate-limit.service';

describe('RequestRateLimitService', () => {
  it('keys callers by token when available and enforces the configured limit', () => {
    const previousToken = process.env.API_AUTH_TOKEN;
    process.env.API_AUTH_TOKEN = 'test-token';

    try {
      const service = new RequestRateLimitService();
      const request = {
        headers: { authorization: 'Bearer abc123' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        body: { projectId: 'project-1' },
        params: {},
      } as any;

      const callerKey = service.buildCallerKey(request);
      expect(callerKey.startsWith('token:')).toBe(true);

      expect(service.buildScopeKey('scan', request)).toContain('scan:project-1');
      expect(service.buildScopeKey('project', request)).toContain('project:project-1');
      expect(service.buildScopeKey('report', { ...request, params: { scanId: 'scan-1' } } as any)).toContain('report:scan-1');

      const first = service.consume('bucket', 2, 10);
      const second = service.consume('bucket', 2, 10);
      const third = service.consume('bucket', 2, 10);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
      expect(third.allowed).toBe(false);
      expect(second.remaining).toBe(0);
    } finally {
      process.env.API_AUTH_TOKEN = previousToken;
    }
  });
});
