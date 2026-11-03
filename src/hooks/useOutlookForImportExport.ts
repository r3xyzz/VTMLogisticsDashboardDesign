// src/hooks/useOutlookForImportExport.ts
import { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../lib/msal';

export interface OutlookEmailForIE {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  body?: { content?: string; contentType?: string };
  hasAttachments?: boolean;
}

const TARGET_EMAIL = 'supervisores.patio@vtmlogistics.com'; 

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

      const select = 'id,subject,from,receivedDateTime,body,hasAttachments';
      
      const params = new URLSearchParams({
        $top: '100',
        $select: select,
        $orderby: 'receivedDateTime desc',
      });

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${TARGET_EMAIL}/messages?${params.toString()}`,
        { 
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error de Microsoft Graph (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      
      // ✅ Traemos TODOS los correos (sin filtro). El Parser hace el resto.
      setEmails(data.value || []);
      
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