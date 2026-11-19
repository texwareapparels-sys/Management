/**
 * Normalizes SMS API URLs by trimming whitespace and ensuring appropriate protocol.
 */
export function normalizeSmsApiUrl(url?: string): string {
  if (!url) return '';
  let trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}
