/**
 * FDI / ISO 3950 two-digit tooth numbering — the international standard the
 * odontogram (`components/shared/odontogram.tsx`) charts against, and the
 * shape `treatment_plan_items.tooth_numbers` stores.
 *
 * First digit = quadrant, second digit = tooth position (1 = central incisor
 * near the midline, 8 = third molar at the back):
 *   Permanent: Q1 upper-right (11-18), Q2 upper-left (21-28),
 *              Q3 lower-left (31-38), Q4 lower-right (41-48)
 *   Primary:   Q5 upper-right (51-55), Q6 upper-left (61-65),
 *              Q7 lower-left (71-75), Q8 lower-right (81-85)
 *
 * Half-arch arrays below are ordered left-to-right AS SHOWN ON SCREEN — i.e.
 * the clinician's mirror view: the patient's right is on the viewer's left,
 * and each row reads outward-to-midline then midline-to-outward. This is the
 * layout every dental charting tool uses, so it needs zero training.
 */

export type DentitionMode = "permanent" | "primary" | "mixed"

export type ToothArch = {
  mode: Exclude<DentitionMode, "mixed">
  label: string
  /** Patient's upper-right quadrant, rendered outermost tooth → midline. */
  upperRight: number[]
  /** Patient's upper-left quadrant, midline → outermost tooth. */
  upperLeft: number[]
  lowerRight: number[]
  lowerLeft: number[]
}

export const PERMANENT_ARCH: ToothArch = {
  mode: "permanent",
  label: "Daimi Dişler",
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
}

export const PRIMARY_ARCH: ToothArch = {
  mode: "primary",
  label: "Süt Dişleri",
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerRight: [85, 84, 83, 82, 81],
  lowerLeft: [71, 72, 73, 74, 75],
}

export const DENTITION_MODE_LABELS: Record<DentitionMode, string> = {
  permanent: "Daimi",
  primary: "Süt",
  mixed: "Karışık",
}

/** The order the segmented toggle presents modes in. */
export const DENTITION_MODES: DentitionMode[] = ["permanent", "primary", "mixed"]

/** Which arch(es) a mode renders — "mixed" stacks both, permanent on top. */
export function archesForMode(mode: DentitionMode): ToothArch[] {
  if (mode === "primary") return [PRIMARY_ARCH]
  if (mode === "mixed") return [PERMANENT_ARCH, PRIMARY_ARCH]
  return [PERMANENT_ARCH]
}

/** Every valid FDI number, permanent + primary — the domain a stored value must fall within. */
const ALL_FDI_NUMBERS = new Set<number>(
  [PERMANENT_ARCH, PRIMARY_ARCH].flatMap((arch) => [
    ...arch.upperRight,
    ...arch.upperLeft,
    ...arch.lowerRight,
    ...arch.lowerLeft,
  ]),
)

/** A real FDI tooth: quadrant 1-8, position 1-8. Mirrors the DB check constraint. */
export function isValidFdiNumber(value: number): boolean {
  return Number.isInteger(value) && ALL_FDI_NUMBERS.has(value)
}

function ageInYears(birthDate: string): number {
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return Number.NaN
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1
  return age
}

/**
 * The dentition the chart opens on, from the patient's age — the same
 * age-based default every clinical charting tool uses, so the common case
 * needs no manual toggle: under 6 → primary, 6-12 (mixed dentition years) →
 * mixed, 13+ → permanent. Unknown/invalid birth date falls back to permanent
 * (the overwhelmingly common adult case), never guesses.
 */
export function getDefaultDentition(birthDate?: string | null): DentitionMode {
  if (!birthDate) return "permanent"
  const age = ageInYears(birthDate)
  if (Number.isNaN(age)) return "permanent"
  if (age < 6) return "primary"
  if (age <= 12) return "mixed"
  return "permanent"
}

/** Ascending numeric order — stable across quadrants for display and storage. */
export function sortTeeth(numbers: readonly number[]): number[] {
  return [...numbers].sort((a, b) => a - b)
}

/** Comma-joined, sorted — for badges/summaries, e.g. "16, 17, 26". */
export function formatToothList(numbers: readonly number[]): string {
  return sortTeeth(numbers).join(", ")
}
