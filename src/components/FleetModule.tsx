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

const VEHICLE_TYPES = ['Truck', 'Van', '40FR', '20FR', '40HC', '20HC', 'Flatbed', 'Refrigerated'];
const STATUSES = ['available', 'in_route', 'maintenance', 'inactive'];

export default function FleetModule() {
    const [fleet, setFleet] = useState<Fleet[]>([]);
    const [drivers, setDrivers] = useState<DriverBasic[]>([]);
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
            .select('id, rut, full_name, phone, current_fleet_id') // ✅ Incluir current_fleet_id
            .eq('is_active', true)
            .order('full_name');

        if (error) throw error;
        setDrivers((data || []) as DriverBasic[]);
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
            const previousDriverId = editingId 
                ? (fleet.find(f => f.id === editingId)?.driver_name ? 
                    drivers.find(d => d.full_name === fleet.find(f => f.id === editingId)?.driver_name)?.id || null : null)
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
                status: formData.driver_id ? 'in_route' : formData.status,
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

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este vehículo?')) return;

        try {
            // Obtener el conductor asignado antes de eliminar
            const { data: fleetData } = await supabase
                .from('fleet')
                .select('driver_name')
                .eq('id', id)
                .single();

            // Si tenía un conductor asignado, desasignarlo
            if (fleetData?.driver_name) {
                const { data: driverData } = await supabase
                    .from('drivers')
                    .select('id')
                    .eq('full_name', fleetData.driver_name)
                    .maybeSingle();

                if (driverData) {
                    await supabase
                        .from('drivers')
                        .update({ current_fleet_id: null })
                        .eq('id', driverData.id);
                }
            }

            const { error } = await supabase
                .from('fleet')
                .delete()
                .eq('id', id);

            if (error) throw error;

            addToast('Vehículo eliminado correctamente', 'success');
            fetchFleet();
            fetchDrivers();
        } catch (error) {
            console.error('Error deleting fleet:', error);
            addToast('Error al eliminar el vehículo', 'error');
        }
    }

    async function handleStatusChange(id: string, newStatus: string) {
        try {
            // Si el vehículo pasa a available o inactive, desasignar el conductor
            const shouldUnassignDriver = newStatus === 'available' || newStatus === 'inactive';
            
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
                
                // Buscar el conductor por nombre y actualizar su current_fleet_id
                const { data: driverData } = await supabase
                    .from('drivers')
                    .select('id')
                    .eq('full_name', fleetData.driver_name)
                    .maybeSingle();

                if (driverData) {
                    await supabase
                        .from('drivers')
                        .update({ current_fleet_id: null })
                        .eq('id', driverData.id);
                }
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
        const selectedDriver = drivers.find(d => d.full_name === vehicle.driver_name);
        
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
                    {fleet.map((vehicle) => (
                        <div key={vehicle.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="px-4 py-3 border-b border-slate-100" style={{ background: '#050f1c' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-white text-sm font-bold">{vehicle.plate}</div>
                                        <div className="text-blue-300 text-xs">
                                            {vehicle.brand} {vehicle.model} {vehicle.year}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(vehicle.status || '')}`}>
                                            {getStatusText(vehicle.status || '')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Tipo:</span>
                                    <span className="font-medium">{vehicle.vehicle_type}</span>
                                </div>
                                {vehicle.driver_name && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Conductor:</span>
                                        <span className="font-medium">{vehicle.driver_name}</span>
                                    </div>
                                )}
                                {vehicle.current_location && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Ubicación:</span>
                                        <span className="font-medium">{vehicle.current_location}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Capacidad:</span>
                                    <span className="font-medium">
                                        {vehicle.capacity_kg ? `${vehicle.capacity_kg} kg` : 'N/A'}
                                        {vehicle.capacity_cbm ? ` / ${vehicle.capacity_cbm} m³` : ''}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">GPS:</span>
                                    <span className={`font-medium ${vehicle.has_gps ? 'text-green-600' : 'text-red-600'}`}>
                                        {vehicle.has_gps ? '✅ Activo' : '❌ Inactivo'}
                                    </span>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                    <select
                                        value={vehicle.status || 'available'}
                                        onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
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
                                        onClick={() => handleDelete(vehicle.id)}
                                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
