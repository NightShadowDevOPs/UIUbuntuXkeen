import dayjs from 'dayjs';
export type ProviderHealthStatus = 'expired' | 'nearExpiry' | 'offline' | 'degraded' | 'healthy';
export type ProviderSslSource = 'subscription' | 'panel-probe' | 'panel' | 'provider' | 'none';
export type ProviderSslStatus = 'refreshing' | 'unavailable' | 'expired' | 'warning' | 'healthy';
export type ProviderHealth = {
    status: ProviderHealthStatus;
    /** lower = worse */
    severity: number;
    /** optional ssl info */
    sslDays: number | null;
    sslDate: string | null;
    /** i18n key for label */
    labelKey: string;
    /** daisyui badge class */
    badgeCls: string;
    /** optional tooltip */
    tip?: string;
};
export type ProviderHealthOpts = {
    /** SSL "near expiry" threshold in days. Default: 14 (UI may override). */
    nearExpiryDays?: number;
    /** When backend is rebuilding SSL cache, do not mark missing SSL as degraded yet. */
    sslRefreshing?: boolean;
    /** Optional override for panel URL TLS expiry (for batch panel probe results). */
    panelSslNotAfter?: any;
};
export type ProviderSslDiagnostics = {
    source: ProviderSslSource;
    status: ProviderSslStatus;
    days: number | null;
    dateTime: string | null;
    notAfter: dayjs.Dayjs | null;
    checkedAtMs: number;
    sourceUrl: string;
    issuer: string;
    subject: string;
    san: string[];
    error: string;
    hasHttpsSource: boolean;
    isRefreshing: boolean;
};
export declare const getAnyFromObj: (obj: any, candidates: string[]) => any;
export declare const parseDateMaybe: (v: any) => dayjs.Dayjs | null;
export declare const getProviderSslNotAfter: (provider: any, agentProvider?: any, panelSslNotAfter?: any) => dayjs.Dayjs | null;
export declare const getProviderSslDiagnostics: (provider: any, agentProvider?: any, opts?: {
    panelProbeNotAfter?: any;
    panelProbeError?: string;
    panelProbeCheckedAtMs?: number;
    panelProbeUrl?: string;
    panelUrlOverride?: string;
    nearExpiryDays?: number;
    sslRefreshing?: boolean;
}) => ProviderSslDiagnostics;
export declare const getProviderHealth: (provider: any, agentProvider?: any, opts?: ProviderHealthOpts) => ProviderHealth;
