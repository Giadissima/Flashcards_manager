import {
  FeedFilterRequest,
  FeedPost,
  ImportPostDto,
  ImportResult,
  ImportTargetDto,
  PostContents,
} from './post.dto';
import { nameMaxLength } from 'src/config';
import { FilterQuery, Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';

import { BasePaginatedResult, BasicFilterRequest } from 'src/common.dto';
import { dateRangeQuery } from 'src/common/date-range.util';
import { Flashcard, FlashcardDocument } from 'src/flashcards/flashcards.schema';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { FileService } from 'src/file/file.service';
import { Subject } from 'src/subject/subject.schema';
import {
  extractImageFileIds,
  replaceImageFileIds,
} from 'src/common/html.util';
import { Topic } from 'src/topic/topic.schema';
import { BadRequestException } from '@nestjs/common';
import { Comment } from './comment.schema';
import { Feedback, maxFeedbackMessages } from './feedback.schema';
import { NotificationService } from 'src/notification/notification.service';
import { RestrictionsService } from 'src/common/restrictions.service';
import { User } from 'src/auth/user.schema';
import { Vote } from './vote.schema';
import { escapeRegex } from 'src/common/regex.util';

const ENTITY = 'Post';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    @InjectModel(Vote.name) private voteModel: Model<Vote>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
    private readonly restrictions: RestrictionsService,
  ) {}

  /**
   * Rebuilds the post of one user and subject from what is public right now,
   * and hides it when nothing is.
   *
   * Recomputed rather than edited piece by piece on every change: an
   * incremental post drifts from the data the first time an update is missed,
   * and it is the kind of drift nobody notices until someone sees a flashcard
   * its author had taken back.
   */
  async refresh(userId: string, subjectId: string | Types.ObjectId): Promise<void> {
    const owner = new Types.ObjectId(userId);
    const subject_id = new Types.ObjectId(String(subjectId));
    const owned = { user_id: owner, visibility: 'public' };

    const subject = await this.subjectModel
      .findOne({ _id: subject_id, user_id: owner })
      .lean()
      .exec();
    // The subject is what a post hangs off: without it there is nothing to show
    if (!subject) {
      await this.postModel.deleteOne({ user_id: owner, subject_id }).exec();
      return;
    }

    const wholeSubject = subject.visibility === 'public';

    const topics = await this.topicModel
      .find({ ...owned, subject_id }, { _id: 1 })
      .lean()
      .exec();
    const topic_ids = topics.map((topic) => topic._id as Types.ObjectId);

    // Only the cards shared on their own: the ones already covered by a public
    // topic, or by the whole subject, need no separate mention
    const looseCards = wholeSubject
      ? []
      : await this.flashcardModel
          .find(
            {
              ...owned,
              subject_id,
              ...(topic_ids.length
                ? { topic_id: { $nin: topic_ids } }
                : {}),
            },
            { _id: 1 },
          )
          .lean()
          .exec();
    const flashcard_ids = looseCards.map((card) => card._id as Types.ObjectId);

    // What the carousel would actually hold. Counted rather than inferred from
    // the three ids above, since a public topic holding no public cards comes
    // to the same nothing - and stored, because a post with nothing in it is a
    // heading over an empty box and has no business in the feed.
    const cardCount = await this.flashcardModel.countDocuments(
      this.visibleCardsQuery({
        user_id: owner,
        subject_id,
        scope: wholeSubject ? 'subject' : 'partial',
        topic_ids,
        flashcard_ids,
      }),
    );

    const state = {
      $set: {
        scope: wholeSubject ? 'subject' : 'partial',
        topic_ids,
        flashcard_ids,
        cardCount,
      },
    };

    // Never created empty, but kept once it exists. A post nobody has ever
    // seen is nothing to keep, and every private subject would otherwise leave
    // one behind; a post that has been up has likes and comments on it, and
    // running dry must not cost them.
    if (cardCount) {
      await this.postModel
        .findOneAndUpdate({ user_id: owner, subject_id }, state, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        })
        .exec();
    } else {
      await this.postModel
        .updateOne({ user_id: owner, subject_id }, state)
        .exec();
    }
  }

  /**
   * The feed. Not scoped to the caller, unlike everything else in the app: it
   * is the one place that shows other people's work, and what makes that safe
   * is that a post only ever exists for something marked public.
   */
  async findFeed(
    userId: string,
    filter: FeedFilterRequest,
  ): Promise<BasePaginatedResult<FeedPost>> {
    // A tie on score falls back to the newest, so the popular order does not
    // freeze on whichever post happened to be inserted first
    const order: Record<string, 1 | -1> =
      filter.sort === 'popular'
        ? { score: -1, createdAt: -1 }
        : filter.sort === 'updated'
          ? { updatedAt: -1 }
          : { createdAt: -1 };

    // The empty ones are left out here rather than deleted when they run dry:
    // a subject taken back by mistake would otherwise cost its author every
    // like and comment the post had earned, with no way back.
    const query: FilterQuery<Post> = { cardCount: { $gt: 0 } };

    // Which date the range reads is the caller's to say, and independent of
    // the order: when the post went up is a fact that stays put, while when it
    // last changed moves every time a card is added to it. Creation is the
    // default, being the one date every post has only one of.
    const range = dateRangeQuery(filter);
    if (range) {
      query[filter.dateField === 'updated' ? 'updatedAt' : 'createdAt'] = range;
    }

    const authors = await this.authorsStudying(filter);
    if (authors) query.user_id = { $in: authors };

    const found = await this.searchQuery(filter.search);
    if (found) query.$or = found;

    const [posts, count] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ ...order, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('user_id', 'username avatar avatarColor')
        .populate('subject_id', 'name icon color')
        .populate('topic_ids', 'name color')
        .lean()
        .exec(),
      this.postModel.countDocuments(query),
    ]);

    // The reader's own likes for this page in one query, rather than one per
    // post: the button has to show whether they have already clicked it
    const myLikes = await this.voteModel
      .find(
        {
          user_id: new Types.ObjectId(userId),
          post_id: { $in: posts.map((post) => post._id) },
        },
        { post_id: 1 },
      )
      .lean()
      .exec();
    const likedPosts = new Set(myLikes.map((like) => String(like.post_id)));

    // Grouped in one query for the whole page rather than counted per post:
    // the number belongs on the button before anyone opens it, and asking for
    // it post by post would be a round trip each
    const commentCounts = await this.commentModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $match: { post_id: { $in: posts.map((post) => post._id) } } },
      { $group: { _id: '$post_id', count: { $sum: 1 } } },
    ]);
    const commentsByPost = new Map(
      commentCounts.map((row) => [String(row._id), row.count]),
    );

    const data = await Promise.all(
      posts.map((post) =>
        this.toFeedPost(
          post as unknown as PopulatedPost,
          likedPosts.has(String(post._id)),
          commentsByPost.get(String(post._id)) ?? 0,
        ),
      ),
    );
    return { data, count };
  }

  /**
   * The people a feed filtered by university and course is about, or null when
   * it was not filtered by either.
   *
   * Looked up as a list of ids rather than joined onto the posts: the feed
   * reads them with populate, and turning it into an aggregation to reach one
   * field of the author would mean rewriting the sort, the paging and the
   * count around it. The list is a student body, not the web.
   */
  private async authorsStudying(
    filter: FeedFilterRequest,
  ): Promise<Types.ObjectId[] | null> {
    const query: FilterQuery<User> = {};
    if (filter.universityCode) query.universityCode = filter.universityCode;
    if (filter.course) query.course = filter.course;
    if (filter.courseKind) query.courseKind = filter.courseKind;

    if (!Object.keys(query).length) return null;

    const users = await this.userModel.find(query, { _id: 1 }).lean().exec();
    return users.map((user) => user._id as Types.ObjectId);
  }

  /**
   * One search term against the three things a post is known by: who shared
   * it, the subject it is on, and the topics it covers.
   *
   * Three collections asked separately and matched by id, because not one of
   * those names is on the post itself - the header builds them from what it
   * populates. Written as an $or, so a word that is a subject to one person
   * and a topic to another finds both.
   */
  private async searchQuery(
    term: string | undefined,
  ): Promise<FilterQuery<Post>[] | null> {
    if (!term) return null;

    const like = { $regex: escapeRegex(term), $options: 'i' };
    const [users, subjects, topics] = await Promise.all([
      this.userModel.find({ username: like }, { _id: 1 }).lean().exec(),
      this.subjectModel.find({ name: like }, { _id: 1 }).lean().exec(),
      this.topicModel.find({ name: like }, { _id: 1 }).lean().exec(),
    ]);

    return [
      { user_id: { $in: users.map((user) => user._id) } },
      { subject_id: { $in: subjects.map((subject) => subject._id) } },
      { topic_ids: { $in: topics.map((topic) => topic._id) } },
    ];
  }

  /**
   * Adds the caller's like to a post, or takes it back.
   *
   * The total is recounted from the likes rather than nudged by one, so it
   * cannot drift from what was actually given - and the recount deliberately
   * leaves updatedAt alone: a like is not a change to the post, and bumping it
   * would shuffle the "recently updated" order every time somebody clicked.
   */
  async setLike(userId: string, postId: string, liked: boolean): Promise<void> {
    const post = await this.findOneOrThrow(postId);
    const user_id = new Types.ObjectId(userId);
    const post_id = post._id as Types.ObjectId;

    // Nobody likes their own post. The number stands for what other people
    // made of it, and one the author can raise on their own says nothing.
    if (String(post.user_id) === userId) {
      throw new ForbiddenException('You cannot like your own post');
    }

    // Read before the change: a like already there is somebody clicking twice,
    // and the author has been told about it once already
    const previous = await this.voteModel
      .findOne({ user_id, post_id }, { _id: 1 })
      .lean()
      .exec();

    if (liked) {
      await this.voteModel
        .updateOne(
          { user_id, post_id },
          { $setOnInsert: { user_id, post_id } },
          { upsert: true },
        )
        .exec();
    } else {
      await this.voteModel.deleteOne({ user_id, post_id }).exec();
    }

    const score = await this.voteModel.countDocuments({ post_id });
    await this.postModel
      .updateOne({ _id: post_id }, { $set: { score } }, { timestamps: false })
      .exec();

    if (liked && !previous) {
      await this.notificationService.record({
        userId: post.user_id,
        actorId: userId,
        kind: 'upvote',
        postId: post_id,
      });
    }
  }

  // ---------------------------------------------------------------- comments

  async findComments(
    postId: string,
    filter: { skip: number; limit: number },
  ): Promise<BasePaginatedResult<Comment>> {
    const post_id = new Types.ObjectId(postId);

    const [data, count] = await Promise.all([
      this.commentModel
        .find({ post_id })
        .sort({ createdAt: -1, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('user_id', 'username avatar avatarColor')
        .lean()
        .exec(),
      this.commentModel.countDocuments({ post_id }),
    ]);
    return { data: data as unknown as Comment[], count };
  }

  async addComment(userId: string, postId: string, text: string): Promise<void> {
    await this.restrictions.assertMay(userId, 'comment');
    const post = await this.findOneOrThrow(postId);

    await this.commentModel.create({
      post_id: post._id,
      user_id: new Types.ObjectId(userId),
      text,
    });

    await this.notificationService.record({
      userId: post.user_id,
      actorId: userId,
      kind: 'comment',
      postId: post._id as Types.ObjectId,
      preview: text,
    });
  }

  /** Only by whoever wrote it. */
  async deleteComment(userId: string, commentId: string): Promise<void> {
    const result = await this.commentModel
      .deleteOne({
        _id: new Types.ObjectId(commentId),
        user_id: new Types.ObjectId(userId),
      })
      .exec();
    if (!result.deletedCount) {
      throw new NotFoundException(`Comment with id ${commentId} not found`);
    }
  }

  // ---------------------------------------------------------------- feedback

  /** Opens a private thread about one flashcard, for whoever wrote it. */
  async createFeedback(
    userId: string,
    flashcardId: string,
    text: string,
  ): Promise<void> {
    await this.restrictions.assertMay(userId, 'feedback');

    const reporter_id = new Types.ObjectId(userId);
    const card = await this.flashcardModel
      .findOne({ _id: flashcardId, visibility: 'public' }, { user_id: 1 })
      .lean()
      .exec();
    if (!card) {
      throw new NotFoundException(`Flashcard with id ${flashcardId} not found`);
    }
    if (String(card.user_id) === userId) {
      throw new BadRequestException('This flashcard is yours');
    }

    const existing = await this.feedbackModel
      .exists({ reporter_id, flashcard_id: card._id })
      .exec();
    if (existing) {
      throw new ConflictException('You already reported this flashcard');
    }

    const feedback = await this.feedbackModel.create({
      flashcard_id: card._id,
      reporter_id,
      author_id: card.user_id,
      messages: [{ user_id: reporter_id, text, createdAt: new Date() }],
    });

    await this.notificationService.record({
      userId: card.user_id,
      actorId: userId,
      kind: 'feedback',
      feedbackId: feedback._id as Types.ObjectId,
      preview: text,
    });
  }

  /**
   * Adds the one reply each side is allowed, in turn.
   *
   * The order is checked here and not left to the interface: the cap is what
   * keeps this from becoming a chat, and a rule only the buttons know is no
   * rule at all.
   */
  async replyToFeedback(
    userId: string,
    feedbackId: string,
    text: string,
  ): Promise<void> {
    const feedback = await this.feedbackModel.findById(feedbackId).exec();
    const me = new Types.ObjectId(userId);
    const mine =
      feedback &&
      (feedback.author_id.equals(me) || feedback.reporter_id.equals(me));
    // Someone else's thread is not found rather than forbidden: a 403 would
    // confirm it exists
    if (!feedback || !mine) {
      throw new NotFoundException(`Feedback with id ${feedbackId} not found`);
    }

    if (feedback.messages.length >= maxFeedbackMessages) {
      throw new BadRequestException('This exchange is closed');
    }

    // The second message is the author's, the third the reporter's answer
    const expected =
      feedback.messages.length === 1 ? feedback.author_id : feedback.reporter_id;
    if (!expected.equals(me)) {
      throw new BadRequestException('It is not your turn to write');
    }

    feedback.messages.push({ user_id: me, text, createdAt: new Date() });
    await feedback.save();

    const other = feedback.author_id.equals(me)
      ? feedback.reporter_id
      : feedback.author_id;
    await this.notificationService.record({
      userId: other,
      actorId: userId,
      kind: 'feedback',
      feedbackId: feedback._id as Types.ObjectId,
      preview: text,
    });
  }

  /**
   * The reports still waiting on the caller, newest first.
   *
   * Kept apart from the notification list rather than filtered out of it: a
   * notification is something that happened once and is then read, while an
   * open report is a thing still to do. Mixing them means the second is lost
   * among the first the moment a post gets a few likes.
   */
  async findOpenFeedback(
    userId: string,
    filter: BasicFilterRequest,
  ): Promise<BasePaginatedResult<Feedback>> {
    const query = {
      author_id: new Types.ObjectId(userId),
      resolved: false,
    };

    const [data, count] = await Promise.all([
      this.feedbackModel
        .find(query)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('flashcard_id', 'title')
        .populate('messages.user_id', 'username')
        .lean()
        .exec(),
      this.feedbackModel.countDocuments(query),
    ]);
    return { data: data as unknown as Feedback[], count };
  }

  /**
   * The author marking a report as dealt with, and telling whoever raised it.
   *
   * That notification is the point of the whole thing: someone who sends a
   * correction and never learns whether it landed stops sending them after
   * two or three tries.
   */
  async resolveFeedback(userId: string, feedbackId: string): Promise<void> {
    const me = new Types.ObjectId(userId);
    const feedback = await this.feedbackModel
      .findOne({ _id: new Types.ObjectId(feedbackId), author_id: me })
      .exec();
    // Only the author closes one: it is their inbox. Anybody else is told it
    // does not exist rather than that they may not.
    if (!feedback) {
      throw new NotFoundException(`Feedback with id ${feedbackId} not found`);
    }
    if (feedback.resolved) return;

    feedback.resolved = true;
    await feedback.save();

    await this.notificationService.record({
      userId: feedback.reporter_id,
      actorId: userId,
      kind: 'resolved',
      feedbackId: feedback._id as Types.ObjectId,
    });
  }

  /** One thread, readable only by the two people in it. */
  async findFeedback(userId: string, feedbackId: string): Promise<Feedback> {
    const me = new Types.ObjectId(userId);
    const feedback = await this.feedbackModel
      .findOne({
        _id: new Types.ObjectId(feedbackId),
        $or: [{ author_id: me }, { reporter_id: me }],
      })
      .populate('flashcard_id', 'title')
      .populate('messages.user_id', 'username')
      .lean()
      .exec();
    if (!feedback) {
      throw new NotFoundException(`Feedback with id ${feedbackId} not found`);
    }
    return feedback as unknown as Feedback;
  }


  /** One page of the carousel. */
  async findFlashcards(
    postId: string,
    skip: number,
    limit: number,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    const post = await this.findOneOrThrow(postId);
    const query = this.visibleCardsQuery(post);

    const [data, count] = await Promise.all([
      this.flashcardModel
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate(['topic_id', 'subject_id'])
        .exec(),
      this.flashcardModel.countDocuments(query),
    ]);
    return { data: data as FlashcardDocument[], count };
  }

  /**
   * Copies a public flashcard into the caller's own library.
   *
   * The copy is marked imported and can never be published again: the point of
   * taking someone's card is to study it, not to pass it on as one's own.
   *
   * Its subject and topic are recreated by name under the caller, the way the
   * zip import already does, so the card lands somewhere that makes sense
   * instead of loose at the top of the library.
   */
  async importFlashcard(
    userId: string,
    cardId: string,
    dto: ImportTargetDto,
  ): Promise<void> {
    const owner = new Types.ObjectId(userId);
    const source = (await this.flashcardModel
      .findOne({ _id: cardId, visibility: 'public' })
      .populate(['subject_id', 'topic_id'])
      .lean()
      .exec()) as SourceCard | null;
    if (!source) {
      throw new NotFoundException(`Flashcard with id ${cardId} not found`);
    }
    if (String(source.user_id) === userId) {
      throw new ConflictException('This flashcard is already yours');
    }

    const already = await this.flashcardModel
      .exists({ user_id: owner, imported_from: source._id })
      .exec();
    if (already) {
      throw new ConflictException('This flashcard was already imported');
    }

    // The same two steps a whole set goes through, over a list of one: a card
     // taken on its own lands in the same library and has to answer the same
     // questions, the one about a topic name already in use included.
    const subject_id = await this.importTarget(owner, source.subject_id?._id, dto);
    const topicOf = await this.importTopics(owner, subject_id, [source], dto);
    const { question, answer } = await this.copyImages(source);

    await this.flashcardModel.create({
      title: source.title,
      question,
      answer,
      subject_id,
      topic_id: topicOf(source),
      user_id: owner,
      visibility: 'private',
      imported: true,
      imported_from: source._id,
    });
  }


  /**
   * The tree the import dialog is drawn from: the topics of a post that
   * actually hold shared cards, and how many each holds.
   *
   * Read from the cards and not from the post's topic list: a topic shared
   * whole but emptied since would otherwise be offered with nothing in it.
   */
  async findContents(userId: string, postId: string): Promise<PostContents> {
    const post = await this.findOneOrThrow(postId);
    const subject = await this.subjectModel
      .findById(post.subject_id, { name: 1, color: 1 })
      .lean()
      .exec();

    const cards = await this.flashcardModel
      .find(this.visibleCardsQuery(post), { _id: 1, topic_id: 1 })
      .lean()
      .exec();

    // Counted by topic, and a card under none is not counted at all: one
    // cannot be made any more, and the few left from before are not something
    // to hand on to somebody else's library.
    const counts = new Map<string, number>();
    for (const card of cards) {
      if (!card.topic_id) continue;
      const key = String(card.topic_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const topics = await this.topicModel
      .find({ _id: { $in: [...counts.keys()] } }, { name: 1, color: 1 })
      .lean()
      .exec();

    // What the reader already holds, so the dialog can say up front how much
    // of the set would actually be new to them
    const alreadyImported = await this.flashcardModel
      .countDocuments({
        user_id: new Types.ObjectId(userId),
        imported_from: { $in: cards.map((card) => card._id) },
      })
      .exec();

    return {
      subject: {
        _id: String(post.subject_id),
        name: subject?.name ?? '',
        color: subject?.color,
      },
      topics: topics
        .map((topic) => ({
          _id: String(topic._id),
          name: topic.name,
          color: topic.color,
          cardCount: counts.get(String(topic._id)) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      total: [...counts.values()].reduce((sum, n) => sum + n, 0),
      alreadyImported,
    };
  }

  /**
   * Copies a whole set of shared cards into the reader's own library.
   *
   * The same copy as importFlashcard, done in bulk: private, marked as
   * imported, with images of its own. What this adds is the choosing - which
   * topics to take, which subject of theirs to put them in, and what to do
   * with a topic name they already use - because a set of two hundred cards
   * lands in a library that is already organised, and dropping it in under the
   * author's own names would be reorganising somebody else's shelf.
   */
  async importPost(
    userId: string,
    postId: string,
    dto: ImportPostDto,
  ): Promise<ImportResult> {
    const owner = new Types.ObjectId(userId);
    const post = await this.findOneOrThrow(postId);
    if (String(post.user_id) === userId) {
      throw new ConflictException('This post is your own');
    }

    const chosenTopics = (dto.topicIds ?? []).map((id) => new Types.ObjectId(id));
    if (!chosenTopics.length) {
      throw new BadRequestException('Choose at least one topic to import');
    }

    // The post's own rule on what is visible, and on top of it what was ticked
    const sources = (await this.flashcardModel
      .find({
        $and: [
          this.visibleCardsQuery(post),
          { topic_id: { $in: chosenTopics } },
        ],
      })
      .populate(['subject_id', 'topic_id'])
      .lean()
      .exec()) as unknown as SourceCard[];

    if (!sources.length) return { imported: 0, skipped: 0, subjectId: '' };

    // Taken once and only once: a second import of the same set adds what has
    // been shared since and leaves the rest alone
    const mine = await this.flashcardModel
      .find(
        {
          user_id: owner,
          imported_from: { $in: sources.map((card) => card._id) },
        },
        { imported_from: 1 },
      )
      .lean()
      .exec();
    const already = new Set(mine.map((card) => String(card.imported_from)));
    const fresh = sources.filter((card) => !already.has(String(card._id)));

    const subject_id = await this.importTarget(owner, post.subject_id, dto);
    const topicOf = await this.importTopics(owner, subject_id, fresh, dto);

    const copies: Record<string, unknown>[] = [];
    for (const source of fresh) {
      const { question, answer } = await this.copyImages(source);
      copies.push({
        title: source.title,
        question,
        answer,
        subject_id,
        topic_id: topicOf(source),
        user_id: owner,
        visibility: 'private',
        imported: true,
        imported_from: source._id,
      });
    }
    if (copies.length) await this.flashcardModel.insertMany(copies);

    return {
      imported: copies.length,
      skipped: sources.length - copies.length,
      subjectId: String(subject_id),
    };
  }

  /** The subject the copies land in: one of the reader's own, or a new one. */
  private async importTarget(
    owner: Types.ObjectId,
    sourceSubjectId: Types.ObjectId | undefined,
    dto: ImportTargetDto,
  ): Promise<Types.ObjectId> {
    if (dto.subjectId) {
      const mine = await this.subjectModel
        .findOne({ _id: dto.subjectId, user_id: owner }, { _id: 1 })
        .lean()
        .exec();
      if (!mine) throw new NotFoundException('Subject not found');
      return mine._id as Types.ObjectId;
    }

    const name = dto.subjectName?.trim();
    if (!name) throw new BadRequestException('Name the subject to create');

    // Refused rather than renamed behind their back: the reader has that name
    // on a shelf already, and which of the two they meant is theirs to say -
    // the dialog offers it in the same dropdown.
    const clash = await this.subjectModel
      .findOne({ user_id: owner, name }, { _id: 1 })
      .lean()
      .exec();
    if (clash) throw new ConflictException('You already have a subject with this name');

    const source = sourceSubjectId
      ? await this.subjectModel.findById(sourceSubjectId, { color: 1 }).lean().exec()
      : null;
    const created = await this.subjectModel.create({
      name,
      color: source?.color,
      user_id: owner,
      visibility: 'private',
    });
    return created._id as Types.ObjectId;
  }

  /**
   * Works out, once for the whole set, which topic of the reader's each card
   * goes under, and creates the ones that have to exist.
   *
   * Returns a lookup rather than doing it card by card: a hundred cards of the
   * same topic would otherwise be a hundred round trips to find the same one.
   */
  private async importTopics(
    owner: Types.ObjectId,
    subject_id: Types.ObjectId,
    sources: SourceCard[],
    dto: ImportTargetDto,
  ): Promise<(card: SourceCard) => Types.ObjectId> {
    if (dto.topicMode === 'single') {
      const name = dto.topicName?.trim();
      if (!name) throw new BadRequestException('Name the topic to import into');
      const single = await this.findOrCreateTopic(owner, subject_id, name);
      return () => single;
    }

    // A copy is a card like any other and needs a topic like any other. Cards
    // made before that was enforced are refused rather than copied without
    // one: taking them in would put back exactly what this closes.
    if (sources.some((card) => !card.topic_id)) {
      throw new BadRequestException('This flashcard is under no topic');
    }

    // keep: one of theirs per one of the author's, by name
    const byName = new Map<string, Types.ObjectId>();
    const mapped = new Map<string, Types.ObjectId>();
    for (const source of sources) {
      const topic = source.topic_id;
      if (!topic?.name || mapped.has(String(topic._id))) continue;

      let target = byName.get(topic.name);
      if (!target) {
        const existing = await this.topicModel
          .findOne({ user_id: owner, subject_id, name: topic.name }, { _id: 1 })
          .lean()
          .exec();

        target =
          existing && dto.onCollision !== 'rename'
            ? (existing._id as Types.ObjectId)
            : await this.findOrCreateTopic(
                owner,
                subject_id,
                existing
                  ? await this.renamedTo(owner, subject_id, topic, dto)
                  : topic.name,
                topic.color,
              );
        byName.set(topic.name, target);
      }
      mapped.set(String(topic._id), target);
    }

    return (card: SourceCard) =>
      mapped.get(String(card.topic_id?._id)) as Types.ObjectId;
  }

  private async findOrCreateTopic(
    owner: Types.ObjectId,
    subject_id: Types.ObjectId,
    name: string,
    color?: string,
  ): Promise<Types.ObjectId> {
    const topic = await this.topicModel
      .findOneAndUpdate(
        { user_id: owner, subject_id, name },
        {
          $setOnInsert: {
            name,
            color,
            subject_id,
            user_id: owner,
            visibility: 'private',
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    return topic._id as Types.ObjectId;
  }

  /**
   * What a topic whose name is taken is to be called instead: what the reader
   * typed in the dialog, or a numbered name when they were not asked - a call
   * that can reach here without one, and a set half imported would be worse
   * than a topic with a dull name.
   */
  private async renamedTo(
    owner: Types.ObjectId,
    subject_id: Types.ObjectId,
    topic: { _id: Types.ObjectId; name?: string },
    dto: ImportTargetDto,
  ): Promise<string> {
    const asked = dto.renames?.find(
      (rename) => rename.topicId === String(topic._id),
    )?.name;
    return (
      asked?.trim() ||
      (await this.freeTopicName(owner, subject_id, topic.name ?? ''))
    );
  }

  /** "Analisi", "Analisi (2)", "Analisi (3)" - the first one nobody is using. */
  private async freeTopicName(
    owner: Types.ObjectId,
    subject_id: Types.ObjectId,
    base: string,
  ): Promise<string> {
    for (let n = 2; n < 100; n++) {
      const suffix = ` (${n})`;
      // Trimmed from the base and not from the suffix, which is what tells the
      // two apart when a long name is at the limit
      const name =
        base.slice(0, nameMaxLength - suffix.length).trimEnd() + suffix;
      const taken = await this.topicModel
        .exists({ user_id: owner, subject_id, name })
        .exec();
      if (!taken) return name;
    }
    throw new ConflictException('Too many topics with this name');
  }

  /**
   * Gives the copy its own image files. Sharing them with the original would
   * break the rule the whole app rests on - one file, one flashcard - and the
   * day the author deleted their card it would take the images out of every
   * copy with it.
   */
  private async copyImages(
    source: SourceCard,
  ): Promise<{ question: string; answer: string }> {
    const ids = [
      ...new Set([
        ...extractImageFileIds(source.question),
        ...extractImageFileIds(source.answer),
      ]),
    ];
    if (!ids.length) return { question: source.question, answer: source.answer };

    const idMap = new Map<string, string>();
    for (const fileId of ids) {
      const copyId = await this.fileService.duplicate(fileId);
      if (copyId) idMap.set(fileId, copyId);
    }

    return {
      question: replaceImageFileIds(source.question, idMap),
      answer: replaceImageFileIds(source.answer, idMap),
    };
  }

  private async findOneOrThrow(postId: string): Promise<PostDocument> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException(`${ENTITY} with id ${postId} not found`);
    }
    return post;
  }

  /**
   * The cards a post shows. Read from their own visibility every time rather
   * than from a stored list, so a card taken back stops appearing at once.
   */
  private visibleCardsQuery(
    post: Pick<
      Post,
      'user_id' | 'subject_id' | 'scope' | 'topic_ids' | 'flashcard_ids'
    >,
  ): FilterQuery<Flashcard> {
    const base = {
      user_id: post.user_id,
      subject_id: post.subject_id,
      visibility: 'public',
    };
    if (post.scope === 'subject') return base;

    return {
      ...base,
      $or: [
        { topic_id: { $in: post.topic_ids } },
        { _id: { $in: post.flashcard_ids } },
      ],
    };
  }

  /**
   * The topics named beside the subject in the header. Not just the ones shared
   * whole: a post made of loose flashcards has none of those, and the sketch
   * still reads "subject - topic", so the topics those cards sit on count too.
   */
  private async headerTopics(
    post: PopulatedPost,
  ): Promise<{ _id: string; name: string; color?: string }[]> {
    const shared = post.topic_ids.map((topic) => ({
      _id: String(topic._id),
      name: topic.name,
      color: topic.color,
    }));

    const fromCards = await this.flashcardModel
      .distinct('topic_id', {
        ...this.visibleCardsQuery(post as unknown as Post),
        topic_id: { $nin: post.topic_ids, $ne: null },
      })
      .exec();
    if (!fromCards.length) return shared;

    const extra = await this.topicModel
      .find({ _id: { $in: fromCards } }, { name: 1, color: 1 })
      .lean()
      .exec();

    return [
      ...shared,
      ...extra.map((topic) => ({
        _id: String(topic._id),
        name: topic.name,
        color: topic.color,
      })),
    ];
  }

  private async toFeedPost(
    post: PopulatedPost,
    liked: boolean,
    commentCount: number,
  ): Promise<FeedPost> {
    const wholeSubject = post.scope === 'subject';
    return {
      _id: String(post._id),
      author: {
        _id: String(post.user_id._id),
        username: post.user_id.username,
        avatar: post.user_id.avatar,
        avatarColor: post.user_id.avatarColor,
      },
      subject: {
        _id: String(post.subject_id._id),
        name: post.subject_id.name,
        icon: post.subject_id.icon,
        color: post.subject_id.color,
      },
      // The header names the subject alone when all of it is shared
      topics: wholeSubject ? [] : await this.headerTopics(post),
      wholeSubject,
      flashcardCount: post.cardCount ?? 0,
      commentCount,
      likes: post.score ?? 0,
      liked,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}

/** The card being imported, with its subject and topic populated. */
interface SourceCard {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  title: string;
  question: string;
  answer: string;
  subject_id?: { _id: Types.ObjectId; name?: string; color?: string };
  topic_id?: { _id: Types.ObjectId; name?: string; color?: string };
}

/** The shape the three populate() calls above leave behind. */
interface PopulatedPost {
  _id: Types.ObjectId;
  scope: string;
  user_id: {
    _id: Types.ObjectId;
    username: string;
    avatar?: string;
    avatarColor?: string;
  };
  subject_id: {
    _id: Types.ObjectId;
    name: string;
    icon?: string;
    color?: string;
  };
  topic_ids: { _id: Types.ObjectId; name: string; color?: string }[];
  flashcard_ids: Types.ObjectId[];
  cardCount: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}
