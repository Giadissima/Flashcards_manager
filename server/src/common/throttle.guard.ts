import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * The refusal that says how long, and what for.
 *
 * "Too Many Requests" on its own reads as a broken site, and somebody who
 * thinks the site is broken does not come back in ten minutes - they give up.
 * The limits here are meant to blunt a script, not to turn away a lecture hall
 * where thirty people sign up at once, so the ones who run into them have to
 * be told plainly that waiting is all it takes.
 */
@Injectable()
export class FriendlyThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));

    // Which limit was hit changes what there is to say: an address that has
    // opened its share of accounts is a different sentence from one that is
    // asking too fast.
    const code = request.path.endsWith('/auth/register')
      ? 'tooManyAccounts'
      : request.path.endsWith('/auth/login')
        ? 'tooManyLogins'
        : 'tooFast';

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code,
        retryAfter: seconds,
        message: `Too many requests from this address. Try again in ${seconds}s.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
