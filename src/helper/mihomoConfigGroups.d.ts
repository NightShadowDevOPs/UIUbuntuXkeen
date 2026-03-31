export type ProxyGroupFormModel = {
    originalName: string;
    name: string;
    type: string;
    url: string;
    interval: string;
    strategy: string;
    lazy: string;
    disableUdp: string;
    includeAll: string;
    tolerance: string;
    timeout: string;
    proxiesText: string;
    useText: string;
    providersText: string;
    extraBody: string;
};
export type ProxyGroupReferenceInfo = {
    kind: 'group' | 'rule';
    text: string;
    key?: string;
    lineNo?: number;
};
export type ProxyGroupDisableImpact = {
    group: string;
    keys: string[];
    fallbackInjected: boolean;
};
export type ParsedProxyGroupEntry = {
    name: string;
    type: string;
    url: string;
    interval: string;
    strategy: string;
    lazy: string;
    disableUdp: string;
    includeAll: string;
    tolerance: string;
    timeout: string;
    proxies: string[];
    use: string[];
    providers: string[];
    extraBody: string;
    rawBlock: string;
    references: ProxyGroupReferenceInfo[];
};
export declare const emptyProxyGroupForm: () => ProxyGroupFormModel;
export declare const proxyGroupFormFromEntry: (entry: ParsedProxyGroupEntry) => ProxyGroupFormModel;
export declare const collectProxyGroupReferences: (value: string) => Record<string, ProxyGroupReferenceInfo[]>;
export declare const parseProxyGroupsFromConfig: (value: string) => ParsedProxyGroupEntry[];
export declare const upsertProxyGroupInConfig: (value: string, form: ProxyGroupFormModel) => string;
export declare const removeProxyGroupFromConfig: (value: string, groupName: string) => {
    yaml: string;
    impacts: ProxyGroupDisableImpact[];
    rulesTouched: number;
    ruleSamples: ProxyGroupReferenceInfo[];
};
export declare const simulateProxyGroupDisableImpact: (value: string, groupName: string) => {
    impacts: ProxyGroupDisableImpact[];
    rulesTouched: number;
    ruleSamples: ProxyGroupReferenceInfo[];
};
