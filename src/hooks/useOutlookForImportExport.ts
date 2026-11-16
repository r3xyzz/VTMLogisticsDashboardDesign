// src/hooks/useOutlookForImportExport.ts
import { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../lib/msal';
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
}

const MAX_PAGES = 5;
const SELECT = 'id,subject,from,receivedDateTime,body,uniqueBody,conversationId,hasAttachments';

export function useOutlookForImportExport() {
  const { instance, accounts } = useMsal();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emails, setEmails] = useState<OutlookEmailForIE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = accounts[0]?.username || null;
  const userName = accounts[0]?.name || userEmail?.split('@')[0] || 'Usuario';

  useEffect(() => {
    const getToken = async () => {
      if (accounts.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
      } catch (err) {
        console.warn('⚠️ [ImportExport] Token expirado o no disponible:', err);
        setLoading(false);
      }
    };
    getToken();
  }, [instance, accounts]);

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
        $select: SELECT,
        $orderby: 'receivedDateTime desc',
      });

      // /me = buzón de quien inició sesión. Se siguen las páginas (@odata.nextLink) hasta MAX_PAGES.
      // shortcut: tope de MAX_PAGES*100 correos más recientes; si hace falta más historial, filtrar por fecha en Graph.
      const all: OutlookEmailForIE[] = [];
      let url: string | undefined = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;
      for (let i = 0; url && i < MAX_PAGES; i++) {
        const response: Response = await fetch(url, { headers });
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
        const query = new URLSearchParams({ $filter: `conversationId eq '${conversationId}'`, $select: SELECT, $top: '50' });
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${query.toString()}`, { headers });
        if (!response.ok) {
          console.warn('⚠️ [ImportExport] No se pudo leer la conversación completa:', await response.text());
          return [];
        }
        return ((await response.json()).value || []) as OutlookEmailForIE[];
      }));

      // ✅ Todos los correos + los hilos completos, sin duplicados. El Parser hace el resto.
      const byId = new Map<string, OutlookEmailForIE>();
      for (const email of [...all, ...threads.flat()]) byId.set(email.id, email);
      setEmails(Array.from(byId.values()));
      
    } catch (err) {
      console.error('❌ [ImportExport] Error al obtener correos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al conectar con Outlook');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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