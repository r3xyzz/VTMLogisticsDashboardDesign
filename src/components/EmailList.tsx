// src/components/EmailList.tsx
// Correos uno por uno (no agrupados por conversación), por carpeta: Recibidos o Enviados.
// Solo lectura: se muestran los correos, no se edita ni borra nada en Outlook.
import { useCallback, useEffect, useState } from 'react';
import { graphFetch } from '../hooks/useOutlookForImportExport';

type Address = { emailAddress?: { name?: string; address?: string } };

interface Email {
  id: string;
  subject?: string;
  sender?: Address;
  from?: Address;
  toRecipients?: Address[];
  receivedDateTime: string;
  sentDateTime?: string;
  bodyPreview?: string;
  importance?: string;
  isRead?: boolean;
  conversationId?: string;
  parentFolderId?: string;
}

export type MailFolder = 'inbox' | 'sentitems';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const PAGE_SIZE = 50;
const SELECT = 'id,subject,from,sender,toRecipients,receivedDateTime,sentDateTime,bodyPreview,importance,isRead,conversationId,parentFolderId';

const categoryKeywords: Record<string, string[]> = {
  'carga': ['carga', 'envio', 'transporte', 'entrega', 'pack', 'contenedor', 'pallet', 'cargamento'],
  'cotizacion': ['cotizacion', 'presupuesto', 'oferta', 'precio', 'valor', 'solicitud', 'cotizar']
};

type FolderInfo = { id: string; totalItemCount: number };

const quote = (value: string) => value.replace(/'/g, "''");
const dateOf = (email: Email, folder: MailFolder) => (folder === 'sentitems' ? email.sentDateTime : email.receivedDateTime) || email.receivedDateTime;

export default function EmailList({
  accessToken,
  filter,
  folder = 'inbox',
  clientEmails = [],
  onConvertToOT
}: {
  accessToken: string;
  filter: string;
  folder?: MailFolder;
  clientEmails?: string[];
  onConvertToOT: (email: Email) => void;
}) {
  const clientEmailsKey = clientEmails.join(',');
  const [emails, setEmails] = useState<Email[]>([]);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Carpetas del buzón (id y cantidad de correos): para el contador y para saber de dónde es cada mensaje de una conversación
  const [folders, setFolders] = useState<Record<string, FolderInfo>>({});
  // Conversación desplegada dentro de un correo (se trae al abrirla)
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Email[] | null>(null);

  const headers = { Authorization: `Bearer ${accessToken}` };

  const loadFolders = useCallback(async () => {
    const entries = await Promise.all((['inbox', 'sentitems', 'deleteditems'] as const).map(async (name) => {
      const response = await graphFetch(`${GRAPH}/me/mailFolders/${name}?$select=id,totalItemCount`, { Authorization: `Bearer ${accessToken}` });
      return response.ok ? [name, await response.json()] as const : null;
    }));
    setFolders(Object.fromEntries(entries.filter(Boolean) as (readonly [string, FolderInfo])[]));
  }, [accessToken]);

  const buildUrl = () => {
    const base = `${GRAPH}/me/mailFolders/${folder}/messages`;
    if (clientEmails.length > 0) {
      if (folder === 'inbox') {
        // Filtro por cliente: remitente igual a alguno de los correos del cliente.
        // Graph no permite $orderby junto a este $filter, así que se ordena localmente.
        const fromExpr = clientEmails.map(e => `from/emailAddress/address eq '${quote(e)}'`).join(' or ');
        return `${base}?$top=100&$select=${SELECT}&$filter=${encodeURIComponent(fromExpr)}`;
      }
      // Enviados: destinatario = correo del cliente (búsqueda de Outlook)
      const search = clientEmails.map(e => `to:${e}`).join(' OR ');
      return `${base}?$top=100&$select=${SELECT}&$search=${encodeURIComponent(`"${search}"`)}`;
    }
    const orderBy = folder === 'sentitems' ? 'sentDateTime desc' : 'receivedDateTime desc';
    const words = categoryKeywords[filter];
    const filterExpr = words ? `&$filter=${encodeURIComponent(words.map(w => `contains(subject,'${w}')`).join(' or '))}` : '';
    return `${base}?$top=${PAGE_SIZE}&$select=${SELECT}${filterExpr}&$orderby=${encodeURIComponent(orderBy)}`;
  };

  const fetchPage = async (url: string) => {
    const response = await graphFetch(url, headers);
    if (!response.ok) throw new Error(`Error al obtener correos: ${response.status}`);
    const data = await response.json();
    let result: Email[] = data.value || [];
    if (clientEmails.length > 0) {
      // Cliente + categoría: se aplica la categoría localmente sobre el asunto.
      const words = categoryKeywords[filter];
      if (words) result = result.filter(m => words.some(w => (m.subject || '').toLowerCase().includes(w)));
    }
    return { result, next: (data['@odata.nextLink'] as string | undefined) || null };
  };

  const sortByDate = (list: Email[]) => [...list].sort((a, b) => dateOf(b, folder).localeCompare(dateOf(a, folder)));

  // Función para obtener correos desde Microsoft Graph
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      setOpenId(null);
      const { result, next } = await fetchPage(buildUrl());
      setEmails(sortByDate(result));
      setNextLink(next);
    } catch (err) {
      console.error('❌ Error al obtener correos:', err);
      setError(err instanceof Error ? err.message : 'Error al obtener correos');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextLink) return;
    setLoadingMore(true);
    try {
      const { result, next } = await fetchPage(nextLink);
      setEmails(current => {
        const known = new Set(current.map(e => e.id));
        return sortByDate([...current, ...result.filter(e => !known.has(e.id))]);
      });
      setNextLink(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener correos');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchEmails();
      loadFolders();
    }
  }, [accessToken, filter, folder, clientEmailsKey]);

  const toggleConversation = async (email: Email) => {
    if (openId === email.id) { setOpenId(null); return; }
    setOpenId(email.id);
    setThread(null);
    if (!email.conversationId) { setThread([email]); return; }
    try {
      // Sin $orderby: Graph no permite ordenar al filtrar por conversationId (se ordena aquí)
      const query = new URLSearchParams({
        $filter: `conversationId eq '${quote(email.conversationId)}'`,
        $select: SELECT,
        $top: '100',
      });
      const response = await graphFetch(`${GRAPH}/me/messages?${query.toString()}`, headers);
      if (!response.ok) throw new Error(String(response.status));
      const list: Email[] = (await response.json()).value || [];
      // Del más antiguo (1) al más nuevo; los que ya están en Elementos eliminados no se muestran
      const deletedId = folders.deleteditems?.id;
      setThread(list
        .filter(m => !deletedId || m.parentFolderId !== deletedId)
        .sort((a, b) => (a.sentDateTime || a.receivedDateTime).localeCompare(b.sentDateTime || b.receivedDateTime)));
    } catch (err) {
      console.warn('⚠️ No se pudo cargar la conversación:', err);
      setThread([email]);
    }
  };

  // ✅ Formatear fecha
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ✅ Resaltar texto en el asunto según el filtro
  const highlightText = (text: string) => {
    if (filter === 'todos' || !text) return text;

    const words = categoryKeywords[filter] || [];
    let highlighted = text;
    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200/70 px-0.5 rounded">$1</mark>');
    });
    return highlighted;
  };

  // Remitente (Recibidos) o destinatarios (Enviados)
  const getSenderName = (email: Email): string => {
    const sender = email.sender || email.from;
    return sender?.emailAddress?.name || sender?.emailAddress?.address || 'Remitente';
  };
  const getSenderEmail = (email: Email): string => (email.sender || email.from)?.emailAddress?.address || '';
  const getRecipients = (email: Email): string =>
    (email.toRecipients || []).map(r => r.emailAddress?.name || r.emailAddress?.address).filter(Boolean).join(', ') || 'Sin destinatario';

  const folderLabel = (message: Email) => {
    if (message.parentFolderId && message.parentFolderId === folders.inbox?.id) return { text: 'Recibido', tone: 'bg-blue-100 text-blue-700' };
    if (message.parentFolderId && message.parentFolderId === folders.sentitems?.id) return { text: 'Enviado', tone: 'bg-emerald-100 text-emerald-700' };
    return { text: 'Otra carpeta', tone: 'bg-slate-100 text-slate-600' };
  };

  // ✅ Obtener iniciales del remitente
  const getInitials = (name: string) => {
    if (!name || name === 'Remitente') return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="mt-2 text-sm text-slate-500">Cargando correos...</p>
        </div>
      </div>
    );
  }

  const isSent = folder === 'sentitems';
  const total = folders[folder]?.totalItemCount;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {emails.length} mostrados{typeof total === 'number' ? ` · ${total.toLocaleString('es-CL')} en ${isSent ? 'Enviados' : 'Recibidos'}` : ''}
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {error}</div>
      )}
      {emails.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay correos que coincidan con el filtro</p>
        </div>
      ) : (
        emails.map((email) => {
          const senderName = isSent ? getRecipients(email) : getSenderName(email);
          const senderEmail = isSent ? '' : getSenderEmail(email);
          const initials = getInitials(isSent ? (email.toRecipients?.[0]?.emailAddress?.name || email.toRecipients?.[0]?.emailAddress?.address || '') : senderName);
          const isUrgent = email.importance === 'high' || email.subject?.toLowerCase().includes('urgente');
          const isUnread = !isSent && !email.isRead;

          return (
            <div
              key={email.id}
              className={`flex gap-3 sm:gap-4 px-3 sm:px-4 py-3 transition-colors rounded-lg border ${
                isUnread ? 'bg-blue-50/30 border-blue-100 hover:bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: isUnread ? '#1e4278' : '#64748b' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {isSent && <span className="font-normal text-slate-400">Para: </span>}
                      {senderName}
                    </span>
                    {senderEmail && (
                      <span className="text-xs text-slate-400 truncate hidden sm:inline">
                        {senderEmail}
                      </span>
                    )}
                    {isUrgent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex-shrink-0">
                        URGENTE
                      </span>
                    )}
                    {isUnread && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                    {formatDate(dateOf(email, folder))}
                  </span>
                </div>
                <div
                  className="text-xs font-semibold text-slate-700 mt-0.5"
                  dangerouslySetInnerHTML={{
                    __html: highlightText(email.subject || 'Sin asunto')
                  }}
                />
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {email.bodyPreview || 'Sin contenido'}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => onConvertToOT(email)}
                    className="text-[11px] font-semibold px-3 py-1 rounded border text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    Convertir en OT →
                  </button>
                  <button className="text-[11px] font-semibold px-3 py-1 rounded border text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors">
                    Generar cotización
                  </button>
                  <button
                    onClick={() => toggleConversation(email)}
                    className="text-[11px] font-semibold px-3 py-1 rounded border text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    {openId === email.id ? 'Ocultar conversación' : 'Ver conversación'}
                  </button>
                  <button
                    onClick={() => window.open(`https://outlook.office.com/mail/id/${encodeURIComponent(email.id)}`, '_blank')}
                    className="text-[11px] text-slate-400 px-2 py-1 hover:text-slate-600 transition-colors"
                  >
                    Ver en Outlook
                  </button>
                </div>
                {openId === email.id && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                    {thread && thread.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {thread.length} correo{thread.length === 1 ? '' : 's'} en esta conversación (1 = el más antiguo)
                        </span>
                      </div>
                    )}
                    <ol className="space-y-2">
                      {!thread && <li className="text-[11px] text-slate-400">Cargando conversación…</li>}
                      {thread?.map((message, index) => {
                        const label = folderLabel(message);
                        return (
                          <li key={message.id} className={`flex gap-2 rounded-lg border p-2.5 ${message.id === email.id ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white'}`}>
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <strong className="truncate text-slate-700">{getSenderName(message)}</strong>
                                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${label.tone}`}>{label.text}</span>
                                </span>
                                <span className="shrink-0 text-slate-400">{new Date(message.sentDateTime || message.receivedDateTime).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{message.bodyPreview || '(sin texto)'}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {nextLink && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  );
}
