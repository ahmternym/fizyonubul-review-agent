import { HOME_SERVICE, SPECIALIZATIONS } from './reference.js';
import type { Therapist } from './source.js';
import { digits, isEmail, isTrMobile, trLower } from './text.js';

export type Finding = {
  code: string;
  severity: 'block' | 'warn' | 'info';
  message: string;
};

/**
 * Everything that can be decided without judgement is decided here, in code.
 * 'block' findings make an approve recommendation impossible (see save_recommendation).
 */
export function runChecks(t: Therapist, everyone: Therapist[], provinces: Map<string, string[]>): Finding[] {
  const f: Finding[] = [];
  const add = (code: string, severity: Finding['severity'], message: string) => f.push({ code, severity, message });

  if (!t.fullName.trim() || t.fullName.trim().split(/\s+/).length < 2) add('name', 'block', 'Ad soyad eksik.');

  const districts = provinces.get(t.province);
  if (!districts) add('province', 'block', `"${t.province}" geçerli bir il değil.`);
  else if (!districts.includes(t.district)) add('district', 'block', `"${t.district}" ilçesi ${t.province} iline ait değil.`);

  const real = t.specializations.filter((s) => SPECIALIZATIONS.includes(s));
  const unknown = t.specializations.filter((s) => !SPECIALIZATIONS.includes(s) && s !== HOME_SERVICE);
  if (!real.length) add('specialization', 'block', 'En az bir uzmanlık alanı seçilmemiş ("Evde Fizyoterapi" uzmanlık sayılmaz).');
  if (unknown.length) add('specialization_unknown', 'warn', `Listede olmayan uzmanlık: ${unknown.join(', ')}.`);

  if (!isTrMobile(t.phone)) {
    const d = digits(t.phone);
    add('phone', /^5\d{9}$/.test(d) ? 'warn' : 'block', /^5\d{9}$/.test(d) ? 'Telefon başında 0 yok.' : 'Telefon numarası geçerli bir cep telefonu değil.');
  }
  if (!isEmail(t.email)) add('email', 'block', 'E-posta adresi geçersiz.');

  if (t.instagramUsername && /[/:]|instagram\.com/i.test(t.instagramUsername)) {
    add('instagram', 'warn', 'Instagram alanına kullanıcı adı yerine bağlantı yazılmış.');
  }
  if (!t.about.trim()) add('about', 'warn', 'Hakkında metni boş.');
  if (!t.publicProfileConsent) add('consent', 'block', 'Profilin herkese açık gösterilmesi için açık rıza yok.');
  if (!t.diplomaStoragePath) add('diploma_missing', 'block', 'Mezuniyet belgesi yüklenmemiş.');
  if (t.verificationResubmitCount > 0) add('resubmission', 'info', `Daha önce reddedilip ${t.verificationResubmitCount} kez yeniden gönderilmiş.`);

  for (const other of everyone) {
    if (other.uid === t.uid) continue;
    const samePhone = digits(other.phone).slice(-10) === digits(t.phone).slice(-10) && digits(t.phone).length >= 10;
    const sameEmail = trLower(other.email.trim()) === trLower(t.email.trim());
    if (samePhone || sameEmail) {
      add(
        'duplicate',
        'block',
        `${samePhone ? 'Telefon' : 'E-posta'} başka bir kayıtla aynı (uid ${other.uid}, durum: ${other.verificationStatus}` +
          `${other.rejectionReason ? `, red gerekçesi: "${other.rejectionReason}"` : ''}).`
      );
    }
  }
  return f;
}
