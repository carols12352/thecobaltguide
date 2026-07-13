/** Canada Post postal code: A1A 1A1 (letters exclude D, F, I, O, Q, U, W, Z). */
export const CANADIAN_POSTAL_CODE_PATTERN =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export const CANADIAN_POSTAL_CODE_MESSAGE =
  "Canadian postal code format: A1A 1A1";

const FIRST_POSTAL_LETTER = /^[ABCEGHJ-NPRSTVXY]$/;
const OTHER_POSTAL_LETTER = /^[ABCEGHJ-NPRSTV-Z]$/;
const POSTAL_DIGIT = /^\d$/;

/** Filter and format postal code while the user types. Invalid characters are rejected. */
export function formatCanadianPostalCodeInput(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const chars: string[] = [];

  for (const char of compact) {
    const pos = chars.length;
    if (pos >= 6) break;

    if (pos === 0) {
      if (FIRST_POSTAL_LETTER.test(char)) chars.push(char);
    } else if (pos === 1 || pos === 3 || pos === 5) {
      if (POSTAL_DIGIT.test(char)) chars.push(char);
    } else if (OTHER_POSTAL_LETTER.test(char)) {
      chars.push(char);
    }
  }

  if (chars.length <= 3) return chars.join("");
  return `${chars.slice(0, 3).join("")} ${chars.slice(3).join("")}`;
}

export function isValidCanadianPostalCode(value: string): boolean {
  return CANADIAN_POSTAL_CODE_PATTERN.test(value.trim());
}

/** Uppercase with a single space between outward and inward codes. */
export function normalizeCanadianPostalCode(value: string): string {
  return formatCanadianPostalCodeInput(value);
}
