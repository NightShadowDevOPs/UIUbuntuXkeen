import { type Ref } from 'vue';
export declare const initNotification: (toast: Ref<HTMLElement>) => void;
export declare const showNotification: ({ content, params, key, type, timeout, }: {
    content: string;
    params?: Record<string, string>;
    key?: string;
    type?: "alert-warning" | "alert-success" | "alert-error" | "alert-info" | "";
    timeout?: number;
}) => void;
