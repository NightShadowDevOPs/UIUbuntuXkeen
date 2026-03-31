export type RuleFormModel = {
    originalIndex: string;
    raw: string;
    type: string;
    payload: string;
    target: string;
    paramsText: string;
};
export type ParsedRuleEntry = {
    index: number;
    lineNo: number;
    raw: string;
    type: string;
    payload: string;
    target: string;
    provider: string;
    params: string[];
};
type ParsedRuleParts = {
    raw: string;
    type: string;
    payload: string;
    target: string;
    provider: string;
    params: string[];
};
export declare const parseRuleRaw: (value: string) => ParsedRuleParts;
export declare const buildRuleRaw: (form: Pick<RuleFormModel, "type" | "payload" | "target" | "paramsText">) => string;
export declare const emptyRuleForm: () => RuleFormModel;
export declare const syncRuleFormFromRaw: (form: RuleFormModel) => RuleFormModel;
export declare const syncRuleRawFromForm: (form: RuleFormModel) => RuleFormModel;
export declare const ruleFormFromEntry: (entry: ParsedRuleEntry) => RuleFormModel;
export declare const parseRulesFromConfig: (value: string) => ParsedRuleEntry[];
export declare const upsertRuleInConfig: (value: string, form: RuleFormModel) => string;
export declare const removeRuleFromConfig: (value: string, ruleIndex: number) => string;
export {};
