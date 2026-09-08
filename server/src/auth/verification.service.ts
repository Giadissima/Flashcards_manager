import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';

import { MailService } from 'src/mail/mail.service';
import { User, UserDocument } from './user.schema';
import { verificationTokenHours } from 'src/config';

/**
 * The life of a confirmation link: handed out, checked, spent.
 *
 * Kept apart from AuthService because none of it is about signing anybody in -
 * an account works the moment it is created, and confirming only decides
 * whether it may reach other people (see RestrictionsService).
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly site: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.site = (config.get<string>('PUBLIC_URL') ?? '').replace(/\/+$/, '');
  }

  /**
   * Sends the confirmation mail, replacing whatever link was outstanding: the
   * newest mail is the one that works, so a second request cannot leave the
   * user guessing which of two messages to open.
   *
   * A send that fails is not allowed to fail the registration around it. The
   * account is already made and perfectly usable; what is missing is one mail,
   * and there is a button that asks for it again.
   */
  async send(user: UserDocument): Promise<void> {
    if (!user.email || user.emailVerifiedAt) return;

    // Nobody can confirm anything while the mail is switched off, so the
    // address is taken at its word rather than left in a state with no exit.
    if (!this.mail.enabled) {
      user.emailVerifiedAt = new Date();
      user.emailTokenHash = undefined;
      user.emailTokenExpiresAt = undefined;
      await user.save();
      return;
    }

    const token = randomBytes(32).toString('hex');
    user.emailTokenHash = hash(token);
    user.emailTokenExpiresAt = new Date(
      Date.now() + verificationTokenHours * 60 * 60 * 1000,
    );
    await user.save();

    try {
      await this.mail.sendVerification(user.email, user.username, this.link(token));
    } catch (error) {
      this.logger.warn(
        `confirmation mail for ${user.username} not sent: ${String(error)}`,
      );
    }
  }

  /** Spends a link. The same answer for a wrong token and an expired one. */
  async confirm(token: string): Promise<void> {
    const user = await this.userModel
      .findOne({
        emailTokenHash: hash(token),
        emailTokenExpiresAt: { $gt: new Date() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException({
        code: 'invalidToken',
        message: 'This confirmation link is not valid any more',
      });
    }

    user.emailVerifiedAt = new Date();
    // Spent: the same address in the same mail cannot confirm twice, and a
    // link left in an inbox is worth nothing from here on.
    user.emailTokenHash = undefined;
    user.emailTokenExpiresAt = undefined;
    await user.save();
  }

  /** Asks for the mail again, for somebody who never got the first one. */
  async resend(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    // Nothing to do, and nothing to complain about: an account with no address
    // or an address already confirmed is exactly where it should be.
    if (!user) return;
    await this.send(user);
  }

  private link(token: string): string {
    const path = `/verify-email?token=${token}`;
    return this.site ? `${this.site}${path}` : path;
  }
}

/** Only the digest is stored, so a copy of the database confirms nothing. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
