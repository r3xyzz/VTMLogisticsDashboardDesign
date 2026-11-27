// src/components/FleetModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';
import type { Fleet, DriverBasic } from '../types/database';

interface FleetFormData {
    plate: string;
    brand: string;
    model: string;
    year: number;
    vehicle_type: string;
    capacity_kg: number;
    capacity_cbm: number;
    status: string;
    driver_id: string;
    current_location: string;
    permit_circulation: string;
    technical_review: string;
    cargo_insurance: string;
    vehicle_insurance: string;
    has_gps: boolean;
}

const VEHICLE_TYPES = ['Truck', 'Boxer', 'Van', '40FR', '20FR', '40HC', '20HC', 'Flatbed', 'Refrigerated'];
const STATUSES = ['available', 'in_route', 'maintenance', 'inactive'];

// Conductor con los campos que cuentan para la documentación del vehículo
type FleetDriver = DriverBasic & {
    license_number: string | null;
    license_expiry: string | null;
    background_check: string | null;
    cv: string | null;
};

type DocState = 'ok' | 'missing' | 'expired';

// Vencido si la fecha (YYYY-MM-DD) ya pasó; sin fecha no se considera vencido
const isExpired = (date?: string | null) => !!date && new Date(`${date}T23:59:59`).getTime() < Date.now();
const docState = (present: unknown, expiry?: string | null): DocState => !present ? 'missing' : isExpired(expiry) ? 'expired' : 'ok';

// Checklist de documentos: 3 del conductor asignado + 5 del vehículo
function vehicleDocs(vehicle: Fleet, driver?: FleetDriver): { label: string; state: DocState }[] {
    return [
        { label: 'Licencia conducir', state: docState(driver?.license_number, driver?.license_expiry) },
        { label: 'Cert. antecedentes', state: docState(driver?.background_check) },
        { label: 'Hoja de vida', state: docState(driver?.cv) },
        { label: 'Permiso circulación', state: docState(vehicle.permit_circulation, vehicle.permit_expiry) },
        { label: 'Revisión técnica', state: docState(vehicle.technical_review, vehicle.technical_review) }, // technical_review es la fecha de vencimiento
        { label: 'Seguro de carga', state: docState(vehicle.cargo_insurance) },
        { label: 'Seguro vehículo', state: docState(vehicle.vehicle_insurance, vehicle.vehicle_insurance_expiry) },
        { label: 'GPS activo', state: docState(vehicle.has_gps) },
    ];
}

const DOC_PILL: Record<DocState, string> = {
    ok: 'bg-green-50 text-green-700',
    missing: 'bg-red-50 text-red-600',
    expired: 'bg-amber-50 text-amber-700',
};
const DOC_TEXT: Record<DocState, string> = { ok: '✓ OK', missing: '✗ Falta', expired: '⚠ Vencido' };
const progressColor = (pct: number) => (pct === 100 ? '#16a34a' : pct >= 50 ? '#ea580c' : '#dc2626');

export default function FleetModule() {
    const [fleet, setFleet] = useState<Fleet[]>([]);
    const [drivers, setDrivers] = useState<FleetDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const toasts = useToasts();

    const [formData, setFormData] = useState<FleetFormData>({
        plate: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        vehicle_type: VEHICLE_TYPES[0],
        capacity_kg: 0,
        capacity_cbm: 0,
        status: 'available',
        driver_id: '',
        current_location: '',
        permit_circulation: '',
        technical_review: '',
        cargo_insurance: '',
        vehicle_insurance: '',
        has_gps: true,
    });

    useEffect(() => {
        fetchFleet();
        fetchDrivers();
    }, [filterStatus]);

    async function fetchFleet() {
        try {
            setLoading(true);
            let query = supabase.from('fleet').select('*').order('plate');

            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;
            setFleet(data || []);
        } catch (error) {
            console.error('Error fetching fleet:', error);
            addToast('Error al cargar la flota', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function fetchDrivers() {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('id, rut, full_name, phone, current_fleet_id, license_number, license_expiry, background_check, cv') // documentos del conductor para el checklist
            .eq('is_active', true)
            .order('full_name');

        if (error) throw error;
        setDrivers((data || []) as FleetDriver[]);
    } catch (error) {
        console.error('Error fetching drivers:', error);
    }
}

    // FUNCIÓN PARA SINCRONIZAR LA ASIGNACIÓN DEL CONDUCTOR
    async function syncDriverAssignment(driverId: string | null, fleetId: string) {
        try {
            // Si hay un conductor seleccionado, actualizar su current_fleet_id
            if (driverId) {
                const { error: driverError } = await supabase
                    .from('drivers')
                    .update({ current_fleet_id: fleetId })
                    .eq('id', driverId);

                if (driverError) throw driverError;
            }

            // Buscar si había otro conductor asignado a este vehículo y desasignarlo
            const { data: currentDriver } = await supabase
                .from('drivers')
                .select('id')
                .eq('current_fleet_id', fleetId)
                .neq('id', driverId || '')
                .maybeSingle();

            if (currentDriver) {
                const { error: unassignError } = await supabase
                    .from('drivers')
                    .update({ current_fleet_id: null })
                    .eq('id', currentDriver.id);

                if (unassignError) throw unassignError;
            }

            // Actualizar la lista de conductores después de la sincronización
            await fetchDrivers();
        } catch (error) {
            console.error('Error syncing driver assignment:', error);
            addToast('Error al sincronizar la asignación del conductor', 'error');
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    }

    function resetForm() {
        setFormData({
            plate: '',
            brand: '',
            model: '',
            year: new Date().getFullYear(),
            vehicle_type: VEHICLE_TYPES[0],
            capacity_kg: 0,
            capacity_cbm: 0,
            status: 'available',
            driver_id: '',
            current_location: '',
            permit_circulation: '',
            technical_review: '',
            cargo_insurance: '',
            vehicle_insurance: '',
            has_gps: true,
        });
        setEditingId(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.plate.trim()) {
                addToast('La placa es obligatoria', 'error');
                setLoading(false);
                return;
            }

            if (!editingId) {
                const { data: existing } = await supabase
                    .from('fleet')
                    .select('id')
                    .eq('plate', formData.plate)
                    .maybeSingle();

                if (existing) {
                    addToast('Ya existe un vehículo con esta placa', 'error');
                    setLoading(false);
                    return;
                }
            }

            // Guardar el driver_id anterior para la sincronización
            // Enlace por id (drivers.current_fleet_id), no por nombre
            const previousDriverId = editingId
                ? drivers.find(d => d.current_fleet_id === editingId)?.id || null
                : null;

            const selectedDriver = drivers.find(d => d.id === formData.driver_id);

            const payload = {
                plate: formData.plate,
                brand: formData.brand || null,
                model: formData.model || null,
                year: formData.year || null,
                vehicle_type: formData.vehicle_type,
                capacity_kg: formData.capacity_kg || null,
                capacity_cbm: formData.capacity_cbm || null,
                status: formData.status, // "en ruta" lo marca la OT; asignar chofer no cambia el estado
                driver_name: selectedDriver?.full_name || null,
                driver_phone: selectedDriver?.phone || null,
                driver_license: null,
                current_location: formData.current_location || null,
                permit_circulation: formData.permit_circulation || null,
                technical_review: formData.technical_review || null,
                cargo_insurance: formData.cargo_insurance || null,
                vehicle_insurance: formData.vehicle_insurance || null,
                has_gps: formData.has_gps,
            };

            let result;
            let fleetId = editingId;

            if (editingId) {
                result = await supabase
                    .from('fleet')
                    .update(payload)
                    .eq('id', editingId);
            } else {
                const insertResult = await supabase
                    .from('fleet')
                    .insert([payload])
                    .select();
                
                if (insertResult.error) throw insertResult.error;
                fleetId = insertResult.data?.[0]?.id;
                result = insertResult;
            }

            if (result.error) throw result.error;

            // Sincronizar la asignación del conductor si se seleccionó uno
            if (fleetId && formData.driver_id) {
                // Si había un conductor anterior y es diferente, desasignarlo
                if (previousDriverId && previousDriverId !== formData.driver_id) {
                    await supabase
                        .from('drivers')
                        .update({ current_fleet_id: null })
                        .eq('id', previousDriverId);
                }
                
                await syncDriverAssignment(formData.driver_id, fleetId);
            } else if (fleetId && !formData.driver_id && previousDriverId) {
                // Si se desasignó el conductor, limpiar su current_fleet_id
                await supabase
                    .from('drivers')
                    .update({ current_fleet_id: null })
                    .eq('id', previousDriverId);
            }

            addToast(
                editingId ? 'Vehículo actualizado correctamente' : 'Vehículo agregado correctamente',
                'success'
            );

            setIsModalOpen(false);
            resetForm();
            fetchFleet();
            fetchDrivers();
        } catch (error) {
            console.error('Error saving fleet:', error);
            addToast('Error al guardar el vehículo', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Confirmación con modal propio (window.confirm lo bloquean algunos navegadores embebidos)
    const [pendingDelete, setPendingDelete] = useState<{ id: string; plate: string } | null>(null);

    async function handleDelete(id: string) {
        setPendingDelete(null);
        try {
            // Obtener el conductor asignado antes de eliminar
            const { data: fleetData } = await supabase
                .from('fleet')
                .select('driver_name')
                .eq('id', id)
                .single();

            // Si tenía un conductor asignado, desasignarlo (por id, no por nombre)
            if (fleetData?.driver_name) {
                await supabase
                    .from('drivers')
                    .update({ current_fleet_id: null })
                    .eq('current_fleet_id', id);
            }

            const { error } = await supabase
                .from('fleet')
                .delete()
                .eq('id', id);

            if (error) throw error;

            addToast('Vehículo eliminado correctamente', 'success');
            fetchFleet();
            fetchDrivers();
        } catch (error: any) {
            console.error('Error al eliminar vehículo:', error);
            // 23503 = otra tabla tiene registros de este vehículo
            addToast(error?.code === '23503'
                ? `No se puede eliminar: tiene registros asociados (${error.details || error.message}). Márcalo "Fuera de servicio" en su lugar.`
                : `Error al eliminar el vehículo: ${error?.message || 'error desconocido'}`, 'error');
        }
    }

    async function handleStatusChange(id: string, newStatus: string) {
        try {
            // Solo "inactivo" desasigna el conductor ("disponible" = libre para un viaje, conserva su chofer)
            const shouldUnassignDriver = newStatus === 'inactive';
            
            // Primero obtener el vehículo actual
            const { data: fleetData } = await supabase
                .from('fleet')
                .select('driver_name')
                .eq('id', id)
                .single();

            let updateData: any = { status: newStatus };

            if (shouldUnassignDriver && fleetData?.driver_name) {
                // Desasignar el conductor del vehículo
                updateData.driver_name = null;
                updateData.driver_phone = null;
                
                await supabase
                    .from('drivers')
                    .update({ current_fleet_id: null })
                    .eq('current_fleet_id', id);
            }

            const { error } = await supabase
                .from('fleet')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            addToast('Estado actualizado correctamente', 'success');
            fetchFleet();
            fetchDrivers();
        } catch (error) {
            console.error('Error updating status:', error);
            addToast('Error al actualizar el estado', 'error');
        }
    }

    function openEditModal(vehicle: Fleet) {
        setEditingId(vehicle.id);
        const selectedDriver = drivers.find(d => d.current_fleet_id === vehicle.id);
        
        setFormData({
            plate: vehicle.plate,
            brand: vehicle.brand || '',
            model: vehicle.model || '',
            year: vehicle.year || new Date().getFullYear(),
            vehicle_type: vehicle.vehicle_type,
            capacity_kg: vehicle.capacity_kg || 0,
            capacity_cbm: vehicle.capacity_cbm || 0,
            status: vehicle.status || 'available',
            driver_id: selectedDriver?.id || '',
            current_location: vehicle.current_location || '',
            permit_circulation: vehicle.permit_circulation || '',
            technical_review: vehicle.technical_review || '',
            cargo_insurance: vehicle.cargo_insurance || '',
            vehicle_insurance: vehicle.vehicle_insurance || '',
            has_gps: vehicle.has_gps ?? true,
        });
        setIsModalOpen(true);
    }

    function getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            available: 'bg-green-100 text-green-800',
            in_route: 'bg-blue-100 text-blue-800',
            maintenance: 'bg-yellow-100 text-yellow-800',
            inactive: 'bg-red-100 text-red-800',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    }

    function getStatusText(status: string): string {
        const texts: Record<string, string> = {
            available: 'Disponible',
            in_route: 'En Ruta',
            maintenance: 'Mantenimiento',
            inactive: 'Inactivo',
        };
        return texts[status] || status;
    }

    if (loading && fleet.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando flota...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-screen-xl mx-auto">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => {}}
                />
            ))}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">🚛 Flota de Vehículos</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión de vehículos propios y conductores</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Agregar Vehículo
                </button>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    Todos
                </button>
                {STATUSES.map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        {getStatusText(status)}
                    </button>
                ))}
            </div>

            {fleet.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No hay vehículos registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fleet.map((vehicle) => {
                        const driver = drivers.find(d => d.current_fleet_id === vehicle.id);
                        const docs = vehicleDocs(vehicle, driver);
                        const okCount = docs.filter(doc => doc.state === 'ok').length;
                        const pct = Math.round((okCount / docs.length) * 100);
                        const color = progressColor(pct);
                        return (
                        <div key={vehicle.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                            {/* Cabecera: conductor, patente · tipo y avance de documentación */}
                            <div className="px-4 pt-3.5 pb-3" style={{ background: '#050f1c' }}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-white text-[15px] font-bold truncate">{driver?.full_name || vehicle.driver_name || 'Sin conductor'}</div>
                                        <div className="mt-0.5 font-mono text-xs text-blue-300">
                                            {vehicle.plate} · {vehicle.vehicle_type}
                                            {vehicle.capacity_kg ? ` ${Number(vehicle.capacity_kg).toLocaleString('es-CL')} kg` : ''}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-2xl font-bold leading-none" style={{ color }}>{pct}%</div>
                                        <div className="mt-1 text-[11px] text-slate-400">{okCount}/{docs.length} docs</div>
                                    </div>
                                </div>
                                <div className="mt-3 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                                </div>
                            </div>

                            {/* Checklist de documentos */}
                            <div className="px-4 py-2 flex-1">
                                {docs.map(doc => (
                                    <div key={doc.label} className="flex items-center justify-between py-1.5 text-[13px]">
                                        <span className="text-slate-600">{doc.label}</span>
                                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${DOC_PILL[doc.state]}`}>{DOC_TEXT[doc.state]}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Estado y acciones */}
                            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${getStatusColor(vehicle.status || '')}`}>
                                    {getStatusText(vehicle.status || '')}
                                </span>
                                <select
                                    value={vehicle.status || 'available'}
                                    onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-0"
                                >
                                    <option value="available">Disponible</option>
                                    <option value="in_route">En Ruta</option>
                                    <option value="maintenance">Mantenimiento</option>
                                    <option value="inactive">Inactivo</option>
                                </select>
                                <button
                                    onClick={() => openEditModal(vehicle)}
                                    className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => setPendingDelete({ id: vehicle.id, plate: vehicle.plate })}
                                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmar eliminación */}
            <Modal isOpen={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Eliminar vehículo" size="sm">
                <p className="text-sm text-gray-700">¿Seguro que quieres eliminar el vehículo <b>{pendingDelete?.plate}</b>? No se puede deshacer.</p>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={() => setPendingDelete(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancelar</button>
                    <button onClick={() => pendingDelete && handleDelete(pendingDelete.id)} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Eliminar</button>
                </div>
            </Modal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingId ? 'Editar Vehículo' : 'Agregar Vehículo'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
                            <input
                                type="text"
                                name="plate"
                                value={formData.plate}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: ABC-123"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Vehículo *</label>
                            <select
                                name="vehicle_type"
                                value={formData.vehicle_type}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                {VEHICLE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                            <input
                                type="text"
                                name="brand"
                                value={formData.brand}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Mercedes-Benz"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                            <input
                                type="text"
                                name="model"
                                value={formData.model}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Actros"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                            <input
                                type="number"
                                name="year"
                                value={formData.year}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 2020"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="available">Disponible</option>
                                <option value="in_route">En Ruta</option>
                                <option value="maintenance">Mantenimiento</option>
                                <option value="inactive">Inactivo</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad (kg)</label>
                            <input
                                type="number"
                                name="capacity_kg"
                                value={formData.capacity_kg}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 15000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad (m³)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="capacity_cbm"
                                value={formData.capacity_cbm}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 45.5"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Conductor Asignado</label>
                            <select
                                name="driver_id"
                                value={formData.driver_id}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Sin asignar</option>
                                {drivers.map(driver => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.full_name} ({driver.rut})
                                        {driver.current_fleet_id ? ' ⚠️ Asignado a otro vehículo' : ''}
                                    </option>
                                ))}
                            </select>
                            {formData.driver_id && drivers.find(d => d.id === formData.driver_id)?.current_fleet_id && (
                                <div className="mt-1 text-xs text-yellow-600">
                                    ⚠️ Este conductor ya está asignado a otro vehículo
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación Actual</label>
                            <input
                                type="text"
                                name="current_location"
                                value={formData.current_location}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Santiago, Valparaíso"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Permiso de Circulación</label>
                            <input
                                type="text"
                                name="permit_circulation"
                                value={formData.permit_circulation}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de permiso"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Revisión Técnica</label>
                            <input
                                type="date"
                                name="technical_review"
                                value={formData.technical_review}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Seguro de Carga</label>
                            <input
                                type="text"
                                name="cargo_insurance"
                                value={formData.cargo_insurance}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de póliza"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Seguro del Vehículo</label>
                            <input
                                type="text"
                                name="vehicle_insurance"
                                value={formData.vehicle_insurance}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de póliza"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="has_gps"
                                checked={formData.has_gps}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm font-medium text-gray-700">GPS Activo</label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
