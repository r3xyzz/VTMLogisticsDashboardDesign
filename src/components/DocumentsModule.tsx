// src/components/DocumentsModule.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Toast, addToast, useToasts } from './ui/Toast';
// ✅ jspdf
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Interfaces
interface OrderWithClient {
    id: string;
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
    // ✅ NUEVO: Datos del creador
    creator?: {
        id: string;
        full_name: string;
        email: string;
    };
}

interface OrderDocuments {
    id: string;
    order_id: string;
    pod_empty_url: string | null;
    pod_final_url: string | null;
    guide_url: string | null;
    invoice_url: string | null;
    created_at: string;
    updated_at: string;
}

interface OrderDetailProps {
    order: OrderWithClient | null;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

// Componente para subir imagen (reutilizable)
function ImageUploader({ 
    label, 
    description, 
    currentImage, 
    onUpload,
    disabled 
}: { 
    label: string;
    description: string;
    currentImage: string | null;
    onUpload: (file: File) => Promise<void>;
    disabled?: boolean;
}) {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            addToast('❌ Solo se permiten imágenes (JPG, PNG, etc.)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            addToast('❌ La imagen no puede superar los 5MB', 'error');
            return;
        }

        try {
            setUploading(true);
            await onUpload(file);
        } catch (error) {
            console.error('Error uploading image:', error);
            addToast('❌ Error al subir la imagen', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h5 className="text-sm font-semibold text-slate-800">{label}</h5>
                    <p className="text-xs text-slate-500">{description}</p>
                </div>
                <div className="flex items-center gap-2">
                    {currentImage ? (
                        <span className="text-xs text-green-600 font-semibold">✅ Cargado</span>
                    ) : (
                        <span className="text-xs text-red-500 font-semibold">❌ No cargado</span>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <label className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors border border-blue-200">
                        {uploading ? '⏳ Subiendo...' : '📤 Seleccionar imagen'}
                    </span>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading || disabled}
                    />
                </label>
                {currentImage && (
                    <button
                        onClick={() => window.open(currentImage, '_blank')}
                        className="text-xs text-blue-600 hover:text-blue-800"
                    >
                        🔍 Ver imagen
                    </button>
                )}
            </div>

            {currentImage && (
                <div className="mt-2">
                    <img 
                        src={currentImage} 
                        alt={label}
                        className="max-h-32 rounded-lg border border-slate-200 object-contain"
                        crossOrigin="anonymous"
                    />
                </div>
            )}
        </div>
    );
}

// Modal para ver/editar documentos
function OrderDetailModal({ order, isOpen, onClose, onRefresh }: OrderDetailProps) {
    if (!order) return null;

    const [documents, setDocuments] = useState<OrderDocuments | null>(null);
    const [loadingDocs, setLoadingDocs] = useState(true);

    const clp = (n: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

    // Cargar documentos de la orden
    useEffect(() => {
        if (isOpen && order) {
            fetchDocuments();
        }
    }, [isOpen, order]);

    async function fetchDocuments() {
        try {
            setLoadingDocs(true);
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('order_id', order!.id)
                .maybeSingle();

            if (error) throw error;
            setDocuments(data);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoadingDocs(false);
        }
    }

    // ✅ FUNCIÓN PARA CONVERTIR IMAGEN A BASE64
    const imageToBase64 = async (url: string): Promise<string | null> => {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.ok) {
                console.warn('⚠️ No se pudo cargar la imagen:', url);
                return null;
            }
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('❌ Error cargando imagen:', error);
            return null;
        }
    };

    // ✅ FUNCIÓN PARA GENERAR PDF CON IMÁGENES EN PÁGINAS SEPARADAS
    const generatePDF = async () => {
        try {
            addToast('⏳ Generando PDF...', 'info');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let yPos = 15;

            // ============================================
            // 1. CARGAR IMÁGENES
            // ============================================
            const logoBase64 = await imageToBase64('/logo_empresa_VTM.png');
            const podEmptyBase64 = documents?.pod_empty_url 
                ? await imageToBase64(documents.pod_empty_url) 
                : null;
            const podFinalBase64 = documents?.pod_final_url 
                ? await imageToBase64(documents.pod_final_url) 
                : null;

            // ============================================
            // 2. PÁGINA 1 - INFORMACIÓN DE LA ORDEN
            // ============================================
            
            // Header con logo
            pdf.setFillColor(25, 50, 80);
            pdf.rect(0, 0, pageWidth, 35, 'F');

            if (logoBase64) {
                try {
                    pdf.addImage(logoBase64, 'PNG', 12, 3, 30, 25);
                } catch (e) {
                    console.warn('⚠️ No se pudo insertar el logo:', e);
                }
            }

            pdf.setFontSize(18);
            pdf.setTextColor(255, 255, 255);
            pdf.text('VTM Logistics', 48, 12);
            pdf.setFontSize(11);
            pdf.text(`Detalle de Orden - ${order.order_number}`, 48, 22);
            yPos = 45;

            // Cliente
            pdf.setFontSize(13);
            pdf.setTextColor(25, 50, 80);
            pdf.text('📋 DATOS DEL CLIENTE', 15, yPos);
            yPos += 7;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(15, yPos - 2, pageWidth - 15, yPos - 2);
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Nombre: ${order.client?.name || 'Sin cliente'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Código: ${order.client?.code || 'N/A'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Contacto: ${order.client?.contact_name || order.client_contact || 'N/A'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Email: ${order.client?.contact_email || 'N/A'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Teléfono: ${order.client?.contact_phone || 'N/A'}`, 20, yPos);
            yPos += 10;

            // Ruta
            pdf.setFontSize(13);
            pdf.setTextColor(25, 50, 80);
            pdf.text('🗺️ RUTA', 15, yPos);
            yPos += 7;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(15, yPos - 2, pageWidth - 15, yPos - 2);
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Origen: ${order.origin}`, 20, yPos);
            yPos += 6;
            pdf.text(`Destino: ${order.destination}`, 20, yPos);
            yPos += 6;
            pdf.text(`Fecha servicio: ${new Date(order.service_date).toLocaleDateString('es-CL')}`, 20, yPos);
            yPos += 6;
            pdf.text(`Tipo: ${order.service_type || 'N/A'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Triángulo logístico: ${order.is_inside_triangle ? '✅ Sí' : '❌ No'}`, 20, yPos);
            yPos += 10;

            // Carga
            pdf.setFontSize(13);
            pdf.setTextColor(25, 50, 80);
            pdf.text('📦 DETALLE DE CARGA', 15, yPos);
            yPos += 7;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(15, yPos - 2, pageWidth - 15, yPos - 2);
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Tipo de bulto: ${order.package_type || 'N/A'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Cantidad: ${order.quantity || 0} uds.`, 20, yPos);
            yPos += 6;
            pdf.text(`Peso: ${order.weight_kg || 0} kg`, 20, yPos);
            yPos += 6;
            pdf.text(`Volumen: ${order.volume_cbm || 0} m³`, 20, yPos);
            yPos += 6;
            if (order.container_number) {
                pdf.text(`Contenedor: ${order.container_number}`, 20, yPos);
                yPos += 6;
            }
            if (order.description) {
                pdf.text(`Observaciones: ${order.description}`, 20, yPos);
                yPos += 6;
            }
            yPos += 10;

            // Financiero
            pdf.setFontSize(13);
            pdf.setTextColor(25, 50, 80);
            pdf.text('💰 RESUMEN FINANCIERO', 15, yPos);
            yPos += 7;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(15, yPos - 2, pageWidth - 15, yPos - 2);
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Valor Venta: ${clp(order.sold_value || 0)}`, 20, yPos);
            yPos += 6;
            pdf.text(`Costo Compra: ${clp(order.purchased_value || 0)}`, 20, yPos);
            yPos += 6;
            const margin = order.profit || 0;
            if (margin >= 0) {
                pdf.setTextColor(0, 128, 0);
                pdf.text(`Margen / Utilidad: ${clp(margin)}`, 20, yPos);
            } else {
                pdf.setTextColor(200, 0, 0);
                pdf.text(`Déficit: ${clp(Math.abs(margin))}`, 20, yPos);
            }
            yPos += 10;

            // Estado de documentos (sin imágenes)
            pdf.setFontSize(13);
            pdf.setTextColor(25, 50, 80);
            pdf.text('📋 ESTADO DE DOCUMENTOS', 15, yPos);
            yPos += 7;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(15, yPos - 2, pageWidth - 15, yPos - 2);
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`POD Vacío: ${documents?.pod_empty_url ? '✅ Cargado' : '⏳ Pendiente'}`, 20, yPos);
            yPos += 6;
            pdf.text(`POD Final: ${documents?.pod_final_url ? '✅ Cargado' : '⏳ Pendiente'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Guía de Despacho: ${documents?.guide_url ? '✅ Cargado' : '⏳ Pendiente'}`, 20, yPos);
            yPos += 6;
            pdf.text(`Factura: ${documents?.invoice_url ? '✅ Cargado' : '⏳ Pendiente'}`, 20, yPos);
            yPos += 10;

            // Footer página 1
            const footerY = pageHeight - 12;
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 15, footerY);
            pdf.text(`OT: ${order.order_number}`, pageWidth - 40, footerY);
            pdf.text('Página 1/3', pageWidth / 2 - 10, footerY);
            pdf.setDrawColor(220, 220, 220);
            pdf.line(15, footerY - 4, pageWidth - 15, footerY - 4);

            // ============================================
            // 3. PÁGINA 2 - POD VACÍO (si existe)
            // ============================================
            if (podEmptyBase64) {
                pdf.addPage();
                
                // Título de la página
                pdf.setFillColor(25, 50, 80);
                pdf.rect(0, 0, pageWidth, 20, 'F');
                pdf.setFontSize(14);
                pdf.setTextColor(255, 255, 255);
                pdf.text('📄 POD Vacío', 15, 13);
                
                pdf.setFontSize(9);
                pdf.setTextColor(200, 200, 200);
                pdf.text(`OT: ${order.order_number}`, pageWidth - 50, 13);
                
                try {
                    const margin = 15;
                    const maxWidth = pageWidth - (margin * 2);
                    const maxHeight = pageHeight - 60;
                    
                    pdf.addImage(podEmptyBase64, 'JPEG', margin, 28, maxWidth, maxHeight);
                } catch (e) {
                    console.warn('⚠️ No se pudo insertar imagen POD Vacío:', e);
                    pdf.setFontSize(12);
                    pdf.setTextColor(200, 0, 0);
                    pdf.text('❌ Error al cargar la imagen', pageWidth / 2 - 30, pageHeight / 2);
                }
                
                // Footer página 2
                const footerY2 = pageHeight - 12;
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 15, footerY2);
                pdf.text(`OT: ${order.order_number}`, pageWidth - 40, footerY2);
                pdf.text('Página 2/3', pageWidth / 2 - 10, footerY2);
                pdf.setDrawColor(220, 220, 220);
                pdf.line(15, footerY2 - 4, pageWidth - 15, footerY2 - 4);
            }

            // ============================================
            // 4. PÁGINA 3 - POD FINAL (si existe)
            // ============================================
            if (podFinalBase64) {
                pdf.addPage();
                
                // Título de la página
                pdf.setFillColor(25, 50, 80);
                pdf.rect(0, 0, pageWidth, 20, 'F');
                pdf.setFontSize(14);
                pdf.setTextColor(255, 255, 255);
                pdf.text('✅ POD Final', 15, 13);
                
                pdf.setFontSize(9);
                pdf.setTextColor(200, 200, 200);
                pdf.text(`OT: ${order.order_number}`, pageWidth - 50, 13);
                
                try {
                    const margin = 15;
                    const maxWidth = pageWidth - (margin * 2);
                    const maxHeight = pageHeight - 60;
                    
                    pdf.addImage(podFinalBase64, 'JPEG', margin, 28, maxWidth, maxHeight);
                } catch (e) {
                    console.warn('⚠️ No se pudo insertar imagen POD Final:', e);
                    pdf.setFontSize(12);
                    pdf.setTextColor(200, 0, 0);
                    pdf.text('❌ Error al cargar la imagen', pageWidth / 2 - 30, pageHeight / 2);
                }
                
                // Footer página 3
                const footerY3 = pageHeight - 12;
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 15, footerY3);
                pdf.text(`OT: ${order.order_number}`, pageWidth - 40, footerY3);
                pdf.text('Página 3/3', pageWidth / 2 - 10, footerY3);
                pdf.setDrawColor(220, 220, 220);
                pdf.line(15, footerY3 - 4, pageWidth - 15, footerY3 - 4);
            }

            // ============================================
            // 5. DESCARGAR
            // ============================================
            pdf.save(`OT-${order.order_number}_detalle_completo.pdf`);
            addToast('✅ PDF descargado correctamente', 'success');

        } catch (error) {
            console.error('Error generando PDF:', error);
            addToast('❌ Error al generar el PDF', 'error');
        }
    };

    // Subir imagen a Supabase Storage
    async function uploadImage(file: File, type: 'pod_empty' | 'pod_final' | 'guide' | 'invoice'): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${order!.order_number}_${type}_${Date.now()}.${fileExt}`;
            const filePath = `orders/${order!.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('pod-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('pod-documents')
                .getPublicUrl(filePath);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            addToast('❌ Error al subir la imagen a Storage', 'error');
            return null;
        }
    }

    // Guardar URL en la tabla documents
    async function saveDocumentUrl(type: string, url: string) {
        try {
            const updateData: any = {
                order_id: order!.id,
                updated_at: new Date().toISOString()
            };

            if (type === 'pod_empty') {
                updateData.pod_empty_url = url;
            } else if (type === 'pod_final') {
                updateData.pod_final_url = url;
            } else if (type === 'guide') {
                updateData.guide_url = url;
            } else if (type === 'invoice') {
                updateData.invoice_url = url;
            }

            let error;
            if (documents) {
                const { error: updateError } = await supabase
                    .from('documents')
                    .update(updateData)
                    .eq('id', documents.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('documents')
                    .insert([updateData]);
                error = insertError;
            }

            if (error) throw error;

            // ✅ NUEVO: Si se subió el POD Final, actualizar el estado de la orden a 'completed'
            if (type === 'pod_final') {
                const { error: statusError } = await supabase
                    .from('orders')
                    .update({ status: 'completed' })
                    .eq('id', order!.id);
                
                if (statusError) {
                    console.error('Error actualizando estado de la orden:', statusError);
                } else {
                    console.log('✅ Orden completada:', order!.order_number);
                }
            }

            await fetchDocuments();
            onRefresh();
            addToast(`✅ ${type.replace('_', ' ')} subido correctamente`, 'success');
        } catch (error) {
            console.error('Error saving document URL:', error);
            addToast('❌ Error al guardar el documento', 'error');
        }
    }

    // Handler para subir POD vacío
    const handleUploadPodEmpty = async (file: File) => {
        const url = await uploadImage(file, 'pod_empty');
        if (url) {
            await saveDocumentUrl('pod_empty', url);
        }
    };

    // Handler para subir POD final
    const handleUploadPodFinal = async (file: File) => {
        const url = await uploadImage(file, 'pod_final');
        if (url) {
            await saveDocumentUrl('pod_final', url);
        }
    };

    // Formatear fecha
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPriorityColor = (priority: string) => {
        if (priority === 'urgente') return 'bg-red-100 text-red-700';
        return 'bg-green-100 text-green-700';
    };

    const getStatusColor = (status: string) => {
        if (status === 'completed') return 'bg-green-100 text-green-700';
        if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
        if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`📄 Detalle de Orden - ${order.order_number}`} size="xl">
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                {/* Header */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">{order.order_number}</h3>
                        <p className="text-xs text-slate-500">
                            Creada: {formatDate(order.created_at)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${getPriorityColor(order.priority)}`}>
                            {order.priority === 'urgente' ? '🔴 Urgente' : '🟢 Normal'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status || 'Pendiente'}
                        </span>
                    </div>
                </div>

                {/* Datos del Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-lg p-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</h4>
                        <p className="text-sm font-semibold text-slate-800">{order.client?.name || 'Sin cliente'}</p>
                        <p className="text-xs text-slate-500">Código: {order.client?.code || 'N/A'}</p>
                        {order.client?.contact_name && (
                            <p className="text-xs text-slate-500 mt-1">Contacto: {order.client.contact_name}</p>
                        )}
                        {order.client?.contact_email && (
                            <p className="text-xs text-slate-500">{order.client.contact_email}</p>
                        )}
                        {order.client?.contact_phone && (
                            <p className="text-xs text-slate-500">{order.client.contact_phone}</p>
                        )}
                        {order.client_contact && !order.client && (
                            <p className="text-xs text-slate-500 mt-1">Contacto alternativo: {order.client_contact}</p>
                        )}
                    </div>

                    {/* Ruta */}
                    <div className="border border-slate-200 rounded-lg p-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ruta</h4>
                        <p className="text-sm font-semibold text-slate-800">{order.origin} → {order.destination}</p>
                        <p className="text-xs text-slate-500 mt-1">Tipo de servicio: {order.service_type || 'N/A'}</p>
                        <p className="text-xs text-slate-500">Fecha servicio: {new Date(order.service_date).toLocaleDateString('es-CL')}</p>
                        <p className="text-xs text-slate-500">
                            Triángulo logístico: {order.is_inside_triangle ? '✅ Sí' : '❌ No'}
                        </p>
                    </div>
                </div>

                {/* Detalle de Carga */}
                <div className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detalle de Carga</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <p className="text-[9px] text-slate-400">Tipo de bulto</p>
                            <p className="text-sm font-semibold">{order.package_type || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400">Cantidad</p>
                            <p className="text-sm font-semibold">{order.quantity || 0} uds.</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400">Peso</p>
                            <p className="text-sm font-semibold">{order.weight_kg || 0} kg</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400">Volumen</p>
                            <p className="text-sm font-semibold">{order.volume_cbm || 0} m³</p>
                        </div>
                    </div>
                    {order.container_number && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[9px] text-slate-400">Contenedor</p>
                            <p className="text-xs font-mono font-semibold">{order.container_number}</p>
                        </div>
                    )}
                    {order.description && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[9px] text-slate-400">Observaciones</p>
                            <p className="text-xs text-slate-600">{order.description}</p>
                        </div>
                    )}
                </div>

                {/* Financiero */}
                <div className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen Financiero</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <p className="text-[9px] text-slate-400">Valor Venta</p>
                            <p className="text-sm font-bold text-blue-600">{clp(order.sold_value || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400">Costo Compra</p>
                            <p className="text-sm font-bold text-orange-600">{clp(order.purchased_value || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400">Margen / Utilidad</p>
                            <p className={`text-sm font-bold ${(order.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {clp(order.profit || 0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Documentos de Entrega (POD) */}
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50/30">
                    <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        📋 Documentos de Entrega (POD)
                        {loadingDocs && <span className="text-[8px] text-slate-400">⏳ Cargando...</span>}
                    </h4>
                    
                    <div className="space-y-3">
                        {/* POD Vacío */}
                        <ImageUploader
                            label="📄 POD Vacío"
                            description="Documento antes del viaje (sin firmas ni sellos)"
                            currentImage={documents?.pod_empty_url || null}
                            onUpload={handleUploadPodEmpty}
                            disabled={false}
                        />

                        {/* POD Final */}
                        <ImageUploader
                            label="✅ POD Final"
                            description="Documento con firma y sello de conformidad"
                            currentImage={documents?.pod_final_url || null}
                            onUpload={handleUploadPodFinal}
                            disabled={false}
                        />

                        {/* Guía de Despacho (placeholder) */}
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-400">📦 Guía de Despacho</h5>
                                    <p className="text-xs text-slate-400">Próximamente...</p>
                                </div>
                                <span className="text-xs text-slate-400">⏳ En desarrollo</span>
                            </div>
                        </div>

                        {/* Factura (placeholder) */}
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h5 className="text-sm font-semibold text-slate-400">💰 Factura</h5>
                                    <p className="text-xs text-slate-400">Próximamente...</p>
                                </div>
                                <span className="text-xs text-slate-400">⏳ En desarrollo</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ✅ Botones */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                    <button
                        onClick={generatePDF}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        📥 Descargar PDF
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Cerrar
                    </button>
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
                    )
                `)
                .order('created_at', { ascending: false });

            if (filterStatus === 'pending') {
                query = query.eq('status', 'pending');
            } else if (filterStatus === 'completed') {
                query = query.eq('status', 'completed');
            } else if (filterStatus === 'in_progress') {
                query = query.eq('status', 'in_progress');
            }

            const { data, error } = await query;

            if (error) throw error;
            
            // ✅ OBTENER LOS CREADORES DE LAS ÓRDENES
            if (data && data.length > 0) {
                // Obtener los IDs de los creadores
                const creatorIds = data
                    .map(order => order.created_by)
                    .filter(id => id !== null);
                
                if (creatorIds.length > 0) {
                    const { data: userData, error: userError } = await supabase
                        .from('user_profiles')
                        .select('id, full_name, email')
                        .in('id', creatorIds);
                    
                    if (!userError && userData) {
                        // Asignar los datos del creador a cada orden
                        data.forEach(order => {
                            const creator = userData.find(u => u.id === order.created_by);
                            if (creator) {
                                order.creator = creator;
                            }
                        });
                    }
                }
            }
            
            setOrders(data || []);
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

    function getDocumentStatus() {
        return { pod: false, guide: false, invoiced: false };
    }

    function handleViewOrder(order: OrderWithClient) {
        setSelectedOrder(order);
        setIsModalOpen(true);
    }

    function handleUploadPOD(orderId: string) {
        addToast('📤 Funcionalidad de subida de POD en desarrollo...', 'info');
    }

    function handleViewDocs(order: OrderWithClient) {
        handleViewOrder(order);
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
                    <h1 className="text-xl font-bold text-slate-900">📄 POD / Documentos y Cierre</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Pruebas de entrega, guías de despacho y estado de liquidación</p>
                </div>
                <div className="text-sm text-slate-500">
                    Total: {orders.length} órdenes
                </div>
            </div>

            {/* Filtros */}
            <div className="mb-4 flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Todas
                </button>
                <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setFilterStatus('in_progress')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    En Progreso
                </button>
                <button
                    onClick={() => setFilterStatus('completed')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Completadas
                </button>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">OT</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cliente</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ruta</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Fecha</th>
                                {/* ✅ NUEVA COLUMNA */}
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Creado por</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">POD Firmado</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Guía Despacho</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Facturado</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                                        No hay órdenes registradas
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const status = getDocumentStatus();
                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                                                {order.order_number}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-slate-700">
                                                {order.client?.name || order.client_contact || 'Sin cliente'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {order.origin} → {order.destination}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {formatDate(order.created_at)}
                                            </td>
                                            {/* ✅ NUEVO: Mostrar el creador */}
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {order.creator?.full_name || order.creator?.email || 'Sistema'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Semaphore ok={status.pod} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Semaphore ok={status.guide} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Semaphore ok={status.invoiced} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleUploadPOD(order.id)}
                                                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                                                    >
                                                        Subir POD
                                                    </button>
                                                    <button
                                                        onClick={() => handleViewDocs(order)}
                                                        className="text-[10px] text-slate-400 hover:text-slate-600"
                                                    >
                                                        Ver docs
                                                    </button>
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

            {/* Modal de detalle */}
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
