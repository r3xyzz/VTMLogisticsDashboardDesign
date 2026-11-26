// src/hooks/useOutlookForImportExport.ts
import { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { currentAccount, loginRequest } from '../lib/msal';
import { groupByConversation, parseTableFromEmail } from '../lib/outlookParser';

export interface OutlookEmailForIE {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  body?: { content?: string; contentType?: string };
  // Solo lo nuevo del mensaje (sin el historial citado de la respuesta)
  uniqueBody?: { content?: string; contentType?: string };
  conversationId?: string;
  hasAttachments?: boolean;
  // Correos que llegaron como "Elemento de Outlook" adjunto dentro de otro correo
  parentId?: string; // correo que los trae (para abrirlo en Outlook)
  typeHint?: 'impo' | 'expo'; // IMPO/EXPO escrito en el correo que los reenvía
}

const MAX_PAGES = 5;
// Lista inicial sin uniqueBody (era descargar cada correo dos veces); los hilos de carga sí lo traen
const LIST_SELECT = 'id,subject,from,receivedDateTime,body,conversationId,hasAttachments';
const THREAD_SELECT = 'id,subject,from,receivedDateTime,body,uniqueBody,conversationId,hasAttachments';
const GRAPH = 'https://graph.microsoft.com/v1.0';
// Correos adjuntos: se revisan los más recientes que traen adjuntos y no tienen tabla propia
const MAX_ATTACHMENT_PARENTS = 60;

// ---------- Límite de Outlook ----------
// Outlook (Exchange) acepta ~4 consultas simultáneas por buzón; con más responde 429 "Too Many Requests"
// y la carga se alarga o queda incompleta. Todas las consultas pasan por esta cola y los 429/503 se reintentan
// esperando lo que pide Outlook (Retry-After).
const MAX_CONCURRENT = 4;
const MAX_RETRIES = 4;
let running = 0;
const waiting: (() => void)[] = [];
const acquire = () => new Promise<void>((resolve) => {
  if (running < MAX_CONCURRENT) { running++; resolve(); } else waiting.push(() => { running++; resolve(); });
});
const release = () => { running--; waiting.shift()?.(); };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function graphFetch(url: string, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let response: Response;
    try { response = await fetch(url, { headers }); } finally { release(); }
    if ((response.status !== 429 && response.status !== 503) || attempt >= MAX_RETRIES) return response;
    const retryAfter = Number(response.headers.get('Retry-After'));
    await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt) * 1000);
  }
}

// Correos con adjuntos ya revisados en este buzón (sus operaciones quedan respaldadas en la BD):
// no se vuelven a abrir en cada carga. Los "Elemento de Outlook" adjuntos no cambian.
const checkedKey = (mailbox: string) => `vtm-ie-attachments-checked:${mailbox.toLowerCase()}`;
const readChecked = (mailbox: string): string[] => { try { return JSON.parse(localStorage.getItem(checkedKey(mailbox)) || '[]'); } catch { return []; } };
const saveChecked = (mailbox: string, ids: string[]) => { try { localStorage.setItem(checkedKey(mailbox), JSON.stringify(ids.slice(-600))); } catch { /* sin storage */ } };

// "IMPOS" / "EXPOS" en el correo que reenvía los adjuntos indica el tipo de todos ellos
function typeHintOf(email: OutlookEmailForIE): 'impo' | 'expo' | undefined {
  const text = `${email.subject || ''} ${(email.body?.content || '').replace(/<[^>]+>/g, ' ')}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const impo = /\b(impos?|importacion(es)?)\b/.test(text);
  const expo = /\b(expos?|exportacion(es)?)\b/.test(text);
  return impo === expo ? undefined : impo ? 'impo' : 'expo';
}

type GraphAttachment = { id: string; name?: string; '@odata.type'?: string };
type GraphItem = { subject?: string; from?: OutlookEmailForIE['from']; receivedDateTime?: string; sentDateTime?: string; body?: OutlookEmailForIE['body'] };

// Abre los "Elemento de Outlook" adjuntos de un correo y devuelve los que traen datos de carga
// null = no se pudo leer (no se marca como revisado)
async function attachedEmailsOf(parent: OutlookEmailForIE, headers: Record<string, string>): Promise<OutlookEmailForIE[] | null> {
  try {
    const base = `${GRAPH}/me/messages/${encodeURIComponent(parent.id)}/attachments`;
    // $select evita descargar el contenido de imágenes/PDF adjuntos
    const list = await graphFetch(`${base}?$select=id,name,size`, headers);
    if (!list.ok) return null;
    const attachments = ((await list.json()).value || []) as GraphAttachment[];
    const items = attachments.filter((attachment) => attachment['@odata.type']?.toLowerCase().includes('itemattachment'));
    const hint = typeHintOf(parent);
    const found: (OutlookEmailForIE | null)[] = [];
    for (const attachment of items) found.push(await (async () => {
      const response = await graphFetch(`${base}/${encodeURIComponent(attachment.id)}?$expand=microsoft.graph.itemattachment/item`, headers);
      if (!response.ok) return null;
      const item = ((await response.json()).item || {}) as GraphItem;
      if (!item.body?.content || !parseTableFromEmail(item.body.content)) return null;
      const email: OutlookEmailForIE = {
        id: `${parent.id}::${attachment.id}`,
        parentId: parent.id,
        subject: item.subject || attachment.name,
        from: item.from || parent.from,
        receivedDateTime: item.receivedDateTime || item.sentDateTime || parent.receivedDateTime,
        body: item.body,
        // Cada adjunto es su propia operación, con id estable (sirve para guardar la ficha)
        conversationId: `adjunto:${parent.id}:${attachment.id}`,
        hasAttachments: false,
        typeHint: hint,
      };
      return email;
    })());
    return found.filter((email): email is OutlookEmailForIE => email !== null);
  } catch (err) {
    console.warn('⚠️ [ImportExport] No se pudieron leer los correos adjuntos:', err);
    return null;
  }
}

async function fetchAttachedEmails(emails: OutlookEmailForIE[], headers: Record<string, string>, mailbox: string): Promise<OutlookEmailForIE[]> {
  const checked = new Set(readChecked(mailbox));
  const parents = emails
    .filter((email) => email.hasAttachments && !email.parentId && !checked.has(email.id) && !parseTableFromEmail(email.body?.content || ''))
    .sort((a, b) => b.receivedDateTime.localeCompare(a.receivedDateTime))
    .slice(0, MAX_ATTACHMENT_PARENTS);
  // La cola de graphFetch limita la concurrencia; aquí se lanzan todos y Outlook recibe de a 4
  const results = await Promise.all(parents.map(async (parent) => ({ parent, found: await attachedEmailsOf(parent, headers) })));
  // Solo se recuerdan los que NO traían carga (fotos, PDF...): los que sí, se releen (por si se limpió la BD)
  saveChecked(mailbox, [...checked, ...results.filter((result) => result.found && result.found.length === 0).map((result) => result.parent.id)]);
  return results.flatMap((result) => result.found ?? []);
}

export function useOutlookForImportExport() {
  const { instance, accounts } = useMsal();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emails, setEmails] = useState<OutlookEmailForIE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cuenta activa (la última conectada), no la primera guardada en el navegador
  const account = currentAccount(instance, accounts);
  const userEmail = account?.username || null;
  const userName = account?.name || userEmail?.split('@')[0] || 'Usuario';

  useEffect(() => {
    const getToken = async () => {
      if (!account) {
        setAccessToken(null);
        setLoading(false);
        return;
      }
      try {
        const response = await instance.acquireTokenSilent({ ...loginRequest, account });
        setAccessToken(response.accessToken);
      } catch (err) {
        console.warn('⚠️ [ImportExport] Token expirado o no disponible:', err);
        setAccessToken(null);
        setError(err instanceof InteractionRequiredAuthError
          ? `La sesión de Outlook de ${account.username} expiró o falta autorizar permisos. Vuelve a conectar la cuenta.`
          : `No se pudo conectar con Outlook (${account.username}): ${err instanceof Error ? err.message : 'error desconocido'}`);
        setLoading(false);
      }
    };
    getToken();
  }, [instance, account?.homeAccountId]);

  const fetchEmails = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      setError(null);

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const params = new URLSearchParams({
        $top: '100',
        $select: LIST_SELECT,
        $orderby: 'receivedDateTime desc',
      });

      // /me = buzón de quien inició sesión. Se siguen las páginas (@odata.nextLink) hasta MAX_PAGES.
      // shortcut: tope de MAX_PAGES*100 correos más recientes; si hace falta más historial, filtrar por fecha en Graph.
      const all: OutlookEmailForIE[] = [];
      let url: string | undefined = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;
      for (let i = 0; url && i < MAX_PAGES; i++) {
        const response: Response = await graphFetch(url, headers);
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Error de Microsoft Graph (${response.status}): ${errorData}`);
        }
        const page: { value?: OutlookEmailForIE[]; '@odata.nextLink'?: string } = await response.json();
        all.push(...(page.value || []));
        url = page['@odata.nextLink'];
      }

      // Hilos con carga: se trae la conversación COMPLETA (respuestas antiguas, enviados, otras carpetas)
      // para que cada mensaje del hilo actualice la operación.
      const cargoConversations = groupByConversation(all)
        .filter((thread) => thread[0].conversationId && thread.some((m) => parseTableFromEmail(m.body?.content || '')))
        .map((thread) => thread[0].conversationId as string);
      const threads = await Promise.all(cargoConversations.map(async (conversationId) => {
        // Sin $orderby: Graph rechaza ordenar por fecha al filtrar por conversationId (se ordena en el parser)
        const query = new URLSearchParams({ $filter: `conversationId eq '${conversationId}'`, $select: THREAD_SELECT, $top: '50' });
        const response = await graphFetch(`https://graph.microsoft.com/v1.0/me/messages?${query.toString()}`, headers);
        if (!response.ok) {
          console.warn('⚠️ [ImportExport] No se pudo leer la conversación completa:', await response.text());
          return [];
        }
        return ((await response.json()).value || []) as OutlookEmailForIE[];
      }));

      // ✅ Todos los correos + los hilos completos, sin duplicados. El Parser hace el resto.
      const byId = new Map<string, OutlookEmailForIE>();
      for (const email of [...all, ...threads.flat()]) byId.set(email.id, email);
      const merged = Array.from(byId.values());
      // + correos que vienen adjuntos ("Elemento de Outlook") dentro de otros correos
      const attached = await fetchAttachedEmails(merged, headers, userEmail || 'sin-cuenta');
      setEmails([...merged, ...attached]);
      
    } catch (err) {
      console.error('❌ [ImportExport] Error al obtener correos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al conectar con Outlook');
    } finally {
      setLoading(false);
    }
  }, [accessToken, userEmail]);

  useEffect(() => {
    if (accessToken) {
      fetchEmails();
    }
  }, [accessToken, fetchEmails]);

  const connectOutlook = async () => {
    try {
      setLoading(true);
      setError(null);
      await instance.loginRedirect({ ...loginRequest, prompt: 'select_account' });
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Outlook');
      setLoading(false);
    }
  };

  return { 
    accessToken, 
    emails, 
    loading, 
    error, 
    refetch: fetchEmails,
    connectOutlook,
    isConnected: !!accessToken,
    userEmail,
    userName
  };
}