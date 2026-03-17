/**
 * Restricts input to digits only, max 10 characters (Indian mobile).
 * Use in onChange: setPhone(restrictTo10Digits(e.target.value))
 */
export function restrictTo10Digits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}
