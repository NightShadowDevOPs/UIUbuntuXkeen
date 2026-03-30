<template>
  <div class="bg-base-200/50 relative flex min-h-28 flex-col gap-1 rounded-lg p-2">
    <div class="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1">
      <div :class="['text-left text-sm', statusClass(ipForChina)]">ipip.net</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipForChina.ipWithPrivacy[0] : ipForChina.ip[0] }}
        <span class="text-xs" v-if="ipForChina.ip[1]">
          ({{ showPrivacy ? ipForChina.ipWithPrivacy[1] : ipForChina.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipFor2ipRu)]">2ip.ru</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipFor2ipRu.ipWithPrivacy[0] : ipFor2ipRu.ip[0] }}
        <span class="text-xs" v-if="ipFor2ipRu.ip[1]">
          ({{ showPrivacy ? ipFor2ipRu.ipWithPrivacy[1] : ipFor2ipRu.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipFor2ipIo)]">2ip.io</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipFor2ipIo.ipWithPrivacy[0] : ipFor2ipIo.ip[0] }}
        <span class="text-xs" v-if="ipFor2ipIo.ip[1]">
          ({{ showPrivacy ? ipFor2ipIo.ipWithPrivacy[1] : ipFor2ipIo.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipForIpsb)]">ip.sb</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipForIpsb.ipWithPrivacy[0] : ipForIpsb.ip[0] }}
        <span class="text-xs" v-if="ipForIpsb.ip[1]">
          ({{ showPrivacy ? ipForIpsb.ipWithPrivacy[1] : ipForIpsb.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipForIpwhois)]">ipwho.is</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipForIpwhois.ipWithPrivacy[0] : ipForIpwhois.ip[0] }}
        <span class="text-xs" v-if="ipForIpwhois.ip[1]">
          ({{ showPrivacy ? ipForIpwhois.ipWithPrivacy[1] : ipForIpwhois.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipForIpapi)]">ipapi.is</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipForIpapi.ipWithPrivacy[0] : ipForIpapi.ip[0] }}
        <span class="text-xs" v-if="ipForIpapi.ip[1]">
          ({{ showPrivacy ? ipForIpapi.ipWithPrivacy[1] : ipForIpapi.ip[1] }})
        </span>
      </div>

      <div :class="['text-left text-sm', statusClass(ipForWhatismyip)]">whatismyip</div>
      <div class="text-right text-sm">:</div>
      <div class="text-sm">
        {{ showPrivacy ? ipForWhatismyip.ipWithPrivacy[0] : ipForWhatismyip.ip[0] }}
        <span class="text-xs" v-if="ipForWhatismyip.ip[1]">
          ({{ showPrivacy ? ipForWhatismyip.ipWithPrivacy[1] : ipForWhatismyip.ip[1] }})
        </span>
      </div>
    </div>

    <div class="absolute right-2 bottom-2 flex items-center gap-2">
      <button
        class="btn btn-circle btn-sm flex items-center justify-center"
        @click="showPrivacy = !showPrivacy"
        @mouseenter="handlerShowPrivacyTip"
      >
        <EyeIcon v-if="showPrivacy" class="h-4 w-4" />
        <EyeSlashIcon v-else class="h-4 w-4" />
      </button>

      <button class="btn btn-circle btn-sm" @click="getIPs(true)">
        <BoltIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  getIPFrom2ipIoAPI,
  getIPFrom2ipMeGeoAPI,
  getIPFrom2ipMeProviderAPI,
  getIPFromIpipnetAPI,
  getIPInfoFromIPAPI,
  getIPInfoFromIPSB,
  getIPInfoFromIPWHOIS,
  getIPInfoFromWHATISMYIP,
} from '@/api/geoip'
import { ipForChina } from '@/composables/overview'
import { useTooltip } from '@/helper/tooltip'
import { autoIPCheck, twoIpToken, twoIpTokens } from '@/store/settings'
import { BoltIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const showPrivacy = ref(false)
const { showTip } = useTooltip()

const handlerShowPrivacyTip = (e: Event) => {
  showTip(e, t('ipScreenshotTip'))
}

type IPBlock = { ip: string[]; ipWithPrivacy: string[] }

const ipFor2ipRu = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })
const ipFor2ipIo = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })
const ipForIpsb = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })
const ipForIpwhois = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })
const ipForIpapi = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })
const ipForWhatismyip = ref<IPBlock>({ ip: [], ipWithPrivacy: [] })

const QUERYING_IP_INFO: IPBlock = {
  ip: [t('getting'), ''],
  ipWithPrivacy: [t('getting'), ''],
}

const FAILED_IP_INFO: IPBlock = {
  ip: [t('testFailedTip'), ''],
  ipWithPrivacy: [t('testFailedTip'), ''],
}

const maskIP = (ip: string) => (ip ? '***.***.***.***' : '')

// 1h cache, чтобы не упираться в лимиты и не долбить источники каждый ререндер
const CACHE_TTL = 60 * 60 * 1000
const cacheRead = (key: string): IPBlock | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expires: number; value: IPBlock }
    if (!parsed?.expires || Date.now() > parsed.expires) return null
    if (!parsed?.value?.ip?.length) return null
    return parsed.value
  } catch {
    return null
  }
}
const cacheWrite = (key: string, value: IPBlock) => {
  try {
    localStorage.setItem(key, JSON.stringify({ expires: Date.now() + CACHE_TTL, value }))
  } catch {
    // ignore
  }
}

const CACHE_KEY_2IP_RU = 'cache/ipcheck-2ip-ru'
const CACHE_KEY_2IP_IO = 'cache/ipcheck-2ip-io'
const CACHE_KEY_IPSB = 'cache/ipcheck-ipsb'
const CACHE_KEY_IPWHOIS = 'cache/ipcheck-ipwhois'
const CACHE_KEY_IPAPI = 'cache/ipcheck-ipapi'
const CACHE_KEY_WHATISMYIP = 'cache/ipcheck-whatismyip-v1'

const safeText = (s: any) => (typeof s === 'string' ? s.trim() : '')
const pick = (obj: any, path: string[]) => {
  let cur = obj
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[k]
  }
  return cur
}

const statusClass = (b: IPBlock) => {
  const v = (b?.ipWithPrivacy?.[1] || b?.ip?.[1] || '').toString().trim()
  const msg = (b?.ip?.[0] || '').toString()
  if (!v && msg === t('getting')) return 'text-base-content/60'
  if (!v && (msg === t('testFailedTip') || msg === t('twoIpTokenMissing'))) return 'text-error'
  return v ? 'text-success' : 'text-base-content/60'
}

const format2ipIo = (data: any): { text: string; ip: string } => {
  const ip =
    safeText(data?.ip) ||
    safeText(data?.query) ||
    safeText(data?.address) ||
    safeText(pick(data, ['data', 'ip']))

  const country =
    safeText(data?.country) ||
    safeText(pick(data, ['geo', 'country'])) ||
    safeText(pick(data, ['location', 'country']))

  const city =
    safeText(data?.city) ||
    safeText(pick(data, ['geo', 'city'])) ||
    safeText(pick(data, ['location', 'city']))

  const org =
    safeText(data?.organization) ||
    safeText(data?.org) ||
    safeText(pick(data, ['asn', 'org'])) ||
    safeText(pick(data, ['asn', 'name'])) ||
    safeText(pick(data, ['connection', 'org'])) ||
    safeText(pick(data, ['connection', 'isp']))

  const text = [country, city, org].filter(Boolean).join(' ')
  return { text: text || t('noContent'), ip }
}

const loadGlobal = async (
  cacheKey: string,
  apiFn: () => Promise<{ ip: string; country: string; organization: string }>,
  target: { value: IPBlock },
  force = false,
) => {
  const cached = !force ? cacheRead(cacheKey) : null
  if (cached) {
    target.value = cached
    return
  }
  try {
    const res = await apiFn()
    const label = `${res.country} ${res.organization}`.trim() || t('noContent')
    const value: IPBlock = {
      ipWithPrivacy: [label, res.ip],
      ip: [label, maskIP(res.ip)],
    }
    target.value = value
    cacheWrite(cacheKey, value)
  } catch {
    target.value = { ...FAILED_IP_INFO }
  }
}

const getIPs = (force = false) => {
  ipForChina.value = { ...QUERYING_IP_INFO }
  ipFor2ipRu.value = { ...QUERYING_IP_INFO }
  ipFor2ipIo.value = { ...QUERYING_IP_INFO }
  ipForIpsb.value = { ...QUERYING_IP_INFO }
  ipForIpwhois.value = { ...QUERYING_IP_INFO }
  ipForIpapi.value = { ...QUERYING_IP_INFO }
  ipForWhatismyip.value = { ...QUERYING_IP_INFO }

  // china (ipip.net)
  getIPFromIpipnetAPI()
    .then((res) => {
      ipForChina.value = {
        ipWithPrivacy: [res.data.location.join(' '), res.data.ip],
        ip: [`${res.data.location[0]} ** ** **`, maskIP(res.data.ip)],
      }
    })
    .catch(() => (ipForChina.value = { ...FAILED_IP_INFO }))

  // 2ip.ru (через публичный 2ip.me API)
  const cachedRu = !force ? cacheRead(CACHE_KEY_2IP_RU) : null
  if (cachedRu) {
    ipFor2ipRu.value = cachedRu
  } else {
    Promise.all([getIPFrom2ipMeGeoAPI(), getIPFrom2ipMeProviderAPI()])
      .then(([geo, provider]) => {
        const country = geo.country_rus || geo.country
        const city = geo.city_rus || geo.city
        const org = provider.name_rus || provider.name_ripe || ''
        const ip = geo.ip || provider.ip
        const text = [country, city, org].filter(Boolean).join(' ') || t('noContent')

        const value: IPBlock = {
          ipWithPrivacy: [text, ip],
          ip: [text, maskIP(ip)],
        }
        ipFor2ipRu.value = value
        cacheWrite(CACHE_KEY_2IP_RU, value)
      })
      .catch(() => (ipFor2ipRu.value = { ...FAILED_IP_INFO }))
  }

  // 2ip.io (token API) — supports multiple tokens (round-robin)
  const tokens = (twoIpTokens.value || []).map((x) => (x || '').trim()).filter(Boolean)
  const legacy = (twoIpToken.value || '').trim()
  if (legacy && !tokens.includes(legacy)) tokens.unshift(legacy)

  if (!tokens.length) {
    ipFor2ipIo.value = {
      ipWithPrivacy: [t('twoIpTokenMissing'), ''],
      ip: [t('twoIpTokenMissing'), ''],
    }
  } else {
    const cachedIo = !force ? cacheRead(CACHE_KEY_2IP_IO) : null
    if (cachedIo && tokens.length === 1) {
      ipFor2ipIo.value = cachedIo
    } else {
      const cursorKey = 'cache/twoip-token-cursor'
      const start = (() => {
        const v = Number(localStorage.getItem(cursorKey) || '0')
        return Number.isFinite(v) ? v : 0
      })()

      ;(async () => {
        for (let i = 0; i < tokens.length; i++) {
          const idx = (start + i) % tokens.length
          const token = tokens[idx]
          try {
            const data = await getIPFrom2ipIoAPI(token)
            if (!data || data.success === false) throw new Error('2ip.io failed')
            const { text, ip } = format2ipIo(data)
            if (!ip) throw new Error('2ip.io no ip')

            const value: IPBlock = {
              ipWithPrivacy: [text, ip],
              ip: [text, maskIP(ip)],
            }
            ipFor2ipIo.value = value
            cacheWrite(CACHE_KEY_2IP_IO, value)
            localStorage.setItem(cursorKey, String((idx + 1) % tokens.length))
            return
          } catch {
            // try next token
          }
        }
        ipFor2ipIo.value = { ...FAILED_IP_INFO }
      })()
    }
  }

  // global sources
  loadGlobal(CACHE_KEY_IPSB, () => getIPInfoFromIPSB(), ipForIpsb, force)
  loadGlobal(CACHE_KEY_IPWHOIS, () => getIPInfoFromIPWHOIS(), ipForIpwhois, force)
  loadGlobal(CACHE_KEY_IPAPI, () => getIPInfoFromIPAPI(), ipForIpapi, force)
  loadGlobal(CACHE_KEY_WHATISMYIP, () => getIPInfoFromWHATISMYIP(), ipForWhatismyip, force)
}

onMounted(() => {
  const hasAny =
    ipForChina.value.ip.length !== 0 ||
    ipFor2ipRu.value.ip.length !== 0 ||
    ipFor2ipIo.value.ip.length !== 0 ||
    ipForIpsb.value.ip.length !== 0 ||
    ipForIpwhois.value.ip.length !== 0 ||
    ipForIpapi.value.ip.length !== 0 ||
    ipForWhatismyip.value.ip.length !== 0

  if (autoIPCheck.value && !hasAny) getIPs(false)
})
</script>
