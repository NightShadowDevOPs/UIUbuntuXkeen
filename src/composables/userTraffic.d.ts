export type UserTrafficBucket = {
    dl: number;
    ul: number;
};
export type UserTrafficStore = Record<string, Record<string, UserTrafficBucket>>;
export declare const getUserHourBucket: (user: string, ts?: number) => UserTrafficBucket;
export declare const clearUserTrafficHistory: () => void;
export declare const initUserTrafficRecorder: () => void;
export declare const getTrafficRange: (startTs: number, endTs: number) => Map<string, UserTrafficBucket>;
export type TrafficGroupBy = 'day' | 'week' | 'month';
export declare const getTrafficGrouped: (startTs: number, endTs: number, groupBy: TrafficGroupBy) => Map<string, Map<string, UserTrafficBucket>>;
export declare const formatTraffic: (bytes: number) => any;
export declare const userTrafficStoreSize: any;
