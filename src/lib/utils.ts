export function generateNumericId(uuid: string): string {
  if (!uuid) return '85162570';
  // Use the first 8 characters of the UUID as hex and convert to decimal
  // Then take the last 8 digits to keep it consistent and numeric-looking
  const hex = uuid.replace(/-/g, '').substring(0, 8);
  const decimal = parseInt(hex, 16);
  return (decimal % 100000000).toString().padStart(8, '0');
}
