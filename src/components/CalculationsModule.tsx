// src/components/CalculationsModule.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { addToast, useToasts, Toast } from './ui/Toast';
import type { 
    Calculation, 
    CalculationColumn, 
    CalculationItem, 
    CalculationValue,
    CalculationFull 
} from '../types/database';

const clp = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

// ✅ Helper para generar UUIDs reales
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para navegadores antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export default function CalculationsModule() {
    const [calculations, setCalculations] = useState<Calculation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCalc, setSelectedCalc] = useState<CalculationFull | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const toasts = useToasts();

    useEffect(() => {
        fetchCalculations();
    }, []);

    // ============================================
    // ✅ CARGAR CÁLCULOS
    // ============================================
    async function fetchCalculations() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('calculations')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCalculations(data || []);
        } catch (error) {
            console.error('❌ Error al cargar cálculos:', error);
            addToast('Error al cargar los cálculos', 'error');
        } finally {
            setLoading(false);
        }
    }

    // ============================================
    // ✅ CARGAR CÁLCULO COMPLETO
    // ============================================
    async function fetchCalculationFull(calculationId: string): Promise<CalculationFull | null> {
        try {
            const { data: calc, error: calcError } = await supabase
                .from('calculations')
                .select('*')
                .eq('id', calculationId)
                .single();

            if (calcError) throw calcError;

            const { data: columns, error: colError } = await supabase
                .from('calculation_columns')
                .select('*')
                .eq('calculation_id', calculationId)
                .order('column_order', { ascending: true });

            if (colError) throw colError;

            const { data: items, error: itemError } = await supabase
                .from('calculation_items')
                .select('*')
                .eq('calculation_id', calculationId)
                .order('item_order', { ascending: true });

            if (itemError) throw itemError;

            const { data: values, error: valError } = await supabase
                .from('calculation_values')
                .select('*')
                .eq('calculation_id', calculationId);

            if (valError) throw valError;

            return {
                ...calc,
                columns: columns || [],
                items: items || [],
                values: values || [],
            };
        } catch (error) {
            console.error('❌ Error al cargar cálculo completo:', error);
            return null;
        }
    }

    // ============================================
    // ✅ CREAR NUEVO
    // ============================================
    const handleCreateNew = () => {
        // ✅ Generar UUIDs reales desde el inicio
        const col1Id = generateUUID();
        const col2Id = generateUUID();
        const col3Id = generateUUID();
        const item1Id = generateUUID();
        const item2Id = generateUUID();
        const item3Id = generateUUID();

        const newCalc: CalculationFull = {
            id: '',
            name: '',
            description: null,
            origin: null,
            destination: null,
            distance_km: null,
            notes: null,
            margin: 50,
            is_active: true,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            columns: [
                { id: col1Id, calculation_id: '', name: '5 TON', column_order: 0, created_at: '' },
                { id: col2Id, calculation_id: '', name: '10 TON', column_order: 1, created_at: '' },
                { id: col3Id, calculation_id: '', name: 'RAMPLA', column_order: 2, created_at: '' },
            ],
            items: [
                { id: item1Id, calculation_id: '', name: 'Petróleo', item_order: 0, created_at: '' },
                { id: item2Id, calculation_id: '', name: 'Peajes', item_order: 1, created_at: '' },
                { id: item3Id, calculation_id: '', name: 'Viático', item_order: 2, created_at: '' },
            ],
            values: [],
        };
        setSelectedCalc(newCalc);
        setIsEditorOpen(true);
    };

    // ============================================
    // ✅ EDITAR
    // ============================================
    const handleEdit = async (calc: Calculation) => {
        const fullCalc = await fetchCalculationFull(calc.id);
        if (fullCalc) {
            setSelectedCalc(fullCalc);
            setIsEditorOpen(true);
        } else {
            addToast('Error al cargar el cálculo', 'error');
        }
    };

    // ============================================
    // ✅ ELIMINAR
    // ============================================
    const handleDelete = (id: string) => {
        setDeletingId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingId) return;

        try {
            const { error } = await supabase
                .from('calculations')
                .delete()
                .eq('id', deletingId);

            if (error) throw error;

            addToast('Cálculo eliminado correctamente', 'success');
            fetchCalculations();
            setDeletingId(null);
            setIsDeleteModalOpen(false);
        } catch (error) {
            console.error('❌ Error al eliminar:', error);
            addToast('Error al eliminar el cálculo', 'error');
        }
    };

    // ============================================
    // ✅ DUPLICAR (SIMPLIFICADO - CON UUIDs)
    // ============================================
    const handleDuplicate = async (calc: Calculation) => {
        try {
            console.log('📋 Duplicando cálculo:', calc.name);

            const originalFull = await fetchCalculationFull(calc.id);
            if (!originalFull) {
                addToast('Error al cargar el cálculo original', 'error');
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();

            // ✅ Generar nuevo ID para el cálculo
            const newCalculationId = generateUUID();

            // ✅ Crear mapeo de IDs viejos → nuevos
            const columnIdMap: { [oldId: string]: string } = {};
            const itemIdMap: { [oldId: string]: string } = {};

            // Generar nuevos UUIDs para columnas
            const newColumns = originalFull.columns.map(col => {
                const newId = generateUUID();
                columnIdMap[col.id] = newId;
                return {
                    id: newId,
                    calculation_id: newCalculationId,
                    name: col.name,
                    column_order: col.column_order,
                };
            });

            // Generar nuevos UUIDs para items
            const newItems = originalFull.items.map(item => {
                const newId = generateUUID();
                itemIdMap[item.id] = newId;
                return {
                    id: newId,
                    calculation_id: newCalculationId,
                    name: item.name,
                    item_order: item.item_order,
                };
            });

            // Generar nuevos valores con los IDs mapeados
            const newValues = originalFull.values.map(v => ({
                id: generateUUID(),
                calculation_id: newCalculationId,
                item_id: itemIdMap[v.item_id],
                column_id: columnIdMap[v.column_id],
                value: v.value,
            }));

            // ✅ Insertar todo en orden
            // 1. Cálculo principal
            const { error: calcError } = await supabase
                .from('calculations')
                .insert([{
                    id: newCalculationId,
                    name: `${originalFull.name} (copia)`,
                    description: originalFull.description,
                    origin: originalFull.origin,
                    destination: originalFull.destination,
                    distance_km: originalFull.distance_km,
                    notes: originalFull.notes,
                    margin: originalFull.margin,
                    is_active: true,
                    created_by: session?.user?.id || null,
                }]);

            if (calcError) throw calcError;

            // 2. Columnas
            if (newColumns.length > 0) {
                const { error: colError } = await supabase
                    .from('calculation_columns')
                    .insert(newColumns);

                if (colError) throw colError;
            }

            // 3. Items
            if (newItems.length > 0) {
                const { error: itemError } = await supabase
                    .from('calculation_items')
                    .insert(newItems);

                if (itemError) throw itemError;
            }

            // 4. Valores
            if (newValues.length > 0) {
                const { error: valError } = await supabase
                    .from('calculation_values')
                    .insert(newValues);

                if (valError) throw valError;
            }

            console.log('✅ Cálculo duplicado correctamente');
            addToast('Cálculo duplicado correctamente', 'success');
            fetchCalculations();
        } catch (error) {
            console.error('❌ Error al duplicar:', error);
            addToast('Error al duplicar el cálculo', 'error');
        }
    };

    // ============================================
    // ✅ GUARDAR (SIMPLIFICADO - SIN MAPEO)
    // ============================================
    const handleSave = async (updatedCalc: CalculationFull) => {
        try {
            console.log('💾 Guardando cálculo...');
            console.log('📊 Items:', updatedCalc.items.length);
            console.log('📊 Columnas:', updatedCalc.columns.length);
            console.log('📊 Valores:', updatedCalc.values.length);
            
            setLoading(true);

            const { data: { session } } = await supabase.auth.getSession();
            let calculationId = updatedCalc.id;

            // ============================================
            // 1. GUARDAR CÁLCULO PRINCIPAL
            // ============================================
            if (!calculationId) {
                // Crear nuevo con UUID generado en el frontend
                calculationId = generateUUID();
                
                const { error: calcError } = await supabase
                    .from('calculations')
                    .insert([{
                        id: calculationId,
                        name: updatedCalc.name || 'Sin nombre',
                        description: updatedCalc.description || null,
                        origin: updatedCalc.origin || null,
                        destination: updatedCalc.destination || null,
                        distance_km: updatedCalc.distance_km || null,
                        notes: updatedCalc.notes || null,
                        margin: updatedCalc.margin || 50,
                        is_active: true,
                        created_by: session?.user?.id || null,
                    }]);

                if (calcError) throw calcError;
                console.log('✅ Cálculo creado:', calculationId);
            } else {
                // Actualizar existente
                const { error: calcError } = await supabase
                    .from('calculations')
                    .update({
                        name: updatedCalc.name || 'Sin nombre',
                        description: updatedCalc.description || null,
                        origin: updatedCalc.origin || null,
                        destination: updatedCalc.destination || null,
                        distance_km: updatedCalc.distance_km || null,
                        notes: updatedCalc.notes || null,
                        margin: updatedCalc.margin || 50,
                    })
                    .eq('id', calculationId);

                if (calcError) throw calcError;
                console.log('✅ Cálculo actualizado:', calculationId);
            }

            // ============================================
            // 2. ELIMINAR DATOS ANTIGUOS (solo si es edición)
            // ============================================
            if (updatedCalc.id) {
                console.log('🗑️ Eliminando items, columnas y valores antiguos...');
                
                await supabase
                    .from('calculation_values')
                    .delete()
                    .eq('calculation_id', calculationId);

                await supabase
                    .from('calculation_items')
                    .delete()
                    .eq('calculation_id', calculationId);

                await supabase
                    .from('calculation_columns')
                    .delete()
                    .eq('calculation_id', calculationId);
            }

            // ============================================
            // 3. INSERTAR COLUMNAS (con UUIDs ya asignados)
            // ============================================
            if (updatedCalc.columns.length > 0) {
                const columnsToInsert = updatedCalc.columns.map(col => ({
                    id: col.id || generateUUID(),
                    calculation_id: calculationId,
                    name: col.name,
                    column_order: col.column_order,
                }));

                const { error: colError } = await supabase
                    .from('calculation_columns')
                    .insert(columnsToInsert);

                if (colError) throw colError;
                console.log(`✅ ${columnsToInsert.length} columnas insertadas`);
            }

            // ============================================
            // 4. INSERTAR ITEMS (con UUIDs ya asignados)
            // ============================================
            if (updatedCalc.items.length > 0) {
                const itemsToInsert = updatedCalc.items.map(item => ({
                    id: item.id || generateUUID(),
                    calculation_id: calculationId,
                    name: item.name,
                    item_order: item.item_order,
                }));

                const { error: itemError } = await supabase
                    .from('calculation_items')
                    .insert(itemsToInsert);

                if (itemError) throw itemError;
                console.log(`✅ ${itemsToInsert.length} items insertados`);
            }

            // ============================================
            // 5. INSERTAR VALORES (con IDs ya válidos)
            // ============================================
            if (updatedCalc.values.length > 0) {
                const valuesToInsert = updatedCalc.values
                    .filter(v => v.item_id && v.column_id)
                    .map(v => ({
                        id: v.id || generateUUID(),
                        calculation_id: calculationId,
                        item_id: v.item_id,
                        column_id: v.column_id,
                        value: v.value || 0,
                    }));

                if (valuesToInsert.length > 0) {
                    const { error: valError } = await supabase
                        .from('calculation_values')
                        .insert(valuesToInsert);

                    if (valError) {
                        console.error('❌ Error insertando valores:', valError);
                        throw valError;
                    }
                    console.log(`✅ ${valuesToInsert.length} valores insertados`);
                }
            }

            addToast('Cálculo guardado correctamente', 'success');
            setIsEditorOpen(false);
            setSelectedCalc(null);
            fetchCalculations();
        } catch (error) {
            console.error('❌ Error al guardar:', error);
            addToast('Error al guardar el cálculo', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // RENDER
    // ============================================
    if (loading && calculations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando cálculos...</p>
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
                    <h1 className="text-xl font-bold text-slate-900">🧮 Cálculo de Cotizaciones</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Tablas de precios para cotizar servicios</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Nuevo Cálculo
                </button>
            </div>

            {calculations.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No hay cálculos registrados</p>
                    <button
                        onClick={handleCreateNew}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Crear primer cálculo
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {calculations.map((calc) => (
                        <div
                            key={calc.id}
                            className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <span className="text-lg">📊</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-bold text-slate-800 truncate">
                                                    {calc.name || 'Sin nombre'}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    {calc.origin && calc.destination
                                                        ? `${calc.origin} → ${calc.destination}`
                                                        : 'Sin ruta definida'}
                                                </p>
                                            </div>
                                        </div>
                                        {calc.description && (
                                            <p className="text-xs text-slate-500 mt-2">{calc.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                                            {calc.distance_km && (
                                                <span>📍 {calc.distance_km} km</span>
                                            )}
                                            <span>💹 Margen {calc.margin}%</span>
                                            <span>📅 {new Date(calc.created_at).toLocaleDateString('es-CL')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleDuplicate(calc)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                                            title="Duplicar"
                                        >
                                            📋 Duplicar
                                        </button>
                                        <button
                                            onClick={() => handleEdit(calc)}
                                            className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(calc.id)}
                                            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded border border-red-200"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedCalc && (
                <CalculationEditor
                    isOpen={isEditorOpen}
                    calculation={selectedCalc}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setSelectedCalc(null);
                    }}
                    onSave={handleSave}
                    saving={loading}
                />
            )}

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar Cálculo"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        ¿Estás seguro de que quieres eliminar este cálculo? Esta acción no se puede deshacer.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ============================================
// ✅ COMPONENTE EDITOR
// ============================================
interface CalculationEditorProps {
    isOpen: boolean;
    calculation: CalculationFull;
    onClose: () => void;
    onSave: (calc: CalculationFull) => void;
    saving: boolean;
}

function CalculationEditor({ isOpen, calculation, onClose, onSave, saving }: CalculationEditorProps) {
    const [localCalc, setLocalCalc] = useState<CalculationFull>({ ...calculation });

    const updateField = (field: keyof CalculationFull, value: any) => {
        setLocalCalc(prev => ({ ...prev, [field]: value }));
    };

    // ✅ Actualizar valor de celda
    const updateValue = (itemId: string, columnId: string, value: number) => {
        setLocalCalc(prev => {
            const existingIndex = prev.values.findIndex(
                v => v.item_id === itemId && v.column_id === columnId
            );
            
            if (existingIndex >= 0) {
                const newValues = [...prev.values];
                newValues[existingIndex] = { ...newValues[existingIndex], value };
                return { ...prev, values: newValues };
            } else {
                return {
                    ...prev,
                    values: [...prev.values, {
                        id: generateUUID(),
                        calculation_id: prev.id,
                        item_id: itemId,
                        column_id: columnId,
                        value,
                        created_at: '',
                        updated_at: '',
                    }],
                };
            }
        });
    };

    const getValue = (itemId: string, columnId: string): number => {
        const val = localCalc.values.find(v => v.item_id === itemId && v.column_id === columnId);
        return val?.value || 0;
    };

    const updateItemName = (itemId: string, name: string) => {
        setLocalCalc(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, name } : item
            ),
        }));
    };

    const addItem = () => {
        const newItem: CalculationItem = {
            id: generateUUID(),
            calculation_id: localCalc.id,
            name: 'Nuevo item',
            item_order: localCalc.items.length,
            created_at: '',
        };
        setLocalCalc(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const removeItem = (itemId: string) => {
        setLocalCalc(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId),
            values: prev.values.filter(v => v.item_id !== itemId),
        }));
    };

    const updateColumnName = (columnId: string, name: string) => {
        setLocalCalc(prev => ({
            ...prev,
            columns: prev.columns.map(col =>
                col.id === columnId ? { ...col, name } : col
            ),
        }));
    };

    const addColumn = () => {
        const newCol: CalculationColumn = {
            id: generateUUID(),
            calculation_id: localCalc.id,
            name: 'Nuevo vehículo',
            column_order: localCalc.columns.length,
            created_at: '',
        };
        setLocalCalc(prev => ({ ...prev, columns: [...prev.columns, newCol] }));
    };

    const removeColumn = (columnId: string) => {
        setLocalCalc(prev => ({
            ...prev,
            columns: prev.columns.filter(c => c.id !== columnId),
            values: prev.values.filter(v => v.column_id !== columnId),
        }));
    };

    const calculateTotalCost = (columnId: string): number => {
        return localCalc.items.reduce((sum, item) => sum + getValue(item.id, columnId), 0);
    };

    const calculateTotalSale = (columnId: string): number => {
        const cost = calculateTotalCost(columnId);
        return Math.round(cost * (1 + (localCalc.margin || 0) / 100));
    };

    const handleSave = () => {
        onSave(localCalc);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="🧮 Editor de Cálculo"
            size="xl"
        >
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                {/* Info General */}
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Nombre del cálculo
                            </label>
                            <input
                                type="text"
                                value={localCalc.name || ''}
                                onChange={e => updateField('name', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Valparaíso → Santiago"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Origen
                            </label>
                            <input
                                type="text"
                                value={localCalc.origin || ''}
                                onChange={e => updateField('origin', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Valparaíso"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Destino
                            </label>
                            <input
                                type="text"
                                value={localCalc.destination || ''}
                                onChange={e => updateField('destination', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Santiago"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Distancia (km)
                            </label>
                            <input
                                type="number"
                                value={localCalc.distance_km || ''}
                                onChange={e => updateField('distance_km', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 117"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Margen (%)
                            </label>
                            <input
                                type="number"
                                value={localCalc.margin || 0}
                                onChange={e => updateField('margin', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 50"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Descripción / Notas
                            </label>
                            <textarea
                                value={localCalc.notes || ''}
                                onChange={e => updateField('notes', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={2}
                                placeholder="Información adicional, condiciones, etc."
                            />
                        </div>
                    </div>
                </div>

                {/* Tabla editable */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="text-left p-2 border border-slate-200 font-bold text-slate-600 min-w-[180px]">
                                        Item / Concepto
                                    </th>
                                    {localCalc.columns.map(col => (
                                        <th key={col.id} className="p-2 border border-slate-200 min-w-[120px]">
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={col.name}
                                                    onChange={e => updateColumnName(col.id, e.target.value)}
                                                    className="flex-1 text-center text-xs font-bold text-slate-600 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                                />
                                                <button
                                                    onClick={() => removeColumn(col.id)}
                                                    className="text-red-500 hover:text-red-700 text-xs flex-shrink-0"
                                                    title="Eliminar columna"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="p-2 border border-slate-200 bg-slate-50 w-[60px]">
                                        <button
                                            onClick={addColumn}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                                            title="Agregar columna"
                                        >
                                            + Col
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {localCalc.items.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-2 border border-slate-200">
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={e => updateItemName(item.id, e.target.value)}
                                                    className="flex-1 text-xs text-slate-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                                />
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-red-500 hover:text-red-700 text-xs flex-shrink-0"
                                                    title="Eliminar item"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </td>
                                        {localCalc.columns.map(col => (
                                            <td key={col.id} className="p-1 border border-slate-200">
                                                <input
                                                    type="number"
                                                    value={getValue(item.id, col.id) || ''}
                                                    onChange={e => updateValue(item.id, col.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-center text-xs font-mono text-slate-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 border border-slate-200 bg-slate-50"></td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={localCalc.columns.length + 2} className="p-2 border border-slate-200 bg-slate-50">
                                        <button
                                            onClick={addItem}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                                        >
                                            + Agregar Item
                                        </button>
                                    </td>
                                </tr>

                                <tr className="bg-blue-50">
                                    <td className="p-2 border border-slate-200 font-bold text-slate-700 text-xs">
                                        💰 COSTO FINAL
                                    </td>
                                    {localCalc.columns.map(col => (
                                        <td key={col.id} className="p-2 border border-slate-200 text-center font-mono text-xs font-bold text-blue-700">
                                            {clp(calculateTotalCost(col.id))}
                                        </td>
                                    ))}
                                    <td className="p-2 border border-slate-200 bg-slate-50"></td>
                                </tr>

                                <tr className="bg-green-50">
                                    <td className="p-2 border border-slate-200 font-bold text-slate-700 text-xs">
                                        💵 VENTA FINAL (margen {localCalc.margin}%)
                                    </td>
                                    {localCalc.columns.map(col => (
                                        <td key={col.id} className="p-2 border border-slate-200 text-center font-mono text-xs font-bold text-green-700">
                                            {clp(calculateTotalSale(col.id))}
                                        </td>
                                    ))}
                                    <td className="p-2 border border-slate-200 bg-slate-50"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? '⏳ Guardando...' : '💾 Guardar Cálculo'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}