export type RuleProviderFormModel = {
    originalName: string;
    name: string;
    type: string;
    behavior: string;
    url: string;
    path: string;
    interval: string;
    format: string;
    extraBody: string;
};
export type RuleProviderReferenceInfo = {
    lineNo: number;
    text: string;
    type: string;
    target: string;
};
export type RuleProviderDisableImpact = {
    rulesRemoved: number;
    samples: RuleProviderReferenceInfo[];
};
export type ParsedRuleProviderEntry = {
    name: string;
    type: string;
    behavior: string;
    url: string;
    path: string;
    interval: string;
    format: string;
    extraBody: string;
    rawBlock: string;
    references: RuleProviderReferenceInfo[];
};
export declare const emptyRuleProviderForm: () => RuleProviderFormModel;
export declare const ruleProviderFormFromEntry: (entry: ParsedRuleProviderEntry) => RuleProviderFormModel;
export declare const collectRuleProviderReferences: (value: string) => Record<string, RuleProviderReferenceInfo[]>;
export declare const parseRuleProvidersFromConfig: (value: string) => ParsedRuleProviderEntry[];
export declare const upsertRuleProviderInConfig: (value: string, form: RuleProviderFormModel) => string;
export declare const removeRuleProviderFromConfig: (value: string, providerName: string) => {
    yaml: string;
    rulesRemoved: number;
    samples: RuleProviderReferenceInfo[];
};
export declare const simulateRuleProviderDisableImpact: (value: string, providerName: string) => RuleProviderDisableImpact;
