/** Turkish-aware text helpers. "İ".toLowerCase() is "i̇" in JS, so case and diacritics are handled by hand. */

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function trLower(s: string) {
  return s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

/** "ELİF  DEMİR" and "Elif Demir" both become "elif demir". */
export function foldName(s: string) {
  return trLower(s)
    .normalize('NFC')
    .replace(/[çğıiöşüâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function digits(s: string) {
  return s.replace(/\D/g, '');
}

/** Turkish mobile number in the 05XX XXX XX XX form. */
export function isTrMobile(phone: string) {
  return /^05\d{9}$/.test(digits(phone));
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s.trim());
}

export function maskPhone(phone: string) {
  const d = digits(phone);
  return d.length >= 4 ? `${d.slice(0, 4)} *** ** ${d.slice(-2)}` : '***';
}

export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return domain ? `${user.slice(0, 1)}***@${domain}` : '***';
}
