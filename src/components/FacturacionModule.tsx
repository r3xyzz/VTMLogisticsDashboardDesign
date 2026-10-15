// src/components/FacturacionModule.tsx
import { useMemo, useRef, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { fetchInvoicesByPeriod, type NuboxInvoice } from "../lib/nubox"

/* ─── Iconos ─────────────────────────────────────────────────────────────────── */

type IconName =
  | "alert" | "arrow" | "booking" | "box" | "check" | "chevron" | "clock"
  | "document" | "download" | "eye" | "file" | "finance" | "link" | "more"
  | "plus" | "refresh" | "search" | "trash" | "upload"

const iconPaths: Record<IconName, string[]> = {
  alert: ["M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.866-1.5 3.03-1.5 3.896 0l7.355 12.746z", "M12 16.5h.008v.008H12V16.5z"],
  arrow: ["M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"],
  booking: ["M6.75 3v2.25M17.25 3v2.25M3.75 9.75h16.5", "M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5z"],
  box: ["M21 8.25 12 13.5 3 8.25M12 21V13.5", "M19.5 6.75 12 2.25 4.5 6.75v10.5L12 21l7.5-3.75V6.75z"],
  check: ["m4.5 12.75 6 6 9-13.5"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 6v6h4.5", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  document: ["M15.75 2.25H6A2.25 2.25 0 0 0 3.75 4.5v15A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25V6.75L15.75 2.25z", "M15.75 2.25v4.5h4.5M8.25 12h7.5m-7.5 3h7.5"],
  download: ["M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5", "M4.5 18.75h15"],
  eye: ["M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
  file: ["M14.25 2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V7.5l-5.25-5.25z", "M14.25 2.25V7.5h5.25"],
  finance: ["M12 6v12m3-9.75c0-1.243-1.343-2.25-3-2.25S9 7.007 9 8.25s1.343 2.25 3 2.25 3 1.007 3 2.25S13.657 15 12 15s-3-1.007-3-2.25", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  link: ["M10.5 13.5a3 3 0 0 0 4.243 0l3-3a3 3 0 0 0-4.243-4.243l-1.5 1.5", "M13.5 10.5a3 3 0 0 0-4.243 0l-3 3a3 3 0 0 0 4.243 4.243l1.5-1.5"],
  more: ["M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"],
  plus: ["M12 4.5v15m7.5-7.5h-15"],
  refresh: ["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"],
  search: ["m21 21-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  trash: ["M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"],
  upload: ["M12 16.5v-12m0 0-4.5 4.5M12 4.5l4.5 4.5", "M4.5 15.75v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"],
}

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      {iconPaths[name].map((path, index) => (
        <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/* ─── Tipos ──────────────────────────────────────────────────────────────────── */

type InvoiceStatus = 
  | "Pendiente" | "Pagada" | "Con detalle" | "Vencida"
  | "Emitido" | "Borrador" | "Anulado" | "En espera de SII"
  | "Rechazado por SII" | "En espera de reemisión"
  | "Sin respuesta SII" | "Reintentar emisión"

interface Invoice {
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

interface Shipment {
  id: string
  bl: string
  dus: string
  container: string
  booking: string
  port: string
  period: string
  status: "Pendiente" | "Procesado" | "Pagado"
}

interface Doc {
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

function rowToInvoice(row: any): Invoice {
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

function nuboxToInvoice(nubox: NuboxInvoice): Invoice {
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

function invoiceToRow(inv: Partial<Invoice>): any {
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

function rowToShipment(row: any): Shipment {
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

function rowToDoc(row: any): Doc {
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

function getShipmentDocuments(shipment: Shipment, documents: Doc[]): Doc[] {
  return documents.filter(d =>
    d.fileUrl && 
    d.linkedType === "shipment" &&
    d.linkedId === shipment.id
  )
}

function getGenericInvoiceDocs(shipment: Shipment, documents: Doc[]): Doc[] {
  return documents.filter(d =>
    d.fileUrl && 
    d.linkedType === "invoice" &&
    d.linkedId === shipment.id &&
    !d.invoiceNumber
  )
}

function getInvoiceDocuments(invoice: Invoice, documents: Doc[]): Doc[] {
  return documents.filter(d =>
    d.fileUrl && 
    d.linkedType === "invoice" &&
    d.invoiceNumber === invoice.numero
  )
}

function invoiceHasUploadedDoc(invoice: Invoice, documents: Doc[]): boolean {
  return getInvoiceDocuments(invoice, documents).length > 0
}

function getShipmentInvoicesStatus(
  shipment: Shipment,
  invoices: Invoice[],
  documents: Doc[]
) {
  const relatedInvoices = invoices.filter((inv) =>
    (inv.bl && inv.bl === shipment.bl) ||
    (inv.booking && inv.booking === shipment.booking) ||
    (inv.containers && inv.containers.includes(shipment.container))
  )

  const uploadedCount = relatedInvoices.filter(inv =>
    invoiceHasUploadedDoc(inv, documents)
  ).length

  return {
    total: relatedInvoices.length,
    uploaded: uploadedCount,
    missing: relatedInvoices.length - uploadedCount,
    relatedInvoices,
  }
}

function getDocumentsForShipments(shipments: Shipment[], documents: Doc[]): Doc[] {
  const shipmentIds = new Set(shipments.map(s => s.id))
  const bls = new Set(shipments.map(s => s.bl).filter(Boolean))
  const bookings = new Set(shipments.map(s => s.booking).filter(Boolean))
  const containers = new Set(shipments.map(s => s.container).filter(Boolean))

  return documents.filter(d => {
    if (!d.fileUrl) return false
    if (d.linkedId && shipmentIds.has(d.linkedId)) return true
    if (d.bl && bls.has(d.bl)) return true
    if (d.booking && bookings.has(d.booking)) return true
    if (d.container && containers.has(d.container)) return true
    return false
  })
}

/* ─── Helpers UI ─────────────────────────────────────────────────────────────── */

const money = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
    Pagada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Pagado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Procesado: "bg-blue-50 text-blue-700 ring-blue-200",
    "Con detalle": "bg-violet-50 text-violet-700 ring-violet-200",
    Vencida: "bg-red-50 text-red-700 ring-red-200",
    Final: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Inicial: "bg-slate-100 text-slate-600 ring-slate-200",
    "Timbrado y firmado": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Respaldo: "bg-blue-50 text-blue-700 ring-blue-200",
    Emitido: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Borrador: "bg-slate-100 text-slate-500 ring-slate-200",
    Anulado: "bg-slate-900 text-white ring-slate-700",
    "En espera de SII": "bg-yellow-50 text-yellow-700 ring-yellow-200",
    "Rechazado por SII": "bg-red-100 text-red-800 ring-red-300",
    "En espera de reemisión": "bg-orange-50 text-orange-700 ring-orange-200",
    "Sin respuesta SII": "bg-orange-100 text-orange-800 ring-orange-300",
    "Reintentar emisión": "bg-orange-200 text-orange-900 ring-orange-400",
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{status}</span>
}

function InvoiceStatusBadge({
  total, uploaded, missing, size = "default",
}: {
  total: number
  uploaded: number
  missing: number
  size?: "default" | "small"
}) {
  if (total === 0) {
    return <span className="text-[10px] text-slate-300">—</span>
  }
  const isComplete = missing === 0
  if (size === "small") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
        isComplete ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
      }`}>
        <Icon name={isComplete ? "check" : "clock"} className="size-3" />
        {uploaded}/{total}
      </span>
    )
  }
  return (
    <div className="space-y-0.5">
      {uploaded > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
          <Icon name="check" className="size-3" />
          {uploaded} subida{uploaded !== 1 ? "s" : ""}
        </div>
      )}
      {missing > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
          <Icon name="clock" className="size-3" />
          {missing} sin subir
        </div>
      )}
    </div>
  )
}

function ActionButton({
  children, onClick, variant = "primary", type = "button", disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  type?: "button" | "submit"
  disabled?: boolean
}) {
  const styles = {
    primary: "bg-slate-800 text-white shadow-sm hover:bg-slate-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  }
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  )
}

function SectionTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

type WorkspaceTab = "facturas" | "embarques" | "reservas" | "documentos"

export default function FacturacionModule() {
  const [tab, setTab] = useState<WorkspaceTab>("facturas")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [documents, setDocuments] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [invoiceFilter, setInvoiceFilter] = useState<"Todas" | "Clientes" | "Proveedores">("Todas")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [toast, setToast] = useState("")
  const [bookingQuery, setBookingQuery] = useState("SB-10482")
  const [uploading, setUploading] = useState(false)

  const NUBOX_PERIOD = '2026-09'

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 4000)
  }

  const fetchFromSupabase = async () => {
    try {
      setError(null)
      const [invRes, shipRes, docRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('document_repository').select('*').order('created_at', { ascending: false }),
      ])

      if (invRes.error) throw invRes.error
      if (shipRes.error) throw shipRes.error
      if (docRes.error) throw docRes.error

      setInvoices((invRes.data || []).map(rowToInvoice))
      setShipments((shipRes.data || []).map(rowToShipment))
      setDocuments((docRes.data || []).map(rowToDoc))
    } catch (err: any) {
      console.error('❌ Error al cargar desde Supabase:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const syncWithNubox = async () => {
    try {
      setSyncing(true)
      setError(null)

      console.log(`🔄 Sincronizando con Nubox · período: ${NUBOX_PERIOD}`)
      
      const nuboxInvoices = await fetchInvoicesByPeriod(NUBOX_PERIOD)
      console.log(`✅ ${nuboxInvoices.length} facturas recibidas de Nubox`)

      if (nuboxInvoices.length === 0) {
        showToast('⚠️ No hay facturas en el período seleccionado')
        return
      }

      const { data: existingInvoices, error: fetchErr } = await supabase
        .from('invoices')
        .select('id, numero, bl, booking, containers, provider_invoices, pdf, direction')

      if (fetchErr) throw fetchErr

      const existingMap = new Map<string, any>()
      for (const inv of existingInvoices || []) {
        if (inv.numero) existingMap.set(inv.numero, inv)
      }

      const dedupedMap = new Map<string, any>()

      for (const nuboxInv of nuboxInvoices) {
        const mapped = nuboxToInvoice(nuboxInv)
        const row = invoiceToRow(mapped)
        const existing = existingMap.get(mapped.numero)

        let finalRow: any
        if (existing) {
          finalRow = {
            ...row,
            bl: existing.bl || '',
            booking: existing.booking || '',
            containers: existing.containers || [],
            provider_invoices: existing.provider_invoices || [],
            pdf: existing.pdf || null,
            direction: existing.direction || 'Cliente',
          }
        } else {
          finalRow = row
        }

        dedupedMap.set(mapped.numero, finalRow)
      }

      const rowsToUpsert = Array.from(dedupedMap.values())
      const BATCH_SIZE = 25
      const totalBatches = Math.ceil(rowsToUpsert.length / BATCH_SIZE)
      
      let procesadas = 0
      let errores: string[] = []

      for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const batch = rowsToUpsert.slice(i, i + BATCH_SIZE)
        
        try {
          const { error: upsertErr } = await supabase
            .from('invoices')
            .upsert(batch, {
              onConflict: 'numero',
              ignoreDuplicates: false,
            })

          if (upsertErr) throw upsertErr
          procesadas += batch.length
        } catch (err: any) {
          console.error(`❌ Error en lote ${batchNumber}/${totalBatches}:`, err)
          errores.push(`Lote ${batchNumber}: ${err.message}`)
        }
      }

      await fetchFromSupabase()

      if (errores.length === 0) {
        showToast(`✅ ${procesadas} facturas sincronizadas correctamente`)
      } else {
        showToast(`⚠️ ${procesadas} sincronizadas · ${errores.length} lotes con error`)
        setError(`${errores.length} lotes fallaron. Revisa la consola.`)
      }

    } catch (err: any) {
      console.error('❌ Error al sincronizar:', err)
      setError(err.message || 'Error al sincronizar con Nubox')
    } finally {
      setSyncing(false)
    }
  }

  const uploadDocument = async (params: {
    file: File
    relation: string
    linkedType: "invoice" | "shipment"
    linkedId: string
    bl?: string
    booking?: string
    container?: string
    invoiceNumber?: string
  }) => {
    const { file, relation, linkedType, linkedId, bl, booking, container, invoiceNumber } = params

    try {
      setUploading(true)
      setError(null)

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${relation}/${timestamp}_${safeName}`

      console.log(`📤 Subiendo archivo: ${filePath} · linkedType=${linkedType}`)

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const sizeInMB = file.size / (1024 * 1024)
      const sizeFormatted = sizeInMB >= 1 
        ? `${sizeInMB.toFixed(1).replace('.', ',')} MB`
        : `${(file.size / 1024).toFixed(0)} KB`

      const { error: insertErr } = await supabase
        .from('document_repository')
        .insert([{
          name: file.name,
          relation,
          stage: 'Timbrado y firmado',
          size: sizeFormatted,
          url: urlData.publicUrl,
          file_url: urlData.publicUrl,
          file_path: filePath,
          linked_type: linkedType,
          linked_id: linkedId,
          bl: bl || null,
          booking: booking || null,
          container: container || null,
          invoice_number: invoiceNumber || null,
        }])

      if (insertErr) {
        console.warn('⚠️ Insert falló, limpiando archivo del Storage...')
        await supabase.storage.from('documents').remove([filePath])
        throw insertErr
      }

      await fetchFromSupabase()
      showToast(`✅ "${file.name}" subido correctamente`)

    } catch (err: any) {
      console.error('❌ Error al subir documento:', err)
      setError(err.message || 'Error al subir el documento')
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async (doc: Doc) => {
    if (!confirm(`¿Eliminar "${doc.name}"? Esta acción no se puede deshacer.`)) return

    try {
      setError(null)

      if (doc.filePath) {
        const { error: storageErr } = await supabase.storage
          .from('documents')
          .remove([doc.filePath])

        if (storageErr) {
          console.warn('⚠️ No se pudo borrar de Storage:', storageErr)
        }
      }

      const { error: deleteErr } = await supabase
        .from('document_repository')
        .delete()
        .eq('id', doc.id)

      if (deleteErr) throw deleteErr

      await fetchFromSupabase()
      showToast(`🗑 "${doc.name}" eliminado`)

    } catch (err: any) {
      console.error('❌ Error al eliminar documento:', err)
      setError(err.message || 'Error al eliminar el documento')
    }
  }

  useEffect(() => {
    fetchFromSupabase()
  }, [])

  const receivable = invoices
    .filter((inv) => inv.direction === "Cliente" && inv.status !== "Pagada")
    .reduce((sum, inv) => sum + inv.total, 0)
  const payable = invoices
    .filter((inv) => inv.direction === "Proveedor" && inv.status !== "Pagada")
    .reduce((sum, inv) => sum + inv.total, 0)

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter((inv) => {
      const directionMatch =
        invoiceFilter === "Todas" ||
        (invoiceFilter === "Clientes" && inv.direction === "Cliente") ||
        (invoiceFilter === "Proveedores" && inv.direction === "Proveedor")
      return directionMatch && [
        inv.numero, inv.counterparty, inv.rut,
        inv.typeName, inv.typeAbbreviation, inv.emissionStatusName,
        inv.bl, inv.booking, ...inv.containers
      ].join(" ").toLowerCase().includes(q)
    })
  }, [invoices, invoiceFilter, search])

  const workspaceTabs: { id: WorkspaceTab; label: string; icon: IconName; count?: number }[] = [
    { id: "facturas", label: "Facturas y pagos", icon: "finance", count: invoices.length },
    { id: "embarques", label: "BL y contenedores", icon: "box", count: shipments.length },
    { id: "reservas", label: "Reservas", icon: "booking" },
    { id: "documentos", label: "Repositorio", icon: "document", count: documents.filter(d => d.fileUrl).length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando datos financieros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Finanzas</span>
              <span className="text-slate-300">/</span>
              <span>Gestión documental</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Documentos y facturación</h1>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton 
              variant="secondary" 
              onClick={syncWithNubox}
              disabled={syncing}
            >
              <Icon name="refresh" className={syncing ? "animate-spin" : ""} />
              {syncing ? 'Sincronizando...' : 'Sincronizar con Nubox'}
            </ActionButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-5 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <Icon name="alert" className="size-5 text-red-600" />
            <span className="text-xs font-semibold text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <section className="grid gap-3 lg:grid-cols-4">
          <Metric label="Por cobrar a clientes" value={money(receivable)} detail={`${invoices.filter((inv) => inv.direction === "Cliente" && inv.status !== "Pagada").length} facturas abiertas`} tone="blue" icon="arrow" />
          <Metric label="Por pagar a proveedores" value={money(payable)} detail={`${invoices.filter((inv) => inv.direction === "Proveedor" && inv.status !== "Pagada").length} facturas abiertas`} tone="orange" icon="arrow" reverse />
          <Metric label="Documentos vinculados" value={String(documents.filter(d => d.fileUrl).length)} detail="Repositorio histórico" tone="green" icon="document" />
          <Metric label="Alertas activas" value={String(invoices.filter(i => i.status === 'Vencida' || i.emissionStatusName === 'Rechazado por SII').length)} detail="Vencidas / Rechazadas" tone="red" icon="alert" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex overflow-x-auto border-b border-slate-200 px-3">
            {workspaceTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex h-14 items-center gap-2 border-b-2 px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === item.id ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
                {item.count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{item.count}</span>}
              </button>
            ))}
          </div>

          {tab === "facturas" && (
            <InvoicesTab
              invoices={filteredInvoices}
              totalInvoices={invoices.length}
              search={search}
              setSearch={setSearch}
              filter={invoiceFilter}
              setFilter={setInvoiceFilter}
              onSelect={setSelectedInvoice}
              onSync={syncWithNubox}
              syncing={syncing}
            />
          )}
          {tab === "embarques" && (
            <ShipmentsView 
              shipments={shipments} 
              invoices={invoices}
              documents={documents}
              onSelect={setSelectedShipment}
            />
          )}
          {tab === "reservas" && (
            <BookingsView 
              query={bookingQuery} 
              setQuery={setBookingQuery} 
              invoices={invoices} 
              shipments={shipments}
              documents={documents}
            />
          )}
          {tab === "documentos" && (
            <DocumentsView documents={documents} onDelete={deleteDocument} />
          )}
        </section>
      </main>

      {selectedInvoice && (
        <InvoicePanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {selectedShipment && (
        <ShipmentPanel
          shipment={selectedShipment}
          invoices={invoices}
          documents={documents}
          uploading={uploading}
          onClose={() => setSelectedShipment(null)}
          onSelectInvoice={(inv) => {
            setSelectedShipment(null)
            setSelectedInvoice(inv)
          }}
          onUploadForInvoice={async (file, invoice) => {
            await uploadDocument({
              file,
              relation: invoice.numero || selectedShipment.bl,
              linkedType: "invoice",
              linkedId: invoice.id,
              bl: selectedShipment.bl,
              booking: selectedShipment.booking,
              container: selectedShipment.container,
              invoiceNumber: invoice.numero,
            })
          }}
          onUploadForInvoiceGeneric={async (file) => {
            await uploadDocument({
              file,
              relation: selectedShipment.bl || selectedShipment.booking || selectedShipment.container,
              linkedType: "invoice",
              linkedId: selectedShipment.id,
              bl: selectedShipment.bl,
              booking: selectedShipment.booking,
              container: selectedShipment.container,
            })
          }}
          onUploadForShipment={async (file) => {
            await uploadDocument({
              file,
              relation: selectedShipment.bl || selectedShipment.booking || selectedShipment.container,
              linkedType: "shipment",
              linkedId: selectedShipment.id,
              bl: selectedShipment.bl,
              booking: selectedShipment.booking,
              container: selectedShipment.container,
            })
          }}
          onDeleteDocument={deleteDocument}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl">
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function Metric({ label, value, detail, tone, icon, reverse }: { label: string; value: string; detail: string; tone: "blue" | "orange" | "green" | "red"; icon: IconName; reverse?: boolean }) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${toneClasses[tone]} ${reverse ? "rotate-180" : ""}`}><Icon name={icon} /></span>
      </div>
    </div>
  )
}

function InvoicesTab({ 
  invoices, totalInvoices, search, setSearch, filter, setFilter, onSelect, onSync, syncing,
}: {
  invoices: Invoice[]
  totalInvoices: number
  search: string
  setSearch: (v: string) => void
  filter: "Todas" | "Clientes" | "Proveedores"
  setFilter: (f: "Todas" | "Clientes" | "Proveedores") => void
  onSelect: (inv: Invoice) => void
  onSync: () => void
  syncing: boolean
}) {
  if (totalInvoices === 0) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Icon name="refresh" className="size-8 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No hay facturas sincronizadas</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Haz clic en "Sincronizar con Nubox" para traer las facturas del período 2026-09.
        </p>
        <div className="mt-6">
          <ActionButton onClick={onSync} disabled={syncing}>
            <Icon name="refresh" className={syncing ? "animate-spin" : ""} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con Nubox'}
          </ActionButton>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <SectionTitle title="Control financiero unificado" description="Vista simplificada de cobros y pagos con trazabilidad documental." />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar factura, RUT, empresa, tipo, estado..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(["Todas", "Clientes", "Proveedores"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1200px] text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {["Documento", "Contraparte", "Tipo", "Vínculos", "Emisión", "Vencimiento", "Neto", "IVA", "Total", "Estado", "Pago", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr><td colSpan={12} className="text-center py-12 text-xs text-slate-400">No hay facturas que coincidan con la búsqueda.</td></tr>
            )}
            {invoices.map((inv) => {
              const displayStatus = inv.emissionStatusName || inv.status
              const isOverdue = inv.status === "Vencida" || (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "Pagada")
              const isRejected = inv.emissionStatusName === "Rechazado por SII"
              
              return (
                <tr key={inv.id} className="group hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <button onClick={() => onSelect(inv)} className="text-left">
                      <span className="block font-mono text-xs font-semibold text-slate-800">{inv.numero || '—'}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {inv.direction === "Cliente" ? "Emitida a cliente" : "Recibida de proveedor"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-slate-700">{inv.counterparty || '—'}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">{inv.rut || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                      {inv.typeAbbreviation || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.bl ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <Icon name="link" className="size-3.5 text-slate-400" />
                          <span className="font-mono">{inv.bl}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {inv.containers.length} cont. · {inv.booking || '—'}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-slate-600">{formatDate(inv.issueDate)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[11px] ${isOverdue ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                      {formatDate(inv.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{money(inv.net)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                    {inv.totalVatAmount !== undefined ? money(inv.totalVatAmount) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-900">{money(inv.total)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={displayStatus} />
                    {isRejected && (
                      <div className="mt-1 text-[9px] text-red-600 font-semibold">Rechazada</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] text-slate-500">{inv.paymentFormName || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => onSelect(inv)} 
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" 
                      aria-label={`Ver ${inv.numero}`}
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        {invoices.length} de {totalInvoices} facturas · Datos desde Supabase
      </p>
    </div>
  )
}

function ShipmentsView({ 
  shipments, invoices, documents, onSelect,
}: { 
  shipments: Shipment[]
  invoices: Invoice[]
  documents: Doc[]
  onSelect: (s: Shipment) => void
}) {
  const [shipmentSearch, setShipmentSearch] = useState("")

  const filteredShipments = useMemo(() => {
    const q = shipmentSearch.trim().toLowerCase()
    if (!q) return shipments
    return shipments.filter((s) =>
      [s.bl, s.dus, s.container, s.booking, s.port, s.period].join(" ").toLowerCase().includes(q)
    )
  }, [shipments, shipmentSearch])

  const duplicates = shipments.filter((s, i, arr) => arr.findIndex(x => x.container === s.container) !== i)

  return (
    <div className="p-5">
      <SectionTitle title="BL, DUS y contenedores" description="Control histórico con validación de duplicidad entre periodos." />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={shipmentSearch}
            onChange={(e) => setShipmentSearch(e.target.value)}
            placeholder="Buscar por BL, DUS, contenedor o reserva..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        {shipmentSearch && (
          <button onClick={() => setShipmentSearch("")} className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-start sm:self-center">
            Limpiar búsqueda
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 self-start sm:self-center">
          {filteredShipments.length} de {shipments.length} embarques
        </span>
      </div>

      {duplicates.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-3">
            <Icon name="alert" className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-800">{duplicates.length} coincidencias históricas detectadas</p>
              <p className="mt-1 text-[11px] text-amber-700">Algunos contenedores aparecen más de una vez.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50">
            <tr>{["BL", "DUS", "Contenedor", "Reserva / Puerto", "Periodo", "Estado", "Facturas", "Acción"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredShipments.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-xs text-slate-400">
                  {shipmentSearch ? `No se encontraron embarques que coincidan con "${shipmentSearch}".` : "No hay embarques registrados."}
                </td>
              </tr>
            )}
            {filteredShipments.map((s) => {
              const status = getShipmentInvoicesStatus(s, invoices, documents)
              return (
                <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(s)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{s.bl}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.dus}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{s.container}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{s.booking}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{s.port}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.period}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-200 mb-1">
                        <Icon name="finance" className="size-3" />
                        {status.total}
                      </span>
                      <InvoiceStatusBadge 
                        total={status.total} 
                        uploaded={status.uploaded} 
                        missing={status.missing} 
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelect(s); }}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" 
                      aria-label={`Ver ${s.container}`}
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShipmentPanel({ 
  shipment, invoices, documents, uploading, onClose, onSelectInvoice,
  onUploadForInvoice, onUploadForInvoiceGeneric, onUploadForShipment, onDeleteDocument,
}: { 
  shipment: Shipment
  invoices: Invoice[]
  documents: Doc[]
  uploading: boolean
  onClose: () => void
  onSelectInvoice: (inv: Invoice) => void
  onUploadForInvoice: (file: File, invoice: Invoice) => Promise<void>
  onUploadForInvoiceGeneric: (file: File) => Promise<void>
  onUploadForShipment: (file: File) => Promise<void>
  onDeleteDocument: (doc: Doc) => void
}) {
  const relatedInvoices = invoices.filter((inv) =>
    (inv.bl && inv.bl === shipment.bl) ||
    (inv.booking && inv.booking === shipment.booking) ||
    (inv.containers && inv.containers.includes(shipment.container))
  )

  const shipmentDocs = getShipmentDocuments(shipment, documents)
  const genericInvoiceDocs = getGenericInvoiceDocs(shipment, documents)

  const totalRelacionado = relatedInvoices.reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Embarque / Contenedor</p>
              <h2 className="mt-1 font-mono text-xl font-bold text-slate-900">{shipment.container}</h2>
              <p className="mt-1 text-xs text-slate-500">BL {shipment.bl}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <span className="text-lg">×</span>
            </button>
          </div>
          <div className="mt-4"><StatusPill status={shipment.status} /></div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos del embarque</p>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="BL" value={shipment.bl} mono />
              <Detail label="DUS" value={shipment.dus || '—'} mono />
              <Detail label="Contenedor" value={shipment.container} mono />
              <Detail label="Reserva" value={shipment.booking || '—'} mono />
              <Detail label="Puerto" value={shipment.port || '—'} />
              <Detail label="Periodo" value={shipment.period || '—'} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Facturas relacionadas ({relatedInvoices.length})
              </p>
              {relatedInvoices.length > 0 && (
                <span className="font-mono text-[11px] font-bold text-slate-700">
                  {money(totalRelacionado)}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {relatedInvoices.length === 0 ? (
                <>
                  <div className="rounded-xl border border-slate-200 p-4 text-center">
                    <Icon name="finance" className="mx-auto size-7 text-slate-300" />
                    <p className="mt-2 text-[11px] text-slate-400">
                      No hay facturas vinculadas a este BL, reserva o contenedor.
                    </p>
                  </div>
                  <InvoiceDropZone
                    label="Arrastra o click para subir factura física"
                    sublabel="Se guarda como factura del embarque"
                    documents={genericInvoiceDocs}
                    uploading={uploading}
                    onUpload={onUploadForInvoiceGeneric}
                    onDelete={onDeleteDocument}
                  />
                </>
              ) : (
                <>
                  {relatedInvoices.map((inv) => {
                    const invDocs = getInvoiceDocuments(inv, documents)
                    const hasDoc = invDocs.length > 0
                    return (
                      <InvoiceWithDropZone
                        key={inv.id}
                        invoice={inv}
                        documents={invDocs}
                        hasDoc={hasDoc}
                        uploading={uploading}
                        onSelect={() => onSelectInvoice(inv)}
                        onUpload={(file) => onUploadForInvoice(file, inv)}
                        onDelete={onDeleteDocument}
                      />
                    )
                  })}
                  <InvoiceDropZone
                    label="Subir otra factura"
                    sublabel="Se guarda como factura genérica del embarque"
                    documents={genericInvoiceDocs}
                    uploading={uploading}
                    onUpload={onUploadForInvoiceGeneric}
                    onDelete={onDeleteDocument}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Documentos del embarque ({shipmentDocs.length})
              </p>
            </div>
            <DocumentDropZone
              documents={shipmentDocs}
              onUpload={onUploadForShipment}
              onDelete={onDeleteDocument}
              uploading={uploading}
            />
          </div>

          <div className="flex gap-2 border-t border-slate-100 pt-5">
            <ActionButton variant="secondary" onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ─── 🆕 InvoiceDropZone — SIN botón de ver ──────────────────────────────────── */
function InvoiceDropZone({
  label, sublabel, documents, uploading, onUpload, onDelete,
}: {
  label: string
  sublabel?: string
  documents: Doc[]
  uploading: boolean
  onUpload: (file: File) => Promise<void>
  onDelete: (doc: Doc) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
          uploading
            ? "border-blue-300 bg-blue-50 cursor-wait"
            : isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Icon name="refresh" className="size-4 text-blue-500 animate-spin" />
            <span className="text-[10px] font-semibold text-blue-700">Subiendo...</span>
          </div>
        ) : (
          <>
            <Icon name="upload" className={`mx-auto size-6 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            <p className={`mt-1.5 text-[11px] font-semibold ${isDragging ? "text-blue-700" : "text-slate-700"}`}>
              {isDragging ? "Suelta el archivo aquí" : label}
            </p>
            {sublabel && (
              <p className="mt-0.5 text-[9px] text-slate-400">{sublabel}</p>
            )}
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {documents.length > 0 && (
        <div className="rounded-xl border border-slate-200">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
                <Icon name="finance" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {doc.size} · {doc.uploaded}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc)}
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                title="Eliminar"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── 🆕 InvoiceWithDropZone — SIN botón de ver ─────────────────────────────── */
function InvoiceWithDropZone({
  invoice, documents, hasDoc, uploading, onSelect, onUpload, onDelete,
}: {
  invoice: Invoice
  documents: Doc[]
  hasDoc: boolean
  uploading: boolean
  onSelect: () => void
  onUpload: (file: File) => Promise<void>
  onDelete: (doc: Doc) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
          <Icon name="finance" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs font-bold text-slate-800">{invoice.numero}</p>
            {hasDoc && (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.5 text-[8px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Icon name="check" className="size-2.5" />
                SUBIDA
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500 truncate">
            {invoice.counterparty} · {invoice.direction === "Cliente" ? "Cliente" : "Proveedor"}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-xs font-bold text-slate-800">{money(invoice.total)}</p>
          <p className="mt-0.5 text-[9px] text-slate-400">{formatDate(invoice.dueDate)}</p>
        </div>
      </button>

      <div
        onClick={(e) => {
          e.stopPropagation()
          if (!uploading) fileInputRef.current?.click()
        }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`cursor-pointer border-t p-3 text-center transition ${
          uploading
            ? "border-blue-200 bg-blue-50 cursor-wait"
            : isDragging
            ? "border-blue-300 bg-blue-50"
            : "border-slate-100 bg-slate-50/50 hover:bg-slate-100"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Icon name="refresh" className="size-4 text-blue-500 animate-spin" />
            <span className="text-[10px] font-semibold text-blue-700">Subiendo...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Icon name="upload" className={`size-3.5 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            <span className={`text-[10px] font-semibold ${isDragging ? "text-blue-700" : "text-slate-500"}`}>
              {isDragging ? "Suelta aquí" : hasDoc ? "Subir otro archivo" : "Arrastra o click para subir factura física"}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {documents.length > 0 && (
        <div className="border-t border-slate-100 bg-white">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0">
              <Icon name="file" className="size-3 text-red-500 flex-shrink-0" />
              <p className="truncate text-[10px] font-medium text-slate-700 flex-1">{doc.name}</p>
              <span className="text-[9px] text-slate-400 flex-shrink-0">{doc.size}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(doc) }}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                title="Eliminar"
              >
                <Icon name="trash" className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── 🆕 DocumentDropZone — SIN botón de ver ────────────────────────────────── */
function DocumentDropZone({
  documents, onUpload, onDelete, uploading,
}: {
  documents: Doc[]
  onUpload: (file: File) => Promise<void>
  onDelete: (doc: Doc) => void
  uploading: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${
          uploading
            ? "border-blue-300 bg-blue-50 cursor-wait"
            : isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <>
            <Icon name="refresh" className="mx-auto size-7 text-blue-500 animate-spin" />
            <p className="mt-2 text-xs font-semibold text-blue-700">Subiendo...</p>
          </>
        ) : (
          <>
            <Icon name="document" className={`mx-auto size-7 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            <p className={`mt-2 text-xs font-semibold ${isDragging ? "text-blue-700" : "text-slate-700"}`}>
              {isDragging ? "Suelta el archivo aquí" : "Arrastra DUS/BL o click para subir"}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Documentos propios del embarque (DUS, BL)
            </p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {documents.length > 0 && (
        <div className="rounded-xl border border-slate-200">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
              <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                <Icon name="file" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {doc.size} · {doc.uploaded}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc)}
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                title="Eliminar"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BookingsView({ 
  query, setQuery, invoices, shipments, documents,
}: { 
  query: string
  setQuery: (v: string) => void
  invoices: Invoice[]
  shipments: Shipment[]
  documents: Doc[]
}) {
  const q = query.trim().toLowerCase()

  const matchedShipments = shipments.filter((s) =>
    s.booking.toLowerCase() === q ||
    s.bl.toLowerCase() === q ||
    s.container.toLowerCase() === q
  )

  const matchedInvoices = invoices.filter((inv) =>
    inv.booking.toLowerCase() === q ||
    (inv.bl && matchedShipments.some(s => s.bl === inv.bl)) ||
    (inv.containers && inv.containers.some(c => matchedShipments.some(s => s.container === c)))
  )

  const matchedDocuments = getDocumentsForShipments(matchedShipments, documents)

  const hasResults = matchedInvoices.length + matchedShipments.length + matchedDocuments.length > 0

  return (
    <div className="p-5">
      <SectionTitle title="Consulta de reservas" description="Busca un SAI BOOK, BL o contenedor para desplegar todos sus vínculos." />
      <div className="mt-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 font-mono text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200" 
            placeholder="Ej. SB-10482 · BL-CL-84801 · COSU-9104420" 
          />
        </div>
        <ActionButton>Consultar</ActionButton>
      </div>

      {hasResults ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-4 text-white">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white/10">
              <Icon name="booking" className="size-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-bold">{query}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {matchedShipments[0]?.port ?? "Puerto por confirmar"} · {matchedShipments.length} contenedores · {matchedInvoices.length} facturas · {matchedDocuments.length} documentos
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LinkedBlock title={`Facturas vinculadas (${matchedInvoices.length})`} icon="finance">
              {matchedInvoices.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-2">Sin facturas vinculadas.</p>
              ) : (
                matchedInvoices.map((inv) => {
                  const hasUploaded = invoiceHasUploadedDoc(inv, documents)
                  return (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-slate-700">{inv.numero}</p>
                        <p className="mt-1 text-[10px] text-slate-400 truncate">
                          {inv.counterparty} · {money(inv.total)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset flex-shrink-0 ${
                        hasUploaded ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
                      }`}>
                        <Icon name={hasUploaded ? "check" : "clock"} className="size-2.5" />
                        {hasUploaded ? "Subida" : "Sin subir"}
                      </span>
                    </div>
                  )
                })
              )}
            </LinkedBlock>

            <LinkedBlock title={`Contenedores (${matchedShipments.length})`} icon="box">
              {matchedShipments.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-2">Sin contenedores.</p>
              ) : (
                matchedShipments.map((s) => {
                  const status = getShipmentInvoicesStatus(s, invoices, documents)
                  return (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-slate-700">{s.container}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {s.dus} · {s.port}
                        </p>
                      </div>
                      {status.total > 0 && (
                        <InvoiceStatusBadge 
                          total={status.total} 
                          uploaded={status.uploaded} 
                          missing={status.missing}
                          size="small"
                        />
                      )}
                    </div>
                  )
                })
              )}
            </LinkedBlock>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Icon name="document" className="size-4 text-slate-600" />
              <p className="text-xs font-bold text-slate-800">
                Documentos subidos ({matchedDocuments.length})
              </p>
            </div>

            {matchedDocuments.length === 0 ? (
              <div className="p-6 text-center">
                <Icon name="file" className="mx-auto size-8 text-slate-300" />
                <p className="mt-2 text-[11px] text-slate-400">
                  No hay documentos subidos para esta reserva, BL o contenedor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {matchedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`flex size-9 items-center justify-center rounded-lg flex-shrink-0 ${
                      doc.linkedType === "invoice" 
                        ? "bg-emerald-50 text-emerald-600" 
                        : "bg-red-50 text-red-600"
                    }`}>
                      <Icon name={doc.linkedType === "invoice" ? "finance" : "file"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{doc.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {doc.linkedType === "invoice" ? "Factura física" : "Doc. embarque"}
                        {doc.invoiceNumber && ` · ${doc.invoiceNumber}`}
                        {doc.bl && ` · ${doc.bl}`}
                        {doc.container && ` · ${doc.container}`}
                        {" · "}{doc.size}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset flex-shrink-0 ${
                      doc.linkedType === "invoice"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-red-50 text-red-700 ring-red-200"
                    }`}>
                      {doc.linkedType === "invoice" ? "Factura" : "Embarque"}
                    </span>
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 flex-shrink-0"
                        title="Ver documento"
                      >
                        <Icon name="eye" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <LinkedBlock title={`BL asociados (${[...new Set(matchedShipments.map((s) => s.bl))].length})`} icon="document">
            {[...new Set(matchedShipments.map((s) => s.bl))].map((bl) => (
              <LinkedRow key={bl} primary={bl} secondary="Vínculo verificado" />
            ))}
            {matchedShipments.length === 0 && <p className="text-[11px] text-slate-400 py-2">Sin BL asociados.</p>}
          </LinkedBlock>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500">
          No hay vínculos para "{query}". Prueba con un booking, BL o contenedor existente.
        </div>
      )}
    </div>
  )
}

function LinkedBlock({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800"><Icon name={icon} className="size-4 text-slate-600" />{title}</div><div className="divide-y divide-slate-100">{children}</div></div>
}

function LinkedRow({ primary, secondary }: { primary: string; secondary: string }) {
  return <div className="py-2.5"><p className="font-mono text-xs font-semibold text-slate-700">{primary}</p><p className="mt-1 text-[10px] text-slate-400">{secondary}</p></div>
}

function DocumentsView({ documents, onDelete }: { documents: Doc[]; onDelete: (doc: Doc) => void }) {
  const validDocs = documents.filter(d => d.fileUrl)
  
  const grouped = validDocs.reduce((acc, doc) => {
    let key: string
    if (doc.linkedType === "invoice" && doc.invoiceNumber) {
      key = `Factura · ${doc.invoiceNumber}`
    } else if (doc.linkedType === "invoice") {
      key = `Factura genérica · ${doc.bl || doc.booking || "Sin relación"}`
    } else if (doc.linkedType === "shipment" && doc.bl) {
      key = `Embarque · ${doc.bl}`
    } else {
      key = doc.relation || "Sin relación"
    }
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {} as Record<string, Doc[]>)

  const totalGroups = Object.keys(grouped).length

  return (
    <div className="p-5">
      <SectionTitle 
        title="Repositorio documental" 
        description={`${validDocs.length} documento${validDocs.length !== 1 ? "s" : ""} en ${totalGroups} relación${totalGroups !== 1 ? "es" : ""}`}
      />
      
      {validDocs.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-8">Sin documentos en el repositorio.</p>
      )}
      
      <div className="mt-5 space-y-6">
        {Object.entries(grouped).map(([relation, docs]) => (
          <div key={relation}>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="link" className="size-3.5 text-slate-400" />
              <p className="font-mono text-[11px] font-bold text-slate-600">{relation}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {docs.length}
              </span>
            </div>
            <div className="grid gap-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                    <Icon name="file" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{d.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {d.size} · {d.uploaded}
                      {d.booking && ` · ${d.booking}`}
                      {d.container && ` · ${d.container}`}
                    </p>
                  </div>
                  {d.fileUrl && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      title="Ver documento"
                    >
                      <Icon name="eye" />
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(d)}
                    className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvoicePanel({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const displayStatus = (invoice.emissionStatusName || invoice.status) as InvoiceStatus
  
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {invoice.direction === "Cliente" ? "Factura emitida" : "Factura recibida"}
                {invoice.typeName && ` · ${invoice.typeName}`}
              </p>
              <h2 className="mt-1 font-mono text-2xl font-bold text-slate-900">{invoice.numero}</h2>
              <p className="mt-1 text-sm text-slate-600">{invoice.counterparty}</p>
              {invoice.rut && (
                <p className="mt-0.5 font-mono text-xs text-slate-400">RUT {invoice.rut}</p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 flex-shrink-0">
              <span className="text-lg">×</span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <StatusPill status={displayStatus} />
            {invoice.paymentFormName && (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {invoice.paymentFormName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos generales</p>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Emisión" value={formatDate(invoice.issueDate)} mono />
              <Detail label="Vencimiento" value={formatDate(invoice.dueDate)} mono />
              <Detail label="Tipo de documento" value={invoice.typeName || '—'} />
              <Detail label="Código SII" value={invoice.typeLegalCode || '—'} mono />
              {invoice.saleTypeName && <Detail label="Tipo de venta" value={invoice.saleTypeName} />}
              {invoice.originName && <Detail label="Origen" value={invoice.originName} />}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos del cliente</p>
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400">Razón social</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{invoice.counterparty || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">RUT</p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">{invoice.rut || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">Giro</p>
                  <p className="mt-0.5 text-xs text-slate-600 truncate">{invoice.clientMainActivity || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Desglose de montos</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between px-4 py-2.5 text-xs bg-slate-50">
                <span className="text-slate-500">Monto neto</span>
                <span className="font-mono font-semibold text-slate-800">{money(invoice.net)}</span>
              </div>
              {invoice.totalExemptAmount !== undefined && invoice.totalExemptAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Monto exento</span>
                  <span className="font-mono font-semibold text-slate-800">{money(invoice.totalExemptAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                <span className="text-slate-500">IVA (19%)</span>
                <span className="font-mono font-semibold text-slate-800">
                  {invoice.totalVatAmount !== undefined ? money(invoice.totalVatAmount) : '—'}
                </span>
              </div>
              {invoice.totalOtherTaxesAmount !== undefined && invoice.totalOtherTaxesAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Otros impuestos</span>
                  <span className="font-mono font-semibold text-slate-800">{money(invoice.totalOtherTaxesAmount)}</span>
                </div>
              )}
              {invoice.totalWithholdingAmount !== undefined && invoice.totalWithholdingAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Retenciones</span>
                  <span className="font-mono font-semibold text-slate-800">-{money(invoice.totalWithholdingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 text-sm font-bold bg-blue-50 border-t border-blue-200">
                <span className="text-blue-900">Total</span>
                <span className="font-mono text-blue-900">{money(invoice.total)}</span>
              </div>
              {invoice.balance !== undefined && (
                <div className="flex justify-between px-4 py-2.5 text-xs bg-amber-50 border-t border-amber-200">
                  <span className="text-amber-800 font-semibold">Saldo pendiente</span>
                  <span className="font-mono font-bold text-amber-800">{money(invoice.balance)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.emissionStatusName && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado de emisión en Nubox</p>
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <StatusPill status={displayStatus} />
                  {invoice.annulled && (
                    <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">
                      ANULADA
                    </span>
                  )}
                </div>
                {invoice.emissionStatusDescription && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400">Descripción</p>
                    <p className="mt-0.5 text-xs text-slate-600">{invoice.emissionStatusDescription}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(invoice.periodMonth || invoice.periodYear || invoice.nuboxId || invoice.trackId) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Período y trazabilidad</p>
              <div className="grid grid-cols-2 gap-4">
                {invoice.periodMonth && invoice.periodYear && (
                  <Detail 
                    label="Período contable" 
                    value={`${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`} 
                    mono 
                  />
                )}
                {invoice.nuboxId && <Detail label="ID Nubox" value={String(invoice.nuboxId)} mono />}
                {invoice.trackId && <Detail label="Track ID" value={String(invoice.trackId)} mono />}
                {invoice.nuboxLastSync && (
                  <Detail 
                    label="Última sincronización" 
                    value={new Date(invoice.nuboxLastSync).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })} 
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 border-t border-slate-100 pt-5">
            <ActionButton variant="secondary" onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Detail({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-bold text-slate-800" : "font-semibold text-slate-700"} ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}