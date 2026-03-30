import { useStorage } from '@vueuse/core'

export type UserLimitPeriod = '1d' | '30d' | 'month'

export type UserLimit = {
  /** Optional MAC identity for the user (used to keep blocks/limits stable across DHCP IP changes). */
  mac?: string
  enabled?: boolean
  /** Hard disable for the user (manual block). */
  disabled?: boolean
  /** Traffic limit in bytes for the selected period. 0/undefined = no limit. */
  trafficLimitBytes?: number
  /** Optional preferred unit for the traffic limit UI. */
  trafficLimitUnit?: 'MB' | 'GB'
  /** Traffic period window. */
  trafficPeriod?: UserLimitPeriod
  /** Optional reset baseline timestamp (ms). */
  resetAt?: number
  /**
   * When resetAt is within an hour bucket, we store a baseline of the current-hour counters
   * so we can subtract pre-reset traffic and avoid immediate re-blocking.
   */
  resetHourKey?: string
  resetHourDl?: number
  resetHourUl?: number
  /** Bandwidth limit in bytes per second (download+upload). 0/undefined = no limit. */
  bandwidthLimitBps?: number
}

export type UserLimitsStore = Record<string, UserLimit>

export const userLimits = useStorage<UserLimitsStore>('config/user-limits-v1', {})

/**
 * If enabled, the UI will attempt to enforce limits by disconnecting active connections
 * of users that are blocked/over-limit via Mihomo API.
 */
export const autoDisconnectLimitedUsers = useStorage<boolean>(
  'config/user-limits-auto-disconnect',
  true,
)

/**
 * If enabled, the UI will also enforce blocks by updating Mihomo config:
 * adding blocked IPs to `lan-disallowed-ips` (hard block).
 */
export const hardBlockLimitedUsers = useStorage<boolean>('config/user-limits-hard-block', true)

/**
 * A list of CIDRs managed by the UI inside Mihomo `lan-disallowed-ips`.
 * We only remove entries that we previously added.
 */
export const managedLanDisallowedCidrs = useStorage<string[]>(
  'config/user-limits-managed-lan-disallowed-cidrs',
  [],
)
