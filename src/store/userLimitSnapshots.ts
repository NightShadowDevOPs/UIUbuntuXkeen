import { useStorage } from '@vueuse/core'
import type { UserLimitsStore } from './userLimits'

export type UserLimitSnapshot = {
  id: string
  createdAt: number
  label: string
  data: UserLimitsStore
}

export const userLimitSnapshots = useStorage<UserLimitSnapshot[]>('config/user-limits-snapshots-v1', [])

export const pushSnapshot = (snap: UserLimitSnapshot, maxKeep = 10) => {
  const list = [...(userLimitSnapshots.value || []), snap]
  // keep newest N
  const next = list.sort((a, b) => a.createdAt - b.createdAt).slice(-maxKeep)
  userLimitSnapshots.value = next
}
