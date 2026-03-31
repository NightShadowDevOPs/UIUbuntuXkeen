import type { Backend } from '@/types';
export declare const version: any;
export declare const isCoreUpdateAvailable: any;
export declare const fetchVersionAPI: () => any;
export declare const fetchVersionSilentAPI: () => any;
export declare const isSingBox: any;
export declare const zashboardVersion: any;
export declare const fetchProxiesAPI: () => any;
export declare const selectProxyAPI: (proxyGroup: string, name: string) => any;
export declare const deleteFixedProxyAPI: (proxyGroup: string) => any;
export declare const fetchProxyLatencyAPI: (proxyName: string, url: string, timeout: number) => any;
export declare const fetchProxyGroupLatencyAPI: (proxyName: string, url: string, timeout: number) => any;
export declare const fetchSmartGroupWeightsAPI: (proxyName: string) => any;
export declare const flushSmartGroupWeightsAPI: () => any;
export declare const fetchProxyProviderAPI: () => any;
export declare const updateProxyProviderAPI: (name: string) => any;
export declare const proxyProviderHealthCheckAPI: (name: string) => any;
export declare const fetchRulesAPI: () => any;
export declare const fetchRuleProvidersAPI: () => any;
export declare const updateRuleProviderAPI: (name: string) => any;
export declare const updateRuleProviderSilentAPI: (name: string) => any;
export declare const disconnectByIdAPI: (id: string) => any;
export declare const disconnectByIdSilentAPI: (id: string) => any;
export declare const disconnectAllAPI: () => any;
export declare const getConfigsAPI: () => any;
export declare const getConfigsSilentAPI: () => any;
export declare const getConfigsRawAPI: (cfg?: {
    path?: string;
}) => any;
export declare const patchConfigsAPI: (configs: Record<string, string | boolean | object | number>) => any;
export declare const patchConfigsSilentAPI: (configs: Record<string, string | boolean | object | number>) => any;
export declare const flushFakeIPAPI: () => any;
export declare const flushDNSCacheAPI: () => any;
export declare const reloadConfigsAPI: (cfg?: {
    path?: string;
    payload?: string;
}) => any;
export declare const upgradeUIAPI: () => any;
export declare const updateGeoDataAPI: () => any;
export declare const upgradeCoreAPI: (type: "release" | "alpha" | "auto") => any;
export declare const restartCoreAPI: () => any;
export declare const queryDNSAPI: (params: {
    name: string;
    type: string;
}) => any;
export declare const fetchConnectionsAPI: <T>() => {
    data: any;
    close: () => void;
};
export declare const fetchLogsAPI: <T>(params?: Record<string, string>) => {
    data: any;
    close: () => void;
};
export declare const fetchMemoryAPI: <T>() => {
    data: any;
    close: () => void;
};
export declare const fetchTrafficAPI: <T>() => {
    data: any;
    close: () => void;
};
export declare const isBackendAvailable: (backend: Backend, timeout?: number) => Promise<boolean>;
export declare const fetchIsUIUpdateAvailable: () => Promise<boolean>;
export declare const fetchBackendUpdateAvailableAPI: () => Promise<boolean>;
