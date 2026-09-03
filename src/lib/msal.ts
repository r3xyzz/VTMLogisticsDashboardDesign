// src/lib/msal.ts
import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

// ✅ CONFIGURACIÓN DE MSAL
export const msalConfig = {
    auth: {
        clientId: '475baba6-abc6-4c1e-92b3-9bb2787c008a', // Tu Client ID
        authority: 'https://login.microsoftonline.com/b2eda89b-77ce-4ddd-87c5-5f43988f3d57', // Tu Tenant ID
        redirectUri: 'http://localhost:5173/auth/callback',
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) {
                    return;
                }
                console.log(message);
            },
            logLevel: LogLevel.Verbose,
            piiLoggingEnabled: false,
        },
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Mail.Read'],
};

export const msalInstance = new PublicClientApplication(msalConfig);