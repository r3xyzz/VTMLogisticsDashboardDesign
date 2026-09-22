// src/lib/msal.ts
import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

export const msalConfig = {
    auth: {
        clientId: '475baba6-abc6-4c1e-92b3-9bb2787c008a',
        authority: 'https://login.microsoftonline.com/05094f27-0087-498b-b620-c24992918b7d',
        redirectUri: 'http://localhost:8443/',
        postLogoutRedirectUri: 'http://localhost:8443/',
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) return;
                console.log(`[MSAL] ${message}`);
            },
            logLevel: LogLevel.Warning, // ✅ Baja el nivel de log para menos ruido
            piiLoggingEnabled: false,
        },
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Mail.Read'],
    prompt: 'select_account',
};

export const msalInstance = new PublicClientApplication(msalConfig);