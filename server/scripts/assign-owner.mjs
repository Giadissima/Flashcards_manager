/**
 * One-off migration: gives every flashcard, subject and topic that predates
 * per-user data an owner, and the default visibility.
 *
 * The three collections became owner-scoped, so a document without user_id is
 * invisible to everybody - this is what brings the existing content back under
 * the account that made it.
 *
 *   node scripts/assign-owner.mjs <username> [--apply]
 *
 * Without --apply it only reports what it would do.
 */

import { MongoClient, ObjectId } from 'mongodb';

// Everything a user owns. The tests carry no visibility: a test is the record
// of one person's attempt, so there is nothing in it to share.
const COLLECTIONS = ['flashcard', 'subject', 'topic', 'test'];
const WITH_VISIBILITY = ['flashcard', 'subject', 'topic'];
const DEFAULT_VISIBILITY = 'private';

const [username, ...flags] = process.argv.slice(2);
const apply = flags.includes('--apply');
const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017/flashcard_db';

if (!username) {
  console.error('Usage: node scripts/assign-owner.mjs <username> [--apply]');
  process.exit(1);
}

const client = new MongoClient(url);

try {
  await client.connect();
  const db = client.db();

  // Usernames are stored lowercased (see AuthService), so the name can be
  // given the way it is written anywhere else
  const user = await db
    .collection('user')
    .findOne({ username: username.toLowerCase() });
  if (!user) {
    console.error(`No user named "${username}"`);
    process.exit(1);
  }
  console.log(`Owner: ${user.username} (${user._id})\n`);

  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    const orphans = await collection.countDocuments({ user_id: { $exists: false } });
    const total = await collection.countDocuments();
    console.log(`${name.padEnd(10)} ${orphans} of ${total} without an owner`);

    if (!apply || !orphans) continue;

    const assigned = { user_id: new ObjectId(user._id) };
    if (WITH_VISIBILITY.includes(name)) {
      assigned.visibility = DEFAULT_VISIBILITY;
    }
    const result = await collection.updateMany(
      { user_id: { $exists: false } },
      { $set: assigned },
    );
    console.log(`${' '.repeat(10)} -> assigned ${result.modifiedCount}`);
  }

  // Anything created before the visibility field existed but already owned
  if (apply) {
    for (const name of WITH_VISIBILITY) {
      const result = await db
        .collection(name)
        .updateMany(
          { visibility: { $exists: false } },
          { $set: { visibility: DEFAULT_VISIBILITY } },
        );
      if (result.modifiedCount) {
        console.log(`${name.padEnd(10)} -> visibility filled on ${result.modifiedCount}`);
      }
    }
  }

  console.log(
    apply ? '\nDone.' : '\nDry run: nothing was written. Add --apply to write.',
  );
} finally {
  await client.close();
}
