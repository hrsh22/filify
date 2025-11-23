import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { once } from 'events';
import type { CID } from 'multiformats/cid';
import { logger } from './logger';

const IGNORED_ENTRIES = new Set([
  '.git',
  '.github',
  '.gitignore',
  '.gitmodules',
  'node_modules',
  '__MACOSX',
]);

interface DirectorySummary {
  totalFiles: number;
  totalDirectories: number;
  sampleEntries: string[];
}

interface CarBuildResult {
  carPath: string;
  rootCid: string;
  summary: DirectorySummary;
}

function isAsyncIterable<T>(input: unknown): input is AsyncIterable<T> {
  return typeof input === 'object' && input !== null && Symbol.asyncIterator in input;
}

function isIterable<T>(input: unknown): input is Iterable<T> {
  return typeof input === 'object' && input !== null && Symbol.iterator in input;
}

async function collectBytes(data: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }

  const chunks: Uint8Array[] = [];
  if (isAsyncIterable<Uint8Array>(data)) {
    for await (const chunk of data) {
      chunks.push(chunk);
    }
  } else if (isIterable<Uint8Array>(data)) {
    for (const chunk of data) {
      chunks.push(chunk);
    }
  }

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const buffer = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

class MemoryBlockstore {
  private readonly blocks = new Map<string, Uint8Array>();

  async put(cid: CID, bytes: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
    const normalized = await collectBytes(bytes);
    this.blocks.set(cid.toString(), normalized);
  }

  async get(cid: CID) {
    const block = this.blocks.get(cid.toString());
    if (!block) {
      throw new Error(`Missing block for CID ${cid.toString()}`);
    }
    return block;
  }

  async *entries() {
    const { CID } = await import('multiformats/cid');
    for (const [key, bytes] of this.blocks.entries()) {
      yield { cid: CID.parse(key), bytes };
    }
  }

  async has(cid: CID) {
    return this.blocks.has(cid.toString());
  }

  clear() {
    this.blocks.clear();
  }
}

async function summarizeDirectory(rootDir: string): Promise<DirectorySummary> {
  let totalFiles = 0;
  let totalDirectories = 0;
  const sampleEntries: string[] = [];

  async function walk(currentDir: string, relativePrefix: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_ENTRIES.has(entry.name)) {
        continue;
      }

      const relativePath = relativePrefix === '.' ? entry.name : path.join(relativePrefix, entry.name);
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        totalDirectories++;
        if (sampleEntries.length < 25) {
          sampleEntries.push(`${relativePath}/`);
        }
        await walk(fullPath, relativePath);
        continue;
      }

      if (entry.isFile()) {
        totalFiles++;
        if (sampleEntries.length < 25) {
          sampleEntries.push(relativePath);
        }
      }
    }
  }

  await walk(rootDir, '.');

  return {
    totalFiles,
    totalDirectories,
    sampleEntries,
  };
}

async function* iterateFiles(
  currentDir: string,
  baseDir: string
): AsyncGenerator<{ path: string; content: NodeJS.ReadableStream }> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_ENTRIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      yield* iterateFiles(fullPath, baseDir);
      continue;
    }

    if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');
      yield {
        path: relativePath.length === 0 ? entry.name : relativePath,
        content: createReadStream(fullPath),
      };
    }
  }
}

async function writeCarFile(blockstore: MemoryBlockstore, rootCid: CID, destination: string) {
  const { CarWriter } = await import('@ipld/car/writer');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const output = createWriteStream(destination);
  const { writer, out } = await CarWriter.create([rootCid]);

  const writerStream = (async () => {
    for await (const chunk of out) {
      if (!output.write(chunk)) {
        await once(output, 'drain');
      }
    }
    output.end();
  })();

  for await (const { cid, bytes } of blockstore.entries()) {
    await writer.put({ cid, bytes });
  }
  await writer.close();
  await writerStream;
}

export async function buildCarFromDirectory(
  sourceDir: string,
  deploymentId: string,
  carFilePath: string
): Promise<CarBuildResult> {
  const summary = await summarizeDirectory(sourceDir);

  if (summary.totalFiles === 0) {
    throw new Error(`No files available in ${sourceDir} to include in CAR`);
  }

  logger.info('Preparing CAR build directory summary', {
    deploymentId,
    sourceDir,
    totalFiles: summary.totalFiles,
    totalDirectories: summary.totalDirectories,
    sampleEntries: summary.sampleEntries,
  });

  const blockstore = new MemoryBlockstore();
  let rootCid: CID | null = null;

  const importerModule = await new Function('specifier', 'return import(specifier);')('ipfs-unixfs-importer');
  const { importer } = importerModule;
  for await (const entry of importer(iterateFiles(sourceDir, sourceDir), blockstore as any, {
    cidVersion: 1,
    wrapWithDirectory: true,
    rawLeaves: true,
  })) {
    rootCid = entry.cid;
  }

  if (!rootCid) {
    throw new Error('Failed to determine CAR root CID');
  }

  await writeCarFile(blockstore, rootCid, carFilePath);
  blockstore.clear();

  logger.info('CAR file generated successfully', {
    deploymentId,
    carFilePath,
    rootCid: rootCid.toString(),
  });

  return {
    carPath: carFilePath,
    rootCid: rootCid.toString(),
    summary,
  };
}
