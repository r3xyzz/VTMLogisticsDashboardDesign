// src/components/ui/Toast.tsx
import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

const toastStyles: Record<ToastType, { bg: string; icon: string; border: string; text: string }> = {
    success: {
        bg: 'bg-green-50',
        icon: 'text-green-500',
        border: 'border-green-200',
        text: 'text-green-800',
    },
    error: {
        bg: 'bg-red-50',
        icon: 'text-red-500',
        border: 'border-red-200',
        text: 'text-red-800',
    },
    warning: {
        bg: 'bg-yellow-50',
        icon: 'text-yellow-500',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
    },
    info: {
        bg: 'bg-blue-50',
        icon: 'text-blue-500',
        border: 'border-blue-200',
        text: 'text-blue-800',
    },
};

const toastIcons = {
    success: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    error: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
    info: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!visible) return null;

    const styles = toastStyles[type];

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${styles.bg} ${styles.border} shadow-lg max-w-md`}
            >
                <span className={`flex-shrink-0 ${styles.icon}`}>{toastIcons[type]}</span>
                <p className={`text-sm font-medium ${styles.text} flex-1`}>{message}</p>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

type ToastMessage = {
    id: string;
    message: string;
    type: ToastType;
};

let toasts: ToastMessage[] = [];
let listeners: ((toasts: ToastMessage[]) => void)[] = [];

export function addToast(message: string, type: ToastType = 'info') {
    const id = Date.now().toString();
    toasts = [...toasts, { id, message, type }];
    listeners.forEach(listener => listener(toasts));

    setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        listeners.forEach(listener => listener(toasts));
    }, 3000);
}

export function useToasts() {
    const [currentToasts, setCurrentToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const handler = (newToasts: ToastMessage[]) => setCurrentToasts(newToasts);
        listeners.push(handler);
        return () => {
            listeners = listeners.filter(l => l !== handler);
        };
    }, []);

    return currentToasts;
}