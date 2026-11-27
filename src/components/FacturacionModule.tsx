// src/components/FacturacionModule.tsx
// Módulo de Facturación: estado, carga desde Supabase y sincronización con Nubox.
// Las pestañas y helpers están en src/components/facturacion/.
import { useMemo, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { fetchInvoicesByPeriod } from "../lib/nubox"
import { daysUntil } from "../lib/dates"
import { selectAll } from "../lib/fetchAll"
import { Invoice, Shipment, Doc, rowToInvoice, nuboxToInvoice, invoiceToRow, rowToShipment, rowToDoc, money } from "./facturacion/data"
import { IconName, Icon, ActionButton, Metric } from "./facturacion/ui"
import { InvoicesTab } from "./facturacion/InvoicesTab"
import { ShipmentsView, ShipmentPanel } from "./facturacion/ShipmentsView"
import { BookingsView } from "./facturacion/BookingsView"
import { VencimientosView } from "./facturacion/VencimientosView"
import { DocumentsView } from "./facturacion/DocumentsView"
import { InvoicePanel } from "./facturacion/InvoicePanel"
import { ConciliacionTab } from "./facturacion/ConciliacionTab"

/* ─── Componente principal ───────────────────────────────────────────────────── */

type WorkspaceTab = "facturas" | "embarques" | "reservas" | "documentos" | "vencimientos" | "conciliacion"

export default function FacturacionModule() {
  const [tab, setTab] = useState<WorkspaceTab>("facturas")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [documents, setDocuments] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [invoiceFilter, setInvoiceFilter] = useState<"Todas" | "Clientes" | "Proveedores">("Todas")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [toast, setToast] = useState("")
  const [bookingQuery, setBookingQuery] = useState("SB-10482")
  const [uploading, setUploading] = useState(false)

  const NUBOX_PERIOD = '2026-09'

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 4000)
  }

  const fetchFromSupabase = async () => {
    try {
      setError(null)
      const [invRes, shipRes, docRes] = await Promise.all([
        selectAll((from, to) => supabase.from('invoices').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
        selectAll((from, to) => supabase.from('shipments').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
        selectAll((from, to) => supabase.from('document_repository').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
      ])

      if (invRes.error) throw invRes.error
      if (shipRes.error) throw shipRes.error
      if (docRes.error) throw docRes.error

      setInvoices((invRes.data || []).map(rowToInvoice))
      setShipments((shipRes.data || []).map(rowToShipment))
      setDocuments((docRes.data || []).map(rowToDoc))
    } catch (err: any) {
      console.error('❌ Error al cargar desde Supabase:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const syncWithNubox = async () => {
    try {
      setSyncing(true)
      setError(null)

      
      const nuboxInvoices = await fetchInvoicesByPeriod(NUBOX_PERIOD)

      if (nuboxInvoices.length === 0) {
        showToast('⚠️ No hay facturas en el período seleccionado')
        return
      }

      const { data: existingInvoices, error: fetchErr } = await selectAll((from, to) => supabase
        .from('invoices')
        .select('id, numero, bl, booking, containers, provider_invoices, pdf, direction')
        .order('id')
        .range(from, to))

      if (fetchErr) throw fetchErr

      const existingMap = new Map<string, any>()
      for (const inv of existingInvoices || []) {
        if (inv.numero) existingMap.set(inv.numero, inv)
      }

      const dedupedMap = new Map<string, any>()

      for (const nuboxInv of nuboxInvoices) {
        const mapped = nuboxToInvoice(nuboxInv)
        const row = invoiceToRow(mapped)
        const existing = existingMap.get(mapped.numero)

        let finalRow: any
        if (existing) {
          finalRow = {
            ...row,
            bl: existing.bl || '',
            booking: existing.booking || '',
            containers: existing.containers || [],
            provider_invoices: existing.provider_invoices || [],
            pdf: existing.pdf || null,
            direction: existing.direction || 'Cliente',
          }
        } else {
          finalRow = row
        }

        dedupedMap.set(mapped.numero, finalRow)
      }

      const rowsToUpsert = Array.from(dedupedMap.values())
      const BATCH_SIZE = 25
      const totalBatches = Math.ceil(rowsToUpsert.length / BATCH_SIZE)
      
      let procesadas = 0
      let errores: string[] = []

      for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const batch = rowsToUpsert.slice(i, i + BATCH_SIZE)
        
        try {
          const { error: upsertErr } = await supabase
            .from('invoices')
            .upsert(batch, {
              onConflict: 'numero',
              ignoreDuplicates: false,
            })

          if (upsertErr) throw upsertErr
          procesadas += batch.length
        } catch (err: any) {
          console.error(`❌ Error en lote ${batchNumber}/${totalBatches}:`, err)
          errores.push(`Lote ${batchNumber}: ${err.message}`)
        }
      }

      await fetchFromSupabase()

      if (errores.length === 0) {
        showToast(`✅ ${procesadas} facturas sincronizadas correctamente`)
      } else {
        showToast(`⚠️ ${procesadas} sincronizadas · ${errores.length} lotes con error`)
        setError(`${errores.length} lotes fallaron. Revisa la consola.`)
      }

    } catch (err: any) {
      console.error('❌ Error al sincronizar:', err)
      setError(err.message || 'Error al sincronizar con Nubox')
    } finally {
      setSyncing(false)
    }
  }

  const uploadDocument = async (params: {
    file: File
    relation: string
    linkedType: "invoice" | "shipment"
    linkedId: string
    bl?: string
    booking?: string
    container?: string
    invoiceNumber?: string
  }) => {
    const { file, relation, linkedType, linkedId, bl, booking, container, invoiceNumber } = params

    try {
      setUploading(true)
      setError(null)

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${relation}/${timestamp}_${safeName}`


      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const sizeInMB = file.size / (1024 * 1024)
      const sizeFormatted = sizeInMB >= 1 
        ? `${sizeInMB.toFixed(1).replace('.', ',')} MB`
        : `${(file.size / 1024).toFixed(0)} KB`

      const { error: insertErr } = await supabase
        .from('document_repository')
        .insert([{
          name: file.name,
          relation,
          stage: 'Timbrado y firmado',
          size: sizeFormatted,
          url: urlData.publicUrl,
          file_url: urlData.publicUrl,
          file_path: filePath,
          linked_type: linkedType,
          linked_id: linkedId,
          bl: bl || null,
          booking: booking || null,
          container: container || null,
          invoice_number: invoiceNumber || null,
        }])

      if (insertErr) {
        console.warn('⚠️ Insert falló, limpiando archivo del Storage...')
        await supabase.storage.from('documents').remove([filePath])
        throw insertErr
      }

      await fetchFromSupabase()
      showToast(`✅ "${file.name}" subido correctamente`)

    } catch (err: any) {
      console.error('❌ Error al subir documento:', err)
      setError(err.message || 'Error al subir el documento')
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async (doc: Doc) => {
    if (!confirm(`¿Eliminar "${doc.name}"? Esta acción no se puede deshacer.`)) return

    try {
      setError(null)

      if (doc.filePath) {
        const { error: storageErr } = await supabase.storage
          .from('documents')
          .remove([doc.filePath])

        if (storageErr) {
          console.warn('⚠️ No se pudo borrar de Storage:', storageErr)
        }
      }

      const { error: deleteErr } = await supabase
        .from('document_repository')
        .delete()
        .eq('id', doc.id)

      if (deleteErr) throw deleteErr

      await fetchFromSupabase()
      showToast(`🗑 "${doc.name}" eliminado`)

    } catch (err: any) {
      console.error('❌ Error al eliminar documento:', err)
      setError(err.message || 'Error al eliminar el documento')
    }
  }

  useEffect(() => {
    fetchFromSupabase()
  }, [])

  const receivable = invoices
    .filter((inv) => inv.direction === "Cliente" && inv.status !== "Pagada")
    .reduce((sum, inv) => sum + inv.total, 0)
  const payable = invoices
    .filter((inv) => inv.direction === "Proveedor" && inv.status !== "Pagada")
    .reduce((sum, inv) => sum + inv.total, 0)

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter((inv) => {
      const directionMatch =
        invoiceFilter === "Todas" ||
        (invoiceFilter === "Clientes" && inv.direction === "Cliente") ||
        (invoiceFilter === "Proveedores" && inv.direction === "Proveedor")
      return directionMatch && [
        inv.numero, inv.counterparty, inv.rut,
        inv.typeName, inv.typeAbbreviation, inv.emissionStatusName,
        inv.bl, inv.booking, ...inv.containers
      ].join(" ").toLowerCase().includes(q)
    })
  }, [invoices, invoiceFilter, search])

  const urgentCount = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === "Pagada") return false
      if (!inv.dueDate) return false
      return daysUntil(inv.dueDate) <= 7
    }).length
  }, [invoices])

  const workspaceTabs: { id: WorkspaceTab; label: string; icon: IconName; count?: number }[] = [
    { id: "facturas", label: "Facturas y pagos", icon: "finance", count: invoices.length },
    { id: "embarques", label: "BL y contenedores", icon: "box", count: shipments.length },
    { id: "reservas", label: "Reservas", icon: "booking" },
    { id: "vencimientos", label: "Vencimientos", icon: "clock", count: urgentCount },
    { id: "documentos", label: "Repositorio", icon: "document", count: documents.filter(d => d.fileUrl).length },
    { id: "conciliacion", label: "Conciliación y Conceptos", icon: "finance", count: invoices.filter(i => i.status === "Vencida" || i.status === "Anulado").length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando datos financieros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Finanzas</span>
              <span className="text-slate-300">/</span>
              <span>Gestión documental</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Documentos y facturación</h1>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton 
              variant="secondary" 
              onClick={syncWithNubox}
              disabled={syncing}
            >
              <Icon name="refresh" className={syncing ? "animate-spin" : ""} />
              {syncing ? 'Sincronizando...' : 'Sincronizar con Nubox'}
            </ActionButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-5 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <Icon name="alert" className="size-5 text-red-600" />
            <span className="text-xs font-semibold text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <section className="grid gap-3 lg:grid-cols-4">
          <Metric label="Por cobrar a clientes" value={money(receivable)} detail={`${invoices.filter((inv) => inv.direction === "Cliente" && inv.status !== "Pagada").length} facturas abiertas`} tone="blue" icon="arrow" />
          <Metric label="Por pagar a proveedores" value={money(payable)} detail={`${invoices.filter((inv) => inv.direction === "Proveedor" && inv.status !== "Pagada").length} facturas abiertas`} tone="orange" icon="arrow" reverse />
          <Metric label="Documentos vinculados" value={String(documents.filter(d => d.fileUrl).length)} detail="Repositorio histórico" tone="green" icon="document" />
          <Metric label="Alertas activas" value={String(invoices.filter(i => i.status === 'Vencida' || i.emissionStatusName === 'Rechazado por SII').length)} detail="Vencidas / Rechazadas" tone="red" icon="alert" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex overflow-x-auto border-b border-slate-200 px-3">
            {workspaceTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex h-14 items-center gap-2 border-b-2 px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === item.id ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
                {item.count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{item.count}</span>}
              </button>
            ))}
          </div>

          {tab === "facturas" && (
            <InvoicesTab
              invoices={filteredInvoices}
              totalInvoices={invoices.length}
              search={search}
              setSearch={setSearch}
              filter={invoiceFilter}
              setFilter={setInvoiceFilter}
              onSelect={setSelectedInvoice}
              onSync={syncWithNubox}
              syncing={syncing}
            />
          )}
          {tab === "embarques" && (
            <ShipmentsView 
              shipments={shipments} 
              documents={documents}
              onSelect={setSelectedShipment}
            />
          )}
          {tab === "reservas" && (
            <BookingsView 
              query={bookingQuery} 
              setQuery={setBookingQuery} 
              shipments={shipments}
              documents={documents}
            />
          )}
          {tab === "vencimientos" && (
            <VencimientosView invoices={invoices} />
          )}
          {tab === "documentos" && (
            <DocumentsView documents={documents} onDelete={deleteDocument} />
          )}
          {tab === "conciliacion" && ( 
            <ConciliacionTab invoices={invoices} />
          )}
        </section>
      </main>

      {selectedInvoice && (
        <InvoicePanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {selectedShipment && (
        <ShipmentPanel
          shipment={selectedShipment}
          documents={documents}
          uploading={uploading}
          onClose={() => setSelectedShipment(null)}
          onUploadForInvoice={async (file) => {
            await uploadDocument({
              file,
              relation: selectedShipment.bl || selectedShipment.booking || selectedShipment.container,
              linkedType: "invoice",
              linkedId: selectedShipment.id,
              bl: selectedShipment.bl,
              booking: selectedShipment.booking,
              container: selectedShipment.container,
            })
          }}
          onUploadForShipment={async (file) => {
            await uploadDocument({
              file,
              relation: selectedShipment.bl || selectedShipment.booking || selectedShipment.container,
              linkedType: "shipment",
              linkedId: selectedShipment.id,
              bl: selectedShipment.bl,
              booking: selectedShipment.booking,
              container: selectedShipment.container,
            })
          }}
          onDeleteDocument={deleteDocument}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl">
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}
