import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");


const writeLocks = new Map<string, Promise<unknown>>();

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePathFor(name: string) {
 
  return path.join(DATA_DIR, name);
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(filePathFor(name), "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
 
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      await writeJsonFile(name, fallback);
      return fallback;
    }
    throw err;
  }
}

export async function writeJsonFile<T>(name: string, data: T): Promise<void> {
  await ensureDataDir();

  const prev = writeLocks.get(name) ?? Promise.resolve();
  const next = prev
    .catch(() => {
      /* ignore errors from previous write so the queue keeps moving */
    })
    .then(async () => {
      const target = filePathFor(name);
      const tmp = `${target}.${Date.now()}.tmp`;
      // Write to a temp file then rename, so a crash mid-write can't
      // leave the real file half-written/corrupted.
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tmp, target);
    });

  writeLocks.set(name, next);
  await next;
}
