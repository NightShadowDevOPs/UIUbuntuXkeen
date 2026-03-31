type AgentStatus = {
    ok: boolean;
    version?: string;
    serverVersion?: string;
    wan?: string;
    lan?: string;
    tc?: boolean;
    iptables?: boolean;
    hashlimit?: boolean;
    hostQos?: boolean;
    cpuPct?: number;
    load1?: string;
    load5?: string;
    load15?: string;
    uptimeSec?: number;
    memTotal?: number;
    memUsed?: number;
    memFree?: number;
    memUsedPct?: number;
    storagePath?: string;
    storageTotal?: number;
    storageUsed?: number;
    storageFree?: number;
    tempC?: string;
    hostname?: string;
    model?: string;
    firmware?: string;
    kernel?: string;
    arch?: string;
    xkeenVersion?: string;
    mihomoBinVersion?: string;
    error?: string;
};
export type AgentFirmwareCheck = {
    ok: boolean;
    currentVersion?: string;
    latestVersion?: string;
    mainLatestVersion?: string;
    previewLatestVersion?: string;
    devLatestVersion?: string;
    updateAvailable?: boolean;
    checkedAt?: string;
    sourceUrl?: string;
    channel?: string;
    cached?: boolean;
    stale?: boolean;
    error?: string;
};
export type AgentTrafficLiveIface = {
    name: string;
    kind?: string;
    rxBytes?: number;
    txBytes?: number;
};
export type AgentTrafficLive = {
    ok: boolean;
    iface?: string;
    rxBytes?: number;
    txBytes?: number;
    ts?: number;
    extraIfaces?: AgentTrafficLiveIface[];
    error?: string;
};
export declare const agentStatusAPI: () => Promise<AgentStatus>;
export declare const agentFirmwareCheckAPI: (force?: boolean) => Promise<AgentFirmwareCheck>;
export declare const agentTrafficLiveAPI: () => Promise<AgentTrafficLive>;
export declare const agentSetShapeAPI: (args: {
    ip: string;
    upMbps: number;
    downMbps: number;
}) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentRemoveShapeAPI: (ip: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export type AgentNeighbor = {
    ip: string;
    mac: string;
    state?: string;
};
export declare const agentNeighborsAPI: () => Promise<{
    ok: boolean;
    items?: AgentNeighbor[];
    error?: string;
}>;
export type AgentLanHost = {
    ip: string;
    mac?: string;
    hostname?: string;
    source?: string;
};
export type AgentHostTrafficLiveItem = {
    ip: string;
    mac?: string;
    hostname?: string;
    source?: string;
    bypassDownBps?: number;
    bypassUpBps?: number;
    vpnDownBps?: number;
    vpnUpBps?: number;
    totalDownBps?: number;
    totalUpBps?: number;
};
export type AgentHostTrafficLive = {
    ok: boolean;
    ts?: number;
    dtMs?: number;
    trackedHosts?: number;
    items?: AgentHostTrafficLiveItem[];
    error?: string;
};
export type AgentHostRemoteTargetItem = {
    target: string;
    scope?: 'mihomo' | 'vpn' | 'bypass';
    kind?: string;
    via?: string;
    proto?: string;
    connections?: number;
    downBps?: number;
    upBps?: number;
};
export type AgentHostRemoteTargets = {
    ok: boolean;
    ip?: string;
    ts?: number;
    dtMs?: number;
    trackedTargets?: number;
    items?: AgentHostRemoteTargetItem[];
    error?: string;
};
export declare const agentLanHostsAPI: () => Promise<{
    ok: boolean;
    items?: AgentLanHost[];
    error?: string;
}>;
export declare const agentHostTrafficLiveAPI: () => Promise<AgentHostTrafficLive>;
export declare const agentHostRemoteTargetsAPI: (ip: string) => Promise<AgentHostRemoteTargets>;
export type AgentQosProfile = 'critical' | 'high' | 'elevated' | 'normal' | 'low' | 'background';
export type AgentQosStatusItem = {
    ip: string;
    profile: AgentQosProfile;
    priority?: number;
    upMinMbit?: number;
    downMinMbit?: number;
};
export type AgentQosStatus = {
    ok: boolean;
    supported?: boolean;
    wanRateMbit?: number;
    lanRateMbit?: number;
    qosMode?: string;
    qosDownlinkEnabled?: boolean;
    defaults?: Partial<Record<AgentQosProfile, {
        pct?: number;
        priority?: number;
    }>>;
    items?: AgentQosStatusItem[];
    error?: string;
};
export declare const agentIpToMacAPI: (ip: string) => Promise<{
    ok: boolean;
    mac?: string;
    error?: string;
}>;
export declare const agentQosStatusAPI: () => Promise<AgentQosStatus>;
export declare const agentSetHostQosAPI: (args: {
    ip: string;
    profile: AgentQosProfile;
}) => Promise<{
    ok: boolean;
    error?: string;
    priority?: number;
    upMinMbit?: number;
    downMinMbit?: number;
}>;
export declare const agentRemoveHostQosAPI: (ip: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentBlockMacAPI: (args: {
    mac: string;
    /**
     * 'all' = drop all traffic from the MAC.
     * number[] = legacy mode (block only selected ports).
     */
    ports: number[] | "all";
}) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentBlockIpAPI: (ip: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentUnblockIpAPI: (ip: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentLogsAPI: (args: {
    type: "mihomo" | "agent" | "config";
    lines?: number;
}) => Promise<{
    ok: boolean;
    kind?: string;
    path?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentLogsFollowAPI: (args: {
    type: "mihomo" | "agent";
    lines?: number;
    offset?: number;
}) => Promise<{
    ok: boolean;
    kind?: string;
    path?: string;
    contentB64?: string;
    offset?: number;
    mode?: "full" | "delta";
    truncated?: boolean;
    error?: string;
}>;
export declare const agentGeoInfoAPI: () => Promise<{
    ok: boolean;
    items?: Array<{
        kind?: string;
        path?: string;
        exists?: boolean;
        mtimeSec?: number | string;
        sizeBytes?: number | string;
    }>;
    error?: string;
}>;
export declare const agentGeoUpdateAPI: () => Promise<{
    ok: boolean;
    items?: Array<{
        kind?: string;
        path?: string;
        changed?: boolean;
        mtimeSec?: number | string;
        sizeBytes?: number | string;
        method?: string;
        source?: string;
        error?: string;
    }>;
    note?: string;
    error?: string;
}>;
export declare const agentRulesInfoAPI: () => Promise<{
    ok: boolean;
    dir?: string;
    count?: number;
    newestMtimeSec?: number | string;
    oldestMtimeSec?: number | string;
    items?: Array<{
        name?: string;
        path?: string;
        mtimeSec?: number | string;
        sizeBytes?: number | string;
    }>;
    error?: string;
}>;
export declare const agentUnblockMacAPI: (mac: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export declare const agentMihomoConfigAPI: () => Promise<{
    ok: boolean;
    contentB64?: string;
    error?: string;
}>;
export type MihomoConfigManagedState = {
    ok: boolean;
    active?: {
        path?: string;
        rev?: number;
        updatedAt?: string;
        exists?: boolean;
        sizeBytes?: number;
    };
    draft?: {
        path?: string;
        rev?: number;
        updatedAt?: string;
        exists?: boolean;
        sizeBytes?: number;
    };
    baseline?: {
        path?: string;
        updatedAt?: string;
        exists?: boolean;
        sizeBytes?: number;
    };
    lastApplyStatus?: string;
    lastApplyAt?: string;
    lastApplySource?: string;
    lastError?: string;
    lastSuccessful?: {
        rev?: number;
        updatedAt?: string;
        source?: string;
        exists?: boolean;
        current?: boolean;
    };
    validator?: {
        available?: boolean;
        bin?: string;
    };
    restart?: {
        available?: boolean;
        mode?: string;
    };
    error?: string;
};
export declare const agentMihomoConfigStateAPI: () => Promise<MihomoConfigManagedState>;
export declare const agentMihomoConfigManagedGetAPI: (kind: "active" | "draft" | "baseline") => Promise<{
    ok: boolean;
    kind?: string;
    path?: string;
    rev?: number;
    updatedAt?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedPutDraftAPI: (content: string) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedCopyAPI: (from: "active" | "baseline") => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedValidateAPI: (kind: "active" | "draft" | "baseline") => Promise<{
    ok: boolean;
    phase?: string;
    kind?: string;
    source?: string;
    cmd?: string;
    exitCode?: number;
    output?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedApplyAPI: () => Promise<{
    ok: boolean;
    phase?: string;
    rev?: number;
    updatedAt?: string;
    source?: string;
    appliedFrom?: string;
    restored?: string;
    recovery?: string;
    restartMethod?: string;
    restartOutput?: string;
    firstRestartMethod?: string;
    firstRestartOutput?: string;
    rollbackRestartMethod?: string;
    rollbackRestartOutput?: string;
    baselineRestartMethod?: string;
    baselineRestartOutput?: string;
    validateCmd?: string;
    error?: string;
    output?: string;
}>;
export declare const agentMihomoConfigManagedSetBaselineFromActiveAPI: () => Promise<{
    ok: boolean;
    updatedAt?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedRestoreBaselineAPI: () => Promise<{
    ok: boolean;
    phase?: string;
    rev?: number;
    updatedAt?: string;
    source?: string;
    restored?: string;
    recovery?: string;
    restartMethod?: string;
    restartOutput?: string;
    firstRestartMethod?: string;
    firstRestartOutput?: string;
    rollbackRestartMethod?: string;
    rollbackRestartOutput?: string;
    baselineRestartMethod?: string;
    baselineRestartOutput?: string;
    validateCmd?: string;
    error?: string;
    output?: string;
}>;
export type MihomoConfigHistoryItem = {
    rev: number;
    updatedAt?: string;
    current?: boolean;
    source?: string;
};
export declare const agentMihomoConfigManagedHistoryAPI: () => Promise<{
    ok: boolean;
    items?: MihomoConfigHistoryItem[];
    error?: string;
}>;
export declare const agentMihomoConfigManagedGetRevAPI: (rev: number) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    source?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentMihomoConfigManagedRestoreRevAPI: (rev: number) => Promise<{
    ok: boolean;
    phase?: string;
    rev?: number;
    updatedAt?: string;
    source?: string;
    restored?: string;
    recovery?: string;
    restartMethod?: string;
    restartOutput?: string;
    firstRestartMethod?: string;
    firstRestartOutput?: string;
    rollbackRestartMethod?: string;
    rollbackRestartOutput?: string;
    baselineRestartMethod?: string;
    baselineRestartOutput?: string;
    validateCmd?: string;
    error?: string;
    output?: string;
}>;
export declare const agentMihomoProvidersAPI: (force?: boolean) => Promise<{
    ok: boolean;
    checkedAtSec?: number;
    sslCacheReady?: boolean;
    sslCacheFresh?: boolean;
    sslRefreshing?: boolean;
    sslRefreshPending?: boolean;
    sslCacheAgeSec?: number;
    sslCacheNextRefreshAtSec?: number;
    providers?: Array<{
        name: string;
        url?: string;
        host?: string;
        port?: string;
        sslNotAfter?: string;
        sslCheckedAtSec?: number;
        sslIssuer?: string;
        sslSubject?: string;
        sslSan?: string[] | string;
        sslError?: string;
        panelUrl?: string;
        panelSslNotAfter?: string;
        panelSslCheckedAtSec?: number;
        panelSslIssuer?: string;
        panelSslSubject?: string;
        panelSslSan?: string[] | string;
        panelSslError?: string;
    }>;
    error?: string;
}>;
export declare const agentProviderSslCacheRefreshAPI: () => Promise<{
    ok: boolean;
    checkedAtSec?: number;
    ready?: boolean;
    fresh?: boolean;
    refreshing?: boolean;
    cacheAgeSec?: number;
    nextRefreshAtSec?: number;
    error?: string;
}>;
export declare const agentSslProbeBatchAPI: (lines: string, timeoutMs?: number) => Promise<any>;
export declare const agentUsersDbGetAPI: () => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentUsersDbPutAPI: (args: {
    rev: number;
    content: string;
}) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    error?: string;
    contentB64?: string;
}>;
export declare const agentProviderTrafficGetAPI: () => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentProviderTrafficPutAPI: (args: {
    rev: number;
    content: string;
}) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    error?: string;
    contentB64?: string;
}>;
export type UsersDbHistoryItem = {
    rev: number;
    updatedAt?: string;
    current?: boolean;
};
export declare const agentUsersDbHistoryAPI: () => Promise<{
    ok: boolean;
    items?: UsersDbHistoryItem[];
    error?: string;
}>;
export declare const agentUsersDbGetRevAPI: (rev: number) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    contentB64?: string;
    error?: string;
}>;
export declare const agentUsersDbRestoreAPI: (rev: number) => Promise<{
    ok: boolean;
    rev?: number;
    updatedAt?: string;
    restoredFromRev?: number;
    error?: string;
}>;
export type AgentBackupStatus = {
    ok: boolean;
    running?: boolean;
    startedAt?: string;
    finishedAt?: string;
    success?: boolean;
    file?: string;
    uploaded?: boolean;
    uploadOkCount?: number;
    uploadFailCount?: number;
    uploadResults?: Array<{
        remote?: string;
        ok?: boolean;
        error?: string;
    }>;
    requestedRemotes?: string;
    error?: string;
};
export declare const agentBackupStatusAPI: () => Promise<AgentBackupStatus>;
export type AgentBackupCloudStatus = {
    ok: boolean;
    rcloneInstalled?: boolean;
    configPath?: string;
    remote?: string;
    remoteExists?: boolean;
    remotes?: Array<{
        name?: string;
        exists?: boolean;
    }>;
    path?: string;
    cloudReady?: boolean;
    keepDays?: string;
    localKeepDays?: string;
    uiZipEnabled?: boolean;
    error?: string;
};
export declare const agentBackupCloudStatusAPI: () => Promise<AgentBackupCloudStatus>;
export declare const agentBackupStartAPI: (remotes?: string | string[]) => Promise<{
    ok: boolean;
    running?: boolean;
    requestedRemotes?: string;
    error?: string;
}>;
export declare const agentBackupLogAPI: (lines?: number) => Promise<{
    ok: boolean;
    path?: string;
    contentB64?: string;
    error?: string;
}>;
export type AgentBackupListItem = {
    name: string;
    size?: number;
    mtime?: number;
};
export type AgentBackupCloudListItem = {
    Name?: string;
    Path?: string;
    Size?: number;
    ModTime?: string;
    Remote?: string;
    RemotePath?: string;
};
export declare const agentBackupCloudListAPI: () => Promise<{
    ok: boolean;
    remote?: string;
    path?: string;
    dir?: string;
    items?: AgentBackupCloudListItem[];
    error?: string;
}>;
export declare const agentBackupListAPI: () => Promise<{
    ok: boolean;
    dir?: string;
    items?: AgentBackupListItem[];
    error?: string;
}>;
export declare const agentBackupDeleteAPI: (file: string) => Promise<{
    ok: boolean;
    deleted?: boolean;
    name?: string;
    error?: string;
}>;
export declare const agentBackupCloudDeleteAPI: (file: string, remote?: string) => Promise<{
    ok: boolean;
    deleted?: boolean;
    name?: string;
    remote?: string;
    error?: string;
}>;
export declare const agentBackupCloudDownloadAPI: (file: string, remote?: string) => Promise<{
    ok: boolean;
    downloaded?: boolean;
    existed?: boolean;
    name?: string;
    path?: string;
    size?: number;
    mtime?: number;
    remote?: string;
    error?: string;
}>;
export type AgentRestoreStatus = {
    ok: boolean;
    running?: boolean;
    startedAt?: string;
    finishedAt?: string;
    success?: boolean;
    file?: string;
    scope?: string;
    includeEnv?: boolean;
    source?: string;
    stage?: string;
    progressPct?: number;
    bytesDone?: number;
    bytesTotal?: number;
    detail?: string;
    error?: string;
};
export declare const agentRestoreStatusAPI: () => Promise<AgentRestoreStatus>;
export declare const agentRestoreStartAPI: (file: string, scope: string, includeEnv: boolean, source?: "local" | "cloud", remote?: string) => Promise<{
    ok: boolean;
    running?: boolean;
    error?: string;
}>;
export declare const agentRestoreLogAPI: (lines?: number) => Promise<{
    ok: boolean;
    path?: string;
    contentB64?: string;
    error?: string;
}>;
export type AgentBackupCronStatus = {
    ok: boolean;
    enabled?: boolean;
    schedule?: string;
    line?: string;
    path?: string;
    error?: string;
};
export declare const agentBackupCronGetAPI: () => Promise<AgentBackupCronStatus>;
export declare const agentBackupCronSetAPI: (enabled: boolean, schedule: string) => Promise<{
    ok: boolean;
    enabled?: boolean;
    schedule?: string;
    path?: string;
    error?: string;
}>;
export {};
