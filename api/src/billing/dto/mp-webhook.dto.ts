export class MpWebhookDto {
  type?: string;
  action?: string;
  data?: Record<string, unknown>;
  id?: string | number;
  live_mode?: boolean;
  date_created?: string;
  user_id?: string | number;
}
