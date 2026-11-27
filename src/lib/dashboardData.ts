// src/lib/dashboardData.ts
// Datos del Dashboard que vienen de los demás módulos. Todo sale de Supabase:
//   Facturación (invoices) · Flota y Patio (fleet, incidents, crane_requests) · Conductores (drivers)
//   Camioneros / Nueva OT (orders, documents) · Coordinación (coordination_services) · POD (client_notifications)
// Las tablas que el rol del usuario no puede ver llegan vacías (RLS) y sus alertas simplemente no aparecen.
import { supabase } from './supabase';
import { selectAll, selectIn } from './fetchAll';
import { daysUntil, localDay, parseDate } from './dates';
import { deadlineOf, type TodayTrip } from './todayTrips';
import { rowToInvoice, type Invoice } from '../components/facturacion/data';
import type { ActiveView } from './permissions';

export interface FleetRow {
  id: string;
  plate: string;
  status: string | null;
  technical_review?: string | null;
  permit_expiry?: string | null;
  gases_expiry?: string | null;
  vehicle_insurance_expiry?: string | null;
  extinguisher_expiry?: string | null;
}

export interface DashboardData {
  invoices: Invoice[];
  fleet: FleetRow[];
  drivers: { id: string; full_name: string; license_expiry: string | null; is_active: boolean | null }[];
  openRepairs: { id: string; fleet_id: string | null; description: string | null }[];
  pendingCranes: number;
  failedNotifications: number;
  unassignedToday: number; // servicios de hoy en Coordinación sin chofer
  deliveries: { month: string; onTime: boolean }[]; // OT entregadas (últimos 6 meses) que tenían plazo
}

type Rows<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// Una tabla que falla (o que aún no existe) no debe dejar el Dashboard en blanco
async function rows<T>(table: string, query: Rows<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.error(`Dashboard: no se pudo leer ${table}:`, error.message);
    return [];
  }
  return data ?? [];
}

const one = <T,>(value: T | T[] | null | undefined): T | undefined => (Array.isArray(value) ? value[0] : value ?? undefined);

/** Meses (YYYY-MM) desde hace `count - 1` meses hasta el actual. */
export function lastMonths(count = 6, now = new Date()): { key: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const label = date.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
    return { key: localDay(date).slice(0, 7), label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

async function fetchDeliveries(since: Date): Promise<DashboardData['deliveries']> {
  // updated_at >= since incluye todas las entregadas desde esa fecha (delivered_at <= updated_at)
  const orders = await rows('orders', selectAll((from, to) => supabase
    .from('orders')
    .select('*, documents(updated_at)')
    .eq('status', 'completed')
    .gte('updated_at', since.toISOString())
    .order('id')
    .range(from, to)));
  const coordination = await rows('coordination_services', selectIn(orders.map((order: any) => order.id), (ids) => supabase
    .from('coordination_services')
    .select('*') // delivery_time es de la migración 20261124b: con * no falla si aún no existe
    .in('order_id', ids)));
  const coordByOrder = new Map(coordination.map((row: any) => [row.order_id, row]));

  return orders.flatMap((order: any) => {
    // delivered_at lo marca la base al completar la OT (migración 20261127b); antes de eso, la última actualización
    const deliveredAt = order.delivered_at || one<{ updated_at: string }>(order.documents)?.updated_at || order.updated_at;
    const coord: any = coordByOrder.get(order.id);
    const serviceDate = String(coord?.service_date || order.service_date || '').slice(0, 10);
    const deadline = deadlineOf(coord?.delivery_date || '', coord?.delivery_time || '', serviceDate)
      ?? (serviceDate ? deadlineOf(serviceDate, '23:59', serviceDate) : null);
    if (!deliveredAt || !deadline) return [];
    const delivered = new Date(deliveredAt);
    if (delivered < since) return [];
    return [{ month: localDay(delivered).slice(0, 7), onTime: delivered <= deadline }];
  });
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const months = lastMonths(6);
  const since = new Date(`${months[0].key}-01T00:00:00`);
  const today = localDay();

  const [invoices, fleet, drivers, repairs, cranes, notifications, unassigned, deliveries] = await Promise.all([
    rows('invoices', selectAll((from, to) => supabase.from('invoices').select('*').order('id').range(from, to))),
    rows<FleetRow>('fleet', selectAll((from, to) => supabase.from('fleet').select('*').order('id').range(from, to))),
    rows<DashboardData['drivers'][number]>('drivers', supabase.from('drivers').select('id, full_name, license_expiry, is_active')),
    rows<DashboardData['openRepairs'][number]>('incidents', supabase.from('incidents').select('id, fleet_id, description').eq('incident_type', 'repair').is('resolution_notes', null)),
    rows<{ id: string }>('crane_requests', supabase.from('crane_requests').select('id').eq('status', 'Solicitada')),
    rows<{ id: string }>('client_notifications', supabase.from('client_notifications').select('id').eq('status', 'error')),
    rows<{ id: string; driver: string | null; done: boolean | null }>('coordination_services', supabase.from('coordination_services').select('id, driver, done').eq('service_date', today)),
    fetchDeliveries(since),
  ]);

  return {
    invoices: invoices.map(rowToInvoice),
    fleet,
    drivers,
    openRepairs: repairs,
    pendingCranes: cranes.length,
    failedNotifications: notifications.length,
    unassignedToday: unassigned.filter((row) => !row.done && !(row.driver || '').trim()).length,
    deliveries,
  };
}

/* ─── Series mensuales (gráficos) ───────────────────────────────────────── */

export interface MonthStat { key: string; mes: string; otd: number | null; entregas: number; aTiempo: number; facturado: number }

const countsAsBilled = (invoice: Invoice) => invoice.status !== 'Anulado' && !invoice.annulled;

export function monthlyStats(data: DashboardData, now = new Date()): MonthStat[] {
  return lastMonths(6, now).map(({ key, label }) => {
    const delivered = data.deliveries.filter((delivery) => delivery.month === key);
    const onTime = delivered.filter((delivery) => delivery.onTime).length;
    const billed = data.invoices
      .filter((invoice) => countsAsBilled(invoice) && invoice.issueDate && localDay(parseDate(invoice.issueDate)).slice(0, 7) === key)
      .reduce((sum, invoice) => sum + invoice.total, 0);
    return {
      key,
      mes: label,
      otd: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : null,
      entregas: delivered.length,
      aTiempo: onTime,
      facturado: Math.round(billed / 10_000) / 100, // millones CLP con 2 decimales
    };
  });
}

/* ─── Alertas (salen de los datos de cada módulo) ───────────────────────── */

export type AlertLevel = 'red' | 'orange' | 'blue';
export interface DashboardAlert { id: string; level: AlertLevel; area: string; msg: string; cta: string; view: ActiveView }

const FLEET_DOCS: { key: keyof FleetRow; label: string }[] = [
  { key: 'technical_review', label: 'Revisión técnica' },
  { key: 'permit_expiry', label: 'Permiso de circulación' },
  { key: 'gases_expiry', label: 'Revisión de gases' },
  { key: 'vehicle_insurance_expiry', label: 'Seguro / SOAP' },
  { key: 'extinguisher_expiry', label: 'Extintor' },
];
const DOC_ALERT_DAYS = 15;

const money = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
const expiryText = (label: string, days: number) =>
  days < 0 ? `${label} vencido hace ${-days} día${days === -1 ? '' : 's'}` : days === 0 ? `${label} vence hoy` : `${label} vence en ${days} día${days === 1 ? '' : 's'}`;

export function buildAlerts(data: DashboardData | null, trips: TodayTrip[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  // Viajes retrasados (Camioneros / Coordinación)
  for (const trip of trips.filter((t) => t.status === 'retrasado')) {
    alerts.push({
      id: `late-${trip.id}`, level: 'red', area: 'Viajes',
      msg: `${trip.orderNumber} retrasado · ${trip.driver} · ${trip.plate}. Plazo: ${trip.deliveryBy || 'sin hora'}.`,
      cta: trip.source === 'ot' ? 'Ver en Camioneros' : 'Ver en Coordinación',
      view: trip.source === 'ot' ? 'camioneros' : 'coordination',
    });
  }
  if (!data) return alerts;

  // Servicios de hoy sin chofer (Coordinación)
  if (data.unassignedToday > 0) {
    alerts.push({ id: 'coord-unassigned', level: 'orange', area: 'Coordinación', msg: `${data.unassignedToday} servicio${data.unassignedToday === 1 ? '' : 's'} de hoy sin chofer asignado.`, cta: 'Asignar', view: 'coordination' });
  }

  // Vehículos en reparación sin resultado (Jefatura de Patio)
  const plateOf = new Map(data.fleet.map((vehicle) => [vehicle.id, vehicle.plate]));
  for (const repair of data.openRepairs) {
    alerts.push({ id: `repair-${repair.id}`, level: 'orange', area: 'Patio', msg: `${plateOf.get(repair.fleet_id || '') || 'Vehículo'} en reparación${repair.description ? `: ${repair.description}` : ''}.`, cta: 'Ver en Patio', view: 'patio' });
  }

  // Documentos de vehículos vencidos o por vencer (Flota / Patio)
  for (const vehicle of data.fleet) {
    if (vehicle.status === 'inactive') continue;
    const issues = FLEET_DOCS
      .filter(({ key }) => isDate(vehicle[key]))
      .map(({ key, label }) => ({ label, days: daysUntil(vehicle[key] as string) }))
      .filter(({ days }) => days <= DOC_ALERT_DAYS);
    if (!issues.length) continue;
    const expired = issues.some(({ days }) => days < 0);
    alerts.push({ id: `fleet-docs-${vehicle.id}`, level: expired ? 'red' : 'orange', area: 'Flota', msg: `${vehicle.plate}: ${issues.map(({ label, days }) => expiryText(label, days)).join(' · ')}.`, cta: 'Ver vehículo', view: 'fleet' });
  }

  // Licencias de conductores (Conductores)
  for (const driver of data.drivers) {
    if (driver.is_active === false || !isDate(driver.license_expiry)) continue;
    const days = daysUntil(driver.license_expiry);
    if (days > DOC_ALERT_DAYS) continue;
    alerts.push({ id: `license-${driver.id}`, level: days < 0 ? 'red' : 'orange', area: 'Conductores', msg: `${driver.full_name}: ${expiryText('licencia', days)}.`, cta: 'Ver conductor', view: 'drivers' });
  }

  // Facturas vencidas y por vencer (Facturación)
  const pending = data.invoices.filter((invoice) => invoice.status !== 'Pagada' && countsAsBilled(invoice) && invoice.dueDate);
  const overdue = pending.filter((invoice) => daysUntil(invoice.dueDate) < 0);
  const dueSoon = pending.filter((invoice) => { const days = daysUntil(invoice.dueDate); return days >= 0 && days <= 7; });
  if (overdue.length) {
    alerts.push({ id: 'invoices-overdue', level: 'orange', area: 'Facturación', msg: `${overdue.length} factura${overdue.length === 1 ? '' : 's'} vencida${overdue.length === 1 ? '' : 's'} por ${money(overdue.reduce((sum, i) => sum + i.total, 0))}.`, cta: 'Ver vencimientos', view: 'facturacion' });
  }
  if (dueSoon.length) {
    alerts.push({ id: 'invoices-due-soon', level: 'blue', area: 'Facturación', msg: `${dueSoon.length} factura${dueSoon.length === 1 ? '' : 's'} vence${dueSoon.length === 1 ? '' : 'n'} en los próximos 7 días (${money(dueSoon.reduce((sum, i) => sum + i.total, 0))}).`, cta: 'Ver vencimientos', view: 'facturacion' });
  }

  // Avisos a clientes que fallaron (POD · Documentos)
  if (data.failedNotifications > 0) {
    alerts.push({ id: 'notifications-error', level: 'orange', area: 'POD', msg: `${data.failedNotifications} aviso${data.failedNotifications === 1 ? '' : 's'} al cliente no se pudo enviar.`, cta: 'Ver en POD', view: 'documents' });
  }

  // Grúas solicitadas sin confirmar (Jefatura de Patio)
  if (data.pendingCranes > 0) {
    alerts.push({ id: 'cranes-pending', level: 'blue', area: 'Patio', msg: `${data.pendingCranes} solicitud${data.pendingCranes === 1 ? '' : 'es'} de grúa sin confirmar.`, cta: 'Ver en Patio', view: 'patio' });
  }

  const order: Record<AlertLevel, number> = { red: 0, orange: 1, blue: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/* ─── Mapa: viajes de hoy por ciudad del triángulo ──────────────────────── */

export type CityId = 'VAL' | 'SCL' | 'SAN';
// Lo que no es Valparaíso ni San Antonio se cuenta en Santiago (comunas de la RM)
export function cityOf(place: string): CityId {
  if (/valpara|vi[ñn]a|quilpu|villa alemana|con\s?c[oó]n|quintero|casablanca/i.test(place)) return 'VAL';
  if (/san antonio|cartagena|llolleo|santo domingo/i.test(place)) return 'SAN';
  return 'SCL';
}

export function citiesOfRoute(route: string): Set<CityId> {
  return new Set(route.split('→').map((stop) => stop.trim()).filter((stop) => stop && stop !== 'Sin ruta').map(cityOf));
}
