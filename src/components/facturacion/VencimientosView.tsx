// src/components/facturacion/VencimientosView.tsx
import { useMemo, useState } from "react"
import { daysUntil, parseDate } from "../../lib/dates"
import { Invoice, calcDaysToDue, money, formatDate } from "./data"
import { IconName, Icon, ActionButton, SectionTitle, DaysPill } from "./ui"

/* ─── Vencimientos ───────────────────────────────────────────────────────────── */

export function VencimientosView({ invoices }: { invoices: Invoice[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)

  // Filtrar facturas por búsqueda
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(inv => {
      return (
        inv.numero.toLowerCase().includes(q) ||
        inv.counterparty.toLowerCase().includes(q) ||
        (inv.rut || "").toLowerCase().includes(q) ||
        String(inv.total).includes(q) ||
        (inv.typeAbbreviation || "").toLowerCase().includes(q) ||
        (inv.typeName || "").toLowerCase().includes(q)
      )
    })
  }, [invoices, searchQuery])

  // Clasificar facturas por vencimiento
  const vencidas: Invoice[] = []
  const vencenHoy: Invoice[] = []
  const proximas: Invoice[] = []
  const vigentes: Invoice[] = []

  filteredInvoices.forEach(inv => {
    if (inv.status === "Pagada") return
    if (!inv.dueDate) return

    const days = daysUntil(inv.dueDate)

    if (days < 0) {
      vencidas.push(inv)
    } else if (days === 0) {
      vencenHoy.push(inv)
    } else if (days <= 7) {
      proximas.push(inv)
    } else {
      vigentes.push(inv)
    }
  })

  const sortByDue = (a: Invoice, b: Invoice) => parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime()
  vencidas.sort(sortByDue)
  vencenHoy.sort(sortByDue)
  proximas.sort(sortByDue)
  vigentes.sort(sortByDue)

  const totalVencidas = vencidas.reduce((sum, inv) => sum + inv.total, 0)
  const totalVencenHoy = vencenHoy.reduce((sum, inv) => sum + inv.total, 0)
  const totalProximas = proximas.reduce((sum, inv) => sum + inv.total, 0)
  const totalVigentes = vigentes.reduce((sum, inv) => sum + inv.total, 0)

  const totalAlerta = vencidas.length + vencenHoy.length + proximas.length
  const hasSearch = searchQuery.trim().length > 0
  const hasAnyData = vencidas.length + vencenHoy.length + proximas.length + vigentes.length > 0

  // jsPDF y SheetJS (export.ts) se descargan recién al exportar
  const handleExportPDF = async () => {
    try {
      setExporting("pdf")
      const { exportVencimientosToPDF } = await import("./export")
      exportVencimientosToPDF({ vencidas, vencenHoy, proximas, vigentes }, searchQuery)
    } catch (err) {
      console.error("Error exportando PDF:", err)
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = async () => {
    try {
      setExporting("excel")
      const { exportVencimientosToExcel } = await import("./export")
      exportVencimientosToExcel({ vencidas, vencenHoy, proximas, vigentes }, searchQuery)
    } catch (err) {
      console.error("Error exportando Excel:", err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle 
          title="Vencimientos" 
          description="Facturas vencidas, próximas a vencer y vigentes. Solo se consideran facturas sin pagar." 
        />

        {hasAnyData && (
          <div className="flex gap-2 flex-shrink-0">
            <ActionButton
              variant="secondary"
              onClick={handleExportExcel}
              disabled={exporting !== null}
            >
              {exporting === "excel" ? (
                <>
                  <Icon name="refresh" className="animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Icon name="download" />
                  Excel
                </>
              )}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportPDF}
              disabled={exporting !== null}
            >
              {exporting === "pdf" ? (
                <>
                  <Icon name="refresh" className="animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Icon name="download" />
                  PDF
                </>
              )}
            </ActionButton>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, RUT, número de factura o total..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1.5 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Limpiar búsqueda"
            >
              <span className="text-sm">×</span>
            </button>
          )}
        </div>

        {hasSearch && (
          <span className="text-[11px] text-slate-500 self-start sm:self-center">
            {filteredInvoices.length} factura{filteredInvoices.length !== 1 ? "s" : ""} encontrada{filteredInvoices.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Resumen */}
      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <VencimientoCard label="Vencidas" count={vencidas.length} total={totalVencidas} tone="red" icon="alert" subtitle="Atrasadas" />
        <VencimientoCard label="Vencen hoy" count={vencenHoy.length} total={totalVencenHoy} tone="orange" icon="clock" subtitle="Acción inmediata" />
        <VencimientoCard label="Próximas 7 días" count={proximas.length} total={totalProximas} tone="amber" icon="clock" subtitle="Planificar pago" />
        <VencimientoCard label="Vigentes" count={vigentes.length} total={totalVigentes} tone="green" icon="check" subtitle="Sin urgencia" />
      </div>

      {/* Sin resultados con búsqueda */}
      {hasSearch && filteredInvoices.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Icon name="search" className="mx-auto size-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">Sin resultados</p>
          <p className="mt-1 text-xs text-slate-500">
            No hay facturas que coincidan con "{searchQuery}".
          </p>
        </div>
      )}

      {/* Estado vacío (sin búsqueda) */}
      {!hasSearch && totalAlerta === 0 && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <Icon name="check" className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 text-sm font-bold text-emerald-800">¡Todo al día!</p>
          <p className="mt-1 text-xs text-emerald-700">
            No hay facturas vencidas ni próximas a vencer en los próximos 7 días.
          </p>
        </div>
      )}

      {/* Secciones */}
      {vencidas.length > 0 && (
        <VencimientoSection title="Facturas vencidas" subtitle="Atrasadas por más tiempo" tone="red" icon="alert" invoices={vencidas} />
      )}
      {vencenHoy.length > 0 && (
        <VencimientoSection title="Vencen hoy" subtitle="Requieren acción inmediata" tone="orange" icon="clock" invoices={vencenHoy} />
      )}
      {proximas.length > 0 && (
        <VencimientoSection title="Próximas a vencer (7 días)" subtitle="Planifica el pago esta semana" tone="amber" icon="clock" invoices={proximas} />
      )}
      {vigentes.length > 0 && (
        <VencimientoSection title="Vigentes" subtitle="Vencen en más de 7 días" tone="green" icon="check" invoices={vigentes} />
      )}
    </div>
  )
}

export function VencimientoCard({
  label, count, total, tone, icon, subtitle,
}: {
  label: string
  count: number
  total: number
  tone: "red" | "orange" | "amber" | "green"
  icon: IconName
  subtitle: string
}) {
  const toneClasses = {
    red: { text: "text-red-700", icon: "bg-red-100 text-red-600", ring: "ring-red-200" },
    orange: { text: "text-orange-700", icon: "bg-orange-100 text-orange-600", ring: "ring-orange-200" },
    amber: { text: "text-amber-700", icon: "bg-amber-100 text-amber-600", ring: "ring-amber-200" },
    green: { text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600", ring: "ring-emerald-200" },
  }
  const t = toneClasses[tone]

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 ring-1 ring-inset ${count > 0 ? t.ring : ""}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{count}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          {count > 0 && (
            <p className={`mt-1.5 text-[10px] font-bold ${t.text}`}>{money(total)}</p>
          )}
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${t.icon} flex-shrink-0`}>
          <Icon name={icon} />
        </span>
      </div>
    </div>
  )
}

export function VencimientoSection({
  title, subtitle, tone, icon, invoices,
}: {
  title: string
  subtitle: string
  tone: "red" | "orange" | "amber" | "green"
  icon: IconName
  invoices: Invoice[]
}) {
  const [open, setOpen] = useState(true)

  const toneHeader = {
    red: "bg-red-50 border-red-200 text-red-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
  }
  const toneIcon = {
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
    amber: "bg-amber-100 text-amber-600",
    green: "bg-emerald-100 text-emerald-600",
  }

  const totalSection = invoices.reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition hover:opacity-90 ${toneHeader[tone]}`}
      >
        <span className={`flex size-8 items-center justify-center rounded-lg ${toneIcon[tone]}`}>
          <Icon name={icon} className="size-4" />
        </span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold">{title} ({invoices.length})</p>
          <p className="text-[10px] opacity-80">{subtitle}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-xs font-bold">{money(totalSection)}</p>
          <p className="text-[10px] opacity-80">{open ? "Ocultar" : "Mostrar"}</p>
        </div>
        <Icon name="chevron" className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {["Documento", "Contraparte", "Emisión", "Vencimiento", "Días", "Total"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => {
                const days = calcDaysToDue(inv.dueDate)
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-800">{inv.numero}</span>
                      {inv.typeAbbreviation && (
                        <span className="ml-2 inline-flex rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                          {inv.typeAbbreviation}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-700 truncate">{inv.counterparty}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{inv.rut}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-600">{formatDate(inv.issueDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-semibold text-slate-800">{formatDate(inv.dueDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <DaysPill days={days} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-900">{money(inv.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
