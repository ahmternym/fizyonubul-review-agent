import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

/** A therapists/{uid} document as FizyonuBul stores it (only the fields the review needs). */
export type Therapist = {
  uid: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  verificationResubmitCount: number;
  fullName: string;
  email: string;
  phone: string;
  instagramUsername: string | null;
  province: string;
  district: string;
  specializations: string[];
  about: string;
  publicProfileConsent: boolean;
  diplomaStoragePath?: string;
  rejectionReason?: string;
};

export type Diploma = { mimeType: 'image/png' | 'image/jpeg'; data: Buffer; pages: number };

export interface ApplicationSource {
  all(): Promise<Therapist[]>;
  diploma(t: Therapist): Promise<Diploma | null>;
}

const run = promisify(execFile);

/** PDFs are rendered to a PNG of page 1 (the diploma page) with poppler's pdftoppm. */
export async function loadDiplomaFile(file: string): Promise<Diploma> {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return { mimeType: 'image/png', data: await readFile(file), pages: 1 };
  if (ext === '.jpg' || ext === '.jpeg') return { mimeType: 'image/jpeg', data: await readFile(file), pages: 1 };
  if (ext === '.svg') {
    // Only the synthetic fixtures are SVG (so they stay plain text in git); real uploads are PDF or images.
    const { Resvg } = await import('@resvg/resvg-js');
    const png = new Resvg(await readFile(file, 'utf8'), { font: { loadSystemFonts: true, defaultFontFamily: 'serif' } }).render().asPng();
    return { mimeType: 'image/png', data: Buffer.from(png), pages: 1 };
  }
  if (ext === '.pdf') {
    const dir = await mkdtemp(path.join(tmpdir(), 'diploma-'));
    const out = path.join(dir, 'page');
    await run('pdftoppm', ['-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile', file, out]);
    return { mimeType: 'image/png', data: await readFile(`${out}.png`), pages: 1 };
  }
  throw new Error(`Unsupported diploma format: ${ext}`);
}

/** Reads an export of the therapists collection plus the diploma files next to it. */
export function fixtureSource(file: string): ApplicationSource {
  const base = path.dirname(path.dirname(path.resolve(file))); // paths in the fixture are relative to the repo root
  return {
    async all() {
      return (JSON.parse(await readFile(file, 'utf8')) as { therapists: Therapist[] }).therapists;
    },
    async diploma(t) {
      if (!t.diplomaStoragePath) return null;
      return loadDiplomaFile(path.join(base, t.diplomaStoragePath));
    }
  };
}
