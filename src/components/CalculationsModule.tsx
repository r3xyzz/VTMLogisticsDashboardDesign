// src/components/CalculationsModule.tsx
import { useState } from 'react';
import { Modal } from './ui/Modal';
import { addToast, useToasts, Toast } from './ui/Toast';

// ✅ TIPOS DE DATOS
interface CalculationColumn {
    id: string;
    name: string;
}

interface CalculationItem {
    id: string;
    name: string;
    values: { [columnId: string]: number };
}

interface Calculation {
    id: string;
    name: string;
    description: string;
    origin: string;
    destination: string;
    distance_km: number;
    notes: string;
    columns: CalculationColumn[];
    items: CalculationItem[];
    totalCost: { [columnId: string]: number };
    totalSale: { [columnId: string]: number };
    margin: number;
}

// ✅ DATOS ESTÁTICOS DE EJEMPLO
const initialCalculations: Calculation[] = [
    {
        id: '1',
        name: 'Valparaíso → Santiago',
        description: 'Servicios generales zona central',
        origin: 'Valparaíso',
        destination: 'Santiago',
        distance_km: 117,
        notes: 'Precios base sin IVA',
        margin: 50,
        columns: [
            { id: 'col1', name: '5 TON' },
            { id: 'col2', name: '10 TON' },
            { id: 'col3', name: 'RAMPLA (15 TON)' },
        ],
        items: [
            { id: 'item1', name: 'Petróleo', values: { col1: 263, col2: 300, col3: 660 } },
            { id: 'item2', name: 'Peajes', values: { col1: 150, col2: 150, col3: 250 } },
            { id: 'item3', name: 'Viático', values: { col1: 90, col2: 90, col3: 90 } },
            { id: 'item4', name: 'Estadía', values: { col1: 60, col2: 60, col3: 60 } },
            { id: 'item5', name: 'Bono', values: { col1: 50, col2: 50, col3: 50 } },
            { id: 'item6', name: 'Mantención', values: { col1: 100, col2: 100, col3: 150 } },
        ],
        totalCost: { col1: 713, col2: 750, col3: 1260 },
        totalSale: { col1: 1070, col2: 1125, col3: 1890 },
    },
    {
        id: '2',
        name: 'San Antonio → Talcahuano',
        description: 'Servicio zona sur',
        origin: 'San Antonio',
        destination: 'Talcahuano',
        distance_km: 503,
        notes: 'Incluye retiro en puerto',
        margin: 55,
        columns: [
            { id: 'col1', name: 'Camioneta' },
            { id: 'col2', name: '10 TON' },
            { id: 'col3', name: 'Rampla' },
        ],
        items: [
            { id: 'item1', name: 'Petróleo', values: { col1: 435, col2: 725, col3: 2325 } },
            { id: 'item2', name: 'Peajes', values: { col1: 60, col2: 150, col3: 200 } },
            { id: 'item3', name: 'Viáticos', values: { col1: 120, col2: 150, col3: 150 } },
            { id: 'item4', name: 'Estadía', values: { col1: 210, col2: 210, col3: 210 } },
            { id: 'item5', name: 'Bono', values: { col1: 70, col2: 70, col3: 70 } },
            { id: 'item6', name: 'Mantención', values: { col1: 100, col2: 150, col3: 200 } },
        ],
        totalCost: { col1: 995, col2: 1455, col3: 3155 },
        totalSale: { col1: 1750, col2: 2650, col3: 4150 },
    },
];

const clp = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

export default function CalculationsModule() {
    const [calculations, setCalculations] = useState<Calculation[]>(initialCalculations);
    const [selectedCalc, setSelectedCalc] = useState<Calculation | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const toasts = useToasts();

    // ✅ Crear nuevo cálculo
    const handleCreateNew = () => {
        const newCalc: Calculation = {
            id: Date.now().toString(),
            name: '',
            description: '',
            origin: '',
            destination: '',
            distance_km: 0,
            notes: '',
            margin: 50,
            columns: [
                { id: 'col1', name: '5 TON' },
                { id: 'col2', name: '10 TON' },
                { id: 'col3', name: 'RAMPLA' },
            ],
            items: [
                { id: 'item1', name: 'Petróleo', values: {} },
                { id: 'item2', name: 'Peajes', values: {} },
                { id: 'item3', name: 'Viático', values: {} },
            ],
            totalCost: {},
            totalSale: {},
        };
        setSelectedCalc(newCalc);
        setIsEditorOpen(true);
    };

    // ✅ Abrir editor
    const handleEdit = (calc: Calculation) => {
        setSelectedCalc({ ...calc });
        setIsEditorOpen(true);
    };

    // ✅ Eliminar
    const handleDelete = (id: string) => {
        setDeletingId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (deletingId) {
            setCalculations(prev => prev.filter(c => c.id !== deletingId));
            addToast('Cálculo eliminado correctamente', 'success');
            setDeletingId(null);
            setIsDeleteModalOpen(false);
        }
    };

    // ✅ Guardar cambios
    const handleSave = (updatedCalc: Calculation) => {
        setCalculations(prev => {
            const exists = prev.find(c => c.id === updatedCalc.id);
            if (exists) {
                return prev.map(c => c.id === updatedCalc.id ? updatedCalc : c);
            }
            return [...prev, updatedCalc];
        });
        setIsEditorOpen(false);
        setSelectedCalc(null);
        addToast('Cálculo guardado correctamente', 'success');
    };

    // ✅ Duplicar
    const handleDuplicate = (calc: Calculation) => {
        const duplicated: Calculation = {
            ...calc,
            id: Date.now().toString(),
            name: `${calc.name} (copia)`,
        };
        setCalculations(prev => [...prev, duplicated]);
        addToast('Cálculo duplicado correctamente', 'success');
    };

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

            {/* Header */}
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

            {/* Lista de cálculos */}
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
                                            {calc.distance_km > 0 && (
                                                <span>📍 {calc.distance_km} km</span>
                                            )}
                                            <span>📝 {calc.items.length} items</span>
                                            <span>🚛 {calc.columns.length} vehículos</span>
                                            <span>💹 Margen {calc.margin}%</span>
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

                                {/* Preview de la tabla */}
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="text-left p-2 border border-slate-200 font-bold text-slate-600">
                                                    Item
                                                </th>
                                                {calc.columns.map(col => (
                                                    <th key={col.id} className="text-center p-2 border border-slate-200 font-bold text-slate-600">
                                                        {col.name}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calc.items.slice(0, 3).map(item => (
                                                <tr key={item.id}>
                                                    <td className="p-2 border border-slate-200 text-slate-600">{item.name}</td>
                                                    {calc.columns.map(col => (
                                                        <td key={col.id} className="p-2 border border-slate-200 text-center font-mono text-slate-700">
                                                            {item.values[col.id] || '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {calc.items.length > 3 && (
                                                <tr>
                                                    <td colSpan={calc.columns.length + 1} className="p-2 text-center text-slate-400 italic">
                                                        ... {calc.items.length - 3} items más
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Editor */}
            {selectedCalc && (
                <CalculationEditor
                    isOpen={isEditorOpen}
                    calculation={selectedCalc}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setSelectedCalc(null);
                    }}
                    onSave={handleSave}
                />
            )}

            {/* Modal Confirmar Eliminación */}
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

// ✅ COMPONENTE EDITOR
interface CalculationEditorProps {
    isOpen: boolean;
    calculation: Calculation;
    onClose: () => void;
    onSave: (calc: Calculation) => void;
}

function CalculationEditor({ isOpen, calculation, onClose, onSave }: CalculationEditorProps) {
    const [localCalc, setLocalCalc] = useState<Calculation>({ ...calculation });

    // ✅ Actualizar campo
    const updateField = (field: keyof Calculation, value: any) => {
        setLocalCalc(prev => ({ ...prev, [field]: value }));
    };

    // ✅ Actualizar valor de celda
    const updateValue = (itemId: string, columnId: string, value: number) => {
        setLocalCalc(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId
                    ? { ...item, values: { ...item.values, [columnId]: value } }
                    : item
            ),
        }));
    };

    // ✅ Actualizar nombre de item
    const updateItemName = (itemId: string, name: string) => {
        setLocalCalc(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, name } : item
            ),
        }));
    };

    // ✅ Agregar item
    const addItem = () => {
        const newItem: CalculationItem = {
            id: `item_${Date.now()}`,
            name: 'Nuevo item',
            values: {},
        };
        setLocalCalc(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    // ✅ Eliminar item
    const removeItem = (itemId: string) => {
        setLocalCalc(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId),
        }));
    };

    // ✅ Actualizar nombre de columna
    const updateColumnName = (columnId: string, name: string) => {
        setLocalCalc(prev => ({
            ...prev,
            columns: prev.columns.map(col =>
                col.id === columnId ? { ...col, name } : col
            ),
        }));
    };

    // ✅ Agregar columna
    const addColumn = () => {
        const newCol: CalculationColumn = {
            id: `col_${Date.now()}`,
            name: 'Nuevo vehículo',
        };
        setLocalCalc(prev => ({ ...prev, columns: [...prev.columns, newCol] }));
    };

    // ✅ Eliminar columna
    const removeColumn = (columnId: string) => {
        setLocalCalc(prev => ({
            ...prev,
            columns: prev.columns.filter(c => c.id !== columnId),
        }));
    };

    // ✅ Calcular COSTO FINAL (suma de items)
    const calculateTotalCost = (columnId: string): number => {
        return localCalc.items.reduce((sum, item) => sum + (item.values[columnId] || 0), 0);
    };

    // ✅ Calcular VENTA FINAL (costo + margen)
    const calculateTotalSale = (columnId: string): number => {
        const cost = calculateTotalCost(columnId);
        return Math.round(cost * (1 + localCalc.margin / 100));
    };

    // ✅ Guardar
    const handleSave = () => {
        // Calcular totales antes de guardar
        const finalCalc: Calculation = {
            ...localCalc,
            totalCost: localCalc.columns.reduce((acc, col) => ({
                ...acc,
                [col.id]: calculateTotalCost(col.id),
            }), {}),
            totalSale: localCalc.columns.reduce((acc, col) => ({
                ...acc,
                [col.id]: calculateTotalSale(col.id),
            }), {}),
        };
        onSave(finalCalc);
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
                                value={localCalc.name}
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
                                value={localCalc.origin}
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
                                value={localCalc.destination}
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
                                value={localCalc.distance_km}
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
                                value={localCalc.margin}
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
                                value={localCalc.notes}
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
                                                    value={item.values[col.id] || ''}
                                                    onChange={e => updateValue(item.id, col.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-center text-xs font-mono text-slate-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 border border-slate-200 bg-slate-50"></td>
                                    </tr>
                                ))}
                                {/* Fila para agregar items */}
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

                                {/* COSTO FINAL */}
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

                                {/* VENTA FINAL */}
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

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        💾 Guardar Cálculo
                    </button>
                </div>
            </div>
        </Modal>
    );
}