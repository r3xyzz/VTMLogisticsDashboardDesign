// src/components/Camioneros.tsx
import { useMemo, useRef, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

type IconName = "arrow" | "camera" | "check" | "clock" | "document" | "download" | "map" | "search" | "truck" | "upload" | "user"

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
      {paths[name].map((path, index) => <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}

type DocumentKey = "emptyPod" | "loadEvidence" | "completedPod" | "deliveryEvidence"
interface UploadValue { name: string; url: string; type: string }
interface Trip {
  id: string; order_number: string; company: string; driver: string; initials: string; truck: string; route: string;
  origin: string; destination: string; appointment: string; status: string;
  uploads: Partial<Record<DocumentKey, UploadValue>>
}

const uploadDefinitions: { key: DocumentKey; step: number; title: string; description: string; accept: string; icon: IconName; phase: string }[] = [
  { key: "emptyPod", step: 1, title: "POD vacío", description: "Documento entregado al camionero antes de iniciar el viaje.", accept: ".pdf,image/*", icon: "document", phase: "Antes del viaje" },
  { key: "loadEvidence", step: 2, title: "Evidencia de carga", description: "Foto nítida de la carga y su condición al momento del retiro.", accept: "image/*", icon: "camera", phase: "En origen" },
  { key: "completedPod", step: 3, title: "POD completo y firmado/sellado", description: "POD con nombre, fecha, hora, firma y sellos del receptor.", accept: ".pdf,image/*", icon: "document", phase: "En destino" },
  { key: "deliveryEvidence", step: 4, title: "Evidencia de descarga", description: "Foto de la mercadería descargada en el lugar de entrega.", accept: "image/*", icon: "camera", phase: "En destino" },
]

const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'Completado';
    if (status === 'in_progress') return 'En tránsito';
    if (status === 'pending') return 'En carga';
    return status;
}

const statusStyles: Record<string, string> = {
  "En carga": "bg-orange-50 text-orange-700 ring-orange-200",
  "En tránsito": "bg-blue-50 text-blue-700 ring-blue-200",
  "Completado": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "pending": "bg-orange-50 text-orange-700 ring-orange-200",
  "in_progress": "bg-blue-50 text-blue-700 ring-blue-200",
  "completed": "bg-emerald-50 text-emerald-700 ring-emerald-200",
}

function Status({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[value] || "bg-slate-50 text-slate-700 ring-slate-200"}`}>{value}</span>
}

function UploadCard({ definition, value, onUpload }: { definition: (typeof uploadDefinitions)[number]; value?: UploadValue; onUpload: (file: File) => void }) {
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
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-navy-500">Paso {definition.step}</p><p className="mt-0.5 font-semibold text-slate-900">{definition.title}</p></div>
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
            {value.url && <a href={value.url} download={value.name} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-navy-600" title="Descargar archivo"><Icon name="download" /></a>}
            <button onClick={() => inputRef.current?.click()} className="text-xs font-semibold text-navy-500 hover:text-navy-700">Reemplazar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-4 text-xs font-semibold text-slate-600 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-600">
          <Icon name="upload" /> Seleccionar archivo
        </button>
      )}
      <input ref={inputRef} type="file" accept={definition.accept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} />
    </article>
  )
}

export default function CamionerosModule() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState("")
  const [uploading, setUploading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    initModule();
  }, [])

  async function initModule() {
    try {
      setLoading(true);
      
      // 1. Obtener el email y rol del usuario logueado
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || null;
      setUserEmail(email);

      // 2. Verificar el rol en authorized_users
      let isDriver = false;
      let driverId = null;

      if (email) {
        const { data: authData } = await supabase
          .from('authorized_users')
          .select('role')
          .eq('email', email)
          .single();
        
        if (authData?.role === 'driver') {
          isDriver = true;
        }

        // 3. Si es chofer, obtener su ID de la tabla drivers
        if (isDriver) {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          
          if (driverData) {
            driverId = driverData.id;
          }
        }
      }

      // 4. Traer las órdenes
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, origin, destination, service_date, status,
          client:clients (name),
          documents (pod_empty_url, pod_final_url, load_evidence_url, delivery_evidence_url)
        `)
        .order('created_at', { ascending: false });

      // ✅ FILTRO: Si es un chofer, solo traemos sus viajes. Si es admin, todos.
      if (isDriver && driverId) {
        query = query.eq('driver_id', driverId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 5. Mapear los datos a la interfaz
      const mappedTrips: Trip[] = (data || []).map((order: any) => {
        const doc = Array.isArray(order.documents) ? order.documents[0] : order.documents;
        const uploads: Partial<Record<DocumentKey, UploadValue>> = {};
        
        if (doc?.pod_empty_url) uploads.emptyPod = { name: "POD Vacío", url: doc.pod_empty_url, type: "application/pdf" };
        if (doc?.load_evidence_url) uploads.loadEvidence = { name: "Evidencia Carga", url: doc.load_evidence_url, type: "image/jpeg" };
        if (doc?.pod_final_url) uploads.completedPod = { name: "POD Final", url: doc.pod_final_url, type: "application/pdf" };
        if (doc?.delivery_evidence_url) uploads.deliveryEvidence = { name: "Evidencia Descarga", url: doc.delivery_evidence_url, type: "image/jpeg" };

        return {
          id: order.id, order_number: order.order_number, company: order.client?.name || "Cliente no asignado",
          driver: "Chofer Asignado", initials: (order.client?.name || "XX").substring(0, 2).toUpperCase(),
          truck: "Unidad VTM", route: `${order.origin} → ${order.destination}`, origin: order.origin, destination: order.destination,
          appointment: new Date(order.service_date).toLocaleDateString('es-CL'), status: getStatusLabel(order.status), uploads
        }
      });

      setTrips(mappedTrips);
      if (mappedTrips.length > 0 && !selectedId) setSelectedId(mappedTrips[0].id);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setToast("❌ Error al cargar los viajes");
    } finally {
      setLoading(false);
    }
  }

  const selected = trips.find((trip) => trip.id === selectedId) || null
  const filteredTrips = useMemo(() => {
    const query = search.toLowerCase()
    return trips.filter((trip) => [trip.order_number, trip.company, trip.driver, trip.route].join(" ").toLowerCase().includes(query))
  }, [search, trips])

  const completed = selected ? Object.keys(selected.uploads).length : 0

  const handleUpload = async (key: DocumentKey, file: File) => {
    if (!selected) return;
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${selected.order_number}_${key}_${Date.now()}.${fileExt}`;
      const filePath = `orders/${selected.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('pod-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('pod-documents').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const updateData: any = { order_id: selected.id, updated_at: new Date().toISOString() };
      
      if (key === 'emptyPod') updateData.pod_empty_url = publicUrl;
      else if (key === 'loadEvidence') updateData.load_evidence_url = publicUrl;
      else if (key === 'completedPod') updateData.pod_final_url = publicUrl;
      else if (key === 'deliveryEvidence') updateData.delivery_evidence_url = publicUrl;

      const { data: existingDoc } = await supabase.from('documents').select('id').eq('order_id', selected.id).maybeSingle();

      let dbError;
      if (existingDoc) {
        const { error } = await supabase.from('documents').update(updateData).eq('id', existingDoc.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('documents').insert([updateData]);
        dbError = error;
      }
      if (dbError) throw dbError;

      // Si ya subió las 4 cosas, marcamos la orden como completada automáticamente
      const newUploadsCount = Object.keys(selected.uploads).length + 1;
      if (key === 'completedPod' || newUploadsCount === 4) {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', selected.id);
      } else if (selected.status === 'pending') {
        await supabase.from('orders').update({ status: 'in_progress' }).eq('id', selected.id);
      }

      setToast(`${file.name} se cargó correctamente`);
      setTimeout(() => setToast(""), 2600);
      await initModule(); // Recargar la lista
    } catch (err) {
      console.error(err);
      setToast("❌ Error al subir el archivo");
      setTimeout(() => setToast(""), 2600);
    } finally { setUploading(false); }
  };

  if (loading && trips.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Cargando tus viajes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-500"><span>Operaciones</span><span className="text-slate-300">/</span><span>Última milla</span></div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Mis Viajes Asignados</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:flex">
            <span className={`size-2 rounded-full ${uploading ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
            {uploading ? 'Subiendo archivo...' : 'Sincronización activa'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl p-6">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <p className="font-bold text-slate-900">Viajes disponibles</p>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-400 focus-within:border-navy-300 focus-within:bg-white">
                <Icon name="search" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar OT o cliente" className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="max-h-[650px] divide-y divide-slate-100 overflow-y-auto">
              {filteredTrips.map((trip) => {
                const active = trip.id === selected?.id
                return (
                  <button key={trip.id} onClick={() => setSelectedId(trip.id)} className={`w-full p-4 text-left transition-colors ${active ? "bg-navy-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-navy-500 text-white" : "bg-slate-100 text-slate-600"}`}>{trip.initials}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cliente</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{trip.company}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Status value={trip.status} />
                          <span className="text-[10px] font-semibold text-slate-400">{trip.order_number}</span>
                        </div>
                        <p className="mt-2 truncate text-[11px] text-slate-500">{trip.route}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{Object.keys(trip.uploads).length}/4 documentos cargados</p>
                      </div>
                    </div>
                  </button>
                )
              })}
              {filteredTrips.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="truck" /></div>
                  <p className="mt-3 text-xs font-semibold text-slate-700">No tienes viajes asignados</p>
                  <p className="mt-1 text-[11px] text-slate-400">Prueba con otra búsqueda.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            {selected ? (
              <>
                <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="bg-navy-800 p-5 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{selected.initials}</div>
                        <div><p className="text-base font-bold">{selected.company}</p><p className="mt-0.5 text-xs text-blue-200">{selected.driver} · {selected.truck}</p></div>
                      </div>
                      <div className="rounded-lg bg-white/10 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-blue-200">Orden de transporte</p><p className="mt-0.5 text-sm font-bold">{selected.order_number}</p></div>
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
                    {uploadDefinitions.map((definition) => <UploadCard key={definition.key} definition={definition} value={selected.uploads[definition.key]} onUpload={(file) => handleUpload(definition.key, file)} />)}
                  </div>
                  {completed === 4 && (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100"><Icon name="check" /></div>
                      <div><p className="text-xs font-bold">Expediente completo</p><p className="mt-0.5 text-[11px] text-emerald-700">La orden está lista para revisión y cierre administrativo.</p></div>
                    </div>
                  )}
                </article>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50"><p className="text-sm text-slate-500">No tienes un viaje seleccionado.</p></div>
            )}
          </section>
        </div>
      </main>

      {toast && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-xl"><Icon name="check" className="size-4 text-emerald-400" />{toast}</div>}
    </div>
  )
}