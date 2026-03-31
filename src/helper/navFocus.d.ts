export type PendingPageFocus = {
    ts: number;
    route: string;
    kind: string;
    value: string;
};
export declare const clearPendingPageFocus: () => void;
export declare const cleanupExpiredPendingPageFocus: () => void;
export declare const setPendingPageFocus: (route: string, kind: string, value: string) => void;
export declare const getPendingPageFocusForRoute: (route: string) => PendingPageFocus | null;
export declare const flashNavHighlight: (el: HTMLElement | null, durationMs?: number) => void;
