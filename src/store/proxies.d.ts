export declare const proxiesFilter: any;
export declare const proxiesTabShow: any;
export declare const proxyGroupList: any;
export declare const proxyMap: any;
export declare const IPv6Map: any;
export declare const hiddenGroupMap: any;
export declare const proxyProviederList: any;
export declare const getTestUrl: (groupName?: string) => any;
export declare const getLatencyByName: (proxyName: string, groupName?: string) => any;
export declare const getHistoryByName: (proxyName: string, groupName?: string) => any;
export declare const getIPv6ByName: (proxyName: string) => any;
export declare const fetchProxies: () => Promise<void>;
/**
 * Fetch ONLY proxy providers (no full proxies/groups refresh).
 * Used after provider health-check/update to avoid re-rendering the whole Providers page.
 */
export declare const fetchProxyProvidersOnly: () => Promise<void>;
/**
 * Fetch providers list but patch ONLY a single provider (and its nodes) into the store.
 * This minimizes reactive churn so updating one provider does not "reload" the whole Providers page.
 */
export declare const fetchProxyProviderByNameOnly: (providerName: string) => Promise<void>;
export declare const handlerProxySelect: (proxyGroupName: string, proxyName: string) => Promise<void>;
export declare const proxyLatencyTest: (proxyName: string, url?: any, timeout?: any) => Promise<void>;
export declare const proxyGroupLatencyTest: (proxyGroupName: string) => Promise<void>;
export declare const allProxiesLatencyTest: () => Promise<void>;
export declare const getNowProxyNodeName: (name: string) => any;
export declare const hasSmartGroup: any;
