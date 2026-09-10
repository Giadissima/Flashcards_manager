import { PublishingService } from 'src/common/publishing.service';
import { Visibility } from 'src/common/visibility';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Subject, SubjectDocument } from './subject.schema';
import { ModifySubjectDto } from './subject.dto';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  assertValidObjectId,
  findOwnedOrThrow,
  updateOwnedOrThrow,
  findPaginated,
} from 'src/common/mongo.util';
import { FileService } from 'src/file/file.service';
import { PostService } from 'src/post/post.service';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Topic } from 'src/topic/topic.schema';

const ENTITY = 'Subject';

@Injectable()
export class SubjectService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    private readonly fileService: FileService,
    private readonly postService: PostService,
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    private readonly publishing: PublishingService,
  ) {}

  async create(
    userId: string,
    createSubjectDto: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void> {
    await this.publishing.assertMayPublish(userId, createSubjectDto.visibility);

    const icon_id = icon
      ? (await this.fileService.create([icon]))._id
      : undefined;
    const created = await new this.subjectModel({
      ...createSubjectDto,
      icon: icon_id,
      user_id: userId,
    }).save();

    await this.postService.refresh(userId, created._id as never);
  }

  findOne(userId: string, id: string): Promise<SubjectDocument> {
    return findOwnedOrThrow<SubjectDocument>(
      this.subjectModel,
      id,
      userId,
      ENTITY,
    );
  }

  findAll(
    userId: string,
    filter: ListFilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    // The owner is not one of the optional filters: it is the first thing every
    // query is narrowed by, so nobody can list what is not theirs.
    const query: FilterQuery<Subject> = { user_id: userId };
    if (filter.title) query.name = { $regex: filter.title, $options: 'i' };

    return findPaginated<SubjectDocument>(this.subjectModel, query, filter);
  }

  // Not routed through deleteByIdOrThrow: the icon has to go with the subject,
  // and the document has to be read before it disappears to know which file
  // that is.
  async delete(userId: string, id: string): Promise<void> {
    assertValidObjectId(id);

    const existing = await this.subjectModel
      .findOneAndDelete({ _id: id, user_id: userId })
      .exec();
    if (!existing) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    if (existing.icon) {
      await this.fileService.delete(existing.icon.toString());
    }

    // The subject is gone, so its post has nothing left to hang off
    await this.postService.refresh(userId, id);
  }

  // Not routed through updateByIdOrThrow: the previous icon has to be read
  // before the update and deleted only once the update succeeded.
  async update(
    userId: string,
    id: string,
    updateObj: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void> {
    assertValidObjectId(id);

    const existing = await this.subjectModel
      .findOne({ _id: id, user_id: userId })
      .exec();
    if (!existing) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    await this.publishing.assertMayPublish(userId, updateObj.visibility);

    const newIconId = icon
      ? (await this.fileService.create([icon]))._id
      : undefined;
    const previousIconId = existing.icon;

    const result = await this.subjectModel
      .findOneAndUpdate(
        { _id: id, user_id: userId },
        { ...updateObj, ...(newIconId ? { icon: newIconId } : {}) },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    // Drop the previous icon only once the update actually succeeded.
    if (newIconId && previousIconId) {
      await this.fileService.delete(previousIconId.toString());
    }

    // The form promises it too, not just the quick toggle in the list: it says
    // in so many words that the topics and the cards follow. Only on a change,
    // so that saving a name does not re-publish the cards their author had
    // taken back one by one.
    if (updateObj.visibility && updateObj.visibility !== existing.visibility) {
      await this.cascadeVisibility(userId, id, updateObj.visibility);
    }

    await this.postService.refresh(userId, id);
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
    await this.publishing.assertMayPublish(userId, visibility);
    await updateOwnedOrThrow(
      this.subjectModel,
      id,
      userId,
      { visibility },
      ENTITY,
    );
    await this.cascadeVisibility(userId, id, visibility);
    await this.postService.refresh(userId, id);
  }

  /**
   * Sets the spaced-repetition flag on every topic of the subject at once -
   * and, through the same cascade each topic's own toggle uses, on every
   * flashcard under them. It is a bulk write, not a flag of its own kept on
   * the subject: a subject with 15 topics is one click instead of 15, but
   * turning a single topic back off afterwards is still possible, and does
   * not "remember" as a mixed state here - the next click on this same
   * toggle simply sets every topic to the same value again.
   */
  async setSpacedRepetition(
    userId: string,
    id: string,
    enabled: boolean,
  ): Promise<void> {
    await findOwnedOrThrow<SubjectDocument>(this.subjectModel, id, userId, ENTITY);
    await Promise.all([
      this.topicModel
        .updateMany({ user_id: userId, subject_id: id }, { in_spaced_repetition: enabled })
        .exec(),
      this.flashcardModel
        .updateMany({ user_id: userId, subject_id: id }, { in_spaced_repetition: enabled })
        .exec(),
    ]);
  }

  /**
   * Takes every public subject of this user back to private, topics and
   * flashcards included - and with them, whatever posts they were holding up
   * in the feed.
   *
   * Used by a ban rather than by the person themselves, so nothing here asks
   * assertMayPublish: making something private needs nobody's permission.
   */
  async unpublishAll(userId: string): Promise<void> {
    const subjects = await this.subjectModel
      .find({ user_id: userId, visibility: 'public' }, { _id: 1 })
      .lean()
      .exec();

    await Promise.all([
      this.subjectModel
        .updateMany({ user_id: userId, visibility: 'public' }, { visibility: 'private' })
        .exec(),
      this.topicModel
        .updateMany({ user_id: userId, visibility: 'public' }, { visibility: 'private' })
        .exec(),
      this.flashcardModel
        .updateMany({ user_id: userId, visibility: 'public' }, { visibility: 'private' })
        .exec(),
    ]);

    await Promise.all(
      subjects.map((subject) => this.postService.refresh(userId, String(subject._id))),
    );
  }

  /**
   * Carries the choice down to everything under the subject.
   *
   * Both ways round, and the second is the one that matters: a subject shared
   * by mistake and then taken back has to take its topics and cards with it,
   * or they stay out in the open with nothing on screen to say so.
   */
  private async cascadeVisibility(
    userId: string,
    subjectId: string,
    visibility: Visibility,
  ): Promise<void> {
    const owned = { user_id: userId, subject_id: subjectId };
    // Imported cards are left behind when publishing: they are somebody else's
    // work. Taking a subject back still reaches them, since making something
    // private can only ever be the safer direction.
    const cards =
      visibility === 'public' ? { ...owned, imported: { $ne: true } } : owned;

    await Promise.all([
      this.topicModel.updateMany(owned, { visibility }).exec(),
      this.flashcardModel.updateMany(cards, { visibility }).exec(),
    ]);
  }

}
