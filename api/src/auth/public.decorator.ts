import { SetMetadata } from '@nestjs/common';
import { AUTH_ROUTE_KEY } from './auth.constants';

export const Public = () => SetMetadata(AUTH_ROUTE_KEY, true);
