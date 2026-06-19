// ============================================================
// Shared Utility Functions
// ============================================================

/**
 * Safely clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format a number with commas and decimal places.
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a multiplier value.
 */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Generate a unique ID string.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
}

/**
 * Calculate payout from bet amount and multiplier.
 */
export function calculatePayout(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier * 100) / 100;
}

/**
 * Calculate profit from bet amount, multiplier, and house edge.
 */
export function calculateProfit(amount: number, multiplier: number, houseEdge: number = 0.01): number {
  const raw = amount * (multiplier - 1);
  const afterEdge = raw * (1 - houseEdge);
  return Math.round(afterEdge * 100) / 100;
}

/**
 * Deep sleep utility (used in server-side wait loops).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the current timestamp in milliseconds.
 */
export function now(): number {
  return Date.now();
}

/**
 * Interpolate between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}