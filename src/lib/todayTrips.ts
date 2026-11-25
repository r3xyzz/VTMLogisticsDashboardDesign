// src/lib/todayTrips.ts
// Viajes de choferes para el Dashboard ("Sensor de Horarios · Choferes"): de hoy y futuros.
//   - OT reales (Nueva OT) con su chofer, camión y avance (4 documentos que sube el camionero)
//   - Servicios de Coordinación asignados a un chofer que no vienen de una OT (programación FCL/LCL, viajes futuros)
import { supabase } from './supabase'

export type TripStatus = 'programado' | 'en-espera' | 'cargando' | 'en-ruta' | 'retrasado' | 'entregado'

export interface TodayTrip {
  id: string
  source: 'ot' | 'coordinacion'
  date: string // YYYY-MM-DD del viaje ("" = sin fecha)
  orderNumber: string // OT o referencia de Coordinación
  driver: string // chofer propio o "Subcontrato · proveedor"
  plate: string
  truck: string // tipo / marca del camión (o rampla)
  client: string
  route: string // origen → paradas → destino
  pickupTime: string // hora de retiro
  deliveryBy: string // entregar a más tardar
  docs: number // documentos subidos por el camionero (de 4); 0 en servicios solo de Coordinación
  pct: number // avance 0-100
  status: TripStatus
}

export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const one = <T,>(value: T | T[] | null | undefined): T | undefined => (Array.isArray(value) ? value[0] : value ?? undefined)
const shortDate = (day: string) => day ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : ''

function deadlineOf(deliveryDate: string, deliveryTime: string, tripDate: string): Date | null {
  if (deliveryDate) return new Date(`${deliveryDate}T${deliveryTime || '23:59'}:00`)
  if (deliveryTime && tripDate) return new Date(`${tripDate}T${deliveryTime}:00`)
  return null
}

export async function fetchTrips(): Promise<TodayTrip[]> {
  const today = localDay()
  const now = new Date()

  const [ordersResult, coordinationResult] = await Promise.all([
    // OT de hoy y futuras (sin borradores) + las que siguen en tránsito de días anteriores
    supabase
      .from('orders')
      .select('id, order_number, status, origin, destination, service_date, driver_id, fleet_id, provider_id, client:clients(name), documents(pod_empty_url, load_evidence_url, pod_final_url, delivery_evidence_url)')
      .or(`service_date.gte.${today},status.eq.in_progress`)
      .neq('status', 'draft'),
    // Servicios de Coordinación de hoy en adelante (los enlazados a una OT se usan para hora, plazo y paradas)
    supabase.from('coordination_services').select('*').or(`service_date.gte.${today},order_id.not.is.null`),
  ])
  if (ordersResult.error) throw ordersResult.error
  if (coordinationResult.error) throw coordinationResult.error
  const orders = (ordersResult.data || []) as any[]
  const coordinationRows = (coordinationResult.data || []) as any[]

  const ids = (key: string) => Array.from(new Set(orders.map((order) => order[key]).filter(Boolean)))
  const [driversResult, fleetResult, providersResult] = await Promise.all([
    ids('driver_id').length ? supabase.from('drivers').select('id, full_name').in('id', ids('driver_id')) : Promise.resolve({ data: [] }),
    ids('fleet_id').length ? supabase.from('fleet').select('id, plate, vehicle_type, brand').in('id', ids('fleet_id')) : Promise.resolve({ data: [] }),
    ids('provider_id').length ? supabase.from('providers').select('id, name, vehicle_plate').in('id', ids('provider_id')) : Promise.resolve({ data: [] }),
  ])
  const byId = <T extends { id: string }>(rows: T[] | null | undefined) => new Map((rows || []).map((row) => [row.id, row]))
  const drivers = byId((driversResult.data || []) as { id: string; full_name: string }[])
  const fleet = byId((fleetResult.data || []) as { id: string; plate: string; vehicle_type: string; brand: string | null }[])
  const providers = byId((providersResult.data || []) as { id: string; name: string; vehicle_plate: string | null }[])
  const coordinationByOrder = new Map(coordinationRows.filter((row) => row.order_id).map((row) => [row.order_id, row]))

  // 1) OT reales
  const fromOrders = orders.map((order): TodayTrip => {
    const doc = one(order.documents) as Record<string, string | null> | undefined
    const docs = ['pod_empty_url', 'load_evidence_url', 'pod_final_url', 'delivery_evidence_url'].filter((key) => doc?.[key]).length
    const vehicle = order.fleet_id ? fleet.get(order.fleet_id) : undefined
    const provider = order.provider_id ? providers.get(order.provider_id) : undefined
    const coord = coordinationByOrder.get(order.id)
    const stops: string[] = Array.isArray(coord?.stops) ? coord.stops : []
    const date: string = coord?.service_date || order.service_date || ''
    const deliveryDate: string = coord?.delivery_date || ''
    const deliveryTime: string = coord?.delivery_time || ''
    const deadline = deadlineOf(deliveryDate, deliveryTime, date)
    const completed = order.status === 'completed'
    const status: TripStatus = completed ? 'entregado'
      : deadline && deadline < now ? 'retrasado'
      : order.status === 'in_progress' ? 'en-ruta'
      : docs > 0 ? 'cargando'
      : date > today ? 'programado'
      : 'en-espera'
    return {
      id: `ot-${order.id}`,
      source: 'ot',
      date,
      orderNumber: order.order_number,
      driver: order.driver_id ? drivers.get(order.driver_id)?.full_name || 'Chofer sin ficha' : provider ? `Subcontrato · ${provider.name}` : 'Sin chofer',
      plate: vehicle?.plate || provider?.vehicle_plate || '—',
      truck: vehicle ? [vehicle.vehicle_type, vehicle.brand].filter(Boolean).join(' · ') : provider ? 'Subcontrato' : '',
      client: one(order.client as { name: string } | { name: string }[])?.name || 'Sin cliente',
      route: [order.origin, ...stops, order.destination].filter(Boolean).join(' → ') || 'Sin ruta',
      pickupTime: coord?.time || '',
      deliveryBy: [shortDate(deliveryDate), deliveryTime].filter(Boolean).join(' '),
      docs,
      pct: completed ? 100 : Math.round((docs / 4) * 100),
      status,
    }
  })

  // 2) Servicios asignados a un chofer desde Coordinación (sin OT): viajes de hoy y futuros
  const fromCoordination = coordinationRows
    .filter((row) => !row.order_id && (row.driver || '').trim() && row.service_date && row.service_date >= today)
    .map((row): TodayTrip => {
      const done = !!row.done || row.status === 'Entregado'
      const deadline = deadlineOf(row.delivery_date || '', row.delivery_time || '', row.service_date)
      const status: TripStatus = done ? 'entregado'
        : deadline && deadline < now ? 'retrasado'
        : row.status === 'En tránsito' ? 'en-ruta'
        : row.service_date > today ? 'programado'
        : 'en-espera'
      return {
        id: `coord-${row.id}`,
        source: 'coordinacion',
        date: row.service_date,
        orderNumber: row.reference || 'Coordinación',
        driver: row.driver.trim(),
        plate: row.plate || '—',
        truck: [row.cargo_mode ? String(row.cargo_mode).toUpperCase() : '', row.container_size ? `${row.container_size}'` : '', row.trailer_plate ? `Rampla ${row.trailer_plate}` : ''].filter(Boolean).join(' · '),
        client: row.forwarder || 'Sin cliente',
        route: [row.pickup, ...(Array.isArray(row.stops) ? row.stops : []), row.delivery].filter(Boolean).join(' → ') || 'Sin ruta',
        pickupTime: row.time || '',
        deliveryBy: [shortDate(row.delivery_date || ''), row.delivery_time || ''].filter(Boolean).join(' '),
        docs: 0,
        pct: done ? 100 : row.status === 'En tránsito' ? 50 : 0,
        status,
      }
    })

  return [...fromOrders, ...fromCoordination].sort((a, b) =>
    `${a.date || '9999'} ${a.pickupTime || '99:99'}`.localeCompare(`${b.date || '9999'} ${b.pickupTime || '99:99'}`))
}

// Compatibilidad: solo los de hoy
export async function fetchTodayTrips(): Promise<TodayTrip[]> {
  const today = localDay()
  return (await fetchTrips()).filter((trip) => trip.date <= today || trip.status === 'en-ruta')
}
