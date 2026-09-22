// src/components/EmailModule.tsx
import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest, msalInstance } from '../lib/msal';
import OutlookLogin from './OutlookLogin';
import EmailList from './EmailList';

export default function EmailModule() {
    const { instance, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [filter, setFilter] = useState('todos');
    const [isInitializing, setIsInitializing] = useState(true);

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
                            account: accounts[0],
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
        <div className="p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Correo Empresarial</h1>
                        <p className="text-sm text-slate-500">
                            Conectado como: {accounts[0]?.username || 'Usuario'}
                        </p>
                    </div>
                    <button 
                        onClick={() => instance.logoutRedirect()}
                        className="text-sm text-slate-500 hover:text-red-600 transition-colors"
                    >
                        Cerrar sesión
                    </button>
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
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <EmailList 
                        accessToken={accessToken}
                        filter={filter}
                        onConvertToOT={handleConvertToOT}
                    />
                </div>
            </div>
        </div>
    );
}