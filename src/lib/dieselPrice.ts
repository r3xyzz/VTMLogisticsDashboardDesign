// src/lib/dieselPrice.ts
// Precio real del diésel en Chile desde Bencina en Línea (CNE): precios que informa cada bencinera.
// API pública sin token (la usa bencinaenlinea.cl). No está documentada: si cambia, se usa el último valor guardado.
// La respuesta pesa ~4 MB, así que se guarda solo el resumen por región y se reutiliza por CACHE_HOURS.

const ENDPOINT = 'https://api.bencinaenlinea.cl/api/busqueda_estacion_filtro';
const CACHE_KEY = 'vtm-diesel-price-v1';
const CACHE_HOURS = 6;
const DIESEL_CODES = new Set(['DI', 'ADI']); // Petróleo diésel asistido / autoservicio
export const NATIONAL = 'Chile';
export const DEFAULT_REGION = 'Metropolitana de Santiago';

export interface DieselSummary {
  region: string;
  median: number; // se usa la mediana: hay estaciones con precios fuera de rango
  min: number;
  max: number;
  stations: number;
  lastReport: string; // último precio informado por alguna estación (YYYY-MM-DD HH:mm:ss)
}

interface DieselCache {
  fetchedAt: number;
  regions: Record<string, DieselSummary>;
}

type Station = { region: string; combustibles?: { nombre_corto: string; precio: string | null; precio_fecha?: string | null }[] };

function summarize(region: string, entries: { price: number; date: string }[]): DieselSummary {
  const prices = entries.map((entry) => entry.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  return {
    region,
    median: Math.round(median),
    min: prices[0],
    max: prices[prices.length - 1],
    stations: prices.length,
    lastReport: entries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), ''),
  };
}

function readCache(): DieselCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DieselCache) : null;
  } catch {
    return null;
  }
}

async function download(): Promise<DieselCache> {
  const response = await fetch(ENDPOINT);
  if (!response.ok) throw new Error(`Bencina en Línea respondió ${response.status}`);
  const { data } = (await response.json()) as { data: Station[] };

  const byRegion: Record<string, { price: number; date: string }[]> = { [NATIONAL]: [] };
  for (const station of data || []) {
    for (const fuel of station.combustibles || []) {
      const price = Number(fuel.precio);
      if (!DIESEL_CODES.has(fuel.nombre_corto) || !(price > 0)) continue;
      const entry = { price, date: fuel.precio_fecha || '' };
      byRegion[NATIONAL].push(entry);
      (byRegion[station.region] ||= []).push(entry);
    }
  }
  if (byRegion[NATIONAL].length === 0) throw new Error('Bencina en Línea no trajo precios de diésel');

  const regions = Object.fromEntries(Object.entries(byRegion).map(([region, entries]) => [region, summarize(region, entries)]));
  const cache = { fetchedAt: Date.now(), regions };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* sin storage: solo memoria */ }
  return cache;
}

let inFlight: Promise<DieselCache> | null = null;

// Resumen del diésel para una región (o NATIONAL). Usa caché fresco; si la API falla, devuelve el último caché aunque esté viejo.
export async function getDieselPrice(region = DEFAULT_REGION, { force = false } = {}): Promise<DieselSummary> {
  const cached = readCache();
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_HOURS * 3600_000;
  let source = cached;
  if (force || !fresh) {
    try {
      inFlight ||= download().finally(() => { inFlight = null; });
      source = await inFlight;
    } catch (error) {
      if (!cached) throw error;
      console.warn('⚠️ [Diésel] Bencina en Línea no respondió; se usa el último precio guardado.', error);
    }
  }
  const summary = source!.regions[region] || source!.regions[NATIONAL];
  return summary;
}

export function formatReportDate(value: string): string {
  if (!value) return 'sin fecha';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
