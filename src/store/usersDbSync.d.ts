import type { SourceIPLabel } from '@/types';
import { type UserLimit, type UserLimitsStore } from './userLimits';
/**
 * Shared users database stored on the router via router-agent.
 *
 * We keep Source IP labels + a couple of shared UI settings in a single payload.
 *
 * Goals:
 * - Sync enabled by default.
 * - Auto pull on start / when agent becomes available.
 * - Debounced auto push on local changes.
 * - Offline fallback to localStorage and catch-up when the agent is back.
 * - Conflict-safe revision (agent side).
 */
export type UsersDbSyncPhase = 'disabled' | 'idle' | 'pulling' | 'pushing' | 'offline' | 'conflict' | 'error';
export declare const usersDbSyncEnabled: any;
export declare const usersDbRemoteRev: any;
export declare const usersDbRemoteUpdatedAt: any;
export declare const usersDbLastPullAt: any;
export declare const usersDbLastPushAt: any;
export declare const usersDbLastError: any;
export declare const usersDbConflictAt: any;
export declare const usersDbConflictCount: any;
export declare const usersDbConflictRemoteRev: any;
export declare const usersDbConflictRemoteUpdatedAt: any;
export declare const usersDbConflictRemoteB64: any;
export declare const usersDbConflictLocalB64: any;
export declare const usersDbLastSyncedLabels: any;
export declare const usersDbLastSyncedProviderPanelUrls: any;
export declare const usersDbLastSyncedProviderIcons: any;
export declare const usersDbLastSyncedSslNearExpiryDaysDefault: any;
export declare const usersDbLastSyncedProviderSslWarnDaysMap: any;
export declare const usersDbLastSyncedTunnelInterfaceDescriptions: any;
export declare const usersDbLocalDirty: any;
export declare const usersDbPhase: any;
export declare const usersDbSyncActive: any;
type UsersDbPayload = {
    labels: SourceIPLabel[];
    providerPanelUrls: Record<string, string>;
    providerIcons: Record<string, string>;
    sslNearExpiryDaysDefault: number;
    providerSslWarnDaysMap: Record<string, number>;
    tunnelInterfaceDescriptions: Record<string, string>;
    userLimits: UserLimitsStore;
};
export type UsersDbDiff = {
    safeAutoMerge: boolean;
    labels: {
        localOnly: SourceIPLabel[];
        remoteOnly: SourceIPLabel[];
        changed: Array<{
            key: string;
            local: SourceIPLabel;
            remote: SourceIPLabel;
        }>;
    };
    urls: {
        localOnly: Array<{
            provider: string;
            url: string;
        }>;
        remoteOnly: Array<{
            provider: string;
            url: string;
        }>;
        changed: Array<{
            provider: string;
            local: string;
            remote: string;
        }>;
    };
    icons: {
        localOnly: Array<{
            provider: string;
            icon: string;
        }>;
        remoteOnly: Array<{
            provider: string;
            icon: string;
        }>;
        changed: Array<{
            provider: string;
            local: string;
            remote: string;
        }>;
    };
    tunnels: {
        localOnly: Array<{
            name: string;
            description: string;
        }>;
        remoteOnly: Array<{
            name: string;
            description: string;
        }>;
        changed: Array<{
            name: string;
            local: string;
            remote: string;
        }>;
    };
    ssl: {
        defaultDays: {
            local: number;
            remote: number;
            changed: boolean;
        };
        providerDays: {
            localOnly: Array<{
                provider: string;
                days: number;
            }>;
            remoteOnly: Array<{
                provider: string;
                days: number;
            }>;
            changed: Array<{
                provider: string;
                local: number;
                remote: number;
            }>;
        };
    };
    userLimits: {
        localOnly: Array<{
            user: string;
            local: UserLimit;
        }>;
        remoteOnly: Array<{
            user: string;
            remote: UserLimit;
        }>;
        changed: Array<{
            user: string;
            local: UserLimit;
            remote: UserLimit;
        }>;
    };
};
export type UsersDbSmartChoiceMode = 'local' | 'remote' | 'custom';
export type UsersDbSmartMergeChoices = {
    labels?: Record<string, {
        mode: UsersDbSmartChoiceMode;
        customLabel?: string;
    }>;
    urls?: Record<string, {
        mode: UsersDbSmartChoiceMode;
        customUrl?: string;
    }>;
    icons?: Record<string, {
        mode: UsersDbSmartChoiceMode;
        customIcon?: string;
    }>;
    tunnels?: Record<string, {
        mode: UsersDbSmartChoiceMode;
        customDescription?: string;
    }>;
    sslDefault?: {
        mode: UsersDbSmartChoiceMode;
        customDays?: number;
    };
    warnDays?: Record<string, {
        mode: UsersDbSmartChoiceMode;
        customDays?: number;
    }>;
};
export type UsersDbHistoryItem = {
    rev: number;
    updatedAt?: string;
    current?: boolean;
};
export declare const computeUsersDbDiff: (remote: UsersDbPayload, local: UsersDbPayload) => UsersDbDiff;
export declare const usersDbHasConflict: any;
export declare const usersDbConflictDiff: any;
export declare const usersDbHistoryItems: any;
export declare const usersDbSyncedIdSet: any;
export declare const usersDbPullNow: () => Promise<{
    ok: boolean;
    error: any;
} | {
    ok: boolean;
    error?: undefined;
}>;
export declare const usersDbPushNow: (baseRev?: number, overridePayload?: UsersDbPayload) => Promise<{
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
}>;
export declare const usersDbResolvePull: () => Promise<{
    ok: boolean;
    error: string;
} | {
    ok: boolean;
    error?: undefined;
}>;
export declare const usersDbResolvePush: () => Promise<{
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
}>;
export declare const usersDbResolveSmartMerge: (choices?: UsersDbSmartMergeChoices) => Promise<{
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
}>;
export declare const usersDbResolveMerge: () => Promise<{
    ok: boolean;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
}>;
export declare const usersDbFetchHistory: () => Promise<{
    ok: boolean;
    error: any;
} | {
    ok: boolean;
    error?: undefined;
}>;
export declare const usersDbRestoreRev: (rev: number) => Promise<{
    ok: boolean;
    error: any;
} | {
    ok: boolean;
    error?: undefined;
}>;
export declare const initUsersDbSync: () => void;
export {};
