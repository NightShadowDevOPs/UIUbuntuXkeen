import type { UserLimitsStore } from './userLimits';
export type UserLimitSnapshot = {
    id: string;
    createdAt: number;
    label: string;
    data: UserLimitsStore;
};
export declare const userLimitSnapshots: any;
export declare const pushSnapshot: (snap: UserLimitSnapshot, maxKeep?: number) => void;
