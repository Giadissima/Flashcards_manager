import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { FileService } from 'src/file/file.service';
import { NotificationService } from 'src/notification/notification.service';
import { PostService } from 'src/post/post.service';
import { extractImageFileIds } from 'src/common/html.util';
import { allCards } from 'src/config';
import { Post } from 'src/post/post.schema';
import { blockUntil, blocksAt, privileges } from 'src/common/privileges';
import { AdminReport, ModerationAction } from './moderation.dto';
import { Report, ReportReason } from './report.schema';
import { Sanction } from './sanction.schema';
import { SignupBlock } from './signup-block.schema';
import { User } from 'src/auth/user.schema';
import { isSharedAddress } from 'src/common/address.util';
import {
  autoHideReports,
  signupBlockAfterBans,
  signupBlockHours,
} from 'src/config';

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
    @InjectModel(SignupBlock.name)
    private readonly signupBlockModel: Model<SignupBlock>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
    private readonly postService: PostService,
    private readonly fileService: FileService,
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

  // ---------------------------------------------------- the moderation page

  /**
   * Every report there has ever been, the undecided ones first.
   *
   * All of them, and not only what is waiting: what was decided last time is
   * half of what decides this time - the same post reported again, an author
   * whose two previous reports were nonsense.
   */
  async reviews(limit = 100): Promise<AdminReport[]> {
    await this.forgetOrphans();

    const reports = await this.reportModel
      .find({}, { _id: 1, state: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const reviews = await Promise.all(
      reports.map((report) => this.review(String(report._id))),
    );
    const found = reviews.filter((review): review is AdminReport => !!review);

    return found.sort((first, second) => {
      if (first.state !== second.state) return first.state === 'open' ? -1 : 1;
      return second.createdAt.getTime() - first.createdAt.getTime();
    });
  }

  /**
   * Throws away the reports whose post is not there any more.
   *
   * A post goes when its subject does, and the report about it outlives it as
   * a row nobody can open, act on, or clear - it would sit in the queue for
   * ever. Done here, on the way to reading the list, so there is no job to
   * schedule and nothing to remember.
   */
  private async forgetOrphans(): Promise<void> {
    const posts = await this.reportModel.distinct('post_id').exec();
    if (!posts.length) return;

    const alive = await this.postModel
      .find({ _id: { $in: posts } }, { _id: 1 })
      .lean()
      .exec();
    const living = new Set(alive.map((post) => String(post._id)));
    const gone = posts.filter((id) => !living.has(String(id)));
    if (!gone.length) return;

    const dropped = await this.reportModel
      .deleteMany({ post_id: { $in: gone } })
      .exec();
    this.logger.log(`${dropped.deletedCount} reports about deleted posts dropped`);
  }

  /** One report, with the post as its readers see it. */
  async review(reportId: string): Promise<AdminReport | null> {
    const summary = await this.summarise(reportId);
    if (!summary) return null;

    const [report, author, cards] = await Promise.all([
      this.reportModel.findById(reportId, { state: 1 }).lean().exec(),
      this.userModel
        .findById(summary.authorId, { bannedAt: 1 })
        .lean()
        .exec(),
      this.postService.cardsForReview(summary.postId, allCards),
    ]);

    return {
      ...summary,
      state: report?.state ?? 'open',
      banned: !!author?.bannedAt,
      // Whole, pictures and all: the page shows the post the way the people
      // who reported it saw it, which is the only fair way to decide about it.
      cards: await Promise.all(
        cards.map(async (card) => ({
          _id: String(card._id),
          title: card.title,
          question: await this.withImages(card.question),
          answer: await this.withImages(card.answer),
          topic: (card.topic_id as unknown as { name?: string })?.name,
        })),
      ),
    };
  }

  /** What a button on the page, or in the chat, comes down to. */
  async act(reportId: string, action: ModerationAction): Promise<Verdict> {
    const summary = await this.summarise(reportId);
    if (!summary) throw new NotFoundException('Report not found');

    if (action === 'keep') return this.keep(summary.postId);
    if (action === 'remove') return this.removePost(summary.postId);
    if (action === 'restore') return this.restore(summary.postId);
    if (action === 'warn') return this.warn(summary.authorId, summary.postId);
    return this.ban(summary.authorId);
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

    // Never an address that stands for more than one person: behind a proxy
    // whose forwarded header is not trusted, everybody looks like the proxy,
    // and blocking it would shut the door on the whole site.
    //
    // And not on the first ban either. A university's wifi is one address for
    // a whole faculty, so the door is only held shut once several accounts
    // from there have been banned - a pattern, rather than one person.
    if (user.signupIp && !isSharedAddress(user.signupIp)) {
      const banned = await this.userModel
        .countDocuments({ signupIp: user.signupIp, bannedAt: { $exists: true } })
        .exec();

      if (banned >= signupBlockAfterBans) {
        await this.signupBlockModel.create({
          ip: user.signupIp,
          until: new Date(Date.now() + signupBlockHours * 60 * 60 * 1000),
          because: user.username,
        });
      }
    }

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

  // ------------------------------------------------------------ registration

  /** True when this address may not open an account right now. */
  async signupBlocked(ip?: string): Promise<boolean> {
    if (isSharedAddress(ip)) return false;
    const block = await this.signupBlockModel
      .exists({ ip, until: { $gt: new Date() } })
      .exec();
    return !!block;
  }

  /**
   * The same HTML, with its pictures carried inside it.
   *
   * The page is opened with a password and not with an account, so it cannot
   * ask for /file/:id the way the app does - and opening those files to
   * everybody, to save this, would put every private flashcard's images one
   * guessed id away from being public. So they travel in the answer.
   */
  private async withImages(html?: string): Promise<string> {
    if (!html) return '';

    let done = html;
    for (const fileId of extractImageFileIds(html)) {
      const file = await this.image(fileId);
      if (!file) continue;

      const inline = `data:${file.mimetype};base64,${Buffer.from(file.content).toString('base64')}`;
      done = done.replace(
        new RegExp(`src="[^"]*${fileId}[^"]*"`, 'gi'),
        `src="${inline}"`,
      );
    }
    return done;
  }

  /** One picture out of a reported card. */
  async image(
    fileId: string,
  ): Promise<{ content: Uint8Array; mimetype: string } | null> {
    const file = await this.fileService.findOne(fileId);
    if (!file) return null;

    // What comes back is a Buffer or the driver's Binary wrapper, and the two
    // meet as bytes, which is all the sending needs.
    return {
      content: this.fileService.convertBuffer(file.content) as Uint8Array,
      mimetype: file.mimetype,
    };
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
