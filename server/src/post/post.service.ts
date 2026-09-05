import { FeedFilterRequest, FeedPost } from './post.dto';
import { FilterQuery, Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';

import { BasePaginatedResult } from 'src/common.dto';
import { Flashcard, FlashcardDocument } from 'src/flashcards/flashcards.schema';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FileService } from 'src/file/file.service';
import { Subject } from 'src/subject/subject.schema';
import {
  extractImageFileIds,
  replaceImageFileIds,
} from 'src/common/html.util';
import { Topic } from 'src/topic/topic.schema';
import { NotificationService } from 'src/notification/notification.service';
import { Vote, VoteValue } from './vote.schema';

const ENTITY = 'Post';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    @InjectModel(Vote.name) private voteModel: Model<Vote>,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Rebuilds the post of one user and subject from what is public right now,
   * and drops it when nothing is.
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

    if (!wholeSubject && !topic_ids.length && !flashcard_ids.length) {
      await this.postModel.deleteOne({ user_id: owner, subject_id }).exec();
      return;
    }

    await this.postModel
      .findOneAndUpdate(
        { user_id: owner, subject_id },
        {
          $set: {
            scope: wholeSubject ? 'subject' : 'partial',
            topic_ids,
            flashcard_ids,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
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

    const [posts, count] = await Promise.all([
      this.postModel
        .find()
        .sort({ ...order, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('user_id', 'username avatar avatarColor')
        .populate('subject_id', 'name icon color')
        .populate('topic_ids', 'name color')
        .lean()
        .exec(),
      this.postModel.countDocuments(),
    ]);

    // The reader's own votes for this page in one query, rather than one per
    // post: the arrows have to show which way they already clicked
    const myVotes = await this.voteModel
      .find(
        {
          user_id: new Types.ObjectId(userId),
          post_id: { $in: posts.map((post) => post._id) },
        },
        { post_id: 1, value: 1 },
      )
      .lean()
      .exec();
    const voteByPost = new Map(
      myVotes.map((vote) => [String(vote.post_id), vote.value]),
    );

    const data = await Promise.all(
      posts.map((post) =>
        this.toFeedPost(
          post as unknown as PopulatedPost,
          voteByPost.get(String(post._id)) ?? 0,
        ),
      ),
    );
    return { data, count };
  }

  /**
   * Records how someone rated a post; 0 takes their vote back.
   *
   * The totals are recounted from the votes rather than nudged by one, so they
   * cannot drift from what was actually cast - and the recount deliberately
   * leaves updatedAt alone: a vote is not a change to the post, and bumping it
   * would shuffle the "recently updated" order every time somebody clicked.
   */
  async vote(userId: string, postId: string, value: number): Promise<void> {
    const post = await this.findOneOrThrow(postId);
    const user_id = new Types.ObjectId(userId);
    const post_id = post._id as Types.ObjectId;

    // Read before the change: an upvote already there is somebody clicking
    // twice, and the author has been told about it once already
    const previous = await this.voteModel
      .findOne({ user_id, post_id }, { value: 1 })
      .lean()
      .exec();

    if (value === 0) {
      await this.voteModel.deleteOne({ user_id, post_id }).exec();
    } else {
      await this.voteModel
        .findOneAndUpdate(
          { user_id, post_id },
          { $set: { value: value as VoteValue } },
          { upsert: true },
        )
        .exec();
    }

    const [upvotes, downvotes] = await Promise.all([
      this.voteModel.countDocuments({ post_id, value: 1 }),
      this.voteModel.countDocuments({ post_id, value: -1 }),
    ]);

    await this.postModel
      .updateOne(
        { _id: post_id },
        { $set: { upvotes, downvotes, score: upvotes - downvotes } },
        { timestamps: false },
      )
      .exec();
    if (value === 1 && previous?.value !== 1) {
      await this.notificationService.record({
        userId: post.user_id,
        actorId: userId,
        kind: 'upvote',
        postId: post_id,
      });
    }
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
  private visibleCardsQuery(post: Post): FilterQuery<Flashcard> {
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
    myVote: number,
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
      flashcardCount: await this.flashcardModel.countDocuments(
        this.visibleCardsQuery(post as unknown as Post),
      ),
      score: post.score ?? 0,
      myVote,
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
  score: number;
  createdAt: Date;
  updatedAt: Date;
}
