/**
 * Deletes the uploaded files nothing points at any more.
 *
 *   npm run clean:orphan-files            report only
 *   npm run clean:orphan-files -- --apply  delete them
 *
 * Most of these predate the cleanup that now removes a flashcard's images with
 * it: deleting a card, or editing one to drop a picture, used to leave the file
 * behind. New orphans should be rare, so a run that finds many of them is worth
 * looking into rather than just applying.
 */

import { MongoClient, ObjectId } from 'mongodb';

const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017/flashcard_db';
const apply = process.argv.includes('--apply');

// Inline images live inside the HTML as <img src="/api/file/{id}">, so the ids
// have to be read back out of the markup - there is no field holding them.
const IMAGE_REF = /[0-9a-f]{24}/g;

const client = new MongoClient(url);

try {
  await client.connect();
  const db = client.db();

  const referenced = new Set();

  for await (const subject of db.collection('subject').find({ icon: { $ne: null } }, { projection: { icon: 1 } })) {
    if (subject.icon) referenced.add(String(subject.icon));
  }
  for await (const user of db.collection('user').find({ avatar: { $ne: null } }, { projection: { avatar: 1 } })) {
    if (user.avatar) referenced.add(String(user.avatar));
  }
  for await (const card of db.collection('flashcard').find({}, { projection: { question: 1, answer: 1 } })) {
    const html = `${card.question ?? ''}${card.answer ?? ''}`;
    for (const id of html.match(IMAGE_REF) ?? []) referenced.add(id);
  }

  const all = await db.collection('file').find({}, { projection: { _id: 1 } }).toArray();
  const orphans = all.filter((file) => !referenced.has(String(file._id)));

  console.log(`files stored:     ${all.length}`);
  console.log(`still referenced: ${referenced.size}`);
  console.log(`orphans:          ${orphans.length}`);

  if (!orphans.length) {
    console.log('\nNothing to do.');
  } else if (!apply) {
    console.log('\nDry run: nothing was deleted. Add --apply to delete them.');
  } else {
    const result = await db
      .collection('file')
      .deleteMany({ _id: { $in: orphans.map((file) => new ObjectId(file._id)) } });
    console.log(`\nDeleted ${result.deletedCount}.`);
  }
} finally {
  await client.close();
}
