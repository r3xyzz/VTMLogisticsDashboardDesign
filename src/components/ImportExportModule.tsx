// src/components/ImportExportModule.tsx
import { useMemo, useState } from "react"
import { useOutlookForImportExport } from "../hooks/useOutlookForImportExport"
import { parseTableFromEmail, mapEmailToOperation, type Operation } from "../lib/outlookParser"

type OperationType = "impo" | "expo"
type OperationStatus = "Standby" | "Vacío" | "Full / Cargado" | "En tránsito" | "Entregado"
type Section = "operations" | "inbox" | "providers"
type IconName = "alert" | "anchor" | "arrow" | "calendar" | "check" | "chevron" | "clock" | "container" | "document" | "mail" | "money" | "search" | "ship" | "truck" | "user"

// --- ICONOS ---
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

const statusStyles: Record<OperationStatus, string> = {
  Standby: "bg-slate-100 text-slate-600 ring-slate-200",
  Vacío: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Full / Cargado": "bg-violet-50 text-violet-700 ring-violet-200",
  "En tránsito": "bg-orange-50 text-orange-700 ring-orange-200",
  Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

// --- COMPONENTE EXPORT BOARD ---
function ExportBoard({
  operations,
  selectedId,
  onSelect,
  onUpdate,
}: {
  operations: Operation[]
  selectedId: string
  onSelect: (id: string) => void
  onUpdate: (operation: Operation) => void
}) {
  const [activeDay, setActiveDay] = useState("Todos")
  const expo = operations.filter((operation) => operation.type === "expo")
  const days = Array.from(new Set(expo.map((operation) => operation.loadingAt?.split(" · ")[0] ?? "Sin fecha")))
  const visible = activeDay === "Todos" ? expo : expo.filter((operation) => operation.loadingAt?.startsWith(activeDay))
  const selected = expo.find((operation) => operation.id === selectedId) ?? visible[0] ?? expo[0]

  if (!selected) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        No hay operaciones de exportación registradas en los correos.
      </div>
    )
  }

  const overweight = (selected.weightKg ?? 0) > (selected.truckCapacityKg ?? Infinity)
  const hasAlerts = [selected.stackingCollision, selected.earlyGateOut, overweight, selected.noStock].filter(Boolean).length
  const inputClass = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-red-600"><Icon name="alert" /><p className="text-xs font-bold">Próximos días con trabajo de exportación</p></div>
            <p className="mt-1 text-[10px] text-red-500">Extraído automáticamente desde Outlook.</p>
          </div>
          <p className="rounded-full bg-red-500 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white">{expo.length} servicios vigentes</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          <button onClick={() => setActiveDay("Todos")} className={`rounded-lg border px-4 py-3 text-left transition-all ${activeDay === "Todos" ? "border-red-500 bg-red-500 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-red-200"}`}><p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Resumen</p><p className="mt-1 text-xs font-bold">Todos los días activos</p></button>
          {days.map((day) => {
            const count = expo.filter((operation) => operation.loadingAt?.startsWith(day)).length
            return <button key={day} onClick={() => setActiveDay(day)} className={`min-w-32 rounded-lg border px-4 py-3 text-left transition-all ${activeDay === day ? "border-red-500 bg-red-500 text-white shadow-sm" : "border-red-100 bg-red-50/50 text-red-700 hover:border-red-300"}`}><p className="text-[9px] font-bold uppercase tracking-wider opacity-65">Carguíos</p><p className="mt-1 text-sm font-bold">{day}</p><p className="mt-0.5 text-[9px] opacity-70">{count} {count === 1 ? "operación" : "operaciones"}</p></button>
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.35fr)]">
        <section className="space-y-3">
          {visible.map((operation) => {
            const alerts = [operation.stackingCollision, operation.earlyGateOut, (operation.weightKg ?? 0) > (operation.truckCapacityKg ?? Infinity), operation.noStock].filter(Boolean).length
            return (
              <button key={operation.id} onClick={() => onSelect(operation.id)} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition-all ${selected.id === operation.id ? "border-red-400 shadow-md ring-2 ring-red-100" : "border-slate-200 hover:border-red-200 hover:shadow-sm"}`}>
                <div className="h-1.5 bg-red-500" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2"><span className="rounded bg-red-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-red-600">Exportación</span><span className={`rounded px-2 py-1 text-[8px] font-bold ${operation.bookingStatus === "Vigente" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{operation.bookingStatus}</span></div><p className="mt-2 text-sm font-bold text-slate-950">{operation.client} <span className="font-medium text-slate-400">/ {operation.owner}</span></p><p className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{operation.booking} · {operation.shippingLine}</p></div>
                    <div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Carguío</p><p className="mt-1 text-xs font-bold text-red-600">{operation.loadingAt}</p>{alerts > 0 && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[8px] font-bold text-red-600"><Icon name="alert" className="size-3" />{alerts} alertas</span>}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Depósito</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-700">{operation.depot} · {operation.containerClass}</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Equipo</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-700">{operation.size} · {operation.weight}</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Conductor</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-700">{operation.driver} · {operation.plate}</p></div>
                  </div>
                </div>
              </button>
            )
          })}
        </section>

        <section className="self-start overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm xl:sticky xl:top-20">
          <div className="bg-red-500 px-5 py-4 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[9px] font-bold uppercase tracking-widest text-white/65">Detalle de exportación</p><p className="mt-1 text-base font-bold">{selected.client} / {selected.owner}</p><p className="mt-1 font-mono text-[10px] text-white/75">{selected.reference} · {selected.container}</p></div>
              <div className="flex gap-2"><span className="rounded-lg bg-white/10 px-3 py-2 text-center"><span className="block text-[8px] uppercase text-white/60">Alertas</span><strong className="mt-0.5 block text-lg">{hasAlerts}</strong></span><span className="rounded-lg bg-white/10 px-3 py-2 text-center"><span className="block text-[8px] uppercase text-white/60">Días libres</span><strong className="mt-0.5 block text-lg">{selected.freeDays}</strong></span></div>
            </div>
          </div>

          <div className="max-h-[720px] space-y-4 overflow-y-auto p-5">
            <div>
              <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Reserva marítima</p><button onClick={() => onUpdate({ ...selected, bookingStatus: selected.bookingStatus === "Vigente" ? "Roleado / Aplazado" : "Vigente" })} className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[8px] font-bold text-orange-700">Registrar roleo</button></div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label><span className="mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400">Naviera</span><input className={inputClass} value={selected.shippingLine ?? ""} onChange={(event) => onUpdate({ ...selected, shippingLine: event.target.value })} /></label>
                <label><span className="mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400">Booking</span><input className={`${inputClass} font-mono`} value={selected.booking ?? ""} onChange={(event) => onUpdate({ ...selected, booking: event.target.value })} /></label>
                <label><span className="mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400">Estado</span><select className={inputClass} value={selected.bookingStatus} onChange={(event) => onUpdate({ ...selected, bookingStatus: event.target.value as Operation["bookingStatus"] })}><option>Vigente</option><option>Roleado / Aplazado</option></select></label>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tríada operativa · edición rápida</p>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                {[
                  { key: "gateOut" as const, label: "1 · Gate-Out", value: selected.gateOut },
                  { key: "loadingAt" as const, label: "2 · Carguío", value: selected.loadingAt },
                  { key: "stackingAt" as const, label: "3 · Stacking", value: selected.stackingAt },
                ].map((item, index) => (
                  <div key={item.key} className="contents">
                    <label className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"><span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">{item.label}</span><input className="mt-1 w-full bg-transparent text-[10px] font-bold text-slate-800 outline-none" value={item.value ?? ""} onChange={(event) => onUpdate({ ...selected, [item.key]: event.target.value })} /></label>
                    {index < 2 && <Icon name="arrow" className="size-3.5 text-red-300" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Contenedor y depósito</p><div className="mt-2 space-y-1.5 text-[10px]"><p><span className="text-slate-400">Retiro:</span> <strong className="text-slate-700">{selected.depot}</strong></p><p><span className="text-slate-400">Clase:</span> <strong className="text-slate-700">{selected.containerClass}</strong></p><p><span className="text-slate-400">Equipo:</span> <strong className="text-slate-700">{selected.size}</strong></p></div></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Asignación logística</p><div className="mt-2 space-y-1.5 text-[10px]"><p><span className="text-slate-400">Conductor:</span> <strong className="text-slate-700">{selected.driver}</strong></p><p><span className="text-slate-400">Camión:</span> <strong className="text-slate-700">{selected.plate}</strong></p><p><span className="text-slate-400">Peonetas:</span> <strong className="text-slate-700">{selected.assistants}</strong></p><p><span className="text-slate-400">Equipo:</span> <strong className="text-slate-700">{selected.truckType}</strong></p></div></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---
export default function ImportExportModule() {
  const { 
    emails: outlookEmails, 
    loading: outlookLoading, 
    error: outlookError, 
    isConnected, 
    connectOutlook,
    userEmail,
    userName
  } = useOutlookForImportExport()

  // Convertimos los correos a operaciones reales
  const allOperations = useMemo(() => {
    if (!outlookEmails) return []
    return outlookEmails.map(mapEmailToOperation).filter(Boolean) as Operation[]
  }, [outlookEmails])

  // Estados locales
  const [section, setSection] = useState<Section>("operations")
  const [typeFilter, setTypeFilter] = useState<"all" | OperationType>("all")
  const [clientFilter, setClientFilter] = useState("Todos")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState(allOperations[0]?.id || "")

  // Filtros
  const clients = ["Todos", ...Array.from(new Set(allOperations.map((operation) => operation.client)))]
  const filtered = useMemo(() => allOperations.filter((operation) => {
    const query = search.toLowerCase()
    return (typeFilter === "all" || operation.type === typeFilter)
      && (clientFilter === "Todos" || operation.client === clientFilter)
      && [operation.client, operation.owner, operation.reference, operation.container, operation.port].join(" ").toLowerCase().includes(query)
  }), [typeFilter, clientFilter, search, allOperations])

  const selected = allOperations.find((operation) => operation.id === selectedId) ?? filtered[0] ?? allOperations[0]
  const urgent = allOperations.filter((operation) => operation.countdown <= 2).length

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500"><span>Operaciones marítimas</span><span className="text-slate-300">/</span><span>Control de contenedores</span></div><h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Carga Importación / Exportación</h1></div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="hidden items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 md:flex">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[180px]" title={userEmail || ''}>
                  Conectado: <strong className="font-bold">{userName}</strong>
                </span>
              </div>
            ) : (
              <button onClick={connectOutlook} className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 md:flex hover:bg-blue-100 transition-colors">
                <Icon name="mail" className="size-3.5" /> Conectar Outlook
              </button>
            )}
            <button className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-4 text-xs font-bold text-white hover:bg-navy-700"><span className="text-base leading-none">+</span>Nueva operación</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        
        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Operaciones vigentes", value: allOperations.length, detail: `${allOperations.filter((item) => item.type === "impo").length} IMPO · ${allOperations.filter((item) => item.type === "expo").length} EXPO`, icon: "container" as IconName, tone: "bg-blue-50 text-blue-600" },
            { label: "Alertas próximas", value: urgent, detail: "≤ 48 horas", icon: "alert" as IconName, tone: "bg-red-50 text-red-600" },
            { label: "Contenedores en ruta", value: allOperations.filter((item) => item.status === "En tránsito").length, detail: "monitoreo activo", icon: "truck" as IconName, tone: "bg-orange-50 text-orange-600" },
            { label: "Correos procesados", value: outlookEmails.length, detail: "desde Outlook", icon: "mail" as IconName, tone: "bg-emerald-50 text-emerald-600" },
          ].map((metric) => <article key={metric.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><div className={`flex size-9 items-center justify-center rounded-lg ${metric.tone}`}><Icon name={metric.icon} /></div><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><div className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{metric.value}</strong><span className="text-[10px] text-slate-400">{metric.detail}</span></div></div></article>)}
        </div>

        {/* TABS */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {([{ id: "operations", label: "Operaciones", icon: "ship" }, { id: "inbox", label: "Correo procesado", icon: "mail" }, { id: "providers", label: "Proveedores y margen", icon: "money" }] as const).map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold transition-colors ${section === item.id ? "bg-navy-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Icon name={item.icon} />{item.label}</button>)}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700"><Icon name="alert" className="size-3.5" />{urgent} servicios requieren gestión</div>
        </div>

        {/* VISTA: OPERACIONES */}
        {section === "operations" && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-lg bg-slate-100 p-1">
                  {([{ id: "all", label: "Todas", count: allOperations.length }, { id: "impo", label: "Importaciones", count: allOperations.filter((item) => item.type === "impo").length }, { id: "expo", label: "Exportaciones", count: allOperations.filter((item) => item.type === "expo").length }] as const).map((tab) => <button key={tab.id} onClick={() => { setTypeFilter(tab.id); if (tab.id !== "all") setSelectedId(allOperations.find((item) => item.type === tab.id)?.id ?? selectedId) }} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-bold ${typeFilter === tab.id ? tab.id === "expo" ? "bg-red-500 text-white shadow-sm" : tab.id === "impo" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${typeFilter === tab.id ? "bg-white/15" : "bg-slate-200"}`}>{tab.count}</span></button>)}
                </div>
                <label className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar BL, booking, contenedor o cliente..." className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">{clients.map((client) => <option key={client}>{client}</option>)}</select>
              </div>
            </section>

            {typeFilter === "expo" ? (
              <ExportBoard
                operations={allOperations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={() => {}} // Solo visual
              />
            ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
              <section className="space-y-3">
                {filtered.map((operation) => (
                  <button key={operation.id} onClick={() => setSelectedId(operation.id)} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition-all ${selected?.id === operation.id ? "border-navy-300 shadow-md ring-1 ring-navy-100" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
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
                {filtered.length === 0 && (
                  <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
                    No se encontraron operaciones de Outlook.
                  </div>
                )}
              </section>

              {selected && (
                <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
                  <div className={`p-4 text-white ${selected.type === "expo" ? "bg-red-500" : "bg-slate-950"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Ficha de contenedor</p><p className="mt-1 font-mono text-sm font-bold">{selected.container}</p><p className="mt-1 text-[10px] text-white/70">{selected.client} · {selected.owner}</p></div><div className="rounded-lg bg-white/10 px-2.5 py-2 text-right"><p className="text-[8px] uppercase text-white/60">Cuenta regresiva</p><p className="mt-0.5 text-lg font-bold">{selected.countdown === 0 ? "HOY" : `${selected.countdown} días`}</p></div></div></div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[["Tipo / Tamaño", selected.size], ["Peso carga", selected.weight], ["Sello naviera", selected.seal], [selected.type === "expo" ? "Booking" : "BL", selected.booking ?? selected.reference]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-[10px] font-bold text-slate-700">{value}</p></div>)}
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Documentación</p></div><div className="mt-2 space-y-2">{selected.documents.length === 0 ? <p className="text-[9px] text-slate-400">Sin documentos adjuntos</p> : selected.documents.map((document) => <div key={document} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2"><Icon name="document" className="size-3.5 text-red-500" /><span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-600">{document}</span></div>)}</div></div>
                  </div>
                </aside>
              )}
            </div>
            )}
          </>
        )}

        {/* VISTA: INBOX (Correo procesado desde Outlook) */}
        {section === "inbox" && (
          <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Bandeja operacional (Outlook)</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {isConnected 
                      ? <>Correos de @cronoslogistica.com · Conectado como <strong>{userEmail}</strong></>
                      : "Conecta tu cuenta para extraer los correos automáticamente."}
                  </p>
                </div>
                {!isConnected && (
                  <button onClick={connectOutlook} className="flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-bold text-white hover:bg-blue-700">
                    Conectar Outlook
                  </button>
                )}
              </div>
              
              <div className="divide-y divide-slate-100">
                {outlookLoading && <div className="p-10 text-center animate-pulse text-sm text-slate-500">Buscando correos en Outlook...</div>}
                {outlookError && <div className="p-5 text-sm text-red-600">❌ Error: {outlookError}</div>}
                
                {!isConnected && !outlookLoading && (
                  <div className="p-10 text-center flex flex-col items-center">
                    <Icon name="mail" className="size-10 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700">No has conectado tu cuenta</p>
                    <button onClick={connectOutlook} className="mt-4 rounded-md bg-navy-600 px-4 py-2 text-xs font-bold text-white hover:bg-navy-700">Conectar ahora</button>
                  </div>
                )}

                {isConnected && !outlookLoading && outlookEmails.length === 0 && (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No se encontraron correos de Cronos Logística con tablas válidas.
                  </div>
                )}

                {isConnected && outlookEmails.map((email) => {
                  const parsed = parseTableFromEmail(email.body?.content || "");
                  if (!parsed) return null;

                  return (
                    <article key={email.id} className="p-5 hover:bg-slate-50">
                      <div className="flex items-start gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                          <Icon name="mail" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{email.from?.emailAddress?.name || 'Remitente'}</p>
                              <p className="mt-1 text-[10px] text-slate-400">{email.from?.emailAddress?.address}</p>
                            </div>
                            <span className="text-[9px] text-slate-400">
                              {new Date(email.receivedDateTime).toLocaleDateString('es-CL')}
                            </span>
                          </div>
                          
                          <p className="mt-3 text-[11px] font-semibold text-slate-700">{email.subject}</p>
                          
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="rounded bg-slate-50 p-2 border border-slate-100">
                              <span className="block text-[8px] uppercase text-slate-400">Contenedor</span>
                              <strong className="text-[10px] text-slate-700">{parsed.container}</strong>
                            </div>
                            <div className="rounded bg-slate-50 p-2 border border-slate-100">
                              <span className="block text-[8px] uppercase text-slate-400">Booking</span>
                              <strong className="text-[10px] text-slate-700">{parsed.booking}</strong>
                            </div>
                            <div className="rounded bg-slate-50 p-2 border border-slate-100">
                              <span className="block text-[8px] uppercase text-slate-400">Pick Up</span>
                              <strong className="text-[10px] text-slate-700">{parsed.pickUp}</strong>
                            </div>
                            <div className="rounded bg-slate-50 p-2 border border-slate-100">
                              <span className="block text-[8px] uppercase text-slate-400">Kilos</span>
                              <strong className="text-[10px] text-slate-700">{parsed.kilos}</strong>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button 
                              onClick={() => window.open(`https://outlook.office.com/mail/id/${email.id}`, '_blank')}
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-[9px] font-bold text-slate-500 hover:bg-slate-100"
                            >
                              Ver en Outlook
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            <aside className="self-start rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex size-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600"><Icon name="mail" className="size-5" /></div><p className="mt-4 text-sm font-bold text-slate-900">Extracción inteligente</p><p className="mt-2 text-[11px] leading-5 text-slate-500">Leyendo tablas HTML desde tus correos para agilizar la operación.</p></aside>
          </section>
        )}

        {/* VISTA: PROVEEDORES */}
        {section === "providers" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
              <Icon name="money" className="size-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">Módulo de proveedores en construcción</p>
              <p className="text-xs text-slate-500 mt-1">Pronto se conectará a la base de datos para calcular márgenes reales.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}