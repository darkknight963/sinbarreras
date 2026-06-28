import Redis from 'ioredis';

let client: Redis | null = null;

function buildConnection() {
  const redisUrl = process.env.BULL_REDIS_URL || process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;
  const useTls = (host: string, protocol?: string) =>
    protocol === 'rediss:' ||
    host.includes('upstash.io') ||
    process.env.REDIS_TLS === 'true';

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return new Redis({
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(useTls(parsed.hostname, parsed.protocol) ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  const host = process.env.REDIS_HOST || process.env.REDISHOST || 'localhost';
  return new Redis({
    host,
    port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
    ...(redisPassword ? { password: redisPassword } : {}),
    ...(useTls(host) ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export function getRedisClient(): Redis {
  if (!client) {
    client = buildConnection();
  }
  return client;
}
