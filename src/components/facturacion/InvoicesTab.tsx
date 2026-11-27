// src/components/facturacion/InvoicesTab.tsx
import { daysUntil } from "../../lib/dates"
import { Invoice, money, formatDate } from "./data"
import { Icon, StatusPill, ActionButton, SectionTitle } from "./ui"

export function InvoicesTab({ 
  invoices, totalInvoices, search, setSearch, filter, setFilter, onSelect, onSync, syncing,
}: {
  invoices: Invoice[]
  totalInvoices: number
  search: string
  setSearch: (v: string) => void
  filter: "Todas" | "Clientes" | "Proveedores"
  setFilter: (f: "Todas" | "Clientes" | "Proveedores") => void
  onSelect: (inv: Invoice) => void
  onSync: () => void
  syncing: boolean
}) {
  if (totalInvoices === 0) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Icon name="refresh" className="size-8 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No hay facturas sincronizadas</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Haz clic en "Sincronizar con Nubox" para traer las facturas del período 2026-09.
        </p>
        <div className="mt-6">
          <ActionButton onClick={onSync} disabled={syncing}>
            <Icon name="refresh" className={syncing ? "animate-spin" : ""} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con Nubox'}
          </ActionButton>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <SectionTitle title="Control financiero unificado" description="Vista simplificada de cobros y pagos con trazabilidad documental." />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar factura, RUT, empresa, tipo, estado..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(["Todas", "Clientes", "Proveedores"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1200px] text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {["Documento", "Contraparte", "Tipo", "Vínculos", "Emisión", "Vencimiento", "Neto", "IVA", "Total", "Estado", "Pago", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr><td colSpan={12} className="text-center py-12 text-xs text-slate-400">No hay facturas que coincidan con la búsqueda.</td></tr>
            )}
            {invoices.map((inv) => {
              const displayStatus = inv.emissionStatusName || inv.status
              const isOverdue = inv.status === "Vencida" || (inv.dueDate && daysUntil(inv.dueDate) < 0 && inv.status !== "Pagada")
              const isRejected = inv.emissionStatusName === "Rechazado por SII"
              
              return (
                <tr key={inv.id} className="group hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <button onClick={() => onSelect(inv)} className="text-left">
                      <span className="block font-mono text-xs font-semibold text-slate-800">{inv.numero || '—'}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {inv.direction === "Cliente" ? "Emitida a cliente" : "Recibida de proveedor"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-slate-700">{inv.counterparty || '—'}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">{inv.rut || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                      {inv.typeAbbreviation || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.bl ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <Icon name="link" className="size-3.5 text-slate-400" />
                          <span className="font-mono">{inv.bl}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {inv.containers.length} cont. · {inv.booking || '—'}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-slate-600">{formatDate(inv.issueDate)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[11px] ${isOverdue ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                      {formatDate(inv.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{money(inv.net)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                    {inv.totalVatAmount !== undefined ? money(inv.totalVatAmount) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-900">{money(inv.total)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={displayStatus} />
                    {isRejected && (
                      <div className="mt-1 text-[9px] text-red-600 font-semibold">Rechazada</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] text-slate-500">{inv.paymentFormName || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => onSelect(inv)} 
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" 
                      aria-label={`Ver ${inv.numero}`}
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        {invoices.length} de {totalInvoices} facturas · Datos desde Supabase
      </p>
    </div>
  )
}
