// src/components/DriversModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';
import type { Driver } from '../types/database';

//  TIPO PARA VEHÍCULOS (INCLUYE STATUS PARA MOSTRAR DISPONIBILIDAD)
interface AvailableFleet {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    status: string | null;
}

interface DriverFormData {
    rut: string;
    full_name: string;
    phone: string;
    email: string;
    address: string;
    license_number: string;
    license_type: string;
    license_expiry: string;
    background_check: string;
    cv: string;
    hire_date: string;
    current_fleet_id: string;
    is_active: boolean;
}

interface DriverWithFleet extends Driver {
    fleet_plate?: string | null;
    fleet_brand?: string | null;
    fleet_model?: string | null;
}

const LICENSE_TYPES = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E', 'F'];

export default function DriversModule() {
    const [drivers, setDrivers] = useState<DriverWithFleet[]>([]);
    const [fleets, setFleets] = useState<AvailableFleet[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const toasts = useToasts();

    const [formData, setFormData] = useState<DriverFormData>({
        rut: '',
        full_name: '',
        phone: '',
        email: '',
        address: '',
        license_number: '',
        license_type: '',
        license_expiry: '',
        background_check: '',
        cv: '',
        hire_date: '',
        current_fleet_id: '',
        is_active: true,
    });

    useEffect(() => {
        fetchDrivers();
        fetchFleets();
    }, [filterStatus]);

    async function fetchDrivers() {
        try {
            setLoading(true);
            
            let query = supabase.from('drivers').select('*').order('full_name');

            if (filterStatus === 'active') {
                query = query.eq('is_active', true);
            } else if (filterStatus === 'inactive') {
                query = query.eq('is_active', false);
            }

            const { data: driversData, error: driversError } = await query;
            if (driversError) throw driversError;

            const { data: fleetsData, error: fleetsError } = await supabase
                .from('fleet')
                .select('id, plate, brand, model');

            if (fleetsError) throw fleetsError;

            const driversWithFleet = (driversData || []).map((driver: Driver) => {
                const fleet = fleetsData?.find(f => f.id === driver.current_fleet_id);
                return {
                    ...driver,
                    fleet_plate: fleet?.plate || null,
                    fleet_brand: fleet?.brand || null,
                    fleet_model: fleet?.model || null,
                };
            });

            setDrivers(driversWithFleet);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            addToast('Error al cargar conductores', 'error');
        } finally {
            setLoading(false);
        }
    }

    //  FUNCIÓN ACTUALIZADA: MUESTRA TODOS LOS VEHÍCULOS, NO SOLO DISPONIBLES
    async function fetchFleets() {
        try {
            const { data, error } = await supabase
                .from('fleet')
                .select('id, plate, brand, model, status')
                .order('plate');

            if (error) throw error;
            setFleets(data || []);
        } catch (error) {
            console.error('Error fetching fleets:', error);
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
            rut: '',
            full_name: '',
            phone: '',
            email: '',
            address: '',
            license_number: '',
            license_type: '',
            license_expiry: '',
            background_check: '',
            cv: '',
            hire_date: '',
            current_fleet_id: '',
            is_active: true,
        });
        setEditingId(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.rut.trim()) {
                addToast('El RUT es obligatorio', 'error');
                setLoading(false);
                return;
            }
            if (!formData.full_name.trim()) {
                addToast('El nombre completo es obligatorio', 'error');
                setLoading(false);
                return;
            }
            if (!formData.license_number.trim()) {
                addToast('El número de licencia es obligatorio', 'error');
                setLoading(false);
                return;
            }

            if (!editingId) {
                const { data: existing } = await supabase
                    .from('drivers')
                    .select('id')
                    .eq('rut', formData.rut)
                    .maybeSingle();

                if (existing) {
                    addToast('Ya existe un conductor con este RUT', 'error');
                    setLoading(false);
                    return;
                }
            }

            const payload = {
                rut: formData.rut,
                full_name: formData.full_name,
                phone: formData.phone || null,
                email: formData.email || null,
                address: formData.address || null,
                license_number: formData.license_number,
                license_type: formData.license_type || null,
                license_expiry: formData.license_expiry || null,
                background_check: formData.background_check || null,
                cv: formData.cv || null,
                hire_date: formData.hire_date || null,
                current_fleet_id: formData.current_fleet_id || null,
                is_active: formData.is_active,
            };

            let result;
            if (editingId) {
                result = await supabase
                    .from('drivers')
                    .update(payload)
                    .eq('id', editingId);
            } else {
                result = await supabase
                    .from('drivers')
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            addToast(
                editingId ? 'Conductor actualizado correctamente' : 'Conductor agregado correctamente',
                'success'
            );

            setIsModalOpen(false);
            resetForm();
            fetchDrivers();
            fetchFleets(); // ✅ Actualizar lista de vehículos después de guardar
        } catch (error) {
            console.error('Error saving driver:', error);
            addToast('Error al guardar el conductor', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este conductor?')) return;

        try {
            const { error } = await supabase
                .from('drivers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            addToast('Conductor eliminado correctamente', 'success');
            fetchDrivers();
        } catch (error) {
            console.error('Error deleting driver:', error);
            addToast('Error al eliminar el conductor', 'error');
        }
    }

    async function handleToggleActive(id: string, currentStatus: boolean) {
        try {
            const { error } = await supabase
                .from('drivers')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            addToast(`Conductor ${!currentStatus ? 'activado' : 'desactivado'} correctamente`, 'success');
            fetchDrivers();
        } catch (error) {
            console.error('Error toggling driver status:', error);
            addToast('Error al cambiar el estado del conductor', 'error');
        }
    }

    function openEditModal(driver: DriverWithFleet) {
        setEditingId(driver.id);
        setFormData({
            rut: driver.rut || '',
            full_name: driver.full_name || '',
            phone: driver.phone || '',
            email: driver.email || '',
            address: driver.address || '',
            license_number: driver.license_number || '',
            license_type: driver.license_type || '',
            license_expiry: driver.license_expiry || '',
            background_check: driver.background_check || '',
            cv: driver.cv || '',
            hire_date: driver.hire_date || '',
            current_fleet_id: driver.current_fleet_id || '',
            is_active: driver.is_active ?? true,
        });
        setIsModalOpen(true);
    }

    function isDocumentValid(dateStr: string | null): boolean {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    }

    function getDocumentStatus(dateStr: string | null): { label: string; color: string; bg: string } {
        if (!dateStr) return { label: 'No registrado', color: 'text-gray-400', bg: 'bg-gray-100' };
        const valid = isDocumentValid(dateStr);
        const daysDiff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (valid && daysDiff <= 30) {
            return { label: `⏳ Próximo a vencer (${daysDiff} días)`, color: 'text-yellow-600', bg: 'bg-yellow-100' };
        } else if (valid) {
            return { label: '✅ Vigente', color: 'text-green-600', bg: 'bg-green-100' };
        } else {
            return { label: '❌ Vencido', color: 'text-red-600', bg: 'bg-red-100' };
        }
    }

    function hasExpiredDocuments(driver: DriverWithFleet): boolean {
        return [driver.license_expiry].some(date => date && !isDocumentValid(date));
    }

    if (loading && drivers.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando conductores...</p>
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
                    <h1 className="text-xl font-bold text-slate-900">👨‍✈️ Conductores</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión de conductores y documentación</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Agregar Conductor
                </button>
            </div>

            {/* Filtros */}
            <div className="mb-4 flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilterStatus('active')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Activos
                </button>
                <button
                    onClick={() => setFilterStatus('inactive')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Inactivos
                </button>
            </div>

            {drivers.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No hay conductores registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drivers.map((driver) => {
                        const licenseStatus = getDocumentStatus(driver.license_expiry);
                        const hasExpired = hasExpiredDocuments(driver);

                        return (
                            <div key={driver.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-slate-100" style={{ background: '#050f1c' }}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-white text-sm font-bold">{driver.full_name}</div>
                                            <div className="text-blue-300 text-xs">{driver.rut}</div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                driver.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {driver.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-4 space-y-2">
                                    {driver.phone && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Teléfono:</span>
                                            <span className="font-medium">{driver.phone}</span>
                                        </div>
                                    )}
                                    {driver.email && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Email:</span>
                                            <span className="font-medium text-sm truncate max-w-[150px]">{driver.email}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Vehículo asignado:</span>
                                        <span className="font-medium">
                                            {driver.fleet_plate ? (
                                                <span className="text-blue-600">
                                                    {driver.fleet_plate}
                                                    {driver.fleet_brand && ` (${driver.fleet_brand})`}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">Sin asignar</span>
                                            )}
                                        </span>
                                    </div>

                                    {driver.hire_date && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Contratado:</span>
                                            <span className="font-medium">
                                                {new Date(driver.hire_date).toLocaleDateString('es-CL')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Documentos */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documentos</p>
                                            {hasExpired && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                    ⚠️ Documentos vencidos
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Licencia de conducir</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-medium">
                                                        {driver.license_number || 'N/A'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${licenseStatus.bg} ${licenseStatus.color}`}>
                                                        {licenseStatus.label}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Antecedentes</span>
                                                <span className={`font-medium ${
                                                    driver.background_check ? 'text-green-600' : 'text-gray-400'
                                                }`}>
                                                    {driver.background_check ? '✅ Cargado' : '❌ No cargado'}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500">CV / Hoja de vida</span>
                                                <span className={`font-medium ${
                                                    driver.cv ? 'text-green-600' : 'text-gray-400'
                                                }`}>
                                                    {driver.cv ? '✅ Cargado' : '❌ No cargado'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(driver)}
                                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs flex-1"
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(driver.id, driver.is_active ?? false)}
                                            className={`px-3 py-1 rounded text-xs flex-1 ${
                                                driver.is_active 
                                                    ? 'text-yellow-600 hover:bg-yellow-50' 
                                                    : 'text-green-600 hover:bg-green-50'
                                            }`}
                                        >
                                            {driver.is_active ? '⏸️ Desactivar' : '▶️ Activar'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(driver.id)}
                                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-xs flex-1"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ✅ MODAL ACTUALIZADO CON SELECTOR DE VEHÍCULOS MEJORADO */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingId ? 'Editar Conductor' : 'Agregar Conductor'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* RUT */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                            <input
                                type="text"
                                name="rut"
                                value={formData.rut}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: 12.345.678-9"
                            />
                        </div>

                        {/* Nombre completo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: Juan Pérez González"
                            />
                        </div>

                        {/* Teléfono */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: +569 1234 5678"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ejemplo@email.com"
                            />
                        </div>

                        {/* Dirección */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Dirección completa"
                            />
                        </div>

                        {/* Número de licencia */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número de licencia *</label>
                            <input
                                type="text"
                                name="license_number"
                                value={formData.license_number}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: L-12345678"
                            />
                        </div>

                        {/* Tipo de licencia */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de licencia</label>
                            <select
                                name="license_type"
                                value={formData.license_type}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar tipo...</option>
                                {LICENSE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Vencimiento licencia */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento licencia</label>
                            <input
                                type="date"
                                name="license_expiry"
                                value={formData.license_expiry}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Fecha de contratación */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de contratación</label>
                            <input
                                type="date"
                                name="hire_date"
                                value={formData.hire_date}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* ✅ SELECTOR DE VEHÍCULO MEJORADO - MUESTRA TODOS LOS VEHÍCULOS */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vehículo asignado
                            </label>
                            <select
                                name="current_fleet_id"
                                value={formData.current_fleet_id}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Sin asignar</option>
                                {fleets.map(fleet => {
                                    const isAssignedToThisDriver = fleet.id === formData.current_fleet_id;
                                    
                                    // Determinar estado del vehículo
                                    let statusText = '';
                                    let statusEmoji = '';
                                    
                                    if (isAssignedToThisDriver) {
                                        statusText = '✅ Asignado actual';
                                    } else if (fleet.status === 'available') {
                                        statusText = '🟢 Disponible';
                                    } else if (fleet.status === 'in_route') {
                                        statusText = '🔵 En ruta';
                                    } else if (fleet.status === 'maintenance') {
                                        statusText = '🟡 Mantenimiento';
                                    } else if (fleet.status === 'inactive') {
                                        statusText = '⚪ Inactivo';
                                    } else {
                                        statusText = `📌 ${fleet.status || 'Sin estado'}`;
                                    }
                                    
                                    return (
                                        <option 
                                            key={fleet.id} 
                                            value={fleet.id}
                                            style={isAssignedToThisDriver ? { 
                                                fontWeight: 'bold', 
                                                backgroundColor: '#dbeafe',
                                                color: '#1e40af'
                                            } : {}}
                                        >
                                            {fleet.plate} - {fleet.brand || 'Sin marca'} {fleet.model || ''} ({statusText})
                                        </option>
                                    );
                                })}
                            </select>
                            
                            {/* ✅ Mensaje de ayuda sobre el vehículo seleccionado */}
                            {formData.current_fleet_id && (
                                <div className="mt-2 text-xs">
                                    {(() => {
                                        const selectedFleet = fleets.find(f => f.id === formData.current_fleet_id);
                                        if (!selectedFleet) return null;
                                        
                                        const isAvailable = selectedFleet.status === 'available';
                                        const isAssigned = selectedFleet.id === formData.current_fleet_id;
                                        
                                        if (isAssigned && !isAvailable) {
                                            return (
                                                <span className="text-blue-600 font-medium">
                                                    ✅ Vehículo actualmente asignado a este conductor
                                                </span>
                                            );
                                        } else if (!isAvailable) {
                                            return (
                                                <span className="text-yellow-600">
                                                    ⚠️ Vehículo en estado: <strong>{selectedFleet.status}</strong>
                                                </span>
                                            );
                                        } else {
                                            return (
                                                <span className="text-green-600">
                                                    ✅ Vehículo disponible para asignación
                                                </span>
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                            
                            {/* Mostrar cantidad de vehículos disponibles */}
                            <div className="mt-1 text-[10px] text-slate-400">
                                {fleets.filter(f => f.status === 'available').length} vehículos disponibles de {fleets.length} totales
                            </div>
                        </div>

                        {/* Antecedentes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Antecedentes (URL)</label>
                            <input
                                type="text"
                                name="background_check"
                                value={formData.background_check}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="URL del documento de antecedentes"
                            />
                        </div>

                        {/* CV */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV / Hoja de vida (URL)</label>
                            <input
                                type="text"
                                name="cv"
                                value={formData.cv}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="URL del CV"
                            />
                        </div>

                        {/* Activo */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm font-medium text-gray-700">Conductor activo</label>
                        </div>
                    </div>

                    {/* Botones */}
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