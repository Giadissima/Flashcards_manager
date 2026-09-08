import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { NotificationService } from 'src/notification/notification.service';
import { Privilege } from './privileges';
import { Restriction, User } from 'src/auth/user.schema';

/** The three fields this service reads, which is all it ever loads. */
type UserFields = Pick<User, 'restrictions' | 'email' | 'emailVerifiedAt'>;

/**
 * Whether an account may still reach other people.
 *
 * Asked on the way in by everything that publishes, comments or writes to an
 * author, so that a block is one thing to hand down and not three places to
 * remember. Blocks are dropped the moment they are found to be spent rather
 * than by a job that sweeps the collection: there is no clock here that could
 * be down, and an account gets its week back on the first request it makes.
 *
 * The unconfirmed address is asked about in the same breath, and for the same
 * reason: it stops exactly the three things a block stops, so putting it here
 * means a new way of reaching people cannot be written that forgets it.
 */
@Injectable()
export class RestrictionsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Throws when this account may not do that right now. */
  async assertMay(userId: string, privilege: Privilege): Promise<void> {
    const user = await this.load(userId);
    const restriction = await this.resolve(userId, user, privilege);

    if (restriction) {
      throw new ForbiddenException({
        // The client turns these two into the sentence it shows; the message is
        // for whoever reads the API by hand.
        code: 'restricted',
        privilege,
        until: restriction.until ?? null,
        message: restriction.until
          ? `You cannot ${privilege} until ${restriction.until.toISOString()}`
          : `You cannot ${privilege}`,
      });
    }

    // Asked second on purpose. An account that was blocked and also never
    // confirmed would otherwise be told to go and read its mail, which would
    // be a wrong answer to what it is actually being told.
    this.assertConfirmed(user);
  }

  /** The block on that privilege, or null - lifting it if its day has come. */
  async inForce(
    userId: string | Types.ObjectId,
    privilege: Privilege,
  ): Promise<Restriction | null> {
    return this.resolve(userId, await this.load(userId), privilege);
  }

  /**
   * Throws when the account has an address it never confirmed.
   *
   * An account from before addresses existed has none, and passes: taking the
   * Community away from everybody who registered first would punish them for
   * the order they arrived in.
   */
  private assertConfirmed(user: UserFields | null): void {
    if (!user?.email || user.emailVerifiedAt) return;

    throw new ForbiddenException({
      code: 'emailNotVerified',
      email: user.email,
      message: 'Confirm your email address before reaching other people',
    });
  }

  private async load(
    userId: string | Types.ObjectId,
  ): Promise<UserFields | null> {
    return this.userModel
      .findById(userId, { restrictions: 1, email: 1, emailVerifiedAt: 1 })
      .lean<UserFields>()
      .exec();
  }

  /** Reads one already-loaded account, so a check that needs both the block
      and the address does not ask the database twice. */
  private async resolve(
    userId: string | Types.ObjectId,
    user: UserFields | null,
    privilege: Privilege,
  ): Promise<Restriction | null> {
    const found = user?.restrictions?.find(
      (restriction) => restriction.privilege === privilege,
    );
    if (!found) return null;
    if (!found.until || found.until.getTime() > Date.now()) return found;

    await this.lift(userId, privilege);
    return null;
  }

  /**
   * Gives one privilege back, and says so.
   *
   * The notice matters as much as the block: somebody who was told "until the
   * fourteenth" and hears nothing on the fourteenth has no way of knowing
   * whether it is over or whether they are still in trouble.
   */
  async lift(
    userId: string | Types.ObjectId,
    privilege: Privilege,
  ): Promise<void> {
    const result = await this.userModel
      .updateOne(
        { _id: userId },
        { $pull: { restrictions: { privilege } } },
      )
      .exec();

    if (result.modifiedCount) {
      await this.notificationService.record({
        userId,
        kind: 'moderation',
        moderation: { event: 'lifted', privileges: [privilege] },
      });
    }
  }
}
