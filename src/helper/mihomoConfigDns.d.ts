export type DnsEditorFormModel = {
    defaultNameserverText: string;
    nameserverText: string;
    fallbackText: string;
    proxyServerNameserverText: string;
    fakeIpFilterText: string;
    dnsHijackText: string;
    nameserverPolicyText: string;
    fallbackFilterGeoip: string;
    fallbackFilterGeoipCode: string;
    fallbackFilterDomainText: string;
    fallbackFilterGeositeText: string;
    fallbackFilterIpcidrText: string;
};
export declare const emptyDnsEditorForm: () => DnsEditorFormModel;
export declare const dnsEditorFormFromConfig: (value: string) => DnsEditorFormModel;
export declare const upsertDnsEditorInConfig: (value: string, form: DnsEditorFormModel) => string;
