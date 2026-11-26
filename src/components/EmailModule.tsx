// src/components/EmailModule.tsx
import { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { currentAccount, loginRequest, msalInstance } from '../lib/msal';
import { supabase } from '../lib/supabase';
import OutlookLogin from './OutlookLogin';
import EmailList, { type MailFolder } from './EmailList';

interface ClientWithEmail {
    id: string;
    name: string;
    emails: string[];
}

// contact_email puede traer varios correos separados por coma, punto y coma o espacios.
const parseEmails = (value: string | null): string[] =>
    (value || '')
        .split(/[,;\s]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes('@'));

export default function EmailModule() {
    const { instance, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [filter, setFilter] = useState('todos');
    // Recibidos o Enviados: cada correo por separado, sin juntar la conversación
    const [folder, setFolder] = useState<MailFolder>('inbox');
    const [isInitializing, setIsInitializing] = useState(true);
    const [clients, setClients] = useState<ClientWithEmail[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');

    useEffect(() => {
        const loadClients = async () => {
            const { data, error } = await supabase
                .from('clients')
                .select('id, name, contact_email')
                .not('contact_email', 'is', null)
                .order('name');
            if (error) {
                console.error('❌ Error cargando clientes para filtro de correo:', error);
                return;
            }
            setClients(
                (data || [])
                    .map(c => ({ id: c.id, name: c.name, emails: parseEmails(c.contact_email) }))
                    .filter(c => c.emails.length > 0)
            );
        };
        loadClients();
    }, []);

    const clientEmails = useMemo(
        () => clients.find(c => c.id === selectedClientId)?.emails ?? [],
        [clients, selectedClientId]
    );

    useEffect(() => {
        const initializeMsal = async () => {
            try {
                await msalInstance.initialize();
                
                const response = await msalInstance.handleRedirectPromise();
                
                if (response) {
                    console.log('✅ Login exitoso desde redirect:', response.account?.username);
                    msalInstance.setActiveAccount(response.account);
                    setAccessToken(response.accessToken);
                } else if (accounts.length > 0) {
                    try {
                        const silentResponse = await msalInstance.acquireTokenSilent({
                            ...loginRequest,
                            account: currentAccount(msalInstance, accounts)!,
                        });
                        setAccessToken(silentResponse.accessToken);
                    } catch (error) {
                        console.warn('⚠️ No se pudo obtener token silencioso:', error);
                    }
                }
            } catch (error) {
                console.error('❌ Error inicializando MSAL:', error);
            } finally {
                setIsInitializing(false);
            }
        };
        
        initializeMsal();
    }, [accounts]);

    const handleLoginSuccess = (token: string) => {
        setAccessToken(token);
    };

    const handleLoginError = (error: Error) => {
        console.error('Error de login:', error);
    };

    const handleConvertToOT = (email: any) => {
        console.log('Convertir a OT:', email);
        // Aquí puedes agregar la lógica para convertir el correo en una OT
    };

    if (isInitializing) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!accessToken) {
        return (
            <div className="p-8 max-w-md mx-auto mt-16 bg-white rounded-2xl shadow-lg border border-slate-200">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Correo Empresarial</h2>
                    <p className="text-sm text-slate-500 mt-1">Conecta tu cuenta de Outlook</p>
                </div>
                <OutlookLogin 
                    onLoginSuccess={handleLoginSuccess}
                    onLoginError={handleLoginError}
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Correo Empresarial</h1>
                        <p className="text-sm text-slate-500">
                            Conectado como: {currentAccount(instance, accounts)?.username || 'Usuario'}
                        </p>
                    </div>
                    <button 
                        onClick={() => instance.logoutRedirect()}
                        className="text-sm text-slate-500 hover:text-red-600 transition-colors"
                    >
                        Cerrar sesión
                    </button>
                </div>

                <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                    {([['inbox', 'Recibidos'], ['sentitems', 'Enviados']] as const).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setFolder(id)}
                            className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
                                folder === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                    <button 
                        onClick={() => setFilter('todos')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filter === 'todos' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setFilter('carga')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filter === 'carga' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Carga
                    </button>
                    <button 
                        onClick={() => setFilter('cotizacion')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filter === 'cotizacion' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Cotización
                    </button>

                    <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 max-w-full sm:ml-auto"
                        title="Filtrar por correos registrados en Clientes"
                    >
                        <option value="">Todos los clientes</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {clientEmails.length > 0 && (
                    <p className="text-xs text-slate-500 mb-3 break-all">
                        {folder === 'sentitems' ? 'Mostrando correos enviados a' : 'Mostrando correos de'}: {clientEmails.join(', ')}
                    </p>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <EmailList
                        accessToken={accessToken}
                        filter={filter}
                        folder={folder}
                        clientEmails={clientEmails}
                        onConvertToOT={handleConvertToOT}
                    />
                </div>
            </div>
        </div>
    );
}