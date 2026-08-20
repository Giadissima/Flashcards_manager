import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import { Model } from 'mongoose';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Topic, TopicDocument } from 'src/topic/topic.schema';
import {
  FlashcardFileFormat,
  FlashcardImageMeta,
  TopicFileFormat,
  SubjectFileFormat,
} from './file.dto';
import { Subject, SubjectDocument } from 'src/subject/subject.schema';
import { FileService } from 'src/file/file.service';

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

// Inline images inside question/answer are referenced as
// <img src="/api/file/{24 hex char mongo id}">
const IMAGE_REF_REGEX = /file\/([0-9a-fA-F]{24})/g;

function extractImageFileIds(html: string | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(IMAGE_REF_REGEX)) {
    ids.add(match[1]);
  }
  return [...ids];
}

function replaceImageFileIds(html: string, idMap: Map<string, string>): string {
  if (!html) return html;
  return html.replace(IMAGE_REF_REGEX, (full, oldId: string) => {
    const newId = idMap.get(oldId);
    return newId ? `file/${newId}` : full;
  });
}

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel('Flashcard') private readonly flashcardModel: Model<Flashcard>,
    @InjectModel('Subject') private readonly subjectModel: Model<Subject>,
    @InjectModel('Topic') private readonly topicModel: Model<Topic>,
    private readonly fileService: FileService,
  ) {}

  async importFlashcardsFromFile(
    file: Express.Multer.File,
  ): Promise<{ imported: number; skipped: number }> {
    const isZip = looksLikeZip(file.buffer);

    let data: FlashcardFileFormat[];
    let zip: JSZip | undefined;

    if (isZip) {
      zip = await JSZip.loadAsync(file.buffer);
      const jsonEntry = zip.file('flashcards.json');
      if (!jsonEntry) {
        throw new Error('Invalid archive: missing flashcards.json');
      }
      try {
        data = JSON.parse(await jsonEntry.async('string'));
      } catch {
        throw new Error('Invalid JSON inside archive');
      }
    } else {
      try {
        data = JSON.parse(file.buffer.toString('utf-8'));
      } catch {
        throw new Error('Invalid JSON');
      }
    }

    let imported = 0;
    let skipped = 0;

    // Shared by every flashcard of this import: if several cards reference
    // the same image, it is recreated on the db only once.
    const restoredImageIdsByOldId = new Map<string, string>();

    for (const item of data) {
      const subject_obj: SubjectFileFormat | undefined =
        item.subject_id ?? item.topic_id?.subject_id;

      // ? subject creation (or reuse of an existing subject with the same name)
      let subject_doc: SubjectDocument | undefined = undefined;
      if (subject_obj) {
        const existingSubject = await this.subjectModel
          .findOne({ name: subject_obj.name })
          .exec();

        if (existingSubject) {
          subject_doc = existingSubject;
        } else {
          const icon_id = await this.restoreSubjectIcon(zip, subject_obj);
          subject_doc = await this.subjectModel.create({
            name: subject_obj.name.trim(),
            desc: subject_obj.desc?.trim(),
            icon: icon_id,
          });
        }
      }

      // ? topic creation
      const topic_obj: TopicFileFormat | undefined = item.topic_id;

      let topic_doc: TopicDocument | undefined = undefined;
      if (topic_obj && subject_doc) {
        topic_doc = await this.topicModel
          .findOneAndUpdate(
            { name: topic_obj.name, subject_id: subject_doc._id },
            {
              $setOnInsert: {
                name: topic_obj.name.trim(),
                color: topic_obj.color.trim(),
                subject_id: subject_doc._id,
              },
            },
            { upsert: true, new: true },
          )
          .exec();
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
      const duplicateFilter: Record<string, unknown> = {
        title,
        question,
        answer,
        topic_id: topic_doc?._id ?? null,
        subject_id: subject_doc?._id ?? null,
      };

      const alreadyExists = await this.flashcardModel
        .exists(duplicateFilter)
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
      });
      imported++;
    }

    return { imported, skipped };
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

  async exportFlashcardsAsZip(subject_id: undefined | string): Promise<Buffer> {
    const filter = subject_id ? { subject_id } : {};

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
