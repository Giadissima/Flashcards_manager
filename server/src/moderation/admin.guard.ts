import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/** What a moderation token carries, and the only thing it is allowed to say. */
export interface AdminPayload {
  admin: true;
}

/**
 * The door to the moderation page.
 *
 * A token of its own rather than a flag on a user: nobody administers this
 * site as themselves, the password is not anybody's password, and a token that
 * can take a post down should not be the same one that is left lying in a
 * browser all day for reading flashcards.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Missing moderation token');

    try {
      const payload = await this.jwtService.verifyAsync<AdminPayload>(token);
      if (!payload?.admin) throw new Error('not a moderation token');
      return true;
    } catch {
      throw new UnauthorizedException('Invalid moderation token');
    }
  }
}
