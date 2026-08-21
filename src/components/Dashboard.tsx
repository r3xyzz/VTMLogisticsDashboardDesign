// src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'
import type { ActiveView } from '../App'

interface Props { onNavigate: (v: ActiveView) => void }

// ✅ CONFIGURACIÓN DE LA API
const OILPRICEAPI_KEY = import.meta.env.VITE_OILPRICEAPI_KEY;

// ✅ FUNCIÓN PARA OBTENER EL PRECIO DEL DIÉSEL
// src/components/Dashboard.tsx

// ✅ FUNCIÓN PARA OBTENER EL PRECIO DEL DIÉSEL
async function fetchDieselPrice(): Promise<number | null> {
    try {
        console.log('🔄 Obteniendo precio del diésel desde OilPriceAPI...');
        
        // 🔥 Endpoint CORRECTO: DIESEL_USD (precio en USD/galón)
        const response = await fetch(
            'https://api.oilpriceapi.com/v1/prices/latest?by_code=DIESEL_USD',
            {
                headers: {
                    'Authorization': `Token ${OILPRICEAPI_KEY}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Respuesta de la API:', data);
        
        if (data && data.data && data.data.price) {
            // Precio en USD por galón
            const priceInUSD = data.data.price; // 4.53 USD/galón
            
            // 🔥 CONVERSIÓN: USD/galón → CLP/litro
            const USD_TO_CLP = 950;      // Tipo de cambio (puedes ajustarlo)
            const LITERS_PER_GALLON = 3.78541;
            
            // Paso 1: USD → CLP por galón
            const priceInCLPPerGallon = priceInUSD * USD_TO_CLP;
            // Paso 2: CLP/galón → CLP/litro
            const priceInCLPPerLiter = priceInCLPPerGallon / LITERS_PER_GALLON;
            // Paso 3: Redondear
            const roundedPrice = Math.round(priceInCLPPerLiter);
            
            console.log(`📊 Precio en USD/galón: $${priceInUSD}`);
            console.log(`⛽ Precio convertido: $${roundedPrice}/L`);
            
            return roundedPrice;
        } else {
            throw new Error('No se recibió el precio en el formato esperado');
        }
    } catch (error) {
        console.error('❌ Error fetching diesel price:', error);
        return null;
    }
}

/* ─── FUNCIÓN PARA CONSTRUIR KPIS ────────────────────────────────────────── */

function buildKpis(dieselPrice: number | null, dieselError: string | null) {
    let priceDisplay = 'Cargando...';
    let priceDelta = 'Actualizando...';
    let priceUp = null;
    
    if (dieselError) {
        priceDisplay = '⚠️ Error';
        priceDelta = 'No disponible';
    } else if (dieselPrice !== null) {
        priceDisplay = `$${dieselPrice.toLocaleString('es-CL')}/L`;
        priceDelta = 'Actualizado: hoy';
        priceUp = null;
    }
    
    return [
        {
            label: 'Cargas en Tránsito',
            value: '23',
            delta: '+3 vs. ayer',
            up: true,
            icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
            accent: '#2558a0', accentBg: '#eff6ff',
        },
        {
            label: 'Flota en Ruta / Total',
            value: '14 / 18',
            delta: '4 disponibles',
            up: null,
            icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
            accent: '#16a34a', accentBg: '#f0fdf4',
        },
        {
            label: 'Entregas a Tiempo (OTD)',
            value: '87.3%',
            delta: '−2.1% vs. mes anterior',
            up: false,
            icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
            accent: '#ea580c', accentBg: '#fff7ed',
        },
        {
            label: 'Margen Operativo · Ago',
            value: '$4.82M',
            delta: 'CLP estimado al 18/08',
            up: true,
            icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
            accent: '#2558a0', accentBg: '#eff6ff',
        },
        {
            label: '⛽ Precio Diésel',
            value: priceDisplay,
            delta: priceDelta,
            up: priceUp,
            icon: 'M12 4v4m0 4v4M8 8h8M8 12h8M4 16h16',
            accent: '#b45309', accentBg: '#fffbeb',
        },
    ];
}

/* ─── DATOS ESTÁTICOS ──────────────────────────────────────────────────────── */

const drivers = [
    { name: 'Carlos Vega', plate: 'BFLK-92', client: 'Walmart Chile', route: 'VAL → SCL', dep: '06:30', arr: '09:15', load: '09:15–10:00', ret: '13:30', status: 'en-ruta', pct: 65 },
    { name: 'Pedro Rojas', plate: 'CGMN-14', client: 'Puerto Central S.A.', route: 'SCL → SAN', dep: '07:00', arr: '09:45', load: '09:45–10:30', ret: '14:00', status: 'cargando', pct: 48 },
    { name: 'Marcelo Fuentes', plate: 'DHPR-67', client: 'Cosco Shipping', route: 'VAL → SAN', dep: '08:15', arr: '10:00', load: '10:00–10:45', ret: '15:20', status: 'retrasado', pct: 30 },
    { name: 'Andrés Morales', plate: 'EJQS-33', client: 'Lider Express', route: 'SCL → VAL', dep: '05:45', arr: '08:30', load: '08:30–09:15', ret: '12:00', status: 'entregado', pct: 100 },
    { name: 'Roberto Silva', plate: 'FKRT-81', client: 'DHL Chile', route: 'SAN → SCL', dep: '09:00', arr: '11:30', load: '11:30–12:15', ret: '16:45', status: 'en-espera', pct: 0 },
]

const statusCfg: Record<string, { label: string; color: string; bg: string; barColor: string }> = {
    'en-ruta': { label: 'En Ruta', color: '#15803d', bg: '#dcfce7', barColor: '#22c55e' },
    'cargando': { label: 'Cargando', color: '#1e40af', bg: '#dbeafe', barColor: '#3b82f6' },
    'retrasado': { label: 'Retrasado', color: '#c2410c', bg: '#fed7aa', barColor: '#f97316' },
    'entregado': { label: 'Entregado', color: '#374151', bg: '#e5e7eb', barColor: '#9ca3af' },
    'en-espera': { label: 'En Espera', color: '#64748b', bg: '#f1f5f9', barColor: '#cbd5e1' },
}

const alerts = [
    { lvl: 'red', time: '10:42', msg: 'DHPR-67 — Desvío no autorizado en Ruta 68. Chofer sin respuesta 18 min.', cta: 'Ver incidencia' },
    { lvl: 'orange', time: '10:15', msg: 'OT-2408 retrasada 45 min. Cliente Puerto Central S.A. notificado.', cta: 'Ver OT' },
    { lvl: 'orange', time: '09:58', msg: 'CGMN-14 — Tiempo de carga excedido 30 min. Posible cobro estadía.', cta: 'Registrar costo' },
    { lvl: 'blue', time: '09:30', msg: 'Nueva solicitud de cotización — ACME Importaciones, Valparaíso.', cta: 'Ver correo' },
]

const alertStyle: Record<string, { border: string; bg: string; icon: string; iconColor: string }> = {
    red: { border: '#dc2626', bg: '#fef2f2', icon: '!', iconColor: '#dc2626' },
    orange: { border: '#ea580c', bg: '#fff7ed', icon: '⚠', iconColor: '#ea580c' },
    blue: { border: '#2558a0', bg: '#eff6ff', icon: 'i', iconColor: '#2558a0' },
}

const otdData = [
    { mes: 'Mar', otd: 91, margen: 5.1 },
    { mes: 'Abr', otd: 89, margen: 4.8 },
    { mes: 'May', otd: 94, margen: 5.5 },
    { mes: 'Jun', otd: 88, margen: 4.6 },
    { mes: 'Jul', otd: 92, margen: 5.2 },
    { mes: 'Ago', otd: 87, margen: 4.82 },
]

const fleetNodes = [
    { id: 'VAL', name: 'Valparaíso', x: 12, y: 50, units: 4, online: 3 },
    { id: 'SCL', name: 'Santiago', x: 52, y: 38, units: 8, online: 7 },
    { id: 'SAN', name: 'San Antonio', x: 28, y: 68, units: 3, online: 2 },
]

/* ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────── */

export default function Dashboard({ onNavigate }: Props) {
    // ✅ ESTADO PARA EL PRECIO DEL DIÉSEL (AQUÍ DENTRO DEL COMPONENTE)
    const [dieselPrice, setDieselPrice] = useState<number | null>(null);
    const [loadingDiesel, setLoadingDiesel] = useState(true);
    const [dieselError, setDieselError] = useState<string | null>(null);
    
    // ✅ ESTADO PARA ALERTAS
    const [dismissed, setDismiss] = useState<Set<number>>(new Set())
    const [activeAlerts] = useState(alerts.length)

    // ✅ useEffect PARA OBTENER EL PRECIO DEL DIÉSEL (AQUÍ DENTRO DEL COMPONENTE)
    useEffect(() => {
        const loadDieselPrice = async () => {
            try {
                setLoadingDiesel(true);
                const price = await fetchDieselPrice();
                
                if (price !== null && price > 0) {
                    setDieselPrice(price);
                    setDieselError(null);
                    console.log(`⛽ Precio del diésel actualizado: $${price}/L`);
                } else {
                    setDieselError('No se pudo obtener el precio');
                    setDieselPrice(1107);
                }
            } catch (error) {
                console.error('Error loading diesel price:', error);
                setDieselError('Error al cargar');
                setDieselPrice(1107);
            } finally {
                setLoadingDiesel(false);
            }
        };

        loadDieselPrice();

        // ✅ ACTUALIZAR CADA 1 HORA
        const interval = setInterval(loadDieselPrice, 3600000);

        return () => clearInterval(interval);
    }, []);

    // ✅ CONSTRUIR KPIS CON EL PRECIO
    const kpis = buildKpis(dieselPrice, dieselError);

    // ✅ RENDERIZADO
    return (
        <div className="min-h-full">
            {/* Top bar */}
            <header
                className="sticky top-0 z-20 flex items-center justify-between px-6 h-14"
                style={{ background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0' }}
            >
                <div>
                    <h1 className="text-[15px] font-bold text-slate-900 leading-none">Dashboard Operativo</h1>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date().toLocaleDateString('es-CL', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })} · <span style={{ fontFamily: "'JetBrains Mono'" }}>
                            {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
                    >
                        <svg className="w-4.5 h-4.5" style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {activeAlerts - dismissed.size > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: '#dc2626' }}>
                                {activeAlerts - dismissed.size}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => onNavigate('cargo')}
                        className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg,#163358,#2558a0)' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva OT
                    </button>
                </div>
            </header>

            <div className="p-5 space-y-4 max-w-[1400px] mx-auto">

                {/* ✅ KPI row - AHORA CON 5 COLUMNAS */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {kpis.map(k => (
                        <div
                            key={k.label}
                            className="bg-white rounded-xl border border-slate-200/80 p-4 hover:shadow-sm transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight max-w-[120px]">{k.label}</p>
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: k.accentBg }}
                                >
                                    <svg className="w-4 h-4" style={{ color: k.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={k.icon} />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{k.value}</div>
                            <div className="mt-1.5 flex items-center gap-1">
                                {k.up === true  && <span className="text-green-500 text-xs">↑</span>}
                                {k.up === false && <span className="text-orange-500 text-xs">↓</span>}
                                <span className="text-[11px] text-slate-400">{k.delta}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 2: Timeline + Alerts */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                    {/* Driver timeline — 2 cols */}
                    <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800">Sensor de Horarios · Choferes</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">{drivers.length} conductores activos hoy</p>
                            </div>
                            <button
                                onClick={() => onNavigate('tracking')}
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                            >
                                Monitoreo completo →
                            </button>
                        </div>

                        {/* Hours ruler */}
                        <div className="flex px-5 pt-3 pb-1">
                            <div className="w-44 flex-shrink-0" />
                            <div className="flex-1 flex text-[9px] font-bold text-slate-300 uppercase tracking-wide">
                                {['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'].map(h => (
                                    <div key={h} className="flex-1 text-center border-l border-slate-100 first:border-l-0">{h}h</div>
                                ))}
                            </div>
                        </div>

                        <div className="px-5 pb-4 space-y-2.5 mt-0.5">
                            {drivers.map(d => {
                                const s = statusCfg[d.status]
                                const gradient = d.status === 'retrasado'
                                    ? 'linear-gradient(90deg,#fb923c,#ea580c)'
                                    : d.status === 'entregado'
                                    ? 'linear-gradient(90deg,#d1d5db,#9ca3af)'
                                    : d.status === 'en-espera'
                                    ? '#e2e8f0'
                                    : 'linear-gradient(90deg,#3b82f6,#1d4ed8)'
                                return (
                                    <div key={d.name} className="flex items-center gap-0">
                                        {/* Driver info */}
                                        <div className="w-44 flex-shrink-0 pr-4">
                                            <div className="text-[12px] font-semibold text-slate-800 leading-tight">{d.name}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="font-mono text-[9px] text-slate-400">{d.plate}</span>
                                                <span
                                                    className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                                    style={{ background: s.bg, color: s.color }}
                                                >
                                                    {s.label}
                                                </span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 truncate">{d.client}</div>
                                        </div>
                                        {/* Bar */}
                                        <div className="flex-1">
                                            <div
                                                className="relative h-6 rounded-md overflow-hidden"
                                                style={{ background: '#f8fafc' }}
                                            >
                                                {/* Background grid */}
                                                <div className="absolute inset-0 flex">
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <div key={i} className="flex-1 border-l border-slate-100 first:border-l-0" />
                                                    ))}
                                                </div>
                                                {/* Progress */}
                                                {d.pct > 0 && (
                                                    <div
                                                        className="absolute inset-y-0 left-0 rounded-md transition-all duration-700"
                                                        style={{ width: `${d.pct}%`, background: gradient }}
                                                    />
                                                )}
                                                {/* Label */}
                                                <div className="absolute inset-0 flex items-center px-2.5">
                                                    <span
                                                        className="text-[9px] font-semibold truncate"
                                                        style={{ fontFamily: "'JetBrains Mono'", color: d.pct > 25 ? 'rgba(255,255,255,0.9)' : '#64748b' }}
                                                    >
                                                        {d.dep} → {d.ret} · {d.route}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Milestones */}
                                            <div className="flex gap-4 mt-0.5 px-0.5">
                                                <span className="text-[9px] text-slate-400">↑ {d.dep}</span>
                                                <span className="text-[9px] text-slate-400">⊙ {d.load}</span>
                                                <span className="text-[9px] text-slate-400">↓ {d.ret}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col">
                        <div
                            className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                        >
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800">Alertas Críticas</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">{alerts.length - dismissed.size} activas</p>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                            {alerts.map((a, i) => {
                                if (dismissed.has(i)) return null
                                const s = alertStyle[a.lvl]
                                return (
                                    <div
                                        key={i}
                                        className="flex gap-3 px-4 py-3.5"
                                        style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5"
                                            style={{ background: s.border }}
                                        >
                                            {s.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-mono text-slate-400 mb-0.5">{a.time} hrs</div>
                                            <p className="text-[11px] text-slate-700 leading-relaxed">{a.msg}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <button className="text-[10px] font-bold" style={{ color: s.border }}>
                                                    {a.cta} →
                                                </button>
                                                <button
                                                    onClick={() => setDismiss(s => new Set([...s, i]))}
                                                    className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {dismissed.size === alerts.length && (
                                <div className="p-6 text-center text-[11px] text-slate-400">
                                    No hay alertas activas
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Row 3: Fleet map + Chart */}
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

                    {/* Fleet map — 3 cols */}
                    <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800">Monitor de Flota · Triángulo Logístico</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">Valparaíso · Santiago · San Antonio · GPS live</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-semibold text-green-600">Live</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row">
                            {/* SVG map */}
                            <div className="flex-1 p-4">
                                <div
                                    className="relative rounded-lg overflow-hidden"
                                    style={{
                                        height: 200,
                                        background: 'linear-gradient(145deg,#e8f0fe 0%,#dbeafe 60%,#e0f2fe 100%)',
                                    }}
                                >
                                    {/* Grid */}
                                    <svg className="absolute inset-0 w-full h-full opacity-15">
                                        <defs>
                                            <pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse">
                                                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e40af" strokeWidth="0.5" />
                                            </pattern>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#g)" />
                                    </svg>

                                    <svg className="absolute inset-0 w-full h-full">
                                        {/* Routes */}
                                        <line x1="12%" y1="50%" x2="52%" y2="38%" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
                                        <line x1="52%" y1="38%" x2="28%" y2="68%" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
                                        <line x1="12%" y1="50%" x2="28%" y2="68%" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />

                                        {/* Truck count bubbles on routes */}
                                        <circle cx="32%" cy="44%" r="10" fill="#1d4ed8" opacity="0.9" />
                                        <text x="32%" y="44%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="bold">3</text>

                                        <circle cx="40%" cy="53%" r="10" fill="#1d4ed8" opacity="0.9" />
                                        <text x="40%" y="53%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="bold">2</text>
                                    </svg>

                                    {/* City nodes */}
                                    {fleetNodes.map(n => (
                                        <div
                                            key={n.id}
                                            className="absolute"
                                            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)' }}
                                        >
                                            <div
                                                className="w-11 h-11 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                                                style={{ background: '#1e4278' }}
                                            >
                                                <span className="text-white text-[10px] font-black">{n.id}</span>
                                            </div>
                                            <div className="mt-1 text-center">
                                                <div className="bg-white/90 rounded px-1.5 py-0.5 shadow-sm inline-block">
                                                    <div className="text-[8px] font-bold text-slate-700">{n.name}</div>
                                                </div>
                                                <div className="mt-0.5">
                                                    <div
                                                        className="rounded-full px-1.5 py-0.5 inline-block"
                                                        style={{ background: '#dbeafe' }}
                                                    >
                                                        <span className="text-[8px] font-mono font-bold text-blue-700">{n.online}/{n.units}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fleet status table */}
                            <div
                                className="w-full sm:w-64 border-t sm:border-t-0 sm:border-l overflow-auto"
                                style={{ borderColor: '#f1f5f9' }}
                            >
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                            {['Unidad', 'Ruta', 'Estado'].map(h => (
                                                <th key={h} className="text-left px-3 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drivers.map(d => {
                                            const s = statusCfg[d.status]
                                            return (
                                                <tr key={d.name} className="hover:bg-slate-50/60 transition-colors" style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td className="px-3 py-2.5">
                                                        <div className="font-mono text-[11px] font-bold text-slate-800">{d.plate}</div>
                                                        <div className="text-[9px] text-slate-400 truncate">{d.name}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-[10px] text-slate-500">{d.route}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span
                                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                                            style={{ background: s.bg, color: s.color }}
                                                        >
                                                            {s.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Charts — 2 cols */}
                    <div className="xl:col-span-2 flex flex-col gap-4">

                        {/* OTD trend */}
                        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 p-4 overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-[12px] font-bold text-slate-800">Tendencia OTD · 6 meses</h3>
                                    <p className="text-[10px] text-slate-400">Entregas a tiempo (%)</p>
                                </div>
                                <div className="text-[11px] font-mono font-bold" style={{ color: '#ea580c' }}>87.3%</div>
                            </div>
                            <div style={{ height: 90 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={otdData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="otd" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[82, 96]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                                            formatter={(v) => [`${v}%`, 'OTD']}
                                        />
                                        <Area type="monotone" dataKey="otd" stroke="#3b82f6" strokeWidth={2} fill="url(#otd)" dot={{ r: 3, fill: '#3b82f6', stroke: 'white', strokeWidth: 1.5 }} activeDot={{ r: 4 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Margen mensual */}
                        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 p-4 overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-[12px] font-bold text-slate-800">Margen Operativo · 6 meses</h3>
                                    <p className="text-[10px] text-slate-400">Millones CLP</p>
                                </div>
                                <div className="text-[11px] font-mono font-bold text-slate-700">$4.82M</div>
                            </div>
                            <div style={{ height: 90 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={otdData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={16}>
                                        <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[3.5, 6]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                                            formatter={(v) => [`$${v}M`, 'Margen']}
                                        />
                                        <Bar dataKey="margen" fill="#1e4278" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
