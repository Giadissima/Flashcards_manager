import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import { Model } from 'mongoose';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Topic, TopicDocument } from 'src/topic/topic.schema';
import {
  ConflictAction,
  ConflictResolution,
  FlashcardFileFormat,
  FlashcardImageMeta,
  ImportPreview,
  ImportPreviewSubject,
  ImportResolutions,
  TopicFileFormat,
  SubjectFileFormat,
  conflictActions,
} from './file.dto';
import { charMinLength, nameMaxLength } from 'src/config';
import { Subject, SubjectDocument } from 'src/subject/subject.schema';
import { FileService } from 'src/file/file.service';
import {
  extractImageFileIds,
  replaceImageFileIds,
} from 'src/common/html.util';

function extensionFromMimetype(mimetype: string): string {
  const subtype = mimetype.split('/')[1] ?? 'bin';
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  return subtype;
}

// Every zip archive starts with the "PK" signature (0x50 0x4B)
function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel('Flashcard') private readonly flashcardModel: Model<Flashcard>,
    @InjectModel('Subject') private readonly subjectModel: Model<Subject>,
    @InjectModel('Topic') private readonly topicModel: Model<Topic>,
    private readonly fileService: FileService,
  ) {}

  // Reads the uploaded json or zip export into the list of flashcards it holds
  private async readFile(
    file: Express.Multer.File,
  ): Promise<{ data: FlashcardFileFormat[]; zip?: JSZip }> {
    let data: unknown;
    let zip: JSZip | undefined;

    if (looksLikeZip(file.buffer)) {
      zip = await JSZip.loadAsync(file.buffer);
      const jsonEntry = zip.file('flashcards.json');
      if (!jsonEntry) {
        throw new BadRequestException('Invalid archive: missing flashcards.json');
      }
      try {
        data = JSON.parse(await jsonEntry.async('string'));
      } catch {
        throw new BadRequestException('Invalid JSON inside archive');
      }
    } else {
      try {
        data = JSON.parse(file.buffer.toString('utf-8'));
      } catch {
        throw new BadRequestException('Invalid JSON');
      }
    }

    if (!Array.isArray(data)) {
      throw new BadRequestException('Invalid file: expected a list of flashcards');
    }
    return { data: data as FlashcardFileFormat[], zip };
  }

  // The choices sent along with the import, as a JSON string (the request is
  // multipart, so it cannot be a nested object). Maps and not plain objects:
  // the keys are names taken from a file, and "constructor" is a valid one.
  private parseResolutions(raw: string | undefined): ImportResolutions {
    const resolutions: ImportResolutions = {
      subjects: new Map(),
      topics: new Map(),
    };
    if (!raw) return resolutions;

    const invalid = () => new BadRequestException('Invalid resolutions');
    const isObject = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);

    const toResolution = (value: unknown): ConflictResolution => {
      if (!isObject(value)) throw invalid();
      const action = value.action as ConflictAction;
      if (!conflictActions.includes(action)) throw invalid();
      if (action !== 'rename') return { action };

      const name = typeof value.name === 'string' ? value.name.trim() : '';
      if (name.length < charMinLength || name.length > nameMaxLength) {
        throw invalid();
      }
      return { action, name };
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw invalid();
    }
    if (!isObject(parsed)) throw invalid();

    if (parsed.subjects !== undefined) {
      if (!isObject(parsed.subjects)) throw invalid();
      for (const [name, value] of Object.entries(parsed.subjects)) {
        resolutions.subjects.set(name, toResolution(value));
      }
    }
    if (parsed.topics !== undefined) {
      if (!isObject(parsed.topics)) throw invalid();
      for (const [subjectName, byTopic] of Object.entries(parsed.topics)) {
        if (!isObject(byTopic)) throw invalid();
        const topics = new Map<string, ConflictResolution>();
        for (const [topicName, value] of Object.entries(byTopic)) {
          topics.set(topicName, toResolution(value));
        }
        resolutions.topics.set(subjectName, topics);
      }
    }
    return resolutions;
  }

  // The same filter the import uses to tell whether a card is already there
  private duplicateFilter(
    userId: string,
    item: FlashcardFileFormat,
    subjectId: unknown,
    topicId: unknown,
  ): Record<string, unknown> {
    return {
      user_id: userId,
      title: item.title?.trim(),
      question: item.question?.trim(),
      answer: item.answer?.trim(),
      topic_id: topicId ?? null,
      subject_id: subjectId ?? null,
    };
  }

  /**
   * Looks at what an import would do without doing it: which subjects of the
   * file already exist in the account, and inside them which topics. Only the
   * clashes are returned, so an empty list means the import can go straight on.
   */
  async previewImport(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ImportPreview> {
    const { data } = await this.readFile(file);

    const itemsBySubjectName = new Map<string, FlashcardFileFormat[]>();
    for (const item of data) {
      const name = (item.subject_id ?? item.topic_id?.subject_id)?.name;
      if (typeof name !== 'string') continue;
      const items = itemsBySubjectName.get(name) ?? [];
      items.push(item);
      itemsBySubjectName.set(name, items);
    }

    const existing = await this.subjectModel
      .find({ user_id: userId, name: { $in: [...itemsBySubjectName.keys()] } })
      .exec();
    const existingByName = new Map(existing.map((s) => [s.name, s]));

    const conflicts: ImportPreviewSubject[] = [];
    for (const [name, items] of itemsBySubjectName) {
      const subject = existingByName.get(name);
      if (!subject) continue;

      const topicNames = new Set<string>();
      for (const item of items) {
        if (typeof item.topic_id?.name === 'string') {
          topicNames.add(item.topic_id.name);
        }
      }
      const takenTopics = await this.topicModel
        .find({
          user_id: userId,
          subject_id: subject._id,
          name: { $in: [...topicNames] },
        })
        .exec();
      const topicIdByName = new Map(takenTopics.map((t) => [t.name, t._id]));

      const cardsByTopicName = new Map<string, number>();
      let duplicates = 0;
      for (const item of items) {
        const topicName = item.topic_id?.name;
        const topicId = topicName ? topicIdByName.get(topicName) : undefined;
        if (topicName && topicId) {
          cardsByTopicName.set(
            topicName,
            (cardsByTopicName.get(topicName) ?? 0) + 1,
          );
        }
        // A card under a topic that does not exist yet cannot be a copy
        if (topicName && !topicId) continue;

        const alreadyExists = await this.flashcardModel
          .exists(this.duplicateFilter(userId, item, subject._id, topicId))
          .exec();
        if (alreadyExists) duplicates++;
      }

      conflicts.push({
        name,
        cards: items.length,
        duplicates,
        topics: [...cardsByTopicName].map(([topicName, cards]) => ({
          name: topicName,
          cards,
        })),
      });
    }

    return { total: data.length, conflicts };
  }

  // A rename that lands on a name already in use would silently merge what the
  // user asked to keep apart, so it is refused before anything is written.
  private async assertRenamesFree(
    userId: string,
    resolutions: ImportResolutions,
  ): Promise<void> {
    const subjectNames = new Set<string>();
    for (const resolution of resolutions.subjects.values()) {
      if (resolution.action !== 'rename') continue;
      const name = resolution.name as string;
      const taken =
        subjectNames.has(name) ||
        (await this.subjectModel.exists({ user_id: userId, name }).exec());
      if (taken) {
        throw new ConflictException('You already have a subject with this name');
      }
      subjectNames.add(name);
    }

    for (const [subjectName, byTopic] of resolutions.topics) {
      // Topics only clash inside a subject that is being merged into
      const subjectAction = resolutions.subjects.get(subjectName)?.action;
      if (subjectAction === 'rename' || subjectAction === 'skip') continue;

      const subject = await this.subjectModel
        .findOne({ user_id: userId, name: subjectName }, { _id: 1 })
        .exec();
      const topicNames = new Set<string>();
      for (const resolution of byTopic.values()) {
        if (resolution.action !== 'rename') continue;
        const name = resolution.name as string;
        const taken =
          topicNames.has(name) ||
          (subject &&
            (await this.topicModel
              .exists({ user_id: userId, subject_id: subject._id, name })
              .exec()));
        if (taken) {
          throw new ConflictException('You already have a topic with this name');
        }
        topicNames.add(name);
      }
    }
  }

  async importFlashcardsFromFile(
    userId: string,
    file: Express.Multer.File,
    rawResolutions?: string,
  ): Promise<{ imported: number; skipped: number }> {
    const { data, zip } = await this.readFile(file);
    const resolutions = this.parseResolutions(rawResolutions);
    await this.assertRenamesFree(userId, resolutions);

    let imported = 0;
    let skipped = 0;

    // Shared by every flashcard of this import: if several cards reference
    // the same image, it is recreated on the db only once.
    const restoredImageIdsByOldId = new Map<string, string>();

    // Resolved once per name: a renamed subject has to be created a single
    // time and then found again by the cards that follow. null means skipped.
    const subjectByName = new Map<string, SubjectDocument | null>();
    const topicByKey = new Map<string, TopicDocument | null>();

    for (const item of data) {
      const subject_obj: SubjectFileFormat | undefined =
        item.subject_id ?? item.topic_id?.subject_id;

      // ? subject creation (or reuse of an existing subject with the same name)
      let subject_doc: SubjectDocument | undefined = undefined;
      if (subject_obj) {
        if (!subjectByName.has(subject_obj.name)) {
          subjectByName.set(
            subject_obj.name,
            await this.resolveSubject(userId, zip, subject_obj, resolutions),
          );
        }
        const resolved = subjectByName.get(subject_obj.name);
        if (resolved === null) {
          skipped++;
          continue;
        }
        subject_doc = resolved;
      }

      // ? topic creation
      const topic_obj: TopicFileFormat | undefined = item.topic_id;

      let topic_doc: TopicDocument | undefined = undefined;
      if (topic_obj && subject_doc && subject_obj) {
        const topicKey = `${subject_obj.name}\u0000${topic_obj.name}`;
        if (!topicByKey.has(topicKey)) {
          topicByKey.set(
            topicKey,
            await this.resolveTopic(
              userId,
              subject_doc,
              subject_obj.name,
              topic_obj,
              resolutions,
            ),
          );
        }
        const resolved = topicByKey.get(topicKey);
        if (resolved === null) {
          skipped++;
          continue;
        }
        topic_doc = resolved;
      }

      // ? flashcard creation, only when an identical copy does not exist yet
      const title = item.title?.trim();
      const question = item.question?.trim();
      const answer = item.answer?.trim();

      // The duplicate check uses the text exactly as it was in the export (with
      // the original image ids): re-importing the same zip into the same db must
      // match what is already stored. Rewriting the ids first (they change on
      // every restore) would break the match and create a duplicate with a
      // cloned image on every single import.
      const alreadyExists = await this.flashcardModel
        .exists(
          this.duplicateFilter(userId, item, subject_doc?._id, topic_doc?._id),
        )
        .exec();

      if (alreadyExists) {
        skipped++;
        continue;
      }

      let finalQuestion = question;
      let finalAnswer = answer;

      if (zip && item.images) {
        await this.restoreFlashcardImages(zip, item.images, restoredImageIdsByOldId);
        finalQuestion = replaceImageFileIds(question, restoredImageIdsByOldId);
        finalAnswer = replaceImageFileIds(answer, restoredImageIdsByOldId);
      }

      await this.flashcardModel.create({
        title,
        question: finalQuestion,
        answer: finalAnswer,
        topic_id: topic_doc?._id,
        subject_id: subject_doc?._id,
        user_id: userId,
      });
      imported++;
    }

    return { imported, skipped };
  }

  // The subject the cards of the file go under, or null when the user chose to
  // leave that subject out. A name already in the account is reused unless the
  // user asked for a new subject under another name.
  private async resolveSubject(
    userId: string,
    zip: JSZip | undefined,
    subject_obj: SubjectFileFormat,
    resolutions: ImportResolutions,
  ): Promise<SubjectDocument | null> {
    const existingSubject = await this.subjectModel
      .findOne({ name: subject_obj.name, user_id: userId })
      .exec();

    const choice = existingSubject
      ? resolutions.subjects.get(subject_obj.name)
      : undefined;
    if (existingSubject && (!choice || choice.action === 'merge')) {
      return existingSubject;
    }
    if (choice?.action === 'skip') return null;

    const icon_id = await this.restoreSubjectIcon(zip, subject_obj);
    return this.subjectModel.create({
      name: choice?.name ?? subject_obj.name.trim(),
      desc: subject_obj.desc?.trim(),
      icon: icon_id,
      user_id: userId,
    });
  }

  // Same as resolveSubject, for a topic of a subject that is already there
  private async resolveTopic(
    userId: string,
    subject_doc: SubjectDocument,
    subjectName: string,
    topic_obj: TopicFileFormat,
    resolutions: ImportResolutions,
  ): Promise<TopicDocument | null> {
    const taken = await this.topicModel
      .exists({
        name: topic_obj.name,
        subject_id: subject_doc._id,
        user_id: userId,
      })
      .exec();
    const choice = taken
      ? resolutions.topics.get(subjectName)?.get(topic_obj.name)
      : undefined;
    if (choice?.action === 'skip') return null;

    return this.topicModel
      .findOneAndUpdate(
        {
          name: choice?.name ?? topic_obj.name,
          subject_id: subject_doc._id,
          user_id: userId,
        },
        {
          $setOnInsert: {
            name: choice?.name ?? topic_obj.name.trim(),
            color: topic_obj.color.trim(),
            subject_id: subject_doc._id,
            user_id: userId,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  // Recreates on the db the icon file of a freshly imported subject, when the
  // export was a zip and it contains the referenced image. With a JSON-only
  // import (no images) the icon is simply left empty: it has to be uploaded
  // again by hand from the subject edit page.
  private async restoreSubjectIcon(
    zip: JSZip | undefined,
    subject_obj: SubjectFileFormat,
  ): Promise<string | undefined> {
    if (!zip || !subject_obj.iconFileName) return undefined;

    const iconEntry = zip.file(subject_obj.iconFileName);
    if (!iconEntry) return undefined;

    const buffer = await iconEntry.async('nodebuffer');
    const savedIcon = await this.fileService.create([
      {
        buffer,
        mimetype: subject_obj.iconMimetype ?? 'application/octet-stream',
      },
    ]);
    return String(savedIcon._id);
  }

  // Recreates on the db the inline images referenced in question/answer of a
  // freshly imported flashcard (only when the export was a zip), filling the
  // shared old-id -> new-id map passed in by the caller. With a JSON-only
  // import the images are not recreated: the <img src="/api/file/{id}">
  // references keep pointing at the original ids (possibly broken on the new
  // db), exactly as happens for a subject icon.
  private async restoreFlashcardImages(
    zip: JSZip,
    images: Record<string, FlashcardImageMeta>,
    restoredImageIdsByOldId: Map<string, string>,
  ): Promise<void> {
    for (const [oldId, meta] of Object.entries(images)) {
      if (restoredImageIdsByOldId.has(oldId)) continue;

      const entry = zip.file(meta.fileName);
      if (!entry) continue;

      const buffer = await entry.async('nodebuffer');
      const savedFile = await this.fileService.create([
        { buffer, mimetype: meta.mimetype },
      ]);
      restoredImageIdsByOldId.set(oldId, String(savedFile._id));
    }
  }

  async exportFlashcardsAsZip(
    userId: string,
    subject_id: undefined | string,
  ): Promise<Buffer> {
    // Only what the caller owns leaves the database, whatever subject is asked for
    const filter: Record<string, unknown> = { user_id: userId };
    if (subject_id) filter.subject_id = subject_id;

    const flashcards: any[] = await this.flashcardModel
      .find(filter)
      .populate({
        path: 'topic_id',
        populate: { path: 'subject_id' },
      })
      .populate('subject_id')
      .lean();

    const zip = new JSZip();
    const iconMetaBySubjectId = new Map<
      string,
      { iconFileName: string; iconMimetype: string }
    >();

    // 1. collect and attach to the zip one icon per distinct subject involved
    for (const doc of flashcards) {
      const subjectDoc = doc.subject_id ?? doc.topic_id?.subject_id;
      if (!subjectDoc?.icon) continue;

      const subjectId = subjectDoc._id.toString();
      if (iconMetaBySubjectId.has(subjectId)) continue;

      const file = await this.fileService.findOne(subjectDoc.icon.toString());
      if (!file) continue;

      const iconFileName = `icons/${subjectId}.${extensionFromMimetype(file.mimetype)}`;
      zip.file(iconFileName, this.fileService.convertBuffer(file.content));
      iconMetaBySubjectId.set(subjectId, {
        iconFileName,
        iconMimetype: file.mimetype,
      });
    }

    // 2. annotate every subject reference with the path of its icon in the zip
    for (const doc of flashcards) {
      const subjectDoc = doc.subject_id ?? doc.topic_id?.subject_id;
      if (!subjectDoc) continue;

      const meta = iconMetaBySubjectId.get(subjectDoc._id.toString());
      if (meta) {
        subjectDoc.iconFileName = meta.iconFileName;
        subjectDoc.iconMimetype = meta.iconMimetype;
      }
    }

    // 3. collect and attach to the zip the inline images used in question/answer
    const imageMetaByFileId = new Map<string, FlashcardImageMeta>();

    for (const doc of flashcards) {
      const referencedIds = [
        ...extractImageFileIds(doc.question),
        ...extractImageFileIds(doc.answer),
      ];
      if (referencedIds.length === 0) continue;

      const images: Record<string, FlashcardImageMeta> = {};
      for (const fileId of referencedIds) {
        let meta = imageMetaByFileId.get(fileId);
        if (!meta) {
          const file = await this.fileService.findOne(fileId);
          if (!file) continue;

          const fileName = `images/${fileId}.${extensionFromMimetype(file.mimetype)}`;
          zip.file(fileName, this.fileService.convertBuffer(file.content));
          meta = { fileName, mimetype: file.mimetype };
          imageMetaByFileId.set(fileId, meta);
        }
        images[fileId] = meta;
      }
      doc.images = images;
    }

    zip.file('flashcards.json', JSON.stringify(flashcards, null, 2));

    return zip.generateAsync({ type: 'nodebuffer' });
  }
  // TODO the export should be filterable by topic too, not only by subject
}
