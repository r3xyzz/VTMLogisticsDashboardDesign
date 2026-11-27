// src/components/facturacion/InvoicePanel.tsx
import { InvoiceStatus, Invoice, money, formatDate } from "./data"
import { StatusPill, ActionButton, Detail } from "./ui"

export function InvoicePanel({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const displayStatus = (invoice.emissionStatusName || invoice.status) as InvoiceStatus
  
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {invoice.direction === "Cliente" ? "Factura emitida" : "Factura recibida"}
                {invoice.typeName && ` · ${invoice.typeName}`}
              </p>
              <h2 className="mt-1 font-mono text-2xl font-bold text-slate-900">{invoice.numero}</h2>
              <p className="mt-1 text-sm text-slate-600">{invoice.counterparty}</p>
              {invoice.rut && (
                <p className="mt-0.5 font-mono text-xs text-slate-400">RUT {invoice.rut}</p>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 flex-shrink-0">
              <span className="text-lg">×</span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <StatusPill status={displayStatus} />
            {invoice.paymentFormName && (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {invoice.paymentFormName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos generales</p>
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Emisión" value={formatDate(invoice.issueDate)} mono />
              <Detail label="Vencimiento" value={formatDate(invoice.dueDate)} mono />
              <Detail label="Tipo de documento" value={invoice.typeName || '—'} />
              <Detail label="Código SII" value={invoice.typeLegalCode || '—'} mono />
              {invoice.saleTypeName && <Detail label="Tipo de venta" value={invoice.saleTypeName} />}
              {invoice.originName && <Detail label="Origen" value={invoice.originName} />}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Datos del cliente</p>
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400">Razón social</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{invoice.counterparty || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">RUT</p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">{invoice.rut || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">Giro</p>
                  <p className="mt-0.5 text-xs text-slate-600 truncate">{invoice.clientMainActivity || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Desglose de montos</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between px-4 py-2.5 text-xs bg-slate-50">
                <span className="text-slate-500">Monto neto</span>
                <span className="font-mono font-semibold text-slate-800">{money(invoice.net)}</span>
              </div>
              {invoice.totalExemptAmount !== undefined && invoice.totalExemptAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Monto exento</span>
                  <span className="font-mono font-semibold text-slate-800">{money(invoice.totalExemptAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                <span className="text-slate-500">IVA (19%)</span>
                <span className="font-mono font-semibold text-slate-800">
                  {invoice.totalVatAmount !== undefined ? money(invoice.totalVatAmount) : '—'}
                </span>
              </div>
              {invoice.totalOtherTaxesAmount !== undefined && invoice.totalOtherTaxesAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Otros impuestos</span>
                  <span className="font-mono font-semibold text-slate-800">{money(invoice.totalOtherTaxesAmount)}</span>
                </div>
              )}
              {invoice.totalWithholdingAmount !== undefined && invoice.totalWithholdingAmount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-xs border-t border-slate-100">
                  <span className="text-slate-500">Retenciones</span>
                  <span className="font-mono font-semibold text-slate-800">-{money(invoice.totalWithholdingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 text-sm font-bold bg-blue-50 border-t border-blue-200">
                <span className="text-blue-900">Total</span>
                <span className="font-mono text-blue-900">{money(invoice.total)}</span>
              </div>
              {invoice.balance !== undefined && (
                <div className="flex justify-between px-4 py-2.5 text-xs bg-amber-50 border-t border-amber-200">
                  <span className="text-amber-800 font-semibold">Saldo pendiente</span>
                  <span className="font-mono font-bold text-amber-800">{money(invoice.balance)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.emissionStatusName && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado de emisión en Nubox</p>
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <StatusPill status={displayStatus} />
                  {invoice.annulled && (
                    <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">
                      ANULADA
                    </span>
                  )}
                </div>
                {invoice.emissionStatusDescription && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400">Descripción</p>
                    <p className="mt-0.5 text-xs text-slate-600">{invoice.emissionStatusDescription}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(invoice.periodMonth || invoice.periodYear || invoice.nuboxId || invoice.trackId) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Período y trazabilidad</p>
              <div className="grid grid-cols-2 gap-4">
                {invoice.periodMonth && invoice.periodYear && (
                  <Detail 
                    label="Período contable" 
                    value={`${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`} 
                    mono 
                  />
                )}
                {invoice.nuboxId && <Detail label="ID Nubox" value={String(invoice.nuboxId)} mono />}
                {invoice.trackId && <Detail label="Track ID" value={String(invoice.trackId)} mono />}
                {invoice.nuboxLastSync && (
                  <Detail 
                    label="Última sincronización" 
                    value={new Date(invoice.nuboxLastSync).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })} 
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 border-t border-slate-100 pt-5">
            <ActionButton variant="secondary" onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  )
}
