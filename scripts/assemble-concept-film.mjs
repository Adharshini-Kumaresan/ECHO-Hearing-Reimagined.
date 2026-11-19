import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const output = new URL('../public/echo-concept.mp4', import.meta.url);
try {
  // The original ZIP includes the whole film.
  await access(output, constants.R_OK);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const parts = await Promise.all([1, 2, 3].map(part =>
    readFile(new URL(`../assets/echo-concept.mp4.part${part}`, import.meta.url))));
  await writeFile(output, Buffer.concat(parts));
}
