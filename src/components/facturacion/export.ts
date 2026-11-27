// src/components/facturacion/export.ts
import { localDay } from "../../lib/dates"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Invoice, calcDaysToDue, getDiasLabel, formatDate } from "./data"

/* ─── Exportación ────────────────────────────────────────────────────────────── */

export type VencimientosData = {
  vencidas: Invoice[]
  vencenHoy: Invoice[]
  proximas: Invoice[]
  vigentes: Invoice[]
}

/** Convierte factura a fila de exportación */
export function invoiceToExportRow(inv: Invoice) {
  const days = calcDaysToDue(inv.dueDate)
  return {
    Documento: inv.numero || "",
    Contraparte: inv.counterparty || "",
    "Emisión": inv.issueDate ? formatDate(inv.issueDate) : "",
    "Vencimiento": inv.dueDate ? formatDate(inv.dueDate) : "",
    "Días": getDiasLabel(days),
    Total: inv.total,
  }
}

/** Exportar todo a PDF */
/** Exportar todo a PDF */
export function exportVencimientosToPDF(data: VencimientosData, searchQuery: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  const now = new Date()
  const dateStr = now.toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })

  // Header
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Reporte de Vencimientos", 14, 15)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text(`Generado el ${dateStr}`, 14, 21)

  if (searchQuery.trim()) {
    doc.setTextColor(180, 83, 9)
    doc.text(`Filtro aplicado: "${searchQuery.trim()}"`, 14, 26)
    doc.setTextColor(100)
  }

  // Totales globales
  const totalGlobal =
    data.vencidas.reduce((s, i) => s + i.total, 0) +
    data.vencenHoy.reduce((s, i) => s + i.total, 0) +
    data.proximas.reduce((s, i) => s + i.total, 0) +
    data.vigentes.reduce((s, i) => s + i.total, 0)

  const totalCount = data.vencidas.length + data.vencenHoy.length + data.proximas.length + data.vigentes.length

  doc.setFontSize(9)
  doc.setTextColor(60)
  doc.text(
    `Total facturas: ${totalCount}   ·   Monto total: ${formatMoneyForExport(totalGlobal)}`,
    14, 33
  )

  let currentY = 42

  const sections: { title: string; color: [number, number, number]; invoices: Invoice[] }[] = [
    { title: "Facturas vencidas", color: [220, 38, 38], invoices: data.vencidas },
    { title: "Vencen hoy", color: [234, 88, 12], invoices: data.vencenHoy },
    { title: "Próximas a vencer (7 días)", color: [217, 119, 6], invoices: data.proximas },
    { title: "Vigentes", color: [5, 150, 105], invoices: data.vigentes },
  ]

  sections.forEach(section => {
    if (section.invoices.length === 0) return

    const totalSection = section.invoices.reduce((s, i) => s + i.total, 0)

    // Título de sección
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...section.color)
    doc.text(`${section.title} (${section.invoices.length}) — ${formatMoneyForExport(totalSection)}`, 14, currentY)
    doc.setTextColor(60)

    // Rows
    const rows = section.invoices.map(inv => {
      const r = invoiceToExportRow(inv)
      return [r.Documento, r.Contraparte, r["Emisión"], r["Vencimiento"], r["Días"], formatMoneyForExport(r.Total)]
    })

    autoTable(doc, {
      startY: currentY + 3,
      head: [["Documento", "Contraparte", "Emisión", "Vencimiento", "Días", "Total"]],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: section.color,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 30, font: "courier", fontStyle: "bold" },
        1: { cellWidth: 80 },
        2: { cellWidth: 35, font: "courier" },
        3: { cellWidth: 35, font: "courier" },
        4: { cellWidth: 40 },
        5: { cellWidth: 40, halign: "right", font: "courier", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages()
        const pageSize = doc.internal.pageSize
        const pageHeight = pageSize.height
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageSize.width - 30,
          pageHeight - 8
        )
      },
    })

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 12

    if (currentY > 180) {
      doc.addPage()
      currentY = 20
    }
  })

  if (totalCount === 0) {
    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text("No hay facturas que coincidan con el filtro aplicado.", 14, 45)
  }

  const fileName = `Vencimientos_${localDay(now)}${searchQuery ? "_filtrado" : ""}.pdf`
  doc.save(fileName)
}

/** Exportar todo a Excel */
/** Exportar todo a Excel */
export function exportVencimientosToExcel(data: VencimientosData, searchQuery: string) {
  const wb = XLSX.utils.book_new()

  const now = new Date()
  const dateStr = now.toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })

  // Hoja resumen
  const totalGlobal =
    data.vencidas.reduce((s, i) => s + i.total, 0) +
    data.vencenHoy.reduce((s, i) => s + i.total, 0) +
    data.proximas.reduce((s, i) => s + i.total, 0) +
    data.vigentes.reduce((s, i) => s + i.total, 0)

  const totalCount = data.vencidas.length + data.vencenHoy.length + data.proximas.length + data.vigentes.length

  const summaryData: any[][] = [
    ["Reporte de Vencimientos"],
    [`Generado el ${dateStr}`],
    searchQuery ? [`Filtro: "${searchQuery}"`] : ["Sin filtro"],
    [],
    ["Categoría", "Cantidad", "Monto total"],
    ["Vencidas", data.vencidas.length, data.vencidas.reduce((s, i) => s + i.total, 0)],
    ["Vencen hoy", data.vencenHoy.length, data.vencenHoy.reduce((s, i) => s + i.total, 0)],
    ["Próximas 7 días", data.proximas.length, data.proximas.reduce((s, i) => s + i.total, 0)],
    ["Vigentes", data.vigentes.length, data.vigentes.reduce((s, i) => s + i.total, 0)],
    [],
    ["TOTAL", totalCount, totalGlobal],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 18 }]

  // Formatear columna C (monto) como moneda
  const range = XLSX.utils.decode_range(summarySheet["!ref"] || "A1")
  for (let row = range.s.r; row <= range.e.r; row++) {
    const cellAddr = XLSX.utils.encode_cell({ r: row, c: 2 })
    const cell = summarySheet[cellAddr]
    if (cell && typeof cell.v === "number" && cell.v > 1000) {
      cell.z = '"$"#,##0'
    }
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, "Resumen")

  // Hoja por categoría
  const sections = [
    { name: "Vencidas", invoices: data.vencidas },
    { name: "Vencen hoy", invoices: data.vencenHoy },
    { name: "Próximas 7 días", invoices: data.proximas },
    { name: "Vigentes", invoices: data.vigentes },
  ]

  sections.forEach(section => {
    if (section.invoices.length === 0) return

    const rows = section.invoices.map(inv => {
      const r = invoiceToExportRow(inv)
      return {
        Documento: r.Documento,
        Contraparte: r.Contraparte,
        "Emisión": r["Emisión"],
        "Vencimiento": r["Vencimiento"],
        "Días": r["Días"],
        Total: r.Total,
      }
    })

    // Fila total al final
    const totalSection = section.invoices.reduce((s, i) => s + i.total, 0)
    rows.push({
      Documento: "TOTAL",
      Contraparte: "",
      "Emisión": "",
      "Vencimiento": "",
      "Días": "",
      Total: totalSection,
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [
      { wch: 14 },
      { wch: 35 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
    ]

    // Formatear columna Total como moneda
    const wsRange = XLSX.utils.decode_range(ws["!ref"] || "A1")
    for (let row = wsRange.s.r + 1; row <= wsRange.e.r; row++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: 5 })
      const cell = ws[cellAddr]
      if (cell && typeof cell.v === "number") {
        cell.z = '"$"#,##0'
      }
    }

    const sheetName = section.name.substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  const fileName = `Vencimientos_${localDay(now)}${searchQuery ? "_filtrado" : ""}.xlsx`
  XLSX.writeFile(wb, fileName)
}

/** Formatea monto para exportación */
export function formatMoneyForExport(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}
