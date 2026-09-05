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
  ) {}

  async create(
    userId: string,
    createSubjectDto: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void> {
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

    await this.postService.refresh(userId, id);
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
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
    await Promise.all([
      this.topicModel.updateMany(owned, { visibility }).exec(),
      this.flashcardModel.updateMany(owned, { visibility }).exec(),
    ]);
  }

}
