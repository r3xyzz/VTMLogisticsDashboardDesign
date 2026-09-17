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

const getDescriptionPreview = (description: string | null, notes: string | null): string | null => {
    const text = description?.trim() || notes?.trim() || '';
    if (!text) return null;

    const words = text.split(/\s+/);
    return words.length > 6 ? `${words.slice(0, 6).join(' ')} ....` : text;
};

const formatAuditDate = (date: string | null | undefined): string => {
    if (!date) return 'Fecha no registrada';

    return new Date(date).toLocaleString('es-CL', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const CHILE_REGIONS = [
    'Arica y Parinacota',
    'Tarapacá',
    'Antofagasta',
    'Atacama',
    'Coquimbo',
    'Valparaíso',
    'Región Metropolitana de Santiago',
    'Libertador General Bernardo O’Higgins',
    'Maule',
    'Ñuble',
    'Biobío',
    'La Araucanía',
    'Los Ríos',
    'Los Lagos',
    'Aysén del General Carlos Ibáñez del Campo',
    'Magallanes y de la Antártica Chilena',
];

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
            destination_commune: null,
            route_type: 'one_way',
            distance_km: null,
            notes: null,
            margin: 50,
            is_active: true,
            created_by: null,
            created_by_email: null,
            updated_by: null,
            updated_by_email: null,
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
    // ✅ DUPLICAR
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
            const newCalculationId = generateUUID();
            const creatorEmail = session?.user?.email || null;

            const columnIdMap: { [oldId: string]: string } = {};
            const itemIdMap: { [oldId: string]: string } = {};

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

            const newValues = originalFull.values.map(v => ({
                id: generateUUID(),
                calculation_id: newCalculationId,
                item_id: itemIdMap[v.item_id],
                column_id: columnIdMap[v.column_id],
                value: v.value,
            }));

            const { error: calcError } = await supabase
                .from('calculations')
                .insert([{
                    id: newCalculationId,
                    name: `${originalFull.name} (copia)`,
                    description: originalFull.description,
                    origin: originalFull.origin,
                    destination: originalFull.destination,
                    destination_commune: originalFull.destination_commune,
                    route_type: originalFull.route_type || 'one_way',
                    distance_km: originalFull.distance_km,
                    notes: originalFull.notes,
                    margin: originalFull.margin,
                    is_active: true,
                    created_by: session?.user?.id || null,
                    created_by_email: creatorEmail,
                }]);

            if (calcError) throw calcError;

            if (newColumns.length > 0) {
                const { error: colError } = await supabase
                    .from('calculation_columns')
                    .insert(newColumns);
                if (colError) throw colError;
            }

            if (newItems.length > 0) {
                const { error: itemError } = await supabase
                    .from('calculation_items')
                    .insert(newItems);
                if (itemError) throw itemError;
            }

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
    // ✅ GUARDAR
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
            const creatorEmail = session?.user?.email || null;
            const editorId = session?.user?.id || null;

            if (!calculationId) {
                calculationId = generateUUID();
                
                const { error: calcError } = await supabase
                    .from('calculations')
                    .insert([{
                        id: calculationId,
                        name: updatedCalc.name || 'Sin nombre',
                        description: updatedCalc.description || null,
                        origin: updatedCalc.origin || null,
                        destination: updatedCalc.destination || null,
                        destination_commune: updatedCalc.destination_commune || null,
                        route_type: updatedCalc.route_type || 'one_way',
                        distance_km: updatedCalc.distance_km || null,
                        notes: updatedCalc.notes || null,
                        margin: updatedCalc.margin || 50,
                        is_active: true,
                        created_by: session?.user?.id || null,
                        created_by_email: creatorEmail,
                    }]);

                if (calcError) throw calcError;
                console.log('✅ Cálculo creado:', calculationId);
            } else {
                const { error: calcError } = await supabase
                    .from('calculations')
                    .update({
                        name: updatedCalc.name || 'Sin nombre',
                        description: updatedCalc.description || null,
                        origin: updatedCalc.origin || null,
                        destination: updatedCalc.destination || null,
                        destination_commune: updatedCalc.destination_commune || null,
                        route_type: updatedCalc.route_type || 'one_way',
                        distance_km: updatedCalc.distance_km || null,
                        notes: updatedCalc.notes || null,
                        margin: updatedCalc.margin || 50,
                        updated_by: editorId,
                        updated_by_email: creatorEmail,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', calculationId);

                if (calcError) throw calcError;
                console.log('✅ Cálculo actualizado:', calculationId);
            }

            // Eliminar datos antiguos (solo si es edición)
            if (updatedCalc.id) {
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

            // Insertar columnas
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

            // Insertar items
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

            // Insertar valores
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
                    if (valError) throw valError;
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
                                {/* Header del cálculo */}
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
                                                                ? `${calc.origin} → ${calc.destination}${calc.destination_commune ? ` · ${calc.destination_commune}` : ''}`
                                                        : 'Sin ruta definida'}
                                                </p>
                                            </div>
                                        </div>
                                        {getDescriptionPreview(calc.description, calc.notes) && (
                                            <p
                                                className="text-xs text-slate-500 mt-2"
                                                title={calc.description || calc.notes || ''}
                                            >
                                                {getDescriptionPreview(calc.description, calc.notes)}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                                            {calc.distance_km && (
                                                <span>📍 {calc.distance_km} km</span>
                                            )}
                                            <span>
                                                🔁 {calc.route_type === 'round_trip' ? 'Round trip' : 'One way'}
                                            </span>
                                            <span>💹 Margen {calc.margin}%</span>
                                            <span>
                                            <span>
                                                ✉️ Creado por: {calc.created_by_email || 'Correo no registrado'}
                                            </span>
                                                📅 {new Date(calc.created_at).toLocaleDateString('es-CL')}{' '}
                                                {new Date(calc.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
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

                                {/* Vista previa de la tabla */}
                                <PreviewTable calculationId={calc.id} margin={calc.margin} />
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
// ✅ COMPONENTE VISTA PREVIA DE TABLA
// ============================================
interface PreviewTableProps {
    calculationId: string;
    margin: number;
}

function PreviewTable({ calculationId, margin }: PreviewTableProps) {
    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState<CalculationColumn[]>([]);
    const [items, setItems] = useState<CalculationItem[]>([]);
    const [values, setValues] = useState<CalculationValue[]>([]);
    const [showAll, setShowAll] = useState(false);

    const MAX_PREVIEW_ROWS = 4;
    const MAX_PREVIEW_COLS = 4;

    useEffect(() => {
        fetchPreviewData();
    }, [calculationId]);

    async function fetchPreviewData() {
        try {
            setLoading(true);

            const { data: colsData } = await supabase
                .from('calculation_columns')
                .select('*')
                .eq('calculation_id', calculationId)
                .order('column_order', { ascending: true });

            const { data: itemsData } = await supabase
                .from('calculation_items')
                .select('*')
                .eq('calculation_id', calculationId)
                .order('item_order', { ascending: true });

            const { data: valuesData } = await supabase
                .from('calculation_values')
                .select('*')
                .eq('calculation_id', calculationId);

            setColumns(colsData || []);
            setItems(itemsData || []);
            setValues(valuesData || []);
        } catch (error) {
            console.error('Error al cargar preview:', error);
        } finally {
            setLoading(false);
        }
    }

    const getValue = (itemId: string, columnId: string): number => {
        const val = values.find(v => v.item_id === itemId && v.column_id === columnId);
        return val?.value || 0;
    };

    const calculateTotalCost = (columnId: string): number => {
        return items.reduce((sum, item) => sum + getValue(item.id, columnId), 0);
    };

    const calculateTotalSale = (columnId: string): number => {
        const cost = calculateTotalCost(columnId);
        return Math.round(cost * (1 + margin / 100));
    };

    if (loading) {
        return (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-400 text-center">
                ⏳ Cargando vista previa...
            </div>
        );
    }

    if (items.length === 0 || columns.length === 0) {
        return (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-400 text-center">
                No hay items o columnas para mostrar
            </div>
        );
    }

    const visibleItems = showAll ? items : items.slice(0, MAX_PREVIEW_ROWS);
    const visibleColumns = showAll ? columns : columns.slice(0, MAX_PREVIEW_COLS);
    const hasMoreItems = items.length > MAX_PREVIEW_ROWS;
    const hasMoreColumns = columns.length > MAX_PREVIEW_COLS;
    const hasMore = hasMoreItems || hasMoreColumns;

    return (
        <div className="mt-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="text-left p-1.5 border border-slate-200 font-bold text-slate-600 min-w-[100px]">
                                Item
                            </th>
                            {visibleColumns.map(col => (
                                <th key={col.id} className="text-center p-1.5 border border-slate-200 font-bold text-slate-600 min-w-[70px]">
                                    {col.name}
                                </th>
                            ))}
                            {hasMoreColumns && !showAll && (
                                <th className="text-center p-1.5 border border-slate-200 bg-slate-100 text-slate-400 font-bold min-w-[50px]">
                                    +{columns.length - MAX_PREVIEW_COLS}
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="p-1.5 border border-slate-200 text-slate-600 font-medium">
                                    {item.name}
                                </td>
                                {visibleColumns.map(col => (
                                    <td key={col.id} className="p-1.5 border border-slate-200 text-center font-mono text-slate-700">
                                        {getValue(item.id, col.id) || '-'}
                                    </td>
                                ))}
                                {hasMoreColumns && !showAll && (
                                    <td className="p-1.5 border border-slate-200 bg-slate-50 text-center text-slate-300">
                                        ...
                                    </td>
                                )}
                            </tr>
                        ))}

                        {hasMoreItems && !showAll && (
                            <tr>
                                <td 
                                    colSpan={visibleColumns.length + (hasMoreColumns && !showAll ? 2 : 1)} 
                                    className="p-1.5 text-center text-slate-400 italic border border-slate-200 bg-slate-50"
                                >
                                    ... +{items.length - MAX_PREVIEW_ROWS} items más
                                </td>
                            </tr>
                        )}

                        <tr className="bg-blue-50">
                            <td className="p-1.5 border border-slate-200 font-bold text-slate-700">
                                💰 COSTO
                            </td>
                            {visibleColumns.map(col => (
                                <td key={col.id} className="p-1.5 border border-slate-200 text-center font-mono text-blue-700 font-bold">
                                    {clp(calculateTotalCost(col.id))}
                                </td>
                            ))}
                            {hasMoreColumns && !showAll && (
                                <td className="p-1.5 border border-slate-200 bg-slate-50"></td>
                            )}
                        </tr>

                        <tr className="bg-green-50">
                            <td className="p-1.5 border border-slate-200 font-bold text-slate-700">
                                💵 VENTA
                            </td>
                            {visibleColumns.map(col => (
                                <td key={col.id} className="p-1.5 border border-slate-200 text-center font-mono text-green-700 font-bold">
                                    {clp(calculateTotalSale(col.id))}
                                </td>
                            ))}
                            {hasMoreColumns && !showAll && (
                                <td className="p-1.5 border border-slate-200 bg-slate-50"></td>
                            )}
                        </tr>
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                    {showAll ? (
                        <>
                            ▲ Mostrar menos
                        </>
                    ) : (
                        <>
                            ▼ Ver todo ({items.length} items × {columns.length} columnas)
                        </>
                    )}
                </button>
            )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-slate-500 uppercase tracking-wider">Creado por</p>
                        <p className="mt-1 text-slate-700">{calculation.created_by_email || 'Correo no registrado'}</p>
                        <p className="mt-1 text-slate-400">{formatAuditDate(calculation.created_at)}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <p className="font-bold text-blue-600 uppercase tracking-wider">Último cambio por</p>
                        <p className="mt-1 text-slate-700">{calculation.updated_by_email || 'Aún no hay ediciones registradas'}</p>
                        <p className="mt-1 text-slate-400">{calculation.updated_by_email ? formatAuditDate(calculation.updated_at) : 'Se registrará al guardar una edición'}</p>
                    </div>
                </div>

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
                            <select
                                value={localCalc.origin || ''}
                                onChange={e => updateField('origin', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar región de origen</option>
                                {localCalc.origin && !CHILE_REGIONS.includes(localCalc.origin) && (
                                    <option value={localCalc.origin}>{localCalc.origin}</option>
                                )}
                                {CHILE_REGIONS.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Destino
                            </label>
                            <select
                                value={localCalc.destination || ''}
                                onChange={e => updateField('destination', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar región de destino</option>
                                {localCalc.destination && !CHILE_REGIONS.includes(localCalc.destination) && (
                                    <option value={localCalc.destination}>{localCalc.destination}</option>
                                )}
                                {CHILE_REGIONS.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2 flex items-end gap-2">
                            <span className="pb-2 text-slate-400 text-lg" aria-hidden="true">→</span>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Comuna de destino
                                </label>
                                <input
                                    type="text"
                                    value={localCalc.destination_commune || ''}
                                    onChange={e => updateField('destination_commune', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: San Felipe, Alto Hospicio o Angol"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Tipo de recorrido
                            </label>
                            <select
                                value={localCalc.route_type || 'one_way'}
                                onChange={e => updateField('route_type', e.target.value as 'one_way' | 'round_trip')}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="one_way">One way (solo ida)</option>
                                <option value="round_trip">Round trip (ida y regreso)</option>
                            </select>
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
                                Descripción del cálculo
                            </label>
                            <textarea
                                value={localCalc.description || ''}
                                onChange={e => updateField('description', e.target.value)}
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