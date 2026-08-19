// src/components/ProvidersModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';
import type { Provider } from '../types/database';

interface ProviderFormData {
    name: string;
    rut: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    address: string;
    license_number: string;
    background_check: string;
    driver_cv: string;
    vehicle_plate: string;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_year: number;
    permit_circulation: string;
    technical_review: string;
    cargo_insurance: string;
    vehicle_insurance: string;
    has_gps: boolean;
    bank_account: string;
    is_active: boolean;
}

export default function ProvidersModule() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterActive, setFilterActive] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const toasts = useToasts();

    const [formData, setFormData] = useState<ProviderFormData>({
        name: '',
        rut: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        address: '',
        license_number: '',
        background_check: '',
        driver_cv: '',
        vehicle_plate: '',
        vehicle_brand: '',
        vehicle_model: '',
        vehicle_year: new Date().getFullYear(),
        permit_circulation: '',
        technical_review: '',
        cargo_insurance: '',
        vehicle_insurance: '',
        has_gps: true,
        bank_account: '',
        is_active: true,
    });

    useEffect(() => {
        fetchProviders();
    }, [filterActive]);

    async function fetchProviders() {
        try {
            setLoading(true);
            let query = supabase.from('providers').select('*').order('name');

            if (filterActive === 'active') {
                query = query.eq('is_active', true);
            } else if (filterActive === 'inactive') {
                query = query.eq('is_active', false);
            }

            const { data, error } = await query;
            if (error) throw error;
            setProviders(data || []);
        } catch (error) {
            console.error('Error fetching providers:', error);
            addToast('Error al cargar proveedores', 'error');
        } finally {
            setLoading(false);
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
            name: '',
            rut: '',
            contact_name: '',
            contact_phone: '',
            contact_email: '',
            address: '',
            license_number: '',
            background_check: '',
            driver_cv: '',
            vehicle_plate: '',
            vehicle_brand: '',
            vehicle_model: '',
            vehicle_year: new Date().getFullYear(),
            permit_circulation: '',
            technical_review: '',
            cargo_insurance: '',
            vehicle_insurance: '',
            has_gps: true,
            bank_account: '',
            is_active: true,
        });
        setEditingId(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.name.trim()) {
                addToast('El nombre del proveedor es obligatorio', 'error');
                setLoading(false);
                return;
            }

            const payload = {
                name: formData.name,
                rut: formData.rut || null,
                contact_name: formData.contact_name || null,
                contact_phone: formData.contact_phone || null,
                contact_email: formData.contact_email || null,
                address: formData.address || null,
                license_number: formData.license_number || null,
                background_check: formData.background_check || null,
                driver_cv: formData.driver_cv || null,
                vehicle_plate: formData.vehicle_plate || null,
                vehicle_brand: formData.vehicle_brand || null,
                vehicle_model: formData.vehicle_model || null,
                vehicle_year: formData.vehicle_year || null,
                permit_circulation: formData.permit_circulation || null,
                technical_review: formData.technical_review || null,
                cargo_insurance: formData.cargo_insurance || null,
                vehicle_insurance: formData.vehicle_insurance || null,
                has_gps: formData.has_gps,
                bank_account: formData.bank_account || null,
                is_active: formData.is_active,
            };

            let result;
            if (editingId) {
                result = await supabase
                    .from('providers')
                    .update(payload)
                    .eq('id', editingId);
            } else {
                result = await supabase
                    .from('providers')
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            addToast(
                editingId ? 'Proveedor actualizado correctamente' : 'Proveedor agregado correctamente',
                'success'
            );

            setIsModalOpen(false);
            resetForm();
            fetchProviders();
        } catch (error) {
            console.error('Error saving provider:', error);
            addToast('Error al guardar el proveedor', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;

        try {
            const { error } = await supabase
                .from('providers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            addToast('Proveedor eliminado correctamente', 'success');
            fetchProviders();
        } catch (error) {
            console.error('Error deleting provider:', error);
            addToast('Error al eliminar el proveedor', 'error');
        }
    }

    function openEditModal(provider: Provider) {
        setEditingId(provider.id);
        setFormData({
            name: provider.name,
            rut: provider.rut || '',
            contact_name: provider.contact_name || '',
            contact_phone: provider.contact_phone || '',
            contact_email: provider.contact_email || '',
            address: provider.address || '',
            license_number: provider.license_number || '',
            background_check: provider.background_check || '',
            driver_cv: provider.driver_cv || '',
            vehicle_plate: provider.vehicle_plate || '',
            vehicle_brand: provider.vehicle_brand || '',
            vehicle_model: provider.vehicle_model || '',
            vehicle_year: provider.vehicle_year || new Date().getFullYear(),
            permit_circulation: provider.permit_circulation || '',
            technical_review: provider.technical_review || '',
            cargo_insurance: provider.cargo_insurance || '',
            vehicle_insurance: provider.vehicle_insurance || '',
            has_gps: provider.has_gps ?? true,
            bank_account: provider.bank_account || '',
            is_active: provider.is_active ?? true,
        });
        setIsModalOpen(true);
    }

    function isDocumentValid(dateStr: string | null): boolean {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const today = new Date();
        return date >= today;
    }

    function getDocumentStatus(dateStr: string | null): { label: string; color: string } {
        if (!dateStr) return { label: 'No registrado', color: 'text-gray-400' };
        const valid = isDocumentValid(dateStr);
        return {
            label: valid ? '✅ Vigente' : '❌ Vencido',
            color: valid ? 'text-green-600' : 'text-red-600',
        };
    }

    if (loading && providers.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando proveedores...</p>
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
                    <h1 className="text-xl font-bold text-slate-900">🤝 Proveedores</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Transportistas terceros y documentación</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Agregar Proveedor
                </button>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterActive('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilterActive('active')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    Activos
                </button>
                <button
                    onClick={() => setFilterActive('inactive')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    Inactivos
                </button>
            </div>

            {providers.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No hay proveedores registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providers.map((provider) => (
                        <div key={provider.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="px-4 py-3 border-b border-slate-100" style={{ background: '#050f1c' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-white text-sm font-bold">{provider.name}</div>
                                        <div className="text-blue-300 text-xs">{provider.rut}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${provider.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {provider.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 space-y-2">
                                {provider.contact_name && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Contacto:</span>
                                        <span className="font-medium">{provider.contact_name}</span>
                                    </div>
                                )}
                                {provider.contact_phone && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Teléfono:</span>
                                        <span className="font-medium">{provider.contact_phone}</span>
                                    </div>
                                )}
                                {provider.vehicle_plate && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Vehículo:</span>
                                        <span className="font-medium">{provider.vehicle_plate}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">GPS:</span>
                                    <span className={`font-medium ${provider.has_gps ? 'text-green-600' : 'text-red-600'}`}>
                                        {provider.has_gps ? '✅ Activo' : '❌ Inactivo'}
                                    </span>
                                </div>

                                {/* Documentos */}
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Documentos</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Licencia:</span>
                                            <span className="font-medium">{provider.license_number || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Revisión Téc.:</span>
                                            <span className={`font-medium ${getDocumentStatus(provider.technical_review).color}`}>
                                                {getDocumentStatus(provider.technical_review).label}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Seg. Carga:</span>
                                            <span className="font-medium">{provider.cargo_insurance || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Seg. Vehículo:</span>
                                            <span className="font-medium">{provider.vehicle_insurance || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(provider)}
                                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs flex-1"
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(provider.id)}
                                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-xs flex-1"
                                    >
                                        🗑️ Eliminar
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
                title={editingId ? 'Editar Proveedor' : 'Agregar Proveedor'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: Transportes Pérez"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                            <input
                                type="text"
                                name="rut"
                                value={formData.rut}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 76.123.456-7"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                            <input
                                type="text"
                                name="contact_name"
                                value={formData.contact_name}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Nombre del contacto"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input
                                type="text"
                                name="contact_phone"
                                value={formData.contact_phone}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: +569 1234 5678"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="contact_email"
                                value={formData.contact_email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="contacto@proveedor.cl"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehículo</label>
                            <input
                                type="text"
                                name="vehicle_plate"
                                value={formData.vehicle_plate}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: ABC-123"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Licencia de Conducir</label>
                            <input
                                type="text"
                                name="license_number"
                                value={formData.license_number}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Número de licencia"
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

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm font-medium text-gray-700">Proveedor Activo</label>
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
