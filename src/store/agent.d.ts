/**
 * Router-side helper agent (optional).
 * Used for "adult" bandwidth shaping per client via tc/iptables, because Mihomo API
 * does not provide traffic shaping.
 */
export declare const agentEnabled: any;
/**
 * Default tries same host as the UI, on port 9099.
 * Example: http://192.168.1.1:9099
 */
export declare const agentUrl: any;
/** Optional Bearer token for the agent. */
export declare const agentToken: any;
/**
 * If enabled, bandwidth limits (Mbps) are enforced by the agent (tc/iptables),
 * NOT by disconnecting connections.
 */
export declare const agentEnforceBandwidth: any;
export declare const bootstrapRouterAgentForLan: () => void;
/**
 * Remember which IPs were shaped by the UI, so we can clean up removed limits.
 */
export declare const managedAgentShapers: any;
/**
 * Per-IP shaping status from the agent.
 * Useful to show "applied/failed" badges and allow manual re-apply.
 */
export declare const agentShaperStatus: any;
/**
 * MAC blocks managed by the UI (best-effort). Key = mac.
 */
export declare const managedAgentBlocks: any;
/**
 * IP blocks managed by the UI (best-effort). Key = ip.
 * Useful when a MAC cannot be resolved.
 */
export declare const managedAgentIpBlocks: any;
/**
 * Scheduled backups (cron). Stored locally; can be applied to the router via the agent.
 * Default: daily at 04:00.
 */
export declare const agentBackupAutoEnabled: any;
/** Time in HH:MM (24h). */
export declare const agentBackupAutoTime: any;
