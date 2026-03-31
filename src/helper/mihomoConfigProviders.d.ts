export type ProxyProviderFormModel = {
    originalName: string;
    name: string;
    type: string;
    url: string;
    path: string;
    interval: string;
    filter: string;
    excludeFilter: string;
    healthCheckEnable: string;
    healthCheckUrl: string;
    healthCheckInterval: string;
    healthCheckLazy: string;
    healthCheckExtraBody: string;
    overrideBody: string;
    extraBody: string;
};
export type ProviderReferenceInfo = {
    group: string;
    key: string;
};
export type ProviderDisableImpact = {
    group: string;
    keys: string[];
    fallbackInjected: boolean;
};
export type ParsedProxyProviderEntry = {
    name: string;
    type: string;
    url: string;
    path: string;
    interval: string;
    filter: string;
    excludeFilter: string;
    healthCheckEnable: string;
    healthCheckUrl: string;
    healthCheckInterval: string;
    healthCheckLazy: string;
    healthCheckExtraBody: string;
    overrideBody: string;
    extraBody: string;
    rawBlock: string;
    references: ProviderReferenceInfo[];
};
export declare const emptyProxyProviderForm: () => ProxyProviderFormModel;
export declare const proxyProviderFormFromEntry: (entry: ParsedProxyProviderEntry) => ProxyProviderFormModel;
export declare const collectProxyProviderReferences: (value: string) => Record<string, ProviderReferenceInfo[]>;
export declare const parseProxyProvidersFromConfig: (value: string) => ParsedProxyProviderEntry[];
export declare const upsertProxyProviderInConfig: (value: string, form: ProxyProviderFormModel) => string;
export declare const removeProxyProviderFromConfig: (value: string, providerName: string) => {
    yaml: string;
    impacts: ProviderDisableImpact[];
};
export declare const simulateProxyProviderDisableImpact: (value: string, providerName: string) => ProviderDisableImpact[];
