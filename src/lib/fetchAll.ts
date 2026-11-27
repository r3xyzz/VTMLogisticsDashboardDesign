// src/lib/fetchAll.ts
// Supabase devuelve como máximo 1000 filas por consulta y corta el resto sin avisar.
// Estas funciones piden las páginas que falten hasta traer todas las filas.

type Result<T> = { data: T[] | null; error: { message: string } | null };

const PAGE_SIZE = 1000; // límite por defecto de Supabase (API > Max rows)

/**
 * Trae todas las filas de una consulta, de 1000 en 1000.
 * La consulta debe tener un orden estable (terminar en un .order por columna única, ej. 'id'),
 * si no, entre páginas se pueden repetir o saltar filas.
 *
 *   const { data, error } = await selectAll((from, to) =>
 *     supabase.from('invoices').select('*').order('created_at', { ascending: false }).order('id').range(from, to))
 */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<Result<T>>): Promise<Result<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return { data: rows, error: null };
  }
}

/**
 * Igual que .in(columna, valores) pero en grupos: con cientos de ids la URL queda demasiado
 * larga y Supabase responde error. Quita repetidos y junta los resultados.
 *
 *   const { data } = await selectIn(orderIds, (ids) => supabase.from('coordination_services').select('*').in('order_id', ids))
 */
export async function selectIn<T>(values: (string | null | undefined)[], query: (chunk: string[]) => PromiseLike<Result<T>>, chunkSize = 100): Promise<Result<T>> {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += chunkSize) chunks.push(unique.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map(query));
  const failed = results.find((result) => result.error);
  if (failed) return { data: null, error: failed.error };
  return { data: results.flatMap((result) => result.data ?? []), error: null };
}
