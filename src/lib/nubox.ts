// src/lib/nubox.ts

/* ─── Configuración ──────────────────────────────────────────────────────────── */

const NUBOX_CONFIG = {
  // ⚠️ La base URL NO incluye /v1, va en cada endpoint
  baseUrl: '/api/nubox',
  partnerToken: 'Bearer NP_SECRET_UAT_KMf21uyfAc.Uf7I7sFBNkHxWu2YSqkZkBEv1RPQLM18vCc4KxbeAufg+Dnmhrbnd/65wMyuP2zHiqmYW6PlnKKXWXZh',
  apiKey: 'NP_KEY_UAT_a245db93.047-K.YCZx0IE3ZBsFj0sI8aANh5H+DFSCYhVnuBV',
}

/* ─── Tipos de respuesta de Nubox ────────────────────────────────────────────── */

export interface NuboxInvoice {
  id: number
  number: string
  type: {
    id: number
    legalCode: string
    abbreviation: string
    name: string
  }
  totalNetAmount: number
  totalExemptAmount: number
  totalTaxVatAmount: number
  totalAmount: number
  totalOtherTaxesAmount: number
  totalWithholdingAmount: number
  balance: number
  emissionDate: string
  periodMonth: number
  periodYear: number
  dueDate: string
  origin: { id: number; name: string }
  paymentForm: { id: number; legalCode: string; name: string }
  dataCl: { trackId: number; annulled: boolean }
  client: {
    tradeName: string
    identification: { value: string }
    mainActivity: string
  }
  emissionStatus: { id: number; name: string; description: string }
  saleType: { id: number; legalCode: string; name: string }
  links: Array<{ rel: string; href: string }>
}

/* ─── Error personalizado ────────────────────────────────────────────────────── */

export class NuboxError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'NuboxError'
    this.status = status
  }
}

/* ─── Helper genérico ────────────────────────────────────────────────────────── */

async function nuboxFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${NUBOX_CONFIG.baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': NUBOX_CONFIG.partnerToken,
      'x-api-key': NUBOX_CONFIG.apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    let errorDetail = ''
    try {
      const json = await res.json()
      errorDetail = json.message || JSON.stringify(json)
    } catch {
      errorDetail = await res.text()
    }
    throw new NuboxError(
      `Error ${res.status}: ${errorDetail || 'Sin detalle'}`,
      res.status
    )
  }

  return res.json()
}

/* ─── Funciones de consulta ──────────────────────────────────────────────────── */

/**
 * Obtiene todas las facturas de un período específico (YYYY-MM)
 */
export async function fetchInvoicesByPeriod(period: string): Promise<NuboxInvoice[]> {
  return nuboxFetch<NuboxInvoice[]>(`/v1/sales?period=${period}`)
}

/**
 * Obtiene todas las facturas del mes actual
 */
export async function fetchCurrentMonthInvoices(): Promise<NuboxInvoice[]> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return fetchInvoicesByPeriod(`${year}-${month}`)
}

/**
 * Obtiene el detalle de una factura específica
 */
export async function fetchInvoiceDetail(documentId: number): Promise<NuboxInvoice> {
  return nuboxFetch<NuboxInvoice>(`/v1/sales/${documentId}`)
}

/**
 * Prueba rápida: consulta el mes actual y devuelve cuántas facturas hay
 */
export async function testNuboxConnection(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const invoices = await fetchCurrentMonthInvoices()
    return { ok: true, count: invoices.length }
  } catch (err: any) {
    return { ok: false, count: 0, error: err.message }
  }
}