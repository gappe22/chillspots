import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSeedData } from './seed.mjs';

async function writeAtomically(dataFile, data) {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, dataFile);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/** Single-process demo persistence. Mutations are serialized and committed before responding. */
export async function createStore(dataFile) {
  let data;
  try {
    data = JSON.parse(await readFile(dataFile, 'utf8'));
    if (![1, 2].includes(data.version) || !Array.isArray(data.spots) || !data.reviews || !data.ratingTotals) {
      throw new Error('Unsupported Chillspots data file. Preserve it and choose another CHILLSPOTS_DATA_FILE.');
    }
    if (data.version === 1) {
      delete data.profile;
      data.version = 2;
      data.users = [];
      data.sessions = [];
      await writeAtomically(dataFile, data);
    }
    if (!Array.isArray(data.users) || !Array.isArray(data.sessions)) throw new Error('Invalid account data in Chillspots store.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    data = createSeedData();
    await writeAtomically(dataFile, data);
  }
  let queue = Promise.resolve();
  return {
    read: () => structuredClone(data),
    mutate(change) {
      const operation = queue.then(async () => {
        const next = structuredClone(data);
        const result = change(next);
        await writeAtomically(dataFile, next);
        data = next;
        return structuredClone(result);
      });
      // A failed save must not poison subsequent requests or mutate the live snapshot.
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
