// src/components/TablaCoordinacion.tsx
import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../lib/supabase" 

type ServiceType = "expo" | "impo"
type ServiceStatus = "Cotizado" | "Programado" | "En tránsito" | "Entregado"
type TimeScope = "today" | "tomorrow" | "month" | "previous"
type BoardTool = "pen" | "marker" | "eraser"
type PenColor = "black" | "blue" | "red"
type Point = { x: number; y: number }
type Stroke = { tool: BoardTool; color: PenColor; points: Point[] }
type BoardNote = { id: number; x: number; y: number; text: string; tone: "yellow" | "blue" | "green" }

type Service = {
  id: string
  type: ServiceType
  scope: TimeScope
  date: string
  time: string
  forwarder: string
  finalClient: string
  reference: string
  cargo: string
  dimensions: string
  stackable: boolean
  stacking: string
  stackingTone: "urgent" | "warning" | "safe" | "done"
  pickup: string
  pickupContact: string
  delivery: string
  deliveryContact: string
  driver: string
  plate: string
  status: ServiceStatus
  source: string
  updated: string
}

type IconName =
  | "alert"
  | "arrow"
  | "board"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "download"
  | "mail"
  | "map"
  | "package"
  | "search"
  | "truck"
  | "user"

const iconPaths: Record<IconName, string[]> = {
  alert: ["M12 9v4m0 4h.01", "M10.3 3.7 2.2 17h19L13.7 3.7a2 2 0 0 0-3.4 0z"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  board: ["M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M8 2v4m8-4v4M3 9h18"],
  calendar: ["M6 2v4m12-4v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z"],
  check: ["m5 12 4 4L19 6"],
  chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  download: ["M12 3v12m0 0 4-4m-4 4-4-4", "M5 20h14"],
  mail: ["M3 7l9 6 9-6", "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"],
  map: ["M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12z", "M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  package: ["M21 8 12 3 3 8l9 5 9-5z", "M3 8v8l9 5 9-5V8M12 13v8"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  truck: ["M3 6h11v10H3zM14 9h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
}

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {iconPaths[name].map((path, index) => (
        <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

// Datos de respaldo por si la base de datos está vacía
const fallbackServices: Service[] = [] 

const statusStyles: Record<ServiceStatus, string> = {
  Cotizado: "bg-slate-100 text-slate-600 ring-slate-200",
  Programado: "bg-blue-50 text-blue-700 ring-blue-200",
  "En tránsito": "bg-orange-50 text-orange-700 ring-orange-200",
  Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

const stackingStyles: Record<Service["stackingTone"], string> = {
  urgent: "bg-red-50 text-red-700 ring-red-200",
  warning: "bg-orange-50 text-orange-700 ring-orange-200",
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  done: "bg-slate-100 text-slate-600 ring-slate-200",
}

function exportCsv(rows: Service[]) {
  const header = ["Tipo", "Fecha", "Hora", "Forwarder", "Cliente final", "Referencia", "Carga", "Dimensiones", "Apilable", "Stacking", "Retiro", "Entrega", "Conductor", "Patente", "Estado"]
  const data = rows.map((service) => [
    service.type === "expo" ? "Exportación" : "Importación", service.date, service.time, service.forwarder, service.finalClient, service.reference,
    service.cargo, service.dimensions, service.stackable ? "Sí" : "No", service.stacking, service.pickup, service.delivery, service.driver, service.plate, service.status,
  ])
  const csv = [header, ...data].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\n")
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "pizarra-depositos-vtm.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles[status]}`}>{status}</span>
}

const noteStyles: Record<BoardNote["tone"], string> = {
  yellow: "border-amber-200 bg-amber-50 text-amber-950",
  blue: "border-blue-200 bg-blue-50 text-blue-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-950",
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, scaleX = 1, scaleY = 1) {
  if (stroke.points.length < 2) return
  context.beginPath()
  context.lineCap = "round"
  context.lineJoin = "round"
  const penColors: Record<PenColor, string> = { black: "#0f172a", blue: "#1e4278", red: "#dc2626" }
  context.strokeStyle = stroke.tool === "pen" ? penColors[stroke.color] : stroke.tool === "marker" ? "rgba(250, 204, 21, 0.48)" : "#ffffff"
  context.lineWidth = stroke.tool === "pen" ? 3 : stroke.tool === "marker" ? 14 : 28
  context.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY)
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x * scaleX, point.y * scaleY))
  context.stroke()
}

// ✅ Helpers de Base de Datos
function rowToService(row: any): Service {
  return {
    id: row.id,
    type: row.type as ServiceType,
    scope: row.scope as TimeScope,
    date: row.date,
    time: row.time,
    forwarder: row.forwarder,
    finalClient: row.final_client,
    reference: row.reference,
    cargo: row.cargo,
    dimensions: row.dimensions || "",
    stackable: row.stackable,
    stacking: row.stacking || "",
    stackingTone: row.stacking_tone as Service["stackingTone"],
    pickup: row.pickup,
    pickupContact: row.pickup_contact || "",
    delivery: row.delivery,
    deliveryContact: row.delivery_contact || "",
    driver: row.driver || "",
    plate: row.plate || "",
    status: row.status as ServiceStatus,
    source: row.source || "",
    updated: row.updated || "",
  }
}

function serviceToRow(service: Service): any {
  return {
    type: service.type,
    scope: service.scope,
    date: service.date,
    time: service.time,
    forwarder: service.forwarder,
    final_client: service.finalClient,
    reference: service.reference,
    cargo: service.cargo,
    dimensions: service.dimensions,
    stackable: service.stackable,
    stacking: service.stacking,
    stacking_tone: service.stackingTone,
    pickup: service.pickup,
    pickup_contact: service.pickupContact,
    delivery: service.delivery,
    delivery_contact: service.deliveryContact,
    driver: service.driver,
    plate: service.plate,
    status: service.status,
    source: service.source,
    updated: service.updated,
  }
}

function Whiteboard({ operations, onEdit }: { operations: Service[]; onEdit: (service: Service) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const operationDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [tool, setTool] = useState<BoardTool>("pen")
  const [penColor, setPenColor] = useState<PenColor>("blue")
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [operationPositions, setOperationPositions] = useState<Record<string, Point>>(() =>
    Object.fromEntries(operations.map((service, index) => [service.id, { x: 24 + (index % 3) * 324, y: 24 + Math.floor(index / 3) * 286 }])),
  )
  const [notes, setNotes] = useState<BoardNote[]>([
    { id: 1, x: 42, y: 650, text: "Prioridad del día\nConfirmar ingreso ZEAL antes de las 17:00.", tone: "yellow" },
    { id: 2, x: 330, y: 690, text: "Pendiente\nAsignar conductor a exportación 3M.", tone: "blue" },
  ])

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    strokes.forEach((stroke) => drawStroke(context, stroke))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const board = boardRef.current
    if (!canvas || !board) return
    const resize = () => {
      canvas.width = board.clientWidth
      canvas.height = board.clientHeight
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(board)
    return () => observer.disconnect()
  }, [strokes])

  useEffect(redraw, [strokes])

  useEffect(() => {
    setOperationPositions((current) => {
      const next = { ...current }
      operations.forEach((service, index) => {
        if (!next[service.id]) next[service.id] = { x: 24 + (index % 3) * 324, y: 24 + Math.floor(index / 3) * 286 }
      })
      return next
    })
  }, [operations])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const addNote = () => {
    const tone = (["yellow", "blue", "green"] as const)[notes.length % 3]
    setNotes((current) => [...current, { id: Date.now(), x: 60 + (current.length % 3) * 44, y: 70 + (current.length % 4) * 38, text: "Escribe una nota...", tone }])
  }

  const exportBoard = () => {
    const board = boardRef.current
    if (!board) return
    const output = document.createElement("canvas")
    output.width = board.clientWidth * 2
    output.height = board.clientHeight * 2
    const context = output.getContext("2d")
    if (!context) return
    context.scale(2, 2)
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, board.clientWidth, board.clientHeight)
    context.strokeStyle = "#e2e8f0"
    context.lineWidth = 0.5
    for (let x = 24; x < board.clientWidth; x += 24) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, board.clientHeight); context.stroke()
    }
    for (let y = 24; y < board.clientHeight; y += 24) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(board.clientWidth, y); context.stroke()
    }
    strokes.forEach((stroke) => drawStroke(context, stroke))
    operations.forEach((service, index) => {
      const position = operationPositions[service.id] ?? { x: 24 + (index % 3) * 324, y: 24 + Math.floor(index / 3) * 286 }
      const { x, y } = position
      const accent = service.type === "expo" ? "#ef4444" : "#2563eb"
      context.fillStyle = "#ffffff"
      context.strokeStyle = "#cbd5e1"
      context.lineWidth = 1
      context.fillRect(x, y, 300, 262)
      context.strokeRect(x, y, 300, 262)
      context.fillStyle = accent
      context.fillRect(x, y, 300, 38)
      context.fillStyle = "#ffffff"
      context.font = "700 11px Inter, sans-serif"
      context.fillText(`${service.type === "expo" ? "EXPORTACIÓN" : "IMPORTACIÓN"} · ${service.reference}`, x + 12, y + 24)
      const rows = [
        ["VENTANA", `${service.date} · ${service.time}`],
        ["CLIENTE / FORWARDER", `${service.forwarder} · ${service.finalClient}`],
        ["DETALLE DE CARGA", service.cargo],
        ["MEDIDAS", `${service.dimensions} · ${service.stackable ? "Apilable" : "No apilable"}`],
        ["RETIRO → ENTREGA", `${service.pickup} → ${service.delivery}`],
        ["STACKING / PLAZO", service.stacking],
        ["CONDUCTOR", `${service.driver} · ${service.plate}`],
        ["ESTADO", service.status],
      ]
      rows.forEach(([label, value], rowIndex) => {
        const rowY = y + 57 + rowIndex * 24
        context.fillStyle = "#94a3b8"
        context.font = "700 7px Inter, sans-serif"
        context.fillText(label, x + 12, rowY)
        context.fillStyle = "#1e293b"
        context.font = "600 9px Inter, sans-serif"
        context.fillText(value.slice(0, 45), x + 104, rowY)
      })
    })
    const noteColors = {
      yellow: { fill: "#fffbeb", border: "#fde68a", text: "#451a03" },
      blue: { fill: "#eff6ff", border: "#bfdbfe", text: "#172554" },
      green: { fill: "#ecfdf5", border: "#a7f3d0", text: "#022c22" },
    }
    notes.forEach((note) => {
      const colors = noteColors[note.tone]
      context.fillStyle = colors.fill
      context.strokeStyle = colors.border
      context.lineWidth = 1
      context.fillRect(note.x, note.y, 220, 118)
      context.strokeRect(note.x, note.y, 220, 118)
      context.fillStyle = colors.text
      context.font = "600 12px Inter, sans-serif"
      note.text.split("\n").forEach((line, index) => context.fillText(line.slice(0, 31), note.x + 14, note.y + 30 + index * 20))
    })
    const anchor = document.createElement("a")
    anchor.href = output.toDataURL("image/png")
    anchor.download = `pizarra-vtm-${new Date().toISOString().slice(0, 10)}.png`
    anchor.click()
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {([
            { id: "pen", label: "Lápiz", symbol: "⌁" },
            { id: "marker", label: "Destacador", symbol: "▰" },
            { id: "eraser", label: "Borrador", symbol: "◇" },
          ] as const).map((item) => (
            <button key={item.id} onClick={() => setTool(item.id)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition-all ${tool === item.id ? "bg-white text-navy-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
              <span className="text-sm">{item.symbol}</span>{item.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5 px-2">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Lápiz</span>
            {([
              { id: "black", label: "Negro", tone: "bg-slate-900" },
              { id: "blue", label: "Azul", tone: "bg-navy-600" },
              { id: "red", label: "Rojo", tone: "bg-red-600" },
            ] as const).map((color) => (
              <button
                key={color.id}
                onClick={() => { setPenColor(color.id); setTool("pen") }}
                className={`flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110 ${penColor === color.id && tool === "pen" ? "ring-2 ring-navy-300 ring-offset-2" : ""}`}
                title={`Lápiz ${color.label.toLowerCase()}`}
                aria-label={`Usar lápiz color ${color.label.toLowerCase()}`}
              >
                <span className={`size-3.5 rounded-full ${color.tone}`} />
              </button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-slate-300" />
          <button onClick={addNote} className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-navy-700">
            <span className="text-base leading-none">T</span> Cuadro de texto
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={strokes.length === 0} className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40">Deshacer</button>
          <button onClick={() => { setStrokes([]); setNotes([]) }} className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-red-600 hover:bg-red-50">Limpiar</button>
          <button onClick={exportBoard} className="flex h-8 items-center gap-2 rounded-lg bg-navy-600 px-3 text-[11px] font-semibold text-white hover:bg-navy-700"><Icon name="download" className="size-3.5" />Exportar PNG</button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2">
        <p className="text-[10px] text-slate-500">Dibuja directamente sobre el lienzo. Arrastra las notas desde su franja superior.</p>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Lienzo operativo · 24 px</p>
      </div>

      <div
        ref={boardRef}
        className="relative h-[940px] overflow-hidden bg-white"
        style={{ backgroundImage: "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          const operationDrag = operationDragRef.current
          const board = boardRef.current
          if (!board) return
          const rect = board.getBoundingClientRect()
          if (drag) {
            setNotes((current) => current.map((note) => note.id === drag.id ? { ...note, x: Math.max(0, Math.min(event.clientX - rect.left - drag.offsetX, rect.width - 220)), y: Math.max(0, Math.min(event.clientY - rect.top - drag.offsetY, rect.height - 118)) } : note))
          }
          if (operationDrag) {
            setOperationPositions((current) => ({
              ...current,
              [operationDrag.id]: {
                x: Math.max(0, Math.min(event.clientX - rect.left - operationDrag.offsetX, rect.width - 300)),
                y: Math.max(0, Math.min(event.clientY - rect.top - operationDrag.offsetY, rect.height - 262)),
              },
            }))
          }
        }}
        onPointerUp={() => { dragRef.current = null; operationDragRef.current = null }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none cursor-crosshair"
          onPointerDown={(event) => {
            const point = pointFromEvent(event)
            drawingRef.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setStrokes((current) => [...current, { tool, color: penColor, points: [point] }])
          }}
          onPointerMove={(event) => {
            if (!drawingRef.current) return
            const point = pointFromEvent(event)
            setStrokes((current) => current.map((stroke, index) => index === current.length - 1 ? { ...stroke, points: [...stroke.points, point] } : stroke))
          }}
          onPointerUp={() => { drawingRef.current = false }}
          onPointerCancel={() => { drawingRef.current = false }}
        />
        {operations.map((service, index) => (
          <article
            key={service.id}
            className="absolute z-10 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
            style={{
              left: operationPositions[service.id]?.x ?? 24 + (index % 3) * 324,
              top: operationPositions[service.id]?.y ?? 24 + Math.floor(index / 3) * 286,
            }}
          >
            <div
              className={`flex h-10 cursor-move touch-none items-center justify-between gap-2 px-3 text-white ${service.type === "expo" ? "bg-red-500" : "bg-blue-600"}`}
              onPointerDown={(event) => {
                const rect = event.currentTarget.parentElement?.getBoundingClientRect()
                if (!rect) return
                operationDragRef.current = { id: service.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
            >
              <div className="flex items-center gap-2">
                <Icon name="package" className="size-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">{service.type === "expo" ? "Exportación" : "Importación"}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[9px] font-bold">{service.reference}</span>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onEdit({ ...service })}
                  className="rounded-md bg-white/15 px-2 py-1 text-[8px] font-bold uppercase tracking-wider hover:bg-white/25"
                  aria-label={`Editar servicio ${service.reference}`}
                >
                  Editar
                </button>
              </div>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2.5">
                <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Ventana</p><p className="mt-0.5 text-[10px] font-bold text-slate-800">{service.date} · {service.time}</p></div>
                <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Estado</p><div className="mt-1"><StatusBadge status={service.status} /></div></div>
              </div>
              <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Cliente / Forwarder</p><p className="mt-0.5 truncate text-[10px] font-bold text-slate-800">{service.forwarder} <span className="font-medium text-slate-400">/</span> {service.finalClient}</p></div>
              <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Detalle de carga</p><p className="mt-0.5 truncate text-[10px] font-semibold text-slate-700">{service.cargo}</p><p className="mt-0.5 truncate text-[9px] text-slate-400">{service.dimensions} · <span className={service.stackable ? "text-emerald-600" : "font-semibold text-red-600"}>{service.stackable ? "Apilable" : "No apilable"}</span></p></div>
              <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Retiro → Entrega</p><p className="mt-0.5 truncate text-[9px] font-semibold text-slate-700">{service.pickup}</p><p className="mt-0.5 truncate text-[9px] text-slate-500">→ {service.delivery}</p></div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Stacking / Plazo</p><p className={`mt-0.5 truncate text-[9px] font-bold ${service.stackingTone === "urgent" ? "text-red-600" : "text-slate-700"}`}>{service.stacking}</p></div>
                <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Conductor</p><p className="mt-0.5 truncate text-[9px] font-bold text-slate-700">{service.driver}</p><p className="font-mono text-[8px] text-slate-400">{service.plate}</p></div>
              </div>
            </div>
          </article>
        ))}
        {notes.map((note) => (
          <article key={note.id} className={`absolute z-10 w-56 overflow-hidden rounded-lg border shadow-md ${noteStyles[note.tone]}`} style={{ left: note.x, top: note.y }}>
            <div
              className="flex h-7 cursor-move items-center justify-between border-b border-black/5 px-2"
              onPointerDown={(event) => {
                const rect = event.currentTarget.parentElement?.getBoundingClientRect()
                if (!rect) return
                dragRef.current = { id: note.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-50">Nota operativa</span>
              <button onPointerDown={(event) => event.stopPropagation()} onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} className="text-sm leading-none opacity-40 hover:opacity-100">×</button>
            </div>
            <textarea value={note.text} onChange={(event) => setNotes((current) => current.map((item) => item.id === note.id ? { ...item, text: event.target.value } : item))} className="h-24 w-full resize-none bg-transparent p-3 text-xs font-semibold leading-5 outline-none" />
          </article>
        ))}
      </div>
    </section>
  )
}

const editInput = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-navy-300 focus:ring-2 focus:ring-navy-100"

function EditServiceModal({
  service,
  onChange,
  onClose,
  onSave,
}: {
  service: Service
  onChange: (service: Service) => void
  onClose: () => void
  onSave: () => void
}) {
  const set = <K extends keyof Service>(key: K, value: Service[K]) => onChange({ ...service, [key]: value })
  const fieldLabel = "mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500"

  return (
    // ✅ z-[999] para que quede por encima del sidebar/header.
    // ✅ onClick (no onMouseDown) + target === currentTarget para cerrar solo al hacer clic en el fondo.
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <form
        onSubmit={(event) => { event.preventDefault(); onSave() }}
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className={`flex items-center justify-between px-5 py-4 text-white ${service.type === "expo" ? "bg-red-500" : "bg-blue-600"}`}>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Editar programación operativa</p>
            <p className="mt-1 text-base font-bold">{service.reference}</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-xl leading-none hover:bg-white/20" aria-label="Cerrar edición">×</button>
        </div>

        <div className="max-h-[calc(92vh-128px)] overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label><span className={fieldLabel}>Tipo de operación</span><select className={editInput} value={service.type} onChange={(event) => set("type", event.target.value as ServiceType)}><option value="expo">Exportación</option><option value="impo">Importación</option></select></label>
            <label><span className={fieldLabel}>Período</span><select className={editInput} value={service.scope} onChange={(event) => set("scope", event.target.value as TimeScope)}><option value="today">Hoy</option><option value="tomorrow">Mañana</option><option value="month">Mes actual</option><option value="previous">Mes anterior</option></select></label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className={fieldLabel}>Fecha</span><input className={editInput} value={service.date} onChange={(event) => set("date", event.target.value)} required /></label>
              <label><span className={fieldLabel}>Hora</span><input className={editInput} value={service.time} onChange={(event) => set("time", event.target.value)} required /></label>
            </div>

            <label><span className={fieldLabel}>Cliente / Forwarder</span><input className={editInput} value={service.forwarder} onChange={(event) => set("forwarder", event.target.value)} required /></label>
            <label><span className={fieldLabel}>Cliente final</span><input className={editInput} value={service.finalClient} onChange={(event) => set("finalClient", event.target.value)} required /></label>
            <label><span className={fieldLabel}>Referencia / BL</span><input className={`${editInput} font-mono`} value={service.reference} onChange={(event) => set("reference", event.target.value)} required /></label>

            <label className="md:col-span-2"><span className={fieldLabel}>Detalle de carga</span><input className={editInput} value={service.cargo} onChange={(event) => set("cargo", event.target.value)} required /></label>
            <label><span className={fieldLabel}>Dimensiones</span><input className={editInput} value={service.dimensions} onChange={(event) => set("dimensions", event.target.value)} /></label>
            <label className="flex items-end"><span className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={service.stackable} onChange={(event) => set("stackable", event.target.checked)} className="size-4 accent-navy-600" />Carga apilable</span></label>
            <label><span className={fieldLabel}>Stacking / Plazo</span><input className={editInput} value={service.stacking} onChange={(event) => set("stacking", event.target.value)} /></label>
            <label><span className={fieldLabel}>Nivel del plazo</span><select className={editInput} value={service.stackingTone} onChange={(event) => set("stackingTone", event.target.value as Service["stackingTone"])}><option value="urgent">Crítico</option><option value="warning">Advertencia</option><option value="safe">En plazo</option><option value="done">Completado</option></select></label>

            <label><span className={fieldLabel}>Lugar de retiro</span><input className={editInput} value={service.pickup} onChange={(event) => set("pickup", event.target.value)} required /></label>
            <label className="md:col-span-2"><span className={fieldLabel}>Contacto / instrucciones de retiro</span><input className={editInput} value={service.pickupContact} onChange={(event) => set("pickupContact", event.target.value)} /></label>
            <label><span className={fieldLabel}>Lugar de entrega</span><input className={editInput} value={service.delivery} onChange={(event) => set("delivery", event.target.value)} required /></label>
            <label className="md:col-span-2"><span className={fieldLabel}>Contacto / instrucciones de entrega</span><input className={editInput} value={service.deliveryContact} onChange={(event) => set("deliveryContact", event.target.value)} /></label>

            <label><span className={fieldLabel}>Conductor</span><input className={editInput} value={service.driver} onChange={(event) => set("driver", event.target.value)} /></label>
            <label><span className={fieldLabel}>Patente</span><input className={`${editInput} font-mono`} value={service.plate} onChange={(event) => set("plate", event.target.value)} /></label>
            <label><span className={fieldLabel}>Estado</span><select className={editInput} value={service.status} onChange={(event) => set("status", event.target.value as ServiceStatus)}><option>Cotizado</option><option>Programado</option><option>En tránsito</option><option>Entregado</option></select></label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-[10px] text-slate-400">Los cambios también se reflejarán en la pizarra libre.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="h-9 rounded-lg bg-navy-600 px-4 text-xs font-bold text-white hover:bg-navy-700">Guardar cambios</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function CoordinationBoard() {
  const [serviceRows, setServiceRows] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [moduleView, setModuleView] = useState<"operations" | "whiteboard">("operations")
  const [activeType, setActiveType] = useState<ServiceType>("expo")
  const [scope, setScope] = useState<TimeScope>("today")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [showDetail, setShowDetail] = useState(true)
  const [editingService, setEditingService] = useState<Service | null>(null)

  // ✅ Cargar datos desde Supabase al montar
  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('coordination_services')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;

        if (data && data.length > 0) {
          const mapped = data.map(rowToService);
          setServiceRows(mapped);
          setSelectedId(mapped[0]?.id || "");
        } else {
          setServiceRows(fallbackServices);
          setSelectedId("");
        }
      } catch (err) {
        console.error('Error cargando servicios:', err);
        setServiceRows(fallbackServices);
        setSelectedId("");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Guardar / Actualizar
  const handleSaveService = async (serviceToSave: Service) => {
    try {
      const isNew = !serviceToSave.id || serviceToSave.id === "";
      const row = serviceToRow(serviceToSave);
      
      if (isNew) {
        const { data, error } = await supabase
          .from('coordination_services')
          .insert([row])
          .select()
          .single();
        if (error) throw error;
        const newService = rowToService(data);
        setServiceRows(current => [newService, ...current]);
        setSelectedId(newService.id);
      } else {
        const { error } = await supabase
          .from('coordination_services')
          .update({ ...row, updated: "Editado recién" })
          .eq('id', serviceToSave.id);
        if (error) throw error;
        setServiceRows(current => current.map(s => s.id === serviceToSave.id ? { ...serviceToSave, updated: "Editado recién" } : s));
      }
    } catch (err) {
      console.error('Error guardando servicio:', err);
      alert("Error al guardar. Revisa la consola.");
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return serviceRows.filter((service) => {
      const matchesType = service.type === activeType
      const matchesScope = scope === "month"
        ? service.scope === "today" || service.scope === "tomorrow" || service.scope === "month"
        : service.scope === scope
      const haystack = [service.reference, service.forwarder, service.finalClient, service.date, service.pickup, service.delivery].join(" ").toLowerCase()
      return matchesType && matchesScope && (!query || haystack.includes(query))
    })
  }, [activeType, scope, search, serviceRows])

  const selected = serviceRows.find((service) => service.id === selectedId) ?? filtered[0] ?? serviceRows[0] ?? null
  const typeCount = (type: ServiceType) => serviceRows.filter((service) => service.type === type && ["today", "tomorrow"].includes(service.scope)).length
  
  const metrics = [
    { label: "Servicios próximos", value: serviceRows.filter((service) => ["today", "tomorrow"].includes(service.scope)).length.toString(), detail: "hoy y mañana", icon: "calendar" as IconName, tone: "bg-blue-50 text-blue-600" },
    { label: "Stacking crítico", value: serviceRows.filter((service) => service.stackingTone === "urgent").length.toString(), detail: "vence hoy", icon: "alert" as IconName, tone: "bg-red-50 text-red-600" },
    { label: "Sin conductor", value: serviceRows.filter((service) => service.driver === "Por asignar").length.toString(), detail: "requiere gestión", icon: "user" as IconName, tone: "bg-orange-50 text-orange-600" },
    { label: "En tránsito", value: serviceRows.filter((service) => service.status === "En tránsito").length.toString(), detail: "operación activa", icon: "truck" as IconName, tone: "bg-emerald-50 text-emerald-600" },
  ]

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-slate-400">
        Cargando servicios...
      </div>
    )
  }

  if (!selected && serviceRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <Icon name="board" className="size-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Pizarra vacía</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">Aún no hay servicios de coordinación. Haz clic en "Nuevo servicio" para comenzar a planificar.</p>
          <button 
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation(); // ✅ evita el "ghost click" en el overlay del modal
              const newService: Service = {
                id: "", type: "expo", scope: "today", date: "Hoy", time: "12:00", forwarder: "", finalClient: "", reference: "",
                cargo: "", dimensions: "", stackable: false, stacking: "", stackingTone: "safe",
                pickup: "", pickupContact: "", delivery: "", deliveryContact: "", driver: "", plate: "", status: "Cotizado", source: "", updated: ""
              };
              setEditingService(newService);
            }}
            className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-navy-700"
          >
            <span className="text-base leading-none">+</span>
            Nuevo servicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500">
              <span>Operaciones</span><span className="text-slate-300">/</span><span>Coordinación de depósitos</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Pizarra digital</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 md:flex">
              <span className="size-2 rounded-full bg-emerald-500" />
              Sincronizado con Supabase
            </div>
            <button onClick={() => exportCsv(filtered)} className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
              <Icon name="download" />
              Exportar CSV
            </button>
            <button 
              type="button"
              onClick={(event) => {
                event.stopPropagation(); // ✅ evita el "ghost click" en el overlay del modal
                const newService: Service = {
                  id: "", type: "expo", scope: "today", date: "", time: "", forwarder: "", finalClient: "", reference: "",
                  cargo: "", dimensions: "", stackable: false, stacking: "", stackingTone: "safe",
                  pickup: "", pickupContact: "", delivery: "", deliveryContact: "", driver: "", plate: "", status: "Cotizado", source: "", updated: ""
                };
                setEditingService(newService);
              }}
              className="flex h-9 items-center gap-2 rounded-lg bg-navy-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-navy-700"
            >
              <span className="text-base leading-none">+</span>
              Nuevo servicio
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button onClick={() => setModuleView("operations")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold transition-all ${moduleView === "operations" ? "bg-navy-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}><Icon name="truck" />Programación operativa</button>
            <button onClick={() => setModuleView("whiteboard")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold transition-all ${moduleView === "whiteboard" ? "bg-navy-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}><Icon name="board" />Pizarra libre</button>
          </div>
          {moduleView === "whiteboard" && <p className="hidden text-[10px] text-slate-400 md:block">Espacio visual para turnos, recordatorios y coordinación diaria</p>}
        </div>

        <div className={moduleView === "whiteboard" ? "block" : "hidden"}>
          <Whiteboard
            operations={serviceRows.filter((service) => service.scope === "today" || service.scope === "tomorrow")}
            onEdit={setEditingService}
          />
        </div>
        <div className={`space-y-4 ${moduleView === "operations" ? "block" : "hidden"}`}>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}><Icon name={metric.icon} /></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><div className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{metric.value}</strong><span className="text-[10px] text-slate-400">{metric.detail}</span></div></div>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-lg bg-slate-100 p-1">
                {([
                  { id: "expo", label: "Exportaciones", color: "text-red-700", active: "bg-white shadow-sm ring-1 ring-slate-200" },
                  { id: "impo", label: "Importaciones", color: "text-blue-700", active: "bg-white shadow-sm ring-1 ring-slate-200" },
                ] as const).map((tab) => (
                  <button key={tab.id} onClick={() => { setActiveType(tab.id); setSelectedId(serviceRows.find((service) => service.type === tab.id)?.id ?? "") }} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold transition-all ${activeType === tab.id ? `${tab.active} ${tab.color}` : "text-slate-500 hover:text-slate-700"}`}>
                    <span className={`size-2 rounded-full ${tab.id === "expo" ? "bg-red-500" : "bg-blue-500"}`} />
                    {tab.label}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{typeCount(tab.id)}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white">
                  <Icon name="search" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar referencia, cliente o lugar..." className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
                  <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">⌘ K</span>
                </label>
                <button className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
                  Todos los estados <Icon name="chevron" className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="flex gap-5">
                {([
                  { id: "today", label: "Hoy", sub: "23 ago" },
                  { id: "tomorrow", label: "Mañana", sub: "24 ago" },
                  { id: "month", label: "Agosto", sub: "Mes actual" },
                  { id: "previous", label: "Julio", sub: "Mes anterior" },
                ] as const).map((item) => (
                  <button key={item.id} onClick={() => setScope(item.id)} className={`relative pb-3 text-left transition-colors ${scope === item.id ? "text-navy-700" : "text-slate-400 hover:text-slate-600"}`}>
                    <span className="block text-xs font-bold">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] font-medium">{item.sub}</span>
                    {scope === item.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-navy-500" />}
                  </button>
                ))}
              </div>
              <p className="hidden pb-3 text-[10px] text-slate-400 lg:block"><span className="font-semibold text-slate-600">{filtered.length} servicios</span> en esta vista</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="w-10 px-4 py-3"><span className="sr-only">Tipo</span></th>
                  <th className="px-3 py-3">Ventana</th>
                  <th className="px-3 py-3">Cliente / Forwarder</th>
                  <th className="px-3 py-3">Referencia / BL</th>
                  <th className="px-3 py-3">Detalle de carga</th>
                  <th className="px-3 py-3">Retiro → Entrega</th>
                  <th className="px-3 py-3">Stacking / Plazo</th>
                  <th className="px-3 py-3">Conductor</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((service) => {
                  const active = selected?.id === service.id && showDetail
                  return (
                    <tr key={service.id} onClick={() => { setSelectedId(service.id); setShowDetail(true) }} className={`cursor-pointer transition-colors ${active ? "bg-navy-50/70" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3.5"><span className={`block h-9 w-1 rounded-full ${service.type === "expo" ? "bg-red-500" : "bg-blue-500"}`} /></td>
                      <td className="whitespace-nowrap px-3 py-3.5"><p className="text-xs font-bold text-slate-800">{service.date}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Icon name="clock" className="size-3" />{service.time}</p></td>
                      <td className="px-3 py-3.5"><p className="text-xs font-bold text-slate-900">{service.forwarder}</p><p className="mt-1 text-[10px] text-slate-500">{service.finalClient}</p></td>
                      <td className="px-3 py-3.5"><span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-700">{service.reference}</span><p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400"><Icon name="mail" className="size-3" />Desde correo</p></td>
                      <td className="px-3 py-3.5"><p className="whitespace-nowrap text-[11px] font-semibold text-slate-700">{service.cargo}</p><p className="mt-1 text-[9px] text-slate-400">{service.dimensions} · <span className={service.stackable ? "text-emerald-600" : "font-semibold text-red-600"}>{service.stackable ? "Apilable" : "No apilable"}</span></p></td>
                      <td className="max-w-64 px-3 py-3.5"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-700">{service.pickup}</p><p className="mt-1 truncate text-[10px] text-slate-500">{service.delivery}</p></div><Icon name="arrow" className="size-3.5 shrink-0 text-slate-300" /></div></td>
                      <td className="px-3 py-3.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${stackingStyles[service.stackingTone]}`}><Icon name={service.stackingTone === "urgent" ? "alert" : service.stackingTone === "done" ? "check" : "clock"} className="size-3" />{service.stacking}</span></td>
                      <td className="px-3 py-3.5"><p className={`whitespace-nowrap text-[11px] font-semibold ${service.driver === "Por asignar" ? "text-orange-600" : "text-slate-700"}`}>{service.driver}</p><p className="mt-1 font-mono text-[9px] text-slate-400">{service.plate}</p></td>
                      <td className="px-3 py-3.5"><StatusBadge status={service.status} /></td>
                      <td className="px-3 py-3.5 text-slate-300"><Icon name="chevron" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="search" /></div><p className="mt-3 text-sm font-bold text-slate-700">No encontramos servicios</p><p className="mt-1 text-xs text-slate-400">Prueba otro período o término de búsqueda.</p></div>
            )}
          </div>
        </section>

        {showDetail && selected && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${selected.type === "expo" ? "border-red-100 bg-red-50/60" : "border-blue-100 bg-blue-50/60"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-lg text-white ${selected.type === "expo" ? "bg-red-500" : "bg-blue-600"}`}><Icon name="package" className="size-5" /></div>
                <div><div className="flex items-center gap-2"><p className="text-sm font-bold text-slate-950">{selected.reference}</p><StatusBadge status={selected.status} /></div><p className="mt-0.5 text-[11px] text-slate-500">{selected.type === "expo" ? "Exportación" : "Importación"} · {selected.forwarder} para {selected.finalClient}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingService({ ...selected })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Editar servicio</button>
                <button onClick={() => setShowDetail(false)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600" title="Cerrar detalle">×</button>
              </div>
            </div>

            <div className="grid gap-0 divide-y divide-slate-100 lg:grid-cols-[1.2fr_1fr_0.85fr] lg:divide-x lg:divide-y-0">
              <div className="p-5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ruta operacional</p>
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-5">
                  <div className="relative flex flex-col items-center"><span className="flex size-7 items-center justify-center rounded-full bg-navy-50 text-navy-600 ring-1 ring-navy-100"><Icon name="map" className="size-3.5" /></span><span className="absolute top-8 h-10 w-px bg-slate-200" /></div>
                  <div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retiro · {selected.time}</p><p className="mt-1 text-xs font-bold text-slate-800">{selected.pickup}</p><p className="mt-1 text-[10px] text-slate-500">{selected.pickupContact}</p></div>
                  <div className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><Icon name="check" className="size-3.5" /></div>
                  <div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Entrega</p><p className="mt-1 text-xs font-bold text-slate-800">{selected.delivery}</p><p className="mt-1 text-[10px] text-slate-500">{selected.deliveryContact}</p></div>
                </div>
              </div>

              <div className="p-5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Carga y restricción</p>
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-800">{selected.cargo}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{selected.dimensions}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-[10px] text-slate-500">Apilabilidad</span><span className={`text-[10px] font-bold ${selected.stackable ? "text-emerald-600" : "text-red-600"}`}>{selected.stackable ? "Sí, carga remontable" : "No apilable"}</span></div>
                </div>
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 ring-1 ring-inset ${stackingStyles[selected.stackingTone]}`}><Icon name="clock" /><div><p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Plazo stacking</p><p className="text-[11px] font-bold">{selected.stacking}</p></div></div>
              </div>

              <div className="p-5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Asignación y origen</p>
                <div className="mt-3 flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-navy-800 text-[10px] font-bold text-white">{selected.driver === "Por asignar" ? "?" : selected.driver.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><p className="text-xs font-bold text-slate-800">{selected.driver}</p><p className="mt-0.5 font-mono text-[9px] text-slate-400">{selected.plate}</p></div></div>
                <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center gap-2 text-navy-600"><Icon name="mail" /><p className="text-[10px] font-bold">Correo de programación</p></div><p className="mt-2 truncate text-[10px] text-slate-600" title={selected.source}>{selected.source}</p><p className="mt-1 text-[9px] text-slate-400">Actualizado {selected.updated}</p></div>
              </div>
            </div>
          </section>
        )}
        </div>
      </main>
      {editingService && (
        <EditServiceModal
          service={editingService}
          onChange={setEditingService}
          onClose={() => setEditingService(null)}
          onSave={() => {
            handleSaveService(editingService);
            setEditingService(null);
          }}
        />
      )}
    </div>
  )
}