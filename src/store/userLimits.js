import { useStorage } from '@vueuse/core';
export const userLimits = useStorage('config/user-limits-v1', {});
/**
 * If enabled, the UI will attempt to enforce limits by disconnecting active connections
 * of users that are blocked/over-limit via Mihomo API.
 */
export const autoDisconnectLimitedUsers = useStorage('config/user-limits-auto-disconnect', true);
/**
 * If enabled, the UI will also enforce blocks by updating Mihomo config:
 * adding blocked IPs to `lan-disallowed-ips` (hard block).
 */
export const hardBlockLimitedUsers = useStorage('config/user-limits-hard-block', true);
/**
 * A list of CIDRs managed by the UI inside Mihomo `lan-disallowed-ips`.
 * We only remove entries that we previously added.
 */
export const managedLanDisallowedCidrs = useStorage('config/user-limits-managed-lan-disallowed-cidrs', []);
