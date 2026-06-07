import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{
    user?: {
      id: string;
      email?: string;
      fullName?: string | null;
      role?: string;
      billingStatus?: string | null;
      billingPlan?: string | null;
    };
  }>();
  return request.user || null;
});
