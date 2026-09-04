/**
 * Title-cases a person's name as it's typed — "ahmet mehmet" → "Ahmet
 * Mehmet", "AYŞE nur-kaya" → "Ayşe Nur-Kaya". Turkish-locale-aware casing
 * (`tr` uppercases "i" to "İ" and lowercases "I" to "ı", not the ASCII
 * "I"/"i" pairing) so Turkish names capitalize correctly. Space and hyphen
 * are treated as word boundaries; all original whitespace is preserved
 * untouched so this is safe to apply on every keystroke, including while a
 * trailing space is mid-type.
 */
export function capitalizeTurkishName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|[\s-])(\p{L})/gu, (_match, boundary: string, letter: string) => boundary + letter.toLocaleUpperCase("tr-TR"))
}
