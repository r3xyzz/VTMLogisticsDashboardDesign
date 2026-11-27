// src/lib/dates.ts
// Fechas en hora local del equipo (en la empresa, hora Chile).
//
// Ojo: new Date("2026-11-30") lee una fecha sin hora como medianoche UTC, que en Chile
// es el 29 a las 21:00/20:00. Por eso las fechas de calendario (vencimientos, licencias,
// fechas de servicio) se leen con parseDate y se comparan por día con daysUntil.

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-30", o la misma fecha guardada como medianoche UTC ("2026-11-30T00:00:00+00:00")
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/;

/** Lee una fecha. Si es un día de calendario (sin hora), queda ese mismo día a mediodía local. */
export function parseDate(value: string): Date {
  const match = CALENDAR_DATE.exec(value.trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return new Date(value);
}

/** Día local como "YYYY-MM-DD" (sirve para nombres de archivo y comparar días). */
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Días que faltan hasta la fecha: 0 = hoy, negativo = ya pasó. */
export function daysUntil(value: string, from = new Date()): number {
  const target = parseDate(value);
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((targetDay - fromDay) / DAY_MS);
}
