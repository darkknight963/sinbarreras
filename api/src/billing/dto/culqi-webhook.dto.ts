export class CulqiWebhookDto {
  event?: string;
  type?: string;
  data?: Record<string, unknown>;
  object?: string;
  id?: string;
  metadata?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  card?: Record<string, unknown>;
}
