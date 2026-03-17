/**
 * Restrict input to digits only, max 10 characters (Indian mobile format).
 */
export function restrictTo10Digits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}
