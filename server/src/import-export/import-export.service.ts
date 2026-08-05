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

// Gli zip iniziano sempre con la signature "PK" (0x50 0x4B)
function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

// Le immagini inline nel question/answer sono referenziate come
// <img src="/api/file/{id mongo a 24 caratteri hex}">
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

    // Condivisa tra tutte le flashcard di questo import: se piu' card
    // referenziano la stessa immagine, viene ricreata sul db una sola volta.
    const restoredImageIdsByOldId = new Map<string, string>();

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

      // Il confronto duplicati usa il testo così com'era nell'export (con gli
      // id immagine originali): un re-import dello stesso zip sullo stesso db
      // deve combaciare esattamente con quanto già salvato. Riscrivere prima
      // gli id (che cambiano a ogni restore) farebbe fallire il match e
      // creerebbe un duplicato con un'immagine clonata ad ogni singolo import.
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

  // Ricrea sul db le immagini inline referenziate nel question/answer di una
  // flashcard appena importata (solo se l'export era uno zip), popolando la
  // mappa condivisa id-vecchio -> id-nuovo passata dal chiamante. Con un
  // import di solo JSON le immagini non vengono ricreate: i riferimenti
  // <img src="/api/file/{id}"> restano quelli originali (potenzialmente rotti
  // sul nuovo db), come già avviene per l'icona di una materia.
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

    // 3. raccoglie e allega al zip le immagini inline referenziate in question/answer
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
  // TODO l'export dovrà essere filtrato anche per argomento (topic), oltre che per materia
}
