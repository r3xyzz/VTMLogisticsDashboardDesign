// src/components/facturacion/ConciliacionTab.tsx
import { useMemo, useState } from "react"
import { localDay, parseDate } from "../../lib/dates"
import { Invoice, money } from "./data"

export type ConceptType = "Todos" | "Transporte" | "Visto Bueno" | "Sobreestadía" | "Porteo y Almacenaje" | "Corrección de BL"

export function ConciliacionTab({ invoices }: { invoices: Invoice[] }) {
  const [conceptFilter, setConceptFilter] = useState<ConceptType>("Todos")
  const [periodFilter, setPeriodFilter] = useState("Todos")
  const [onlyPendingAnnull, setOnlyPendingAnnull] = useState(false)

  // 1. Filtramos las facturas según los controles superiores
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invConcept = inv.typeName || "Transporte" 
      const matchesConcept = conceptFilter === "Todos" || invConcept.includes(conceptFilter)

      const invPeriod = inv.issueDate ? localDay(parseDate(inv.issueDate)).slice(0, 7) : ""
      const matchesPeriod = periodFilter === "Todos" || invPeriod === periodFilter

      const needsAnnull = inv.annulled === true || inv.status === "Anulado" || inv.status === "Vencida"
      const matchesAnnull = !onlyPendingAnnull || needsAnnull

      return matchesConcept && matchesPeriod && matchesAnnull
    })
  }, [invoices, conceptFilter, periodFilter, onlyPendingAnnull])

  // 2. Cálculos de KPIs
  const totalByConcept = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)
  const annulledCount = filteredInvoices.filter(inv => inv.annulled || inv.status === "Anulado").length
  
  const commissionAccumulated = totalByConcept * 0.05 
  const minCommissionExpected = 250000 
  const isBelowMinCommission = commissionAccumulated < minCommissionExpected

  return (
    <div className="p-5 space-y-5">
      {/* HEADER Y FILTROS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Concepto</label>
            <select 
              value={conceptFilter} 
              onChange={e => setConceptFilter(e.target.value as ConceptType)}
              className="h-8 rounded border border-slate-200 px-2 text-xs font-semibold outline-none"
            >
              {["Todos", "Transporte", "Visto Bueno", "Sobreestadía", "Porteo y Almacenaje", "Corrección de BL"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Período Operativo</label>
            <input 
              type="month" 
              value={periodFilter === "Todos" ? "" : periodFilter}
              onChange={e => setPeriodFilter(e.target.value || "Todos")}
              className="h-8 rounded border border-slate-200 px-2 text-xs font-semibold outline-none"
            />
          </div>

          <div className="flex items-center gap-2 mt-4 ml-auto">
            <input 
              type="checkbox" 
              id="pendingAnnull"
              checked={onlyPendingAnnull}
              onChange={e => setOnlyPendingAnnull(e.target.checked)}
              className="size-4 accent-slate-800 rounded"
            />
            <label htmlFor="pendingAnnull" className="text-xs font-semibold text-slate-600 cursor-pointer">
              Mostrar solo facturas pendientes de anulación / NC
            </label>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Total por Concepto</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(totalByConcept)}</p>
          <p className="text-[11px] text-slate-500">{filteredInvoices.length} facturas</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-red-600">Alertas de Anulación</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{annulledCount}</p>
          <p className="text-[11px] text-red-600">Emitidas por error sin Nota de Crédito</p>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${isBelowMinCommission ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className={`text-[10px] font-bold uppercase ${isBelowMinCommission ? "text-red-600" : "text-emerald-600"}`}>Margen de Comisión</p>
          <p className={`mt-1 text-2xl font-bold ${isBelowMinCommission ? "text-red-700" : "text-emerald-700"}`}>{money(commissionAccumulated)}</p>
          <p className="text-[11px] text-slate-500">Piso mínimo: {money(minCommissionExpected)}</p>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["N° Factura", "File / Expediente", "Cliente / Contraparte", "Concepto", "Volumen / Cant.", "Monto Facturado", "Comisión", "Estado", "Acciones"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-slate-400">
                    No hay facturas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
              {filteredInvoices.map(inv => {
                const isAnnulled = inv.annulled || inv.status === "Anulado"
                const isDescuadre = inv.status === "Vencida" 
                
                let badgeColor = "bg-slate-100 text-slate-600"
                let badgeText = "Conciliado"
                if (isAnnulled) { badgeColor = "bg-slate-900 text-white"; badgeText = "Anulado" }
                else if (isDescuadre) { badgeColor = "bg-red-100 text-red-700"; badgeText = "Descuadre / NC Pendiente" }
                
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-800">{inv.numero}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-blue-600 cursor-pointer hover:underline">
                        Ver Expediente
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">{inv.counterparty}</div>
                      <div className="font-mono text-[10px] text-slate-400">{inv.rut}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">{inv.typeName || "Transporte"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">{inv.containers.length > 0 ? `${inv.containers.length} cont.` : "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                      {money(inv.total)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {money(inv.total * 0.05)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-[10px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 bg-white">
                        Reasignar / Vincular
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
