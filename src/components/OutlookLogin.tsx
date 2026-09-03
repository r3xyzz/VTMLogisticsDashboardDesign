// src/components/OutlookLogin.tsx
import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../lib/msal';

interface OutlookLoginProps {
    onLoginSuccess: (accessToken: string) => void;
    onLoginError: (error: Error) => void;
}

export default function OutlookLogin({ onLoginSuccess, onLoginError }: OutlookLoginProps) {
    const { instance } = useMsal();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOutlookLogin = async () => {
        try {
            setLoading(true);
            setError(null);

            // ✅ Iniciar sesión con Microsoft
            const response = await instance.loginPopup(loginRequest);

            console.log('✅ Login con Outlook exitoso:', response);

            // Guardar el token de acceso
            const accessToken = response.accessToken;
            onLoginSuccess(accessToken);

        } catch (err: any) {
            console.error('❌ Error al iniciar sesión con Outlook:', err);
            const errorMessage = err.errorMessage || 'Error al iniciar sesión con Outlook';
            setError(errorMessage);
            onLoginError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={handleOutlookLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                        <span>Cargando...</span>
                    </div>
                ) : (
                    <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078D4">
                            <path d="M11.4 2.8c-1.2 0-2.2.8-2.5 1.9L5.2 18.9c-.1.5 0 1 .3 1.4.3.4.8.7 1.3.7h10.4c.5 0 1-.3 1.3-.7.3-.4.4-.9.3-1.4L15.1 4.7c-.3-1.1-1.3-1.9-2.5-1.9h-1.2z"/>
                            <path d="M12.1 7.4c-.9 0-1.6.6-1.8 1.5l-2.5 11.7c-.1.3 0 .6.2.8.2.2.4.3.7.3h5.7c.3 0 .5-.1.7-.3.2-.2.3-.5.2-.8l-2.5-11.7c-.2-.9-.9-1.5-1.8-1.5h-1.2z" opacity="0.3"/>
                            <path d="M12.1 9.5c-.5 0-.9.3-1 .8l-1.9 8.8c-.1.2 0 .4.1.5.1.1.3.2.5.2h3.7c.2 0 .4-.1.5-.2.1-.1.2-.3.1-.5l-1.9-8.8c-.1-.5-.5-.8-1-.8h-1.2z" opacity="0.5"/>
                        </svg>
                        <span>Conectar correo empresarial</span>
                    </>
                )}
            </button>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 w-full">
                    ❌ {error}
                </div>
            )}
        </div>
    );
}