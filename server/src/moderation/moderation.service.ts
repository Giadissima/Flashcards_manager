import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { NotificationService } from 'src/notification/notification.service';
import { Post } from 'src/post/post.schema';
import { blockUntil, blocksAt, privileges } from 'src/common/privileges';
import { Report, ReportReason } from './report.schema';
import { Sanction } from './sanction.schema';
import { User } from 'src/auth/user.schema';
import { autoHideReports } from 'src/config';

/** A report with everything the person deciding on it needs to see. */
export interface ReportSummary {
  reportId: string;
  postId: string;
  authorId: string;
  author: string;
  subject: string;
  reason: ReportReason;
  note?: string;
  reports: number;
  strikes: number;
  hidden: boolean;
  createdAt: Date;
}

/** What was decided, in words the bot can put back on the message. */
export interface Verdict {
  done: string;
  postId?: string;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<Report>,
    @InjectModel(Sanction.name) private readonly sanctionModel: Model<Sanction>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) {}

  // --------------------------------------------------------- what readers do

  /**
   * Files a report, and takes the post out of the feed once enough different
   * people have filed one.
   *
   * Hiding on a count rather than waiting for a person is the whole reason the
   * count is there: whoever administers this has a life, and an hour of an
   * explicit image in front of everybody is worse than an hour of a good post
   * being invisible - the second is undone with one tap.
   */
  async report(
    userId: string,
    postId: string,
    reason: ReportReason,
    note?: string,
  ): Promise<{ reportId: string; reports: number; hidden: boolean }> {
    const post = await this.postModel.findById(postId).lean().exec();
    if (!post) throw new NotFoundException(`Post with id ${postId} not found`);
    if (String(post.user_id) === userId) {
      throw new BadRequestException('This post is yours');
    }

    let reportId = '';
    try {
      const report = await this.reportModel.create({
        post_id: post._id,
        reporter_id: new Types.ObjectId(userId),
        reason,
        note,
        state: 'open',
      });
      reportId = String(report._id);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('You already reported this post');
      }
      throw error;
    }

    const reports = await this.reportModel
      .countDocuments({ post_id: post._id, state: 'open' })
      .exec();

    const hidden = reports >= autoHideReports && !post.hiddenAt;
    if (hidden) {
      await this.postModel
        .updateOne(
          { _id: post._id },
          { $set: { hiddenAt: new Date(), hiddenReason: 'reports' } },
        )
        .exec();
    }

    return { reportId, reports, hidden };
  }

  /** Everything one report is about, for the message that asks about it. */
  async summarise(reportId: string): Promise<ReportSummary | null> {
    const report = await this.reportModel.findById(reportId).lean().exec();
    if (!report) return null;

    const post = await this.postModel
      .findById(report.post_id)
      .populate('subject_id', 'name')
      .lean()
      .exec();
    if (!post) return null;

    const [author, reports] = await Promise.all([
      this.userModel
        .findById(post.user_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.reportModel
        .countDocuments({ post_id: post._id, state: 'open' })
        .exec(),
    ]);

    return {
      reportId: String(report._id),
      postId: String(post._id),
      authorId: String(post.user_id),
      author: author?.username ?? '?',
      subject: (post.subject_id as unknown as { name?: string })?.name ?? '?',
      reason: report.reason,
      note: report.note,
      reports,
      strikes: author?.strikes ?? 0,
      hidden: !!post.hiddenAt,
      createdAt: report.createdAt as unknown as Date,
    };
  }

  // ------------------------------------------------------ what the admin does

  /**
   * The post stays: the reports on it are closed and it goes back up.
   *
   * Back up whether it went down on its own or by hand - saying "va bene"
   * about a post that stays invisible is the button lying. The one hiding it
   * does not lift is a ban's, which is about the author and not about this.
   */
  async keep(postId: string): Promise<Verdict> {
    await this.closeReports(postId, 'kept');
    const back = await this.postModel
      .updateOne(
        { _id: postId, hiddenReason: { $in: ['reports', 'admin'] } },
        { $unset: { hiddenAt: '', hiddenReason: '' } },
      )
      .exec();

    const banned = await this.postModel
      .exists({ _id: postId, hiddenReason: 'ban' })
      .exec();

    return {
      done: banned
        ? "Segnalazione chiusa, ma il post resta giù col ban dell'autore"
        : back.modifiedCount
          ? 'Segnalazione chiusa, il post torna nel feed'
          : 'Segnalazione chiusa, il post era già nel feed',
      postId,
    };
  }

  /** The post goes, and its author is told which one and why. */
  async removePost(postId: string): Promise<Verdict> {
    const post = await this.postModel.findById(postId).lean().exec();
    if (!post) throw new NotFoundException('Post not found');

    await this.postModel
      .updateOne(
        { _id: post._id },
        { $set: { hiddenAt: new Date(), hiddenReason: 'admin' } },
      )
      .exec();
    await this.closeReports(postId, 'removed');

    await this.notificationService.record({
      userId: post.user_id,
      kind: 'moderation',
      postId: post._id as Types.ObjectId,
      moderation: { event: 'removed', privileges: [] },
    });

    await this.sanctionModel.create({
      user_id: post.user_id,
      kind: 'warning',
      post_id: post._id,
      privileges: [],
      note: 'post removed',
    });

    return { done: "Post tolto dal feed, l'autore è stato avvisato", postId };
  }

  /**
   * One warning up the ladder.
   *
   * The first two only say so. From the third the privileges go with it, for
   * the length the ladder decides - and the notice carries the date, because a
   * punishment nobody can see the end of is a punishment nobody can serve.
   */
  async warn(userId: string, postId?: string): Promise<Verdict> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const strikes = (user.strikes ?? 0) + 1;
    const blocks = blocksAt(strikes);
    const until = blocks ? blockUntil(strikes) : undefined;

    user.strikes = strikes;
    if (blocks) {
      user.restrictions = privileges.map((privilege) => ({
        privilege,
        until: until ?? undefined,
        reason: `strike ${strikes}`,
      }));
    }
    await user.save();

    await this.sanctionModel.create({
      user_id: user._id,
      kind: 'warning',
      post_id: postId ? new Types.ObjectId(postId) : undefined,
      privileges: blocks ? [...privileges] : [],
      until: until ?? undefined,
      strike: strikes,
    });

    // The report that led here is dealt with, whatever was decided about the
    // author: leaving it open would keep it in the queue for ever, and the
    // queue is the only thing saying what still needs looking at. The label
    // follows the post - up in the feed, or down.
    if (postId) {
      const post = await this.postModel
        .findById(postId, { hiddenAt: 1 })
        .lean()
        .exec();
      await this.closeReports(postId, post?.hiddenAt ? 'removed' : 'kept');
    }

    await this.notificationService.record({
      userId: user._id as Types.ObjectId,
      kind: 'moderation',
      postId: postId ? new Types.ObjectId(postId) : undefined,
      moderation: {
        event: blocks ? 'blocked' : 'warned',
        privileges: blocks ? [...privileges] : [],
        until: until ?? undefined,
      },
    });

    return {
      done: blocks
        ? `Ammonizione n. ${strikes} — bloccato ${until ? `fino al ${day(until)}` : 'senza scadenza'}`
        : `Ammonizione n. ${strikes} — ancora nessun blocco`,
    };
  }

  /**
   * The end of the line: nothing they publish is in the Community any more,
   * they cannot reach anybody, and the address they signed up from cannot open
   * a new account for a few hours.
   */
  async ban(userId: string): Promise<Verdict> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    user.bannedAt = new Date();
    user.restrictions = privileges.map((privilege) => ({
      privilege,
      reason: 'banned',
    }));
    await user.save();

    // Marked as the ban's doing, and not as a decision about each post: a
    // pardon has to know which ones it may put back.
    const posts = await this.postModel
      .updateMany(
        { user_id: user._id, hiddenAt: { $exists: false } },
        { $set: { hiddenAt: new Date(), hiddenReason: 'ban' } },
      )
      .exec();

    // Everything reported about them is settled by this, since none of it is
    // in the feed any more
    const theirs = await this.postModel
      .find({ user_id: user._id }, { _id: 1 })
      .lean()
      .exec();
    await this.reportModel
      .updateMany(
        {
          post_id: { $in: theirs.map((post) => post._id) },
          state: { $ne: 'removed' },
        },
        { $set: { state: 'removed', handledAt: new Date() } },
      )
      .exec();

    await this.sanctionModel.create({
      user_id: user._id,
      kind: 'ban',
      privileges: [...privileges],
    });

    await this.notificationService.record({
      userId: user._id as Types.ObjectId,
      kind: 'moderation',
      moderation: { event: 'blocked', privileges: [...privileges] },
    });

    return {
      done: `Bannato — ${posts.modifiedCount} post tolti dal feed`,
    };
  }

  /** Everything back: the mistake this makes right is the admin's own. */
  async pardon(username: string): Promise<Verdict> {
    const user = await this.userModel
      .findOne({ username: username.toLowerCase() })
      .exec();
    if (!user) throw new NotFoundException('User not found');

    const had = user.restrictions?.map((r) => r.privilege) ?? [];
    user.restrictions = [];
    user.bannedAt = undefined;
    user.strikes = 0;
    await user.save();

    // What the ban swept up comes back with them. The posts taken down one by
    // one stay down: those were decided on, and a pardon is not a retrial.
    const restored = await this.postModel
      .find({ user_id: user._id, hiddenReason: 'ban' }, { _id: 1 })
      .lean()
      .exec();
    const back = await this.postModel
      .updateMany(
        { user_id: user._id, hiddenReason: 'ban' },
        { $unset: { hiddenAt: '', hiddenReason: '' } },
      )
      .exec();

    // And so do their reports: a post back in the feed reading "tolto" is the
    // list saying the opposite of what the feed shows.
    for (const post of restored) {
      await this.closeReports(String(post._id), 'kept');
    }

    await this.sanctionModel.create({
      user_id: user._id,
      kind: 'lifted',
      privileges: had,
    });

    if (had.length) {
      await this.notificationService.record({
        userId: user._id as Types.ObjectId,
        kind: 'moderation',
        moderation: { event: 'lifted', privileges: had },
      });
    }

    return {
      done: `${user.username}: tutto ridato, ${back.modifiedCount} post rimessi nel feed`,
    };
  }

  /** Puts one post back in the feed, whoever took it out. */
  async restore(postId: string): Promise<Verdict> {
    await this.postModel
      .updateOne(
        { _id: postId },
        { $unset: { hiddenAt: '', hiddenReason: '' } },
      )
      .exec();
    await this.closeReports(postId, 'kept');
    return { done: 'Post rimesso nel feed', postId };
  }

  /**
   * Every report about that post, and not only the ones still open.
   *
   * The state is read as "how this was settled", so a post put back after
   * being taken down has to say so on all of them: leaving the old ones
   * reading "tolto" is the page telling the reader the opposite of what it
   * just did.
   */
  private async closeReports(
    postId: string,
    state: 'kept' | 'removed',
  ): Promise<void> {
    await this.reportModel
      .updateMany(
        { post_id: new Types.ObjectId(postId), state: { $ne: state } },
        { $set: { state, handledAt: new Date() } },
      )
      .exec();
    this.logger.log(`reports on ${postId} closed as ${state}`);
  }
}

/** A date the way it is read here, since these sentences are read by a person. */
function day(value: Date): string {
  return value.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
