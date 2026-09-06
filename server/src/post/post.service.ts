import { FeedFilterRequest, FeedPost } from './post.dto';
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
import { Vote } from './vote.schema';

const ENTITY = 'Post';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    @InjectModel(Vote.name) private voteModel: Model<Vote>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
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

    // On when the post first went up and not on when it last changed, whatever
    // the chosen order: "shared in March" is a fact about the post, while the
    // other date moves every time a card is added to it.
    //
    // The empty ones are left out here rather than deleted when they run dry:
    // a subject taken back by mistake would otherwise cost its author every
    // like and comment the post had earned, with no way back.
    const query: FilterQuery<Post> = { cardCount: { $gt: 0 } };
    const createdAt = dateRangeQuery(filter);
    if (createdAt) query.createdAt = createdAt;

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
  async importFlashcard(userId: string, cardId: string): Promise<void> {
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

    const subject_id = await this.mirrorSubject(owner, source);
    const topic_id = await this.mirrorTopic(owner, source, subject_id);
    const { question, answer } = await this.copyImages(source);

    await this.flashcardModel.create({
      title: source.title,
      question,
      answer,
      subject_id,
      topic_id,
      user_id: owner,
      visibility: 'private',
      imported: true,
      imported_from: source._id,
    });
  }

  /** The caller's own subject of the same name, created if they have none. */
  private async mirrorSubject(
    owner: Types.ObjectId,
    source: SourceCard,
  ): Promise<Types.ObjectId | undefined> {
    const name = source.subject_id?.name;
    if (!name) return undefined;

    const subject = await this.subjectModel
      .findOneAndUpdate(
        { user_id: owner, name },
        {
          $setOnInsert: {
            name,
            color: source.subject_id?.color,
            user_id: owner,
            visibility: 'private',
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    return subject._id as Types.ObjectId;
  }

  private async mirrorTopic(
    owner: Types.ObjectId,
    source: SourceCard,
    subject_id?: Types.ObjectId,
  ): Promise<Types.ObjectId | undefined> {
    const name = source.topic_id?.name;
    if (!name || !subject_id) return undefined;

    const topic = await this.topicModel
      .findOneAndUpdate(
        { user_id: owner, name, subject_id },
        {
          $setOnInsert: {
            name,
            color: source.topic_id?.color,
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
