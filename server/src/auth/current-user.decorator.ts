import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { AuthenticatedRequest } from './jwt-auth.guard';
import { JwtPayload } from './auth.dto';

/**
 * The JWT payload of the caller, put on the request by JwtAuthGuard. Only
 * usable on routes the guard protects, which is every route but the @Public()
 * ones.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
