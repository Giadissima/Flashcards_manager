import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { NotificationService } from 'src/notification/notification.service';
import { Privilege } from './privileges';
import { Restriction, User } from 'src/auth/user.schema';

/**
 * Whether an account may still reach other people.
 *
 * Asked on the way in by everything that publishes, comments or writes to an
 * author, so that a block is one thing to hand down and not three places to
 * remember. Blocks are dropped the moment they are found to be spent rather
 * than by a job that sweeps the collection: there is no clock here that could
 * be down, and an account gets its week back on the first request it makes.
 */
@Injectable()
export class RestrictionsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Throws when this account may not do that right now. */
  async assertMay(userId: string, privilege: Privilege): Promise<void> {
    const restriction = await this.inForce(userId, privilege);
    if (!restriction) return;

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

  /** The block on that privilege, or null - lifting it if its day has come. */
  async inForce(
    userId: string | Types.ObjectId,
    privilege: Privilege,
  ): Promise<Restriction | null> {
    const user = await this.userModel
      .findById(userId, { restrictions: 1 })
      .lean()
      .exec();

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
