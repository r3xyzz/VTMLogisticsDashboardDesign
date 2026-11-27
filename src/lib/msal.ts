// src/lib/msal.ts
import { PublicClientApplication, LogLevel, EventType, type AccountInfo, type AuthenticationResult, type IPublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
    auth: {
        clientId: '475baba6-abc6-4c1e-92b3-9bb2787c008a',
        authority: 'https://login.microsoftonline.com/05094f27-0087-498b-b620-c24992918b7d',
        // Debe estar registrada en Azure (App registrations > Authentication > SPA)
        redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
        postLogoutRedirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
    },
    cache: {
        cacheLocation: 'localStorage', 
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) return;
                console.warn(`[MSAL] ${message}`);
            },
            logLevel: LogLevel.Warning,
            piiLoggingEnabled: false,
        },
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Mail.Read'],
    prompt: 'select_account',
};

export const msalInstance = new PublicClientApplication(msalConfig);

// El navegador puede tener varias cuentas de Microsoft guardadas (supervisores, operaciones...).
// La cuenta activa es la última con que se conectó: se usa siempre esa, no la primera de la lista.
msalInstance.addEventCallback((event) => {
    if ((event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) && event.payload) {
        const account = (event.payload as AuthenticationResult).account;
        if (account) msalInstance.setActiveAccount(account);
    }
});

export function currentAccount(instance: IPublicClientApplication, accounts: AccountInfo[]): AccountInfo | undefined {
    const active = instance.getActiveAccount();
    return (active && accounts.find((account) => account.homeAccountId === active.homeAccountId)) || accounts[0];
}