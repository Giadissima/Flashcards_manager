import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { extractImageFileIds } from 'src/common/html.util';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Subject } from 'src/subject/subject.schema';
import { FileService } from './file.service';

/** The piece of content being saved, left out when looking for other content showing the same images. */
export interface ContentSelf {
  cardId?: string;
  subjectId?: string;
}

/**
 * The one rule behind every inline image of a flashcard or subject
 * description: each piece of content owns the files it shows, and nobody
 * else's. Copying content - between one's own cards, or out of somebody
 * else's public card - carries the very same <img src> along, so the copy is
 * given files of its own when saved, and removing an image only ever deletes
 * a file its author owns and nothing else of theirs still shows.
 */
@Injectable()
export class ContentImageService {
  constructor(
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    private readonly fileService: FileService,
  ) {}

  /**
   * The copies the content about to be saved needs, as old id -> new id, to
   * be applied to its HTML with replaceImageFileIds. An image gets one when
   * another of the user's cards or descriptions shows it too, or when it is
   * new to this content and not the user's own file - pasted from somebody
   * else's card, or left pointing at the original by a JSON import. Images the
   * content already showed when it was last saved keep their file.
   */
  async claim(
    userId: string,
    html: (string | undefined)[],
    previousHtml: (string | undefined)[],
    self: ContentSelf,
  ): Promise<Map<string, string>> {
    const ids = idsIn(html);
    const idMap = new Map<string, string>();
    if (!ids.length) return idMap;

    const previous = new Set(idsIn(previousHtml));
    const fresh = ids.filter((fileId) => !previous.has(fileId));
    const [shownElsewhere, owned] = await Promise.all([
      this.shownElsewhere(userId, ids, self),
      this.fileService.ownedBy(fresh, userId),
    ]);

    for (const fileId of ids) {
      const foreign = !previous.has(fileId) && !owned.has(fileId);
      if (!foreign && !shownElsewhere.has(fileId)) continue;

      const copyId = await this.fileService.duplicate(fileId, userId);
      // A missing file means the reference was already broken: left as it is,
      // since copying nothing would not mend it
      if (copyId) idMap.set(fileId, copyId);
    }
    return idMap;
  }

  /**
   * Deletes the images content no longer shows - but only files the user
   * owns, and none another of their cards or descriptions still shows. Called
   * once the content is saved or gone, so it is not found showing them itself.
   */
  async release(userId: string, ids: string[], self: ContentSelf = {}): Promise<void> {
    if (!ids.length) return;
    const shownElsewhere = await this.shownElsewhere(userId, ids, self);
    await this.fileService.deleteOwned(
      ids.filter((fileId) => !shownElsewhere.has(fileId)),
      userId,
    );
  }

  /** Those of these images another of the user's cards or descriptions shows. */
  private async shownElsewhere(
    userId: string,
    ids: string[],
    self: ContentSelf,
  ): Promise<Set<string>> {
    const pattern = ids.join('|');
    const cardQuery: FilterQuery<Flashcard> = {
      user_id: userId,
      $or: [{ question: { $regex: pattern } }, { answer: { $regex: pattern } }],
    };
    if (self.cardId) cardQuery._id = { $ne: new Types.ObjectId(self.cardId) };
    const subjectQuery: FilterQuery<Subject> = {
      user_id: userId,
      desc: { $regex: pattern },
    };
    if (self.subjectId) subjectQuery._id = { $ne: new Types.ObjectId(self.subjectId) };

    const [cards, subjects] = await Promise.all([
      this.flashcardModel.find(cardQuery, { question: 1, answer: 1 }).lean().exec(),
      this.subjectModel.find(subjectQuery, { desc: 1 }).lean().exec(),
    ]);
    return new Set([
      ...cards.flatMap((card) => idsIn([card.question, card.answer])),
      ...subjects.flatMap((subject) => idsIn([subject.desc])),
    ]);
  }
}

function idsIn(html: (string | undefined)[]): string[] {
  return [...new Set(html.flatMap((fragment) => extractImageFileIds(fragment)))];
}
