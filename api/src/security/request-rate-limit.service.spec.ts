import { RequestRateLimitService } from './request-rate-limit.service';

let consumeCount = 0;

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    multi: jest.fn(() => ({
      incr: jest.fn(),
      pttl: jest.fn(),
      exec: jest.fn(async () => {
        consumeCount += 1;
        return [
          [null, consumeCount],
          [null, consumeCount === 1 ? -1 : 10],
        ];
      }),
    })),
    pexpire: jest.fn(async () => 1),
    quit: jest.fn(async () => 'OK'),
  })),
}));

describe('RequestRateLimitService', () => {
  beforeEach(() => {
    consumeCount = 0;
  });

  it('keys callers by token when available and enforces the configured limit', async () => {
    const previousToken = process.env.API_AUTH_TOKEN;
    process.env.API_AUTH_TOKEN = 'test-token';

    try {
      const service = new RequestRateLimitService({
        get: jest.fn(() => undefined),
      } as any);
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

      const first = await service.consume('bucket', 2, 10);
      const second = await service.consume('bucket', 2, 10);
      const third = await service.consume('bucket', 2, 10);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
      expect(third.allowed).toBe(false);
      expect(second.remaining).toBe(0);
      await service.onModuleDestroy();
    } finally {
      process.env.API_AUTH_TOKEN = previousToken;
    }
  });
});
