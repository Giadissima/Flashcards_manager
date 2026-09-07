import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User } from 'src/auth/user.schema';
import { Visibility } from './visibility';

/**
 * The one condition on sharing: the author has to have said where they study.
 *
 * Not a formality. The feed opens on the reader's own university, so a post
 * with no university behind it belongs to no corner of the Community, and
 * leaving the field empty would be the way to be seen everywhere - which would
 * make filling it in the losing move for everybody who does.
 *
 * Checked here rather than in each of the three services, so a new way of
 * publishing something cannot quietly skip it.
 */
@Injectable()
export class PublishingService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /** Only public asks anything: taking something back is always allowed. */
  async assertMayPublish(
    userId: string,
    visibility?: Visibility,
  ): Promise<void> {
    if (visibility !== 'public') return;

    const user = await this.userModel
      .findById(userId, { universityCode: 1 })
      .lean()
      .exec();

    if (!user?.universityCode) {
      throw new ForbiddenException(
        'Add your university to your profile before sharing anything',
      );
    }
  }
}
