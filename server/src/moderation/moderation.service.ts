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
import { Comment } from 'src/post/comment.schema';
import { Feedback } from 'src/post/feedback.schema';
import { banUntil, blockUntil, blocksAt, privileges } from 'src/common/privileges';
import { AdminReport, ModerationAction, ModerationSubject } from './moderation.dto';
import { Report, ReportReason, ReportTarget } from './report.schema';
import { Sanction } from './sanction.schema';
import { SignupBlock } from './signup-block.schema';
import { User } from 'src/auth/user.schema';
import { isSharedAddress } from 'src/common/address.util';
import { RestrictionsService } from 'src/common/restrictions.service';
import { SubjectService } from 'src/subject/subject.service';
import {
  autoHideCommentReports,
  autoHideReports,
  signupBlockAfterBans,
  signupBlockHours,
} from 'src/config';

/** A report with everything the person deciding on it needs to see. */
export interface ReportSummary {
  reportId: string;
  target: ReportTarget;
  postId: string;
  /** Set only when target is 'comment'. */
  commentId?: string;
  commentText?: string;
  /** Set only when target is 'feedback'. */
  feedbackId?: string;
  messageId?: string;
  feedbackText?: string;
  authorId: string;
  author: string;
  /** Whoever filed this particular report. */
  reporterId: string;
  reporter: string;
  /** How many warnings the reporter's own account has behind it. */
  reporterStrikes: number;
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
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<Feedback>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
    private readonly postService: PostService,
    private readonly fileService: FileService,
    private readonly restrictions: RestrictionsService,
    private readonly subjectService: SubjectService,
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
    await this.restrictions.assertMay(userId, 'report');
    const post = await this.postModel.findById(postId).lean().exec();
    if (!post) throw new NotFoundException(`Post with id ${postId} not found`);
    if (String(post.user_id) === userId) {
      throw new BadRequestException('This post is yours');
    }

    let reportId = '';
    try {
      const report = await this.reportModel.create({
        target: 'post',
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
      .countDocuments({ post_id: post._id, target: 'post', state: 'open' })
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

  /**
   * Same idea, for one comment: files a report and, once enough different
   * people have filed one, takes just that comment out of the thread rather
   * than the whole post it lives under.
   */
  async reportComment(
    userId: string,
    commentId: string,
    reason: ReportReason,
    note?: string,
  ): Promise<{ reportId: string; reports: number; hidden: boolean }> {
    await this.restrictions.assertMay(userId, 'report');
    const comment = await this.commentModel.findById(commentId).lean().exec();
    if (!comment) {
      throw new NotFoundException(`Comment with id ${commentId} not found`);
    }
    if (String(comment.user_id) === userId) {
      throw new BadRequestException('This comment is yours');
    }

    let reportId = '';
    try {
      const report = await this.reportModel.create({
        target: 'comment',
        post_id: comment.post_id,
        comment_id: comment._id,
        reporter_id: new Types.ObjectId(userId),
        reason,
        note,
        state: 'open',
      });
      reportId = String(report._id);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('You already reported this comment');
      }
      throw error;
    }

    const reports = await this.reportModel
      .countDocuments({ comment_id: comment._id, state: 'open' })
      .exec();

    const hidden = reports >= autoHideCommentReports && !comment.hiddenAt;
    if (hidden) {
      await this.commentModel
        .updateOne(
          { _id: comment._id },
          { $set: { hiddenAt: new Date(), hiddenReason: 'reports' } },
        )
        .exec();
    }

    return { reportId, reports, hidden };
  }

  /**
   * Same idea, for one message inside a private feedback exchange: either
   * side of the thread can find the other's message out of place, so this is
   * open to whichever of the two did not write it.
   */
  async reportFeedbackMessage(
    userId: string,
    feedbackId: string,
    messageId: string,
    reason: ReportReason,
    note?: string,
  ): Promise<{ reportId: string; reports: number; hidden: boolean }> {
    await this.restrictions.assertMay(userId, 'report');
    const feedback = await this.feedbackModel.findById(feedbackId).lean().exec();
    // Someone else's exchange is not found rather than forbidden, the same as
    // reading one: a 403 would confirm it exists.
    const mine =
      feedback &&
      (String(feedback.author_id) === userId || String(feedback.reporter_id) === userId);
    if (!feedback || !mine) {
      throw new NotFoundException(`Feedback with id ${feedbackId} not found`);
    }

    const message = feedback.messages.find((m) => String(m._id) === messageId);
    if (!message) {
      throw new NotFoundException(`Message with id ${messageId} not found`);
    }
    if (String(message.user_id) === userId) {
      throw new BadRequestException('This message is yours');
    }

    let reportId = '';
    try {
      const report = await this.reportModel.create({
        target: 'feedback',
        feedback_id: feedback._id,
        message_id: message._id,
        reporter_id: new Types.ObjectId(userId),
        reason,
        note,
        state: 'open',
      });
      reportId = String(report._id);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('You already reported this message');
      }
      throw error;
    }

    const reports = await this.reportModel
      .countDocuments({ feedback_id: feedback._id, message_id: message._id, state: 'open' })
      .exec();

    // No auto-hide here: unlike a post or a comment, nobody but the two
    // people in the exchange ever sees this message, so there is no crowd of
    // readers to protect by taking it down early.
    return { reportId, reports, hidden: false };
  }

  /** Everything one report is about, for the message that asks about it. */
  async summarise(reportId: string): Promise<ReportSummary | null> {
    const report = await this.reportModel.findById(reportId).lean().exec();
    if (!report) return null;

    if (report.target === 'comment') return this.summariseComment(report);
    if (report.target === 'feedback') return this.summariseFeedback(report);

    const post = await this.postModel
      .findById(report.post_id)
      .populate('subject_id', 'name')
      .lean()
      .exec();
    if (!post) return null;

    const [author, reporter, reports] = await Promise.all([
      this.userModel
        .findById(post.user_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.userModel
        .findById(report.reporter_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.reportModel
        .countDocuments({ post_id: post._id, target: 'post', state: 'open' })
        .exec(),
    ]);

    return {
      reportId: String(report._id),
      target: 'post',
      postId: String(post._id),
      authorId: String(post.user_id),
      author: author?.username ?? '?',
      reporterId: String(report.reporter_id),
      reporter: reporter?.username ?? '?',
      reporterStrikes: reporter?.strikes ?? 0,
      subject: (post.subject_id as unknown as { name?: string })?.name ?? '?',
      reason: report.reason,
      note: report.note,
      reports,
      strikes: author?.strikes ?? 0,
      hidden: !!post.hiddenAt,
      createdAt: report.createdAt as unknown as Date,
    };
  }

  /** summarise(), for a report whose target is a comment. */
  private async summariseComment(
    report: Report & { _id: Types.ObjectId; createdAt?: Date },
  ): Promise<ReportSummary | null> {
    const comment = await this.commentModel.findById(report.comment_id).lean().exec();
    if (!comment) return null;

    const [post, author, reporter, reports] = await Promise.all([
      this.postModel
        .findById(comment.post_id)
        .populate('subject_id', 'name')
        .lean()
        .exec(),
      this.userModel
        .findById(comment.user_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.userModel
        .findById(report.reporter_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.reportModel
        .countDocuments({ comment_id: comment._id, state: 'open' })
        .exec(),
    ]);

    return {
      reportId: String(report._id),
      target: 'comment',
      postId: String(comment.post_id),
      commentId: String(comment._id),
      commentText: comment.text,
      authorId: String(comment.user_id),
      author: author?.username ?? '?',
      reporterId: String(report.reporter_id),
      reporter: reporter?.username ?? '?',
      reporterStrikes: reporter?.strikes ?? 0,
      subject: (post?.subject_id as unknown as { name?: string })?.name ?? '?',
      reason: report.reason,
      note: report.note,
      reports,
      strikes: author?.strikes ?? 0,
      hidden: !!comment.hiddenAt,
      createdAt: report.createdAt as unknown as Date,
    };
  }

  /** summarise(), for a report whose target is one feedback message. */
  private async summariseFeedback(
    report: Report & { _id: Types.ObjectId; createdAt?: Date },
  ): Promise<ReportSummary | null> {
    const feedback = await this.feedbackModel
      .findById(report.feedback_id)
      .populate('flashcard_id', 'title')
      .lean()
      .exec();
    if (!feedback) return null;

    const message = feedback.messages.find(
      (m) => String(m._id) === String(report.message_id),
    );
    if (!message) return null;

    const [author, reporter, reports] = await Promise.all([
      this.userModel
        .findById(message.user_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.userModel
        .findById(report.reporter_id, { username: 1, strikes: 1 })
        .lean()
        .exec(),
      this.reportModel
        .countDocuments({
          feedback_id: feedback._id,
          message_id: message._id,
          state: 'open',
        })
        .exec(),
    ]);

    return {
      reportId: String(report._id),
      target: 'feedback',
      postId: '',
      feedbackId: String(feedback._id),
      messageId: String(message._id),
      feedbackText: message.text,
      authorId: String(message.user_id),
      author: author?.username ?? '?',
      reporterId: String(report.reporter_id),
      reporter: reporter?.username ?? '?',
      reporterStrikes: reporter?.strikes ?? 0,
      subject: (feedback.flashcard_id as unknown as { title?: string })?.title ?? '?',
      reason: report.reason,
      note: report.note,
      reports,
      strikes: author?.strikes ?? 0,
      hidden: !!message.redactedAt,
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
   * Throws away the reports whose post, or whose comment, is not there any
   * more.
   *
   * A post goes when its subject does, a comment when its own author deletes
   * it, and the report about either outlives it as a row nobody can open, act
   * on, or clear - it would sit in the queue for ever. Done here, on the way
   * to reading the list, so there is no job to schedule and nothing to
   * remember.
   */
  private async forgetOrphans(): Promise<void> {
    const posts = await this.reportModel.distinct('post_id', { target: 'post' }).exec();
    if (posts.length) {
      const alive = await this.postModel.find({ _id: { $in: posts } }, { _id: 1 }).lean().exec();
      await this.forgetGone(posts, alive, 'post_id', 'posts');
    }

    const comments = await this.reportModel
      .distinct('comment_id', { target: 'comment' })
      .exec();
    if (comments.length) {
      const alive = await this.commentModel
        .find({ _id: { $in: comments } }, { _id: 1 })
        .lean()
        .exec();
      await this.forgetGone(comments, alive, 'comment_id', 'comments');
    }

    const feedbacks = await this.reportModel
      .distinct('feedback_id', { target: 'feedback' })
      .exec();
    if (feedbacks.length) {
      const alive = await this.feedbackModel
        .find({ _id: { $in: feedbacks } }, { _id: 1 })
        .lean()
        .exec();
      await this.forgetGone(feedbacks, alive, 'feedback_id', 'feedback exchanges');
    }
  }

  /** Deletes the reports pointing at whichever of `ids` are not in `alive`. */
  private async forgetGone(
    ids: Types.ObjectId[],
    alive: { _id: Types.ObjectId }[],
    field: 'post_id' | 'comment_id' | 'feedback_id',
    noun: string,
  ): Promise<void> {
    const living = new Set(alive.map((doc) => String(doc._id)));
    const gone = ids.filter((id) => !living.has(String(id)));
    if (!gone.length) return;

    const dropped = await this.reportModel.deleteMany({ [field]: { $in: gone } }).exec();
    this.logger.log(`${dropped.deletedCount} reports about deleted ${noun} dropped`);
  }

  /** One report, with the post - or the comment - as its readers see it. */
  async review(reportId: string): Promise<AdminReport | null> {
    const summary = await this.summarise(reportId);
    if (!summary) return null;

    const [report, author, reporter] = await Promise.all([
      this.reportModel.findById(reportId, { state: 1 }).lean().exec(),
      this.userModel
        .findById(summary.authorId, { bannedAt: 1, restrictions: 1 })
        .lean()
        .exec(),
      this.userModel
        .findById(summary.reporterId, { bannedAt: 1, restrictions: 1 })
        .lean()
        .exec(),
    ]);
    const reporterBanned = isBanned(reporter);

    if (summary.target === 'comment' || summary.target === 'feedback') {
      // No cards to draw here: the whole point being decided on is the one
      // comment, or the one message, already carried in the summary.
      return {
        ...summary,
        state: report?.state ?? 'open',
        banned: isBanned(author),
        reporterBanned,
        cards: [],
      };
    }

    const cards = await this.postService.cardsForReview(summary.postId, allCards);

    return {
      ...summary,
      state: report?.state ?? 'open',
      banned: isBanned(author),
      reporterBanned,
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

  /**
   * What a button on the page, or in the chat, comes down to.
   *
   * Whoever it was about goes on the front of the answer, and not only in the
   * report it came from: an admin acting on one warning after another only
   * has this sentence in front of them by the third or fourth, and "still no
   * block" says nothing on its own about whether it is the same account each
   * time.
   */
  async act(
    reportId: string,
    action: ModerationAction,
    against: ModerationSubject = 'author',
  ): Promise<Verdict> {
    const summary = await this.summarise(reportId);
    if (!summary) throw new NotFoundException('Report not found');

    if (against === 'reporter') {
      const verdict = await this.actOnReporter(summary, action);
      return { ...verdict, done: `${summary.reporter}: ${verdict.done}` };
    }

    const verdict = await this.actOn(summary, action);
    return { ...verdict, done: `${summary.author}: ${verdict.done}` };
  }

  private async actOn(summary: ReportSummary, action: ModerationAction): Promise<Verdict> {
    if (summary.target === 'comment') {
      const commentId = summary.commentId as string;
      if (action === 'keep' || action === 'restore') return this.keepComment(commentId);
      if (action === 'remove') return this.removeComment(commentId);
      if (action === 'warn') return this.warn(summary.authorId, summary.postId);
      return this.ban(summary.authorId);
    }

    if (summary.target === 'feedback') {
      const feedbackId = summary.feedbackId as string;
      const messageId = summary.messageId as string;
      if (action === 'keep' || action === 'restore') {
        return this.keepFeedbackMessage(feedbackId, messageId);
      }
      if (action === 'remove') return this.removeFeedbackMessage(feedbackId, messageId);
      if (action === 'warn') return this.warn(summary.authorId);
      return this.ban(summary.authorId);
    }

    if (action === 'keep') return this.keep(summary.postId);
    if (action === 'remove') return this.removePost(summary.postId);
    if (action === 'restore') return this.restore(summary.postId);
    if (action === 'warn') return this.warn(summary.authorId, summary.postId);
    return this.ban(summary.authorId);
  }

  /**
   * The same buttons, aimed at whoever filed the report instead of whoever it
   * is about.
   *
   * Only warn and ban make sense here: keep, remove and restore are decisions
   * about a piece of content, and the reporter did not write it. Left alone
   * rather than blocked: a bad choice of button on a report about the reporter
   * is a wrong click, but the account behind it is still real and still
   * whoever it always was.
   */
  private async actOnReporter(
    summary: ReportSummary,
    action: ModerationAction,
  ): Promise<Verdict> {
    if (action === 'warn') return this.warn(summary.reporterId);
    if (action === 'ban') return this.ban(summary.reporterId);
    throw new BadRequestException(`Cannot ${action} a reporter`);
  }

  // ------------------------------------------------------ what the admin does

  /**
   * The post stays: the reports on it are closed and it goes back up.
   *
   * Back up whether it went down on its own or by hand - saying "va bene"
   * about a post that stays invisible is the button lying.
   */
  async keep(postId: string): Promise<Verdict> {
    await this.closeReports(postId, 'kept');
    const back = await this.postModel
      .updateOne(
        { _id: postId, hiddenReason: { $in: ['reports', 'admin'] } },
        { $unset: { hiddenAt: '', hiddenReason: '' } },
      )
      .exec();

    return {
      done: back.modifiedCount
        ? 'Segnalazione chiusa, il post torna nel feed'
        : 'Segnalazione chiusa, il post era già nel feed',
      postId,
    };
  }

  /** Same idea as keep(), for one comment: it goes back into the thread. */
  async keepComment(commentId: string): Promise<Verdict> {
    await this.closeCommentReports(commentId, 'kept');
    const back = await this.commentModel
      .updateOne(
        { _id: commentId, hiddenReason: 'reports' },
        { $unset: { hiddenAt: '', hiddenReason: '' } },
      )
      .exec();

    return {
      done: back.modifiedCount
        ? 'Segnalazione chiusa, il commento torna visibile'
        : 'Segnalazione chiusa, il commento era già visibile',
    };
  }

  /**
   * The comment is gone for good, and its author is told which post it was
   * under and why.
   *
   * Unlike a post, kept around hidden so a decision can be undone, a comment
   * this small is not worth a permanent row once the decision is final -
   * there is nothing left to restore it to that keepComment() would not
   * already have handled while the report was still open.
   */
  async removeComment(commentId: string): Promise<Verdict> {
    const comment = await this.commentModel.findById(commentId).lean().exec();
    if (!comment) throw new NotFoundException('Comment not found');

    await this.commentModel.deleteOne({ _id: comment._id }).exec();
    await this.closeCommentReports(commentId, 'removed');

    await this.notificationService.record({
      userId: comment.user_id,
      kind: 'moderation',
      postId: comment.post_id,
      moderation: { event: 'commentRemoved', privileges: [] },
    });

    await this.sanctionModel.create({
      user_id: comment.user_id,
      kind: 'warning',
      post_id: comment.post_id,
      privileges: [],
      note: 'comment removed',
    });

    return { done: "Commento tolto, l'autore è stato avvisato" };
  }

  /** Same idea as keep(), for one feedback message: its text is put back. */
  async keepFeedbackMessage(feedbackId: string, messageId: string): Promise<Verdict> {
    await this.closeFeedbackReports(feedbackId, messageId, 'kept');
    const feedback = await this.feedbackModel.findById(feedbackId).lean().exec();
    const message = feedback?.messages.find((m) => String(m._id) === messageId);

    const back = await this.feedbackModel
      .updateOne(
        { _id: feedbackId, 'messages._id': messageId },
        { $unset: { 'messages.$.redactedAt': '' } },
      )
      .exec();
    if (back.modifiedCount && feedback && message) {
      await this.notificationService.restoreFeedbackPreview(feedback._id, message.text);
    }

    return {
      done: back.modifiedCount
        ? 'Segnalazione chiusa, il messaggio torna visibile'
        : 'Segnalazione chiusa, il messaggio era già visibile',
    };
  }

  /**
   * The message's text is redacted rather than removed from the array: the
   * exchange's turn order is worked out from how many messages it has, and
   * shortening it mid-conversation would hand the turn to the wrong side or
   * reopen a slot that had already been used.
   */
  async removeFeedbackMessage(feedbackId: string, messageId: string): Promise<Verdict> {
    const feedback = await this.feedbackModel.findById(feedbackId).lean().exec();
    if (!feedback) throw new NotFoundException('Feedback not found');
    const message = feedback.messages.find((m) => String(m._id) === messageId);
    if (!message) throw new NotFoundException('Message not found');

    await this.feedbackModel
      .updateOne(
        { _id: feedback._id, 'messages._id': message._id },
        { $set: { 'messages.$.redactedAt': new Date() } },
      )
      .exec();
    await this.closeFeedbackReports(feedbackId, messageId, 'removed');
    // The message went out as a notification already, and that copy does not
    // update itself just because the exchange behind it now does.
    await this.notificationService.redactFeedbackPreview(feedback._id, message.text);

    await this.notificationService.record({
      userId: message.user_id,
      kind: 'moderation',
      feedbackId: feedback._id as Types.ObjectId,
      moderation: { event: 'feedbackMessageRemoved', privileges: [] },
    });

    await this.sanctionModel.create({
      user_id: message.user_id,
      kind: 'warning',
      privileges: [],
      note: 'feedback message removed',
    });

    return { done: "Messaggio tolto, l'autore è stato avvisato" };
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

    // A warning climbs the strike ladder and rewrites restrictions to match
    // it - which, on somebody already serving a ban, would silently swap the
    // ban's own restriction for a shorter or even absent one. The ban is
    // already the harsher answer; there is nothing a warning adds to it.
    if (isBanned(user)) {
      throw new ConflictException('Account is already serving a ban');
    }

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
   * A week off the first time, a month the second, for good from the third:
   * everything they had shared goes back to being private, they cannot reach
   * anybody for as long as the ban lasts, and the address they signed up from
   * cannot open a new account for a few hours.
   */
  async ban(userId: string): Promise<Verdict> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    // Already serving one: a second ban now would only count as one more rung
    // climbed on a ladder the account is already partway up, for no reason
    // beyond a stray click. Nothing changes until the one already in force
    // runs out or is pardoned.
    if (isBanned(user)) {
      throw new ConflictException('Account is already serving a ban');
    }

    const previousBans = await this.sanctionModel
      .countDocuments({ user_id: user._id, kind: 'ban' })
      .exec();
    const until = banUntil(previousBans + 1) ?? undefined;

    // Set for good only when the ban itself is: a week or a month off is
    // still a restriction with an end, and bannedAt is reserved for the one
    // that has none - the ladder's last rung, not every rung on it.
    if (!until) user.bannedAt = new Date();
    user.restrictions = privileges.map((privilege) => ({
      privilege,
      until,
      reason: 'banned',
    }));
    await user.save();

    // Taken private the same way the author's own toggle would, rather than
    // merely hidden: reading the Community is still allowed, only sharing to
    // it is not, so what they had up there stops being public content.
    await this.subjectService.unpublishAll(String(user._id));

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
      until,
    });

    await this.notificationService.record({
      userId: user._id as Types.ObjectId,
      kind: 'moderation',
      moderation: { event: 'blocked', privileges: [...privileges], until },
    });

    return {
      done: until
        ? `Bannato fino al ${day(until)} — i suoi contenuti condivisi sono tornati privati`
        : 'Bannato per sempre — i suoi contenuti condivisi sono tornati privati',
    };
  }

  /**
   * The restrictions come off: the mistake this makes right is the admin's
   * own. What had gone private with the ban stays private - that was the
   * author's content and coming back is their own choice to make again, the
   * same as anything else they had ever taken back themselves.
   */
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
      done: `${user.username}: tutto ridato`,
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
        // Scoped to target: 'post', or deciding on the post would also close
        // out the still-open reports on its comments, which nobody has looked
        // at yet.
        { post_id: new Types.ObjectId(postId), target: 'post', state: { $ne: state } },
        { $set: { state, handledAt: new Date() } },
      )
      .exec();
    this.logger.log(`reports on post ${postId} closed as ${state}`);
  }

  /** Same idea as closeReports(), for the reports on one comment. */
  private async closeCommentReports(
    commentId: string,
    state: 'kept' | 'removed',
  ): Promise<void> {
    await this.reportModel
      .updateMany(
        { comment_id: new Types.ObjectId(commentId), state: { $ne: state } },
        { $set: { state, handledAt: new Date() } },
      )
      .exec();
    this.logger.log(`reports on comment ${commentId} closed as ${state}`);
  }

  /** Same idea as closeCommentReports(), for the reports on one message. */
  private async closeFeedbackReports(
    feedbackId: string,
    messageId: string,
    state: 'kept' | 'removed',
  ): Promise<void> {
    await this.reportModel
      .updateMany(
        {
          feedback_id: new Types.ObjectId(feedbackId),
          message_id: new Types.ObjectId(messageId),
          state: { $ne: state },
        },
        { $set: { state, handledAt: new Date() } },
      )
      .exec();
    this.logger.log(`reports on feedback message ${messageId} closed as ${state}`);
  }
}

/** True while a ban is still in force, whether it has an end date or not. */
function isBanned(user?: { bannedAt?: Date; restrictions?: { reason?: string; until?: Date }[] } | null): boolean {
  if (!user) return false;
  if (user.bannedAt) return true;
  const now = new Date();
  return !!user.restrictions?.some(
    (r) => r.reason === 'banned' && (!r.until || r.until > now),
  );
}

/** A date the way it is read here, since these sentences are read by a person. */
function day(value: Date): string {
  return value.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
