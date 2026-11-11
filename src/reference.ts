import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reference data copied from the FizyonuBul admin app, so the agent checks against the same rules the app uses. */

/** lib/data/therapist_specialization_options.dart */
export const SPECIALIZATIONS = [
  'Manuel Terapi',
  'Kardiyopulmoner Rehabilitasyon',
  'Lenfödem Rehabilitasyonu',
  'Çene Eklemi (TME) Rehabilitasyonu',
  'Vestibüler Rehabilitasyon',
  'Spor Fizyoterapisi',
  'Nörolojik Rehabilitasyon',
  'Ortopedik Rehabilitasyon',
  'Pelvik Taban Rehabilitasyonu',
  'Skolyoz(SCHROTH,FITS,ISST,SEAS,LYON,SBP)',
  'Pilates(Mat,Reformer)',
  'Pediatrik Fizyoterapi'
];
/** A service type stored in the same list; it does not count as a specialization. */
export const HOME_SERVICE = 'Evde Fizyoterapi';

/** lib/data/verification_rejection_presets.dart: the admin's reject options and the exact text the applicant sees. */
export const REJECTION_PRESETS = {
  doc: 'Diploma veya bitirme belgesi okunamıyor, eksik veya geçersiz görünüyor.',
  identity: 'Kimlik / hesap bilgileri ile iletilen belge veya bilgiler eşleşmiyor.',
  quality: 'Başvuru, kalite veya mesleki yeterlilik şartlarını karşılamıyor.',
  duplicate: 'Yinelenen veya daha önce reddedilmiş bir başvuru tespit edildi.',
  other: ''
} as const;
export type PresetId = keyof typeof REJECTION_PRESETS;

const here = path.dirname(fileURLToPath(import.meta.url));

/** assets/data/turkiye_il_ilce.json (81 provinces). The app stores İstanbul as two sides. */
export function loadProvinces(file = path.join(here, '../data-ref/turkiye_il_ilce.json')): Map<string, string[]> {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
  const map = new Map(Object.entries(raw));
  const anatolian = new Set(['Adalar', 'Ataşehir', 'Beykoz', 'Çekmeköy', 'Kadıköy', 'Kartal', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sultanbeyli', 'Şile', 'Tuzla', 'Ümraniye', 'Üsküdar']);
  const ist = map.get('İstanbul') ?? [];
  map.set('İstanbul-Anadolu', ist.filter((d) => anatolian.has(d)));
  map.set('İstanbul-Avrupa', ist.filter((d) => !anatolian.has(d)));
  return map;
}

export function loadUniversities(file: string): string[] {
  return (JSON.parse(readFileSync(file, 'utf8')) as { physiotherapyPrograms: string[] }).physiotherapyPrograms;
}
