// src/lib/msal.ts
import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

// ✅ CONFIGURACIÓN PARA OUTLOOK EMPRESARIAL
export const msalConfig = {
    auth: {
        // ⚠️ ESTOS VALORES CAMBIARÁN CUANDO TENGAS LOS DATOS DE LA EMPRESA
        // Por ahora usamos los de prueba, pero luego los reemplazas
        clientId: '475baba6-abc6-4c1e-92b3-9bb2787c008a',
        authority: 'https://login.microsoftonline.com/b2eda89b-77ce-4ddd-87c5-5f43988f3d57',
        redirectUri: window.location.origin + '/auth/callback',
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) return;
                console.log(message);
            },
            logLevel: LogLevel.Verbose,
            piiLoggingEnabled: false,
        },
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Mail.Read'],
    prompt: 'select_account',
    // ✅ Restringir al dominio vtmlogistics.com
    extraQueryParameters: {
        domain_hint: 'vtmlogistics.com'
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);