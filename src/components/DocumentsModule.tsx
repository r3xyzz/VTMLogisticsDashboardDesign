// src/components/DocumentsModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces
interface OrderDocumentStatus {
    pod_empty_url: string | null;
    pod_final_url: string | null;
    load_evidence_url: string | null;
    delivery_evidence_url: string | null;
}

interface OrderWithClient {
    id: string;
    fleet_id?: string | null;
    provider_id?: string | null;
    provider?: { name: string; rut: string | null; vehicle_plate: string | null; contact_phone: string | null } | null;
    order_number: string;
    client_id: string;
    client_contact: string | null;
    service_type: string;
    service_date: string;
    quantity: number | null;
    package_type: string | null;
    weight_kg: number | null;
    volume_cbm: number | null;
    container_number: string | null;
    description: string | null;
    origin: string;
    destination: string;
    is_inside_triangle: boolean;
    sold_value: number;
    purchased_value: number;
    profit: number;
    status: string;
    priority: string;
    request_kind?: 'tarifado' | 'cotizacion' | null;
    declared_cbm?: number | null;
    measured_cbm?: number | null;
    client_status?: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    client?: {
        name: string;
        code: string;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
    };
    creator?: {
        id: string;
        full_name: string;
        email: string;
    };
    doc_status?: OrderDocumentStatus | null;
}

interface OrderDocuments {
    id: string;
    order_id: string;
    pod_empty_url: string | null;
    pod_final_url: string | null;
    load_evidence_url: string | null;
    delivery_evidence_url: string | null;
    review?: Record<string, boolean> | null;
    reviewed_by?: string | null;
    final_pdf_url?: string | null;
    final_sent_at?: string | null;
    created_at: string;
    updated_at: string;
}

interface OrderDetailProps {
    order: OrderWithClient | null;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

type DocKey = 'pod_empty' | 'pod_final' | 'load_evidence' | 'delivery_evidence';

// Orden del expediente = orden en que el chofer sube las fotos
const DOC_SLOTS: { key: DocKey; column: keyof OrderDocumentStatus; label: string; description: string }[] = [
    { key: 'pod_empty', column: 'pod_empty_url', label: '1 · POD vacío', description: 'Documento antes del viaje (sin firmas ni sellos)' },
    { key: 'load_evidence', column: 'load_evidence_url', label: '2 · Evidencia de carga', description: 'Mercadería al momento de subir al camión' },
    { key: 'pod_final', column: 'pod_final_url', label: '3 · POD firmado', description: 'Documento con firma y sello de conformidad' },
    { key: 'delivery_evidence', column: 'delivery_evidence_url', label: '4 · Evidencia de descarga', description: 'Mercadería entregada en destino' },
];

const CLIENT_STATUSES = [
    'Carga en bodega de despacho',
    'Carga saliendo de bodega de despacho',
    'Camión en ruta',
    'Carga dispuesta a entregar',
    'Carga entregada',
];

const isImageUrl = (url: string | null) => !!url && /\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(url);
const clp = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const firstEmail = (value: string | null | undefined) => (value || '').split(/[,;\s]+/).find(e => e.includes('@')) || '';
const gmailCompose = (to: string, subject: string, body: string) =>
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener');

// Descarga real (el atributo download no sirve con URLs de otro dominio)
async function downloadUrl(url: string, fileName: string) {
    try {
        const blob = await (await fetch(url)).blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
    } catch {
        window.open(url, '_blank');
    }
}

async function urlToDataUrl(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

const imageSize = (dataUrl: string) => new Promise<{ w: number; h: number } | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
});

// PDF para el cliente: logo VTM, datos del servicio y evidencias (sin costos ni márgenes internos)
async function buildClientPdf(order: OrderWithClient, documents: OrderDocuments | null): Promise<jsPDF> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const navy: [number, number, number] = [22, 51, 88];
    const logo = await urlToDataUrl(`${import.meta.env.BASE_URL}logo_empresa_VTM.png`);
    const logoSize = logo ? await imageSize(logo) : null;

    const header = (subtitle: string) => {
        if (logo && logoSize) {
            const h = 11;
            pdf.addImage(logo, 'PNG', 15, 8, (logoSize.w / logoSize.h) * h, h);
        } else {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(...navy);
            pdf.text('VTM Logistics', 15, 16);
        }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...navy);
        pdf.text(subtitle, W - 15, 12, { align: 'right' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(100, 116, 139);
        pdf.text(`Orden ${order.order_number}`, W - 15, 18, { align: 'right' });
        pdf.setFillColor(...navy);
        pdf.rect(0, 26, W, 1.2, 'F');
    };

    header('Comprobante de servicio (POD)');
    let y = 36;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...navy);
    pdf.text(`Estado: ${order.client_status || 'En proceso'}`, 15, y);
    y += 4;

    const section = (title: string, rows: [string, string][]) => {
        autoTable(pdf, {
            startY: y + 2,
            head: [[{ content: title, colSpan: 2 }]],
            body: rows.filter(([, v]) => v && v !== '—'),
            theme: 'grid',
            margin: { left: 15, right: 15 },
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
            headStyles: { fillColor: navy, textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
            columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold', textColor: [71, 85, 105] } },
        });
        y = (pdf as any).lastAutoTable.finalY + 4;
    };

    section('Cliente', [
        ['Razón social', order.client?.name || '—'],
        ['Contacto', order.client?.contact_name || order.client_contact || '—'],
        ['Correo', order.client?.contact_email || '—'],
        ['Teléfono', order.client?.contact_phone || '—'],
    ]);
    section('Servicio', [
        ['Origen', order.origin || '—'],
        ['Destino', order.destination || '—'],
        ['Fecha de servicio', order.service_date ? new Date(`${order.service_date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CL') : '—'],
        ['Transporte', order.provider ? 'Transportista asociado' : 'Flota propia VTM'],
    ]);
    section('Carga', [
        ['Tipo de bulto', order.package_type || '—'],
        ['Cantidad', order.quantity ? `${order.quantity} uds.` : '—'],
        ['Peso', order.weight_kg ? `${order.weight_kg.toLocaleString('es-CL')} kg` : '—'],
        ['Volumen', order.volume_cbm ? `${order.volume_cbm.toLocaleString('es-CL')} m³` : '—'],
        ['Volumen declarado', order.declared_cbm ? `${order.declared_cbm.toLocaleString('es-CL')} m³` : '—'],
        ['Volumen medido', order.measured_cbm ? `${order.measured_cbm.toLocaleString('es-CL')} m³` : '—'],
        ['Contenedor', order.container_number || '—'],
        ['Observaciones', order.description || '—'],
    ]);
    section('Documentos', DOC_SLOTS.map((slot): [string, string] => [slot.label.replace(/^\d · /, ''), documents?.[slot.column] ? 'Adjunto' : 'Pendiente']));

    // Evidencias: una página por foto, respetando la proporción
    for (const slot of DOC_SLOTS) {
        const url = documents?.[slot.column] || null;
        if (!url) continue;
        pdf.addPage();
        header(slot.label.replace(/^\d · /, ''));
        if (!isImageUrl(url)) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42);
            pdf.text('Documento PDF adjunto. Disponible en:', 15, 40);
            pdf.setTextColor(37, 99, 235);
            pdf.textWithLink('Abrir documento', 15, 47, { url });
            continue;
        }
        const data = await urlToDataUrl(url);
        const size = data ? await imageSize(data) : null;
        if (!data || !size) {
            pdf.setFontSize(10); pdf.setTextColor(220, 38, 38);
            pdf.text('No se pudo cargar la imagen.', 15, 40);
            continue;
        }
        const maxW = W - 30, maxH = H - 55;
        const ratio = Math.min(maxW / size.w, maxH / size.h);
        const w = size.w * ratio, h = size.h * ratio;
        pdf.addImage(data, data.startsWith('data:image/png') ? 'PNG' : 'JPEG', (W - w) / 2, 36, w, h);
    }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, H - 14, W - 15, H - 14);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184);
        pdf.text('VTM Logistics · Transporte y logística', 15, H - 9);
        pdf.text(`Página ${i} de ${total}`, W / 2, H - 9, { align: 'center' });
        pdf.text(new Date().toLocaleString('es-CL'), W - 15, H - 9, { align: 'right' });
    }
    return pdf;
}

// Foto del expediente: vista, aprobación interna, descarga y reemplazo
function EvidenceSlot({ slot, url, approved, onUpload, onToggleApprove }: {
    slot: typeof DOC_SLOTS[number];
    url: string | null;
    approved: boolean;
    onUpload: (file: File) => Promise<void>;
    onToggleApprove: () => void;
}) {
    const [uploading, setUploading] = useState(false);
    const image = isImageUrl(url);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { addToast('❌ Solo imágenes (JPG, PNG) o PDF', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { addToast('❌ El archivo no puede superar los 10MB', 'error'); return; }
        try { setUploading(true); await onUpload(file); } finally { setUploading(false); }
    };

    return (
        <div className={`rounded-lg border p-3 ${url ? (approved ? 'border-green-300 bg-green-50/40' : 'border-amber-300 bg-amber-50/40') : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h5 className="text-sm font-semibold text-slate-800">{slot.label}</h5>
                    <p className="text-[11px] text-slate-500">{slot.description}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${!url ? 'bg-slate-100 text-slate-500' : approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {!url ? 'Sin cargar' : approved ? '✓ Aprobada' : 'Por revisar'}
                </span>
            </div>
            {url && (
                <button type="button" onClick={() => window.open(url, '_blank')} className="mt-2 block w-full overflow-hidden rounded-md border border-slate-200 bg-white">
                    {image
                        ? <img src={url} alt={slot.label} className="h-40 w-full object-contain" />
                        : <span className="flex h-16 items-center justify-center gap-2 text-xs font-semibold text-slate-600">📄 Documento PDF · abrir</span>}
                </button>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
                {url && (
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        <input type="checkbox" checked={approved} onChange={onToggleApprove} className="accent-green-600" />
                        Nítida y correcta
                    </label>
                )}
                <span className="ml-auto flex gap-1.5">
                    {url && <button type="button" onClick={() => downloadUrl(url, `${slot.key}${image ? '.jpg' : '.pdf'}`)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50">⬇ Descargar</button>}
                    <label className={`cursor-pointer rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 ${uploading ? 'opacity-50' : ''}`}>
                        {uploading ? '⏳ Subiendo…' : url ? '⟳ Reemplazar' : '⬆ Subir'}
                        <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={handleFile} />
                    </label>
                </span>
            </div>
        </div>
    );
}

interface ClientNotification { id: string; kind: string; to_email: string | null; subject: string; body: string; status: string; error: string | null; created_at: string; sent_at: string | null }

type EditableOrder = {
    client_contact: string; origin: string; destination: string; service_date: string; service_type: string;
    package_type: string; quantity: string; weight_kg: string; volume_cbm: string; declared_cbm: string; container_number: string;
    description: string; sold_value: string; purchased_value: string; priority: string; status: string; client_status: string;
};
const toEditable = (o: OrderWithClient): EditableOrder => ({
    client_contact: o.client_contact || '', origin: o.origin || '', destination: o.destination || '',
    service_date: (o.service_date || '').slice(0, 10), service_type: o.service_type || '', package_type: o.package_type || '',
    quantity: o.quantity != null ? String(o.quantity) : '', weight_kg: o.weight_kg != null ? String(o.weight_kg) : '',
    volume_cbm: o.volume_cbm != null ? String(o.volume_cbm) : '', declared_cbm: o.declared_cbm != null ? String(o.declared_cbm) : '',
    container_number: o.container_number || '', description: o.description || '',
    sold_value: String(o.sold_value ?? 0), purchased_value: String(o.purchased_value ?? 0),
    priority: o.priority || 'normal', status: o.status || 'pending', client_status: o.client_status || '',
});
// Acepta "1.234,5", "120,5" y "120.5"
const num = (value: string) => {
    let text = (value || '').trim().replace(/\s/g, '');
    if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '');
    const n = parseFloat(text.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

// Modal para ver/editar la orden, revisar fotos y enviar al cliente
function OrderDetailModal({ order, isOpen, onClose, onRefresh }: OrderDetailProps) {
    const [documents, setDocuments] = useState<OrderDocuments | null>(null);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [form, setForm] = useState<EditableOrder | null>(null);
    const [saving, setSaving] = useState(false);
    const [notifications, setNotifications] = useState<ClientNotification[]>([]);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && order) {
            setForm(toEditable(order));
            fetchDocuments();
            fetchNotifications();
        }
    }, [isOpen, order]);

    if (!order || !form) return null;

    async function fetchDocuments() {
        setLoadingDocs(true);
        const { data, error } = await supabase.from('documents').select('*').eq('order_id', order!.id).maybeSingle();
        if (error) console.error('Error fetching documents:', error);
        setDocuments(data);
        setLoadingDocs(false);
    }

    async function fetchNotifications() {
        const { data, error } = await supabase.from('client_notifications').select('*').eq('order_id', order!.id).order('created_at');
        if (error) { console.warn('Avisos al cliente no disponibles (¿migración 20261124?):', error.message); return; }
        setNotifications(data || []);
    }

    const set = (key: keyof EditableOrder, value: string) => setForm(f => f ? { ...f, [key]: value } : f);
    const review = documents?.review || {};
    const uploaded = DOC_SLOTS.filter(slot => documents?.[slot.column]);
    const allApproved = uploaded.length > 0 && uploaded.every(slot => review[slot.key]);
    const readyToSend = allApproved && !!documents?.pod_final_url;
    const clientEmail = firstEmail(order.client_contact) || firstEmail(order.client?.contact_email);
    const greeting = `Estimado/a ${order.client?.contact_name || order.client?.name || 'cliente'}:`;

    async function saveOrder() {
        setSaving(true);
        const sold = num(form!.sold_value), purchased = num(form!.purchased_value);
        const { error } = await supabase.from('orders').update({
            client_contact: form!.client_contact || null,
            origin: form!.origin, destination: form!.destination,
            service_date: form!.service_date || order!.service_date,
            service_type: form!.service_type,
            package_type: form!.package_type || null,
            quantity: parseInt(form!.quantity) || 0,
            weight_kg: num(form!.weight_kg),
            volume_cbm: num(form!.volume_cbm),
            declared_cbm: form!.declared_cbm ? num(form!.declared_cbm) : null,
            container_number: form!.container_number.trim().toUpperCase() || null,
            description: form!.description || null,
            sold_value: sold, purchased_value: purchased,
            // Con costo de compra: margen = venta - compra. Flota propia: el margen se mueve con la venta.
            profit: purchased > 0 ? sold - purchased : (order!.profit ?? 0) + (sold - (order!.sold_value ?? 0)),
            priority: form!.priority, status: form!.status,
            client_status: form!.client_status || null,
        }).eq('id', order!.id);
        setSaving(false);
        if (error) { addToast(`❌ No se pudo guardar: ${error.message}`, 'error'); return; }
        addToast('✅ Orden actualizada', 'success');
        onRefresh();
    }

    async function uploadFile(file: File, slot: typeof DOC_SLOTS[number]) {
        const ext = file.name.split('.').pop();
        const path = `orders/${order!.id}/${order!.order_number}_${slot.key}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('pod-documents').upload(path, file);
        if (uploadError) { addToast('❌ Error al subir el archivo', 'error'); return; }
        const url = supabase.storage.from('pod-documents').getPublicUrl(path).data.publicUrl;
        // Reemplazar una foto obliga a revisarla de nuevo
        const data: Record<string, unknown> = { order_id: order!.id, updated_at: new Date().toISOString(), [slot.column]: url, review: { ...review, [slot.key]: false } };
        const { error } = documents
            ? await supabase.from('documents').update(data).eq('id', documents.id)
            : await supabase.from('documents').insert([data]);
        if (error) { addToast('❌ Error al guardar el documento', 'error'); return; }
        if (slot.key === 'pod_final') {
            await supabase.from('orders').update({ status: 'completed' }).eq('id', order!.id);
            if (order!.fleet_id) await supabase.from('fleet').update({ status: 'available' }).eq('id', order!.fleet_id);
        }
        addToast('✅ Archivo cargado (queda por revisar)', 'success');
        await fetchDocuments();
        fetchNotifications();
        onRefresh();
    }

    async function toggleApprove(key: DocKey) {
        if (!documents) return;
        const next = { ...review, [key]: !review[key] };
        const email = (await supabase.auth.getSession()).data.session?.user.email ?? null;
        const { error } = await supabase.from('documents').update({ review: next, reviewed_by: email }).eq('id', documents.id);
        if (error) { addToast(`❌ No se pudo guardar la revisión: ${error.message}. ¿Corriste la migración 20261124?`, 'error'); return; }
        setDocuments({ ...documents, review: next, reviewed_by: email });
    }

    async function downloadPdf() {
        setBusy('pdf');
        try {
            const pdf = await buildClientPdf(order!, documents);
            pdf.save(`VTM_${order!.order_number}_POD.pdf`);
        } catch (e) {
            console.error(e);
            addToast('❌ Error al generar el PDF', 'error');
        } finally { setBusy(null); }
    }

    // Botón único: PDF final consolidado -> Storage -> Gmail con el enlace (el usuario revisa y envía)
    async function sendFinalPdf() {
        if (!readyToSend || !documents) return;
        setBusy('send');
        try {
            const pdf = await buildClientPdf(order!, documents);
            const blob = pdf.output('blob');
            const path = `orders/${order!.id}/final/VTM_${order!.order_number}_POD_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage.from('pod-documents').upload(path, blob, { contentType: 'application/pdf' });
            if (uploadError) throw uploadError;
            const url = supabase.storage.from('pod-documents').getPublicUrl(path).data.publicUrl;
            await supabase.from('documents').update({ final_pdf_url: url, final_sent_at: new Date().toISOString() }).eq('id', documents.id);
            pdf.save(`VTM_${order!.order_number}_POD.pdf`); // copia local por si se prefiere adjuntar
            gmailCompose(clientEmail, `VTM Logistics · ${order!.order_number} · Comprobante de entrega (POD)`, [
                greeting,
                '',
                `Adjuntamos el comprobante de entrega (POD) de la orden ${order!.order_number} (${order!.origin} → ${order!.destination}), con las evidencias revisadas.`,
                '',
                `Descargar PDF: ${url}`,
                '',
                'Saludos,',
                'Coordinación VTM Logistics',
            ].join('\n'));
            addToast('✅ PDF final listo. Revisa y envía el correo en Gmail.', 'success');
            fetchDocuments();
        } catch (e) {
            console.error(e);
            addToast('❌ No se pudo preparar el PDF final', 'error');
        } finally { setBusy(null); }
    }

    function sendDetailByGmail() {
        const isQuote = order!.request_kind === 'cotizacion';
        gmailCompose(firstEmail(form!.client_contact) || clientEmail, `VTM Logistics · ${isQuote ? 'Cotización' : 'Orden'} ${order!.order_number}`, [
            greeting,
            '',
            `Detalle de la ${isQuote ? 'cotización' : 'orden'} ${order!.order_number}:`,
            '',
            `Ruta: ${form!.origin} → ${form!.destination}`,
            `Fecha: ${form!.service_date ? form!.service_date.split('-').reverse().join('/') : '—'}`,
            `Carga: ${[form!.quantity && `${form!.quantity} ${form!.package_type}`, form!.weight_kg && `${form!.weight_kg} kg`, form!.volume_cbm && `${form!.volume_cbm} m³`].filter(Boolean).join(' · ') || '—'}`,
            form!.container_number ? `Contenedor: ${form!.container_number}` : '',
            `Valor neto: ${clp(num(form!.sold_value))} + IVA`,
            form!.description ? `Observaciones: ${form!.description}` : '',
            '',
            'Quedamos atentos.',
            '',
            'Saludos,',
            'VTM Logistics',
        ].filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n'));
    }

    async function sendPendingNotifications() {
        setBusy('notify');
        const { data, error } = await supabase.functions.invoke('send-client-notifications');
        setBusy(null);
        if (error) addToast('⚠️ El envío automático no está configurado. Usa "Enviar por Gmail" en cada aviso.', 'error');
        else addToast(`✅ Avisos enviados: ${data?.sent ?? 0}`, 'success');
        fetchNotifications();
    }

    async function sendNotificationByGmail(n: ClientNotification) {
        gmailCompose(n.to_email || clientEmail, n.subject, n.body);
        await supabase.from('client_notifications').update({ status: 'manual', sent_at: new Date().toISOString() }).eq('id', n.id);
        fetchNotifications();
    }

    const field = 'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
    const lbl = 'mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400';
    const input = (key: keyof EditableOrder, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <label className="block"><span className={lbl}>{label}</span><input className={field} value={form[key]} onChange={e => set(key, e.target.value)} {...props} /></label>
    );
    const notificationLabel: Record<string, string> = { carga_saliendo: 'Aviso 1 · Carga saliendo', carga_entregada: 'Aviso 2 · Carga entregada' };
    const notificationStatus: Record<string, string> = { pending: 'Pendiente', sent: 'Enviado', manual: 'Enviado por Gmail', error: 'Error' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`📄 ${order.request_kind === 'cotizacion' ? 'Cotización' : 'Orden'} ${order.order_number}`} size="xl">
            <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">{order.client?.name || 'Sin cliente'}</h3>
                        <p className="text-xs text-slate-500">Creada {new Date(order.created_at).toLocaleString('es-CL')} · {order.provider ? `Subcontrato: ${order.provider.name}` : 'Flota propia'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select className={field + ' w-auto'} value={form.priority} onChange={e => set('priority', e.target.value)}>
                            <option value="normal">🟢 Normal</option><option value="urgente">🔴 Urgente</option>
                        </select>
                        <select className={field + ' w-auto'} value={form.status} onChange={e => set('status', e.target.value)}>
                            <option value="draft">Borrador / cotización</option><option value="pending">Pendiente</option><option value="in_progress">En progreso</option><option value="completed">Completada</option>
                        </select>
                    </div>
                </div>

                {/* Datos editables */}
                <section className="rounded-lg border border-slate-200 p-4">
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Detalle (editable)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="col-span-2">{input('client_contact', 'Contacto / email del cliente')}</div>
                        <label className="col-span-2 block"><span className={lbl}>Estado visible para el cliente</span>
                            <select className={field} value={form.client_status} onChange={e => set('client_status', e.target.value)}>
                                <option value="">— Sin estado —</option>
                                {CLIENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </label>
                        {input('origin', 'Origen')}
                        {input('destination', 'Destino')}
                        {input('service_date', 'Fecha servicio', { type: 'date' })}
                        {input('service_type', 'Tipo de servicio')}
                        {input('package_type', 'Tipo de bulto')}
                        {input('quantity', 'Cantidad', { inputMode: 'numeric' })}
                        {input('weight_kg', 'Peso (kg)', { inputMode: 'decimal' })}
                        {input('container_number', 'Contenedor')}
                        {input('volume_cbm', 'Volumen a cobrar (m³)', { inputMode: 'decimal' })}
                        {input('declared_cbm', 'Volumen declarado (m³)', { inputMode: 'decimal' })}
                        {input('sold_value', 'Valor venta (CLP)', { inputMode: 'decimal' })}
                        {input('purchased_value', 'Costo compra (CLP)', { inputMode: 'decimal' })}
                        <label className="col-span-2 md:col-span-4 block"><span className={lbl}>Observaciones</span>
                            <textarea className={field + ' resize-none'} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
                        </label>
                    </div>
                    {order.measured_cbm != null && order.declared_cbm != null && (
                        <p className="mt-2 text-[11px] text-slate-500">Cubicaje: declarado {order.declared_cbm} m³ · medido {order.measured_cbm} m³{order.measured_cbm > order.declared_cbm ? ' · se cobra el medido' : ''}</p>
                    )}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button onClick={sendDetailByGmail} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">✉ Enviar detalle por Gmail</button>
                        <button onClick={saveOrder} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                    </div>
                </section>

                {/* Revisión interna de fotos (no se envían al cliente hasta aprobarlas) */}
                <section className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Revisión de evidencias {loadingDocs && <span className="text-slate-400">· cargando…</span>}</h4>
                        <span className="text-[10px] text-slate-500">Si una foto está borrosa o tapada: descárgala, corrígela y usa "Reemplazar".</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {DOC_SLOTS.map(slot => (
                            <EvidenceSlot key={slot.key} slot={slot} url={documents?.[slot.column] || null} approved={!!review[slot.key]}
                                onUpload={file => uploadFile(file, slot)} onToggleApprove={() => toggleApprove(slot.key)} />
                        ))}
                    </div>
                    {documents?.reviewed_by && <p className="mt-2 text-[10px] text-slate-400">Última revisión: {documents.reviewed_by}</p>}
                </section>

                {/* Avisos automáticos de estado (sin fotos) */}
                <section className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avisos de estado al cliente (sin fotos)</h4>
                        {notifications.some(n => n.status === 'pending' || n.status === 'error') && (
                            <button onClick={sendPendingNotifications} disabled={busy === 'notify'} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{busy === 'notify' ? 'Enviando…' : 'Enviar avisos pendientes'}</button>
                        )}
                    </div>
                    {notifications.length === 0
                        ? <p className="text-[11px] text-slate-400">Se generan solos: aviso 1 con las fotos 1 y 2 del chofer, aviso 2 con las fotos 3 y 4.</p>
                        : <ul className="space-y-1.5">{notifications.map(n => (
                            <li key={n.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-[11px]">
                                <strong className="text-slate-700">{notificationLabel[n.kind] || n.kind}</strong>
                                <span className="text-slate-400">{n.to_email || 'cliente sin correo registrado'}</span>
                                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${n.status === 'error' ? 'bg-red-100 text-red-700' : n.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`} title={n.error || ''}>{notificationStatus[n.status] || n.status}</span>
                                {(n.status === 'pending' || n.status === 'error') && <button onClick={() => sendNotificationByGmail(n)} className="text-[10px] font-bold text-red-600 hover:underline">Enviar por Gmail</button>}
                            </li>
                        ))}</ul>}
                </section>

                {/* Acciones finales */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <button onClick={downloadPdf} disabled={busy === 'pdf'} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy === 'pdf' ? '⏳ Generando…' : '📥 Vista previa PDF'}</button>
                    <div className="flex flex-wrap items-center gap-2">
                        {documents?.final_sent_at && <span className="text-[10px] text-green-700">PDF final preparado {new Date(documents.final_sent_at).toLocaleString('es-CL')}</span>}
                        <button
                            onClick={sendFinalPdf}
                            disabled={!readyToSend || busy === 'send'}
                            title={readyToSend ? '' : 'Aprueba todas las fotos cargadas (y el POD firmado) para habilitar el envío'}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy === 'send' ? '⏳ Preparando…' : '📤 Enviar PDF final al cliente'}
                        </button>
                        <button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900">Cerrar</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// Componente Principal
export default function DocumentsModule() {
    const [orders, setOrders] = useState<OrderWithClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderWithClient | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const toasts = useToasts();
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        fetchOrders();
    }, [filterStatus, refreshKey]);

    // Tiempo real: lo que sube el camionero aparece sin recargar (requiere Realtime activo en Supabase)
    useEffect(() => {
        const channel = supabase
            .channel('documents-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => setRefreshKey(k => k + 1))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => setRefreshKey(k => k + 1))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchOrders() {
        try {
            setLoading(true);
            
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    client:clients (
                        name,
                        code,
                        contact_name,
                        contact_email,
                        contact_phone
                    ),
                    documents (
                        pod_empty_url,
                        pod_final_url,
                        load_evidence_url,
                        delivery_evidence_url
                    ),
                    provider:providers (
                        name,
                        rut,
                        vehicle_plate,
                        contact_phone
                    )
                `)
                .order('created_at', { ascending: false });

            if (filterStatus === 'pending') query = query.eq('status', 'pending');
            else if (filterStatus === 'completed') query = query.eq('status', 'completed');
            else if (filterStatus === 'in_progress') query = query.eq('status', 'in_progress');

            const { data, error } = await query;

            if (error) throw error;
            
            // ✅ OBTENER LOS CREADORES DE LAS ÓRDENES
            if (data && data.length > 0) {
                const creatorIds = data.map(order => order.created_by).filter(id => id !== null);
                
                if (creatorIds.length > 0) {
                    const { data: userData, error: userError } = await supabase
                        .from('user_profiles')
                        .select('id, full_name, email')
                        .in('id', creatorIds);
                    
                    if (!userError && userData) {
                        data.forEach(order => {
                            const creator = userData.find(u => u.id === order.created_by);
                            if (creator) order.creator = creator;
                        });
                    }
                }
            }

            const ordersWithDocs = (data || []).map(order => {
                const docData = Array.isArray(order.documents) && order.documents.length > 0 
                    ? order.documents[0] 
                    : null;
                
                return {
                    ...order,
                    doc_status: docData
                };
            });
            
            setOrders(ordersWithDocs);
        } catch (error) {
            console.error('Error fetching orders:', error);
            addToast('Error al cargar las órdenes', 'error');
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function Semaphore({ ok }: { ok: boolean }) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ok ? '#16a34a' : '#ea580c' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: ok ? '#16a34a' : '#ea580c' }} />
                {ok ? 'OK' : 'Pendiente'}
            </span>
        );
    }

    function getDocumentStatus(order: OrderWithClient) {
        const docs = order.doc_status;
        return { 
            pod: !!docs?.pod_final_url, 
            evid: !!docs?.load_evidence_url && !!docs?.delivery_evidence_url
        };
    }

    function handleViewOrder(order: OrderWithClient) {
        setSelectedOrder(order);
        setIsModalOpen(true);
    }

    function handleRefresh() {
        setRefreshKey(prev => prev + 1);
    }

    if (loading && orders.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-gray-500">Cargando órdenes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-screen-xl mx-auto">
            {toasts.map(toast => (
                <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => {}} />
            ))}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">📄 POD / Documentos y Cierre</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Pruebas de entrega, evidencias y estado de liquidación</p>
                </div>
                <div className="text-sm text-slate-500">Total: {orders.length} órdenes</div>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
                <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Todas</button>
                <button onClick={() => setFilterStatus('pending')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Pendientes</button>
                <button onClick={() => setFilterStatus('in_progress')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>En Progreso</button>
                <button onClick={() => setFilterStatus('completed')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterStatus === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Completadas</button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">OT</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cliente</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ruta</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Fecha</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Creado por</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">POD Firmado</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Evidencias</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No hay órdenes registradas</td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const status = getDocumentStatus(order);
                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{order.order_number}{order.request_kind === 'cotizacion' && <span className="mt-0.5 block w-fit rounded bg-violet-100 px-1.5 py-0.5 font-sans text-[9px] font-bold text-violet-700">Cotización</span>}</td>
                                            <td className="px-4 py-3 text-xs font-medium text-slate-700">{order.client?.name || order.client_contact || 'Sin cliente'}{order.provider && <span className="block text-[10px] font-normal text-amber-600">Subcontrato: {order.provider.name}</span>}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{order.origin} → {order.destination}{order.client_status && <span className="block text-[10px] font-semibold text-blue-600">{order.client_status}</span>}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.created_at)}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{order.creator?.full_name || order.creator?.email || 'Sistema'}</td>
                                            <td className="px-4 py-3 text-center"><Semaphore ok={status.pod} /></td>
                                            <td className="px-4 py-3 text-center"><Semaphore ok={status.evid} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleViewOrder(order)} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap">Ver detalles</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <OrderDetailModal
                order={selectedOrder}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedOrder(null);
                }}
                onRefresh={handleRefresh}
            />
        </div>
    );
}