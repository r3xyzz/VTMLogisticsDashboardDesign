// src/components/TablaCoordinacion.tsx
// Coordinación de operaciones, separada por tipo de carga:
//   FCL (contenedores · Cristóbal): programación por fecha (futuro + historial), duplicar servicios/días y varias pizarras por día.
//   LCL (carga suelta · César): una pizarra libre única para el trabajo diario.
// Datos: coordination_services y coordination_boards (migración 20261119_coordination_fcl_lcl.sql).
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabase"
import { selectAll, selectIn } from "../lib/fetchAll"

type CargoMode = "fcl" | "lcl"
type ServiceType = "expo" | "impo"
type ServiceStatus = "Cotizado" | "Programado" | "En tránsito" | "Entregado"
type BoardTool = "pen" | "marker" | "eraser"
type PenColor = "black" | "blue" | "red" | "purple"
type Point = { x: number; y: number }
type Stroke = { tool: BoardTool; color: PenColor; points: Point[] }
type BoardNote = { id: number; x: number; y: number; text: string; tone: "yellow" | "blue" | "green" }
// Texto libre escrito directo sobre la pizarra (sin recuadro de nota)
type BoardText = { id: number; x: number; y: number; text: string; bold: boolean; w?: number } // w: ancho del recuadro (px)
type BoardData = { strokes: Stroke[]; notes: BoardNote[]; texts: BoardText[]; positions: Record<string, Point> }

type Service = {
  id: string
  mode: CargoMode
  type: ServiceType
  serviceDate: string // YYYY-MM-DD ("" = sin fecha)
  time: string // hora de retiro / presentación
  forwarder: string // cliente o embarcador (Kuehne + Nagel, Rapla...)
  finalClient: string
  reference: string
  shippingLine: string // naviera
  containerNumber: string
  containerSize: string // 20, 40, 40HC
  cargo: string // tipo de mercancía
  packages: string // cantidad de bultos
  pallets: string
  weightKg: string
  volumeCbm: string
  zone: string // comuna o zona para consolidar rutas (Recoleta, Peñalolén, centro sur...)
  dimensions: string
  stackable: boolean
  stacking: string
  stackingTone: "urgent" | "warning" | "safe" | "done"
  pickup: string
  pickupContact: string
  stops: string[] // paradas intermedias (ruta de hasta 4 puntos: retiro → parada 1 → parada 2 → entrega)
  delivery: string
  deliveryDate: string // YYYY-MM-DD (entregar a más tardar)
  deliveryTime: string // HH:MM (entregar a más tardar)
  deliveryContact: string
  instructions: string // instrucciones especiales (encarpar...)
  driver: string
  plate: string // camión
  trailer: string // rampla
  status: ServiceStatus
  done: boolean // finalizado: se muestra tachado
  orderId: string // OT de Nueva OT que creó este servicio ("" = creado en Coordinación)
  tripStatus: string // estado del viaje en la OT (pending / in_progress / completed / draft)
  source: string
  updated: string
}

type Board = { id: string; mode: CargoMode; boardDate: string | null; name: string; data: BoardData; updatedAt: string; updatedBy: string | null }

type IconName = "alert" | "arrow" | "board" | "calendar" | "check" | "chevron" | "clock" | "copy" | "download" | "image" | "list" | "package" | "search" | "truck" | "user"

const iconPaths: Record<IconName, string[]> = {
  alert: ["M12 9v4m0 4h.01", "M10.3 3.7 2.2 17h19L13.7 3.7a2 2 0 0 0-3.4 0z"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  board: ["M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M8 2v4m8-4v4M3 9h18"],
  calendar: ["M6 2v4m12-4v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z"],
  check: ["m5 12 4 4L19 6"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  copy: ["M8 8h11v11H8z", "M5 16V5h11"],
  download: ["M12 3v12m0 0 4-4m-4 4-4-4", "M5 20h14"],
  image: ["M4 5h16v14H4z", "m4 16 5-5 4 4 3-3 4 4", "M15 9h.01"],
  list: ["M8 6h12M8 12h12M8 18h12", "M4 6h.01M4 12h.01M4 18h.01"],
  package: ["M21 8 12 3 3 8l9 5 9-5z", "M3 8v8l9 5 9-5V8M12 13v8"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  truck: ["M3 6h11v10H3zM14 9h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
}

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {iconPaths[name].map((path, index) => <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}

// ---------- Fechas ----------
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const parseDay = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d) }
const addDays = (key: string, days: number) => { const date = parseDay(key); date.setDate(date.getDate() + days); return localDay(date) }
const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const formatLong = (key: string) => key ? capitalizeFirst(parseDay(key).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) : "Sin fecha"
const formatShort = (key: string) => key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : "—"
const MONTH_LABEL = (date: Date) => capitalizeFirst(date.toLocaleDateString("es-CL", { month: "long", year: "numeric" }))

// ---------- Marcadores visuales ----------
const is20 = (service: Service) => service.containerSize.trim().startsWith("20")
const isSanAntonio = (service: Service) => /san\s*antonio/i.test([service.pickup, ...service.stops, service.delivery, service.pickupContact, service.deliveryContact].join(" "))
// Retiro → parada 1 → parada 2 → entrega
const routeLine = (service: Service) => [service.pickup, ...service.stops, service.delivery].filter(Boolean).join(" → ")
const TYPE_STYLE: Record<ServiceType, { label: string; badge: string; header: string; canvas: string }> = {
  expo: { label: "EXPO", badge: "bg-red-50 text-red-700 ring-red-200", header: "bg-red-500", canvas: "#ef4444" },
  impo: { label: "IMPO", badge: "bg-slate-100 text-slate-800 ring-slate-300", header: "bg-slate-800", canvas: "#1e293b" },
}

// Estado de la OT (lo avanza el camionero en su módulo / el POD final)
const TRIP: Record<string, { label: string; style: string }> = {
  draft: { label: "Borrador", style: "bg-slate-100 text-slate-500 ring-slate-200" },
  pending: { label: "En carga", style: "bg-amber-50 text-amber-700 ring-amber-200" },
  in_progress: { label: "En tránsito", style: "bg-orange-50 text-orange-700 ring-orange-200" },
  completed: { label: "Completado", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
}
function TripBadge({ service }: { service: Service }) {
  if (!service.orderId) return null
  const trip = TRIP[service.tripStatus]
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${trip?.style ?? "bg-slate-100 text-slate-500 ring-slate-200"}`} title="Viaje de la OT (lo actualiza el camionero)">OT · {trip?.label ?? "Sin estado"}</span>
}

const statusStyles: Record<ServiceStatus, string> = {
  Cotizado: "bg-slate-100 text-slate-600 ring-slate-200",
  Programado: "bg-blue-50 text-blue-700 ring-blue-200",
  "En tránsito": "bg-orange-50 text-orange-700 ring-orange-200",
  Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

// ---------- Base de datos ----------
// Columnas antiguas (scope, date) se siguen llenando para no romper otras vistas
function legacyScope(day: string) {
  const today = localDay()
  if (!day || day === today) return "today"
  if (day === addDays(today, 1)) return "tomorrow"
  return day.slice(0, 7) === today.slice(0, 7) ? "month" : "previous"
}

function rowToService(row: any): Service {
  return {
    id: row.id,
    mode: row.cargo_mode === "lcl" ? "lcl" : "fcl",
    type: row.type === "impo" ? "impo" : "expo",
    serviceDate: row.service_date || "",
    time: row.time || "",
    forwarder: row.forwarder || "",
    finalClient: row.final_client || "",
    reference: row.reference || "",
    shippingLine: row.shipping_line || "",
    containerNumber: row.container_number || "",
    containerSize: row.container_size || "",
    cargo: row.cargo || "",
    packages: row.packages || "",
    pallets: row.pallets || "",
    weightKg: row.weight_kg != null ? String(row.weight_kg) : "",
    volumeCbm: row.volume_cbm != null ? String(row.volume_cbm) : "",
    zone: row.zone || "",
    dimensions: row.dimensions || "",
    stackable: !!row.stackable,
    stacking: row.stacking || "",
    stackingTone: (row.stacking_tone as Service["stackingTone"]) || "safe",
    pickup: row.pickup || "",
    pickupContact: row.pickup_contact || "",
    stops: Array.isArray(row.stops) ? row.stops.filter(Boolean) : [],
    delivery: row.delivery || "",
    deliveryDate: row.delivery_date || "",
    deliveryTime: row.delivery_time || "",
    deliveryContact: row.delivery_contact || "",
    instructions: row.special_instructions || "",
    driver: row.driver || "",
    plate: row.plate || "",
    trailer: row.trailer_plate || "",
    status: (row.status as ServiceStatus) || "Programado",
    done: !!row.done,
    orderId: row.order_id || "",
    tripStatus: "",
    source: row.source || "",
    updated: row.updated || "",
  }
}

// "1.234,5" / "120,5" / "120.5" -> número (null si está vacío)
function toNumber(value: string): number | null {
  let text = (value || "").trim().replace(/\s/g, "")
  if (!text) return null
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "")
  const n = parseFloat(text.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

function serviceToRow(service: Service) {
  return {
    cargo_mode: service.mode,
    type: service.type,
    scope: legacyScope(service.serviceDate),
    date: service.serviceDate ? `${service.serviceDate.slice(8, 10)}/${service.serviceDate.slice(5, 7)}/${service.serviceDate.slice(0, 4)}` : "Sin fecha",
    service_date: service.serviceDate || null,
    time: service.time,
    forwarder: service.forwarder,
    final_client: service.finalClient,
    reference: service.reference,
    shipping_line: service.shippingLine || null,
    container_number: service.containerNumber || null,
    container_size: service.containerSize || null,
    cargo: service.cargo,
    packages: service.packages || null,
    pallets: service.pallets || null,
    weight_kg: toNumber(service.weightKg),
    volume_cbm: toNumber(service.volumeCbm),
    zone: service.zone.trim() || null,
    dimensions: service.dimensions,
    stackable: service.stackable,
    stacking: service.stacking,
    stacking_tone: service.stackingTone,
    pickup: service.pickup,
    pickup_contact: service.pickupContact,
    // Solo se envía si hay paradas: así no falla si aún no se corre la migración 20261125
    ...(service.stops.some((stop) => stop.trim()) ? { stops: service.stops.map((stop) => stop.trim()).filter(Boolean) } : {}),
    delivery: service.delivery,
    delivery_date: service.deliveryDate || null,
    // Solo se envía si tiene valor: así no falla si aún no se corre la migración 20261124b
    ...(service.deliveryTime ? { delivery_time: service.deliveryTime } : {}),
    delivery_contact: service.deliveryContact,
    special_instructions: service.instructions || null,
    driver: service.driver,
    plate: service.plate,
    trailer_plate: service.trailer || null,
    status: service.status,
    done: service.done,
    source: service.source,
    updated: new Date().toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    updated_at: new Date().toISOString(),
    order_id: service.orderId || null,
  }
}

const emptyBoardData = (): BoardData => ({ strokes: [], notes: [], texts: [], positions: {} })
function rowToBoard(row: any): Board {
  const data = row.data || {}
  return {
    id: row.id, mode: row.cargo_mode, boardDate: row.board_date, name: row.name, updatedAt: row.updated_at, updatedBy: row.updated_by,
    data: { strokes: data.strokes || [], notes: data.notes || [], texts: data.texts || [], positions: data.positions || {} },
  }
}

const newService = (mode: CargoMode, serviceDate: string): Service => ({
  id: "", mode, type: "impo", serviceDate, time: "", forwarder: "", finalClient: "", reference: "", shippingLine: "", containerNumber: "",
  containerSize: mode === "fcl" ? "40" : "", cargo: "", packages: "", pallets: "", weightKg: "", volumeCbm: "", zone: "", dimensions: "", stackable: false, stacking: "", stackingTone: "safe",
  pickup: "", pickupContact: "", stops: [], delivery: "", deliveryDate: "", deliveryTime: "", deliveryContact: "",instructions: "", driver: "", plate: "", trailer: "",
  status: "Programado", done: false, orderId: "", tripStatus: "", source: "", updated: "",
})

const sortServices = (list: Service[]) => [...list].sort((a, b) => `${a.serviceDate || "9999"} ${a.time || "99:99"}`.localeCompare(`${b.serviceDate || "9999"} ${b.time || "99:99"}`))

// ---------- Exportaciones ----------
function exportExcel(services: Service[], fileName: string) {
  const rows = services.map((s) => ({
    Tipo: s.type === "expo" ? "Exportación" : "Importación",
    Carga: s.mode.toUpperCase(),
    Fecha: s.serviceDate ? formatShort(s.serviceDate) + "/" + s.serviceDate.slice(0, 4) : "Sin fecha",
    "Hora retiro": s.time,
    "Cliente / Embarcador": s.forwarder,
    "Cliente final": s.finalClient,
    Referencia: s.reference,
    Naviera: s.shippingLine,
    Contenedor: s.containerNumber,
    Medida: s.containerSize ? `${s.containerSize}'` : "",
    Mercancía: s.cargo,
    Bultos: s.packages,
    Retiro: s.pickup,
    Paradas: s.stops.join(" → "),
    Entrega: s.delivery,
    "Fecha entrega": s.deliveryDate ? formatShort(s.deliveryDate) : "",
    Instrucciones: s.instructions,
    Conductor: s.driver,
    Camión: s.plate,
    Rampla: s.trailer,
    Estado: s.status,
    Finalizado: s.done ? "Sí" : "No",
  }))
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet["!cols"] = Object.keys(rows[0] || { A: 1 }).map((key) => ({ wch: Math.max(10, key.length + 2) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Programación")
  XLSX.writeFile(book, fileName)
}

// Imagen nítida (2x) de la programación para el grupo de WhatsApp de Operaciones
function drawProgramImage(title: string, subtitle: string, services: Service[]): HTMLCanvasElement {
  const width = 1080
  const scale = 2
  const measure = document.createElement("canvas").getContext("2d")!
  const wrap = (text: string, font: string, maxWidth: number) => {
    measure.font = font
    const lines: string[] = []
    let line = ""
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (measure.measureText(next).width > maxWidth && line) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    return lines.length ? lines : ["—"]
  }
  type Row = { label: string; value: string; color?: string }
  const cards = services.map((s) => {
    const rows: Row[] = [
      { label: "Cliente", value: [s.forwarder, s.finalClient].filter(Boolean).join(" / ") },
      ...(s.mode === "fcl" ? [{ label: "Contenedor", value: [s.containerNumber, s.containerSize && `${s.containerSize}'`, s.shippingLine].filter(Boolean).join(" · ") }] : []),
      { label: "Mercancía", value: [s.cargo, s.packages && `${s.packages} bultos`].filter(Boolean).join(" · ") },
      { label: "Retiro", value: [s.time, s.pickup].filter(Boolean).join(" · "), color: isSanAntonio(s) && /san\s*antonio/i.test(s.pickup) ? "#7c3aed" : undefined },
      ...(s.stops.length ? [{ label: "Paradas", value: s.stops.join(" → ") }] : []),
      { label: "Entrega", value: [s.delivery, s.deliveryDate && `(${formatShort(s.deliveryDate)})`].filter(Boolean).join(" "), color: s.deliveryDate ? "#dc2626" : undefined },
      ...(s.instructions ? [{ label: "Instrucciones", value: s.instructions, color: "#b45309" }] : []),
      { label: "Conductor", value: [s.driver || "Por asignar", s.plate && `Camión ${s.plate}`, s.trailer && `Rampla ${s.trailer}`].filter(Boolean).join(" · ") },
    ].filter((row) => row.value)
    const wrapped = rows.map((row) => ({ ...row, lines: wrap(row.value, "600 22px Inter, sans-serif", width - 300) }))
    const height = 70 + wrapped.reduce((sum, row) => sum + row.lines.length * 30 + 6, 0) + 16
    return { s, wrapped, height }
  })
  const totalHeight = 150 + cards.reduce((sum, card) => sum + card.height + 20, 0) + (cards.length ? 0 : 80) + 40
  const canvas = document.createElement("canvas")
  canvas.width = width * scale
  canvas.height = totalHeight * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, width, totalHeight)
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, width, 120)
  ctx.fillStyle = "#ffffff"; ctx.font = "800 36px Inter, sans-serif"; ctx.fillText(title, 40, 58)
  ctx.fillStyle = "#93c5fd"; ctx.font = "600 22px Inter, sans-serif"; ctx.fillText(subtitle, 40, 94)
  let y = 150
  if (!cards.length) { ctx.fillStyle = "#64748b"; ctx.font = "600 24px Inter, sans-serif"; ctx.fillText("Sin servicios programados.", 40, y + 30) }
  for (const { s, wrapped, height } of cards) {
    ctx.globalAlpha = s.done ? 0.55 : 1
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2
    ctx.fillRect(30, y, width - 60, height); ctx.strokeRect(30, y, width - 60, height)
    ctx.fillStyle = is20(s) ? "#2563eb" : "#94a3b8"; ctx.fillRect(30, y, 12, height) // 20' en azul
    // Encabezado: tipo · hora · referencia · medida · San Antonio
    let x = 62
    const pill = (text: string, bg: string, fg: string) => {
      ctx.font = "800 18px Inter, sans-serif"
      const w = ctx.measureText(text).width + 22
      ctx.fillStyle = bg; ctx.fillRect(x, y + 18, w, 32)
      ctx.fillStyle = fg; ctx.fillText(text, x + 11, y + 41)
      x += w + 10
    }
    pill(TYPE_STYLE[s.type].label, TYPE_STYLE[s.type].canvas, "#ffffff")
    if (s.containerSize) pill(`${s.containerSize}'`, is20(s) ? "#2563eb" : "#475569", "#ffffff")
    if (isSanAntonio(s)) pill("SAN ANTONIO", "#7c3aed", "#ffffff")
    if (s.done) pill("FINALIZADO", "#16a34a", "#ffffff")
    ctx.fillStyle = "#0f172a"; ctx.font = "800 24px Inter, sans-serif"
    ctx.fillText([s.time, s.reference].filter(Boolean).join("  ·  "), x + 6, y + 42)
    let rowY = y + 86
    for (const row of wrapped) {
      ctx.fillStyle = "#64748b"; ctx.font = "700 16px Inter, sans-serif"; ctx.fillText(row.label.toUpperCase(), 62, rowY)
      ctx.fillStyle = row.color || "#0f172a"; ctx.font = "600 22px Inter, sans-serif"
      row.lines.forEach((line, index) => ctx.fillText(line, 240, rowY + index * 30))
      rowY += row.lines.length * 30 + 6
    }
    if (s.done) { ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(62, y + height / 2); ctx.lineTo(width - 50, y + height / 2); ctx.stroke() }
    ctx.globalAlpha = 1
    y += height + 20
  }
  ctx.fillStyle = "#94a3b8"; ctx.font = "600 16px Inter, sans-serif"
  ctx.fillText(`VTM Logistics · generado ${new Date().toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, 40, totalHeight - 18)
  return canvas
}

// Copia la imagen al portapapeles (para pegar en WhatsApp Web) y además la descarga
async function shareCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) return "No se pudo generar la imagen"
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url; anchor.download = fileName; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
    return "Imagen descargada y copiada: pégala en WhatsApp con Ctrl+V"
  } catch {
    return "Imagen descargada"
  }
}

// ---------- Pizarra libre ----------
const PEN_COLORS: Record<PenColor, string> = { black: "#0f172a", blue: "#2563eb", red: "#dc2626", purple: "#7c3aed" }
const noteStyles: Record<BoardNote["tone"], string> = {
  yellow: "border-amber-200 bg-amber-50 text-amber-950",
  blue: "border-blue-200 bg-blue-50 text-blue-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-950",
}
const CARD_W = 300
const CARD_H = 250
const defaultPosition = (index: number): Point => ({ x: 24 + (index % 3) * 324, y: 24 + Math.floor(index / 3) * 274 })

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return
  context.beginPath()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.strokeStyle = stroke.tool === "pen" ? PEN_COLORS[stroke.color] : stroke.tool === "marker" ? "rgba(250, 204, 21, 0.48)" : "#ffffff"
  context.lineWidth = stroke.tool === "pen" ? 3 : stroke.tool === "marker" ? 14 : 28
  context.moveTo(stroke.points[0].x, stroke.points[0].y)
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  context.stroke()
}

function BoardCard({ service, onEdit, onToggleDone }: { service: Service; onEdit: () => void; onToggleDone: () => void }) {
  const style = TYPE_STYLE[service.type]
  return (
    <div className={`space-y-1.5 p-3 text-[10px] ${service.done ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-center gap-1">
        {service.containerSize && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${is20(service) ? "bg-blue-600" : "bg-slate-600"}`}>{service.containerSize}'</span>}
        {isSanAntonio(service) && <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">SAN ANTONIO</span>}
        {service.zone && <span className="rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{service.zone}</span>}
        <TripBadge service={service} />
        <span className="ml-auto font-bold text-slate-700">{service.time || "Sin hora"}</span>
      </div>
      <p className={`truncate font-bold text-slate-900 ${service.done ? "line-through" : ""}`}>{service.forwarder || "Sin cliente"}{service.finalClient && <span className="font-medium text-slate-400"> / {service.finalClient}</span>}</p>
      {service.mode === "fcl" && <p className="truncate font-mono text-slate-600">{[service.containerNumber, service.shippingLine].filter(Boolean).join(" · ") || "—"}</p>}
      <p className="truncate text-slate-600">{[service.cargo, service.packages && `${service.packages} bultos`].filter(Boolean).join(" · ") || "—"}</p>
      <p className="truncate text-slate-700"><strong>Retiro:</strong> {service.pickup || "—"}</p>
      {service.stops.length > 0 && <p className="truncate text-slate-700"><strong>Paradas:</strong> {service.stops.join(" → ")}</p>}
      <p className="truncate text-slate-700"><strong>Entrega:</strong> {service.delivery || "—"} {service.deliveryDate && <span className="font-bold text-red-600">({formatShort(service.deliveryDate)})</span>}</p>
      {service.instructions && <p className="truncate font-semibold text-amber-700">⚠ {service.instructions}</p>}
      <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
        <p className="truncate font-semibold text-slate-700">{service.driver || <span className="text-orange-600">Sin conductor</span>} <span className="font-mono text-slate-400">{[service.plate, service.trailer].filter(Boolean).join(" / ")}</span></p>
        <div className="flex shrink-0 gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={onToggleDone} className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${service.done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{service.done ? "✓ Listo" : "Finalizar"}</button>
          <button onClick={onEdit} className={`rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${style.header}`}>Editar</button>
        </div>
      </div>
    </div>
  )
}

function Whiteboard({ title, services, initialData, onDataChange, onEdit, onToggleDone, saveLabel }: {
  title: string
  services: Service[]
  initialData: BoardData
  onDataChange: (data: BoardData) => void
  onEdit: (service: Service) => void
  onToggleDone: (service: Service) => void
  saveLabel: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const dragRef = useRef<{ kind: "note" | "card" | "text"; id: string; offsetX: number; offsetY: number } | null>(null)
  const historyRef = useRef<BoardData[]>([])
  const [tool, setTool] = useState<BoardTool>("pen")
  // Pantallas táctiles: "Mover" deja deslizar la página con el dedo sin dibujar (activo por defecto en celular/tablet)
  const [moving, setMoving] = useState(() => window.matchMedia("(pointer: coarse)").matches)
  const [penColor, setPenColor] = useState<PenColor>("blue")
  const [data, setData] = useState<BoardData>(initialData)
  // "Texto": el próximo toque/clic en el lienzo crea un texto ahí mismo
  const [placingText, setPlacingText] = useState(false)
  const [focusTextId, setFocusTextId] = useState<number | null>(null)
  useEffect(() => {
    if (focusTextId === null) return
    // El foco se da después del clic (el navegador mueve el foco al terminar el mousedown).
    // focusTextId se limpia dentro del timeout: limpiarlo antes cancelaba el timeout y el recuadro nunca recibía el foco.
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-text-id="${focusTextId}"]`)?.focus()
      setFocusTextId(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [focusTextId])
  // Un recuadro recién creado no se borra si pierde el foco en ese mismo instante
  const createdRef = useRef<{ id: number; at: number } | null>(null)
  const updateText = (id: number, patch: Partial<BoardText>) => update({ ...data, texts: data.texts.map((item) => item.id === id ? { ...item, ...patch } : item) })
  const removeText = (id: number) => update({ ...data, texts: data.texts.filter((item) => item.id !== id) })
  const [historySize, setHistorySize] = useState(0)

  // Cada cambio se guarda (el padre hace autoguardado)
  const update = (next: BoardData) => { setData(next); onDataChange(next) }
  const remember = () => { historyRef.current = [...historyRef.current.slice(-49), data]; setHistorySize(historyRef.current.length) }
  const undo = () => {
    const previous = historyRef.current.pop()
    setHistorySize(historyRef.current.length)
    if (previous) update(previous)
  }

  const positionOf = (service: Service, index: number) => data.positions[service.id] ?? defaultPosition(index)

  useEffect(() => {
    const canvas = canvasRef.current
    const board = boardRef.current
    if (!canvas || !board) return
    const redraw = () => {
      const context = canvas.getContext("2d")
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      data.strokes.forEach((stroke) => drawStroke(context, stroke))
    }
    const resize = () => { canvas.width = board.clientWidth; canvas.height = board.clientHeight; redraw() }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(board)
    return () => observer.disconnect()
  }, [data.strokes])

  const pointFromEvent = (event: React.PointerEvent<HTMLElement>): Point => {
    const rect = boardRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const addNote = () => {
    remember()
    const tone = (["yellow", "blue", "green"] as const)[data.notes.length % 3]
    update({ ...data, notes: [...data.notes, { id: Date.now(), x: 60 + (data.notes.length % 3) * 44, y: 70 + (data.notes.length % 4) * 38, text: "Escribe una nota...", tone }] })
  }

  const exportPng = async () => {
    const board = boardRef.current
    if (!board) return
    const output = document.createElement("canvas")
    output.width = board.clientWidth * 2
    output.height = board.clientHeight * 2
    const ctx = output.getContext("2d")
    if (!ctx) return
    ctx.scale(2, 2)
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, board.clientWidth, board.clientHeight)
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 0.5
    for (let x = 24; x < board.clientWidth; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, board.clientHeight); ctx.stroke() }
    for (let y = 24; y < board.clientHeight; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(board.clientWidth, y); ctx.stroke() }
    data.strokes.forEach((stroke) => drawStroke(ctx, stroke))
    services.forEach((s, index) => {
      const { x, y } = positionOf(s, index)
      ctx.globalAlpha = s.done ? 0.55 : 1
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1
      ctx.fillRect(x, y, CARD_W, CARD_H); ctx.strokeRect(x, y, CARD_W, CARD_H)
      ctx.fillStyle = TYPE_STYLE[s.type].canvas; ctx.fillRect(x, y, CARD_W, 34)
      ctx.fillStyle = "#ffffff"; ctx.font = "700 11px Inter, sans-serif"
      ctx.fillText(`${s.type === "expo" ? "EXPORTACIÓN" : "IMPORTACIÓN"} · ${s.reference}`.slice(0, 44), x + 10, y + 22)
      const rows: [string, string, string?][] = [
        ["MEDIDA", [s.containerSize && `${s.containerSize}'`, isSanAntonio(s) && "SAN ANTONIO"].filter(Boolean).join(" · "), is20(s) ? "#2563eb" : isSanAntonio(s) ? "#7c3aed" : undefined],
        ["HORA", s.time],
        ["CLIENTE", [s.forwarder, s.finalClient].filter(Boolean).join(" / ")],
        ["CONTENEDOR", [s.containerNumber, s.shippingLine].filter(Boolean).join(" · ")],
        ["MERCANCÍA", [s.cargo, s.packages && `${s.packages} bultos`].filter(Boolean).join(" · ")],
        ["RETIRO", [s.pickup, ...s.stops].filter(Boolean).join(" → ")],
        ["ENTREGA", [s.delivery, s.deliveryDate && `(${formatShort(s.deliveryDate)})`].filter(Boolean).join(" "), s.deliveryDate ? "#dc2626" : undefined],
        ["INSTRUCC.", s.instructions, "#b45309"],
        ["CONDUCTOR", [s.driver || "Por asignar", s.plate, s.trailer].filter(Boolean).join(" · ")],
      ]
      rows.forEach(([label, value, color], rowIndex) => {
        const rowY = y + 52 + rowIndex * 22
        ctx.fillStyle = "#94a3b8"; ctx.font = "700 7px Inter, sans-serif"; ctx.fillText(label, x + 10, rowY)
        ctx.fillStyle = color || "#1e293b"; ctx.font = "600 9px Inter, sans-serif"; ctx.fillText((value || "—").slice(0, 44), x + 78, rowY)
      })
      if (s.done) { ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y + CARD_H / 2); ctx.lineTo(x + CARD_W - 8, y + CARD_H / 2); ctx.stroke() }
      ctx.globalAlpha = 1
    })
    const noteColors = { yellow: ["#fffbeb", "#fde68a", "#451a03"], blue: ["#eff6ff", "#bfdbfe", "#172554"], green: ["#ecfdf5", "#a7f3d0", "#022c22"] } as const
    data.notes.forEach((note) => {
      const [fill, border, text] = noteColors[note.tone]
      ctx.fillStyle = fill; ctx.strokeStyle = border; ctx.lineWidth = 1
      ctx.fillRect(note.x, note.y, 224, 124); ctx.strokeRect(note.x, note.y, 224, 124)
      ctx.fillStyle = text; ctx.font = "600 12px Inter, sans-serif"
      note.text.split("\n").forEach((line, index) => ctx.fillText(line.slice(0, 32), note.x + 12, note.y + 30 + index * 18))
    })
    data.texts.forEach((item) => {
      ctx.fillStyle = "#0f172a"; ctx.font = `${item.bold ? 700 : 500} 15px Inter, sans-serif`
      const maxWidth = (item.w ?? 360) - 12
      const lines: string[] = []
      for (const paragraph of item.text.split("\n")) {
        let line = ""
        for (const word of paragraph.split(" ")) {
          const next = line ? `${line} ${word}` : word
          if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word } else line = next
        }
        lines.push(line)
      }
      lines.forEach((line, index) => ctx.fillText(line, item.x + 7, item.y + 18 + index * 20))
    })
    await shareCanvas(output, `pizarra-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button onClick={() => { setMoving(true); setPlacingText(false) }} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold ${moving ? "bg-white text-navy-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`} title="Desplazar la página sin dibujar"><span className="text-sm">✋</span>Mover</button>
          {([{ id: "pen", label: "Lápiz", symbol: "⌁" }, { id: "marker", label: "Destacador", symbol: "▰" }, { id: "eraser", label: "Borrador", symbol: "◇" }] as const).map((item) => (
            <button key={item.id} onClick={() => { setTool(item.id); setMoving(false); setPlacingText(false) }} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold ${!moving && !placingText && tool === item.id ? "bg-white text-navy-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
              <span className="text-sm">{item.symbol}</span>{item.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-300" />
          {(Object.keys(PEN_COLORS) as PenColor[]).map((color) => (
            <button key={color} onClick={() => { setPenColor(color); setTool("pen"); setMoving(false) }} title={`Lápiz ${color}`} className={`flex size-6 items-center justify-center rounded-full ${penColor === color && tool === "pen" ? "ring-2 ring-navy-300 ring-offset-2" : ""}`}>
              <span className="size-3.5 rounded-full" style={{ background: PEN_COLORS[color] }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-300" />
          <button onClick={() => { setPlacingText(true); setMoving(false) }} title="Toca o haz clic en el lienzo donde quieras escribir" className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold ${placingText ? "bg-white text-navy-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white hover:text-navy-700"}`}><span className="font-serif text-base font-bold leading-none">T</span> Texto</button>
          <button onClick={addNote} className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-navy-700"><span className="text-base leading-none">▤</span> Nota</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400">{saveLabel}</span>
          <button onClick={undo} disabled={historySize === 0} className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-500 disabled:opacity-40">Deshacer</button>
          <button onClick={() => { remember(); update({ ...data, strokes: [], notes: [], texts: [] }) }} className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-red-600 hover:bg-red-50">Limpiar</button>
          <button onClick={exportPng} className="flex h-8 items-center gap-2 rounded-lg bg-navy-600 px-3 text-[11px] font-semibold text-white hover:bg-navy-700"><Icon name="image" className="size-3.5" />Imagen</button>
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2">
        <p className="text-[10px] text-slate-500">{placingText ? "Toca el lienzo donde quieras escribir." : "Dibuja o raya sobre el lienzo. Con Texto escribes directo en la pizarra. Arrastra tarjetas, notas y textos para moverlos. Se guarda solo."}</p>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      </div>
      <div
        ref={boardRef}
        className="relative h-[960px] overflow-hidden bg-white"
        style={{ backgroundImage: "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          const board = boardRef.current
          if (!drag || !board) return
          const point = pointFromEvent(event)
          if (drag.kind === "text") {
            setData((current) => ({ ...current, texts: current.texts.map((item) => String(item.id) === drag.id ? { ...item, x: Math.max(0, Math.min(point.x - drag.offsetX, board.clientWidth - 40)), y: Math.max(0, Math.min(point.y - drag.offsetY, board.clientHeight - 24)) } : item) }))
          } else if (drag.kind === "note") {
            setData((current) => ({ ...current, notes: current.notes.map((note) => String(note.id) === drag.id ? { ...note, x: Math.max(0, Math.min(point.x - drag.offsetX, board.clientWidth - 224)), y: Math.max(0, Math.min(point.y - drag.offsetY, board.clientHeight - 124)) } : note) }))
          } else {
            setData((current) => ({ ...current, positions: { ...current.positions, [drag.id]: { x: Math.max(0, Math.min(point.x - drag.offsetX, board.clientWidth - CARD_W)), y: Math.max(0, Math.min(point.y - drag.offsetY, board.clientHeight - CARD_H)) } } }))
          }
        }}
        onPointerUp={() => { if (dragRef.current) { dragRef.current = null; onDataChange(data) } }}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 size-full ${moving ? "pointer-events-none" : placingText ? "touch-none cursor-text" : "touch-none cursor-crosshair"}`}
          onPointerDown={(event) => {
            remember()
            if (placingText) {
              // Sin esto el mousedown del clic le quita el foco al recuadro nuevo y se borraba por estar vacío
              event.preventDefault()
              const point = pointFromEvent(event)
              const id = Date.now()
              const boardWidth = boardRef.current?.clientWidth ?? 800
              createdRef.current = { id, at: Date.now() }
              update({ ...data, texts: [...data.texts, { id, x: Math.min(point.x, Math.max(0, boardWidth - 200)), y: Math.max(0, point.y - 10), text: "", bold: false, w: Math.min(420, boardWidth - point.x - 16) }] })
              setPlacingText(false)
              setFocusTextId(id)
              return
            }
            drawingRef.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setData((current) => ({ ...current, strokes: [...current.strokes, { tool, color: penColor, points: [pointFromEvent(event)] }] }))
          }}
          onPointerMove={(event) => {
            if (!drawingRef.current) return
            const point = pointFromEvent(event)
            setData((current) => ({ ...current, strokes: current.strokes.map((stroke, index) => index === current.strokes.length - 1 ? { ...stroke, points: [...stroke.points, point] } : stroke) }))
          }}
          onPointerUp={() => { if (drawingRef.current) { drawingRef.current = false; onDataChange(data) } }}
          onPointerCancel={() => { drawingRef.current = false }}
        />
        {services.map((service, index) => {
          const position = positionOf(service, index)
          return (
            <article key={service.id} className={`absolute z-10 overflow-hidden rounded-xl border bg-white shadow-md ${is20(service) ? "border-blue-300" : "border-slate-200"}`} style={{ left: position.x, top: position.y, width: CARD_W }}>
              <div
                className={`flex h-8 cursor-move touch-none items-center justify-between gap-2 px-3 text-white ${TYPE_STYLE[service.type].header}`}
                onPointerDown={(event) => {
                  remember()
                  const rect = event.currentTarget.parentElement!.getBoundingClientRect()
                  dragRef.current = { kind: "card", id: service.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider">{TYPE_STYLE[service.type].label}</span>
                <span className="truncate font-mono text-[9px] font-bold">{service.reference}</span>
              </div>
              <BoardCard service={service} onEdit={() => onEdit({ ...service })} onToggleDone={() => onToggleDone(service)} />
            </article>
          )
        })}
        {data.texts.map((item) => {
          return (
            <div key={item.id} className="group absolute z-20" style={{ left: item.x, top: item.y }}>
              <div className="absolute -top-8 left-0 flex items-center gap-0.5 rounded-md bg-slate-900 p-0.5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <span
                  className="cursor-move touch-none rounded px-2 py-1 text-[10px] font-bold hover:bg-white/10"
                  title="Arrastra para mover"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    remember()
                    const rect = event.currentTarget.parentElement!.parentElement!.getBoundingClientRect()
                    dragRef.current = { kind: "text", id: String(item.id), offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                >✥ Mover</span>
                <button onPointerDown={(event) => event.preventDefault()} onClick={() => { remember(); updateText(item.id, { bold: !item.bold }) }} className={`rounded px-2 py-1 text-[11px] font-black ${item.bold ? "bg-white text-slate-900" : "hover:bg-white/10"}`} title="Negrita">B</button>
                <button onPointerDown={(event) => event.preventDefault()} onClick={() => { remember(); removeText(item.id) }} className="rounded px-2 py-1 text-[11px] hover:bg-red-500" title="Borrar texto">×</button>
              </div>
              {/* Recuadro transparente: el texto baja de línea solo y el alto crece; el ancho se ajusta arrastrando la esquina */}
              <textarea
                data-text-id={item.id}
                ref={(element) => { if (element) { element.style.height = "auto"; element.style.height = `${element.scrollHeight + 2}px` } }}
                value={item.text}
                rows={1}
                placeholder="Escribe aquí…"
                onFocus={remember}
                onChange={(event) => updateText(item.id, { text: event.target.value })}
                onPointerUp={(event) => { const width = event.currentTarget.offsetWidth; if (Math.abs(width - (item.w ?? 360)) > 4) updateText(item.id, { w: width }) }}
                onBlur={(event) => {
                  if (event.target.value.trim()) return
                  const created = createdRef.current
                  if (created?.id === item.id && Date.now() - created.at < 600) { event.target.focus(); return }
                  removeText(item.id)
                }}
                style={{ width: item.w ?? 360, minWidth: 120, maxWidth: (boardRef.current?.clientWidth ?? 1200) - item.x - 8 }}
                className={`block resize-x overflow-hidden whitespace-pre-wrap break-words rounded border border-dashed border-slate-300/70 bg-transparent px-1.5 py-0.5 text-[15px] leading-snug text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-navy-400 ${item.bold ? "font-bold" : "font-medium"}`}
              />
            </div>
          )
        })}
        {data.notes.map((note) => (
          <article key={note.id} className={`absolute z-10 w-56 overflow-hidden rounded-lg border shadow-md ${noteStyles[note.tone]}`} style={{ left: note.x, top: note.y }}>
            <div
              className="flex h-7 cursor-move touch-none items-center justify-between border-b border-black/5 px-2"
              onPointerDown={(event) => {
                remember()
                const rect = event.currentTarget.parentElement!.getBoundingClientRect()
                dragRef.current = { kind: "note", id: String(note.id), offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-50">Nota</span>
              <button onPointerDown={(event) => event.stopPropagation()} onClick={() => { remember(); update({ ...data, notes: data.notes.filter((item) => item.id !== note.id) }) }} className="text-sm leading-none opacity-40 hover:opacity-100">×</button>
            </div>
            <textarea
              value={note.text}
              onFocus={remember}
              onChange={(event) => update({ ...data, notes: data.notes.map((item) => item.id === note.id ? { ...item, text: event.target.value } : item) })}
              className="h-24 w-full resize-none bg-transparent p-3 text-xs font-semibold leading-5 outline-none"
            />
          </article>
        ))}
      </div>
    </section>
  )
}

// ---------- Tarjeta de programación (estilo PowerPoint) ----------
function ProgramCard({ service, onEdit, onDuplicate, onToggleDone }: { service: Service; onEdit: () => void; onDuplicate: () => void; onToggleDone: () => void }) {
  const style = TYPE_STYLE[service.type]
  const strike = service.done ? "line-through decoration-2 decoration-emerald-600" : ""
  return (
    <article className={`flex overflow-hidden rounded-xl border bg-white shadow-sm transition-opacity ${service.done ? "opacity-60" : ""} ${is20(service) ? "border-blue-300" : "border-slate-200"}`}>
      <div className={`w-2 shrink-0 ${is20(service) ? "bg-blue-500" : "bg-slate-300"}`} title={is20(service) ? "Contenedor 20'" : undefined} />
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row">
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${style.badge}`}>{style.label}</span>
          {service.containerSize && <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold text-white ${is20(service) ? "bg-blue-600" : "bg-slate-600"}`}>{service.containerSize}'</span>}
          {isSanAntonio(service) && <span className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-extrabold text-white">SAN ANTONIO</span>}
          <span className={`text-sm font-extrabold text-slate-900 ${strike}`}>{service.time || "Sin hora"}</span>
          <span className={`font-mono text-xs font-bold text-slate-500 ${strike}`}>{service.reference}</span>
          <span className="ml-auto flex items-center gap-1.5"><TripBadge service={service} /><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${statusStyles[service.status]}`}>{service.status}</span></span>
        </div>
        <div className={`mt-2 grid gap-x-6 gap-y-1 text-[12px] text-slate-700 md:grid-cols-2 ${strike}`}>
          <p><span className="text-[10px] font-bold uppercase text-slate-400">Cliente </span><strong className="text-slate-900">{service.forwarder || "—"}</strong>{service.finalClient && <span className="text-slate-500"> / {service.finalClient}</span>}</p>
          {service.mode === "fcl"
            ? <p><span className="text-[10px] font-bold uppercase text-slate-400">Contenedor </span><span className="font-mono font-semibold">{service.containerNumber || "—"}</span>{service.shippingLine && <span> · {service.shippingLine}</span>}</p>
            : <p><span className="text-[10px] font-bold uppercase text-slate-400">Naviera </span>{service.shippingLine || "—"}</p>}
          <p><span className="text-[10px] font-bold uppercase text-slate-400">Mercancía </span>{service.cargo || "—"}{service.packages && <span> · <strong>{service.packages}</strong> bultos</span>}</p>
          <p><span className="text-[10px] font-bold uppercase text-slate-400">Retiro </span><span className={/san\s*antonio/i.test(service.pickup) ? "font-bold text-violet-700" : ""}>{service.pickup || "—"}</span></p>
          {service.stops.length > 0 && <p className="md:col-span-2"><span className="text-[10px] font-bold uppercase text-slate-400">Ruta </span><span className="font-semibold">{routeLine(service)}</span> <span className="text-[10px] font-bold text-navy-600">· {service.stops.length + 2} puntos</span></p>}
          <p><span className="text-[10px] font-bold uppercase text-slate-400">Entrega </span><span className={/san\s*antonio/i.test(service.delivery) ? "font-bold text-violet-700" : ""}>{service.delivery || "—"}</span>{service.deliveryDate && <strong className="text-red-600"> · {formatShort(service.deliveryDate)}</strong>}</p>
          <p><span className="text-[10px] font-bold uppercase text-slate-400">Conductor </span>{service.driver ? <strong>{service.driver}</strong> : <span className="font-semibold text-orange-600">Por asignar</span>}{(service.plate || service.trailer) && <span className="font-mono text-slate-500"> · {[service.plate && `Camión ${service.plate}`, service.trailer && `Rampla ${service.trailer}`].filter(Boolean).join(" · ")}</span>}</p>
        </div>
        {service.instructions && <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">⚠ {service.instructions}</p>}
      </div>
      <div className="flex shrink-0 flex-row justify-end gap-1.5 border-t border-slate-100 p-2 sm:flex-col sm:justify-center sm:border-l sm:border-t-0">
        <button onClick={onToggleDone} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${service.done ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-emerald-50"}`}>{service.done ? "✓ Finalizado" : "Finalizar"}</button>
        <button onClick={onDuplicate} className="flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><Icon name="copy" className="size-3" />Duplicar</button>
        <button onClick={onEdit} className="rounded-md bg-navy-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-navy-700">Editar</button>
      </div>
      </div>
    </article>
  )
}

// ---------- Calendario FCL ----------
function MonthCalendar({ month, onMonth, selected, onSelect, counts, undatedCount }: {
  month: Date
  onMonth: (month: Date) => void
  selected: string
  onSelect: (day: string) => void
  counts: Record<string, { total: number; done: number }>
  undatedCount: number
}) {
  const today = localDay()
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // lunes primero
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => localDay(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  const shift = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevron" className="size-4 rotate-180" /></button>
        <p className="text-sm font-bold text-slate-900">{MONTH_LABEL(month)}</p>
        <button onClick={() => shift(1)} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Icon name="chevron" className="size-4" /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-slate-400">{["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />
          const info = counts[day]
          const isSelected = day === selected
          const past = day < today
          return (
            <button key={day} onClick={() => onSelect(day)} className={`relative flex h-11 flex-col items-center justify-center rounded-lg text-xs font-bold transition-colors ${isSelected ? "bg-navy-600 text-white" : day === today ? "bg-navy-50 text-navy-700 ring-1 ring-navy-300" : past ? "text-slate-400 hover:bg-slate-50" : "text-slate-700 hover:bg-slate-50"}`}>
              {Number(day.slice(8, 10))}
              {info && <span className={`mt-0.5 rounded-full px-1.5 text-[8px] font-extrabold ${isSelected ? "bg-white/20 text-white" : info.done === info.total ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{info.total}</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button onClick={() => { onSelect(today); onMonth(new Date()) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Hoy</button>
        <button onClick={() => { const next = addDays(today, 1); onSelect(next); onMonth(parseDay(next)) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Mañana</button>
        {undatedCount > 0 && <button onClick={() => onSelect("")} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${selected === "" ? "bg-navy-600 text-white" : "border border-orange-200 bg-orange-50 text-orange-700"}`}>Sin fecha · {undatedCount}</button>}
      </div>
      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
        <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-blue-500" />Contenedor 20'</p>
        <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-violet-600" />Servicio por San Antonio</p>
        <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-red-600" />Fecha de entrega</p>
        <p className="flex items-center gap-2"><span className="text-emerald-600 line-through decoration-2">abc</span>Finalizado</p>
      </div>
    </section>
  )
}

// ---------- Asignación por zona (LCL) ----------
const ZONES = ["Centro", "Centro sur", "Recoleta", "Peñalolén", "Pudahuel", "Quilicura", "Maipú", "San Bernardo", "Lo Espejo", "Las Condes", "Valparaíso", "San Antonio"]
type DriverOption = { id: string; full_name: string; current_fleet_id: string | null }
type VehicleOption = { id: string; plate: string; internal_code: string | null }

// Coordinación agrupa las cargas por comuna/zona, marca varias y las asigna en bloque a un camión y chofer.
// Al confirmar, cada carga queda como OT del chofer (Mis Viajes) con el resumen de pallets, kilos, m³, hora y retiro.
function ZoneAssignPanel({ services, drivers, vehicles, onAssign, onEdit }: {
  services: Service[]
  drivers: DriverOption[]
  vehicles: VehicleOption[]
  onAssign: (ids: string[], driver: DriverOption, vehicle: VehicleOption | null) => Promise<void>
  onEdit: (service: Service) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [driverId, setDriverId] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [assigning, setAssigning] = useState(false)
  const groups = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const service of services) {
      const zone = service.zone.trim() || "Sin zona"
      map.set(zone, [...(map.get(zone) || []), service])
    }
    return [...map.entries()].sort(([a], [b]) => (a === "Sin zona" ? 1 : b === "Sin zona" ? -1 : a.localeCompare(b)))
  }, [services])
  const picked = services.filter((service) => selected.has(service.id))
  const sum = (key: "weightKg" | "volumeCbm" | "pallets") => picked.reduce((total, service) => total + (toNumber(service[key]) || 0), 0)
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleZone = (list: Service[]) => setSelected((current) => {
    const next = new Set(current)
    const all = list.every((service) => next.has(service.id))
    list.forEach((service) => { if (all) next.delete(service.id); else next.add(service.id) })
    return next
  })
  const chooseDriver = (id: string) => {
    setDriverId(id)
    const fleetId = drivers.find((driver) => driver.id === id)?.current_fleet_id
    if (fleetId && vehicles.some((vehicle) => vehicle.id === fleetId)) setVehicleId(fleetId)
  }
  const assign = async () => {
    const driver = drivers.find((item) => item.id === driverId)
    if (!driver || !picked.length) return
    setAssigning(true)
    await onAssign(picked.map((service) => service.id), driver, vehicles.find((vehicle) => vehicle.id === vehicleId) || null)
    setAssigning(false)
    setSelected(new Set())
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Asignación por zona</p>
          <p className="text-[10px] text-slate-500">Marca las cargas de una misma ruta y asígnalas en bloque. Se envían solas a la cuenta del chofer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={driverId} onChange={(e) => chooseDriver(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="">Chofer…</option>
            {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
          </select>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="">Camión…</option>
            {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.internal_code, vehicle.plate].filter(Boolean).join(" · ")}</option>)}
          </select>
          <button disabled={!picked.length || !driverId || assigning} onClick={assign} className="h-9 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40">
            {assigning ? "Asignando…" : `Asignar ${picked.length || ""} y enviar al chofer`}
          </button>
        </div>
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-4 border-b border-slate-100 bg-teal-50 px-4 py-2 text-[11px] font-semibold text-teal-900">
          <span>{picked.length} cargas</span>
          <span>{sum("pallets").toLocaleString("es-CL")} pallets</span>
          <span>{sum("weightKg").toLocaleString("es-CL")} kg</span>
          <span>{sum("volumeCbm").toLocaleString("es-CL", { maximumFractionDigits: 2 })} m³</span>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-teal-700 hover:underline">Limpiar selección</button>
        </div>
      )}
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.length === 0 && <p className="text-xs text-slate-400">Sin cargas activas.</p>}
        {groups.map(([zone, list]) => (
          <div key={zone} className="rounded-lg border border-slate-200">
            <button onClick={() => toggleZone(list)} className="flex w-full items-center justify-between rounded-t-lg bg-slate-50 px-3 py-2 text-left">
              <span className="text-xs font-bold text-slate-800">{zone}</span>
              <span className="text-[10px] font-semibold text-slate-500">{list.length} · marcar todas</span>
            </button>
            <ul className="divide-y divide-slate-100">
              {list.map((service) => (
                <li key={service.id} className={`flex items-start gap-2 px-3 py-2 text-[11px] ${selected.has(service.id) ? "bg-teal-50" : ""}`}>
                  <input type="checkbox" checked={selected.has(service.id)} onChange={() => toggle(service.id)} className="mt-0.5 size-4 accent-teal-600" />
                  <button onClick={() => onEdit({ ...service })} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-bold text-slate-800">{service.forwarder || "Sin cliente"} <span className="font-normal text-slate-400">{service.time}</span></p>
                    <p className="truncate text-slate-500">{service.delivery || "Sin dirección de entrega"}</p>
                    <p className="truncate text-slate-400">{[service.pallets && `${service.pallets} pallets`, service.packages && `${service.packages} bultos`, service.weightKg && `${service.weightKg} kg`, service.volumeCbm && `${service.volumeCbm} m³`].filter(Boolean).join(" · ") || "—"}</p>
                    <p className={`truncate font-semibold ${service.driver ? "text-slate-700" : "text-orange-600"}`}>{service.driver ? `${service.driver}${service.plate ? ` · ${service.plate}` : ""}` : "Sin chofer"}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Formulario ----------
const editInput = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:border-navy-300 focus:ring-2 focus:ring-navy-100"
const fieldLabel = "mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500"

function EditServiceModal({ service, title, onChange, onClose, onSave, onDelete, drivers, plates, saving }: {
  service: Service
  title: string
  onChange: (service: Service) => void
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
  drivers: string[]
  plates: string[]
  saving: boolean
}) {
  const set = <K extends keyof Service>(key: K, value: Service[K]) => onChange({ ...service, [key]: value })
  const fcl = service.mode === "fcl"
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form onSubmit={(event) => { event.preventDefault(); onSave() }} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className={`flex items-center justify-between px-5 py-4 text-white ${TYPE_STYLE[service.type].header}`}>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">{title} · {fcl ? "FCL contenedores" : "LCL carga suelta"}</p>
            <p className="mt-1 text-base font-bold">{service.reference || "Nuevo servicio"}</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-xl leading-none hover:bg-white/20">×</button>
        </div>
        <datalist id="coord-drivers">{drivers.map((name) => <option key={name} value={name} />)}</datalist>
        <datalist id="coord-plates">{plates.map((plate) => <option key={plate} value={plate} />)}</datalist>
        <datalist id="coord-zones">{ZONES.map((zone) => <option key={zone} value={zone} />)}</datalist>
        <div className="max-h-[calc(92vh-128px)] space-y-5 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <label><span className={fieldLabel}>Operación</span><select className={editInput} value={service.type} onChange={(e) => set("type", e.target.value as ServiceType)}><option value="impo">Importación</option><option value="expo">Exportación</option></select></label>
            <label><span className={fieldLabel}>Tipo de carga</span><select className={editInput} value={service.mode} onChange={(e) => set("mode", e.target.value as CargoMode)}><option value="fcl">FCL · contenedor</option><option value="lcl">LCL · carga suelta</option></select></label>
            <label><span className={fieldLabel}>Fecha del servicio</span><input type="date" className={editInput} value={service.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} /></label>
            <label><span className={fieldLabel}>Hora de retiro</span><input type="time" className={editInput} value={service.time} onChange={(e) => set("time", e.target.value)} /></label>

            <label className="md:col-span-2"><span className={fieldLabel}>Cliente / Embarcador</span><input className={editInput} value={service.forwarder} onChange={(e) => set("forwarder", e.target.value)} placeholder="Kuehne + Nagel, Rapla..." required /></label>
            <label><span className={fieldLabel}>Cliente final</span><input className={editInput} value={service.finalClient} onChange={(e) => set("finalClient", e.target.value)} /></label>
            <label><span className={fieldLabel}>Referencia / BL</span><input className={`${editInput} font-mono`} value={service.reference} onChange={(e) => set("reference", e.target.value)} /></label>

            <label><span className={fieldLabel}>Naviera</span><input className={editInput} value={service.shippingLine} onChange={(e) => set("shippingLine", e.target.value)} placeholder="Maersk, MSC..." /></label>
            {fcl && <label><span className={fieldLabel}>N° contenedor</span><input className={`${editInput} font-mono uppercase`} value={service.containerNumber} onChange={(e) => set("containerNumber", e.target.value.toUpperCase())} placeholder="MSCU1234567" /></label>}
            {fcl && <label><span className={fieldLabel}>Medida</span><select className={editInput} value={service.containerSize} onChange={(e) => set("containerSize", e.target.value)}><option value="">—</option><option value="20">20'</option><option value="40">40'</option><option value="40HC">40' HC</option></select></label>}
            <label><span className={fieldLabel}>Estado</span><select className={editInput} value={service.status} onChange={(e) => set("status", e.target.value as ServiceStatus)}><option>Cotizado</option><option>Programado</option><option>En tránsito</option><option>Entregado</option></select></label>

            <label className="md:col-span-2"><span className={fieldLabel}>Tipo de mercancía</span><input className={editInput} value={service.cargo} onChange={(e) => set("cargo", e.target.value)} /></label>
            <label><span className={fieldLabel}>Cantidad de bultos</span><input className={editInput} value={service.packages} onChange={(e) => set("packages", e.target.value)} /></label>
            <label><span className={fieldLabel}>Dimensiones / peso</span><input className={editInput} value={service.dimensions} onChange={(e) => set("dimensions", e.target.value)} /></label>
            <label><span className={fieldLabel}>Pallets</span><input className={editInput} inputMode="numeric" value={service.pallets} onChange={(e) => set("pallets", e.target.value)} /></label>
            <label><span className={fieldLabel}>Peso (kg)</span><input className={editInput} inputMode="decimal" value={service.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></label>
            <label><span className={fieldLabel}>Volumen (m³)</span><input className={editInput} inputMode="decimal" value={service.volumeCbm} onChange={(e) => set("volumeCbm", e.target.value)} /></label>
            <label><span className={fieldLabel}>Zona / comuna de entrega</span><input className={editInput} list="coord-zones" value={service.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Recoleta, Peñalolén..." /></label>

            <label className="md:col-span-2"><span className={fieldLabel}>Lugar de retiro</span><input className={editInput} value={service.pickup} onChange={(e) => set("pickup", e.target.value)} placeholder="Depósito, puerto San Antonio..." /></label>
            <label className="md:col-span-2"><span className={fieldLabel}>Contacto de retiro</span><input className={editInput} value={service.pickupContact} onChange={(e) => set("pickupContact", e.target.value)} /></label>
            {[0, 1].map((index) => (
              <label key={index} className="md:col-span-2"><span className={fieldLabel}>Parada {index + 1} (opcional)</span><input className={editInput} value={service.stops[index] ?? ""} onChange={(e) => { const stops = [service.stops[0] ?? "", service.stops[1] ?? ""]; stops[index] = e.target.value; set("stops", stops[1] ? stops : stops[0] ? [stops[0]] : []) }} placeholder={index === 0 ? "Ruta de 3 puntos: retiro → parada → entrega" : "Ruta de 4 puntos: retiro → parada 1 → parada 2 → entrega"} /></label>
            ))}
            <label className="md:col-span-2"><span className={fieldLabel}>Dirección exacta de entrega</span><input className={editInput} value={service.delivery} onChange={(e) => set("delivery", e.target.value)} placeholder="Calle, número, comuna" /></label>
            <label><span className={fieldLabel}>Entregar a más tardar · fecha</span><input type="date" className={editInput} value={service.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} /></label>
            <label><span className={fieldLabel}>Entregar a más tardar · hora</span><input type="time" className={editInput} value={service.deliveryTime} onChange={(e) => set("deliveryTime", e.target.value)} /></label>
            <label><span className={fieldLabel}>Teléfono / contacto de entrega</span><input className={editInput} value={service.deliveryContact} onChange={(e) => set("deliveryContact", e.target.value)} placeholder="+56 9 ..." /></label>

            <label className="md:col-span-3 xl:col-span-4"><span className={fieldLabel}>Instrucciones especiales</span><input className={editInput} value={service.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Encarpar, llevar cadenas, llamar antes de llegar..." /></label>

            <label><span className={fieldLabel}>Conductor</span><input className={editInput} list="coord-drivers" value={service.driver} onChange={(e) => set("driver", e.target.value)} /></label>
            <label><span className={fieldLabel}>Camión (patente)</span><input className={`${editInput} font-mono uppercase`} list="coord-plates" value={service.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} /></label>
            <label><span className={fieldLabel}>Rampla (patente)</span><input className={`${editInput} font-mono uppercase`} list="coord-plates" value={service.trailer} onChange={(e) => set("trailer", e.target.value.toUpperCase())} /></label>
            <label className="flex items-end"><span className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={service.done} onChange={(e) => set("done", e.target.checked)} className="size-4 accent-emerald-600" />Servicio finalizado</span></label>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          {onDelete ? <button type="button" onClick={onDelete} className="h-9 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Eliminar servicio</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-navy-600 px-4 text-xs font-bold text-white hover:bg-navy-700 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ---------- Módulo ----------
const TAB_KEY = "vtm-coordination-tab"

export default function CoordinationBoard() {
  const [services, setServices] = useState<Service[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [mode, setMode] = useState<CargoMode>(() => { try { return (localStorage.getItem(TAB_KEY) as CargoMode) || "fcl" } catch { return "fcl" } })
  const [fclView, setFclView] = useState<"program" | "boards">("program")
  const [selectedDay, setSelectedDay] = useState(localDay())
  const [month, setMonth] = useState(() => new Date())
  const [search, setSearch] = useState("")
  const [showDoneLcl, setShowDoneLcl] = useState(false)
  const [editing, setEditing] = useState<{ service: Service; title: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [copyTarget, setCopyTarget] = useState<string | null>(null)
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [boardSave, setBoardSave] = useState<Record<string, string>>({})
  const [drivers, setDrivers] = useState<string[]>([])
  const [plates, setPlates] = useState<string[]>([])
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([])
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([])
  const saveTimers = useRef<Record<string, number>>({})
  const refetchTimer = useRef<number | undefined>(undefined)

  useEffect(() => { try { localStorage.setItem(TAB_KEY, mode) } catch { /* sin storage */ } }, [mode])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4000); return () => window.clearTimeout(timer) }, [toast])

  const fetchAll = useCallback(async () => {
    const [servicesResult, boardsResult] = await Promise.all([
      selectAll((from, to) => supabase.from("coordination_services").select("*").order("id").range(from, to)),
      supabase.from("coordination_boards").select("*").order("created_at"),
    ])
    const failure = servicesResult.error || boardsResult.error
    if (failure) setError(`No se pudo leer Coordinación: ${failure.message}. ¿Corriste la migración 20261119_coordination_fcl_lcl.sql?`)
    if (!servicesResult.error) {
      const list = (servicesResult.data || []).map(rowToService)
      // Servicios creados desde Nueva OT: el viaje del camionero manda el estado y el "finalizado"
      const orderIds = list.map((service) => service.orderId).filter(Boolean)
      const ordersResult = await selectIn(orderIds, (ids) => supabase.from("orders").select("id, status").in("id", ids))
      const tripById = new Map(((ordersResult.data || []) as { id: string; status: string }[]).map((order) => [order.id, order.status]))
      setServices(list.map((service) => {
        const tripStatus = tripById.get(service.orderId) || ""
        if (tripStatus === "completed") return { ...service, tripStatus, done: true, status: "Entregado" }
        if (tripStatus === "in_progress") return { ...service, tripStatus, status: "En tránsito" }
        return { ...service, tripStatus }
      }))
    }
    if (!boardsResult.error) setBoards((boardsResult.data || []).map(rowToBoard))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    Promise.all([
      supabase.from("drivers").select("id, full_name, current_fleet_id, is_active").order("full_name"),
      supabase.from("fleet").select("id, plate, internal_code").order("plate"),
    ]).then(([driversResult, fleetResult]) => {
      const driverRows = (driversResult.data || []) as (DriverOption & { is_active: boolean | null })[]
      const fleetRows = (fleetResult.data || []) as VehicleOption[]
      setDrivers(driverRows.map((row) => row.full_name))
      setPlates(fleetRows.map((row) => row.plate))
      setDriverOptions(driverRows.filter((row) => row.is_active !== false))
      setVehicleOptions(fleetRows)
    })
    // Servicios en tiempo real (Cristóbal y César ven los cambios del otro). Las pizarras abiertas no se recargan para no pisar el dibujo.
    const channel = supabase.channel("coordination-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "coordination_services" }, () => { window.clearTimeout(refetchTimer.current); refetchTimer.current = window.setTimeout(fetchAll, 300) })
      // Avance del camionero (orders.status) y OTs nuevas desde Nueva OT
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { window.clearTimeout(refetchTimer.current); refetchTimer.current = window.setTimeout(fetchAll, 300) })
      .subscribe()
    return () => { window.clearTimeout(refetchTimer.current); supabase.removeChannel(channel) }
  }, [fetchAll])

  const currentEmail = async () => (await supabase.auth.getSession()).data.session?.user.email ?? null

  // ---------- Servicios ----------
  const saveService = async (service: Service) => {
    setSaving(true)
    const row = serviceToRow(service)
    const { error: saveError } = service.id
      ? await supabase.from("coordination_services").update(row).eq("id", service.id)
      : await supabase.from("coordination_services").insert([row])
    setSaving(false)
    if (saveError) { setError(`No se pudo guardar el servicio: ${saveError.message}`); return }
    setEditing(null)
    if (service.mode !== mode) setMode(service.mode)
    if (service.mode === "fcl" && service.serviceDate !== selectedDay) setToast(`Servicio guardado para el ${formatLong(service.serviceDate)}`)
    await fetchAll()
  }

  const deleteService = async (service: Service) => {
    if (!window.confirm(`¿Eliminar el servicio ${service.reference || service.forwarder}? No se puede deshacer.`)) return
    const { error: deleteError } = await supabase.from("coordination_services").delete().eq("id", service.id)
    if (deleteError) { setError(`No se pudo eliminar: ${deleteError.message}`); return }
    setEditing(null)
    await fetchAll()
  }

  const toggleDone = async (service: Service) => {
    setServices((current) => current.map((item) => item.id === service.id ? { ...item, done: !item.done } : item))
    const { error: toggleError } = await supabase.from("coordination_services").update({ done: !service.done, updated_at: new Date().toISOString() }).eq("id", service.id)
    if (toggleError) { setError(`No se pudo actualizar: ${toggleError.message}`); await fetchAll() }
  }

  // Asignación en bloque: cada carga queda como OT del chofer (la ve en Mis Viajes con su resumen)
  const assignBulk = async (ids: string[], driver: DriverOption, vehicle: VehicleOption | null) => {
    const session = (await supabase.auth.getSession()).data.session
    const failures: string[] = []
    for (const [index, service] of services.filter((item) => ids.includes(item.id)).entries()) {
      let orderId = service.orderId
      if (orderId) {
        const { data: current } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle()
        const { error: orderError } = await supabase.from("orders").update({
          driver_id: driver.id, fleet_id: vehicle?.id ?? null, provider_id: null,
          ...(current?.status === "draft" ? { status: "pending" } : {}),
        }).eq("id", orderId)
        if (orderError) { failures.push(`${service.reference || service.forwarder}: ${orderError.message}`); continue }
      } else {
        const packages = parseInt(service.packages) || parseInt(service.pallets) || 0
        const { data: created, error: createError } = await supabase.from("orders").insert([{
          order_number: `OT-${Date.now()}${index}`,
          client_id: null,
          client_contact: service.forwarder || null,
          service_type: `${service.pickup || "Sin retiro"}/${service.delivery || "Sin entrega"}`,
          service_date: service.serviceDate || localDay(),
          quantity: packages,
          package_type: service.pallets ? "Pallets" : "Bultos",
          weight_kg: toNumber(service.weightKg) || 0,
          volume_cbm: toNumber(service.volumeCbm) || 0,
          container_number: service.containerNumber || null,
          cargo_mode: service.mode,
          operation_type: service.type,
          description: [service.cargo, service.instructions].filter(Boolean).join(" · ") || null,
          origin: service.pickup || "Sin retiro",
          destination: service.delivery || "Sin entrega",
          is_inside_triangle: true,
          sold_value: 0, purchased_value: 0, profit: 0,
          status: "pending", priority: "normal",
          request_kind: "tarifado",
          client_status: "Carga en bodega de despacho",
          created_by: session?.user?.id ?? null,
          driver_id: driver.id,
          fleet_id: vehicle?.id ?? null,
        }]).select("id").single()
        if (createError || !created) { failures.push(`${service.reference || service.forwarder}: ${createError?.message || "sin respuesta"}`); continue }
        orderId = created.id
      }
      const { error: serviceError } = await supabase.from("coordination_services").update({
        driver: driver.full_name, plate: vehicle?.plate || service.plate, order_id: orderId,
        updated: new Date().toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        updated_at: new Date().toISOString(),
      }).eq("id", service.id)
      if (serviceError) failures.push(`${service.reference || service.forwarder}: ${serviceError.message}`)
    }
    if (vehicle) await supabase.from("fleet").update({ status: "in_route" }).eq("id", vehicle.id)
    if (failures.length) setError(`No se pudieron asignar: ${failures.join(" | ")}`)
    const ok = ids.length - failures.length
    if (ok > 0) setToast(`${ok} cargas asignadas a ${driver.full_name}${vehicle ? ` · ${vehicle.internal_code || vehicle.plate}` : ""}. Ya están en Mis Viajes del chofer.`)
    await fetchAll()
  }

  // Duplicar = plantilla: copia la base del servicio a otra fecha y solo se editan los datos variables
  const duplicate = (service: Service) => setEditing({
    title: "Duplicar servicio",
    service: { ...service, id: "", orderId: "", tripStatus: "", done: false, status: "Programado", serviceDate: service.mode === "fcl" ? addDays(service.serviceDate || localDay(), 1) : service.serviceDate, containerNumber: "", updated: "" },
  })

  const copyDay = async (from: string, to: string, list: Service[]) => {
    if (!to || !list.length) return
    const rows = list.map((service) => serviceToRow({ ...service, id: "", orderId: "", tripStatus: "", serviceDate: to, done: false, status: "Programado", containerNumber: "" }))
    const { error: copyError } = await supabase.from("coordination_services").insert(rows)
    if (copyError) { setError(`No se pudo copiar el día: ${copyError.message}`); return }
    setCopyTarget(null)
    setToast(`${rows.length} servicios copiados de ${formatShort(from)} al ${formatLong(to)}`)
    setSelectedDay(to)
    setMonth(parseDay(to))
    await fetchAll()
  }

  // ---------- Pizarras ----------
  const scheduleBoardSave = (boardId: string, data: BoardData) => {
    setBoardSave((current) => ({ ...current, [boardId]: "Guardando…" }))
    window.clearTimeout(saveTimers.current[boardId])
    saveTimers.current[boardId] = window.setTimeout(async () => {
      const { error: saveError } = await supabase.from("coordination_boards").update({ data, updated_by: await currentEmail(), updated_at: new Date().toISOString() }).eq("id", boardId)
      setBoardSave((current) => ({ ...current, [boardId]: saveError ? "Error al guardar" : "Guardado" }))
      if (saveError) setError(`No se pudo guardar la pizarra: ${saveError.message}`)
      else setBoards((current) => current.map((board) => board.id === boardId ? { ...board, data } : board))
    }, 800)
  }

  const createBoard = async (boardMode: CargoMode, boardDate: string | null, name: string) => {
    const { data, error: createError } = await supabase.from("coordination_boards").insert({ cargo_mode: boardMode, board_date: boardDate, name, data: emptyBoardData(), updated_by: await currentEmail() }).select().single()
    if (createError) { setError(`No se pudo crear la pizarra: ${createError.message}`); return null }
    const board = rowToBoard(data)
    setBoards((current) => [...current, board])
    setActiveBoardId(board.id)
    return board
  }

  const renameBoard = async (board: Board) => {
    const name = window.prompt("Nombre de la pizarra", board.name)?.trim()
    if (!name || name === board.name) return
    const { error: renameError } = await supabase.from("coordination_boards").update({ name }).eq("id", board.id)
    if (renameError) { setError(`No se pudo renombrar: ${renameError.message}`); return }
    setBoards((current) => current.map((item) => item.id === board.id ? { ...item, name } : item))
  }

  const deleteBoard = async (board: Board) => {
    if (!window.confirm(`¿Eliminar la pizarra "${board.name}"? Se pierden sus trazos y notas.`)) return
    const { error: deleteError } = await supabase.from("coordination_boards").delete().eq("id", board.id)
    if (deleteError) { setError(`No se pudo eliminar la pizarra: ${deleteError.message}`); return }
    setBoards((current) => current.filter((item) => item.id !== board.id))
    setActiveBoardId(null)
  }

  // ---------- Vistas ----------
  const query = search.trim().toLowerCase()
  const matches = (service: Service) => !query || [service.reference, service.forwarder, service.finalClient, service.containerNumber, service.shippingLine, service.pickup, ...service.stops, service.delivery, service.driver, service.cargo, service.zone].join(" ").toLowerCase().includes(query)
  const fclServices = useMemo(() => services.filter((service) => service.mode === "fcl"), [services])
  const lclServices = useMemo(() => services.filter((service) => service.mode === "lcl"), [services])
  const counts = useMemo(() => {
    const result: Record<string, { total: number; done: number }> = {}
    for (const service of fclServices) {
      if (!service.serviceDate) continue
      const entry = (result[service.serviceDate] ||= { total: 0, done: 0 })
      entry.total += 1
      if (service.done) entry.done += 1
    }
    return result
  }, [fclServices])
  const undatedCount = fclServices.filter((service) => !service.serviceDate).length
  const dayServices = sortServices(fclServices.filter((service) => service.serviceDate === selectedDay && matches(service)))
  // Con búsqueda: resultados de todas las fechas (futuro e historial)
  const searchResults = query ? sortServices(fclServices.filter(matches)) : []
  const lclActive = sortServices(lclServices.filter((service) => !service.done))
  const lclVisible = sortServices(lclServices.filter((service) => (showDoneLcl || !service.done) && matches(service)))
  const dayBoards = boards.filter((board) => board.mode === "fcl" && board.boardDate === (selectedDay || null))
  const activeBoard = dayBoards.find((board) => board.id === activeBoardId) ?? dayBoards[0]
  const lclBoard = boards.find((board) => board.mode === "lcl")

  // LCL: pizarra única, se crea sola la primera vez
  const creatingLcl = useRef(false)
  useEffect(() => {
    if (loading || error || mode !== "lcl" || lclBoard || creatingLcl.current) return
    creatingLcl.current = true
    createBoard("lcl", null, "Pizarra LCL").finally(() => { creatingLcl.current = false })
  }, [loading, error, mode, lclBoard])

  const exportImage = async (title: string, subtitle: string, list: Service[], fileName: string) => setToast(await shareCanvas(drawProgramImage(title, subtitle, list), fileName))

  if (loading) return <div className="flex h-96 items-center justify-center text-sm text-slate-400">Cargando coordinación…</div>

  const fclTitle = selectedDay ? formatLong(selectedDay) : "Servicios sin fecha"
  const toolbarButton = "flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500"><span>Operaciones</span><span className="text-slate-300">/</span><span>Coordinación</span></div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Programación y pizarras</h1>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {([{ id: "fcl", label: "FCL · Contenedores", sub: "Programación por fecha", count: fclServices.filter((s) => s.serviceDate >= localDay() && !s.done).length }, { id: "lcl", label: "LCL · Carga suelta", sub: "Pizarra diaria", count: lclActive.length }] as const).map((tab) => (
              <button key={tab.id} onClick={() => setMode(tab.id)} className={`rounded-md px-4 py-1.5 text-left transition-all ${mode === tab.id ? "bg-navy-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
                <span className="flex items-center gap-2 text-xs font-bold">{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${mode === tab.id ? "bg-white/20" : "bg-slate-100"}`}>{tab.count}</span></span>
                <span className={`block text-[9px] ${mode === tab.id ? "text-white/70" : "text-slate-400"}`}>{tab.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        {error && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[11px] font-semibold text-red-700"><span>{error}</span><button onClick={() => setError(null)} className="text-base">×</button></div>}
        {toast && <div className="fixed bottom-5 right-5 z-[1000] rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}

        {mode === "fcl" && (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <MonthCalendar month={month} onMonth={setMonth} selected={selectedDay} onSelect={(day) => { setSelectedDay(day); setActiveBoardId(null) }} counts={counts} undatedCount={undatedCount} />
            </aside>

            <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{selectedDay && selectedDay < localDay() ? "Historial" : "Programación FCL"}</p>
                  <p className="text-base font-bold text-slate-900">{fclTitle}</p>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-1">
                  <button onClick={() => setFclView("program")} className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold ${fclView === "program" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}><Icon name="list" className="size-3.5" />Programación</button>
                  <button onClick={() => setFclView("boards")} className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold ${fclView === "boards" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}><Icon name="board" className="size-3.5" />Pizarras {dayBoards.length > 0 && `· ${dayBoards.length}`}</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setEditing({ title: "Nuevo servicio", service: newService("fcl", selectedDay) })} className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-navy-700"><span className="text-base leading-none">+</span>Nuevo servicio</button>
                  {copyTarget === null
                    ? <button disabled={!dayServices.length || !selectedDay} onClick={() => setCopyTarget(addDays(selectedDay, 1))} className={`${toolbarButton} disabled:opacity-40`}><Icon name="copy" className="size-3.5" />Copiar día a…</button>
                    : <span className="flex items-center gap-1 rounded-lg border border-navy-200 bg-navy-50 p-1"><input type="date" value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)} className="h-7 rounded border border-slate-200 px-2 text-xs" /><button onClick={() => copyDay(selectedDay, copyTarget, dayServices)} className="h-7 rounded bg-navy-600 px-2 text-[11px] font-bold text-white">Copiar {dayServices.length}</button><button onClick={() => setCopyTarget(null)} className="h-7 px-2 text-sm text-slate-400">×</button></span>}
                  <button disabled={!dayServices.length} onClick={() => exportExcel(dayServices, `programacion-fcl-${selectedDay || "sin-fecha"}.xlsx`)} className={`${toolbarButton} disabled:opacity-40`}><Icon name="download" className="size-3.5" />Excel</button>
                  <button onClick={() => exportImage("Programación FCL", fclTitle, dayServices, `programacion-fcl-${selectedDay || "sin-fecha"}.png`)} className={toolbarButton}><Icon name="image" className="size-3.5" />Imagen WhatsApp</button>
                </div>
              </div>

              <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-slate-400 shadow-sm"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en todas las fechas: cliente, contenedor, referencia, conductor…" className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label>

              {query ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-slate-500">{searchResults.length} resultados en todas las fechas</p>
                  {searchResults.map((service) => (
                    <div key={service.id}>
                      <button onClick={() => { setSearch(""); setSelectedDay(service.serviceDate); if (service.serviceDate) setMonth(parseDay(service.serviceDate)) }} className="mb-1 text-[10px] font-bold text-navy-600 hover:underline">{formatLong(service.serviceDate)} →</button>
                      <ProgramCard service={service} onEdit={() => setEditing({ title: "Editar servicio", service: { ...service } })} onDuplicate={() => duplicate(service)} onToggleDone={() => toggleDone(service)} />
                    </div>
                  ))}
                </div>
              ) : fclView === "program" ? (
                <div className="space-y-3">
                  {dayServices.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <p className="text-sm font-bold text-slate-700">Sin servicios este día</p>
                      <p className="mt-1 text-xs text-slate-500">Crea uno nuevo o duplica un servicio de otra fecha (usa el buscador para encontrarlo).</p>
                    </div>
                  )}
                  {dayServices.map((service) => <ProgramCard key={service.id} service={service} onEdit={() => setEditing({ title: "Editar servicio", service: { ...service } })} onDuplicate={() => duplicate(service)} onToggleDone={() => toggleDone(service)} />)}
                  {dayServices.length > 0 && <p className="text-right text-[10px] text-slate-400">{dayServices.filter((s) => s.done).length} de {dayServices.length} finalizados · {dayServices.filter((s) => !s.driver).length} sin conductor</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {dayBoards.map((board) => (
                      <span key={board.id} className={`flex items-center rounded-lg border ${activeBoard?.id === board.id ? "border-navy-300 bg-navy-50" : "border-slate-200 bg-white"}`}>
                        <button onClick={() => setActiveBoardId(board.id)} className="px-3 py-1.5 text-xs font-bold text-slate-700">{board.name}</button>
                        {activeBoard?.id === board.id && <><button onClick={() => renameBoard(board)} className="px-1.5 text-[10px] font-semibold text-slate-500 hover:text-navy-700">Renombrar</button><button onClick={() => deleteBoard(board)} className="px-2 text-sm text-slate-400 hover:text-red-600">×</button></>}
                      </span>
                    ))}
                    <button onClick={() => { const name = window.prompt("Nombre de la nueva pizarra", `Pizarra ${dayBoards.length + 1}`)?.trim(); if (name) createBoard("fcl", selectedDay || null, name) }} className="rounded-lg border border-dashed border-navy-300 px-3 py-1.5 text-xs font-bold text-navy-600 hover:bg-navy-50">+ Nueva pizarra</button>
                  </div>
                  {activeBoard ? (
                    <Whiteboard
                      key={activeBoard.id}
                      title={`${activeBoard.name} · ${fclTitle}`}
                      services={sortServices(fclServices.filter((service) => service.serviceDate === selectedDay))}
                      initialData={activeBoard.data}
                      onDataChange={(data) => scheduleBoardSave(activeBoard.id, data)}
                      onEdit={(service) => setEditing({ title: "Editar servicio", service })}
                      onToggleDone={toggleDone}
                      saveLabel={boardSave[activeBoard.id] ?? `Guardado${activeBoard.updatedBy ? ` · ${activeBoard.updatedBy}` : ""}`}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <p className="text-sm font-bold text-slate-700">Este día no tiene pizarras</p>
                      <p className="mt-1 text-xs text-slate-500">Crea una para dibujar, anotar y ordenar los servicios del día.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {mode === "lcl" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">LCL · trabajo diario</p>
                <p className="text-base font-bold text-slate-900">{lclActive.length} servicios activos</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setEditing({ title: "Nuevo servicio", service: newService("lcl", localDay()) })} className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-navy-700"><span className="text-base leading-none">+</span>Nuevo servicio LCL</button>
                <button disabled={!lclActive.length} onClick={() => exportExcel(lclActive, `servicios-lcl-${localDay()}.xlsx`)} className={`${toolbarButton} disabled:opacity-40`}><Icon name="download" className="size-3.5" />Excel</button>
                <button onClick={() => exportImage("Carga suelta (LCL)", formatLong(localDay()), lclActive, `servicios-lcl-${localDay()}.png`)} className={toolbarButton}><Icon name="image" className="size-3.5" />Imagen WhatsApp</button>
              </div>
            </div>

            <ZoneAssignPanel services={lclActive} drivers={driverOptions} vehicles={vehicleOptions} onAssign={assignBulk} onEdit={(service) => setEditing({ title: "Editar servicio", service })} />

            {lclBoard ? (
              <Whiteboard
                key={lclBoard.id}
                title="Pizarra LCL"
                services={lclActive}
                initialData={lclBoard.data}
                onDataChange={(data) => scheduleBoardSave(lclBoard.id, data)}
                onEdit={(service) => setEditing({ title: "Editar servicio", service })}
                onToggleDone={toggleDone}
                saveLabel={boardSave[lclBoard.id] ?? `Guardado${lclBoard.updatedBy ? ` · ${lclBoard.updatedBy}` : ""}`}
              />
            ) : <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">Preparando la pizarra LCL…</div>}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900">Servicios LCL</p>
                <div className="flex items-center gap-3">
                  <label className="flex h-9 min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label>
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={showDoneLcl} onChange={(e) => setShowDoneLcl(e.target.checked)} className="accent-navy-600" />Ver finalizados</label>
                </div>
              </div>
              {lclVisible.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Sin servicios LCL.</div>}
              {lclVisible.map((service) => <ProgramCard key={service.id} service={service} onEdit={() => setEditing({ title: "Editar servicio", service: { ...service } })} onDuplicate={() => duplicate(service)} onToggleDone={() => toggleDone(service)} />)}
            </section>
          </div>
        )}
      </main>

      {editing && (
        <EditServiceModal
          service={editing.service}
          title={editing.title}
          onChange={(service) => setEditing({ ...editing, service })}
          onClose={() => setEditing(null)}
          onSave={() => saveService(editing.service)}
          onDelete={editing.service.id ? () => deleteService(editing.service) : undefined}
          drivers={drivers}
          plates={plates}
          saving={saving}
        />
      )}
    </div>
  )
}
