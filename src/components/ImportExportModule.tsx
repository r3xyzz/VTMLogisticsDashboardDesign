// src/components/ImportExportModule.tsx
import { useMemo, useState } from "react"

type OperationType = "impo" | "expo"
type OperationStatus = "Standby" | "Vacío" | "Full / Cargado" | "En tránsito" | "Entregado"
type Section = "operations" | "inbox" | "providers"
type IconName = "alert" | "anchor" | "arrow" | "calendar" | "check" | "chevron" | "clock" | "container" | "document" | "mail" | "money" | "search" | "ship" | "truck" | "user"

type Operation = {
  id: string
  type: OperationType
  client: string
  owner: string
  reference: string
  container: string
  size: string
  eta: string
  port: string
  origin: string
  destination: string
  driver: string
  plate: string
  status: OperationStatus
  seal: string
  weight: string
  deadline: string
  countdown: number
  booking?: string
  freeDays?: number
  provider?: string
  documents: string[]
  currentStep: number
  steps: string[]
}

const paths: Record<IconName, string[]> = {
  alert: ["M12 9v4m0 4h.01", "M10.3 3.7 2.2 17h19L13.7 3.7a2 2 0 0 0-3.4 0z"],
  anchor: ["M12 2v13m-4-9h8", "M5 12H2a10 10 0 0 0 20 0h-3M8 19l4-4 4 4"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  calendar: ["M6 2v4m12-4v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z"],
  check: ["m5 12 4 4L19 6"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  container: ["M3 5h18v14H3z", "M7 5v14m5-14v14m5-14v14"],
  document: ["M14 2H6a2 2 0 0 0-2 2v16h16V8z", "M14 2v6h6M8 13h8M8 17h5"],
  mail: ["M3 7l9 6 9-6", "M5 5h14a2 2 0 0 1 2 2v10H3V7a2 2 0 0 1 2-2z"],
  money: ["M12 2v20m5-16.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  ship: ["M3 18c3 2 6 2 9 0 3 2 6 2 9 0", "M5 15 3 8h18l-2 7M8 8V4h8v4"],
  truck: ["M3 6h11v10H3zM14 9h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
}

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paths[name].map((path, index) => <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />)}</svg>
}

const operationsSeed: Operation[] = [
  { id: "1", type: "impo", client: "Kuehne+Nagel", owner: "Bosch Chile", reference: "BL-MSCU882104", container: "MSCU-882104-7", size: "1 × 40' HC", eta: "26 ago · 06:00", port: "San Antonio", origin: "Puerto Central", destination: "CD Lo Boza, Pudahuel", driver: "Carlos Ramírez", plate: "JTRK-82", status: "Standby", seal: "MSC-908821", weight: "18.420 kg", deadline: "ETA en 3 días", countdown: 3, freeDays: 5, documents: ["BL_MSCU882104.pdf", "Guía despacho.pdf"], currentStep: 0, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] },
  { id: "2", type: "expo", client: "Kronos Logistics", owner: "Makita", reference: "EXP-CL-240831", container: "MRKU-441280-1", size: "1 × 40' STD", eta: "31 ago · 22:00", port: "Valparaíso", origin: "Depósito San Bernardo", destination: "TPS Valparaíso", driver: "Miguel Soto", plate: "KLPR-19", status: "Vacío", seal: "Pendiente carga", weight: "12.800 kg est.", deadline: "Stacking abre en 2 días", countdown: 2, booking: "MAEU-2988401", freeDays: 5, documents: ["Booking_MAEU.pdf"], currentStep: 1, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] },
  { id: "3", type: "impo", client: "DSV Air & Sea", owner: "Komatsu", reference: "BL-HLCU771908", container: "HLCU-771908-3", size: "1 × 20' OT", eta: "Hoy · 14:30", port: "Valparaíso", origin: "ZEAL", destination: "Quilicura, Santiago", driver: "Alejandro Pérez", plate: "PLRW-44", status: "En tránsito", seal: "HLC-77201", weight: "21.600 kg", deadline: "Entrega hoy · 18:00", countdown: 0, provider: "Transportes Andinos", freeDays: 4, documents: ["BL_HLCU.pdf", "DIN_771908.pdf"], currentStep: 2, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] },
  { id: "4", type: "expo", client: "Eculine Chile", owner: "3M Chile", reference: "BOOK-045887", container: "TCLU-610244-9", size: "2 × 40' HC", eta: "02 sep · 08:00", port: "San Antonio", origin: "Sitrans San Bernardo", destination: "Puerto Central", driver: "Por asignar", plate: "—", status: "Standby", seal: "—", weight: "24.200 kg est.", deadline: "Cierre documental en 6 días", countdown: 6, booking: "MSCU-045887", freeDays: 6, documents: ["Booking_MSCU.pdf", "Packing list.xlsx"], currentStep: 0, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] },
  { id: "5", type: "impo", client: "Kuehne+Nagel", owner: "Siemens", reference: "BL-ONEY334015", container: "ONEY-334015-2", size: "1 × 40' RF", eta: "29 ago · 11:00", port: "San Antonio", origin: "DP World", destination: "Lampa, Santiago", driver: "Rodrigo Muñoz", plate: "HRPK-63", status: "Full / Cargado", seal: "ONE-33219", weight: "16.980 kg", deadline: "ETA en 6 días", countdown: 6, freeDays: 5, documents: ["BL_ONEY.pdf"], currentStep: 1, steps: ["Arribo nave", "Retiro puerto", "Entrega cliente", "Devolución vacío"] },
  { id: "6", type: "expo", client: "Expeditors", owner: "Nestlé", reference: "EXP-2908-NES", container: "CMAU-221098-4", size: "1 × 20' STD", eta: "28 ago · 19:00", port: "Valparaíso", origin: "Curauma", destination: "TPS Valparaíso", driver: "Pedro Rojas", plate: "CGMN-14", status: "Full / Cargado", seal: "CMA-81002", weight: "9.640 kg", deadline: "Stacking cierra mañana", countdown: 1, booking: "CMA-882190", freeDays: 5, documents: ["Booking_CMA.pdf", "Guía_8831.pdf"], currentStep: 3, steps: ["Folio / Booking", "Retiro vacío", "Carga cliente", "Sello naviera", "Ingreso puerto"] },
]

const emailsSeed = [
  { id: 1, from: "operations.cl@kuehne-nagel.com", company: "Kuehne+Nagel", subject: "Prealerta importación MSCU882104 — ETA 26/08", time: "09:42", type: "impo" as const, extracted: ["BL MSCU882104", "1×40 HC", "ETA 26/08", "San Antonio"], status: "Procesado" },
  { id: 2, from: "export@kronos.cl", company: "Kronos Logistics", subject: "Booking MAEU-2988401 / Retiro vacío Makita", time: "08:16", type: "expo" as const, extracted: ["Booking MAEU-2988401", "1×40 STD", "Makita", "Valparaíso"], status: "Revisar" },
  { id: 3, from: "docs@dsv.com", company: "DSV Air & Sea", subject: "Liberación HLCU771908 — documentos adjuntos", time: "Ayer", type: "impo" as const, extracted: ["BL HLCU771908", "1×20 OT", "Komatsu", "ZEAL"], status: "Procesado" },
]

const providers = [
  { name: "Transportes Andinos", service: "BL-HLCU771908", clientRate: 485000, providerRate: 352000, margin: 133000, payment: "Crédito 30 días", due: "18 sep" },
  { name: "Logística Costa Central", service: "EXP-2908-NES", clientRate: 420000, providerRate: 315000, margin: 105000, payment: "Crédito 15 días", due: "05 sep" },
  { name: "Carga Express Chile", service: "BL-ONEY334015", clientRate: 510000, providerRate: 389000, margin: 121000, payment: "Crédito 30 días", due: "22 sep" },
]

const statusStyles: Record<OperationStatus, string> = {
  Standby: "bg-slate-100 text-slate-600 ring-slate-200",
  Vacío: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Full / Cargado": "bg-violet-50 text-violet-700 ring-violet-200",
  "En tránsito": "bg-orange-50 text-orange-700 ring-orange-200",
  Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

const clp = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)

export default function ImportExportModule() {
  const [section, setSection] = useState<Section>("operations")
  const [typeFilter, setTypeFilter] = useState<"all" | OperationType>("all")
  const [clientFilter, setClientFilter] = useState("Todos")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("1")
  const [emails, setEmails] = useState(emailsSeed)

  const clients = ["Todos", ...Array.from(new Set(operationsSeed.map((operation) => operation.client)))]
  const filtered = useMemo(() => operationsSeed.filter((operation) => {
    const query = search.toLowerCase()
    return (typeFilter === "all" || operation.type === typeFilter)
      && (clientFilter === "Todos" || operation.client === clientFilter)
      && [operation.client, operation.owner, operation.reference, operation.container, operation.port].join(" ").toLowerCase().includes(query)
  }), [typeFilter, clientFilter, search])
  const selected = operationsSeed.find((operation) => operation.id === selectedId) ?? filtered[0] ?? operationsSeed[0]
  const urgent = operationsSeed.filter((operation) => operation.countdown <= 2).length

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500"><span>Operaciones marítimas</span><span className="text-slate-300">/</span><span>Control de contenedores</span></div><h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Carga Importación / Exportación</h1></div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 md:flex"><span className="size-2 rounded-full bg-emerald-500" />Vista demo · API correo pendiente</div>
            <button className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-4 text-xs font-bold text-white hover:bg-navy-700"><span className="text-base leading-none">+</span>Nueva operación</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Operaciones vigentes", value: operationsSeed.length, detail: "3 IMPO · 3 EXPO", icon: "container" as IconName, tone: "bg-blue-50 text-blue-600" },
            { label: "Alertas próximas", value: urgent, detail: "≤ 48 horas", icon: "alert" as IconName, tone: "bg-red-50 text-red-600" },
            { label: "Contenedores en ruta", value: operationsSeed.filter((item) => item.status === "En tránsito").length, detail: "monitoreo activo", icon: "truck" as IconName, tone: "bg-orange-50 text-orange-600" },
            { label: "Correos por revisar", value: emails.filter((email) => email.status === "Revisar").length, detail: "extracción pendiente", icon: "mail" as IconName, tone: "bg-emerald-50 text-emerald-600" },
          ].map((metric) => <article key={metric.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><div className={`flex size-9 items-center justify-center rounded-lg ${metric.tone}`}><Icon name={metric.icon} /></div><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><div className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{metric.value}</strong><span className="text-[10px] text-slate-400">{metric.detail}</span></div></div></article>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {([{ id: "operations", label: "Operaciones", icon: "ship" }, { id: "inbox", label: "Correo procesado", icon: "mail" }, { id: "providers", label: "Proveedores y margen", icon: "money" }] as const).map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold transition-colors ${section === item.id ? "bg-navy-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Icon name={item.icon} />{item.label}</button>)}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700"><Icon name="alert" className="size-3.5" />{urgent} servicios requieren gestión en las próximas 48 horas</div>
        </div>

        {section === "operations" && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-lg bg-slate-100 p-1">
                  {([{ id: "all", label: "Todas", count: operationsSeed.length }, { id: "impo", label: "Importaciones", count: 3 }, { id: "expo", label: "Exportaciones", count: 3 }] as const).map((tab) => <button key={tab.id} onClick={() => setTypeFilter(tab.id)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-bold ${typeFilter === tab.id ? tab.id === "expo" ? "bg-red-500 text-white shadow-sm" : tab.id === "impo" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${typeFilter === tab.id ? "bg-white/15" : "bg-slate-200"}`}>{tab.count}</span></button>)}
                </div>
                <label className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar BL, booking, contenedor o cliente..." className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">{clients.map((client) => <option key={client}>{client}</option>)}</select>
                <button className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><Icon name="calendar" />Próximos 30 días<Icon name="chevron" className="size-3" /></button>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
              <section className="space-y-3">
                <div className="grid grid-cols-5 gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  {["Lun 25 · 2", "Mar 26 · 3", "Mié 27 · 1", "Jue 28 · 4", "Vie 29 · 2"].map((day, index) => <div key={day} className={`rounded-lg px-3 py-2 text-center ${index === 1 ? "bg-navy-600 text-white" : "bg-slate-50 text-slate-600"}`}><p className="text-[9px] font-bold uppercase tracking-wider opacity-60">{day.split(" · ")[0]}</p><p className="mt-1 text-xs font-bold">{day.split(" · ")[1]} contenedores</p></div>)}
                </div>
                {filtered.map((operation) => (
                  <button key={operation.id} onClick={() => setSelectedId(operation.id)} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition-all ${selected.id === operation.id ? "border-navy-300 shadow-md ring-1 ring-navy-100" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
                    <div className="flex">
                      <div className={`w-1.5 shrink-0 ${operation.type === "expo" ? "bg-red-500" : "bg-slate-950"}`} />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3"><div className={`flex size-10 items-center justify-center rounded-lg ${operation.type === "expo" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-900"}`}><Icon name={operation.type === "expo" ? "ship" : "anchor"} className="size-5" /></div><div><div className="flex items-center gap-2"><span className={`text-[8px] font-bold uppercase tracking-widest ${operation.type === "expo" ? "text-red-600" : "text-slate-600"}`}>{operation.type === "expo" ? "Exportación" : "Importación"}</span><span className="text-[9px] text-slate-300">•</span><span className="font-mono text-[10px] font-bold text-slate-500">{operation.reference}</span></div><p className="mt-1 text-sm font-bold text-slate-950">{operation.client} <span className="font-medium text-slate-400">/ {operation.owner}</span></p><p className="mt-1 font-mono text-[10px] text-slate-500">{operation.container} · {operation.size}</p></div></div>
                          <div className="text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusStyles[operation.status]}`}>{operation.status}</span><p className={`mt-2 text-[10px] font-bold ${operation.countdown <= 2 ? "text-red-600" : "text-slate-500"}`}>{operation.deadline}</p></div>
                        </div>
                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 border-t border-slate-100 pt-3">
                          <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{operation.type === "impo" ? "ETA / Puerto" : "Origen / Retiro"}</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{operation.type === "impo" ? `${operation.eta} · ${operation.port}` : operation.origin}</p></div><Icon name="arrow" className="size-3.5 text-slate-300" /><div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Destino</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{operation.destination}</p></div><div className="border-l border-slate-100 pl-4"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Conductor</p><p className="mt-1 whitespace-nowrap text-[10px] font-semibold text-slate-700">{operation.driver}</p></div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </section>

              <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
                <div className={`p-4 text-white ${selected.type === "expo" ? "bg-red-500" : "bg-slate-950"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Ficha de contenedor</p><p className="mt-1 font-mono text-sm font-bold">{selected.container}</p><p className="mt-1 text-[10px] text-white/70">{selected.client} · {selected.owner}</p></div><div className="rounded-lg bg-white/10 px-2.5 py-2 text-right"><p className="text-[8px] uppercase text-white/60">Cuenta regresiva</p><p className="mt-0.5 text-lg font-bold">{selected.countdown === 0 ? "HOY" : `${selected.countdown} días`}</p></div></div></div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[["Tipo / Tamaño", selected.size], ["Peso carga", selected.weight], ["Sello naviera", selected.seal], [selected.type === "expo" ? "Booking" : "BL", selected.booking ?? selected.reference]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-[10px] font-bold text-slate-700">{value}</p></div>)}
                  </div>
                  <div className="mt-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Trazabilidad operacional</p><span className="text-[9px] font-semibold text-slate-400">{selected.currentStep + 1}/{selected.steps.length}</span></div><div className="mt-3 space-y-0">{selected.steps.map((step, index) => <div key={step} className="flex gap-3"><div className="flex flex-col items-center"><span className={`flex size-6 items-center justify-center rounded-full text-[9px] font-bold ${index < selected.currentStep ? "bg-emerald-500 text-white" : index === selected.currentStep ? selected.type === "expo" ? "bg-red-500 text-white" : "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>{index < selected.currentStep ? <Icon name="check" className="size-3" /> : index + 1}</span>{index < selected.steps.length - 1 && <span className={`h-7 w-px ${index < selected.currentStep ? "bg-emerald-300" : "bg-slate-200"}`} />}</div><div><p className={`pt-1 text-[10px] font-semibold ${index <= selected.currentStep ? "text-slate-800" : "text-slate-400"}`}>{step}</p>{index === selected.currentStep && <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-orange-600">Etapa actual</p>}</div></div>)}</div></div>
                  <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Documentación</p><button className="text-[9px] font-bold text-navy-600">+ Adjuntar</button></div><div className="mt-2 space-y-2">{selected.documents.map((document) => <div key={document} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2"><Icon name="document" className="size-3.5 text-red-500" /><span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-600">{document}</span><span className="text-[9px] text-slate-300">Ver</span></div>)}</div></div>
                </div>
              </aside>
            </div>
          </>
        )}

        {section === "inbox" && (
          <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-sm font-bold text-slate-900">Bandeja operacional</p><p className="mt-1 text-[10px] text-slate-400">Los correos originales no se modifican ni eliminan.</p></div><button className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600"><span className="size-2 rounded-full bg-emerald-500" />Simular sincronización</button></div>
              <div className="divide-y divide-slate-100">{emails.map((email) => <article key={email.id} className="p-5 hover:bg-slate-50"><div className="flex items-start gap-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${email.type === "expo" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-800"}`}><Icon name="mail" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-xs font-bold text-slate-900">{email.company}</p><span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${email.status === "Revisar" ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>{email.status}</span></div><p className="mt-1 text-[10px] text-slate-400">{email.from}</p></div><span className="text-[9px] text-slate-400">{email.time}</span></div><p className="mt-3 text-[11px] font-semibold text-slate-700">{email.subject}</p><div className="mt-3 flex flex-wrap gap-1.5">{email.extracted.map((value) => <span key={value} className="rounded-md bg-navy-50 px-2 py-1 text-[9px] font-semibold text-navy-600">{value}</span>)}</div><div className="mt-3 flex gap-2"><button className="rounded-md bg-navy-600 px-3 py-1.5 text-[9px] font-bold text-white">Crear operación</button><button onClick={() => setEmails((current) => current.filter((item) => item.id !== email.id))} className="rounded-md border border-slate-200 px-3 py-1.5 text-[9px] font-bold text-slate-500">Archivar</button></div></div></div></article>)}</div>
            </div>
            <aside className="self-start rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex size-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600"><Icon name="mail" className="size-5" /></div><p className="mt-4 text-sm font-bold text-slate-900">Extracción inteligente</p><p className="mt-2 text-[11px] leading-5 text-slate-500">Vista preparada para recibir datos procesados desde tu API de correo sin alterar el mensaje original.</p><div className="mt-4 space-y-2">{["Cliente y dueño de carga", "ETA y puerto de arribo", "BL, booking y contenedor", "Tipo y tamaño de equipo", "Adjuntos operacionales"].map((item) => <div key={item} className="flex items-center gap-2 text-[10px] font-semibold text-slate-600"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon name="check" className="size-3" /></span>{item}</div>)}</div></aside>
          </section>
        )}

        {section === "providers" && (
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">{[{ label: "Servicios tercerizados", value: "3", detail: "flota externa" }, { label: "Margen proyectado", value: clp(providers.reduce((sum, item) => sum + item.margin, 0)), detail: "27,4% promedio" }, { label: "Próximo vencimiento", value: "05 sep", detail: "Logística Costa Central" }].map((metric) => <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><p className="mt-2 text-xl font-bold text-slate-950">{metric.value}</p><p className="mt-1 text-[10px] text-slate-400">{metric.detail}</p></article>)}</div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><p className="text-sm font-bold text-slate-900">Control de terceros, tarifas y pagos</p><p className="mt-1 text-[10px] text-slate-400">Comparativa de rentabilidad por servicio derivado.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-bold uppercase tracking-wider text-slate-400">{["Proveedor", "Servicio", "Tarifa cliente", "Costo tercero", "Margen / Profit", "Condición pago", "Vencimiento"].map((title) => <th key={title} className="px-5 py-3">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{providers.map((provider) => <tr key={provider.service} className="hover:bg-slate-50"><td className="px-5 py-4 text-[11px] font-bold text-slate-800">{provider.name}</td><td className="px-5 py-4 font-mono text-[10px] text-slate-500">{provider.service}</td><td className="px-5 py-4 text-[10px] font-semibold text-slate-600">{clp(provider.clientRate)}</td><td className="px-5 py-4 text-[10px] font-semibold text-slate-600">{clp(provider.providerRate)}</td><td className="px-5 py-4"><p className="text-[10px] font-bold text-emerald-600">{clp(provider.margin)}</p><p className="mt-0.5 text-[8px] text-slate-400">{Math.round(provider.margin / provider.clientRate * 100)}% margen</p></td><td className="px-5 py-4 text-[10px] text-slate-600">{provider.payment}</td><td className="px-5 py-4"><span className="rounded-full bg-orange-50 px-2 py-1 text-[9px] font-bold text-orange-700">{provider.due}</span></td></tr>)}</tbody></table></div></div>
          </section>
        )}
      </main>
    </div>
  )
}
