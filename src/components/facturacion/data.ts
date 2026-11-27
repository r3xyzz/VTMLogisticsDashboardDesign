// src/components/facturacion/data.ts
import { type NuboxInvoice } from "../../lib/nubox"
import { daysUntil, parseDate } from "../../lib/dates"

/* ─── Tipos ──────────────────────────────────────────────────────────────────── exportaciones de carga suelta y conenedor LCL=CARGA SUELTA FCL=CONTENEDORES */

export type InvoiceStatus = 
  | "Pendiente" | "Pagada" | "Con detalle" | "Vencida"
  | "Emitido" | "Borrador" | "Anulado" | "En espera de SII"
  | "Rechazado por SII" | "En espera de reemisión"
  | "Sin respuesta SII" | "Reintentar emisión"

export interface Invoice {
  id: string
  numero: string
  counterparty: string
  rut?: string
  direction: "Cliente" | "Proveedor"
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  net: number
  total: number
  containers: string[]
  providerInvoices: string[]
  bl: string
  booking: string
  pdf?: string
  nuboxId?: number
  typeLegalCode?: string
  typeName?: string
  typeAbbreviation?: string
  clientMainActivity?: string
  totalExemptAmount?: number
  totalVatAmount?: number
  totalOtherTaxesAmount?: number
  totalWithholdingAmount?: number
  balance?: number
  periodMonth?: number
  periodYear?: number
  originName?: string
  paymentFormName?: string
  paymentFormLegalCode?: string
  saleTypeName?: string
  emissionStatusId?: number
  emissionStatusName?: string
  emissionStatusDescription?: string
  annulled?: boolean
  trackId?: number
  nuboxLastSync?: string
}

export interface Shipment {
  id: string
  bl: string
  dus: string
  container: string
  booking: string
  port: string
  period: string
  status: "Pendiente" | "Procesado" | "Pagado"
}

export interface Doc {
  id: string
  name: string
  relation: string
  stage: string
  uploaded: string
  size: string
  fileUrl?: string
  filePath?: string
  linkedType?: string
  linkedId?: string
  bl?: string
  booking?: string
  container?: string
  invoiceNumber?: string
  uploadedBy?: string
}

/* ─── Helpers Supabase ↔ React ───────────────────────────────────────────────── */

export function rowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    numero: row.numero,
    counterparty: row.counterparty || row.cliente || '',
    rut: row.rut || '',
    direction: row.direction || 'Cliente',
    status: row.status as InvoiceStatus,
    issueDate: row.issue_date || row.emision || '',
    dueDate: row.due_date || row.vencimiento || '',
    net: Number(row.net ?? row.monto ?? 0),
    total: Number(row.total ?? (Number(row.monto || 0) + Number(row.iva || 0))),
    containers: row.containers || [],
    providerInvoices: row.provider_invoices || [],
    bl: row.bl || '',
    booking: row.booking || '',
    pdf: row.pdf || row.archivo || undefined,
    nuboxId: row.nubox_id,
    typeLegalCode: row.type_legal_code,
    typeName: row.type_name,
    typeAbbreviation: row.type_abbreviation,
    clientMainActivity: row.client_main_activity,
    totalExemptAmount: row.total_exempt_amount,
    totalVatAmount: row.total_vat_amount,
    totalOtherTaxesAmount: row.total_other_taxes_amount,
    totalWithholdingAmount: row.total_withholding_amount,
    balance: row.balance,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    originName: row.origin_name,
    paymentFormName: row.payment_form_name,
    paymentFormLegalCode: row.payment_form_legal_code,
    saleTypeName: row.sale_type_name,
    emissionStatusId: row.emission_status_id,
    emissionStatusName: row.emission_status_name,
    emissionStatusDescription: row.emission_status_description,
    annulled: row.annulled,
    trackId: row.track_id,
    nuboxLastSync: row.nubox_last_sync,
  }
}

export function nuboxToInvoice(nubox: NuboxInvoice): Invoice {
  let status: InvoiceStatus = "Pendiente"
  if (nubox.dataCl?.annulled) {
    status = "Anulado"
  } else if (nubox.emissionStatus?.name === "Emitido") {
    status = "Pendiente"
  } else if (nubox.emissionStatus?.name) {
    status = nubox.emissionStatus.name as InvoiceStatus
  }
  
  return {
    id: String(nubox.id),
    numero: nubox.number || '',
    counterparty: nubox.client?.tradeName || '',
    rut: nubox.client?.identification?.value || '',
    direction: "Cliente",
    status,
    issueDate: nubox.emissionDate || '',
    dueDate: nubox.dueDate || '',
    net: nubox.totalNetAmount || 0,
    total: nubox.totalAmount || 0,
    containers: [],
    providerInvoices: [],
    bl: "",
    booking: "",
    pdf: undefined,
    nuboxId: nubox.id,
    typeLegalCode: nubox.type?.legalCode,
    typeName: nubox.type?.name,
    typeAbbreviation: nubox.type?.abbreviation,
    clientMainActivity: nubox.client?.mainActivity,
    totalExemptAmount: nubox.totalExemptAmount,
    totalVatAmount: nubox.totalTaxVatAmount,
    totalOtherTaxesAmount: nubox.totalOtherTaxesAmount,
    totalWithholdingAmount: nubox.totalWithholdingAmount,
    balance: nubox.balance,
    periodMonth: nubox.periodMonth,
    periodYear: nubox.periodYear,
    originName: nubox.origin?.name,
    paymentFormName: nubox.paymentForm?.name,
    paymentFormLegalCode: nubox.paymentForm?.legalCode,
    saleTypeName: nubox.saleType?.name,
    emissionStatusId: nubox.emissionStatus?.id,
    emissionStatusName: nubox.emissionStatus?.name,
    emissionStatusDescription: nubox.emissionStatus?.description,
    annulled: nubox.dataCl?.annulled || false,
    trackId: nubox.dataCl?.trackId,
    nuboxLastSync: new Date().toISOString(),
  }
}

export function invoiceToRow(inv: Partial<Invoice>): any {
  const row: any = {}
  if (inv.numero !== undefined) row.numero = inv.numero
  if (inv.counterparty !== undefined) row.counterparty = inv.counterparty
  if (inv.rut !== undefined) row.rut = inv.rut
  if (inv.direction !== undefined) row.direction = inv.direction
  if (inv.status !== undefined) row.status = inv.status
  if (inv.issueDate !== undefined) row.issue_date = inv.issueDate
  if (inv.dueDate !== undefined) row.due_date = inv.dueDate
  if (inv.net !== undefined) row.net = inv.net
  if (inv.total !== undefined) row.total = inv.total
  if (inv.containers !== undefined) row.containers = inv.containers
  if (inv.providerInvoices !== undefined) row.provider_invoices = inv.providerInvoices
  if (inv.bl !== undefined) row.bl = inv.bl
  if (inv.booking !== undefined) row.booking = inv.booking
  if (inv.pdf !== undefined) row.pdf = inv.pdf
  if (inv.nuboxId !== undefined) row.nubox_id = inv.nuboxId
  if (inv.typeLegalCode !== undefined) row.type_legal_code = inv.typeLegalCode
  if (inv.typeName !== undefined) row.type_name = inv.typeName
  if (inv.typeAbbreviation !== undefined) row.type_abbreviation = inv.typeAbbreviation
  if (inv.clientMainActivity !== undefined) row.client_main_activity = inv.clientMainActivity
  if (inv.totalExemptAmount !== undefined) row.total_exempt_amount = inv.totalExemptAmount
  if (inv.totalVatAmount !== undefined) row.total_vat_amount = inv.totalVatAmount
  if (inv.totalOtherTaxesAmount !== undefined) row.total_other_taxes_amount = inv.totalOtherTaxesAmount
  if (inv.totalWithholdingAmount !== undefined) row.total_withholding_amount = inv.totalWithholdingAmount
  if (inv.balance !== undefined) row.balance = inv.balance
  if (inv.periodMonth !== undefined) row.period_month = inv.periodMonth
  if (inv.periodYear !== undefined) row.period_year = inv.periodYear
  if (inv.originName !== undefined) row.origin_name = inv.originName
  if (inv.paymentFormName !== undefined) row.payment_form_name = inv.paymentFormName
  if (inv.paymentFormLegalCode !== undefined) row.payment_form_legal_code = inv.paymentFormLegalCode
  if (inv.saleTypeName !== undefined) row.sale_type_name = inv.saleTypeName
  if (inv.emissionStatusId !== undefined) row.emission_status_id = inv.emissionStatusId
  if (inv.emissionStatusName !== undefined) row.emission_status_name = inv.emissionStatusName
  if (inv.emissionStatusDescription !== undefined) row.emission_status_description = inv.emissionStatusDescription
  if (inv.annulled !== undefined) row.annulled = inv.annulled
  if (inv.trackId !== undefined) row.track_id = inv.trackId
  if (inv.nuboxLastSync !== undefined) row.nubox_last_sync = inv.nuboxLastSync
  return row
}

export function rowToShipment(row: any): Shipment {
  return {
    id: row.id,
    bl: row.bl,
    dus: row.dus || '',
    container: row.container,
    booking: row.booking || '',
    port: row.port || '',
    period: row.period || '',
    status: row.status as Shipment['status'],
  }
}

export function rowToDoc(row: any): Doc {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation || '',
    stage: row.stage || 'Final',
    uploaded: new Date(row.created_at).toLocaleString('es-CL', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }),
    size: row.size || 'PDF',
    fileUrl: row.file_url || row.url,
    filePath: row.file_path,
    linkedType: row.linked_type,
    linkedId: row.linked_id,
    bl: row.bl,
    booking: row.booking,
    container: row.container,
    invoiceNumber: row.invoice_number,
    uploadedBy: row.uploaded_by,
  }
}

/* ─── Helpers de estado ──────────────────────────────────────────────────────── */

export function getShipmentDocuments(shipment: Shipment, documents: Doc[]): Doc[] {
  return documents.filter(d =>
    d.fileUrl && 
    d.linkedType === "shipment" &&
    d.linkedId === shipment.id
  )
}

export function getInvoiceDocumentsForShipment(shipment: Shipment, documents: Doc[]): Doc[] {
  return documents.filter(d =>
    d.fileUrl && 
    d.linkedType === "invoice" &&
    d.linkedId === shipment.id
  )
}

export type ShipmentDocStatus = "sin_subir" | "incompleto" | "subido"

export function getShipmentDocStatus(
  shipment: Shipment,
  documents: Doc[]
): {
  status: ShipmentDocStatus
  hasInvoice: boolean
  hasShipmentDoc: boolean
  invoiceCount: number
  shipmentDocCount: number
} {
  const invoiceDocs = getInvoiceDocumentsForShipment(shipment, documents)
  const shipmentDocs = getShipmentDocuments(shipment, documents)
  const hasInvoice = invoiceDocs.length > 0
  const hasShipmentDoc = shipmentDocs.length > 0

  let status: ShipmentDocStatus = "sin_subir"
  if (hasInvoice && hasShipmentDoc) status = "subido"
  else if (hasInvoice || hasShipmentDoc) status = "incompleto"

  return {
    status,
    hasInvoice,
    hasShipmentDoc,
    invoiceCount: invoiceDocs.length,
    shipmentDocCount: shipmentDocs.length,
  }
}

/* ─── Helpers de vencimiento ─────────────────────────────────────────────────── */

export function calcDaysToDue(dueDate: string): number | null {
  if (!dueDate) return null
  return daysUntil(dueDate)
}

export function getDiasLabel(days: number | null): string {
  if (days === null) return "—"
  if (days < 0) return `${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""} vencida`
  if (days === 0) return "Vence hoy"
  return `${days} día${days !== 1 ? "s" : ""}`
}

/* ─── Helpers UI ─────────────────────────────────────────────────────────────── */

export const money = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)

export function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    return parseDate(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}
