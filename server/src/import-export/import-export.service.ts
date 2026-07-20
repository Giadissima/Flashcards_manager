import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import { Model } from 'mongoose';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Topic, TopicDocument } from 'src/topic/topic.schema';
import {
  FlashcardFileFormat,
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

// Gli zip iniziano sempre con la signature "PK" (0x50 0x4B)
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

    for (const item of data) {
      const subject_obj: SubjectFileFormat | undefined =
        item.subject_id ?? item.topic_id?.subject_id;

      // ? subject creation (o riuso di una materia già esistente con lo stesso nome)
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

      // ? flashcard creation, solo se non esiste già una copia identica
      const title = item.title?.trim();
      const question = item.question?.trim();
      const answer = item.answer?.trim();

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

      await this.flashcardModel.create({
        title,
        question,
        answer,
        topic_id: topic_doc?._id,
        subject_id: subject_doc?._id,
      });
      imported++;
    }

    return { imported, skipped };
  }

  // Ricrea sul db il file dell'icona di una materia appena importata, se
  // l'export era uno zip e contiene l'immagine referenziata. Con un import
  // di solo JSON (senza immagini) l'icona viene semplicemente lasciata
  // vuota: andrà ricaricata a mano dalla pagina di modifica materia.
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

    // 1. raccoglie e allega al zip un'icona per ogni materia distinta coinvolta
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

    // 2. annota ogni riferimento a materia con il percorso della sua icona nel zip
    for (const doc of flashcards) {
      const subjectDoc = doc.subject_id ?? doc.topic_id?.subject_id;
      if (!subjectDoc) continue;

      const meta = iconMetaBySubjectId.get(subjectDoc._id.toString());
      if (meta) {
        subjectDoc.iconFileName = meta.iconFileName;
        subjectDoc.iconMimetype = meta.iconMimetype;
      }
    }

    zip.file('flashcards.json', JSON.stringify(flashcards, null, 2));

    return zip.generateAsync({ type: 'nodebuffer' });
  }
  // TODO l'export dovrà essere filtrato anche per argomento (topic), oltre che per materia
}
