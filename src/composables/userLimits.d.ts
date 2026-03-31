import { type UserLimit } from '@/store/userLimits';
export type UserLimitResolved = Required<Pick<UserLimit, 'enabled' | 'disabled' | 'trafficPeriod'>> & Omit<UserLimit, 'enabled' | 'disabled' | 'trafficPeriod'>;
export declare const getUserLimit: (user: string) => UserLimitResolved;
export declare const setUserLimit: (user: string, patch: Partial<UserLimit>) => void;
export declare const clearUserLimit: (user: string) => void;
export declare const getUserUsageBytes: (user: string, limit?: UserLimitResolved) => number;
export declare const getUserCurrentSpeedBps: (user: string) => number;
export declare const getUserLimitState: (user: string) => {
    limit: UserLimitResolved;
    usageBytes: number;
    speedBps: number;
    trafficExceeded: boolean;
    bandwidthExceeded: boolean;
    blocked: boolean;
};
export declare const getIpsForUser: (userLabel: string) => string[];
export declare const initUserLimitsEnforcer: () => void;
export declare const reapplyAgentShapingForUser: (userLabel: string) => Promise<{
    ok: false;
    error: string;
} | {
    ok: true;
    error?: undefined;
}>;
/**
 * Force an immediate re-sync of user enforcement.
 * Useful when the user re-binds MAC after a DHCP change and wants blocks/shaping applied right away.
 */
export declare const applyUserEnforcementNow: () => Promise<void>;
export declare const limitedUsersCount: any;
