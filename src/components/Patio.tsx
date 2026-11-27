import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { supabase } from "../lib/supabase"
import { selectAll } from "../lib/fetchAll"
import type { Driver as DriverRow, Fleet as FleetRow } from "../types/database"

// Jefatura de Patio: todo vive en Supabase.
// fleet / drivers (compartidas con Flota, Conductores, Nueva OT y Camioneros), yard_movements,
// crane_requests, fleet_maintenance, incidents (panas y siniestros), driver_daily_hours y el bucket privado patio-files.

type Tab = "patio" | "fleet" | "drivers"
type VehicleStatus = "En ruta" | "Disponible" | "En mantenimiento" | "Fuera de servicio"
type IconName = "alert" | "check" | "chevron" | "clock" | "document" | "download" | "gate" | "link" | "search" | "truck" | "upload" | "user" | "wrench"
type ServiceType = "Consolidado" | "Exclusivo"
type MovementStatus = "Planificado" | "En ejecución" | "Cerrado"
type CraneStatus = "Solicitada" | "Confirmada" | "Completada"

type MovementRow = {
  id: string; moved_at: string; reference: string; order_id: string | null; cargo: string | null; service_type: ServiceType
  arrival_fleet_id: string | null; arrival_driver_id: string | null; departure_fleet_id: string | null; departure_driver_id: string | null
  guide_photo_path: string | null; physical_file: string | null; status: MovementStatus; created_by: string | null
}
type CraneRow = { id: string; requested_for: string | null; reference: string | null; reason: string; location: string | null; provider_id: string | null; cost: number | null; status: CraneStatus }
type MaintenanceRow = { id: string; fleet_id: string; performed_at: string; detail: string; current_km: number | null; next_km: number | null; cost: number | null }
// incidents: incident_type 'repair' (pana/reparación) | 'claim' (siniestro)
type IncidentRow = { id: string; fleet_id: string | null; incident_type: string; description: string | null; resolution_notes: string | null; reported_at: string | null; claim_number: string | null }
type HoursRow = { id: string; driver_id: string; work_date: string; hours: number }
type ProviderOption = { id: string; name: string }

const DOC_FIELDS = [
  { key: "technical_review_done", label: "Revisión técnica realizada", date: true, alert: false },
  { key: "technical_review", label: "Revisión técnica vence", date: true, alert: true },
  { key: "permit_circulation", label: "Permiso de circulación N°", date: false, alert: false },
  { key: "permit_expiry", label: "Permiso de circulación vence", date: true, alert: true },
  { key: "gases_expiry", label: "Revisión de gases vence", date: true, alert: true },
  { key: "vehicle_insurance", label: "Seguro / SOAP N°", date: false, alert: false },
  { key: "vehicle_insurance_expiry", label: "Seguro / SOAP vence", date: true, alert: true },
  { key: "cargo_insurance", label: "Póliza de carga", date: false, alert: false },
  { key: "extinguisher_expiry", label: "Extintor vence", date: true, alert: true },
] as const
type DocKey = (typeof DOC_FIELDS)[number]["key"]

type Vehicle = {
  id: string; internal: string; plate: string; engine: string; chassis: string; kind: string; brand: string; model: string; year: string
  status: VehicleStatus; weightCapacity: string; volumeCapacity: string; location: string; currentKm: string; nextMaintenance: string; lastMaintenance: string
  driverId: string; photoPath: string; gps: string; docs: Record<DocKey, string>
  expiries: string[] // fechas (ISO) que generan alerta documental
}

type Driver = {
  id: string; rut: string; name: string; phone: string; email: string; address: string; emergencyName: string; emergencyPhone: string
  licenseNumber: string; licenseClass: string; licenseExpiry: string; licenseExpiryRaw: string; hiredAt: string; vehicleId: string
  todayHours: string; backgroundCheck: string; cv: string; status: "Disponible" | "Asignado" | "Ausente"
}

const paths: Record<IconName, string[]> = {
  alert: ["M12 9v4m0 4h.01", "M10.3 3.7 2.2 17h19L13.7 3.7a2 2 0 0 0-3.4 0z"], check: ["m5 12 4 4L19 6"], chevron: ["m9 18 6-6-6-6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"], document: ["M14 2H6a2 2 0 0 0-2 2v16h16V8z", "M14 2v6h6M8 13h8M8 17h5"],
  download: ["M12 3v12m0 0 4-4m-4 4-4-4", "M5 20h14"], gate: ["M4 21V8h16v13M8 21V8m8 13V8M2 8h20M6 4h12v4"], link: ["M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1", "M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"], truck: ["M3 6h11v10H3zM14 9h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  upload: ["M12 16V4m0 0L7 9m5-5 5 5", "M5 20h14"], user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"], wrench: ["M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-2.4 2.4-2.1-2.1a4 4 0 0 0 5 5l7.5 7.5-3.6 3.6-7.5-7.5z"],
}
function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paths[name].map((path, index) => <path key={index} d={path} strokeLinecap="round" strokeLinejoin="round" />)}</svg> }

const STATUS_FROM_DB: Record<string, VehicleStatus> = { available: "Disponible", in_route: "En ruta", maintenance: "En mantenimiento", inactive: "Fuera de servicio" }
const STATUS_TO_DB: Record<VehicleStatus, string> = { Disponible: "available", "En ruta": "in_route", "En mantenimiento": "maintenance", "Fuera de servicio": "inactive" }
const MOVEMENT_STATUSES: MovementStatus[] = ["Planificado", "En ejecución", "Cerrado"]
const CRANE_STATUSES: CraneStatus[] = ["Solicitada", "Confirmada", "Completada"]
const ALERT_DAYS = 30
const BUCKET = "patio-files"
const REALTIME_TABLES = ["fleet", "drivers", "yard_movements", "crane_requests", "fleet_maintenance", "incidents", "driver_daily_hours"]

const nextOf = <T,>(list: T[], value: T) => list[(list.indexOf(value) + 1) % list.length]
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const parseDate = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value)
function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })
}
function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}
function expiresSoon(value?: string | null) {
  if (!value) return false
  const time = parseDate(value).getTime()
  return !Number.isNaN(time) && time < Date.now() + ALERT_DAYS * 86400000
}
const formatCapacity = (value: string, unit: string) => value ? `${Number(value).toLocaleString("es-CL")} ${unit}` : "—"
const formatMoney = (value: number | null) => value != null ? `$${value.toLocaleString("es-CL")}` : "—"
const toNumber = (value: string) => { const number = Number(value.replace(/\./g, "").replace(",", ".")); return value.trim() && !Number.isNaN(number) ? number : null }
const toInteger = (value: string) => { const number = toNumber(value); return number == null ? null : Math.round(number) }

function toVehicle(row: FleetRow, driverId: string): Vehicle {
  const docs = Object.fromEntries(DOC_FIELDS.map((field) => [field.key, (row[field.key] as string | null | undefined) ?? ""])) as Record<DocKey, string>
  return {
    id: row.id, internal: row.internal_code || row.vehicle_type || "Vehículo", plate: row.plate, engine: row.engine_number || "", chassis: row.chassis_number || "",
    kind: row.vehicle_type || "", brand: row.brand || "", model: row.model || "", year: row.year ? String(row.year) : "",
    status: STATUS_FROM_DB[row.status || "available"] ?? "Disponible", weightCapacity: row.capacity_kg != null ? String(row.capacity_kg) : "", volumeCapacity: row.capacity_cbm != null ? String(row.capacity_cbm) : "",
    location: row.current_location || "", currentKm: row.current_km != null ? String(row.current_km) : "", nextMaintenance: row.next_maintenance || "", lastMaintenance: row.last_maintenance || "",
    driverId, photoPath: row.photo_path || "", gps: row.has_gps ? row.gps_device_id || "Sí" : "No", docs,
    expiries: [...DOC_FIELDS.filter((field) => field.alert).map((field) => docs[field.key]), row.next_maintenance || ""].filter(Boolean),
  }
}

function toDriver(row: DriverRow, todayHours: string): Driver {
  const vehicleId = row.current_fleet_id || ""
  return {
    id: row.id, rut: row.rut, name: row.full_name, phone: row.phone || "—", email: row.email || "—", address: row.address || "—",
    emergencyName: row.emergency_contact_name || "", emergencyPhone: row.emergency_contact_phone || "",
    licenseNumber: row.license_number || "—", licenseClass: row.license_type || "—", licenseExpiry: formatDate(row.license_expiry), licenseExpiryRaw: row.license_expiry || "", hiredAt: formatDate(row.hire_date),
    vehicleId, todayHours, backgroundCheck: row.background_check || "", cv: row.cv || "",
    status: row.is_active === false ? "Ausente" : vehicleId ? "Asignado" : "Disponible",
  }
}

const statusStyles: Record<VehicleStatus, string> = { "En ruta": "bg-blue-50 text-blue-700", Disponible: "bg-emerald-50 text-emerald-700", "En mantenimiento": "bg-red-50 text-red-700", "Fuera de servicio": "bg-slate-100 text-slate-500" }
const movementStyles: Record<MovementStatus, string> = { Planificado: "bg-slate-100 text-slate-600", "En ejecución": "bg-orange-50 text-orange-700", Cerrado: "bg-emerald-50 text-emerald-700" }
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-navy-300 focus:ring-2 focus:ring-navy-100"
const labelClass = "mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400"

function exportCsv(name: string, rows: (string | number)[][]) { const csv = rows.map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(";")).join("\n"); const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url) }

// Formulario corto en línea para mantenciones, panas y siniestros
type QuickField = { key: string; label: string; type?: string; placeholder?: string; list?: string }
function QuickAdd({ fields, onSubmit, disabled }: { fields: QuickField[]; onSubmit: (values: Record<string, string>) => Promise<boolean>; disabled: boolean }) {
  const initial = () => Object.fromEntries(fields.map((field) => [field.key, field.type === "date" ? localDay() : ""]))
  const [values, setValues] = useState<Record<string, string>>(initial)
  return (
    <form onSubmit={async (event) => { event.preventDefault(); if (await onSubmit(values)) setValues(initial()) }} className="mb-3 grid items-end gap-2 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {fields.map((field) => (
        <label key={field.key}>
          <span className={labelClass}>{field.label}</span>
          <input type={field.type ?? "text"} list={field.list} className={inputClass} value={values[field.key]} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
        </label>
      ))}
      <button disabled={disabled} className="rounded-lg bg-navy-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Agregar</button>
    </form>
  )
}

const emptyMovementForm = { reference: "", cargo: "", service: "Consolidado" as ServiceType, arrivalVehicleId: "", departureVehicleId: "", guideFile: null as File | null, physicalFile: "" }
const emptyCraneForm = { reference: "", reason: "", location: "Patio Lo Boza", requestedFor: "", providerId: "", cost: "" }

export default function YardManagerModule() {
  const [tab, setTab] = useState<Tab>("patio")
  const [fleetRows, setFleetRows] = useState<FleetRow[]>([])
  const [driverRows, setDriverRows] = useState<DriverRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [cranes, setCranes] = useState<CraneRow[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([])
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [hoursRows, setHoursRows] = useState<HoursRow[]>([])
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [vehicleSection, setVehicleSection] = useState<"docs" | "maintenance" | "repairs" | "claims">("docs")
  const [editingVehicle, setEditingVehicle] = useState(false)
  const [vehicleDraft, setVehicleDraft] = useState<Vehicle | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({})
  const [movementForm, setMovementForm] = useState(emptyMovementForm)
  const [movementFormKey, setMovementFormKey] = useState(0) // reinicia el input de archivo
  const [craneForm, setCraneForm] = useState(emptyCraneForm)
  const [showCraneForm, setShowCraneForm] = useState(false)
  const refetchTimer = useRef<number | undefined>(undefined)

  const fetchAll = useCallback(async () => {
    const [fleetResult, driversResult, movementsResult, cranesResult, maintenanceResult, incidentsResult, hoursResult, providersResult] = await Promise.all([
      supabase.from("fleet").select("*").order("plate"),
      supabase.from("drivers").select("*").order("full_name"),
      supabase.from("yard_movements").select("*").order("moved_at", { ascending: false }).limit(200),
      supabase.from("crane_requests").select("*").order("created_at", { ascending: false }).limit(50),
      selectAll((from, to) => supabase.from("fleet_maintenance").select("*").order("performed_at", { ascending: false }).order("id").range(from, to)),
      selectAll((from, to) => supabase.from("incidents").select("id, fleet_id, incident_type, description, resolution_notes, reported_at, claim_number").not("fleet_id", "is", null).order("reported_at", { ascending: false }).order("id").range(from, to)),
      supabase.from("driver_daily_hours").select("*").eq("work_date", localDay()),
      supabase.from("providers").select("id, name").or("is_active.is.null,is_active.eq.true").order("name"),
    ])
    const failure = [fleetResult, driversResult, movementsResult, cranesResult, maintenanceResult, incidentsResult, hoursResult, providersResult].find((result) => result.error)?.error
    if (failure) setError(`No se pudo leer datos de patio: ${failure.message}`)
    if (!fleetResult.error) setFleetRows((fleetResult.data || []) as FleetRow[])
    if (!driversResult.error) setDriverRows((driversResult.data || []) as DriverRow[])
    if (!movementsResult.error) setMovements((movementsResult.data || []) as MovementRow[])
    if (!cranesResult.error) setCranes((cranesResult.data || []) as CraneRow[])
    if (!maintenanceResult.error) setMaintenance((maintenanceResult.data || []) as MaintenanceRow[])
    if (!incidentsResult.error) setIncidents((incidentsResult.data || []) as IncidentRow[])
    if (!hoursResult.error) setHoursRows((hoursResult.data || []) as HoursRow[])
    if (!providersResult.error) setProviders((providersResult.data || []) as ProviderOption[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    // Cambios desde Flota, Conductores, Nueva OT, Camioneros u otro usuario de Patio se reflejan al instante
    const scheduleFetch = () => { window.clearTimeout(refetchTimer.current); refetchTimer.current = window.setTimeout(() => fetchAll(), 250) }
    const channel = REALTIME_TABLES.reduce((current, table) => current.on("postgres_changes", { event: "*", schema: "public", table }, scheduleFetch), supabase.channel("patio-sync")).subscribe()
    return () => { window.clearTimeout(refetchTimer.current); supabase.removeChannel(channel) }
  }, [fetchAll])

  const drivers = useMemo(() => driverRows.map((row) => toDriver(row, hoursRows.find((hours) => hours.driver_id === row.id)?.hours.toString() ?? "")), [driverRows, hoursRows])
  const vehicles = useMemo(() => fleetRows.map((row) => toVehicle(row, driverRows.find((driver) => driver.current_fleet_id === row.id)?.id ?? "")), [fleetRows, driverRows])
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId)
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId)
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "Disponible" || vehicle.status === "En ruta" || vehicle.id === selectedDriver?.vehicleId)
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => [vehicle.internal, vehicle.plate, vehicle.kind, vehicle.brand, vehicle.location].join(" ").toLowerCase().includes(search.toLowerCase())), [vehicles, search])
  const filteredDrivers = useMemo(() => drivers.filter((driver) => [driver.name, driver.rut, driver.licenseClass].join(" ").toLowerCase().includes(search.toLowerCase())), [drivers, search])
  // Documentos de vehículos (y próxima mantención) + licencias de conductores que vencen en ALERT_DAYS
  const docAlerts = vehicles.filter((vehicle) => vehicle.expiries.some(expiresSoon)).length + drivers.filter((driver) => expiresSoon(driver.licenseExpiryRaw)).length
  const todayMovements = movements.filter((movement) => localDay(new Date(movement.moved_at)) === localDay())
  const vehicleName = (id: string | null) => { const vehicle = vehicles.find((item) => item.id === id); return vehicle ? `${vehicle.internal} · ${vehicle.plate}` : "Sin asignar" }
  const driverNameByVehicle = (id: string) => drivers.find((driver) => driver.vehicleId === id)?.name ?? "Sin conductor"
  const driverName = (id: string | null) => drivers.find((driver) => driver.id === id)?.name ?? "Sin conductor"
  const driverIdOfVehicle = (vehicleId: string) => driverRows.find((driver) => driver.current_fleet_id === vehicleId)?.id ?? null
  const providerName = (id: string | null) => providers.find((provider) => provider.id === id)?.name

  // Foto del vehículo: bucket privado -> URL firmada temporal
  useEffect(() => {
    let cancelled = false
    setPhotoUrl(null)
    const path = selectedVehicle?.photoPath
    if (!path) return
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => { if (!cancelled) setPhotoUrl(data?.signedUrl ?? null) })
    return () => { cancelled = true }
  }, [selectedVehicle?.photoPath])

  const finishWrite = async (errors: ({ message: string } | null | undefined)[]) => {
    const failure = errors.find(Boolean)
    if (failure) setError(`No se pudo guardar: ${failure.message}`)
    await fetchAll()
    setSaving(false)
    return !failure
  }
  const currentEmail = async () => (await supabase.auth.getSession()).data.session?.user.email ?? null
  // La referencia de patio se enlaza a la OT si coincide con orders.order_number
  const findOrderId = async (reference: string) => {
    if (!reference) return null
    const { data } = await supabase.from("orders").select("id").eq("order_number", reference).maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  }
  const uploadFile = async (folder: string, file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin"
    const path = `${folder}/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    return { path, error: uploadError }
  }
  const openFile = async (value: string) => {
    if (/^https?:\/\//.test(value)) { window.open(value, "_blank", "noopener"); return } // URLs antiguas escritas a mano en Conductores
    const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(value, 3600)
    if (signError || !data) { setError(`No se pudo abrir el archivo: ${signError?.message ?? "sin URL"}`); return }
    window.open(data.signedUrl, "_blank", "noopener")
  }

  // ---------- Flota / Conductores ----------
  // Misma regla que Flota/Conductores: el enlace es drivers.current_fleet_id; fleet.driver_name/driver_phone es copia para listados
  const assignVehicle = async (driverId: string, vehicleId: string) => {
    const driver = driverRows.find((row) => row.id === driverId)
    if (!driver) return
    setSaving(true)
    const errors: ({ message: string } | null)[] = []
    if (vehicleId) errors.push((await supabase.from("drivers").update({ current_fleet_id: null }).eq("current_fleet_id", vehicleId).neq("id", driverId)).error)
    errors.push((await supabase.from("drivers").update({ current_fleet_id: vehicleId || null }).eq("id", driverId)).error)
    if (driver.current_fleet_id && driver.current_fleet_id !== vehicleId) errors.push((await supabase.from("fleet").update({ driver_name: null, driver_phone: null }).eq("id", driver.current_fleet_id)).error)
    if (vehicleId) errors.push((await supabase.from("fleet").update({ driver_name: driver.full_name, driver_phone: driver.phone }).eq("id", vehicleId)).error)
    await finishWrite(errors)
  }

  const saveVehicle = async (draft: Vehicle) => {
    const row = fleetRows.find((item) => item.id === draft.id)
    if (!row) return
    setSaving(true)
    const outOfService = draft.status === "Fuera de servicio"
    const payload: Record<string, unknown> = {
      plate: draft.plate.trim().toUpperCase() || row.plate, vehicle_type: draft.kind || row.vehicle_type, brand: draft.brand || null, model: draft.model || null,
      year: toInteger(draft.year), capacity_kg: toNumber(draft.weightCapacity), capacity_cbm: toNumber(draft.volumeCapacity), current_location: draft.location || null,
      status: STATUS_TO_DB[draft.status], current_km: toInteger(draft.currentKm), next_maintenance: draft.nextMaintenance || null,
      internal_code: draft.internal && draft.internal !== row.vehicle_type ? draft.internal : row.internal_code ?? null,
      engine_number: draft.engine || null, chassis_number: draft.chassis || null,
      ...Object.fromEntries(DOC_FIELDS.map((field) => [field.key, draft.docs[field.key] || null])),
    }
    // Igual que Flota: solo "Fuera de servicio" (inactive) libera al conductor
    if (outOfService) { payload.driver_name = null; payload.driver_phone = null }
    const errors = [(await supabase.from("fleet").update(payload).eq("id", draft.id)).error]
    if (outOfService) errors.push((await supabase.from("drivers").update({ current_fleet_id: null }).eq("current_fleet_id", draft.id)).error)
    if (await finishWrite(errors)) setEditingVehicle(false)
  }

  const uploadVehiclePhoto = async (vehicleId: string, file: File) => {
    setSaving(true)
    const upload = await uploadFile(`fleet/${vehicleId}`, file)
    const errors: ({ message: string } | null)[] = [upload.error]
    if (!upload.error) errors.push((await supabase.from("fleet").update({ photo_path: upload.path }).eq("id", vehicleId)).error)
    await finishWrite(errors)
  }

  const addMaintenance = async (vehicle: Vehicle, values: Record<string, string>) => {
    if (!values.detail.trim()) { setError("Escribe el detalle de la mantención"); return false }
    setSaving(true)
    const currentKm = toInteger(values.currentKm)
    const errors = [(await supabase.from("fleet_maintenance").insert({ fleet_id: vehicle.id, performed_at: values.date || localDay(), detail: values.detail.trim(), current_km: currentKm, next_km: toInteger(values.nextKm) })).error]
    // Resumen en fleet: última mantención y km actual
    const summary: Record<string, unknown> = {}
    if ((values.date || localDay()) >= vehicle.lastMaintenance) summary.last_maintenance = values.date || localDay()
    if (currentKm != null && currentKm > (toInteger(vehicle.currentKm) ?? 0)) summary.current_km = currentKm
    if (Object.keys(summary).length) errors.push((await supabase.from("fleet").update(summary).eq("id", vehicle.id)).error)
    return finishWrite(errors)
  }

  const addIncident = async (vehicle: Vehicle, type: "repair" | "claim", values: Record<string, string>) => {
    if (!values.detail.trim()) { setError("Escribe el detalle"); return false }
    setSaving(true)
    const { error: insertError } = await supabase.from("incidents").insert({
      fleet_id: vehicle.id, incident_type: type, description: values.detail.trim(), reported_at: values.date || localDay(),
      resolution_notes: type === "repair" ? values.result || null : null, claim_number: type === "claim" ? values.number || null : null,
    })
    return finishWrite([insertError])
  }

  const saveHours = async (driverId: string) => {
    const value = hoursDraft[driverId]
    if (value === undefined) return
    const trimmed = value.trim()
    const hours = toNumber(trimmed)
    if (trimmed && (hours == null || hours < 0 || hours > 24)) { setError("Horas inválidas: usa un número entre 0 y 24"); return }
    setSaving(true)
    const { error: hoursError } = trimmed
      ? await supabase.from("driver_daily_hours").upsert({ driver_id: driverId, work_date: localDay(), hours, updated_at: new Date().toISOString() }, { onConflict: "driver_id,work_date" })
      : await supabase.from("driver_daily_hours").delete().eq("driver_id", driverId).eq("work_date", localDay())
    await finishWrite([hoursError])
    setHoursDraft((current) => { const next = { ...current }; delete next[driverId]; return next })
  }

  const saveDriverField = async (driverId: string, column: "emergency_contact_name" | "emergency_contact_phone", value: string) => {
    const row = driverRows.find((driver) => driver.id === driverId)
    if (!row || (row[column] || "") === value.trim()) return
    setSaving(true)
    await finishWrite([(await supabase.from("drivers").update({ [column]: value.trim() || null }).eq("id", driverId)).error])
  }

  // Antecedentes / Hoja de vida: mismas columnas que usa Conductores (background_check, cv)
  const uploadDriverFile = async (driverId: string, column: "background_check" | "cv", file: File) => {
    setSaving(true)
    const upload = await uploadFile(`drivers/${driverId}/${column}`, file)
    const errors: ({ message: string } | null)[] = [upload.error]
    if (!upload.error) errors.push((await supabase.from("drivers").update({ [column]: upload.path }).eq("id", driverId)).error)
    await finishWrite(errors)
  }

  // ---------- Planilla de patio ----------
  const submitMovement = async (event: FormEvent) => {
    event.preventDefault()
    const reference = movementForm.reference.trim()
    if (!reference || !movementForm.arrivalVehicleId || !movementForm.departureVehicleId) { setError("Completa referencia, vehículo de llegada y vehículo de salida"); return }
    setSaving(true)
    // Se guarda el chofer de cada vehículo en este momento: la asignación puede cambiar después
    const { data, error: insertError } = await supabase.from("yard_movements").insert({
      reference, order_id: await findOrderId(reference), cargo: movementForm.cargo.trim() || null, service_type: movementForm.service,
      arrival_fleet_id: movementForm.arrivalVehicleId, arrival_driver_id: driverIdOfVehicle(movementForm.arrivalVehicleId),
      departure_fleet_id: movementForm.departureVehicleId, departure_driver_id: driverIdOfVehicle(movementForm.departureVehicleId),
      physical_file: movementForm.physicalFile.trim() || null, created_by: await currentEmail(),
    }).select("id").single()
    const errors: ({ message: string } | null)[] = [insertError]
    const movementId = (data as { id: string } | null)?.id
    if (movementId && movementForm.guideFile) {
      const upload = await uploadFile(`movements/${movementId}`, movementForm.guideFile)
      errors.push(upload.error)
      if (!upload.error) errors.push((await supabase.from("yard_movements").update({ guide_photo_path: upload.path }).eq("id", movementId)).error)
    }
    if (await finishWrite(errors)) { setMovementForm(emptyMovementForm); setMovementFormKey((key) => key + 1) }
  }

  const uploadGuide = async (movementId: string, file: File) => {
    setSaving(true)
    const upload = await uploadFile(`movements/${movementId}`, file)
    const errors: ({ message: string } | null)[] = [upload.error]
    if (!upload.error) errors.push((await supabase.from("yard_movements").update({ guide_photo_path: upload.path, updated_at: new Date().toISOString() }).eq("id", movementId)).error)
    await finishWrite(errors)
  }

  const advanceMovement = async (movement: MovementRow) => {
    setSaving(true)
    await finishWrite([(await supabase.from("yard_movements").update({ status: nextOf(MOVEMENT_STATUSES, movement.status), updated_at: new Date().toISOString() }).eq("id", movement.id)).error])
  }

  const submitCrane = async (event: FormEvent) => {
    event.preventDefault()
    if (!craneForm.reason.trim()) { setError("Escribe el motivo de la grúa"); return }
    setSaving(true)
    const { error: insertError } = await supabase.from("crane_requests").insert({
      reference: craneForm.reference.trim() || null, reason: craneForm.reason.trim(), location: craneForm.location.trim() || null,
      requested_for: craneForm.requestedFor ? new Date(craneForm.requestedFor).toISOString() : null, provider_id: craneForm.providerId || null,
      cost: toNumber(craneForm.cost), created_by: await currentEmail(),
    })
    if (await finishWrite([insertError])) { setCraneForm(emptyCraneForm); setShowCraneForm(false) }
  }

  const advanceCrane = async (crane: CraneRow) => {
    setSaving(true)
    await finishWrite([(await supabase.from("crane_requests").update({ status: nextOf(CRANE_STATUSES, crane.status), updated_at: new Date().toISOString() }).eq("id", crane.id)).error])
  }

  const handleExport = () => {
    if (tab === "fleet") exportCsv("flota-vtm.csv", [["Interno", "Patente", "Tipo", "Marca", "Modelo", "Estado", "Ubicación", "Conductor", "Km", ...DOC_FIELDS.map((field) => field.label)], ...vehicles.map((v) => [v.internal, v.plate, v.kind, v.brand, v.model, v.status, v.location, driverNameByVehicle(v.id), v.currentKm, ...DOC_FIELDS.map((field) => field.date ? formatDate(v.docs[field.key]) : v.docs[field.key])])])
    else if (tab === "drivers") exportCsv("conductores-vtm.csv", [["RUT", "Nombre", "Teléfono", "Licencia", "Vencimiento", "Vehículo", "Horas hoy", "Emergencia"], ...drivers.map((d) => [d.rut, d.name, d.phone, d.licenseClass, d.licenseExpiry, vehicleName(d.vehicleId), d.todayHours, [d.emergencyName, d.emergencyPhone].filter(Boolean).join(" · ")])])
    else exportCsv("movimientos-patio-vtm.csv", [["Fecha", "Referencia", "Carga", "Servicio", "Llegada", "Chofer llegada", "Salida", "Chofer salida", "Guía", "Respaldo físico", "Estado"], ...movements.map((m) => [formatDateTime(m.moved_at), m.reference, m.cargo ?? "", m.service_type, vehicleName(m.arrival_fleet_id), driverName(m.arrival_driver_id), vehicleName(m.departure_fleet_id), driverName(m.departure_driver_id), m.guide_photo_path ? "Sí" : "Pendiente", m.physical_file ?? "", m.status])])
  }

  return <div className="min-h-full bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-navy-500"><span>Operaciones terrestres</span><span className="text-slate-300">/</span><span>Gestión conectada</span></div><h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Jefatura de Patio</h1></div><button onClick={handleExport} className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"><Icon name="download" />Exportar vista</button></div></header>
    <main className="mx-auto max-w-[1600px] space-y-4 p-5">
      {error && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[10px] font-semibold text-red-700"><span>{error}</span><button onClick={() => setError(null)} className="text-sm">×</button></div>}
      {loading && <p className="text-[10px] text-slate-400">Cargando datos de patio…</p>}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
        { label: "Flota activa", value: `${vehicles.filter((v) => v.status === "En ruta" || v.status === "Disponible").length} / ${vehicles.length}`, detail: "unidades operativas", icon: "truck" as IconName, tone: "bg-blue-50 text-blue-600" },
        { label: "Conductores asignados", value: drivers.filter((d) => d.vehicleId).length, detail: `${drivers.filter((d) => !d.vehicleId).length} sin unidad`, icon: "user" as IconName, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Movimientos hoy", value: todayMovements.length, detail: `${movements.filter((m) => m.status !== "Cerrado").length} pendientes`, icon: "gate" as IconName, tone: "bg-violet-50 text-violet-600" },
        { label: "Alertas documentales", value: docAlerts, detail: `vencen en ${ALERT_DAYS} días`, icon: "alert" as IconName, tone: "bg-red-50 text-red-600" },
      ].map((metric) => <article key={metric.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><div className={`flex size-9 items-center justify-center rounded-lg ${metric.tone}`}><Icon name={metric.icon} /></div><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><div className="mt-0.5 flex items-baseline gap-2"><strong className="text-xl text-slate-950">{metric.value}</strong><span className="text-[10px] text-slate-400">{metric.detail}</span></div></div></article>)}</section>

      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">{([{ id: "patio", label: "Planilla de patio", icon: "gate" }, { id: "fleet", label: "Flota", icon: "truck" }, { id: "drivers", label: "Conductores", icon: "user" }] as const).map((item) => <button key={item.id} onClick={() => { setTab(item.id); setSearch("") }} className={`flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold ${tab === item.id ? "bg-navy-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Icon name={item.icon} />{item.label}</button>)}</div><p className="text-[10px] text-slate-400">Sincronizado con Flota, Conductores y Nueva OT en tiempo real</p></div>

      {tab === "patio" && <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Ingreso rápido de movimiento</p><p className="mt-1 text-[10px] text-slate-400">Planilla simple para Gustavo y Jaime · si la referencia coincide con una OT, queda enlazada.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-bold text-emerald-700">Turno activo</span></div>
          <form onSubmit={submitMovement} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label><span className={labelClass}>Referencia coordinación / OT</span><input className={inputClass} value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} placeholder="COORD-10550" /></label>
            <label><span className={labelClass}>Carga / cliente</span><input className={inputClass} value={movementForm.cargo} onChange={(e) => setMovementForm({ ...movementForm, cargo: e.target.value })} placeholder="18 pallets · Cliente" /></label>
            <label><span className={labelClass}>Llegó en</span><select className={inputClass} value={movementForm.arrivalVehicleId} onChange={(e) => setMovementForm({ ...movementForm, arrivalVehicleId: e.target.value })}><option value="">Seleccionar...</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.internal} · {v.plate}</option>)}</select></label>
            <label><span className={labelClass}>Sale en</span><select className={inputClass} value={movementForm.departureVehicleId} onChange={(e) => setMovementForm({ ...movementForm, departureVehicleId: e.target.value })}><option value="">Seleccionar...</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.internal} · {v.plate}</option>)}</select></label>
            <label><span className={labelClass}>Tipo servicio</span><select className={inputClass} value={movementForm.service} onChange={(e) => setMovementForm({ ...movementForm, service: e.target.value as ServiceType })}><option>Consolidado</option><option>Exclusivo</option></select></label>
            <label><span className={labelClass}>Foto guía</span><label className={`${inputClass} flex cursor-pointer items-center gap-2 text-slate-400`}><Icon name="upload" className="size-3.5" /><span className="truncate">{movementForm.guideFile?.name || "Seleccionar imagen"}</span><input key={movementFormKey} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setMovementForm({ ...movementForm, guideFile: e.target.files?.[0] ?? null })} /></label></label>
            <label><span className={labelClass}>Respaldo físico</span><input className={inputClass} value={movementForm.physicalFile} onChange={(e) => setMovementForm({ ...movementForm, physicalFile: e.target.value })} placeholder="Archivador / folio" /></label>
            <button disabled={saving} className="self-end rounded-lg bg-navy-600 px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Registrar movimiento"}</button>
          </form>
        </section>
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><p className="text-sm font-bold text-slate-900">Trazabilidad de traspasos</p><p className="mt-1 text-[10px] text-slate-400">Llegada, retiro, salida final y respaldo de guía. Toca el estado para avanzarlo.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-bold uppercase tracking-wider text-slate-400">{["Fecha / Ref.", "Carga", "Llegó en / chofer", "Salió en / chofer", "Guía / Archivo", "Estado"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 && !loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-[10px] text-slate-400">Sin movimientos registrados.</td></tr>}
                {movements.map((m) => <tr key={m.id}>
                  <td className="px-4 py-3"><p className="text-[9px] font-bold text-slate-700">{formatDateTime(m.moved_at)}</p><p className="mt-1 font-mono text-[8px] text-slate-400">{m.reference}</p>{m.order_id && <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">OT vinculada</span>}</td>
                  <td className="px-4 py-3"><p className="text-[9px] font-semibold text-slate-700">{m.cargo || "—"}</p><span className="mt-1 inline-block rounded bg-navy-50 px-1.5 py-0.5 text-[8px] font-bold text-navy-600">{m.service_type}</span></td>
                  <td className="px-4 py-3"><p className="text-[9px] font-bold text-slate-700">{vehicleName(m.arrival_fleet_id)}</p><p className="mt-1 text-[8px] text-slate-400">{driverName(m.arrival_driver_id)}</p></td>
                  <td className="px-4 py-3"><p className="text-[9px] font-bold text-slate-700">{vehicleName(m.departure_fleet_id)}</p><p className="mt-1 text-[8px] text-slate-400">{driverName(m.departure_driver_id)}</p></td>
                  <td className="px-4 py-3">{m.guide_photo_path ? <button onClick={() => openFile(m.guide_photo_path!)} className="text-[9px] font-semibold text-blue-600 hover:underline">Ver guía</button> : <label className="cursor-pointer text-[9px] font-semibold text-orange-600 hover:underline">Foto pendiente · subir<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadGuide(m.id, file) }} /></label>}<p className="mt-1 text-[8px] text-slate-400">{m.physical_file || "Sin folio"}</p></td>
                  <td className="px-4 py-3"><button disabled={saving} onClick={() => advanceMovement(m)} title="Avanzar estado" className={`rounded-full px-2 py-1 text-[8px] font-bold ${movementStyles[m.status]}`}>{m.status}</button></td>
                </tr>)}
              </tbody>
            </table></div>
          </section>
          <aside className="self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-900">Grúa externa</p><button onClick={() => setShowCraneForm((open) => !open)} className="text-[9px] font-bold text-navy-600">{showCraneForm ? "Cancelar" : "+ Solicitar"}</button></div>
            {showCraneForm && <form onSubmit={submitCrane} className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
              <label className="block"><span className={labelClass}>Motivo</span><input className={inputClass} value={craneForm.reason} onChange={(e) => setCraneForm({ ...craneForm, reason: e.target.value })} placeholder="Contenedor con sobrepeso" /></label>
              <div className="grid grid-cols-2 gap-2"><label><span className={labelClass}>Referencia</span><input className={inputClass} value={craneForm.reference} onChange={(e) => setCraneForm({ ...craneForm, reference: e.target.value })} /></label><label><span className={labelClass}>Ubicación</span><input className={inputClass} value={craneForm.location} onChange={(e) => setCraneForm({ ...craneForm, location: e.target.value })} /></label></div>
              <label className="block"><span className={labelClass}>Fecha y hora</span><input type="datetime-local" className={inputClass} value={craneForm.requestedFor} onChange={(e) => setCraneForm({ ...craneForm, requestedFor: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-2"><label><span className={labelClass}>Proveedor</span><select className={inputClass} value={craneForm.providerId} onChange={(e) => setCraneForm({ ...craneForm, providerId: e.target.value })}><option value="">Sin definir</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label><span className={labelClass}>Costo</span><input className={inputClass} value={craneForm.cost} onChange={(e) => setCraneForm({ ...craneForm, cost: e.target.value })} placeholder="$" /></label></div>
              <button disabled={saving} className="w-full rounded-lg bg-navy-600 py-2 text-[10px] font-bold text-white disabled:opacity-50">Guardar solicitud</button>
            </form>}
            <div className="mt-3 space-y-2">
              {cranes.length === 0 && !loading && <p className="text-[10px] text-slate-400">Sin solicitudes de grúa.</p>}
              {cranes.map((c) => <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="flex justify-between gap-2"><p className="font-mono text-[9px] font-bold text-slate-700">{c.reference || "Sin referencia"}</p><button disabled={saving} onClick={() => advanceCrane(c)} title="Avanzar estado" className={`text-[8px] font-bold ${c.status === "Completada" ? "text-emerald-600" : "text-orange-600"}`}>{c.status}</button></div><p className="mt-2 text-[9px] text-slate-600">{c.reason}</p><p className="mt-1 text-[8px] text-slate-400">{formatDateTime(c.requested_for)} · {c.location || "—"}{providerName(c.provider_id) ? ` · ${providerName(c.provider_id)}` : ""}{c.cost != null ? ` · ${formatMoney(c.cost)}` : ""}</p></div>)}
            </div>
          </aside>
        </div>
      </div>}

      {tab === "fleet" && <section className="space-y-4"><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-slate-400 shadow-sm"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por interno, patente, tipo, marca o ubicación..." className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredVehicles.map((v) => <button key={v.id} onClick={() => { setSelectedVehicleId(v.id); setVehicleSection("docs"); setEditingVehicle(false) }} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-navy-300 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-slate-900">{v.internal}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{v.plate}</p></div><div className="flex items-center gap-1.5">{v.expiries.some(expiresSoon) && <span title="Documentos por vencer" className="text-red-500"><Icon name="alert" className="size-3.5" /></span>}<span className={`rounded-full px-2 py-1 text-[8px] font-bold ${statusStyles[v.status]}`}>{v.status}</span></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase text-slate-400">Tipo</p><p className="mt-1 text-[10px] font-bold text-slate-700">{v.kind}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase text-slate-400">Capacidad</p><p className="mt-1 text-[10px] font-bold text-slate-700">{formatCapacity(v.weightCapacity, "kg")}</p></div></div><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[9px]"><span className="text-slate-400">{v.location || "Sin ubicación"}</span><span className="font-bold text-navy-600">Ver ficha completa</span></div></button>)}</div></section>}

      {tab === "drivers" && <section className="space-y-4"><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-slate-400 shadow-sm"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conductor, RUT o licencia..." className="w-full bg-transparent text-xs text-slate-800 outline-none" /></label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredDrivers.map((d) => <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-navy-300 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">{d.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div><div><p className="text-xs font-bold text-slate-900">{d.name}</p><p className="mt-1 text-[9px] text-slate-400">{d.rut}</p></div></div><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${d.status === "Asignado" ? "bg-blue-50 text-blue-700" : d.status === "Disponible" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{d.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase text-slate-400">Vehículo</p><p className="mt-1 text-[10px] font-bold text-slate-700">{vehicleName(d.vehicleId)}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase text-slate-400">Horas hoy</p><p className="mt-1 text-[10px] font-bold text-slate-700">{d.todayHours ? `${d.todayHours} h` : "—"}</p></div></div>{expiresSoon(d.licenseExpiryRaw) && <p className="mt-3 text-[9px] font-bold text-red-600">Licencia vence {d.licenseExpiry}</p>}<p className="mt-3 text-right text-[9px] font-bold text-navy-600">Ver ficha personal</p></button>)}</div></section>}

    </main>

    {selectedVehicle && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedVehicleId(null) }}><section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-navy-800 px-5 py-4 text-white"><div><p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">{selectedVehicle.internal} · {selectedVehicle.kind}</p><p className="mt-1 font-mono text-lg font-bold">{selectedVehicle.plate}</p></div><button onClick={() => setSelectedVehicleId(null)} className="text-xl">×</button></div>
      <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5">{editingVehicle && vehicleDraft ? <form onSubmit={(e) => { e.preventDefault(); saveVehicle(vehicleDraft) }}>
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Datos del vehículo</p>
        <div className="grid gap-3 md:grid-cols-3">
          {([["internal", "Interno"], ["plate", "Patente"], ["kind", "Tipo"], ["brand", "Marca"], ["model", "Modelo"], ["year", "Año"], ["weightCapacity", "Capacidad kg"], ["volumeCapacity", "Capacidad m³"], ["location", "Ubicación"], ["currentKm", "Kilometraje actual"]] as const).map(([key, label]) => <label key={key}><span className={labelClass}>{label}</span><input className={inputClass} value={vehicleDraft[key]} onChange={(e) => setVehicleDraft({ ...vehicleDraft, [key]: e.target.value })} /></label>)}
          <label><span className={labelClass}>Próxima mantención</span><input type="date" className={inputClass} value={vehicleDraft.nextMaintenance} onChange={(e) => setVehicleDraft({ ...vehicleDraft, nextMaintenance: e.target.value })} /></label>
          <label><span className={labelClass}>Estado</span><select className={inputClass} value={vehicleDraft.status} onChange={(e) => setVehicleDraft({ ...vehicleDraft, status: e.target.value as VehicleStatus })}><option>En ruta</option><option>Disponible</option><option>En mantenimiento</option><option>Fuera de servicio</option></select></label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className={labelClass}>Motor · invariable</span><input className={`${inputClass} ${selectedVehicle.engine ? "bg-slate-100" : ""}`} value={vehicleDraft.engine} readOnly={!!selectedVehicle.engine} onChange={(e) => setVehicleDraft({ ...vehicleDraft, engine: e.target.value })} placeholder="Se registra una sola vez" /></label>
          <label><span className={labelClass}>Chasis · invariable</span><input className={`${inputClass} ${selectedVehicle.chassis ? "bg-slate-100" : ""}`} value={vehicleDraft.chassis} readOnly={!!selectedVehicle.chassis} onChange={(e) => setVehicleDraft({ ...vehicleDraft, chassis: e.target.value })} placeholder="Se registra una sola vez" /></label>
        </div>
        <p className="mb-2 mt-5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Documentación</p>
        <div className="grid gap-3 md:grid-cols-3">{DOC_FIELDS.map((field) => <label key={field.key}><span className={labelClass}>{field.label}</span><input type={field.date ? "date" : "text"} className={inputClass} value={vehicleDraft.docs[field.key]} onChange={(e) => setVehicleDraft({ ...vehicleDraft, docs: { ...vehicleDraft.docs, [field.key]: e.target.value } })} /></label>)}</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingVehicle(false)} className="rounded-lg border px-4 py-2 text-[10px] font-bold">Cancelar</button><button disabled={saving} className="rounded-lg bg-navy-600 px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button></div>
      </form> : <>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div>
            {photoUrl ? <img src={photoUrl} alt={selectedVehicle.internal} className="h-44 w-full rounded-xl object-cover" /> : <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300"><Icon name="truck" className="size-12" /></div>}
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-[9px] font-bold text-navy-600"><Icon name="upload" className="size-3" />{saving ? "Subiendo…" : selectedVehicle.photoPath ? "Cambiar foto" : "Subir foto"}<input type="file" accept="image/*" className="hidden" disabled={saving} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadVehiclePhoto(selectedVehicle.id, file) }} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">{[["Motor", selectedVehicle.engine || "No registrado"], ["Chasis", selectedVehicle.chassis || "No registrado"], ["Marca / Modelo", `${selectedVehicle.brand} ${selectedVehicle.model}`.trim() || "—"], ["Año", selectedVehicle.year || "—"], ["Capacidad peso", formatCapacity(selectedVehicle.weightCapacity, "kg")], ["Capacidad volumen", formatCapacity(selectedVehicle.volumeCapacity, "m³")], ["Ubicación", selectedVehicle.location || "—"], ["Conductor", driverNameByVehicle(selectedVehicle.id)], ["Kilometraje", selectedVehicle.currentKm ? `${Number(selectedVehicle.currentKm).toLocaleString("es-CL")} km` : "—"], ["GPS", selectedVehicle.gps]].map(([l, v]) => <div key={l} className="rounded-lg bg-slate-50 p-3"><p className="text-[8px] font-bold uppercase text-slate-400">{l}</p><p className="mt-1 text-[10px] font-bold text-slate-700">{v}</p></div>)}</div>
        </div>
        <div className="mt-5 flex rounded-lg bg-slate-100 p-1">{([{ id: "docs", label: "Documentación" }, { id: "maintenance", label: "Mantenciones" }, { id: "repairs", label: "Panas / Reparaciones" }, { id: "claims", label: "Siniestros" }] as const).map((s) => <button key={s.id} onClick={() => setVehicleSection(s.id)} className={`flex-1 rounded-md px-3 py-2 text-[9px] font-bold ${vehicleSection === s.id ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>{s.label}</button>)}</div>
        <div className="mt-4">
          {vehicleSection === "docs" && <div className="grid gap-2 md:grid-cols-2">{DOC_FIELDS.map((field) => { const value = selectedVehicle.docs[field.key]; const warn = field.alert && expiresSoon(value); return <div key={field.key} className={`flex items-center justify-between rounded-lg border p-3 ${warn ? "border-red-200 bg-red-50" : "border-slate-100"}`}><span className="text-[8px] font-bold uppercase text-slate-400">{field.label}</span><span className={`text-[9px] font-bold ${warn ? "text-red-700" : "text-slate-700"}`}>{field.date ? formatDate(value) : value || "—"}</span></div> })}</div>}
          {vehicleSection === "maintenance" && <div className="space-y-2">
            <QuickAdd disabled={saving} onSubmit={(values) => addMaintenance(selectedVehicle, values)} fields={[{ key: "date", label: "Fecha", type: "date" }, { key: "detail", label: "Detalle", placeholder: "Cambio de aceite y filtros" }, { key: "currentKm", label: "Km actual" }, { key: "nextKm", label: "Próxima a los km" }]} />
            {selectedVehicle.nextMaintenance && <p className={`text-[9px] font-bold ${expiresSoon(selectedVehicle.nextMaintenance) ? "text-red-600" : "text-slate-500"}`}>Próxima mantención programada: {formatDate(selectedVehicle.nextMaintenance)}</p>}
            {maintenance.filter((m) => m.fleet_id === selectedVehicle.id).map((m) => <div key={m.id} className="rounded-lg border p-3"><p className="text-[10px] font-bold">{m.detail}</p><p className="mt-1 text-[9px] text-slate-400">{formatDate(m.performed_at)}{m.current_km != null ? ` · ${m.current_km.toLocaleString("es-CL")}${m.next_km != null ? ` / ${m.next_km.toLocaleString("es-CL")}` : ""} km` : ""}</p></div>)}
            {maintenance.every((m) => m.fleet_id !== selectedVehicle.id) && <p className="text-[10px] text-slate-400">Sin mantenciones registradas{selectedVehicle.lastMaintenance ? ` · última según Flota: ${formatDate(selectedVehicle.lastMaintenance)}` : ""}.</p>}
          </div>}
          {vehicleSection === "repairs" && <div className="space-y-2">
            <QuickAdd disabled={saving} onSubmit={(values) => addIncident(selectedVehicle, "repair", values)} fields={[{ key: "date", label: "Fecha", type: "date" }, { key: "detail", label: "Detalle", placeholder: "Cambio neumático delantero" }, { key: "result", label: "Resultado", placeholder: "Operativo", list: "patio-repair-results" }]} />
            <datalist id="patio-repair-results"><option value="Operativo" /><option value="En reparación" /><option value="Fuera de servicio" /></datalist>
            {incidents.filter((i) => i.fleet_id === selectedVehicle.id && i.incident_type === "repair").map((r) => <div key={r.id} className="rounded-lg border p-3"><p className="text-[10px] font-bold">{r.description}</p><p className="mt-1 text-[9px] text-slate-400">{formatDate(r.reported_at)} · {r.resolution_notes || "Sin resultado"}</p></div>)}
            {incidents.every((i) => i.fleet_id !== selectedVehicle.id || i.incident_type !== "repair") && <p className="text-[10px] text-slate-400">Sin reparaciones registradas.</p>}
          </div>}
          {vehicleSection === "claims" && <div className="space-y-2">
            <QuickAdd disabled={saving} onSubmit={(values) => addIncident(selectedVehicle, "claim", values)} fields={[{ key: "number", label: "N° siniestro", placeholder: "SIN-2026-018" }, { key: "date", label: "Fecha", type: "date" }, { key: "detail", label: "Detalle", placeholder: "Daño en espejo durante maniobra" }]} />
            {incidents.filter((i) => i.fleet_id === selectedVehicle.id && i.incident_type === "claim").map((c) => <div key={c.id} className="rounded-lg border p-3"><p className="font-mono text-[9px] font-bold text-red-600">{c.claim_number || "Sin número"}</p><p className="mt-1 text-[10px]">{c.description}</p><p className="mt-1 text-[8px] text-slate-400">{formatDate(c.reported_at)}</p></div>)}
            {incidents.every((i) => i.fleet_id !== selectedVehicle.id || i.incident_type !== "claim") && <p className="text-[10px] text-slate-400">Sin siniestros registrados.</p>}
          </div>}
        </div>
        <div className="mt-5 flex justify-end"><button onClick={() => { setVehicleDraft({ ...selectedVehicle, docs: { ...selectedVehicle.docs } }); setEditingVehicle(true) }} className="rounded-lg bg-navy-600 px-4 py-2 text-[10px] font-bold text-white">Editar ficha</button></div>
      </>}</div>
    </section></div>}

    {selectedDriver && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedDriverId(null) }}><section className="max-h-[92vh] w-full max-w-3xl overflow-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-navy-800 px-5 py-4 text-white"><div><p className="text-[9px] font-bold uppercase text-blue-200">Ficha de conductor</p><p className="mt-1 text-base font-bold">{selectedDriver.name}</p></div><button onClick={() => setSelectedDriverId(null)} className="text-xl">×</button></div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-2">{[["RUT", selectedDriver.rut], ["Teléfono", selectedDriver.phone], ["Correo", selectedDriver.email], ["Domicilio", selectedDriver.address], ["Emergencia", [selectedDriver.emergencyName, selectedDriver.emergencyPhone].filter(Boolean).join(" · ") || "—"], ["Contratación", selectedDriver.hiredAt]].map(([l, v]) => <div key={l} className="rounded-lg bg-slate-50 p-3"><p className="text-[8px] font-bold uppercase text-slate-400">{l}</p><p className="mt-1 text-[10px] font-bold text-slate-700">{v}</p></div>)}</div>
        <div>
          <div className={`rounded-xl border p-4 ${expiresSoon(selectedDriver.licenseExpiryRaw) ? "border-red-200 bg-red-50" : "border-slate-200"}`}><p className="text-[9px] font-bold uppercase text-slate-400">Licencia</p><p className="mt-2 font-mono text-[11px] font-bold">{selectedDriver.licenseNumber}</p><p className={`mt-1 text-[9px] ${expiresSoon(selectedDriver.licenseExpiryRaw) ? "font-bold text-red-700" : "text-slate-500"}`}>Clase {selectedDriver.licenseClass} · vence {selectedDriver.licenseExpiry}</p></div>
          <label className="mt-3 block"><span className={labelClass}>Vehículo asignado</span><select className={inputClass} value={selectedDriver.vehicleId} onChange={(e) => assignVehicle(selectedDriver.id, e.target.value)} disabled={selectedDriver.status === "Ausente" || saving}><option value="">Sin asignar</option>{availableVehicles.map((v) => <option key={v.id} value={v.id}>{v.internal} · {v.plate}</option>)}</select></label>
          <label className="mt-3 block"><span className={labelClass}>Horas recorridas hoy · se guarda al salir del campo</span><input className={inputClass} inputMode="decimal" value={hoursDraft[selectedDriver.id] ?? selectedDriver.todayHours} onChange={(e) => setHoursDraft((current) => ({ ...current, [selectedDriver.id]: e.target.value }))} onBlur={() => saveHours(selectedDriver.id)} placeholder="0" /></label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label><span className={labelClass}>Contacto emergencia</span><input key={`name-${selectedDriver.id}-${selectedDriver.emergencyName}`} className={inputClass} defaultValue={selectedDriver.emergencyName} onBlur={(e) => saveDriverField(selectedDriver.id, "emergency_contact_name", e.target.value)} placeholder="Nombre" /></label>
            <label><span className={labelClass}>Teléfono emergencia</span><input key={`phone-${selectedDriver.id}-${selectedDriver.emergencyPhone}`} className={inputClass} defaultValue={selectedDriver.emergencyPhone} onBlur={(e) => saveDriverField(selectedDriver.id, "emergency_contact_phone", e.target.value)} placeholder="+56 9" /></label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">{([["background_check", "Antecedentes", selectedDriver.backgroundCheck], ["cv", "Hoja de vida", selectedDriver.cv]] as const).map(([column, label, value]) => <div key={column} className="rounded-lg border border-dashed p-3 text-center">
            <label className="flex cursor-pointer items-center justify-center gap-2 text-[9px] font-bold text-navy-600"><Icon name="upload" className="size-3" />{value ? `Reemplazar ${label.toLowerCase()}` : label}<input type="file" accept="image/*,application/pdf" className="hidden" disabled={saving} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDriverFile(selectedDriver.id, column, file) }} /></label>
            {value ? <button onClick={() => openFile(value)} className="mt-2 text-[8px] font-bold text-emerald-600 hover:underline">✓ Cargado · ver archivo</button> : <p className="mt-2 text-[8px] text-slate-400">No cargado</p>}
          </div>)}</div>
        </div>
      </div>
    </section></div>}
  </div>
}
