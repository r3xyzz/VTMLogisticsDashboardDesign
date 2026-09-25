// src/components/FacturacionModule.tsx
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type InvoiceStatus = 'pendiente' | 'pagada' | 'vencida' | 'por-vencer' | 'anulada'

interface Invoice {
  id: string
  numero: string
  cliente: string
  rut: string
  concepto: string
  ot_ref: string
  emision: string
  vencimiento: string
  monto: number
  iva: number
  status: InvoiceStatus
  tipo: 'emitida' | 'recibida'
  archivo?: string | null
}

/* ─── Helper: fecha actual ───────────────────────────────────────────────────── */

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - TODAY.getTime()) / 86_400_000)
}

/* ─── Config ─────────────────────────────────────────────────────────────────── */

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const STATUS_CFG: Record<InvoiceStatus, { label: string; color: string; bg: string; dot: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  pagada:      { label: 'Pagada',      color: '#15803d', bg: '#dcfce7', dot: '#22c55e' },
  vencida:     { label: 'Vencida',     color: '#b91c1c', bg: '#fee2e2', dot: '#ef4444' },
  'por-vencer':{ label: 'Por Vencer',  color: '#c2410c', bg: '#fed7aa', dot: '#f97316' },
  anulada:     { label: 'Anulada',     color: '#64748b', bg: '#f1f5f9', dot: '#94a3b8' },
}

const EMPTY_FORM = {
  numero: '', cliente: '', rut: '', concepto: '', otRef: '',
  emision: new Date().toISOString().split('T')[0], vencimiento: '', monto: '', iva: '',
  tipo: 'emitida' as 'emitida' | 'recibida',
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
      {children}{req && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 bg-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors'

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_CFG[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

function DaysBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-[10px] font-bold text-red-600">Hace {Math.abs(days)}d</span>
  if (days === 0) return <span className="text-[10px] font-bold text-orange-600">Hoy</span>
  if (days <= 5) return <span className="text-[10px] font-bold text-orange-500">En {days}d</span>
  return <span className="text-[10px] text-slate-400">En {days}d</span>
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */

type Tab = 'lista' | 'nuevo' | 'vencimientos'

export default function FacturacionModule() {
  const [tab, setTab] = useState<Tab>('lista')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todas' | InvoiceStatus | 'emitida' | 'recibida'>('todas')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [ivaAuto, setIvaAuto] = useState(true)
  const [saving, setSaving] = useState(false)

  // ✅ Cargar facturas desde Supabase
  const fetchInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Convertir montos a number (vienen como string de Postgres)
      const parsed: Invoice[] = (data || []).map((inv: any) => ({
        ...inv,
        monto: Number(inv.monto),
        iva: Number(inv.iva),
      }))
      setInvoices(parsed)
    } catch (err: any) {
      console.error('❌ Error al cargar facturas:', err)
      setError(err.message || 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const setF = <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) =>
    setForm(p => {
      const next = { ...p, [k]: v }
      if (k === 'monto' && ivaAuto) {
        next.iva = String(Math.round(Number(v) * 0.19))
      }
      return next
    })

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchFilter =
        filter === 'todas' ? true :
        ['emitida', 'recibida'].includes(filter) ? inv.tipo === filter :
        inv.status === filter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        inv.numero.toLowerCase().includes(q) ||
        inv.cliente.toLowerCase().includes(q) ||
        inv.concepto.toLowerCase().includes(q) ||
        (inv.ot_ref || '').toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
  }, [invoices, filter, search])

  const porVencer  = invoices.filter(i => i.status === 'por-vencer')
  const vencidas   = invoices.filter(i => i.status === 'vencida')
  const pendientes = invoices.filter(i => i.status === 'pendiente')

  const totalPendiente = invoices
    .filter(i => ['pendiente', 'por-vencer'].includes(i.status) && i.tipo === 'emitida')
    .reduce((s, i) => s + i.monto + i.iva, 0)

  // ✅ Insertar nueva factura en Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      const monto = Number(form.monto)
      const iva = Number(form.iva)
      const days = daysUntil(form.vencimiento)
      const status: InvoiceStatus = days < 0 ? 'vencida' : days <= 5 ? 'por-vencer' : 'pendiente'

      const newInvoice = {
        numero: form.numero || `F-${String(invoices.length + 1842).padStart(6, '0')}`,
        cliente: form.cliente,
        rut: form.rut,
        concepto: form.concepto,
        ot_ref: form.otRef || '—',
        emision: form.emision,
        vencimiento: form.vencimiento,
        monto,
        iva,
        status,
        tipo: form.tipo,
      }

      const { data, error: insertError } = await supabase
        .from('invoices')
        .insert([newInvoice])
        .select()
        .single()

      if (insertError) throw insertError

      // Agregar al estado local
      const parsed: Invoice = {
        ...data,
        monto: Number(data.monto),
        iva: Number(data.iva),
      }
      setInvoices(p => [parsed, ...p])
      setSaved(true)
      setForm(EMPTY_FORM)
      setTimeout(() => { setSaved(false); setTab('lista') }, 1500)
    } catch (err: any) {
      console.error('❌ Error al guardar factura:', err)
      setError(err.message || 'Error al guardar factura')
    } finally {
      setSaving(false)
    }
  }

  // ✅ Marcar como pagada en Supabase
  const markPaid = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'pagada' })
        .eq('id', id)

      if (updateError) throw updateError

      setInvoices(p => p.map(i => i.id === id ? { ...i, status: 'pagada' } : i))
    } catch (err: any) {
      console.error('❌ Error al marcar como pagada:', err)
      setError(err.message || 'Error al actualizar la factura')
    }
  }

  /* ── KPI strip ── */
  const kpis = [
    { label: 'Por Vencer', value: porVencer.length, sub: '≤ 5 días', color: '#c2410c', bg: '#fff7ed', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Vencidas',   value: vencidas.length,  sub: 'Sin pagar', color: '#b91c1c', bg: '#fee2e2', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Pendientes', value: pendientes.length, sub: 'A cobrar', color: '#1e40af', bg: '#dbeafe', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Por Cobrar', value: clp(totalPendiente), sub: 'CLP total emitidas', color: '#15803d', bg: '#f0fdf4', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]

  // Estado de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando facturas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 h-14"
        style={{ background: 'rgba(248,250,252,0.96)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0' }}
      >
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 leading-none">Gestión de Facturas</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Facturación emitida · Proveedores · Vencimientos</p>
        </div>
        <button
          onClick={() => setTab('nuevo')}
          className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#163358,#2558a0)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Factura
        </button>
      </header>

      <div className="p-5 max-w-[1400px] mx-auto space-y-4">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <span className="text-[12px] font-semibold text-red-700">❌ {error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
                <svg className="w-5 h-5" style={{ color: k.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={k.icon} />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{k.label}</div>
                <div className="text-[22px] font-bold text-slate-900 leading-tight">{k.value}</div>
                <div className="text-[10px] text-slate-400">{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200">
          {([['lista','📋 Todas las Facturas'], ['vencimientos','🔔 Vencimientos'], ['nuevo','➕ Ingresar Factura']] as [Tab,string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors"
              style={tab === t
                ? { borderColor: '#2558a0', color: '#163358' }
                : { borderColor: 'transparent', color: '#94a3b8' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: Lista ─────────────────────────────────────────────────────── */}
        {tab === 'lista' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  className="pl-8 pr-4 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 w-52"
                  placeholder="Buscar número, cliente, OT..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['todas','pendiente','por-vencer','vencida','pagada','emitida','recibida'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors capitalize"
                    style={filter === f
                      ? { background: '#163358', color: 'white', borderColor: '#163358' }
                      : { background: 'white', color: '#64748b', borderColor: '#e2e8f0' }}
                  >
                    {f === 'todas' ? 'Todas' : f === 'por-vencer' ? 'Por Vencer' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-[11px] text-slate-400">{filtered.length} facturas</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      {['N° Factura','Tipo','Cliente / RUT','Concepto · OT','Emisión','Vencimiento','Monto + IVA','Estado','Acciones'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-[12px] text-slate-400">
                          No se encontraron facturas con ese criterio.
                        </td>
                      </tr>
                    )}
                    {filtered.map(inv => {
                      const days = daysUntil(inv.vencimiento)
                      const rowAlert = inv.status === 'por-vencer' || inv.status === 'vencida'
                      return (
                        <tr
                          key={inv.id}
                          className="transition-colors cursor-pointer"
                          style={{
                            borderBottom: '1px solid #f8fafc',
                            background: rowAlert ? (inv.status === 'vencida' ? '#fff8f8' : '#fffbf5') : 'white',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = rowAlert ? (inv.status === 'vencida' ? '#fff8f8' : '#fffbf5') : 'white')}
                          onClick={() => setSelected(inv)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-[12px] font-bold text-slate-800">{inv.numero}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wide"
                              style={inv.tipo === 'emitida'
                                ? { background: '#eff6ff', color: '#1e40af' }
                                : { background: '#f5f3ff', color: '#6d28d9' }}
                            >
                              {inv.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[12px] font-semibold text-slate-800">{inv.cliente}</div>
                            <div className="font-mono text-[10px] text-slate-400">{inv.rut}</div>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="text-[11px] text-slate-700 truncate">{inv.concepto}</div>
                            {inv.ot_ref !== '—' && (
                              <div className="text-[9px] font-mono text-blue-500 mt-0.5">{inv.ot_ref}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {inv.emision.split('-').reverse().join('/')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-slate-700">
                              {inv.vencimiento.split('-').reverse().join('/')}
                            </div>
                            {inv.status !== 'pagada' && inv.status !== 'anulada' && (
                              <DaysBadge days={days} />
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono text-[12px] font-bold text-slate-900">{clp(inv.monto + inv.iva)}</div>
                            <div className="text-[9px] text-slate-400">Neto {clp(inv.monto)} + IVA</div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              {(inv.status === 'pendiente' || inv.status === 'por-vencer') && (
                                <button
                                  onClick={() => markPaid(inv.id)}
                                  className="text-[10px] font-bold text-green-600 hover:text-green-800 whitespace-nowrap"
                                >
                                  ✓ Marcar pagada
                                </button>
                              )}
                              <button
                                onClick={() => setSelected(inv)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap"
                              >
                                Ver detalle →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Vencimientos ───────────────────────────────────────────────── */}
        {tab === 'vencimientos' && (
          <div className="space-y-4">
            {/* Alert banner */}
            {(porVencer.length > 0 || vencidas.length > 0) && (
              <div
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl border"
                style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
              >
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="text-[13px] font-bold text-orange-800">
                    {vencidas.length} facturas vencidas · {porVencer.length} próximas a vencer
                  </div>
                  <div className="text-[11px] text-orange-600 mt-0.5">
                    Monto total en riesgo: <span className="font-mono font-bold">
                      {clp([...porVencer,...vencidas].reduce((s,i) => s + i.monto + i.iva, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Vencidas */}
            {vencidas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">Facturas Vencidas ({vencidas.length})</h3>
                </div>
                <VencimientoTable rows={vencidas} onPay={markPaid} onView={setSelected} />
              </div>
            )}

            {/* Por vencer */}
            {porVencer.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">Por Vencer — próximos 5 días ({porVencer.length})</h3>
                </div>
                <VencimientoTable rows={porVencer} onPay={markPaid} onView={setSelected} />
              </div>
            )}

            {porVencer.length === 0 && vencidas.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-[14px] font-semibold text-slate-700">Todo al día</div>
                <div className="text-[12px] text-slate-400 mt-1">No hay facturas vencidas ni próximas a vencer.</div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Nuevo ─────────────────────────────────────────────────────── */}
        {tab === 'nuevo' && (
          <div className="max-w-3xl mx-auto">
            {saved && (
              <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[12px] font-semibold text-green-700">Factura registrada exitosamente.</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg,#060d1a,#102040)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <h2 className="text-[14px] font-bold text-white">Ingresar Nueva Factura</h2>
                  <p className="text-[11px] text-blue-300/70 mt-0.5">Complete los campos para registrar una factura emitida o recibida</p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Tipo toggle */}
                  <div>
                    <Lbl>Tipo de factura</Lbl>
                    <div className="flex gap-3">
                      {(['emitida','recibida'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setF('tipo', t)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border-2 transition-all"
                          style={form.tipo === t
                            ? { background: '#eff6ff', color: '#163358', borderColor: '#3b82f6' }
                            : { background: 'white', color: '#94a3b8', borderColor: '#e2e8f0' }}
                        >
                          <span>{t === 'emitida' ? '📤' : '📥'}</span>
                          {t === 'emitida' ? 'Emitida (a cobrar)' : 'Recibida (a pagar)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Lbl>N° Factura</Lbl>
                      <input className={inp} placeholder="F-001845 (auto si vacío)" value={form.numero} onChange={e => setF('numero', e.target.value)} />
                    </div>
                    <div>
                      <Lbl req>OT de Referencia</Lbl>
                      <input className={inp} placeholder="OT-2449 o — si no aplica" value={form.otRef} onChange={e => setF('otRef', e.target.value)} />
                    </div>
                  </div>

                  {/* Row 2: Cliente */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Lbl req>{form.tipo === 'emitida' ? 'Cliente' : 'Proveedor'}</Lbl>
                      <input className={inp} placeholder={form.tipo === 'emitida' ? 'Walmart Chile S.A.' : 'Petrogas Distribución'} value={form.cliente} onChange={e => setF('cliente', e.target.value)} required />
                    </div>
                    <div>
                      <Lbl>RUT</Lbl>
                      <input className={inp} placeholder="96.930.990-4" value={form.rut} onChange={e => setF('rut', e.target.value)} />
                    </div>
                  </div>

                  {/* Concepto */}
                  <div>
                    <Lbl req>Concepto / Descripción</Lbl>
                    <input className={inp} placeholder="Transporte Valparaíso → Santiago · Agosto 2026" value={form.concepto} onChange={e => setF('concepto', e.target.value)} required />
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Lbl req>Fecha de emisión</Lbl>
                      <input type="date" className={inp} value={form.emision} onChange={e => setF('emision', e.target.value)} required />
                    </div>
                    <div>
                      <Lbl req>Fecha de vencimiento</Lbl>
                      <input type="date" className={inp} value={form.vencimiento} onChange={e => setF('vencimiento', e.target.value)} required />
                      {form.vencimiento && (() => {
                        const d = daysUntil(form.vencimiento)
                        if (d < 0) return <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠ Fecha ya vencida</p>
                        if (d <= 5) return <p className="text-[10px] text-orange-500 mt-1 font-semibold">⚠ Vence en {d} días</p>
                        return <p className="text-[10px] text-green-600 mt-1">✓ Vence en {d} días</p>
                      })()}
                    </div>
                  </div>

                  {/* Montos */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Lbl req>Monto neto (CLP)</Lbl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[12px] font-mono">$</span>
                        <input
                          type="number"
                          min="0"
                          className={inp + ' pl-7'}
                          placeholder="0"
                          value={form.monto}
                          onChange={e => setF('monto', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Lbl>IVA (19%)</Lbl>
                        <button
                          type="button"
                          onClick={() => setIvaAuto(v => !v)}
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors"
                          style={ivaAuto ? { background: '#dbeafe', color: '#1e40af' } : { background: '#f1f5f9', color: '#64748b' }}
                        >
                          {ivaAuto ? 'AUTO' : 'MANUAL'}
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[12px] font-mono">$</span>
                        <input
                          type="number"
                          min="0"
                          className={inp + ' pl-7'}
                          placeholder="0"
                          value={form.iva}
                          onChange={e => { setIvaAuto(false); setF('iva', e.target.value) }}
                          readOnly={ivaAuto}
                          style={ivaAuto ? { background: '#f8fafc', color: '#94a3b8' } : {}}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total preview */}
                  {(form.monto || form.iva) && (
                    <div
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
                    >
                      <span className="text-[12px] font-semibold text-slate-600">Total con IVA</span>
                      <span className="font-mono text-[18px] font-bold text-blue-900">
                        {clp((Number(form.monto) || 0) + (Number(form.iva) || 0))}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#163358,#2558a0)' }}
                    >
                      {saving ? 'Guardando...' : 'Registrar Factura'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForm(EMPTY_FORM); setTab('lista') }}
                      className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selected && (
        <InvoiceDetail
          inv={selected}
          onClose={() => setSelected(null)}
          onPay={() => { markPaid(selected.id); setSelected(null) }}
        />
      )}
    </div>
  )
}

/* ─── Vencimiento table ──────────────────────────────────────────────────────── */

function VencimientoTable({ rows, onPay, onView }: { rows: Invoice[]; onPay: (id: string) => void; onView: (inv: Invoice) => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {['N° Factura','Tipo','Cliente','Concepto','Vencimiento','Días','Monto Total','Estado',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(inv => {
            const days = daysUntil(inv.vencimiento)
            return (
              <tr
                key={inv.id}
                className="transition-colors cursor-pointer"
                style={{ borderBottom: '1px solid #f8fafc' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                onClick={() => onView(inv)}
              >
                <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-800">{inv.numero}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={inv.tipo === 'emitida' ? { background: '#eff6ff', color: '#1e40af' } : { background: '#f5f3ff', color: '#6d28d9' }}
                  >
                    {inv.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] font-medium text-slate-800">{inv.cliente}</td>
                <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[180px] truncate">{inv.concepto}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                  {inv.vencimiento.split('-').reverse().join('/')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-[12px] font-bold"
                    style={{ color: days < 0 ? '#b91c1c' : days <= 2 ? '#c2410c' : '#d97706' }}
                  >
                    {days < 0 ? `−${Math.abs(days)}d` : days === 0 ? 'HOY' : `+${days}d`}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-900">{clp(inv.monto + inv.iva)}</td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onPay(inv.id)}
                    className="text-[10px] font-bold text-green-600 hover:text-green-800 whitespace-nowrap"
                  >
                    ✓ Pagar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Detail modal ───────────────────────────────────────────────────────────── */

function InvoiceDetail({ inv, onClose, onPay }: { inv: Invoice; onClose: () => void; onPay: () => void }) {
  const days = daysUntil(inv.vencimiento)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#060d1a,#102040)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[11px] text-blue-400/70 mb-1">{inv.tipo.toUpperCase()}</div>
              <h2 className="text-[18px] font-bold text-white">{inv.numero}</h2>
              <p className="text-[12px] text-blue-300/80 mt-0.5">{inv.cliente}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none">×</button>
          </div>
          <div className="mt-4">
            <StatusBadge status={inv.status} />
          </div>
        </div>

        <div className="p-6 space-y-4">
          <Row label="RUT" value={inv.rut} />
          <Row label="Concepto" value={inv.concepto} />
          <Row label="OT Referencia" value={inv.ot_ref} mono />
          <div className="grid grid-cols-2 gap-3">
            <Row label="Fecha emisión" value={inv.emision.split('-').reverse().join('/')} mono />
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vencimiento</div>
              <div className="font-mono text-[13px] font-semibold text-slate-800">{inv.vencimiento.split('-').reverse().join('/')}</div>
              {inv.status !== 'pagada' && <DaysBadge days={days} />}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-100">
            <div className="flex justify-between px-4 py-2.5 bg-slate-50 text-[11px]">
              <span className="text-slate-500">Monto neto</span>
              <span className="font-mono font-semibold text-slate-800">{clp(inv.monto)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-[11px]" style={{ borderTop: '1px solid #f1f5f9' }}>
              <span className="text-slate-500">IVA (19%)</span>
              <span className="font-mono font-semibold text-slate-800">{clp(inv.iva)}</span>
            </div>
            <div
              className="flex justify-between px-4 py-3 text-[13px] font-bold"
              style={{ background: '#f0f9ff', borderTop: '1px solid #bae6fd' }}
            >
              <span className="text-blue-900">Total</span>
              <span className="font-mono text-blue-900">{clp(inv.monto + inv.iva)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {(inv.status === 'pendiente' || inv.status === 'por-vencer' || inv.status === 'vencida') && (
              <button
                onClick={onPay}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}
              >
                ✓ Marcar como Pagada
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-[13px] text-slate-800 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</div>
    </div>
  )
}