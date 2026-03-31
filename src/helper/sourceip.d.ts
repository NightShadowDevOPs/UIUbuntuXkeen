export type SourceIpRuleKind = 'exact' | 'cidr' | 'regex' | 'suffix';
export declare const isSourceIpScopeVisible: (scope?: string[]) => boolean;
export declare const getSourceIpRuleKind: (key: string) => SourceIpRuleKind;
export declare const matchesSourceIpRule: (key: string, ip: string) => any;
export type SourceIpResolvedRule = {
    key: string;
    label: string;
    resolvedLabel: string;
    kind: SourceIpRuleKind;
};
export declare const getPrimarySourceIpRule: (ip: string) => SourceIpResolvedRule | null;
export declare const getExactIPLabelFromMap: (ip: string) => string;
export declare const getIPLabelFromMap: (ip: string) => string;
export declare const getIPKeyFromLabel: (label: string) => any;
