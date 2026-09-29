// src/components/FacturacionModule.tsx
import { useMemo, useRef, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

/* ─── Iconos ─────────────────────────────────────────────────────────────────── */

type IconName =
  | "alert"
  | "arrow"
  | "booking"
  | "box"
  | "check"
  | "chevron"
  | "clock"
  | "document"
  | "download"
  | "eye"
  | "file"
  | "finance"
  | "link"
  | "more"
  | "plus"
  | "search"
  | "upload"

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
  search: ["m21 21-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
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

type InvoiceStatus = "Pendiente" | "Pagada" | "Con detalle" | "Vencida"

interface Invoice {
  id: string
  numero: string
  counterparty: string
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
  stage: "Inicial" | "Timbrado y firmado" | "Respaldo"
  uploaded: string
  size: string
}

/* ─── Helpers Supabase ↔ React ───────────────────────────────────────────────── */

function rowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    numero: row.numero,
    counterparty: row.counterparty || row.cliente || '',
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
  }
}

function invoiceToRow(inv: Partial<Invoice>): any {
  const row: any = {}
  if (inv.numero !== undefined) row.numero = inv.numero
  if (inv.counterparty !== undefined) row.counterparty = inv.counterparty
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

function shipmentToRow(s: Partial<Shipment>): any {
  const row: any = {}
  if (s.bl !== undefined) row.bl = s.bl
  if (s.dus !== undefined) row.dus = s.dus
  if (s.container !== undefined) row.container = s.container
  if (s.booking !== undefined) row.booking = s.booking
  if (s.port !== undefined) row.port = s.port
  if (s.period !== undefined) row.period = s.period
  if (s.status !== undefined) row.status = s.status
  return row
}

function rowToDoc(row: any): Doc {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation || '',
    stage: row.stage as Doc['stage'],
    uploaded: new Date(row.created_at).toLocaleString('es-CL', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    }),
    size: row.size || 'PDF',
  }
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

function StatusPill({ status }: { status: InvoiceStatus | Shipment["status"] | Doc["stage"] }) {
  const tones: Record<string, string> = {
    Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
    Pagada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Pagado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Procesado: "bg-blue-50 text-blue-700 ring-blue-200",
    "Con detalle": "bg-violet-50 text-violet-700 ring-violet-200",
    Vencida: "bg-red-50 text-red-700 ring-red-200",
    Inicial: "bg-slate-100 text-slate-600 ring-slate-200",
    "Timbrado y firmado": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Respaldo: "bg-blue-50 text-blue-700 ring-blue-200",
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{status}</span>
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
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
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [invoiceFilter, setInvoiceFilter] = useState<"Todas" | "Clientes" | "Proveedores">("Todas")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null) // 🆕
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [shipmentModal, setShipmentModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [toast, setToast] = useState("")
  const [bookingQuery, setBookingQuery] = useState("SB-10482")

  /* ── Carga inicial ── */
  const fetchAll = async () => {
    try {
      setLoading(true)
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
      console.error('❌ Error al cargar datos:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  /* ── Métricas ── */
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
      return directionMatch && [inv.numero, inv.counterparty, inv.bl, inv.booking, ...inv.containers].join(" ").toLowerCase().includes(q)
    })
  }, [invoices, invoiceFilter, search])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  /* ── Acciones ── */
  const markInvoicePaid = async (id: string) => {
    try {
      const { error: updErr } = await supabase.from('invoices').update({ status: 'Pagada' }).eq('id', id)
      if (updErr) throw updErr
      setInvoices((curr) => curr.map((inv) => inv.id === id ? { ...inv, status: 'Pagada' } : inv))
      setSelectedInvoice((curr) => curr && curr.id === id ? { ...curr, status: 'Pagada' } : curr)
      showToast("Factura marcada como pagada")
    } catch (err: any) {
      console.error(err)
      showToast("Error al actualizar la factura")
    }
  }

  const markShipmentPaid = async (id: string) => {
    try {
      const { error: updErr } = await supabase.from('shipments').update({ status: 'Pagado' }).eq('id', id)
      if (updErr) throw updErr
      setShipments((curr) => curr.map((s) => s.id === id ? { ...s, status: 'Pagado' } : s))
      setSelectedShipment((curr) => curr && curr.id === id ? { ...curr, status: 'Pagado' } : curr)
      showToast("Embarque marcado como pagado")
    } catch (err: any) {
      console.error(err)
      showToast("Error al actualizar el embarque")
    }
  }

  const saveInvoice = async (inv: Invoice) => {
    try {
      const { data, error: insErr } = await supabase
        .from('invoices')
        .insert([invoiceToRow(inv)])
        .select()
        .single()
      if (insErr) throw insErr
      setInvoices((curr) => [rowToInvoice(data), ...curr])
      setInvoiceModal(false)
      showToast("Factura registrada y vinculada")
    } catch (err: any) {
      console.error(err)
      showToast("Error al guardar la factura: " + err.message)
    }
  }

  const saveShipment = async (ship: Shipment) => {
    try {
      const { data, error: insErr } = await supabase
        .from('shipments')
        .insert([shipmentToRow(ship)])
        .select()
        .single()
      if (insErr) throw insErr
      setShipments((curr) => [rowToShipment(data), ...curr])
      setShipmentModal(false)
      showToast("Registro de embarque guardado")
    } catch (err: any) {
      console.error(err)
      showToast("Error al guardar el embarque: " + err.message)
    }
  }

  const saveDocument = async (doc: Doc) => {
    try {
      const { data, error: insErr } = await supabase
        .from('document_repository')
        .insert([{ name: doc.name, relation: doc.relation, stage: doc.stage, size: doc.size }])
        .select()
        .single()
      if (insErr) throw insErr
      setDocuments((curr) => [rowToDoc(data), ...curr])
      setUploadModal(false)
      showToast("PDF incorporado al repositorio")
    } catch (err: any) {
      console.error(err)
      showToast("Error al guardar el documento: " + err.message)
    }
  }

  const workspaceTabs: { id: WorkspaceTab; label: string; icon: IconName; count?: number }[] = [
    { id: "facturas", label: "Facturas y pagos", icon: "finance", count: invoices.length },
    { id: "embarques", label: "BL y contenedores", icon: "box", count: shipments.length },
    { id: "reservas", label: "Reservas", icon: "booking" },
    { id: "documentos", label: "Repositorio", icon: "document", count: documents.length },
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
            <ActionButton variant="secondary" onClick={() => setUploadModal(true)}>
              <Icon name="upload" />
              Subir PDF
            </ActionButton>
            <ActionButton onClick={() => setInvoiceModal(true)}>
              <Icon name="plus" />
              Nueva factura
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
          <Metric label="Documentos vinculados" value={String(documents.length + invoices.filter((inv) => inv.pdf).length)} detail="Repositorio histórico" tone="green" icon="document" />
          <Metric label="Alertas activas" value={String(invoices.filter(i => i.status === 'Vencida').length)} detail="Facturas vencidas" tone="red" icon="alert" />
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
            />
          )}
          {tab === "embarques" && (
            <ShipmentsView 
              shipments={shipments} 
              invoices={invoices}
              onAdd={() => setShipmentModal(true)} 
              onPay={markShipmentPaid}
              onSelect={setSelectedShipment}
            />
          )}
          {tab === "reservas" && (
            <BookingsView query={bookingQuery} setQuery={setBookingQuery} invoices={invoices} shipments={shipments} />
          )}
          {tab === "documentos" && (
            <DocumentsView documents={documents} onUpload={() => setUploadModal(true)} />
          )}
        </section>
      </main>

      {selectedInvoice && (
        <InvoicePanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaid={() => markInvoicePaid(selectedInvoice.id)}
        />
      )}

      {/* 🆕 Panel de detalle del embarque */}
      {selectedShipment && (
        <ShipmentPanel
          shipment={selectedShipment}
          invoices={invoices}
          onClose={() => setSelectedShipment(null)}
          onPay={() => markShipmentPaid(selectedShipment.id)}
          onSelectInvoice={(inv) => {
            setSelectedShipment(null)
            setSelectedInvoice(inv)
          }}
        />
      )}

      {invoiceModal && <InvoiceModal onClose={() => setInvoiceModal(false)} onSave={saveInvoice} />}
      {shipmentModal && <ShipmentModal existing={shipments} onClose={() => setShipmentModal(false)} onSave={saveShipment} />}
      {uploadModal && <UploadModal onClose={() => setUploadModal(false)} onSave={saveDocument} />}
      {toast && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-500"><Icon name="check" className="size-3" /></span>{toast}</div>}
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

function InvoicesTab({ invoices, totalInvoices, search, setSearch, filter, setFilter, onSelect }: {
  invoices: Invoice[]
  totalInvoices: number
  search: string
  setSearch: (v: string) => void
  filter: "Todas" | "Clientes" | "Proveedores"
  setFilter: (f: "Todas" | "Clientes" | "Proveedores") => void
  onSelect: (inv: Invoice) => void
}) {
  return (
    <div className="p-5">
      <SectionTitle title="Control financiero unificado" description="Vista simplificada de cobros y pagos con trazabilidad documental." />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar factura, empresa, BL o contenedor"
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
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {["Documento", "Contraparte", "Vínculos operativos", "Vencimiento", "Valor neto", "Total", "Estado", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-xs text-slate-400">No hay facturas que coincidan.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="group hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <button onClick={() => onSelect(inv)} className="text-left">
                    <span className="block font-mono text-xs font-semibold text-slate-800">{inv.numero}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">{inv.direction === "Cliente" ? "Emitida a cliente" : "Recibida de proveedor"}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-700">{inv.counterparty}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600"><Icon name="link" className="size-3.5 text-slate-400" />{inv.bl} · {inv.containers.length} cont.</div>
                  <div className="mt-1 text-[10px] text-slate-400">{inv.booking}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${inv.status === "Vencida" ? "text-red-600" : "text-slate-700"}`}>{formatDate(inv.dueDate)}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{money(inv.net)}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{money(inv.total)}</td>
                <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => onSelect(inv)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label={`Ver ${inv.numero}`}><Icon name="eye" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{invoices.length} de {totalInvoices} facturas · Historial centralizado sin separación mensual</p>
    </div>
  )
}

/* 🆕 ShipmentsView con buscador y panel de detalle */
function ShipmentsView({ 
  shipments, 
  invoices,
  onAdd, 
  onPay,
  onSelect,
}: { 
  shipments: Shipment[]
  invoices: Invoice[]
  onAdd: () => void
  onPay: (id: string) => void
  onSelect: (s: Shipment) => void
}) {
  const [shipmentSearch, setShipmentSearch] = useState("")

  // 🆕 Filtrado por BL, DUS, contenedor o booking
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
      <SectionTitle 
        title="BL, DUS y contenedores" 
        description="Control histórico con validación de duplicidad entre periodos." 
        action={<ActionButton onClick={onAdd}><Icon name="plus" />Registrar BL</ActionButton>} 
      />

      {/* 🆕 Buscador */}
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
          <button
            onClick={() => setShipmentSearch("")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-start sm:self-center"
          >
            Limpiar búsqueda
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 self-start sm:self-center">
          {filteredShipments.length} de {shipments.length} embarques
        </span>
      </div>

      {/* Alerta de duplicados */}
      {duplicates.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-3">
            <Icon name="alert" className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-800">{duplicates.length} coincidencias históricas detectadas</p>
              <p className="mt-1 text-[11px] text-amber-700">Algunos contenedores aparecen más de una vez. Revisa antes de crear un nuevo vínculo.</p>
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
              // 🆕 Contar facturas relacionadas (por BL, booking o contenedor)
              const relatedInvoices = invoices.filter((inv) =>
                (inv.bl && inv.bl === s.bl) ||
                (inv.booking && inv.booking === s.booking) ||
                (inv.containers && inv.containers.includes(s.container))
              )
              return (
                <tr 
                  key={s.id} 
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onSelect(s)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{s.bl}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.dus}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{s.container}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{s.booking}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{s.port}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.period}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  {/* 🆕 Columna de facturas vinculadas */}
                  <td className="px-4 py-3">
                    {relatedInvoices.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
                        <Icon name="finance" className="size-3" />
                        {relatedInvoices.length}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {s.status !== "Pagado" && (
                        <ActionButton variant="ghost" onClick={() => onPay(s.id)}>Pagar</ActionButton>
                      )}
                      <button 
                        onClick={() => onSelect(s)}
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" 
                        aria-label={`Ver ${s.container}`}
                      >
                        <Icon name="eye" />
                      </button>
                    </div>
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

/* 🆕 Panel de detalle del embarque */
function ShipmentPanel({ 
  shipment, 
  invoices,
  onClose, 
  onPay,
  onSelectInvoice,
}: { 
  shipment: Shipment
  invoices: Invoice[]
  onClose: () => void
  onPay: () => void
  onSelectInvoice: (inv: Invoice) => void
}) {
  // 🆕 Facturas relacionadas por BL, booking o contenedor
  const relatedInvoices = invoices.filter((inv) =>
    (inv.bl && inv.bl === shipment.bl) ||
    (inv.booking && inv.booking === shipment.booking) ||
    (inv.containers && inv.containers.includes(shipment.container))
  )

  const totalRelacionado = relatedInvoices.reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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
          {/* Datos del embarque */}
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

          {/* 🆕 Facturas relacionadas */}
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
            <div className="rounded-xl border border-slate-200">
              {relatedInvoices.length === 0 ? (
                <div className="p-6 text-center">
                  <Icon name="finance" className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-[11px] text-slate-400">
                    No hay facturas vinculadas a este BL, reserva o contenedor.
                  </p>
                </div>
              ) : (
                relatedInvoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => onSelectInvoice(inv)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                      <Icon name="finance" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold text-slate-800">{inv.numero}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                        {inv.counterparty} · {inv.direction === "Cliente" ? "Cliente" : "Proveedor"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-xs font-bold text-slate-800">{money(inv.total)}</p>
                      <p className="mt-0.5 text-[9px] text-slate-400">{formatDate(inv.dueDate)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Vínculos detectados */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Vínculos detectados</p>
            <div className="rounded-xl border border-slate-200">
              <DetailList 
                icon="link" 
                label="Coincidencias por BL" 
                values={relatedInvoices.filter(i => i.bl === shipment.bl).map(i => i.numero).length ? relatedInvoices.filter(i => i.bl === shipment.bl).map(i => i.numero) : ["Sin coincidencias"]} 
              />
              <DetailList 
                icon="booking" 
                label="Coincidencias por reserva" 
                values={relatedInvoices.filter(i => i.booking === shipment.booking).map(i => i.numero).length ? relatedInvoices.filter(i => i.booking === shipment.booking).map(i => i.numero) : ["Sin coincidencias"]} 
              />
              <DetailList 
                icon="box" 
                label="Coincidencias por contenedor" 
                values={relatedInvoices.filter(i => i.containers.includes(shipment.container)).map(i => i.numero).length ? relatedInvoices.filter(i => i.containers.includes(shipment.container)).map(i => i.numero) : ["Sin coincidencias"]} 
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-slate-100 pt-5">
            {shipment.status !== "Pagado" && (
              <ActionButton onClick={onPay}>
                <Icon name="check" />
                Marcar como pagado
              </ActionButton>
            )}
            <ActionButton variant="secondary" onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  )
}

function BookingsView({ query, setQuery, invoices, shipments }: { query: string; setQuery: (v: string) => void; invoices: Invoice[]; shipments: Shipment[] }) {
  const matchedInvoices = invoices.filter((inv) => inv.booking.toLowerCase() === query.toLowerCase())
  const matchedShipments = shipments.filter((s) => s.booking.toLowerCase() === query.toLowerCase())
  return (
    <div className="p-5">
      <SectionTitle title="Consulta de reservas" description="Busca un SAI BOOK para desplegar automáticamente todos sus vínculos." />
      <div className="mt-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 font-mono text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200" placeholder="Ej. SB-10482" />
        </div>
        <ActionButton>Consultar</ActionButton>
      </div>
      {matchedInvoices.length + matchedShipments.length > 0 ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-4 text-white">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white/10"><Icon name="booking" className="size-5" /></span>
            <div>
              <p className="font-mono text-sm font-bold">{query}</p>
              <p className="mt-1 text-[11px] text-slate-300">{matchedShipments[0]?.port ?? "Puerto por confirmar"} · {matchedShipments.length} contenedores · {matchedInvoices.length} facturas</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <LinkedBlock title="Facturas vinculadas" icon="finance">
              {matchedInvoices.map((inv) => <LinkedRow key={inv.id} primary={inv.numero} secondary={`${inv.counterparty} · ${money(inv.total)}`} />)}
              {matchedInvoices.length === 0 && <p className="text-[11px] text-slate-400 py-2">Sin facturas vinculadas.</p>}
            </LinkedBlock>
            <LinkedBlock title="Contenedores" icon="box">
              {matchedShipments.map((s) => <LinkedRow key={s.id} primary={s.container} secondary={s.dus} />)}
              {matchedShipments.length === 0 && <p className="text-[11px] text-slate-400 py-2">Sin contenedores.</p>}
            </LinkedBlock>
            <LinkedBlock title="BL asociados" icon="document">
              {[...new Set(matchedShipments.map((s) => s.bl))].map((bl) => <LinkedRow key={bl} primary={bl} secondary="Vínculo verificado" />)}
              {matchedShipments.length === 0 && <p className="text-[11px] text-slate-400 py-2">Sin BL asociados.</p>}
            </LinkedBlock>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500">No hay vínculos para la reserva consultada.</div>
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

function DocumentsView({ documents, onUpload }: { documents: Doc[]; onUpload: () => void }) {
  return (
    <div className="p-5">
      <SectionTitle title="Repositorio documental" description="Versiones iniciales, respaldos y documentos timbrados disponibles para usuarios autorizados." action={<ActionButton onClick={onUpload}><Icon name="upload" />Subir documento</ActionButton>} />
      <div className="mt-5 grid gap-3">
        {documents.length === 0 && <p className="text-xs text-slate-400 text-center py-8">Sin documentos en el repositorio.</p>}
        {documents.map((d) => (
          <div key={d.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50">
            <span className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600"><Icon name="file" className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{d.name}</p>
              <p className="mt-1 text-[11px] text-slate-400">{d.relation} · {d.size} · {d.uploaded}</p>
            </div>
            <StatusPill status={d.stage} />
            <ActionButton variant="ghost"><Icon name="download" />Descargar</ActionButton>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvoicePanel({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{invoice.direction === "Cliente" ? "Factura emitida" : "Factura recibida"}</p>
              <h2 className="mt-1 font-mono text-xl font-bold text-slate-900">{invoice.numero}</h2>
              <p className="mt-1 text-xs text-slate-500">{invoice.counterparty}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><span className="text-lg">×</span></button>
          </div>
          <div className="mt-4"><StatusPill status={invoice.status} /></div>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Emisión" value={formatDate(invoice.issueDate)} />
            <Detail label="Vencimiento" value={formatDate(invoice.dueDate)} />
            <Detail label="Valor neto" value={money(invoice.net)} />
            <Detail label="Total con IVA" value={money(invoice.total)} strong />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Detalle cruzado</p>
            <div className="rounded-xl border border-slate-200">
              <DetailList icon="box" label="Contenedores" values={invoice.containers.length ? invoice.containers : ["Sin contenedores"]} />
              <DetailList icon="document" label="Facturas proveedor" values={invoice.providerInvoices.length ? invoice.providerInvoices : ["Sin facturas asociadas"]} />
              <DetailList icon="link" label="BL y reserva" values={[invoice.bl || '—', invoice.booking || '—']} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Archivo adjunto</p>
            {invoice.pdf ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600"><Icon name="file" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{invoice.pdf}</p>
                  <p className="mt-1 text-[10px] text-slate-400">PDF · Documento verificado</p>
                </div>
                <ActionButton variant="ghost"><Icon name="eye" /></ActionButton>
              </div>
            ) : (
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                <Icon name="upload" />Adjuntar respaldo PDF
              </button>
            )}
          </div>
          <div className="flex gap-2 border-t border-slate-100 pt-5">
            {invoice.status !== "Pagada" && <ActionButton onClick={onPaid}><Icon name="check" />Marcar como pagada</ActionButton>}
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

function DetailList({ icon, label, values }: { icon: IconName; label: string; values: string[] }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 p-3 last:border-0">
      <span className="mt-0.5 text-slate-400"><Icon name={icon} /></span>
      <div>
        <p className="text-[10px] font-semibold text-slate-400">{label}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {values.map((v) => <span key={v} className="rounded bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-700">{v}</span>)}
        </div>
      </div>
    </div>
  )
}

const fieldClass = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>
}

function ModalShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InvoiceModal({ onClose, onSave }: { onClose: () => void; onSave: (inv: Invoice) => void }) {
  const [file, setFile] = useState("")
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const net = Number(data.get("net"))
    const inv: Invoice = {
      id: '',
      numero: String(data.get("numero")),
      counterparty: String(data.get("counterparty")),
      direction: String(data.get("direction")) as Invoice["direction"],
      status: "Pendiente",
      issueDate: String(data.get("issueDate")),
      dueDate: String(data.get("dueDate")),
      net,
      total: Math.round(net * 1.19),
      containers: String(data.get("containers")).split(",").map((s) => s.trim()).filter(Boolean),
      providerInvoices: String(data.get("providerInvoices")).split(",").map((s) => s.trim()).filter(Boolean),
      bl: String(data.get("bl") || ''),
      booking: String(data.get("booking") || ''),
      pdf: file || undefined,
    }
    onSave(inv)
  }
  return (
    <ModalShell title="Registrar factura" description="Ingresa los valores financieros y vincula la operación." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° factura"><input required name="numero" className={fieldClass} placeholder="F-001844" /></Field>
          <Field label="Flujo">
            <select name="direction" className={fieldClass}>
              <option>Cliente</option>
              <option>Proveedor</option>
            </select>
          </Field>
        </div>
        <Field label="Cliente o proveedor"><input required name="counterparty" className={fieldClass} placeholder="Razón social" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor neto"><input required name="net" type="number" className={fieldClass} placeholder="0" /></Field>
          <Field label="Emisión"><input required name="issueDate" type="date" className={fieldClass} defaultValue={new Date().toISOString().split('T')[0]} /></Field>
        </div>
        <Field label="Vencimiento"><input required name="dueDate" type="date" className={fieldClass} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="BL"><input name="bl" className={fieldClass} placeholder="BL-CL-84950" /></Field>
          <Field label="SAI BOOK"><input name="booking" className={fieldClass} placeholder="SB-10490" /></Field>
        </div>
        <Field label="Contenedores (separados por coma)"><input name="containers" className={fieldClass} placeholder="MSCU-0000001, TEMU-0000002" /></Field>
        <Field label="Facturas proveedor relacionadas"><input name="providerInvoices" className={fieldClass} placeholder="P-8831, P-8832" /></Field>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 hover:bg-slate-50">
          <span className="flex items-center gap-2"><Icon name="upload" />{file || "Adjuntar factura o respaldo PDF"}</span>
          <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <ActionButton variant="secondary" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton type="submit">Guardar factura</ActionButton>
        </div>
      </form>
    </ModalShell>
  )
}

function ShipmentModal({ existing, onClose, onSave }: { existing: Shipment[]; onClose: () => void; onSave: (s: Shipment) => void }) {
  const [container, setContainer] = useState("")
  const duplicate = existing.find((s) => s.container.toLowerCase() === container.toLowerCase())
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (duplicate) return
    const data = new FormData(e.currentTarget)
    onSave({
      id: '',
      bl: String(data.get("bl")),
      dus: String(data.get("dus")),
      container,
      booking: String(data.get("booking")),
      port: String(data.get("port")),
      period: String(data.get("period") || 'Actual'),
      status: "Pendiente",
    })
  }
  return (
    <ModalShell title="Registrar BL y contenedor" description="La validación consulta todo el historial, no solo el mes actual." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° BL"><input required name="bl" className={fieldClass} placeholder="BL-CL-84950" /></Field>
          <Field label="N° DUS"><input required name="dus" className={fieldClass} placeholder="DUS-742000" /></Field>
        </div>
        <Field label="Contenedor">
          <input required value={container} onChange={(e) => setContainer(e.target.value)} className={`${fieldClass} ${duplicate ? "border-red-400 ring-2 ring-red-100" : ""}`} placeholder="CMAU-0000000" />
        </Field>
        {duplicate && (
          <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-700">
            <Icon name="alert" className="size-4 shrink-0" />
            <span><strong>Registro duplicado.</strong> Este contenedor ya fue ingresado en {duplicate.period}, asociado a {duplicate.bl}.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="SAI BOOK"><input required name="booking" className={fieldClass} placeholder="SB-10490" /></Field>
          <Field label="Puerto">
            <select name="port" className={fieldClass}>
              <option>Buenaventura</option>
              <option>Callao</option>
              <option>San Antonio</option>
            </select>
          </Field>
        </div>
        <Field label="Periodo"><input name="period" className={fieldClass} placeholder="Agosto 2026" /></Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <ActionButton variant="secondary" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton type="submit" disabled={!!duplicate}>Validar y guardar</ActionButton>
        </div>
      </form>
    </ModalShell>
  )
}

function UploadModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Doc) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState("")
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (!file) return
    onSave({
      id: '',
      name: file,
      relation: String(data.get("relation")),
      stage: String(data.get("stage")) as Doc["stage"],
      uploaded: 'Ahora',
      size: 'PDF',
    })
  }
  return (
    <ModalShell title="Subir documento PDF" description="Carga un respaldo inicial o incorpora una nueva versión timbrada." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-slate-400 hover:bg-slate-100">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"><Icon name="upload" className="size-5" /></span>
          <span className="mt-3 text-xs font-semibold text-slate-700">{file || "Seleccionar PDF desde el equipo"}</span>
          <span className="mt-1 text-[10px] text-slate-400">Documento escaneado · máximo 20 MB</span>
        </button>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        <Field label="Vincular a factura, BL o reserva"><input required name="relation" className={fieldClass} placeholder="Ej. SB-10482 o F-001842" /></Field>
        <Field label="Etapa documental">
          <select name="stage" className={fieldClass}>
            <option>Inicial</option>
            <option>Timbrado y firmado</option>
            <option>Respaldo</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <ActionButton variant="secondary" onClick={onClose}>Cancelar</ActionButton>
          <ActionButton type="submit" disabled={!file}>Guardar en repositorio</ActionButton>
        </div>
      </form>
    </ModalShell>
  )
}