// src/components/ImportExportModule.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { selectAll } from "../lib/fetchAll"
import { useOutlookForImportExport } from "../hooks/useOutlookForImportExport"
import { parseTableFromEmail, groupByConversation, mapConversationToOperation, loadingSchedule, dayKey, cargoModeOf, type CargoMode, type Operation, type ThreadMessage } from "../lib/outlookParser"

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

// --- EDITOR DE CAMPOS (todas las propiedades editables de una operación) ---
type TextKey = "client" | "owner" | "reference" | "container" | "size" | "weight" | "seal" | "booking" | "shippingLine" | "eta" | "port" | "origin" | "destination" | "depot" | "depotCity" | "driver" | "plate" | "truckType" | "gateOut" | "loadingAt" | "stackingAt" | "deadline" | "provider"
type NumberKey = "weightKg" | "truckCapacityKg" | "assistants" | "freeDays"

const TEXT_FIELDS: [TextKey, string][] = [
  ["client", "Cliente"], ["owner", "Dueño / D-AGA"], ["reference", "Referencia"], ["container", "N° Contenedor"],
  ["booking", "Booking / BL"], ["shippingLine", "Naviera"], ["size", "Tipo / Tamaño"], ["weight", "Peso carga"],
  ["seal", "Sello naviera"], ["eta", "ETA / Disponible"], ["port", "Puerto / Nave"], ["origin", "Origen"],
  ["destination", "Destino"], ["depot", "Depósito / Bodega"], ["depotCity", "Ciudad depósito"], ["gateOut", "Pick up / Gate-out"],
  ["loadingAt", "Hora presentación"], ["stackingAt", "Stacking"], ["deadline", "Plazo"], ["driver", "Conductor"],
  ["plate", "Patente"], ["truckType", "Tipo camión"], ["provider", "Proveedor"],
]
const NUMBER_FIELDS: [NumberKey, string][] = [
  ["weightKg", "Kilos"], ["truckCapacityKg", "Capacidad camión (kg)"], ["assistants", "Peonetas"], ["freeDays", "Días libres"],
]
const STATUSES: OperationStatus[] = ["Standby", "Vacío", "Full / Cargado", "En tránsito", "Entregado"]

function OperationEditor({ operation, onUpdate }: { operation: Operation; onUpdate: (operation: Operation) => void }) {
  const inputClass = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-navy-300 focus:ring-2 focus:ring-navy-100"
  const labelClass = "mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400"
  return (
    <div className="grid grid-cols-2 gap-2">
      <label><span className={labelClass}>Tipo</span><select className={inputClass} value={operation.type} onChange={(event) => onUpdate({ ...operation, type: event.target.value as OperationType })}><option value="impo">Importación</option><option value="expo">Exportación</option></select></label>
      <label><span className={labelClass}>Tipo de carga</span><select className={inputClass} value={cargoModeOf(operation)} onChange={(event) => onUpdate({ ...operation, cargoMode: event.target.value as CargoMode })}><option value="fcl">Contenedor (FCL)</option><option value="lcl">Carga suelta (LCL)</option></select></label>
      <label><span className={labelClass}>Estado</span><select className={inputClass} value={operation.status} onChange={(event) => onUpdate({ ...operation, status: event.target.value as OperationStatus })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label><span className={labelClass}>Clase contenedor</span><select className={inputClass} value={operation.containerClass ?? ""} onChange={(event) => onUpdate({ ...operation, containerClass: (event.target.value || undefined) as Operation["containerClass"] })}><option value="">—</option><option>Clase A</option><option>Clase M</option></select></label>
      {TEXT_FIELDS.map(([key, label]) => <label key={key}><span className={labelClass}>{label}</span><input className={inputClass} value={operation[key] ?? ""} onChange={(event) => onUpdate({ ...operation, [key]: event.target.value })} /></label>)}
      {NUMBER_FIELDS.map(([key, label]) => <label key={key}><span className={labelClass}>{label}</span><input type="number" className={inputClass} value={operation[key] ?? ""} onChange={(event) => onUpdate({ ...operation, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>)}
    </div>
  )
}

// Estado de guardado de una ficha en la BD (tabla container_records)
// Cada ficha se respalda sola en la BD al cargar el correo; las correcciones manuales se guardan solas (sin botón).
export type SaveState = {
  dirty: boolean // hay cambios esperando el autoguardado
  saving: boolean
  editedAt?: string // última corrección manual
  editedBy?: string | null
  syncedAt?: string // último respaldo automático desde Outlook
  hasOverrides: boolean // tiene correcciones manuales guardadas
  canRestore: boolean // el correo sigue en el buzón: se puede volver a lo que dice el correo
  onRestore: () => void
}

const shortStamp = (iso?: string) => iso ? new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

function SaveBar({ state }: { state: SaveState }) {
  const label = state.saving || state.dirty ? "Guardando cambios…"
    : state.hasOverrides && state.editedAt ? `Corregida a mano · ${shortStamp(state.editedAt)}${state.editedBy ? ` · ${state.editedBy}` : ""}`
    : state.syncedAt ? `Respaldada en BD · ${shortStamp(state.syncedAt)}`
    : "Respaldando en BD…"
  const tone = state.saving || state.dirty ? "border-amber-200 bg-amber-50 text-amber-700" : state.hasOverrides ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[9px] font-bold">{label}</p>
      {state.hasOverrides && state.canRestore && (
        <button onClick={state.onRestore} disabled={state.saving} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Quita las correcciones manuales y vuelve a lo que dice el correo">Volver a lo del correo</button>
      )}
    </div>
  )
}

const NO_DATE = "sin-fecha"
// "mar 11/11"
const formatDay = (date: Date) => date.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(",", "")

// Fecha/hora de carguío (expo) o retiro (impo) por operación, ordenadas cronológicamente
function scheduleTools(operations: Operation[]) {
  const now = new Date()
  const todayKey = dayKey(now)
  const schedules = new Map(operations.map((operation) => [operation.id, loadingSchedule(operation, now)]))
  const keyOf = (operation: Operation) => schedules.get(operation.id)?.key ?? NO_DATE
  // Sin fecha al final
  const sortKey = (operation: Operation) => `${schedules.get(operation.id)?.key ?? "9999"} ${schedules.get(operation.id)?.time ?? "99:99"}`
  const sorted = [...operations].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  const whenLabel = (operation: Operation) => {
    const schedule = schedules.get(operation.id)
    return schedule?.date ? `${formatDay(schedule.date)} · ${schedule.time ?? "sin hora"}` : (operation.loadingAt || "Sin fecha")
  }
  return { now, todayKey, schedules, keyOf, sorted, whenLabel }
}

const DAY_THEME = {
  expo: { title: "Próximos días con trabajo de exportación", tile: "Carguíos programados", today: "Cargas de hoy", one: "carguío", many: "carguíos", border: "border-red-200", head: "border-red-100 bg-red-50", text: "text-red-600", sub: "text-red-500", pill: "bg-red-500", on: "border-red-500 bg-red-500 text-white shadow-sm", off: "border-red-100 bg-red-50/40 text-red-700 hover:border-red-300", label: "text-red-500/80", detail: "text-red-500/80" },
  impo: { title: "Próximos días con trabajo de importación", tile: "Retiros programados", today: "Retiros de hoy", one: "retiro", many: "retiros", border: "border-slate-300", head: "border-slate-200 bg-slate-100", text: "text-slate-900", sub: "text-slate-500", pill: "bg-slate-900", on: "border-slate-900 bg-slate-900 text-white shadow-sm", off: "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400", label: "text-slate-500", detail: "text-slate-500" },
} as const

// "04 nov"
const formatShortDay = (date: Date) => `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("es-CL", { month: "short" }).replace(".", "")}`

// Panel: Resumen + una tarjeta por día con trabajo (hoy y próximos días) + sin fecha. Clic en una tarjeta filtra la lista.
export function DaySummary({ operations, type, activeDay, onSelectDay }: { operations: Operation[]; type: OperationType; activeDay: string; onSelectDay: (day: string) => void }) {
  const theme = DAY_THEME[type]
  const { todayKey, schedules, keyOf, sorted } = scheduleTools(operations)
  // Solo días con servicios: hoy en adelante (los pasados ya no se programan)
  const days = Array.from(new Set(sorted.map(keyOf).filter((key) => key !== NO_DATE && key >= todayKey)))
  const undated = sorted.filter((operation) => keyOf(operation) === NO_DATE)
  const tileClass = (active: boolean) => `min-w-[150px] rounded-lg border px-4 py-3 text-left transition-all ${active ? theme.on : theme.off}`
  const countLabel = (count: number) => `${count} ${count === 1 ? "operación" : "operaciones"}`

  return (
    <section className={`overflow-hidden rounded-xl border ${theme.border} bg-white shadow-sm`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${theme.head} px-5 py-4`}>
        <div>
          <div className={`flex items-center gap-2 ${theme.text}`}><Icon name="alert" /><p className="text-xs font-bold">{theme.title}</p></div>
          <p className={`mt-1 text-[10px] ${theme.sub}`}>Solo se muestran fechas con servicios activos. No necesitas revisar días vacíos.</p>
        </div>
        <p className={`rounded-full ${theme.pill} px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white`}>{operations.length} servicios vigentes</p>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        <button onClick={() => onSelectDay("Todos")} className={`flex flex-col justify-center ${tileClass(activeDay === "Todos")}`}>
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Resumen</p>
          <p className="mt-1 text-xs font-bold">Todos los días activos</p>
        </button>
        {days.map((key) => {
          const dayOps = sorted.filter((operation) => keyOf(operation) === key)
          const times = dayOps.map((operation) => schedules.get(operation.id)?.time).filter(Boolean)
          const active = activeDay === key
          return (
            <button key={key} onClick={() => onSelectDay(key)} className={tileClass(active)}>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${active ? "opacity-80" : theme.label}`}>{key === todayKey ? theme.today : theme.tile}</p>
              <p className="mt-1 text-sm font-bold">{(() => { const date = schedules.get(dayOps[0]?.id)?.date; return date ? formatShortDay(date) : key })()}</p>
              <p className={`mt-1 text-[9px] ${active ? "opacity-80" : theme.detail}`}>{countLabel(dayOps.length)}{times.length ? ` · ${times.join(", ")}` : ""}</p>
            </button>
          )
        })}
        {undated.length > 0 && (
          <button onClick={() => onSelectDay(NO_DATE)} className={tileClass(activeDay === NO_DATE)}>
            <p className={`text-[9px] font-bold uppercase tracking-wider ${activeDay === NO_DATE ? "opacity-80" : theme.label}`}>Sin fecha de {theme.one}</p>
            <p className="mt-1 text-sm font-bold">—</p>
            <p className={`mt-1 text-[9px] ${activeDay === NO_DATE ? "opacity-80" : theme.detail}`}>{countLabel(undated.length)}</p>
          </button>
        )}
        {days.length === 0 && undated.length === 0 && <p className="self-center text-[10px] text-slate-400">No hay {theme.many} programados desde hoy.</p>}
      </div>
    </section>
  )
}

// Historial de la conversación de Outlook: del mensaje más nuevo al más antiguo
function ThreadHistory({ thread }: { thread?: ThreadMessage[] }) {
  if (!thread?.length) return null
  const newestFirst = [...thread].reverse()
  const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  return (
    <div>
      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        Conversación · {thread.length} {thread.length === 1 ? "mensaje" : "mensajes"} · última: <span className="capitalize">{when(newestFirst[0].date)}</span>
      </p>
      <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {newestFirst.map((message) => (
          <li key={message.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-[9px]">
              <strong className="truncate text-slate-700">{message.from}</strong>
              <span className="shrink-0 capitalize text-slate-400">{when(message.date)}</span>
            </div>
            {message.status && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold ring-1 ring-inset ${statusStyles[message.status]}`}>Estado: {message.status}</span>}
            <p className="mt-1 line-clamp-3 text-[10px] text-slate-600">{message.snippet || "(sin texto)"}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

// --- COMPONENTE EXPORT BOARD ---
function ExportBoard({
  operations,
  selectedId,
  onSelect,
  onUpdate,
  saveStateFor,
}: {
  operations: Operation[]
  selectedId: string
  onSelect: (id: string) => void
  onUpdate: (operation: Operation) => void
  saveStateFor: (operation: Operation) => SaveState
}) {
  const [activeDay, setActiveDay] = useState("Todos")
  const { sorted, keyOf, whenLabel } = scheduleTools(operations.filter((operation) => operation.type === "expo"))
  const expo = sorted
  const visible = activeDay === "Todos" ? expo : expo.filter((operation) => keyOf(operation) === activeDay)
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
      <DaySummary operations={expo} type="expo" activeDay={activeDay} onSelectDay={setActiveDay} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.35fr)]">
        <section className="space-y-3">
          {visible.map((operation) => {
            const alerts = [operation.stackingCollision, operation.earlyGateOut, (operation.weightKg ?? 0) > (operation.truckCapacityKg ?? Infinity), operation.noStock].filter(Boolean).length
            return (
              <button key={operation.id} onClick={() => onSelect(operation.id)} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition-all ${selected.id === operation.id ? "border-red-400 shadow-md ring-2 ring-red-100" : "border-slate-200 hover:border-red-200 hover:shadow-sm"}`}>
                <div className="h-1.5 bg-red-500" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2"><span className="rounded bg-red-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-red-600">Exportación</span><span className={`rounded px-2 py-1 text-[8px] font-bold ${operation.bookingStatus === "Vigente" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{operation.bookingStatus}</span></div><p className="mt-2 text-sm font-bold text-slate-950">{operation.client} <span className="font-medium text-slate-400">/ {operation.owner}</span></p><p className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{operation.booking ?? "Sin booking"} · {operation.shippingLine ?? "Naviera por confirmar"}</p></div>
                    <div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Carguío</p><p className="mt-1 text-xs font-bold capitalize text-red-600">{whenLabel(operation)}</p>{alerts > 0 && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[8px] font-bold text-red-600"><Icon name="alert" className="size-3" />{alerts} alertas</span>}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Depósito</p><p className="mt-1 truncate text-[9px] font-semibold text-slate-700">{operation.depot} · {operation.containerClass ?? "Clase —"}</p></div>
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
              <div className="flex gap-2"><span className="rounded-lg bg-white/10 px-3 py-2 text-center"><span className="block text-[8px] uppercase text-white/60">Alertas</span><strong className="mt-0.5 block text-lg">{hasAlerts}</strong></span><span className="rounded-lg bg-white/10 px-3 py-2 text-center"><span className="block text-[8px] uppercase text-white/60">Días libres</span><strong className="mt-0.5 block text-lg">{selected.freeDays ?? "—"}</strong></span></div>
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

            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Todos los campos · edición</p>
              <SaveBar state={saveStateFor(selected)} />
              <OperationEditor operation={selected} onUpdate={onUpdate} />
            </div>

            <ThreadHistory thread={selected.thread} />
          </div>
        </section>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---
const EDITS_KEY = "vtm-import-export-edits-v2" // borradores sin guardar (solo campos cambiados)

type ContainerRecord = { operation_id: string; overrides: Partial<Operation>; snapshot: Operation; updated_by: string | null; updated_at: string; synced_at?: string | null }

// JSON con las claves ordenadas: jsonb de Postgres reordena las claves y JSON.stringify daría "distinto" siempre
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`
  return JSON.stringify(value ?? null)
}
const AUTOSAVE_MS = 1200

// Días desde hoy hasta la fecha de carguío (expo) o retiro (impo); sin fecha queda undefined
const withCountdown = (operation: Operation): Operation => {
  const today = new Date()
  const date = loadingSchedule(operation, today).date
  if (!date) return { ...operation, countdown: undefined }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return { ...operation, countdown: Math.round((target - start) / 86400000) }
}
// Urgente: hoy o en los próximos 2 días (las fechas pasadas ya no cuentan)
const isUrgent = (operation: Operation) => operation.countdown != null && operation.countdown >= 0 && operation.countdown <= 2
const countdownLabel = (days?: number) => days == null ? "Sin fecha" : days === 0 ? "HOY" : days < 0 ? "Pasada" : `${days} ${days === 1 ? "día" : "días"}`

// Fichas guardadas en BD o borradores antiguos pueden venir incompletos: se rellenan para que la vista nunca lea un campo inexistente
const TEXT_DEFAULTS = { client: "Desconocido", owner: "Por definir", reference: "S/R", container: "S/N", size: "Por definir", eta: "Por definir", port: "Por definir", origin: "—", destination: "—", driver: "Por asignar", plate: "—", seal: "—", weight: "—", deadline: "Sin fecha" } as const
const normalizeOperation = (operation: Operation): Operation => {
  const fixed = { ...operation } as Operation
  for (const [key, fallback] of Object.entries(TEXT_DEFAULTS)) {
    const value = (fixed as Record<string, unknown>)[key]
    ;(fixed as Record<string, unknown>)[key] = value == null || typeof value === "object" ? fallback : String(value)
  }
  for (const key of ["loadingAt", "gateOut", "stackingAt", "booking", "shippingLine", "depot", "provider"] as const) {
    const value = fixed[key]
    if (value != null && typeof value !== "string") (fixed as Record<string, unknown>)[key] = typeof value === "object" ? undefined : String(value)
  }
  if (fixed.type !== "impo" && fixed.type !== "expo") fixed.type = "impo"
  if (!statusStyles[fixed.status]) fixed.status = "Standby"
  fixed.documents = Array.isArray(fixed.documents) ? fixed.documents : []
  fixed.steps = Array.isArray(fixed.steps) ? fixed.steps : []
  fixed.thread = Array.isArray(fixed.thread) ? fixed.thread : undefined
  return fixed
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
// Campos de `next` que difieren de `base`
const diffOperation = (next: Operation, base?: Operation): Partial<Operation> =>
  Object.fromEntries(Object.entries(next).filter(([key, value]) => key !== "countdown" && (!base || !sameValue(base[key as keyof Operation], value)))) as Partial<Operation> // countdown es calculado

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

  // Capas de una ficha: correo (Outlook) -> guardado en BD (container_records) -> borrador de la pestaña (sessionStorage).
  // En BD y en borrador se guardan solo los campos cambiados: el resto se sigue actualizando con los mensajes nuevos del hilo.
  const [edits, setEdits] = useState<Record<string, Partial<Operation>>>(() => {
    try { return JSON.parse(sessionStorage.getItem(EDITS_KEY) || "{}") } catch { return {} }
  })
  useEffect(() => {
    try { sessionStorage.setItem(EDITS_KEY, JSON.stringify(edits)) } catch { /* almacenamiento no disponible */ }
  }, [edits])

  const [records, setRecords] = useState<Record<string, ContainerRecord>>({})
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  // Dueño de las fichas = usuario de la app (login con Google). La BD (RLS) solo deja leer y escribir las propias:
  // cada usuario ve las operaciones de su buzón, nunca las de otro.
  const [appEmail, setAppEmail] = useState<string | null>(null)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setAppEmail(data.session?.user.email?.toLowerCase() ?? null)) }, [])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fetchRecords = useCallback(async () => {
    const { data, error } = await selectAll((from, to) => supabase.from("container_records").select("*").order("id").range(from, to))
    if (error) { setSaveError(`No se pudieron leer las fichas guardadas: ${error.message}`); return }
    setRecords(Object.fromEntries(((data || []) as ContainerRecord[]).map((record) => [record.operation_id, record])))
    setRecordsLoaded(true)
  }, [])
  useEffect(() => {
    fetchRecords()
    // Lo que guarda otro usuario aparece al instante
    const channel = supabase.channel(`container-records-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "container_records" }, () => fetchRecords())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRecords])

  // Una operación por conversación de Outlook (se leen todos los mensajes del hilo)
  const parsedOperations = useMemo(
    () => groupByConversation(outlookEmails || []).map(mapConversationToOperation).filter(Boolean) as Operation[],
    [outlookEmails],
  )
  // Bandeja "Correo procesado": se analiza cada correo una sola vez (no en cada clic de filtro).
  // Solo correos recibidos (los enviados por la cuenta conectada se ocultan), cada uno por separado y del más nuevo al más antiguo.
  const inboxEmails = useMemo(() => {
    const me = (userEmail || "").toLowerCase()
    return (outlookEmails || [])
      .filter((email) => !me || (email.from?.emailAddress?.address || "").toLowerCase() !== me)
      .flatMap((email) => {
        const parsed = parseTableFromEmail(email.body?.content || "")
        return parsed ? [{ email, parsed }] : []
      })
      .sort((a, b) => b.email.receivedDateTime.localeCompare(a.email.receivedDateTime))
  }, [outlookEmails, userEmail])
  // Conversación completa por hilo (incluye respuestas propias), para desplegarla dentro del último correo
  const conversationOf = useMemo(() => {
    const map = new Map<string, typeof outlookEmails>()
    for (const email of outlookEmails || []) {
      if (!email.conversationId) continue
      map.set(email.conversationId, [...(map.get(email.conversationId) || []), email])
    }
    map.forEach((list) => list.sort((a, b) => b.receivedDateTime.localeCompare(a.receivedDateTime)))
    return map
  }, [outlookEmails])
  const [openConversation, setOpenConversation] = useState<string | null>(null)
  // Base de cada ficha: el correo si está en el buzón; si no, la copia guardada en BD
  const baseOperations = useMemo(() => {
    const parsedIds = new Set(parsedOperations.map((operation) => operation.id))
    const savedOnly = Object.values(records)
      .filter((record) => !parsedIds.has(record.operation_id) && record.snapshot && typeof record.snapshot === "object")
      .map((record) => ({ ...record.snapshot, id: record.operation_id }))
    return [...parsedOperations, ...savedOnly]
  }, [parsedOperations, records])
  const savedBase = (operation: Operation) => ({ ...operation, ...records[operation.id]?.overrides })
  const allOperations = useMemo(
    () => baseOperations.map((operation) => withCountdown(normalizeOperation({ ...operation, ...records[operation.id]?.overrides, ...edits[operation.id] }))),
    [baseOperations, records, edits],
  )
  // Respaldo automático: cada operación leída del correo se guarda en la BD (snapshot) sin tocar las correcciones manuales.
  // Así sigue disponible aunque se cierre la sesión, cambie la cuenta o el correo salga de los 500 más recientes.
  const syncingRef = useRef(false)
  useEffect(() => {
    if (!recordsLoaded || !appEmail || !parsedOperations.length || syncingRef.current) return
    const now = new Date().toISOString()
    const rows = parsedOperations.flatMap((operation) => {
      const { countdown: _countdown, ...snapshot } = operation
      const record = records[operation.id]
      if (record && stableJson(record.snapshot) === stableJson(snapshot)) return []
      const merged = { ...snapshot, ...record?.overrides } as Operation
      return [{
        operation_id: operation.id, type: merged.type, cargo_mode: cargoModeOf(merged), container: merged.container || null, reference: merged.reference || null, client: merged.client || null,
        snapshot, synced_at: now, source_mailbox: userEmail, owner_email: appEmail,
      }]
    })
    if (!rows.length) return
    syncingRef.current = true
    ;(async () => {
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("container_records").upsert(rows.slice(i, i + 100), { onConflict: "owner_email,operation_id" })
        if (error) { setSaveError(`No se pudo respaldar los correos en la BD: ${error.message}. ¿Corriste la migración 20261126_container_records_autosync.sql?`); break }
      }
      await fetchRecords()
      syncingRef.current = false
    })()
  }, [recordsLoaded, appEmail, parsedOperations, records, userEmail, fetchRecords])

  // Correcciones manuales: se guardan solas ~1 s después de editar (overrides = solo los campos que difieren del correo)
  // El autoguardado corre ~1 s después: lee siempre lo último (no lo que había al momento de editar)
  const latestOps = useRef<Operation[]>([])
  latestOps.current = allOperations
  const latestRecords = useRef(records)
  latestRecords.current = records
  const latestParsed = useRef(parsedOperations)
  latestParsed.current = parsedOperations
  const saveTimers = useRef<Record<string, number>>({})
  const saveOperation = async (id: string) => {
    const operation = latestOps.current.find((item) => item.id === id)
    if (!operation) return
    const record = latestRecords.current[id]
    const parsed = latestParsed.current.find((item) => item.id === id)
    const { countdown: _countdown, ...toSave } = operation // calculada: no se guarda
    // Base = lo que dice el correo (o la copia guardada si el correo ya no está en el buzón); overrides = lo que difiere
    const base = parsed ? (({ countdown: _c, ...rest }) => rest)(parsed) : record?.snapshot
    const overrides = base ? diffOperation(toSave as Operation, base as Operation) : {}
    setSavingId(id)
    setSaveError(null)
    const { error } = await supabase.from("container_records").upsert({
      operation_id: id, owner_email: appEmail, type: operation.type, cargo_mode: cargoModeOf(operation), container: operation.container || null, reference: operation.reference || null, client: operation.client || null,
      overrides, ...(record ? {} : { snapshot: base ?? toSave }),
      updated_by: userEmail, updated_at: new Date().toISOString(),
    }, { onConflict: "owner_email,operation_id" })
    if (error) setSaveError(`No se pudo guardar la ficha: ${error.message}`)
    else { await fetchRecords(); setEdits((current) => { const next = { ...current }; delete next[id]; return next }) }
    setSavingId(null)
  }
  const updateOperation = (operation: Operation) => {
    const base = baseOperations.find((item) => item.id === operation.id)
    const diff = diffOperation(operation, base && savedBase(base))
    setEdits((current) => {
      const next = { ...current }
      if (Object.keys(diff).length) next[operation.id] = diff
      else delete next[operation.id]
      return next
    })
    window.clearTimeout(saveTimers.current[operation.id])
    saveTimers.current[operation.id] = window.setTimeout(() => saveOperation(operation.id), AUTOSAVE_MS)
  }
  // Volver a lo que dice el correo: borra las correcciones manuales
  const restoreOperation = async (id: string) => {
    if (!window.confirm("¿Quitar las correcciones manuales de esta ficha y volver a lo que dice el correo?")) return
    window.clearTimeout(saveTimers.current[id])
    setEdits((current) => { const next = { ...current }; delete next[id]; return next })
    setSavingId(id)
    const { error } = await supabase.from("container_records").update({ overrides: {}, updated_by: null, updated_at: new Date().toISOString() }).eq("operation_id", id)
    if (error) setSaveError(`No se pudo restaurar la ficha: ${error.message}`)
    await fetchRecords()
    setSavingId(null)
  }
  const saveStateFor = (operation: Operation): SaveState => {
    const record = records[operation.id]
    const overrides = record?.overrides || {}
    return {
      dirty: !!edits[operation.id],
      saving: savingId === operation.id,
      editedAt: record?.updated_by ? record.updated_at : undefined,
      editedBy: record?.updated_by,
      syncedAt: record?.synced_at || record?.updated_at,
      hasOverrides: Object.keys(overrides).length > 0,
      canRestore: parsedOperations.some((item) => item.id === operation.id),
      onRestore: () => restoreOperation(operation.id),
    }
  }

  // Filtro FCL/LCL: cada cuenta de Outlook recuerda el suyo (ej. Cristóbal ve contenedores, Marcial carga suelta)
  const cargoModeKey = `vtm-ie-cargo-mode:${(userEmail || "sin-cuenta").toLowerCase()}`
  const [cargoFilter, setCargoFilter] = useState<"all" | CargoMode>("all")
  useEffect(() => {
    try {
      const stored = localStorage.getItem(cargoModeKey)
      setCargoFilter(stored === "fcl" || stored === "lcl" ? stored : "all")
    } catch { setCargoFilter("all") }
  }, [cargoModeKey])
  const changeCargoFilter = (mode: "all" | CargoMode) => {
    setCargoFilter(mode)
    try { localStorage.setItem(cargoModeKey, mode) } catch { /* almacenamiento no disponible */ }
  }
  const modeOperations = useMemo(
    () => cargoFilter === "all" ? allOperations : allOperations.filter((operation) => cargoModeOf(operation) === cargoFilter),
    [allOperations, cargoFilter],
  )

  // Estados locales
  const [section, setSection] = useState<Section>("operations")
  const [typeFilter, setTypeFilter] = useState<"all" | OperationType>("all")
  const [clientFilter, setClientFilter] = useState("Todos")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState(allOperations[0]?.id || "")

  // Filtros
  const clients = ["Todos", ...Array.from(new Set(modeOperations.map((operation) => operation.client)))]
  const filtered = useMemo(() => modeOperations.filter((operation) => {
    const query = search.toLowerCase()
    return (typeFilter === "all" || operation.type === typeFilter)
      && (clientFilter === "Todos" || operation.client === clientFilter)
      && [operation.client, operation.owner, operation.reference, operation.container, operation.port].join(" ").toLowerCase().includes(query)
  }), [typeFilter, clientFilter, search, modeOperations])

  // Importaciones: orden por fecha/hora de retiro y filtro por día (mismo panel que exportación)
  const [impoDay, setImpoDay] = useState("Todos")
  const impoTools = scheduleTools(filtered)
  const listed = typeFilter !== "impo" ? filtered
    : impoDay === "Todos" ? impoTools.sorted
    : impoTools.sorted.filter((operation) => impoTools.keyOf(operation) === impoDay)

  // Solo se muestra una ficha que pertenezca al filtro actual (si no, el panel queda vacío)
  const selected = listed.find((operation) => operation.id === selectedId) ?? listed[0]
  const urgent = allOperations.filter(isUrgent).length

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500"><span>Operaciones marítimas</span><span className="text-slate-300">/</span><span>Control de contenedores</span></div><h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Carga Importación / Exportación</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[180px]" title={userEmail || ''}>
                  Conectado: <strong className="font-bold">{userName}</strong>
                </span>
                <button onClick={connectOutlook} className="ml-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100" title="Conectar otro correo">Cambiar cuenta</button>
              </div>
            ) : (
              <button onClick={connectOutlook} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                <Icon name="mail" className="size-3.5" /> Conectar Outlook
              </button>
            )}
            <button className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-4 text-xs font-bold text-white hover:bg-navy-700"><span className="text-base leading-none">+</span>Nueva operación</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        {outlookError && section !== "inbox" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[10px] font-semibold text-red-700"><span>Outlook: {outlookError}</span><button onClick={connectOutlook} className="rounded-md bg-red-600 px-3 py-1 text-[10px] font-bold text-white">Conectar de nuevo</button></div>}
        {saveError && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[10px] font-semibold text-red-700"><span>{saveError}</span><button onClick={() => setSaveError(null)} className="text-sm">×</button></div>}
        
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
                  {([{ id: "all", label: "Todas", count: modeOperations.length }, { id: "impo", label: "Importaciones", count: modeOperations.filter((item) => item.type === "impo").length }, { id: "expo", label: "Exportaciones", count: modeOperations.filter((item) => item.type === "expo").length }] as const).map((tab) => <button key={tab.id} onClick={() => { setTypeFilter(tab.id); if (tab.id !== "all") setSelectedId(modeOperations.find((item) => item.type === tab.id)?.id ?? selectedId) }} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-bold ${typeFilter === tab.id ? tab.id === "expo" ? "bg-red-500 text-white shadow-sm" : tab.id === "impo" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${typeFilter === tab.id ? "bg-white/15" : "bg-slate-200"}`}>{tab.count}</span></button>)}
                </div>
                <div className="flex rounded-lg bg-slate-100 p-1" title="Se recuerda para la cuenta de Outlook conectada">
                  {([{ id: "all", label: "Toda la carga" }, { id: "fcl", label: "Contenedor (FCL)" }, { id: "lcl", label: "Carga suelta (LCL)" }] as const).map((mode) => <button key={mode.id} onClick={() => changeCargoFilter(mode.id)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-bold ${cargoFilter === mode.id ? "bg-navy-600 text-white shadow-sm" : "text-slate-500"}`}>{mode.label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${cargoFilter === mode.id ? "bg-white/15" : "bg-slate-200"}`}>{mode.id === "all" ? allOperations.length : allOperations.filter((item) => cargoModeOf(item) === mode.id).length}</span></button>)}
                </div>
                <label className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar BL, booking, contenedor o cliente..." className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">{clients.map((client) => <option key={client}>{client}</option>)}</select>
              </div>
            </section>

            {typeFilter === "impo" && <DaySummary operations={impoTools.sorted} type="impo" activeDay={impoDay} onSelectDay={setImpoDay} />}

            {typeFilter === "expo" ? (
              <ExportBoard
                operations={modeOperations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={updateOperation}
                saveStateFor={saveStateFor}
              />
            ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
              <section className="space-y-3">
                {listed.map((operation) => (
                  <button key={operation.id} onClick={() => setSelectedId(operation.id)} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition-all ${selected?.id === operation.id ? "border-navy-300 shadow-md ring-1 ring-navy-100" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
                    <div className="flex">
                      <div className={`w-1.5 shrink-0 ${operation.type === "expo" ? "bg-red-500" : "bg-slate-950"}`} />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3"><div className={`flex size-10 items-center justify-center rounded-lg ${operation.type === "expo" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-900"}`}><Icon name={operation.type === "expo" ? "ship" : "anchor"} className="size-5" /></div><div><div className="flex items-center gap-2"><span className={`text-[8px] font-bold uppercase tracking-widest ${operation.type === "expo" ? "text-red-600" : "text-slate-600"}`}>{operation.type === "expo" ? "Exportación" : "Importación"}</span><span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${cargoModeOf(operation) === "lcl" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{cargoModeOf(operation) === "lcl" ? "LCL" : "FCL"}</span><span className="text-[9px] text-slate-300">•</span><span className="font-mono text-[10px] font-bold text-slate-500">{operation.reference}</span></div><p className="mt-1 text-sm font-bold text-slate-950">{operation.client} <span className="font-medium text-slate-400">/ {operation.owner}</span></p><p className="mt-1 font-mono text-[10px] text-slate-500">{operation.container} · {operation.size}</p></div></div>
                          <div className="text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusStyles[operation.status]}`}>{operation.status}</span><p className={`mt-2 text-[10px] font-bold ${isUrgent(operation) ? "text-red-600" : "text-slate-500"}`}>{operation.deadline}</p>{operation.type === "impo" && <p className="mt-1 text-[10px] font-bold capitalize text-slate-700">Retiro: {impoTools.whenLabel(operation)}</p>}</div>
                        </div>
                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 border-t border-slate-100 pt-3">
                          <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{operation.type === "impo" ? "ETA / Puerto" : "Origen / Retiro"}</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{operation.type === "impo" ? `${operation.eta} · ${operation.port}` : operation.origin}</p></div><Icon name="arrow" className="size-3.5 text-slate-300" /><div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Destino</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{operation.destination}</p></div><div className="border-l border-slate-100 pl-4"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Conductor</p><p className="mt-1 whitespace-nowrap text-[10px] font-semibold text-slate-700">{operation.driver}</p></div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {listed.length === 0 && (
                  <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
                    No se encontraron operaciones de Outlook.
                  </div>
                )}
              </section>

              {selected && (
                <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
                  <div className={`p-4 text-white ${selected.type === "expo" ? "bg-red-500" : "bg-slate-950"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Ficha de contenedor</p><p className="mt-1 font-mono text-sm font-bold">{selected.container}</p><p className="mt-1 text-[10px] text-white/70">{selected.client} · {selected.owner}</p></div><div className="rounded-lg bg-white/10 px-2.5 py-2 text-right"><p className="text-[8px] uppercase text-white/60">Cuenta regresiva</p><p className="mt-0.5 text-lg font-bold">{countdownLabel(selected.countdown)}</p></div></div></div>
                  <div className="p-4">
                    <SaveBar state={saveStateFor(selected)} />
                    <div className="max-h-[560px] overflow-y-auto pr-1">
                      <OperationEditor operation={selected} onUpdate={updateOperation} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4"><ThreadHistory thread={selected.thread} /></div>
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
                      ? <>Correos con datos de carga · Conectado como <strong>{userEmail}</strong></>
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
                {outlookLoading && (
                  <div className="flex flex-col items-center gap-3 p-10 sm:flex-row sm:justify-center">
                    <span className="text-sm text-slate-500">Buscando correos en Outlook...</span>
                    {/* Barra de carga sin porcentaje (indeterminada) */}
                    <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Cargando correos">
                      <div className="vtm-progress-bar absolute inset-y-0 w-1/3 rounded-full bg-navy-500" />
                    </div>
                  </div>
                )}
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
                    No se encontraron correos con datos de carga.
                  </div>
                )}

                {isConnected && inboxEmails.map(({ email, parsed }) => {
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
                              onClick={() => window.open(`https://outlook.office.com/mail/id/${encodeURIComponent(email.parentId || email.id)}`, '_blank')}
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-[9px] font-bold text-slate-500 hover:bg-slate-100"
                            >
                              Ver en Outlook
                            </button>
                            {(conversationOf.get(email.conversationId || "")?.length || 0) > 1 && (
                              <button
                                onClick={() => setOpenConversation(openConversation === email.id ? null : email.id)}
                                className="rounded-md border border-navy-200 bg-navy-50 px-3 py-1.5 text-[9px] font-bold text-navy-700 hover:bg-navy-100"
                              >
                                {openConversation === email.id ? "Ocultar conversación" : `Ver conversación (${conversationOf.get(email.conversationId || "")!.length})`}
                              </button>
                            )}
                          </div>
                          {openConversation === email.id && (
                            <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto border-l-2 border-navy-100 pl-3">
                              {(conversationOf.get(email.conversationId || "") || []).map((message) => (
                                <li key={message.id} className={`rounded-lg border p-2.5 ${message.id === email.id ? "border-navy-200 bg-navy-50" : "border-slate-100 bg-slate-50"}`}>
                                  <div className="flex items-center justify-between gap-2 text-[9px]">
                                    <strong className="truncate text-slate-700">{message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Remitente"}</strong>
                                    <span className="shrink-0 text-slate-400">{new Date(message.receivedDateTime).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                  <p className="mt-1 line-clamp-3 text-[10px] text-slate-600">{(message.uniqueBody?.content || message.body?.content || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || "(sin texto)"}</p>
                                </li>
                              ))}
                            </ol>
                          )}
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