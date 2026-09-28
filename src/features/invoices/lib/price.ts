// Helper for parsing simple math expressions like "14+10"
export default function parseAndCalculatePrice(expression: string): number {
  if (!expression) return 0;
  const sanitized = expression.replace(/[^0-9+\-*/.]/g, "");
  if (!sanitized) return 0;

  try {
    const result = new Function(`return ${sanitized}`)();
    return Number.isNaN(result) ? 0 : Number(result) * 1000;
  } catch {
    return 0;
  }
}
