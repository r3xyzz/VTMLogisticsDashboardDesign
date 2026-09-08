// src/components/ClientsModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';

// Interfaz para Clientes (basada en la tabla clients)
interface Client {
    id: string;
    code: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    tax_id: string | null;
    payment_terms: string | null;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface ClientFormData {
    code: string;
    name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    address: string;
    tax_id: string;
    payment_terms: string;
    is_active: boolean;
    notes: string;
}

export default function ClientsModule() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterActive, setFilterActive] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const toasts = useToasts();

    const [formData, setFormData] = useState<ClientFormData>({
        code: '',
        name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        tax_id: '',
        payment_terms: '',
        is_active: true,
        notes: '',
    });

    useEffect(() => {
        fetchClients();
    }, [filterActive]);

    async function fetchClients() {
        try {
            setLoading(true);
            let query = supabase.from('clients').select('*').order('name');

            if (filterActive === 'active') {
                query = query.eq('is_active', true);
            } else if (filterActive === 'inactive') {
                query = query.eq('is_active', false);
            }

            const { data, error } = await query;
            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
            addToast('Error al cargar clientes', 'error');
        } finally {
            setLoading(false);
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    }

    function resetForm() {
        setFormData({
            code: '',
            name: '',
            contact_name: '',
            contact_email: '',
            contact_phone: '',
            address: '',
            tax_id: '',
            payment_terms: '',
            is_active: true,
            notes: '',
        });
        setEditingId(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.name.trim()) {
                addToast('El nombre del cliente es obligatorio', 'error');
                setLoading(false);
                return;
            }
            if (!formData.code.trim()) {
                addToast('El código del cliente es obligatorio', 'error');
                setLoading(false);
                return;
            }

            // Verificar código único
            if (!editingId) {
                const { data: existing } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('code', formData.code)
                    .maybeSingle();

                if (existing) {
                    addToast('Ya existe un cliente con este código', 'error');
                    setLoading(false);
                    return;
                }
            }

            const payload = {
                code: formData.code,
                name: formData.name,
                contact_name: formData.contact_name || null,
                contact_email: formData.contact_email || null,
                contact_phone: formData.contact_phone || null,
                address: formData.address || null,
                tax_id: formData.tax_id || null,
                payment_terms: formData.payment_terms || null,
                is_active: formData.is_active,
                notes: formData.notes || null,
            };

            let result;
            if (editingId) {
                result = await supabase
                    .from('clients')
                    .update(payload)
                    .eq('id', editingId);
            } else {
                result = await supabase
                    .from('clients')
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            addToast(
                editingId ? 'Cliente actualizado correctamente' : 'Cliente agregado correctamente',
                'success'
            );

            setIsModalOpen(false);
            resetForm();
            fetchClients();
        } catch (error) {
            console.error('Error saving client:', error);
            addToast('Error al guardar el cliente', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;

        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);

            if (error) throw error;

            addToast('Cliente eliminado correctamente', 'success');
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            addToast('Error al eliminar el cliente', 'error');
        }
    }

    function openEditModal(client: Client) {
        setEditingId(client.id);
        setFormData({
            code: client.code || '',
            name: client.name || '',
            contact_name: client.contact_name || '',
            contact_email: client.contact_email || '',
            contact_phone: client.contact_phone || '',
            address: client.address || '',
            tax_id: client.tax_id || '',
            payment_terms: client.payment_terms || '',
            is_active: client.is_active ?? true,
            notes: client.notes || '',
        });
        setIsModalOpen(true);
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    if (loading && clients.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando clientes...</p>
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
                    <h1 className="text-xl font-bold text-slate-900">🏢 Clientes</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Empresas que contratan servicios de transporte</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Agregar Cliente
                </button>
            </div>

            {/* Filtros */}
            <div className="mb-4 flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterActive('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterActive === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilterActive('active')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterActive === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Activos
                </button>
                <button
                    onClick={() => setFilterActive('inactive')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterActive === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Inactivos
                </button>
            </div>

            {clients.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No hay clientes registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clients.map((client) => (
                        <div key={client.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-slate-100" style={{ background: '#050f1c' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-white text-sm font-bold">{client.name}</div>
                                        <div className="text-blue-300 text-xs">Código: {client.code}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {client.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-2">
                                {client.contact_name && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Contacto:</span>
                                        <span className="font-medium">{client.contact_name}</span>
                                    </div>
                                )}
                                {client.contact_phone && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Teléfono:</span>
                                        <span className="font-medium">{client.contact_phone}</span>
                                    </div>
                                )}
                                {client.contact_email && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Email:</span>
                                        <span className="font-medium text-sm truncate max-w-[150px]">{client.contact_email}</span>
                                    </div>
                                )}
                                {client.tax_id && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">RUT:</span>
                                        <span className="font-medium">{client.tax_id}</span>
                                    </div>
                                )}
                                {client.address && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Dirección:</span>
                                        <span className="font-medium text-sm truncate max-w-[150px]">{client.address}</span>
                                    </div>
                                )}
                                {client.payment_terms && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Condiciones de pago:</span>
                                        <span className="font-medium">{client.payment_terms}</span>
                                    </div>
                                )}

                                {/* Fechas */}
                                <div className="flex justify-between text-xs text-slate-400 pt-1">
                                    <span>Creado: {formatDate(client.created_at)}</span>
                                    <span>Actualizado: {formatDate(client.updated_at)}</span>
                                </div>

                                {/* Notas */}
                                {client.notes && (
                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            📝 Notas
                                        </p>
                                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-20 overflow-y-auto">
                                            {client.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Acciones */}
                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                    <button
                                        onClick={() => openEditModal(client)}
                                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs flex-1"
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(client.id)}
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

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingId ? 'Editar Cliente' : 'Agregar Cliente'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Código */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: CLI-001"
                            />
                        </div>

                        {/* Nombre */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                placeholder="Ej: Walmart Chile S.A."
                            />
                        </div>

                        {/* Contacto */}
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

                        {/* Teléfono */}
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

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="contact_email"
                                value={formData.contact_email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="contacto@empresa.cl"
                            />
                        </div>

                        {/* RUT */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                            <input
                                type="text"
                                name="tax_id"
                                value={formData.tax_id}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 76.123.456-7"
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

                        {/* Condiciones de pago */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones de pago</label>
                            <input
                                type="text"
                                name="payment_terms"
                                value={formData.payment_terms}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 30 días, Contado, etc."
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
                            <label className="text-sm font-medium text-gray-700">Cliente activo</label>
                        </div>

                        {/* Notas */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                📝 Notas del cliente
                            </label>
                            <textarea
                                name="notes"
                                value={formData.notes || ''}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={3}
                                placeholder="Información adicional sobre el cliente, observaciones, datos de contacto extra, etc."
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                Ej: Prefiere contacto por WhatsApp, horarios de atención especiales, dirección de entrega alternativa, etc.
                            </p>
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