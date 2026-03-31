import type { UserLimitPeriod } from './userLimits';
export type UserLimitProfile = {
    id: string;
    name: string;
    /** Whether limits are enabled after applying the profile. */
    enabled: boolean;
    trafficLimitBytes?: number;
    trafficLimitUnit?: 'MB' | 'GB';
    trafficPeriod?: UserLimitPeriod;
    bandwidthLimitBps?: number;
};
export type UserLimitProfilesStore = UserLimitProfile[];
export declare const DEFAULT_LIMIT_PROFILES: UserLimitProfilesStore;
export declare const userLimitProfiles: any;
