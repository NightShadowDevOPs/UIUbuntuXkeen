export interface IPInfo {
    ip: string;
    country: string;
    region: string;
    city: string;
    asn: string;
    organization: string;
}
export declare const getIPFrom2ipMeGeoAPI: (ip?: string) => Promise<{
    ip: string;
    country: string;
    country_rus: string;
    region: string;
    region_rus: string;
    city: string;
    city_rus: string;
    latitude: string;
    longitude: string;
}>;
export declare const getIPFrom2ipMeProviderAPI: (ip?: string) => Promise<{
    ip: string;
    name_ripe: string;
    name_rus: string;
    site: string;
    as: string;
    route: string;
    mask: string;
}>;
export declare const getIPFrom2ipIoAPI: (token: string) => Promise<any>;
export declare const getIPFromIpipnetAPI: () => Promise<{
    data: {
        ip: string;
        location: string[];
    };
}>;
export declare const getIPInfoFromIPSB: (ip?: string) => Promise<IPInfo>;
export declare const getIPInfoFromIPWHOIS: (ip?: string) => Promise<IPInfo>;
export declare const getIPInfoFromIPAPI: (ip?: string) => Promise<IPInfo>;
export declare const getIPInfoFromWHATISMYIP: (ip?: string) => Promise<IPInfo>;
export declare const getIPInfo: (ip?: string) => Promise<IPInfo>;
