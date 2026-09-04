const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Loose but sufficient email shape check — used by Excel import parsers (leads, patients, ...). */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}
