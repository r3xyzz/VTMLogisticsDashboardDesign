// components/Camioneros.tsx

import { useMemo, useRef, useState } from "react"

type IconName =
  | "arrow"
  | "camera"
  | "check"
  | "clock"
  | "document"
  | "download"
  | "map"
  | "search"
  | "truck"
  | "upload"
  | "user"

const paths: Record<IconName, string[]> = {
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  camera: ["M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2h5z", "M15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"],
  check: ["m5 12 4 4L19 6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  document: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6M8 13h8M8 17h5"],
  download: ["M12 3v12m0 0 4-4m-4 4-4-4", "M5 20h14"],
  map: ["M9 18 3.5 21V6L9 3m0 15 6 3m-6-3V3m6 18 5.5-3V3L15 6m0 15V6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"],
  truck: ["M3 6h11v10H3zM14 9h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  upload: ["M12 16V4m0 0L7 9m5-5 5 5", "M5 20h14"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
}

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {paths[name].map((path, index) => (
        <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

type DocumentKey = "emptyPod" | "loadEvidence" | "completedPod" | "deliveryEvidence"
type UploadValue = { name: string; url: string; type: string }
type Trip = {
  id: string
  order: string
  company: string
  driver: string
  initials: string
  truck: string
  route: string
  origin: string
  destination: string
  appointment: string
  status: "En carga" | "En tránsito" | "Por documentar" | "Completado"
  uploads: Partial<Record<DocumentKey, UploadValue>>
}

const seededFile = (name: string, type: string): UploadValue => ({ name, type, url: "" })

const tripSeed: Trip[] = [
  {
    id: "1",
    order: "OT-10482",
    company: "Transportes del Pacífico",
    driver: "Carlos Ramírez",
    initials: "TP",
    truck: "JTRK-82 · Semi 45'",
    route: "San Antonio → Santiago",
    origin: "Puerto San Antonio",
    destination: "CD Lo Boza, Pudahuel",
    appointment: "Hoy · 14:30",
    status: "En tránsito",
    uploads: {
      emptyPod: seededFile("POD_OT-10482_vacio.pdf", "application/pdf"),
      loadEvidence: seededFile("evidencia_carga_10482.jpg", "image/jpeg"),
    },
  },
  {
    id: "2",
    order: "OT-10488",
    company: "Logística Costa Central",
    driver: "Miguel Soto",
    initials: "LC",
    truck: "KLPR-19 · Rampla",
    route: "Valparaíso → Quilicura",
    origin: "TPS Valparaíso",
    destination: "Bodega Noviciado",
    appointment: "Hoy · 17:00",
    status: "En carga",
    uploads: { emptyPod: seededFile("POD_OT-10488_vacio.pdf", "application/pdf") },
  },
  {
    id: "3",
    order: "OT-10471",
    company: "Transportes Andinos",
    driver: "Alejandro Pérez",
    initials: "TA",
    truck: "PLRW-44 · Semi 40'",
    route: "San Antonio → Rancagua",
    origin: "Puerto San Antonio",
    destination: "Centro Logístico Ruta 5",
    appointment: "Ayer · 16:20",
    status: "Por documentar",
    uploads: {
      emptyPod: seededFile("POD_OT-10471_vacio.pdf", "application/pdf"),
      loadEvidence: seededFile("carga_10471.jpg", "image/jpeg"),
      deliveryEvidence: seededFile("descarga_10471.jpg", "image/jpeg"),
    },
  },
  {
    id: "4",
    order: "OT-10465",
    company: "Carga Express Chile",
    driver: "Rodrigo Muñoz",
    initials: "CE",
    truck: "HRPK-63 · Rampla",
    route: "Valparaíso → Santiago",
    origin: "Puerto Valparaíso",
    destination: "CD ENEA",
    appointment: "18 ago · 11:00",
    status: "Completado",
    uploads: {
      emptyPod: seededFile("POD_OT-10465_vacio.pdf", "application/pdf"),
      loadEvidence: seededFile("carga_10465.jpg", "image/jpeg"),
      completedPod: seededFile("POD_OT-10465_firmado.pdf", "application/pdf"),
      deliveryEvidence: seededFile("descarga_10465.jpg", "image/jpeg"),
    },
  },
]

const uploadDefinitions: { key: DocumentKey; step: number; title: string; description: string; accept: string; icon: IconName; phase: string }[] = [
  { key: "emptyPod", step: 1, title: "POD vacío", description: "Documento entregado al camionero antes de iniciar el viaje.", accept: ".pdf,image/*", icon: "document", phase: "Antes del viaje" },
  { key: "loadEvidence", step: 2, title: "Evidencia de carga", description: "Foto nítida de la carga y su condición al momento del retiro.", accept: "image/*", icon: "camera", phase: "En origen" },
  { key: "completedPod", step: 3, title: "POD completo y firmado/sellado", description: "POD con nombre, fecha, hora, firma y sellos del receptor.", accept: ".pdf,image/*", icon: "document", phase: "En destino" },
  { key: "deliveryEvidence", step: 4, title: "Evidencia de descarga", description: "Foto de la mercadería descargada en el lugar de entrega.", accept: "image/*", icon: "camera", phase: "En destino" },
]

const statusStyles: Record<Trip["status"], string> = {
  "En carga": "bg-orange-50 text-orange-700 ring-orange-200",
  "En tránsito": "bg-blue-50 text-blue-700 ring-blue-200",
  "Por documentar": "bg-red-50 text-red-700 ring-red-200",
  Completado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

function Status({ value }: { value: Trip["status"] }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[value]}`}>{value}</span>
}

function UploadCard({
  definition,
  value,
  onUpload,
}: {
  definition: (typeof uploadDefinitions)[number]
  value?: UploadValue
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isImage = value?.type.startsWith("image/")

  return (
    <article className={`overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-sm ${value ? "border-emerald-200" : "border-slate-200"}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg ${value ? "bg-emerald-50 text-emerald-600" : "bg-navy-50 text-navy-500"}`}>
          <Icon name={value ? "check" : definition.icon} className="size-5" />
          <span className={`absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white ${value ? "bg-emerald-500 text-white" : "bg-navy-600 text-white"}`}>{definition.step}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy-500">Paso {definition.step}</p>
              <p className="mt-0.5 font-semibold text-slate-900">{definition.title}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{definition.phase}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{definition.description}</p>
        </div>
      </div>

      {value ? (
        <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {isImage && value.url && <img src={value.url} alt={`Vista previa de ${definition.title}`} className="h-28 w-full object-cover" />}
          <div className="flex items-center gap-2 p-3">
            <Icon name={isImage ? "camera" : "document"} className="size-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{value.name}</span>
            {value.url && (
              <a href={value.url} download={value.name} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-navy-600" title="Descargar archivo">
                <Icon name="download" />
              </a>
            )}
            <button onClick={() => inputRef.current?.click()} className="text-xs font-semibold text-navy-500 hover:text-navy-700">Reemplazar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-4 text-xs font-semibold text-slate-600 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-600">
          <Icon name="upload" />
          Seleccionar archivo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={definition.accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ""
        }}
      />
    </article>
  )
}

export default function DriversModule() {
  const [trips, setTrips] = useState(tripSeed)
  const [selectedId, setSelectedId] = useState("1")
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState("")
  const selected = trips.find((trip) => trip.id === selectedId) ?? trips[0]
  const filteredTrips = useMemo(() => {
    const query = search.toLowerCase()
    return trips.filter((trip) => [trip.order, trip.company, trip.driver, trip.truck, trip.route].join(" ").toLowerCase().includes(query))
  }, [search, trips])
  const completed = Object.keys(selected.uploads).length

  const handleUpload = (key: DocumentKey, file: File) => {
    const upload = { name: file.name, type: file.type, url: URL.createObjectURL(file) }
    setTrips((current) =>
      current.map((trip) => {
        if (trip.id !== selected.id) return trip
        const uploads = { ...trip.uploads, [key]: upload }
        const uploadCount = Object.keys(uploads).length
        return { ...trip, uploads, status: uploadCount === 4 ? "Completado" : trip.status === "Completado" ? "Por documentar" : trip.status }
      }),
    )
    setToast(`${file.name} se cargó correctamente`)
    window.setTimeout(() => setToast(""), 2600)
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-500">
              <span>Operaciones</span><span className="text-slate-300">/</span><span>Última milla</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Camioneros y evidencias</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Sincronización activa
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl p-6">
        <section className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Viajes activos", value: "8", detail: "3 en ruta", icon: "truck" as IconName, tone: "text-blue-600 bg-blue-50" },
            { label: "POD pendientes", value: "3", detail: "Requieren gestión", icon: "clock" as IconName, tone: "text-orange-600 bg-orange-50" },
            { label: "Completados hoy", value: "12", detail: "96% a tiempo", icon: "check" as IconName, tone: "text-emerald-600 bg-emerald-50" },
          ].map((metric) => (
            <article key={metric.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className={`flex size-10 items-center justify-center rounded-lg ${metric.tone}`}><Icon name={metric.icon} className="size-5" /></div>
              <div><p className="text-xs font-medium text-slate-500">{metric.label}</p><div className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{metric.value}</strong><span className="text-[11px] text-slate-400">{metric.detail}</span></div></div>
            </article>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <p className="font-bold text-slate-900">Viajes asignados</p>
              <p className="mt-1 text-xs text-slate-500">{trips.length} empresas transportistas asignadas</p>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white">
                <Icon name="search" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar OT o empresa" className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="max-h-[650px] divide-y divide-slate-100 overflow-y-auto">
              {filteredTrips.map((trip) => {
                const active = trip.id === selected.id
                return (
                  <button key={trip.id} onClick={() => setSelectedId(trip.id)} className={`w-full p-4 text-left transition-colors ${active ? "bg-navy-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-navy-500 text-white" : "bg-slate-100 text-slate-600"}`}>{trip.initials}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Empresa transportista</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{trip.company}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Status value={trip.status} />
                          <span className="text-[10px] font-semibold text-slate-400">{trip.order}</span>
                        </div>
                        <p className="mt-2 truncate text-[11px] text-slate-500">{trip.driver} · {trip.route}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{Object.keys(trip.uploads).length}/4 documentos cargados</p>
                      </div>
                    </div>
                  </button>
                )
              })}
              {filteredTrips.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="truck" /></div>
                  <p className="mt-3 text-xs font-semibold text-slate-700">No hay empresas asignadas</p>
                  <p className="mt-1 text-[11px] text-slate-400">Prueba con otra búsqueda.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="bg-navy-800 p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{selected.initials}</div>
                    <div><p className="text-base font-bold">{selected.company}</p><p className="mt-0.5 text-xs text-blue-200">{selected.driver} · {selected.truck}</p></div>
                  </div>
                  <div className="rounded-lg bg-white/10 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-blue-200">Orden de transporte</p><p className="mt-0.5 text-sm font-bold">{selected.order}</p></div>
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retiro</p><p className="mt-1 text-sm font-semibold text-slate-900">{selected.origin}</p></div>
                <div className="hidden items-center gap-2 text-slate-300 sm:flex"><span className="h-px w-8 bg-slate-200" /><Icon name="arrow" /><span className="h-px w-8 bg-slate-200" /></div>
                <div className="sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entrega · {selected.appointment}</p><p className="mt-1 text-sm font-semibold text-slate-900">{selected.destination}</p></div>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-base font-bold text-slate-950">Expediente de entrega</p><p className="mt-1 text-xs text-slate-500">Carga los documentos y fotografías requeridos para cerrar la orden.</p></div>
                <div className="min-w-40">
                  <div className="flex justify-between text-[11px] font-semibold"><span className="text-slate-500">Progreso</span><span className={completed === 4 ? "text-emerald-600" : "text-navy-600"}>{completed} de 4</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${completed === 4 ? "bg-emerald-500" : "bg-navy-500"}`} style={{ width: `${completed * 25}%` }} /></div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {uploadDefinitions.map((definition) => (
                  <UploadCard key={definition.key} definition={definition} value={selected.uploads[definition.key]} onUpload={(file) => handleUpload(definition.key, file)} />
                ))}
              </div>
              {completed === 4 && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100"><Icon name="check" /></div>
                  <div><p className="text-xs font-bold">Expediente completo</p><p className="mt-0.5 text-[11px] text-emerald-700">La orden está lista para revisión y cierre administrativo.</p></div>
                </div>
              )}
            </article>
          </section>
        </div>
      </main>

      {toast && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-xl"><Icon name="check" className="size-4 text-emerald-400" />{toast}</div>}
    </div>
  )
}
