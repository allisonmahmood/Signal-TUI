/**
 * Normalize a phone number for consistent comparison
 * 
 * Removes all non-digit characters except for a leading '+'
 * e.g. "(555) 123-4567" -> "5551234567"
 *      "+1 (555) 123-4567" -> "+15551234567"
 */
export function normalizeNumber(phone: string | undefined | null): string {
  if (!phone) return "";
  
  // Prepare string
  const str = String(phone).trim();
  
  // Check for leading +
  const hasPlus = str.startsWith("+");
  
  // Remove all non-digits
  const digits = str.replace(/\D/g, "");
  
  return hasPlus ? `+${digits}` : digits;
}
