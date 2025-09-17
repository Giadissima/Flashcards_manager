import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  BasePaginatedResult,
  FilterRequest,
  shuffleArray,
  validateObjectIdParam,
} from 'src/common.dto';

import { Flashcard, FlashcardDocument } from 'src/flashcards/flashcards.schema';
import { Test, TestDocument } from './test.schema';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { TestFiltersRequest } from './test.dto';

@Injectable()
export class TestService {
  constructor(
    @InjectModel(Test.name) private testModel: Model<Test>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
  ) {}

  // TODO devo trovare un modo per filtrare solo le domande che non hanno categoria
  async create(filters: TestFiltersRequest): Promise<TestDocument> {
    const numQuestions = filters.max_answer ?? 50;
    const questionsArrays: { _id: Types.ObjectId }[] = [];

    const groupIds = filters.groups?.map((id) => new Types.ObjectId(id)) ?? [];
    const subjectId = filters.subject
      ? new Types.ObjectId(filters.subject)
      : null;

    if (!subjectId && groupIds.length === 0) {
      // ? caso: nessun filtro, prendo domande random
      const randomQuestions: { _id: Types.ObjectId }[] =
        await this.flashcardModel.aggregate([
          { $sample: { size: numQuestions } },
          { $project: { _id: 1 } },
        ]);
      questionsArrays.push(...randomQuestions);
    } else if (subjectId && groupIds.length === 0) {
      // ? caso: solo subject, prendo domande di una certa materia
      const questions: { _id: Types.ObjectId }[] =
        await this.flashcardModel.aggregate([
          { $match: { subject_id: subjectId } },
          { $sample: { size: numQuestions } },
          { $project: { _id: 1 } },
        ]);
      questionsArrays.push(...questions);
    } else if (subjectId && groupIds.length > 0) {
      // ? caso: subject + gruppi, prendo domande di una certa materia e solo di alcuni argomenti
      const perGroupLimit = Math.floor(numQuestions / groupIds.length);
      for (const groupId of groupIds) {
        const questions: { _id: Types.ObjectId }[] =
          await this.flashcardModel.aggregate([
            { $match: { subject_id: subjectId, group_id: groupId } },
            { $sample: { size: perGroupLimit } },
            { $project: { _id: 1 } },
          ]);
        questionsArrays.push(...questions);
      }
    }
    if (questionsArrays.length == 0)
      throw new BadRequestException(
        'Non sono riuscito a trovare domande che soddisfano i filtri richiesti',
      );
    const shuffled = shuffleArray(questionsArrays).slice(0, numQuestions); // taglia se troppe

    const test = await this.testModel.create({
      questions: shuffled.map((q: { _id: Types.ObjectId }) => ({
        flashcard_id: q._id,
      })),
    });

    const test_obj: TestDocument | null = await this.testModel
      .findById(test._id)
      .populate('questions.flashcard_id')
      .exec();
    if (test_obj == null)
      throw new NotFoundException('errore nella creazione del test');
    return test_obj;
  }

  updateElapsedTime(id: string, time: number) {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findByIdAndUpdate(id, { elapsed_time: time });
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.testModel.findByIdAndDelete(id);
    if (result == null) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }
  }

  updateAnswer(test_id: string, question_id: string, is_correct: boolean) {
    if (!validateObjectIdParam(test_id) || !validateObjectIdParam(question_id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findOneAndUpdate(
      { _id: test_id, 'questions._id': question_id },
      { $set: { 'questions.$.is_correct': is_correct } },
      { new: true },
    );
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<TestDocument>> {
    const [data, count] = await Promise.all([
      this.testModel
        .find()
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .exec(),
      this.testModel.find().countDocuments(),
    ]);
    return { data, count };
  }

  findOne(id: string) {
    return this.testModel
      .findById(id)
      .populate('questions.flashcard_id')
      .exec();
  }
}
