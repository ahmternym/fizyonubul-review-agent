import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runChecks } from '../src/checks.js';
import { decide, mcpName } from '../src/policy.js';
import { loadProvinces, loadUniversities } from '../src/reference.js';
import { callTool } from '../src/schema.js';
import { fixtureSource, loadDiplomaFile, type Therapist } from '../src/source.js';
import { foldName, maskEmail, maskPhone } from '../src/text.js';
import { createTools } from '../src/tools.js';

const provinces = loadProvinces();
const source = fixtureSource(path.resolve('fixtures/applications.json'));

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'review-'));
  const tools = createTools({
    source,
    provinces,
    universities: loadUniversities('fixtures/universities.json'),
    outDir: path.join(dir, 'out'),
    reportsDir: path.join(dir, 'reports'),
    log: () => {}
  });
  return { tools, dir };
}
const codes = async (uid: string) => {
  const all = await source.all();
  return runChecks(all.find((t) => t.uid === uid)!, all, provinces).map((f) => `${f.severity}:${f.code}`);
};
const goodDiploma = { readable: true, name_on_document: 'ELİF DEMİR', university: 'Kuzey Işık Üniversitesi', department: 'Fizyoterapi ve Rehabilitasyon', graduation_year: 2022 };

describe('text helpers', () => {
  it('compares Turkish names regardless of case and diacritics', () => {
    expect(foldName('ELİF  DEMİR')).toBe(foldName('Elif Demir'));
    expect(foldName('IŞIK')).toBe(foldName('ışık'));
    expect(foldName('MERVE KAYA')).not.toBe(foldName('Mert Kaya'));
  });
  it('masks contact details', () => {
    expect(maskPhone('05321234567')).toBe('0532 *** ** 67');
    expect(maskEmail('elif.demir@example.com')).toBe('e***@example.com');
  });
});

describe('reference data', () => {
  it('has 81 provinces plus the two İstanbul sides the app uses', () => {
    expect(provinces.size).toBe(83);
    expect(provinces.get('İstanbul-Anadolu')).toContain('Kadıköy');
    expect(provinces.get('İstanbul-Avrupa')).not.toContain('Kadıköy');
  });
});

describe('automated checks', () => {
  it('passes a clean application', async () => {
    expect(await codes('syn-ap-01')).toEqual([]);
  });
  it('catches wrong district, no real specialization, bad contact info and a link instead of a username', async () => {
    expect(await codes('syn-ap-04')).toEqual(
      expect.arrayContaining(['block:district', 'block:specialization', 'warn:phone', 'block:email', 'warn:instagram', 'warn:about'])
    );
  });
  it('finds a duplicate phone on a previously rejected record', async () => {
    const all = await source.all();
    const f = runChecks(all.find((t) => t.uid === 'syn-ap-05')!, all, provinces);
    expect(f.find((x) => x.code === 'duplicate')?.message).toMatch(/syn-old-01.*rejected/);
  });
  it('flags missing consent and a missing diploma', () => {
    const t: Therapist = { ...({} as Therapist), uid: 'x', verificationStatus: 'pending', createdAt: '', verificationResubmitCount: 0, fullName: 'A B', email: 'a@b.co', phone: '05000000000', instagramUsername: null, province: 'Samsun', district: 'Atakum', specializations: ['Manuel Terapi'], about: 'x', publicProfileConsent: false };
    expect(runChecks(t, [t], provinces).map((f) => f.code)).toEqual(expect.arrayContaining(['consent', 'diploma_missing']));
  });
});

describe('tools', () => {
  it('lists only pending applications and never returns contact details in full', async () => {
    const { tools } = await setup();
    expect((await tools.list_pending({})).count).toBe(6);
    const app = await tools.get_application({ uid: 'syn-ap-01' });
    expect(app.phone).toBe('0532 *** ** 67');
    expect(JSON.stringify(app)).not.toContain('05321234567');
    await expect(tools.get_application({ uid: 'syn-old-02' })).rejects.toThrow(/No pending/);
  });

  it('returns the diploma as an image, rendering PDFs to PNG', async () => {
    const { tools } = await setup();
    const res = await callTool(tools, 'view_diploma', { uid: 'syn-ap-04' });
    expect(res.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' });
    const pdf = await loadDiplomaFile('fixtures/diplomas/syn-ap-04.pdf');
    expect(pdf.data.subarray(1, 4).toString()).toBe('PNG');
  });

  it('refuses a recommendation before the diploma was looked at', async () => {
    const { tools } = await setup();
    await expect(tools.save_recommendation({ uid: 'syn-ap-01', decision: 'approve', reasons: ['ok'], diploma: goodDiploma })).rejects.toThrow(/view_diploma/);
  });

  it('saves an approve when everything checks out', async () => {
    const { tools, dir } = await setup();
    await tools.view_diploma({ uid: 'syn-ap-01' });
    await tools.save_recommendation({ uid: 'syn-ap-01', decision: 'approve', reasons: ['Belge okunaklı, bilgiler eşleşiyor'], diploma: goodDiploma });
    const saved = JSON.parse(await readFile(path.join(dir, 'out/recommendations.json'), 'utf8'));
    expect(saved[0]).toMatchObject({ uid: 'syn-ap-01', decision: 'approve', status: 'awaiting_admin', preset: null });
  });

  it('code refuses approve on a name mismatch, a non-physio department or blocking checks', async () => {
    const { tools } = await setup();
    await tools.view_diploma({ uid: 'syn-ap-02' });
    await expect(
      tools.save_recommendation({ uid: 'syn-ap-02', decision: 'approve', reasons: ['x'], diploma: { ...goodDiploma, name_on_document: 'MERVE KAYA', university: 'Ege Rüzgârı Üniversitesi' } })
    ).rejects.toThrow(/does not match/);
    await tools.view_diploma({ uid: 'syn-ap-06' });
    await expect(
      tools.save_recommendation({ uid: 'syn-ap-06', decision: 'approve', reasons: ['x'], diploma: { ...goodDiploma, name_on_document: 'BURAK ŞAHİN', university: 'Ege Rüzgârı Üniversitesi', department: 'Beslenme ve Diyetetik' } })
    ).rejects.toThrow(/not physiotherapy/);
    await tools.view_diploma({ uid: 'syn-ap-05' });
    await expect(
      tools.save_recommendation({ uid: 'syn-ap-05', decision: 'approve', reasons: ['x'], diploma: { ...goodDiploma, name_on_document: 'AYŞE YILMAZ' } })
    ).rejects.toThrow(/duplicate/);
  });

  it('requires a preset and an applicant message for request_info / reject, and builds the admin-app reason text', async () => {
    const { tools, dir } = await setup();
    await tools.view_diploma({ uid: 'syn-ap-03' });
    const base = { uid: 'syn-ap-03', decision: 'request_info' as const, reasons: ['Belge okunmuyor'], diploma: { ...goodDiploma, readable: false, name_on_document: '', university: '', department: '' } };
    await expect(tools.save_recommendation(base)).rejects.toThrow(/preset/);
    await expect(tools.save_recommendation({ ...base, preset: 'doc', message_to_applicant: 'kısa' })).rejects.toThrow(/20-500/);
    await tools.save_recommendation({ ...base, preset: 'doc', message_to_applicant: 'Lütfen mezuniyet belgenizin net okunan bir kopyasını yükleyin.' });
    const saved = JSON.parse(await readFile(path.join(dir, 'out/recommendations.json'), 'utf8'));
    expect(saved[0].suggestedRejectionReason).toMatch(/^Diploma veya bitirme belgesi okunamıyor.*net okunan/);
  });
});

describe('policy', () => {
  it('allows only the five review tools', () => {
    expect(decide(mcpName('view_diploma')).behavior).toBe('allow');
    expect(decide('Bash').behavior).toBe('deny');
    expect(decide('mcp__other__save_recommendation').behavior).toBe('deny');
  });
});
