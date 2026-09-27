import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';

import { MailLang, MailService } from 'src/mail/mail.service';
import { User, UserDocument } from './user.schema';
import { bcryptSaltRounds, passwordResetTokenHours } from 'src/config';
import bcrypt from 'bcryptjs';

/**
 * The life of a password reset link: handed out, checked, spent.
 *
 * Kept apart from AuthService for the same reason as VerificationService: none
 * of this is about the ordinary sign-in path, and the two token lifecycles
 * (email confirmation, password reset) do not share any state on the user
 * beyond both being cleared once spent.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly site: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.site = (config.get<string>('PUBLIC_URL') ?? '').replace(/\/+$/, '');
  }

  /**
   * Sends the reset mail, replacing whatever link was outstanding. Never
   * says whether the address exists: the caller always gets the same
   * "if that address has an account..." answer, so the endpoint cannot be
   * used to find out who is registered.
   */
  async send(email: string, lang: MailLang = 'it'): Promise<void> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();
    // Nothing to send it to, and nothing to say: see above.
    if (!user || !user.email) return;

    // No mail, no way to prove who is asking - refusing quietly is the same
    // choice VerificationService makes the other way (taking the address at
    // its word) because there confirming is a nice-to-have; here it would
    // mean handing out access on nothing but an email address typed into a form.
    if (!this.mail.enabled) {
      this.logger.warn(
        `password reset for ${user.username} not sent: mail is not configured`,
      );
      return;
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hash(token);
    user.passwordResetTokenExpiresAt = new Date(
      Date.now() + passwordResetTokenHours * 60 * 60 * 1000,
    );
    await user.save();

    try {
      await this.mail.sendPasswordReset(
        user.email,
        user.username,
        this.link(token),
        lang,
      );
    } catch (error) {
      this.logger.warn(
        `password reset mail for ${user.username} not sent: ${String(error)}`,
      );
    }
  }

  /** Spends a link and sets the new password. The same answer for a wrong
      token and an expired one. */
  async reset(token: string, newPassword: string): Promise<void> {
    const user = await this.userModel
      .findOne({
        passwordResetTokenHash: hash(token),
        passwordResetTokenExpiresAt: { $gt: new Date() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException({
        code: 'invalidToken',
        message: 'This reset link is not valid any more',
      });
    }

    user.password = await bcrypt.hash(newPassword, bcryptSaltRounds);
    // Spent: the same link cannot be used twice.
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;
    await user.save();
  }

  private link(token: string): string {
    const path = `/reset-password?token=${token}`;
    return this.site ? `${this.site}${path}` : path;
  }
}

/** Only the digest is stored, so a copy of the database confirms nothing. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
