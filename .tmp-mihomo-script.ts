
import {
  agentMihomoConfigAPI,
  agentMihomoConfigManagedApplyAPI,
  agentMihomoConfigManagedCopyAPI,
  agentMihomoConfigManagedGetAPI,
  agentMihomoConfigManagedGetRevAPI,
  agentMihomoConfigManagedHistoryAPI,
  agentMihomoConfigManagedPutDraftAPI,
  agentMihomoConfigManagedRestoreBaselineAPI,
  agentMihomoConfigManagedRestoreRevAPI,
  agentMihomoConfigManagedSetBaselineFromActiveAPI,
  agentMihomoConfigManagedValidateAPI,
  agentMihomoConfigStateAPI,
  type MihomoConfigHistoryItem,
  type MihomoConfigManagedState,
} from '@/api/agent'
import { getConfigsAPI, getConfigsRawAPI, reloadConfigsAPI, restartCoreAPI } from '@/api'
import { decodeB64Utf8 } from '@/helper/b64'
import {
  type ParsedProxyEntry,
  type ProxyDisableImpact,
  type ProxyFormModel,
  type ProxyReferenceInfo,
  emptyProxyForm,
  parseProxiesFromConfig,
  proxyFormFromEntry,
  removeProxyFromConfig,
  simulateProxyDisableImpact,
  upsertProxyInConfig,
} from '@/helper/mihomoConfigProxies'
import {
  type ParsedProxyProviderEntry,
  type ProviderDisableImpact,
  type ProxyProviderFormModel,
  emptyProxyProviderForm,
  parseProxyProvidersFromConfig,
  proxyProviderFormFromEntry,
  removeProxyProviderFromConfig,
  simulateProxyProviderDisableImpact,
  upsertProxyProviderInConfig,
} from '@/helper/mihomoConfigProviders'
import {
  type ParsedProxyGroupEntry,
  type ProxyGroupDisableImpact,
  type ProxyGroupFormModel,
  type ProxyGroupReferenceInfo,
  emptyProxyGroupForm,
  parseProxyGroupsFromConfig,
  proxyGroupFormFromEntry,
  removeProxyGroupFromConfig,
  simulateProxyGroupDisableImpact,
  upsertProxyGroupInConfig,
} from '@/helper/mihomoConfigGroups'
import {
  type ParsedRuleProviderEntry,
  type RuleProviderDisableImpact,
  type RuleProviderFormModel,
  emptyRuleProviderForm,
  parseRuleProvidersFromConfig,
  removeRuleProviderFromConfig,
  ruleProviderFormFromEntry,
  simulateRuleProviderDisableImpact,
  upsertRuleProviderInConfig,
} from '@/helper/mihomoConfigRuleProviders'
import {
  type ParsedRuleEntry,
  type RuleFormModel,
  emptyRuleForm,
  parseRulesFromConfig,
  removeRuleFromConfig,
  ruleFormFromEntry,
  syncRuleFormFromRaw,
  syncRuleRawFromForm,
  upsertRuleInConfig,
} from '@/helper/mihomoConfigRules'
import {
  type DnsEditorFormModel,
  dnsEditorFormFromConfig,
  emptyDnsEditorForm,
  upsertDnsEditorInConfig,
} from '@/helper/mihomoConfigDns'
import {
  type AdvancedSectionsFormModel,
  advancedSectionsFormFromConfig,
  emptyAdvancedSectionsForm,
  upsertAdvancedSectionsInConfig,
} from '@/helper/mihomoConfigAdvanced'
import { showNotification } from '@/helper/notification'
import { agentEnabled } from '@/store/agent'
import { useStorage } from '@vueuse/core'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import axios from 'axios'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const path = useStorage('config/mihomo-config-path', '/opt/etc/mihomo/config.yaml')
const payload = useStorage('config/mihomo-config-payload', '')
const expanded = useStorage('config/mihomo-config-expanded', false)
const compareLeft = useStorage<DiffSourceKind>('config/mihomo-config-diff-left', 'active')
const compareRight = useStorage<DiffSourceKind>('config/mihomo-config-diff-right', 'draft')
const compareChangesOnly = useStorage('config/mihomo-config-diff-only-changes', true)
const overviewSource = useStorage<DiffSourceKind>('config/mihomo-config-overview-source', 'draft')
const proxySelectedName = useStorage('config/mihomo-config-proxy-selected', '')
const proxyListQuery = useStorage('config/mihomo-config-proxy-query', '')
const proxyProviderSelectedName = useStorage('config/mihomo-config-provider-selected', '')
const proxyProviderListQuery = useStorage('config/mihomo-config-provider-query', '')
const proxyGroupSelectedName = useStorage('config/mihomo-config-group-selected', '')
const ruleProviderSelectedName = useStorage('config/mihomo-config-rule-provider-selected', '')
const ruleProviderListQuery = useStorage('config/mihomo-config-rule-provider-query', '')
const ruleSelectedIndex = useStorage('config/mihomo-config-rule-selected', '')
const ruleListQuery = useStorage('config/mihomo-config-rule-query', '')

type ConfigWorkspaceSectionId = 'editor' | 'overview' | 'structured' | 'diagnostics' | 'compare' | 'history'
type StructuredEditorSectionId = 'quick' | 'runtime-sections' | 'proxies' | 'proxy-providers' | 'proxy-groups' | 'rule-providers' | 'rules' | 'dns'
const configWorkspaceSection = useStorage<ConfigWorkspaceSectionId>('config/mihomo-config-workspace-section', 'editor')
const structuredEditorSection = useStorage<StructuredEditorSectionId>('config/mihomo-config-structured-section', 'quick')

const { t } = useI18n()

const refreshBusy = ref(false)
const historyBusy = ref(false)
const actionBusy = ref(false)
const managedState = ref<MihomoConfigManagedState | null>(null)
const historyItems = ref<MihomoConfigHistoryItem[]>([])
const validationOutput = ref('')
const validationCmd = ref('')
const validationOk = ref(false)

type ConfigActionKind = 'validate' | 'apply' | 'restore-baseline' | 'restore-revision'
type ConfigActionDiagnostic = {
  kind: ConfigActionKind
  ok: boolean
  phase?: string
  source?: string
  recovery?: string
  restored?: string
  validateCmd?: string
  exitCode?: number | string
  restartMethod?: string
  restartOutput?: string
  firstRestartMethod?: string
  firstRestartOutput?: string
  rollbackRestartMethod?: string
  rollbackRestartOutput?: string
  baselineRestartMethod?: string
  baselineRestartOutput?: string
  error?: string
  output?: string
  updatedAt?: string
  at: string
}

const lastAction = ref<ConfigActionDiagnostic | null>(null)

type DiffSourceKind = 'active' | 'draft' | 'baseline' | 'editor' | 'last-success'
type ManagedPayloadKind = Exclude<DiffSourceKind, 'editor' | 'last-success'>
type DiffRow = {
  type: 'context' | 'add' | 'remove'
  leftNo: number | null
  rightNo: number | null
  leftText: string
  rightText: string
}

type ConfigOverviewSectionState = 'enabled' | 'disabled' | 'present' | 'missing'

type ConfigQuickEditorModel = {
  mode: string
  logLevel: string
  allowLan: string
  ipv6: string
  unifiedDelay: string
  findProcessMode: string
  geodataMode: string
  controller: string
  secret: string
  mixedPort: string
  port: string
  socksPort: string
  redirPort: string
  tproxyPort: string
  tunEnable: string
  tunStack: string
  tunAutoRoute: string
  tunAutoDetectInterface: string
  dnsEnable: string
  dnsIpv6: string
  dnsListen: string
  dnsEnhancedMode: string
}

type QuickEditorFieldKey = keyof ConfigQuickEditorModel
type QuickEditorGroup = 'runtime' | 'network' | 'controller' | 'ports' | 'tun' | 'dns'
type QuickEditorChangeType = 'add' | 'change' | 'remove'

type QuickEditorPreviewItem = {
  key: QuickEditorFieldKey
  group: QuickEditorGroup
  changeType: QuickEditorChangeType
  before: string
  after: string
}

type ConfigOverview = {
  topLevelSections: string[]
  counts: {
    proxies: number
    proxyGroups: number
    rules: number
    proxyProviders: number
    ruleProviders: number
  }
  scalars: {
    mode: string
    logLevel: string
    allowLan: string
    ipv6: string
    unifiedDelay: string
    findProcessMode: string
    geodataMode: string
    controller: string
    secretState: string
    port: string
    mixedPort: string
    socksPort: string
    redirPort: string
    tproxyPort: string
  }
  sections: {
    tun: ConfigOverviewSectionState
    dns: ConfigOverviewSectionState
    profile: ConfigOverviewSectionState
    sniffer: ConfigOverviewSectionState
  }
  stats: {
    totalLines: number
    nonEmptyLines: number
    commentLines: number
  }
}

const managedPayloads = ref<Record<ManagedPayloadKind, string>>({
  active: '',
  draft: '',
  baseline: '',
})
const lastSuccessfulPayload = ref('')

type QuickEditorFieldMeta = { key: QuickEditorFieldKey; group: QuickEditorGroup; yamlKey?: string; section?: 'tun' | 'dns'; nestedKey?: string }

const quickEditorFieldMeta: QuickEditorFieldMeta[] = [
  { key: 'mode', yamlKey: 'mode', group: 'runtime' },
  { key: 'logLevel', yamlKey: 'log-level', group: 'runtime' },
  { key: 'allowLan', yamlKey: 'allow-lan', group: 'network' },
  { key: 'ipv6', yamlKey: 'ipv6', group: 'network' },
  { key: 'unifiedDelay', yamlKey: 'unified-delay', group: 'runtime' },
  { key: 'findProcessMode', yamlKey: 'find-process-mode', group: 'runtime' },
  { key: 'geodataMode', yamlKey: 'geodata-mode', group: 'runtime' },
  { key: 'controller', yamlKey: 'external-controller', group: 'controller' },
  { key: 'secret', yamlKey: 'secret', group: 'controller' },
  { key: 'mixedPort', yamlKey: 'mixed-port', group: 'ports' },
  { key: 'port', yamlKey: 'port', group: 'ports' },
  { key: 'socksPort', yamlKey: 'socks-port', group: 'ports' },
  { key: 'redirPort', yamlKey: 'redir-port', group: 'ports' },
  { key: 'tproxyPort', yamlKey: 'tproxy-port', group: 'ports' },
  { key: 'tunEnable', section: 'tun', nestedKey: 'enable', group: 'tun' },
  { key: 'tunStack', section: 'tun', nestedKey: 'stack', group: 'tun' },
  { key: 'tunAutoRoute', section: 'tun', nestedKey: 'auto-route', group: 'tun' },
  { key: 'tunAutoDetectInterface', section: 'tun', nestedKey: 'auto-detect-interface', group: 'tun' },
  { key: 'dnsEnable', section: 'dns', nestedKey: 'enable', group: 'dns' },
  { key: 'dnsIpv6', section: 'dns', nestedKey: 'ipv6', group: 'dns' },
  { key: 'dnsListen', section: 'dns', nestedKey: 'listen', group: 'dns' },
  { key: 'dnsEnhancedMode', section: 'dns', nestedKey: 'enhanced-mode', group: 'dns' },
]

const emptyQuickEditorModel = (): ConfigQuickEditorModel => ({
  mode: '',
  logLevel: '',
  allowLan: '',
  ipv6: '',
  unifiedDelay: '',
  findProcessMode: '',
  geodataMode: '',
  controller: '',
  secret: '',
  mixedPort: '',
  port: '',
  socksPort: '',
  redirPort: '',
  tproxyPort: '',
  tunEnable: '',
  tunStack: '',
  tunAutoRoute: '',
  tunAutoDetectInterface: '',
  dnsEnable: '',
  dnsIpv6: '',
  dnsListen: '',
  dnsEnhancedMode: '',
})

const quickEditor = ref<ConfigQuickEditorModel>(emptyQuickEditorModel())
const advancedSectionsForm = ref<AdvancedSectionsFormModel>(emptyAdvancedSectionsForm())
const dnsEditorForm = ref<DnsEditorFormModel>(emptyDnsEditorForm())
const proxyForm = ref<ProxyFormModel>(emptyProxyForm())
const proxyProviderForm = ref<ProxyProviderFormModel>(emptyProxyProviderForm())
const proxyGroupForm = ref<ProxyGroupFormModel>(emptyProxyGroupForm())
const ruleProviderForm = ref<RuleProviderFormModel>(emptyRuleProviderForm())
const ruleForm = ref<RuleFormModel>(emptyRuleForm())

const legacyLoadBusy = ref(false)
const legacyApplyBusy = ref(false)
const legacyRestartBusy = ref(false)

const currentPath = computed(() => managedMode.value ? (managedState.value?.active?.path || path.value) : path.value)
const managedMode = computed(() => agentEnabled.value && Boolean(managedState.value?.ok))
const configWorkspaceSections = computed(() => [
  { id: 'editor' as const, labelKey: 'mihomoConfigEditor', disabled: false },
  { id: 'overview' as const, labelKey: 'configOverviewTitle', disabled: false },
  { id: 'structured' as const, labelKey: 'configWorkspaceStructuredTitle', disabled: false },
  { id: 'diagnostics' as const, labelKey: 'configDiagnosticsTitle', disabled: false },
  { id: 'compare' as const, labelKey: 'configDiffTitle', disabled: !managedMode.value },
  { id: 'history' as const, labelKey: 'configHistoryTitle', disabled: !managedMode.value },
])

const setConfigWorkspaceSection = (id: ConfigWorkspaceSectionId) => {
  if (configWorkspaceSections.value.find((section) => section.id === id && !section.disabled)) {
    configWorkspaceSection.value = id
  }
}

const structuredEditorSections = computed(() => [
  { id: 'quick' as const, labelKey: 'configQuickEditorTitle', count: quickEditorPreviewChanges.value.length },
  { id: 'runtime-sections' as const, labelKey: 'configAdvancedSectionsTitle', count: advancedSectionsSummary.value.totalItems },
  { id: 'proxies' as const, labelKey: 'configProxiesTitle', count: parsedProxies.value.length },
  { id: 'proxy-providers' as const, labelKey: 'configProxyProvidersTitle', count: parsedProxyProviders.value.length },
  { id: 'proxy-groups' as const, labelKey: 'configProxyGroupsTitle', count: parsedProxyGroups.value.length },
  { id: 'rule-providers' as const, labelKey: 'configRuleProvidersTitle', count: parsedRuleProviders.value.length },
  { id: 'rules' as const, labelKey: 'configRulesTitle', count: parsedRules.value.length },
  { id: 'dns' as const, labelKey: 'configDnsStructuredTitle', count: dnsStructuredSummary.value.totalItems },
])

const setStructuredEditorSection = (id: StructuredEditorSectionId) => {
  if (structuredEditorSections.value.find((section) => section.id === id)) {
    structuredEditorSection.value = id
  }
}

const busyAny = computed(() => refreshBusy.value || historyBusy.value || actionBusy.value)
const lastSuccessfulExists = computed(() => Boolean(managedState.value?.lastSuccessful?.exists))

const lastSuccessfulStatusText = computed(() => {
  if (!lastSuccessfulExists.value) return t('configLastSuccessfulMissing')
  return managedState.value?.lastSuccessful?.current ? t('configLastSuccessfulCurrent') : t('configLastSuccessfulSavedSnapshot')
})

const lastSuccessfulBadgeClass = computed(() => (managedState.value?.lastSuccessful?.current ? 'badge-success' : 'badge-ghost'))

const fmtTextTs = (value?: string) => {
  const s = String(value || '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

const fmtBytes = (value?: number) => {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const managedStatusText = computed(() => {
  const status = String(managedState.value?.lastApplyStatus || '').trim()
  switch (status) {
    case 'ok':
      return 'OK'
    case 'validate-failed':
      return 'validate failed'
    case 'rolled-back':
      return 'rolled back'
    case 'restored-baseline':
      return 'baseline restored'
    case 'failed':
      return 'failed'
    default:
      return 'idle'
  }
})

const managedStatusBadgeClass = computed(() => {
  const status = String(managedState.value?.lastApplyStatus || '').trim()
  if (status === 'ok') return 'badge-success'
  if (status === 'rolled-back' || status === 'restored-baseline') return 'badge-warning'
  if (status === 'validate-failed' || status === 'failed') return 'badge-error'
  return 'badge-ghost'
})

const hasText = (value?: string | number | null) => String(value ?? '').trim().length > 0

const actionTypeText = (kind?: string) => {
  switch (kind) {
    case 'validate':
      return t('configDiagActionValidate')
    case 'apply':
      return t('configDiagActionApply')
    case 'restore-baseline':
      return t('configDiagActionRestoreBaseline')
    case 'restore-revision':
      return t('configDiagActionRestoreRevision')
    default:
      return '—'
  }
}

const phaseText = (phase?: string) => {
  switch (String(phase || '').trim()) {
    case 'validate':
      return t('configDiagPhaseValidate')
    case 'apply':
      return t('configDiagPhaseApply')
    case 'restart':
      return t('configDiagPhaseRestart')
    default:
      return '—'
  }
}

const recoveryText = (value?: string) => {
  switch (String(value || '').trim()) {
    case 'none':
      return t('configDiagRecoveryNone')
    case 'previous-active':
      return t('configDiagRecoveryPreviousActive')
    case 'baseline':
      return t('configDiagRecoveryBaseline')
    case 'failed':
      return t('configDiagRecoveryFailed')
    default:
      return value || '—'
  }
}

const sourceText = (value?: string) => {
  const source = String(value || '').trim()
  if (!source) return '—'
  if (source === 'draft') return t('configCompareSourceDraft')
  if (source === 'baseline') return t('configCompareSourceBaseline')
  if (source === 'active') return t('configCompareSourceActive')
  if (source.startsWith('history:')) return `${t('configHistoryRevisionLabel')} ${source.slice('history:'.length)}`
  return source
}

const setLastAction = (next: Omit<ConfigActionDiagnostic, 'at'>) => {
  lastAction.value = {
    ...next,
    at: new Date().toISOString(),
  }
}

const fetchManagedPayloadText = async (kind: ManagedPayloadKind): Promise<string> => {
  const r = await agentMihomoConfigManagedGetAPI(kind)
  if (!r.ok || !r.contentB64) return ''
  return decodeB64Utf8(r.contentB64)
}

const refreshManagedPayloads = async (state: MihomoConfigManagedState) => {
  const next: Record<ManagedPayloadKind, string> = {
    active: '',
    draft: '',
    baseline: '',
  }

  const kinds: ManagedPayloadKind[] = ['active', 'draft', 'baseline']
  await Promise.all(kinds.map(async (kind) => {
    if (state[kind]?.exists) {
      next[kind] = await fetchManagedPayloadText(kind)
    }
  }))

  managedPayloads.value = next
  return next
}

const refreshLastSuccessfulPayload = async (state: MihomoConfigManagedState, nextPayloads: Record<ManagedPayloadKind, string>) => {
  const last = state.lastSuccessful
  if (!last?.exists || !last.rev) {
    lastSuccessfulPayload.value = ''
    return ''
  }
  if (last.current || (state.active?.rev && last.rev === state.active.rev)) {
    lastSuccessfulPayload.value = nextPayloads.active || ''
    return lastSuccessfulPayload.value
  }
  try {
    const r = await agentMihomoConfigManagedGetRevAPI(last.rev)
    lastSuccessfulPayload.value = r.ok && r.contentB64 ? decodeB64Utf8(r.contentB64) : ''
  } catch {
    lastSuccessfulPayload.value = ''
  }
  return lastSuccessfulPayload.value
}

const loadHistory = async () => {
  if (!agentEnabled.value) return
  historyBusy.value = true
  try {
    const r = await agentMihomoConfigManagedHistoryAPI()
    historyItems.value = Array.isArray(r.items) ? r.items : []
  } finally {
    historyBusy.value = false
  }
}

const refreshManaged = async (loadEditor = false) => {
  const state = await agentMihomoConfigStateAPI()
  managedState.value = state
  if (!state.ok) return false

  const managedTexts = await refreshManagedPayloads(state)
  await refreshLastSuccessfulPayload(state, managedTexts)

  if (loadEditor) {
    if (state.draft?.exists) {
      payload.value = managedTexts.draft
      path.value = state.draft?.path || path.value
    } else if (state.active?.exists) {
      payload.value = managedTexts.active
      path.value = state.active?.path || path.value
    }
  }
  await loadHistory()
  return true
}

const refreshAll = async (loadEditor = false) => {
  if (refreshBusy.value) return
  refreshBusy.value = true
  try {
    if (agentEnabled.value) {
      const ok = await refreshManaged(loadEditor)
      if (ok) return
    }
    await legacyLoad()
  } finally {
    refreshBusy.value = false
  }
}

const ensureDraftSaved = async () => {
  const r = await agentMihomoConfigManagedPutDraftAPI(payload.value || '')
  if (!r.ok) {
    throw new Error(r.error || 'save-failed')
  }
  await refreshManaged(false)
}

const saveDraft = async () => {
  if (!managedMode.value || actionBusy.value) return
  actionBusy.value = true
  try {
    await ensureDraftSaved()
    showNotification({ content: 'configDraftSavedRemoteSuccess', type: 'alert-success' })
  } catch (e: any) {
    showNotification({ content: 'configDraftSaveFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const copyFromManaged = async (from: 'active' | 'baseline') => {
  if (!managedMode.value || actionBusy.value) return
  actionBusy.value = true
  try {
    const r = await agentMihomoConfigManagedCopyAPI(from)
    if (!r.ok) throw new Error(r.error || 'copy-failed')
    await refreshManaged(false)
    payload.value = managedPayloads.value.draft
    validationOutput.value = ''
    showNotification({ content: from === 'active' ? 'configDraftLoadedFromActive' : 'configDraftLoadedFromBaseline', type: 'alert-success' })
  } catch (e: any) {
    showNotification({ content: 'configDraftCopyFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const validateDraft = async () => {
  if (!managedMode.value || actionBusy.value) return
  actionBusy.value = true
  try {
    await ensureDraftSaved()
    const r = await agentMihomoConfigManagedValidateAPI('draft')
    validationOk.value = Boolean(r.ok)
    validationCmd.value = String(r.cmd || '')
    validationOutput.value = String(r.output || r.error || '')
    setLastAction({
      kind: 'validate',
      ok: Boolean(r.ok),
      phase: r.phase || 'validate',
      source: r.source || 'draft',
      validateCmd: String(r.cmd || ''),
      exitCode: r.exitCode,
      output: String(r.output || ''),
      error: String(r.error || ''),
    })
    showNotification({ content: r.ok ? 'configValidationSuccess' : 'configValidationFailedToast', type: r.ok ? 'alert-success' : 'alert-error' })
  } catch (e: any) {
    validationOk.value = false
    validationCmd.value = ''
    validationOutput.value = e?.message || 'failed'
    setLastAction({
      kind: 'validate',
      ok: false,
      phase: 'validate',
      source: 'draft',
      error: e?.message || 'failed',
    })
    showNotification({ content: 'configValidationFailedToast', type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const applyDraft = async () => {
  if (!managedMode.value || actionBusy.value) return
  actionBusy.value = true
  try {
    await ensureDraftSaved()
    const r = await agentMihomoConfigManagedApplyAPI()
    await refreshManaged(true)
    validationOk.value = Boolean(r.ok)
    validationCmd.value = String(r.validateCmd || '')
    validationOutput.value = String(r.restartOutput || r.output || r.error || '')
    setLastAction({
      kind: 'apply',
      ok: Boolean(r.ok),
      phase: r.phase || (r.ok ? 'apply' : 'restart'),
      source: r.appliedFrom || r.source || 'draft',
      recovery: r.recovery,
      restored: r.restored,
      validateCmd: r.validateCmd,
      restartMethod: r.restartMethod,
      restartOutput: r.restartOutput,
      firstRestartMethod: r.firstRestartMethod,
      firstRestartOutput: r.firstRestartOutput,
      rollbackRestartMethod: r.rollbackRestartMethod,
      rollbackRestartOutput: r.rollbackRestartOutput,
      baselineRestartMethod: r.baselineRestartMethod,
      baselineRestartOutput: r.baselineRestartOutput,
      error: r.error,
      output: r.output,
      updatedAt: r.updatedAt,
    })
    if (!r.ok) throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'apply-failed')
    showNotification({ content: 'configApplySuccess', type: 'alert-success' })
  } catch (e: any) {
    if (!lastAction.value || lastAction.value.kind !== 'apply') {
      setLastAction({
        kind: 'apply',
        ok: false,
        phase: 'apply',
        source: 'draft',
        error: e?.message || 'failed',
      })
    }
    showNotification({ content: 'configApplyFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const setBaselineFromActive = async () => {
  if (!managedMode.value || actionBusy.value) return
  if (!window.confirm('Сделать текущий активный конфиг новым эталонным?')) return
  actionBusy.value = true
  try {
    const r = await agentMihomoConfigManagedSetBaselineFromActiveAPI()
    if (!r.ok) throw new Error(r.error || 'baseline-failed')
    await refreshManaged(false)
    showNotification({ content: 'configBaselinePromoted', type: 'alert-success' })
  } catch (e: any) {
    showNotification({ content: 'configBaselinePromoteFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const restoreBaseline = async () => {
  if (!managedMode.value || actionBusy.value) return
  if (!window.confirm('Восстановить эталонный конфиг как активный?')) return
  actionBusy.value = true
  try {
    const r = await agentMihomoConfigManagedRestoreBaselineAPI()
    await refreshManaged(true)
    setLastAction({
      kind: 'restore-baseline',
      ok: Boolean(r.ok),
      phase: r.phase || (r.ok ? 'apply' : 'restart'),
      source: r.source || 'baseline',
      recovery: r.recovery,
      restored: r.restored,
      validateCmd: r.validateCmd,
      restartMethod: r.restartMethod,
      restartOutput: r.restartOutput,
      firstRestartMethod: r.firstRestartMethod,
      firstRestartOutput: r.firstRestartOutput,
      rollbackRestartMethod: r.rollbackRestartMethod,
      rollbackRestartOutput: r.rollbackRestartOutput,
      baselineRestartMethod: r.baselineRestartMethod,
      baselineRestartOutput: r.baselineRestartOutput,
      error: r.error,
      output: r.output,
      updatedAt: r.updatedAt,
    })
    if (!r.ok) throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'restore-failed')
    showNotification({ content: 'configBaselineRestored', type: 'alert-success' })
  } catch (e: any) {
    if (!lastAction.value || lastAction.value.kind !== 'restore-baseline') {
      setLastAction({
        kind: 'restore-baseline',
        ok: false,
        phase: 'apply',
        source: 'baseline',
        error: e?.message || 'failed',
      })
    }
    showNotification({ content: 'configBaselineRestoreFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const loadHistoryRev = async (rev: number) => {
  if (actionBusy.value) return
  actionBusy.value = true
  try {
    const r = await agentMihomoConfigManagedGetRevAPI(rev)
    if (!r.ok || !r.contentB64) throw new Error(r.error || 'not-found')
    payload.value = decodeB64Utf8(r.contentB64)
    validationOutput.value = ''
    validationCmd.value = ''
    showNotification({ content: 'configHistoryLoadedIntoEditor', type: 'alert-success' })
  } catch (e: any) {
    showNotification({ content: 'configHistoryLoadFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const restoreHistoryRev = async (rev: number) => {
  if (actionBusy.value) return
  if (!window.confirm(`Восстановить ревизию ${rev} как активный конфиг?`)) return
  actionBusy.value = true
  try {
    const r = await agentMihomoConfigManagedRestoreRevAPI(rev)
    await refreshManaged(true)
    setLastAction({
      kind: 'restore-revision',
      ok: Boolean(r.ok),
      phase: r.phase || (r.ok ? 'apply' : 'restart'),
      source: r.source || `history:${rev}`,
      recovery: r.recovery,
      restored: r.restored,
      validateCmd: r.validateCmd,
      restartMethod: r.restartMethod,
      restartOutput: r.restartOutput,
      firstRestartMethod: r.firstRestartMethod,
      firstRestartOutput: r.firstRestartOutput,
      rollbackRestartMethod: r.rollbackRestartMethod,
      rollbackRestartOutput: r.rollbackRestartOutput,
      baselineRestartMethod: r.baselineRestartMethod,
      baselineRestartOutput: r.baselineRestartOutput,
      error: r.error,
      output: r.output,
      updatedAt: r.updatedAt,
    })
    if (!r.ok) throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'restore-failed')
    showNotification({ content: 'configHistoryRestoreSuccess', type: 'alert-success' })
  } catch (e: any) {
    if (!lastAction.value || lastAction.value.kind !== 'restore-revision') {
      setLastAction({
        kind: 'restore-revision',
        ok: false,
        phase: 'apply',
        source: `history:${rev}`,
        error: e?.message || 'failed',
      })
    }
    showNotification({ content: 'configHistoryRestoreFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' })
  } finally {
    actionBusy.value = false
  }
}

const loadLastSuccessfulIntoEditor = () => {
  if (!lastSuccessfulExists.value) return
  payload.value = lastSuccessfulPayload.value || ''
  validationOutput.value = ''
  validationCmd.value = ''
  showNotification({ content: 'configLastSuccessfulLoadedIntoEditor', type: 'alert-success' })
}

const compareDraftWithLastSuccessful = () => {
  if (!lastSuccessfulExists.value) return
  compareLeft.value = 'last-success'
  compareRight.value = diffSourceAvailable('draft') ? 'draft' : 'editor'
}

const compareActiveWithLastSuccessful = () => {
  if (!lastSuccessfulExists.value) return
  compareLeft.value = 'last-success'
  compareRight.value = diffSourceAvailable('active') ? 'active' : 'editor'
}

const diffSourceLabel = (kind: DiffSourceKind) => {
  switch (kind) {
    case 'active':
      return t('configCompareSourceActive')
    case 'draft':
      return t('configCompareSourceDraft')
    case 'baseline':
      return t('configCompareSourceBaseline')
    case 'last-success':
      return t('configCompareSourceLastSuccess')
    case 'editor':
    default:
      return t('configCompareSourceEditor')
  }
}

const diffSourceAvailable = (kind: DiffSourceKind) => {
  if (kind === 'editor') return true
  if (kind === 'last-success') return Boolean(managedState.value?.lastSuccessful?.exists)
  return Boolean(managedState.value?.[kind as ManagedPayloadKind]?.exists)
}

const normalizeDiffSource = (kind: DiffSourceKind): DiffSourceKind => {
  if (diffSourceAvailable(kind)) return kind
  if (kind !== 'editor') return 'editor'
  return 'editor'
}

const diffSourceOptions = computed(() => ([
  { value: 'active' as DiffSourceKind, label: diffSourceLabel('active'), disabled: !diffSourceAvailable('active') },
  { value: 'draft' as DiffSourceKind, label: diffSourceLabel('draft'), disabled: !diffSourceAvailable('draft') },
  { value: 'baseline' as DiffSourceKind, label: diffSourceLabel('baseline'), disabled: !diffSourceAvailable('baseline') },
  { value: 'last-success' as DiffSourceKind, label: diffSourceLabel('last-success'), disabled: !diffSourceAvailable('last-success') },
  { value: 'editor' as DiffSourceKind, label: diffSourceLabel('editor'), disabled: false },
]))

const overviewSourceResolved = computed<DiffSourceKind>(() => normalizeDiffSource(overviewSource.value as DiffSourceKind))

const emptyConfigOverview = (): ConfigOverview => ({
  topLevelSections: [],
  counts: {
    proxies: 0,
    proxyGroups: 0,
    rules: 0,
    proxyProviders: 0,
    ruleProviders: 0,
  },
  scalars: {
    mode: '',
    logLevel: '',
    allowLan: '',
    ipv6: '',
    unifiedDelay: '',
    findProcessMode: '',
    geodataMode: '',
    controller: '',
    secretState: '',
    port: '',
    mixedPort: '',
    socksPort: '',
    redirPort: '',
    tproxyPort: '',
  },
  sections: {
    tun: 'missing',
    dns: 'missing',
    profile: 'missing',
    sniffer: 'missing',
  },
  stats: {
    totalLines: 0,
    nonEmptyLines: 0,
    commentLines: 0,
  },
})

const unquoteYamlKey = (value: string) => {
  const s = String(value || '').trim()
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1)
  return s
}

const sanitizeScalarValue = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const withoutComment = trimmed.replace(/\s+#.*$/, '').trim()
  if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
    return withoutComment.slice(1, -1)
  }
  return withoutComment
}

const countListItemsInSection = (lines: string[]) => lines.reduce((acc, line) => acc + (/^\s{2}-\s+/.test(line) ? 1 : 0), 0)

const countMapItemsInSection = (lines: string[]) => lines.reduce((acc, line) => {
  if (/^\s{2}(?:[^#\s][^:]*|"[^"]+"|'[^']+'):\s*(?:#.*)?$/.test(line)) return acc + 1
  return acc
}, 0)

const detectSectionState = (sectionLines: string[] | undefined): ConfigOverviewSectionState => {
  if (!sectionLines || !sectionLines.length) return 'missing'
  const enabledLine = sectionLines.find((line) => /^\s{2}enabled:\s*/.test(line) || /^\s{2}enable:\s*/.test(line))
  if (!enabledLine) return 'present'
  const raw = sanitizeScalarValue(enabledLine.replace(/^\s{2}(?:enabled|enable):\s*/, ''))
  const lowered = raw.toLowerCase()
  if (['true', 'on', 'yes'].includes(lowered)) return 'enabled'
  if (['false', 'off', 'no'].includes(lowered)) return 'disabled'
  return 'present'
}

const buildConfigOverview = (value: string): ConfigOverview => {
  const normalized = normalizeDiffText(value)
  const overview = emptyConfigOverview()
  const trimmed = normalized.trim()
  if (!trimmed) return overview

  const lines = normalized.split('\n')
  overview.stats.totalLines = lines.length
  overview.stats.nonEmptyLines = lines.filter((line) => line.trim().length > 0).length
  overview.stats.commentLines = lines.filter((line) => /^\s*#/.test(line)).length

  const sectionLines: Record<string, string[]> = {}
  let currentTopLevel = ''

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    const trimmedLine = line.trim()
    if (!trimmedLine.length) {
      if (currentTopLevel) sectionLines[currentTopLevel].push(line)
      continue
    }
    if (/^#/.test(trimmedLine)) {
      if (currentTopLevel) sectionLines[currentTopLevel].push(line)
      continue
    }

    const topMatch = line.match(/^([A-Za-z0-9_.@-]+|"[^"]+"|'[^']+'):\s*(.*)$/)
    if (topMatch && !/^\s/.test(line)) {
      const key = unquoteYamlKey(topMatch[1])
      currentTopLevel = key
      if (!overview.topLevelSections.includes(key)) overview.topLevelSections.push(key)
      sectionLines[key] = []
      const rest = sanitizeScalarValue(topMatch[2])
      if (rest && !['|', '|-', '>', '>-', '{}', '[]'].includes(rest)) {
        switch (key) {
          case 'mode': overview.scalars.mode = rest; break
          case 'log-level': overview.scalars.logLevel = rest; break
          case 'allow-lan': overview.scalars.allowLan = rest; break
          case 'ipv6': overview.scalars.ipv6 = rest; break
          case 'unified-delay': overview.scalars.unifiedDelay = rest; break
          case 'find-process-mode': overview.scalars.findProcessMode = rest; break
          case 'geodata-mode': overview.scalars.geodataMode = rest; break
          case 'external-controller': overview.scalars.controller = rest; break
          case 'secret': overview.scalars.secretState = rest ? t('configOverviewSecretSet') : t('configOverviewSecretEmpty'); break
          case 'port': overview.scalars.port = rest; break
          case 'mixed-port': overview.scalars.mixedPort = rest; break
          case 'socks-port': overview.scalars.socksPort = rest; break
          case 'redir-port': overview.scalars.redirPort = rest; break
          case 'tproxy-port': overview.scalars.tproxyPort = rest; break
        }
      }
      continue
    }

    if (currentTopLevel) sectionLines[currentTopLevel].push(line)
  }

  overview.counts.proxies = countListItemsInSection(sectionLines['proxies'] || [])
  overview.counts.proxyGroups = countListItemsInSection(sectionLines['proxy-groups'] || [])
  overview.counts.rules = countListItemsInSection(sectionLines['rules'] || [])
  overview.counts.proxyProviders = countMapItemsInSection(sectionLines['proxy-providers'] || [])
  overview.counts.ruleProviders = countMapItemsInSection(sectionLines['rule-providers'] || [])

  overview.sections.tun = detectSectionState(sectionLines.tun)
  overview.sections.dns = detectSectionState(sectionLines.dns)
  overview.sections.profile = detectSectionState(sectionLines.profile)
  overview.sections.sniffer = detectSectionState(sectionLines.sniffer)

  if (!overview.scalars.secretState) overview.scalars.secretState = overview.topLevelSections.includes('secret') ? t('configOverviewSecretEmpty') : t('configOverviewSecretNotSet')

  return overview
}

const overviewSummary = computed(() => buildConfigOverview(diffSourceContent(overviewSourceResolved.value)))
const overviewHasContent = computed(() => overviewSummary.value.stats.totalLines > 0)
const quickEditorHasPayload = computed(() => normalizeDiffText(payload.value).trim().length > 0)

const quickEditorPreviewChanges = computed<QuickEditorPreviewItem[]>(() => {
  const source = normalizeDiffText(payload.value)
  if (!source.trim().length) return []
  return quickEditorFieldMeta.flatMap((field) => {
    const before = getQuickEditorFieldValue(source, field)
    const after = String(quickEditor.value[field.key] || '').trim()
    if (before === after) return []
    let changeType: QuickEditorChangeType = 'change'
    if (!before.length && after.length) changeType = 'add'
    else if (before.length && !after.length) changeType = 'remove'
    return [{ key: field.key, group: field.group, changeType, before, after }]
  })
})

const quickEditorPreviewSummary = computed(() => quickEditorPreviewChanges.value.reduce((acc, item) => {
  if (item.changeType === 'add') acc.added += 1
  else if (item.changeType === 'remove') acc.removed += 1
  else acc.changed += 1
  return acc
}, { added: 0, changed: 0, removed: 0 }))

const quickEditorAffectedGroups = computed<QuickEditorGroup[]>(() => Array.from(new Set(quickEditorPreviewChanges.value.map((item) => item.group))))
const quickEditorCanApply = computed(() => quickEditorHasPayload.value && quickEditorPreviewChanges.value.length > 0)
const advancedSectionsAppliedPreview = computed(() => upsertAdvancedSectionsInConfig(payload.value, advancedSectionsForm.value))
const advancedSectionsCanApply = computed(() => quickEditorHasPayload.value && normalizeDiffText(advancedSectionsAppliedPreview.value) !== normalizeDiffText(payload.value))
const advancedSectionsSummary = computed(() => {
  const countLines = (value: string) => normalizeDiffText(value).split('\n').map((line) => line.trim()).filter(Boolean).length
  const tun = [
    advancedSectionsForm.value.tunEnable,
    advancedSectionsForm.value.tunStack,
    advancedSectionsForm.value.tunAutoRoute,
    advancedSectionsForm.value.tunAutoDetectInterface,
    advancedSectionsForm.value.tunDevice,
    advancedSectionsForm.value.tunMtu,
    advancedSectionsForm.value.tunStrictRoute,
  ].filter((item) => String(item || '').trim().length).length
    + countLines(advancedSectionsForm.value.tunDnsHijackText)
    + countLines(advancedSectionsForm.value.tunRouteIncludeAddressText)
    + countLines(advancedSectionsForm.value.tunRouteExcludeAddressText)
    + countLines(advancedSectionsForm.value.tunIncludeInterfaceText)
    + countLines(advancedSectionsForm.value.tunExcludeInterfaceText)
  const profile = [
    advancedSectionsForm.value.profileStoreSelected,
    advancedSectionsForm.value.profileStoreFakeIp,
  ].filter((item) => String(item || '').trim().length).length
  const sniffer = [
    advancedSectionsForm.value.snifferEnable,
    advancedSectionsForm.value.snifferParsePureIp,
    advancedSectionsForm.value.snifferOverrideDestination,
  ].filter((item) => String(item || '').trim().length).length
    + countLines(advancedSectionsForm.value.snifferForceDomainText)
    + countLines(advancedSectionsForm.value.snifferSkipDomainText)
    + countLines(advancedSectionsForm.value.snifferSniffText)
  return {
    tun,
    profile,
    sniffer,
    totalItems: tun + profile + sniffer,
  }
})
const dnsEditorAppliedPreview = computed(() => upsertDnsEditorInConfig(payload.value, dnsEditorForm.value))
const dnsEditorCanApply = computed(() => quickEditorHasPayload.value && normalizeDiffText(dnsEditorAppliedPreview.value) !== normalizeDiffText(payload.value))
const dnsStructuredSummary = computed(() => {
  const countLines = (value: string) => normalizeDiffText(value).split('\n').map((line) => line.trim()).filter(Boolean).length
  return {
    defaultNameserver: countLines(dnsEditorForm.value.defaultNameserverText),
    nameserver: countLines(dnsEditorForm.value.nameserverText),
    fallback: countLines(dnsEditorForm.value.fallbackText),
    fakeIpFilter: countLines(dnsEditorForm.value.fakeIpFilterText),
    dnsHijack: countLines(dnsEditorForm.value.dnsHijackText),
    nameserverPolicy: countLines(dnsEditorForm.value.nameserverPolicyText),
    totalItems:
      countLines(dnsEditorForm.value.defaultNameserverText)
      + countLines(dnsEditorForm.value.nameserverText)
      + countLines(dnsEditorForm.value.fallbackText)
      + countLines(dnsEditorForm.value.proxyServerNameserverText)
      + countLines(dnsEditorForm.value.fakeIpFilterText)
      + countLines(dnsEditorForm.value.dnsHijackText)
      + countLines(dnsEditorForm.value.nameserverPolicyText)
      + countLines(dnsEditorForm.value.fallbackFilterGeositeText)
      + countLines(dnsEditorForm.value.fallbackFilterIpcidrText)
      + countLines(dnsEditorForm.value.fallbackFilterDomainText)
      + (String(dnsEditorForm.value.fallbackFilterGeoip || '').trim().length ? 1 : 0)
      + (String(dnsEditorForm.value.fallbackFilterGeoipCode || '').trim().length ? 1 : 0),
  }
})
const parsedProxies = computed<ParsedProxyEntry[]>(() => parseProxiesFromConfig(payload.value))
const selectedProxyEntry = computed(() => parsedProxies.value.find((item) => item.name === proxySelectedName.value) || null)
const normalizedProxyListQuery = computed(() => String(proxyListQuery.value || '').trim().toLowerCase())
const filteredProxies = computed(() => {
  const query = normalizedProxyListQuery.value
  if (!query) return parsedProxies.value
  const parts = query.split(/\s+/).filter(Boolean)
  if (!parts.length) return parsedProxies.value
  return parsedProxies.value.filter((item) => {
    const haystack = [
      item.name,
      item.type,
      item.server,
      item.port,
      item.network,
      item.uuid,
      item.password,
      item.cipher,
      item.dialerProxy,
    ].join(' ').toLowerCase()
    return parts.every((part) => haystack.includes(part))
  })
})
const normalizedProxyType = computed(() => String(proxyForm.value.type || '').trim().toLowerCase())
const proxyTypePresets = computed(() => [
  { id: 'ss', label: 'ss' },
  { id: 'vmess', label: 'vmess' },
  { id: 'vless', label: 'vless' },
  { id: 'trojan', label: 'trojan' },
  { id: 'wireguard', label: 'wireguard' },
  { id: 'hysteria2', label: 'hysteria2' },
  { id: 'tuic', label: 'tuic' },
])
const proxyFormHasSecurityValues = computed(() => [proxyForm.value.tls, proxyForm.value.skipCertVerify, proxyForm.value.sni, proxyForm.value.servername, proxyForm.value.clientFingerprint, proxyForm.value.alpnText, proxyForm.value.realityPublicKey, proxyForm.value.realityShortId].some((value) => String(value || '').trim().length > 0))
const proxyFormHasAuthValues = computed(() => [proxyForm.value.uuid, proxyForm.value.password, proxyForm.value.cipher, proxyForm.value.flow].some((value) => String(value || '').trim().length > 0))
const proxyFormHasTransportValues = computed(() => [proxyForm.value.network, proxyForm.value.wsPath, proxyForm.value.wsHeadersBody, proxyForm.value.grpcServiceName, proxyForm.value.grpcMultiMode].some((value) => String(value || '').trim().length > 0))
const proxyFormHasPluginValues = computed(() => [proxyForm.value.plugin, proxyForm.value.pluginOptsBody].some((value) => String(value || '').trim().length > 0))
const proxyFormHasHttpOptsValues = computed(() => [proxyForm.value.httpMethod, proxyForm.value.httpPathText, proxyForm.value.httpHeadersBody].some((value) => String(value || '').trim().length > 0))
const proxyFormHasSmuxValues = computed(() => [proxyForm.value.smuxEnabled, proxyForm.value.smuxProtocol, proxyForm.value.smuxMaxConnections, proxyForm.value.smuxMinStreams, proxyForm.value.smuxMaxStreams, proxyForm.value.smuxPadding, proxyForm.value.smuxStatistic].some((value) => String(value || '').trim().length > 0))
const proxyFormHasWireguardValues = computed(() => [proxyForm.value.wireguardIpText, proxyForm.value.wireguardIpv6Text, proxyForm.value.wireguardPrivateKey, proxyForm.value.wireguardPublicKey, proxyForm.value.wireguardPresharedKey, proxyForm.value.wireguardMtu, proxyForm.value.wireguardReservedText, proxyForm.value.wireguardWorkers].some((value) => String(value || '').trim().length > 0))
const proxyFormHasHysteria2Values = computed(() => [proxyForm.value.hysteriaUp, proxyForm.value.hysteriaDown, proxyForm.value.hysteriaObfs, proxyForm.value.hysteriaObfsPassword].some((value) => String(value || '').trim().length > 0))
const proxyFormHasTuicValues = computed(() => [proxyForm.value.tuicCongestionController, proxyForm.value.tuicUdpRelayMode, proxyForm.value.tuicHeartbeatInterval, proxyForm.value.tuicRequestTimeout, proxyForm.value.tuicFastOpen, proxyForm.value.tuicReduceRtt, proxyForm.value.tuicDisableSni].some((value) => String(value || '').trim().length > 0))
const proxyTypeVisibility = computed(() => {
  const type = normalizedProxyType.value
  const network = String(proxyForm.value.network || '').trim().toLowerCase()
  const securityTypes = ['vmess', 'vless', 'trojan', 'http', 'hysteria2', 'tuic']
  const authTypes = ['ss', 'vmess', 'vless', 'trojan', 'socks5', 'http', 'hysteria2', 'tuic']
  const transportTypes = ['vmess', 'vless', 'trojan']
  const pluginTypes = ['ss', 'trojan']
  const smuxTypes = ['vmess', 'vless', 'trojan', 'hysteria2', 'tuic']
  return {
    security: securityTypes.includes(type) || proxyFormHasSecurityValues.value,
    auth: authTypes.includes(type) || proxyFormHasAuthValues.value,
    transport: transportTypes.includes(type) || ['ws', 'grpc'].includes(network) || proxyFormHasTransportValues.value,
    plugin: pluginTypes.includes(type) || proxyFormHasPluginValues.value,
    httpOpts: type === 'http' || ['http', 'h2'].includes(network) || proxyFormHasHttpOptsValues.value,
    smux: smuxTypes.includes(type) || proxyFormHasSmuxValues.value,
    wireguard: type === 'wireguard' || proxyFormHasWireguardValues.value,
    protocolExtras: ['hysteria2', 'tuic'].includes(type) || proxyFormHasHysteria2Values.value || proxyFormHasTuicValues.value,
    hysteria2: type === 'hysteria2' || proxyFormHasHysteria2Values.value,
    tuic: type === 'tuic' || proxyFormHasTuicValues.value,
  }
})
const proxyTypeSummary = computed(() => {
  switch (normalizedProxyType.value) {
    case 'ss': return t('configProxiesTypeSummarySs')
    case 'vmess': return t('configProxiesTypeSummaryVmess')
    case 'vless': return t('configProxiesTypeSummaryVless')
    case 'trojan': return t('configProxiesTypeSummaryTrojan')
    case 'wireguard': return t('configProxiesTypeSummaryWireguard')
    case 'hysteria2': return t('configProxiesTypeSummaryHysteria2')
    case 'tuic': return t('configProxiesTypeSummaryTuic')
    default: return t('configProxiesTypeSummaryDefault')
  }
})
const proxyTypeProfileLabel = computed(() => `${t('configProxiesFieldType')}: ${String(proxyForm.value.type || '').trim() || t('configQuickEditorKeepEmpty')}`)
const proxyTypeFocusBadges = computed(() => {
  const out: string[] = []
  if (proxyTypeVisibility.value.security) out.push(t('configProxiesSecurityTitle'))
  if (proxyTypeVisibility.value.auth) out.push(t('configProxiesAuthTitle'))
  if (proxyTypeVisibility.value.transport) out.push(t('configProxiesTransportTitle'))
  if (proxyTypeVisibility.value.plugin) out.push(t('configProxiesPluginTitle'))
  if (proxyTypeVisibility.value.httpOpts) out.push(t('configProxiesHttpOptsTitle'))
  if (proxyTypeVisibility.value.smux) out.push(t('configProxiesSmuxTitle'))
  if (proxyTypeVisibility.value.wireguard) out.push(t('configProxiesWireguardTitle'))
  if (proxyTypeVisibility.value.hysteria2) out.push('hysteria2')
  if (proxyTypeVisibility.value.tuic) out.push('tuic')
  return Array.from(new Set(out))
})
const topProxyTypeCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const item of parsedProxies.value) {
    const key = String(item.type || '').trim() || '—'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, 8)
})
const proxyFormCanSave = computed(() => String(proxyForm.value.name || '').trim().length > 0 && String(proxyForm.value.type || '').trim().length > 0)
const proxyReferencesSummary = computed(() => {
  const entry = selectedProxyEntry.value
  if (!entry) return { groupRefs: [] as ProxyReferenceInfo[], ruleRefs: [] as ProxyReferenceInfo[] }
  return {
    groupRefs: entry.references.filter((item) => item.kind === 'group'),
    ruleRefs: entry.references.filter((item) => item.kind === 'rule'),
  }
})
const proxyDisablePlan = computed<ProxyDisableImpact>(() => {
  const name = String(selectedProxyEntry.value?.name || '').trim()
  if (!name) return { impacts: [], rulesTouched: 0, ruleSamples: [] }
  return simulateProxyDisableImpact(payload.value, name)
})
const parsedProxyProviders = computed<ParsedProxyProviderEntry[]>(() => parseProxyProvidersFromConfig(payload.value))
const selectedProxyProviderEntry = computed(() => parsedProxyProviders.value.find((item) => item.name === proxyProviderSelectedName.value) || null)
const proxyProviderFormCanSave = computed(() => String(proxyProviderForm.value.name || '').trim().length > 0)
const normalizedProxyProviderListFilter = computed(() => String(proxyProviderListQuery.value || '').trim().toLowerCase())
const filteredProxyProviders = computed(() => {
  const query = normalizedProxyProviderListFilter.value
  if (!query) return parsedProxyProviders.value
  return parsedProxyProviders.value.filter((item) => {
    const haystack = [
      item.name,
      item.type,
      item.url,
      item.path,
      item.filter,
      item.excludeFilter,
      item.interval,
      item.rawBlock,
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
})
const normalizedProxyProviderType = computed(() => String(proxyProviderForm.value.type || '').trim().toLowerCase())
const proxyProviderTypePresets = ['http', 'file', 'inline'] as const
const proxyProviderTypeProfile = computed(() => {
  switch (normalizedProxyProviderType.value) {
    case 'file':
      return {
        accent: 'badge-secondary',
        summary: t('configProxyProvidersTypeSummaryFile'),
      }
    case 'inline':
      return {
        accent: 'badge-accent',
        summary: t('configProxyProvidersTypeSummaryInline'),
      }
    default:
      return {
        accent: 'badge-info',
        summary: t('configProxyProvidersTypeSummaryHttp'),
      }
  }
})
const proxyProviderDisableImpact = computed<ProviderDisableImpact[]>(() => {
  const name = String(selectedProxyProviderEntry.value?.name || '').trim()
  if (!name) return []
  return simulateProxyProviderDisableImpact(payload.value, name)
})
const parsedProxyGroups = computed<ParsedProxyGroupEntry[]>(() => parseProxyGroupsFromConfig(payload.value))
const selectedProxyGroupEntry = computed(() => parsedProxyGroups.value.find((item) => item.name === proxyGroupSelectedName.value) || null)
const proxyGroupFormCanSave = computed(() => String(proxyGroupForm.value.name || '').trim().length > 0)
const proxyGroupDisablePlan = computed(() => {
  const name = String(selectedProxyGroupEntry.value?.name || '').trim()
  if (!name) return { impacts: [] as ProxyGroupDisableImpact[], rulesTouched: 0, ruleSamples: [] as ProxyGroupReferenceInfo[] }
  return simulateProxyGroupDisableImpact(payload.value, name)
})
const proxyGroupReferencesSummary = computed(() => {
  const entry = selectedProxyGroupEntry.value
  if (!entry) return { groupRefs: [] as ProxyGroupReferenceInfo[], ruleRefs: [] as ProxyGroupReferenceInfo[] }
  return {
    groupRefs: entry.references.filter((item) => item.kind === 'group'),
    ruleRefs: entry.references.filter((item) => item.kind === 'rule'),
  }
})

const splitFormList = (value: string) => String(value || '')
  .split(/\r?\n|,/)
  .map((item) => item.trim())
  .filter(Boolean)

const joinFormList = (items: string[]) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean))).join('\n')


type TemplateCardModel = { id: string; labelKey: string; descKey: string }

const makeUniqueName = (base: string, existing: string[]) => {
  const normalizedBase = String(base || '').trim() || 'item'
  const used = new Set(existing.map((item) => String(item || '').trim()).filter(Boolean))
  if (!used.has(normalizedBase)) return normalizedBase
  let counter = 2
  let candidate = `${normalizedBase}-${counter}`
  while (used.has(candidate)) {
    counter += 1
    candidate = `${normalizedBase}-${counter}`
  }
  return candidate
}

const slugifyTemplateValue = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item'

const proxyCreationTemplates: TemplateCardModel[] = [
  { id: 'vless-reality', labelKey: 'configProxiesTemplateVlessReality', descKey: 'configProxiesTemplateVlessRealityDesc' },
  { id: 'vless-ws-tls', labelKey: 'configProxiesTemplateVlessWsTls', descKey: 'configProxiesTemplateVlessWsTlsDesc' },
  { id: 'vmess-ws-tls', labelKey: 'configProxiesTemplateVmessWsTls', descKey: 'configProxiesTemplateVmessWsTlsDesc' },
  { id: 'trojan-grpc', labelKey: 'configProxiesTemplateTrojanGrpc', descKey: 'configProxiesTemplateTrojanGrpcDesc' },
  { id: 'trojan-tls', labelKey: 'configProxiesTemplateTrojanTls', descKey: 'configProxiesTemplateTrojanTlsDesc' },
  { id: 'wireguard-peer', labelKey: 'configProxiesTemplateWireguardPeer', descKey: 'configProxiesTemplateWireguardPeerDesc' },
  { id: 'hysteria2-basic', labelKey: 'configProxiesTemplateHysteria2Basic', descKey: 'configProxiesTemplateHysteria2BasicDesc' },
  { id: 'tuic-basic', labelKey: 'configProxiesTemplateTuicBasic', descKey: 'configProxiesTemplateTuicBasicDesc' },
]

const proxyProviderCreationTemplates: TemplateCardModel[] = [
  { id: 'remote-http', labelKey: 'configProxyProvidersTemplateRemoteHttp', descKey: 'configProxyProvidersTemplateRemoteHttpDesc' },
  { id: 'local-file', labelKey: 'configProxyProvidersTemplateLocalFile', descKey: 'configProxyProvidersTemplateLocalFileDesc' },
  { id: 'inline-source', labelKey: 'configProxyProvidersTemplateInlineSource', descKey: 'configProxyProvidersTemplateInlineSourceDesc' },
]

const proxyGroupCreationTemplates: TemplateCardModel[] = [
  { id: 'select', labelKey: 'configProxyGroupsTemplateSelect', descKey: 'configProxyGroupsTemplateSelectDesc' },
  { id: 'url-test', labelKey: 'configProxyGroupsTemplateUrlTest', descKey: 'configProxyGroupsTemplateUrlTestDesc' },
  { id: 'fallback', labelKey: 'configProxyGroupsTemplateFallback', descKey: 'configProxyGroupsTemplateFallbackDesc' },
  { id: 'load-balance', labelKey: 'configProxyGroupsTemplateLoadBalance', descKey: 'configProxyGroupsTemplateLoadBalanceDesc' },
  { id: 'relay', labelKey: 'configProxyGroupsTemplateRelay', descKey: 'configProxyGroupsTemplateRelayDesc' },
]

const ruleProviderCreationTemplates: TemplateCardModel[] = [
  { id: 'classical-remote', labelKey: 'configRuleProvidersTemplateClassicalRemote', descKey: 'configRuleProvidersTemplateClassicalRemoteDesc' },
  { id: 'domain-remote', labelKey: 'configRuleProvidersTemplateDomainRemote', descKey: 'configRuleProvidersTemplateDomainRemoteDesc' },
  { id: 'ipcidr-remote', labelKey: 'configRuleProvidersTemplateIpcidrRemote', descKey: 'configRuleProvidersTemplateIpcidrRemoteDesc' },
]

type CreationWizardStep = 1 | 2 | 3

type ProxyCreationWizardModel = {
  active: boolean
  step: CreationWizardStep
  templateId: string
  type: string
  name: string
  server: string
  port: string
  network: string
  tls: string
  servername: string
  clientFingerprint: string
  uuid: string
  password: string
  cipher: string
  flow: string
  wsPath: string
  grpcServiceName: string
  realityPublicKey: string
  realityShortId: string
  wireguardIpText: string
  wireguardPrivateKey: string
  wireguardPublicKey: string
  wireguardMtu: string
  hysteriaObfs: string
  hysteriaObfsPassword: string
  tuicCongestionController: string
  tuicUdpRelayMode: string
  tuicHeartbeatInterval: string
}

type ProxyProviderCreationWizardModel = {
  active: boolean
  step: CreationWizardStep
  templateId: string
  name: string
  type: string
  url: string
  path: string
  interval: string
}

type ProxyGroupCreationWizardModel = {
  active: boolean
  step: CreationWizardStep
  templateId: string
  name: string
  type: string
  membersText: string
  providersText: string
  url: string
  interval: string
}

type RuleProviderCreationWizardModel = {
  active: boolean
  step: CreationWizardStep
  templateId: string
  name: string
  behavior: string
  url: string
  path: string
  interval: string
}

const emptyProxyCreationWizard = (): ProxyCreationWizardModel => ({
  active: false,
  step: 1,
  templateId: '',
  type: '',
  name: '',
  server: '',
  port: '',
  network: '',
  tls: '',
  servername: '',
  clientFingerprint: '',
  uuid: '',
  password: '',
  cipher: '',
  flow: '',
  wsPath: '',
  grpcServiceName: '',
  realityPublicKey: '',
  realityShortId: '',
  wireguardIpText: '',
  wireguardPrivateKey: '',
  wireguardPublicKey: '',
  wireguardMtu: '',
  hysteriaObfs: '',
  hysteriaObfsPassword: '',
  tuicCongestionController: '',
  tuicUdpRelayMode: '',
  tuicHeartbeatInterval: '',
})

const emptyProxyProviderCreationWizard = (): ProxyProviderCreationWizardModel => ({
  active: false,
  step: 1,
  templateId: '',
  name: '',
  type: '',
  url: '',
  path: '',
  interval: '',
})

const emptyProxyGroupCreationWizard = (): ProxyGroupCreationWizardModel => ({
  active: false,
  step: 1,
  templateId: '',
  name: '',
  type: '',
  membersText: '',
  providersText: '',
  url: '',
  interval: '',
})

const emptyRuleProviderCreationWizard = (): RuleProviderCreationWizardModel => ({
  active: false,
  step: 1,
  templateId: '',
  name: '',
  behavior: '',
  url: '',
  path: '',
  interval: '',
})

const proxyCreationWizard = ref<ProxyCreationWizardModel>(emptyProxyCreationWizard())
const proxyProviderCreationWizard = ref<ProxyProviderCreationWizardModel>(emptyProxyProviderCreationWizard())
const proxyGroupCreationWizard = ref<ProxyGroupCreationWizardModel>(emptyProxyGroupCreationWizard())
const ruleProviderCreationWizard = ref<RuleProviderCreationWizardModel>(emptyRuleProviderCreationWizard())

const normalizedProxyCreationWizardType = computed(() => String(proxyCreationWizard.value.type || '').trim().toLowerCase())
const proxyCreationWizardVisibility = computed(() => {
  const type = normalizedProxyCreationWizardType.value
  const network = String(proxyCreationWizard.value.network || '').trim().toLowerCase()
  return {
    transport: ['vmess', 'vless', 'trojan'].includes(type),
    security: ['vmess', 'vless', 'trojan', 'hysteria2', 'tuic'].includes(type),
    uuid: ['vmess', 'vless', 'tuic'].includes(type),
    password: ['ss', 'trojan', 'hysteria2', 'tuic'].includes(type),
    cipher: ['ss', 'vmess'].includes(type),
    flow: type === 'vless',
    reality: type === 'vless',
    wsPath: ['vmess', 'vless', 'trojan'].includes(type) && network === 'ws',
    grpcServiceName: ['vmess', 'vless', 'trojan'].includes(type) && network === 'grpc',
    wireguard: type === 'wireguard',
    hysteria2: type === 'hysteria2',
    tuic: type === 'tuic',
  }
})
const proxyCreationWizardTypeSummary = computed(() => {
  switch (normalizedProxyCreationWizardType.value) {
    case 'ss': return t('configProxiesTypeSummarySs')
    case 'vmess': return t('configProxiesTypeSummaryVmess')
    case 'vless': return t('configProxiesTypeSummaryVless')
    case 'trojan': return t('configProxiesTypeSummaryTrojan')
    case 'wireguard': return t('configProxiesTypeSummaryWireguard')
    case 'hysteria2': return t('configProxiesTypeSummaryHysteria2')
    case 'tuic': return t('configProxiesTypeSummaryTuic')
    default: return t('configProxiesTypeSummaryDefault')
  }
})
const proxyCreationWizardFocusBadges = computed(() => {
  const out: string[] = []
  const visibility = proxyCreationWizardVisibility.value
  if (visibility.security) out.push(t('configProxiesSecurityTitle'))
  if (visibility.uuid || visibility.password || visibility.cipher || visibility.flow || visibility.wireguard) out.push(t('configProxiesAuthTitle'))
  if (visibility.transport || visibility.wsPath || visibility.grpcServiceName) out.push(t('configProxiesTransportTitle'))
  if (visibility.reality) out.push('reality')
  if (visibility.wireguard) out.push(t('configProxiesWireguardTitle'))
  if (visibility.hysteria2) out.push('hysteria2')
  if (visibility.tuic) out.push('tuic')
  return Array.from(new Set(out))
})

const activeProxyCreationWizardTemplate = computed(() => proxyCreationTemplates.find((item) => item.id === proxyCreationWizard.value.templateId) || null)
const proxyCreationWizardScenarioBadges = computed(() => {
  switch (proxyCreationWizard.value.templateId) {
    case 'vless-reality':
      return ['Reality', 'TLS', 'Vision', 'uuid']
    case 'vless-ws-tls':
      return ['WS', 'TLS', 'uuid', 'path']
    case 'vmess-ws-tls':
      return ['WS', 'TLS', 'uuid', 'vmess']
    case 'trojan-grpc':
      return ['gRPC', 'TLS', 'password']
    case 'trojan-tls':
      return ['TLS', 'password']
    case 'wireguard-peer':
    case 'wireguard-basic':
      return ['WireGuard', 'peer', 'keys', 'IP']
    case 'hysteria2-basic':
      return ['UDP', 'TLS', 'obfs']
    case 'tuic-basic':
      return ['UDP', 'TLS', 'uuid', 'password']
    default:
      return proxyCreationWizardFocusBadges.value
  }
})
const proxyCreationWizardScenarioSummary = computed(() => {
  const template = activeProxyCreationWizardTemplate.value
  return template ? t(template.descKey) : t('configProxiesWizardTip')
})
const proxyCreationWizardRequiredFields = computed(() => {
  const state = proxyCreationWizard.value
  const text = (value: string) => String(value || '').trim()
  const fields = [
    { label: t('configProxiesFieldName'), ok: Boolean(text(state.name)) },
    { label: t('configProxiesFieldServer'), ok: Boolean(text(state.server)) },
    { label: t('configProxiesFieldPort'), ok: Boolean(text(state.port)) },
  ]
  switch (state.templateId) {
    case 'vless-reality':
      fields.push(
        { label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) },
        { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) },
        { label: t('configProxiesFieldRealityPublicKey'), ok: Boolean(text(state.realityPublicKey)) },
        { label: t('configProxiesFieldFlow'), ok: Boolean(text(state.flow)) },
      )
      break
    case 'vless-ws-tls':
    case 'vmess-ws-tls':
      fields.push(
        { label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) },
        { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) },
        { label: t('configProxiesFieldWsPath'), ok: Boolean(text(state.wsPath)) },
      )
      break
    case 'trojan-grpc':
      fields.push(
        { label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) },
        { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) },
        { label: t('configProxiesFieldGrpcServiceName'), ok: Boolean(text(state.grpcServiceName)) },
      )
      break
    case 'trojan-tls':
    case 'hysteria2-basic':
      fields.push(
        { label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) },
        { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) },
      )
      break
    case 'wireguard-peer':
    case 'wireguard-basic':
      fields.push(
        { label: t('configProxiesFieldWireguardIp'), ok: Boolean(text(state.wireguardIpText)) },
        { label: t('configProxiesFieldWireguardPrivateKey'), ok: Boolean(text(state.wireguardPrivateKey)) },
        { label: t('configProxiesFieldWireguardPublicKey'), ok: Boolean(text(state.wireguardPublicKey)) },
      )
      break
    case 'tuic-basic':
      fields.push(
        { label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) },
        { label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) },
        { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) },
      )
      break
    default:
      break
  }
  return fields
})
const proxyCreationWizardMissingFieldLabels = computed(() => proxyCreationWizardRequiredFields.value.filter((item) => !item.ok).map((item) => item.label))
const proxyCreationWizardCanProceed = computed(() => proxyCreationWizardMissingFieldLabels.value.length === 0)
const proxyCreationWizardTransportSummary = computed(() => {
  const parts: string[] = []
  const type = normalizedProxyCreationWizardType.value
  if (String(proxyCreationWizard.value.network || '').trim()) parts.push(String(proxyCreationWizard.value.network || '').trim())
  if (String(proxyCreationWizard.value.wsPath || '').trim()) parts.push(`ws:${String(proxyCreationWizard.value.wsPath || '').trim()}`)
  if (String(proxyCreationWizard.value.grpcServiceName || '').trim()) parts.push(`grpc:${String(proxyCreationWizard.value.grpcServiceName || '').trim()}`)
  if (String(proxyCreationWizard.value.tls || '').trim()) parts.push(`TLS=${String(proxyCreationWizard.value.tls || '').trim()}`)
  if (type === 'wireguard' && String(proxyCreationWizard.value.wireguardMtu || '').trim()) parts.push(`mtu=${String(proxyCreationWizard.value.wireguardMtu || '').trim()}`)
  if (type === 'tuic' && String(proxyCreationWizard.value.tuicUdpRelayMode || '').trim()) parts.push(`udp=${String(proxyCreationWizard.value.tuicUdpRelayMode || '').trim()}`)
  return parts.length ? parts.join(' · ') : '—'
})
const proxyCreationWizardAuthSummary = computed(() => {
  const parts: string[] = []
  if (String(proxyCreationWizard.value.uuid || '').trim()) parts.push(`uuid:${String(proxyCreationWizard.value.uuid || '').trim()}`)
  if (String(proxyCreationWizard.value.password || '').trim()) parts.push(`password:${String(proxyCreationWizard.value.password || '').trim()}`)
  if (String(proxyCreationWizard.value.cipher || '').trim()) parts.push(`cipher:${String(proxyCreationWizard.value.cipher || '').trim()}`)
  if (String(proxyCreationWizard.value.flow || '').trim()) parts.push(`flow:${String(proxyCreationWizard.value.flow || '').trim()}`)
  if (normalizedProxyCreationWizardType.value === 'wireguard') {
    if (String(proxyCreationWizard.value.wireguardIpText || '').trim()) parts.push(`ip:${String(proxyCreationWizard.value.wireguardIpText || '').trim()}`)
    if (String(proxyCreationWizard.value.wireguardPublicKey || '').trim()) parts.push('public-key')
    if (String(proxyCreationWizard.value.wireguardPrivateKey || '').trim()) parts.push('private-key')
  }
  return parts.length ? parts.join(' · ') : '—'
})

const buildPreferredGroupMembers = (limit = 3) => {
  const fromProxies = parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const fromGroups = parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const unique = Array.from(new Set([...fromProxies, ...fromGroups]))
  return unique.slice(0, Math.max(1, limit))
}

const buildProviderRefs = (limit = 2) => Array.from(new Set(parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean))).slice(0, limit)

const toggleProxyGroupListValue = (field: 'proxiesText' | 'useText' | 'providersText', item: string) => {
  const normalized = String(item || '').trim()
  if (!normalized) return
  const current = splitFormList(proxyGroupForm.value[field])
  const next = current.includes(normalized)
    ? current.filter((entry) => entry !== normalized)
    : [...current, normalized]
  proxyGroupForm.value[field] = joinFormList(next)
}

const setRulePayloadSuggestion = (value: string) => {
  const normalized = String(value || '').trim()
  if (!normalized) return
  ruleForm.value.payload = normalized
  syncRuleRawFromStructuredForm()
}

const setRuleTargetSuggestion = (value: string) => {
  const normalized = String(value || '').trim()
  if (!normalized) return
  ruleForm.value.target = normalized
  syncRuleRawFromStructuredForm()
}

const appendRuleParamSuggestion = (value: string) => {
  const normalized = String(value || '').trim()
  if (!normalized) return
  const current = splitFormList(ruleForm.value.paramsText)
  if (!current.includes(normalized)) ruleForm.value.paramsText = joinFormList([...current, normalized])
  syncRuleRawFromStructuredForm()
}

const normalizedProxyGroupType = computed(() => String(proxyGroupForm.value.type || '').trim().toLowerCase())
const proxyGroupTypePresets = [
  'select',
  'url-test',
  'fallback',
  'load-balance',
  'relay',
] as const
const proxyGroupTypeProfile = computed(() => {
  switch (normalizedProxyGroupType.value) {
    case 'url-test':
      return {
        accent: 'badge-info',
        summary: t('configProxyGroupsTypeAwareSummaryUrlTest'),
        fields: ['url', 'interval', 'tolerance'],
      }
    case 'fallback':
      return {
        accent: 'badge-warning',
        summary: t('configProxyGroupsTypeAwareSummaryFallback'),
        fields: ['url', 'interval'],
      }
    case 'load-balance':
      return {
        accent: 'badge-secondary',
        summary: t('configProxyGroupsTypeAwareSummaryLoadBalance'),
        fields: ['strategy', 'url', 'interval', 'tolerance'],
      }
    case 'relay':
      return {
        accent: 'badge-accent',
        summary: t('configProxyGroupsTypeAwareSummaryRelay'),
        fields: ['proxies'],
      }
    default:
      return {
        accent: 'badge-success',
        summary: t('configProxyGroupsTypeAwareSummarySelect'),
        fields: ['proxies'],
      }
  }
})
const proxyGroupSelectedLists = computed(() => ({
  proxies: splitFormList(proxyGroupForm.value.proxiesText),
  use: splitFormList(proxyGroupForm.value.useText),
  providers: splitFormList(proxyGroupForm.value.providersText),
}))
const proxyGroupAvailableProxyMembers = computed(() => Array.from(new Set([
  'DIRECT',
  'REJECT',
  'REJECT-DROP',
  ...parsedProxyGroups.value
    .map((item) => String(item.name || '').trim())
    .filter((name) => name && name !== String(proxyGroupForm.value.name || '').trim()),
  ...parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean),
])).filter(Boolean))
const proxyGroupAvailableProviderRefs = computed(() => Array.from(new Set(parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean))))
const proxyGroupSuggestedProxyMembers = computed(() => proxyGroupAvailableProxyMembers.value.filter((item) => !proxyGroupSelectedLists.value.proxies.includes(item)).slice(0, 24))
const proxyGroupSuggestedUseMembers = computed(() => proxyGroupAvailableProviderRefs.value.filter((item) => !proxyGroupSelectedLists.value.use.includes(item)).slice(0, 16))
const proxyGroupSuggestedProviderMembers = computed(() => proxyGroupAvailableProviderRefs.value.filter((item) => !proxyGroupSelectedLists.value.providers.includes(item)).slice(0, 16))

const applyProxyGroupTypePreset = (type: typeof proxyGroupTypePresets[number]) => {
  proxyGroupForm.value.type = type
  if (['url-test', 'fallback', 'load-balance'].includes(type) && !String(proxyGroupForm.value.url || '').trim().length) proxyGroupForm.value.url = 'http://www.gstatic.com/generate_204'
  if (['url-test', 'fallback', 'load-balance'].includes(type) && !String(proxyGroupForm.value.interval || '').trim().length) proxyGroupForm.value.interval = '300'
  if (type === 'load-balance' && !String(proxyGroupForm.value.strategy || '').trim().length) proxyGroupForm.value.strategy = 'consistent-hashing'
  if (type === 'url-test' && !String(proxyGroupForm.value.tolerance || '').trim().length) proxyGroupForm.value.tolerance = '50'
  if (type === 'relay' && !proxyGroupSelectedLists.value.proxies.length) proxyGroupForm.value.proxiesText = joinFormList(['DIRECT'])
  showNotification({ content: 'configProxyGroupsTypePresetAppliedToast', type: 'alert-success' })
}

const parsedRuleProviders = computed<ParsedRuleProviderEntry[]>(() => parseRuleProvidersFromConfig(payload.value))
const selectedRuleProviderEntry = computed(() => parsedRuleProviders.value.find((item) => item.name === ruleProviderSelectedName.value) || null)
const ruleProviderFormCanSave = computed(() => String(ruleProviderForm.value.name || '').trim().length > 0)
const normalizedRuleProviderListFilter = computed(() => String(ruleProviderListQuery.value || '').trim().toLowerCase())
const filteredRuleProviders = computed(() => {
  const query = normalizedRuleProviderListFilter.value
  if (!query) return parsedRuleProviders.value
  return parsedRuleProviders.value.filter((item) => {
    const haystack = [
      item.name,
      item.type,
      item.behavior,
      item.format,
      item.url,
      item.path,
      item.interval,
      item.rawBlock,
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
})
const normalizedRuleProviderBehavior = computed(() => String(ruleProviderForm.value.behavior || '').trim().toLowerCase())
const ruleProviderBehaviorPresets = ['classical', 'domain', 'ipcidr'] as const
const ruleProviderBehaviorProfile = computed(() => {
  switch (normalizedRuleProviderBehavior.value) {
    case 'domain':
      return {
        accent: 'badge-info',
        summary: t('configRuleProvidersBehaviorSummaryDomain'),
      }
    case 'ipcidr':
      return {
        accent: 'badge-warning',
        summary: t('configRuleProvidersBehaviorSummaryIpcidr'),
      }
    default:
      return {
        accent: 'badge-success',
        summary: t('configRuleProvidersBehaviorSummaryClassical'),
      }
  }
})
const ruleProviderDisableImpact = computed<RuleProviderDisableImpact>(() => {
  const name = String(selectedRuleProviderEntry.value?.name || '').trim()
  if (!name) return { rulesRemoved: 0, samples: [] }
  return simulateRuleProviderDisableImpact(payload.value, name)
})
const parsedRules = computed<ParsedRuleEntry[]>(() => parseRulesFromConfig(payload.value))
const selectedRuleEntry = computed(() => parsedRules.value.find((item) => String(item.index) == String(ruleSelectedIndex.value)) || null)
const ruleFormCanSave = computed(() => String(ruleForm.value.raw || '').trim().length > 0)
const normalizedRuleType = computed(() => String(ruleForm.value.type || '').trim().toUpperCase())
const normalizedRuleListFilter = computed(() => String(ruleListQuery.value || '').trim().toUpperCase())
const ruleTargetSuggestions = computed(() => Array.from(new Set([
  'DIRECT',
  'REJECT',
  'REJECT-DROP',
  'GLOBAL',
  ...parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean),
  ...parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean),
  ...parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean),
])).filter(Boolean))
const rulePayloadSuggestions = computed(() => {
  const type = normalizedRuleType.value
  const dynamic = new Set<string>()
  if (type === 'RULE-SET') {
    parsedRuleProviders.value.forEach((item) => {
      const name = String(item.name || '').trim()
      if (name) dynamic.add(name)
    })
  } else if (type === 'GEOIP') {
    ;['CN', 'RU', 'PRIVATE', 'LAN'].forEach((item) => dynamic.add(item))
  } else if (type === 'GEOSITE') {
    ;['category-ads-all', 'cn', 'private', 'geolocation-!cn'].forEach((item) => dynamic.add(item))
  } else if (type === 'NETWORK') {
    ;['tcp', 'udp', 'tcp,udp'].forEach((item) => dynamic.add(item))
  }
  const current = String(ruleForm.value.payload || '').trim()
  if (current) dynamic.add(current)
  return Array.from(dynamic)
})
const filteredRules = computed(() => {
  const query = String(ruleListQuery.value || '').trim().toLowerCase()
  if (!query) return parsedRules.value
  const parts = query.split(/\s+/).filter(Boolean)
  if (!parts.length) return parsedRules.value
  return parsedRules.value.filter((item) => {
    const haystack = [item.raw, item.type, item.payload, item.target, item.provider, String(item.lineNo)].join(' ').toLowerCase()
    return parts.every((part) => haystack.includes(part))
  })
})
const topRuleTypeCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const item of parsedRules.value) {
    const key = String(item.type || '').trim().toUpperCase() || '—'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, 8)
})
const preferredRuleTarget = computed(() => String(ruleForm.value.target || '').trim() || parsedProxyGroups.value[0]?.name || 'DIRECT')
const rulePayloadPlaceholder = computed(() => {
  switch (normalizedRuleType.value) {
    case 'RULE-SET':
      return parsedRuleProviders.value[0]?.name || 'social-media'
    case 'DOMAIN':
    case 'DOMAIN-SUFFIX':
      return 'example.com'
    case 'DOMAIN-KEYWORD':
      return 'google'
    case 'GEOIP':
      return 'CN'
    case 'GEOSITE':
      return 'category-ads-all'
    case 'IP-CIDR':
      return '1.1.1.0/24'
    case 'IP-CIDR6':
      return '2001:db8::/32'
    case 'SRC-IP-CIDR':
      return '192.168.0.0/16'
    case 'SRC-PORT':
      return '443'
    case 'DST-PORT':
      return '53'
    case 'NETWORK':
      return 'tcp'
    case 'PROCESS-NAME':
      return 'curl.exe'
    case 'PROCESS-PATH':
      return '/usr/bin/curl'
    default:
      return t('configRulesFieldPayloadPlaceholder')
  }
})
const ruleTargetPlaceholder = computed(() => preferredRuleTarget.value || t('configRulesFieldTargetPlaceholder'))
const ruleQuickTargets = computed(() => ruleTargetSuggestions.value.slice(0, 18))
const ruleQuickPayloads = computed(() => rulePayloadSuggestions.value.slice(0, 12))
const ruleQuickParams = computed(() => {
  const type = normalizedRuleType.value
  const suggestions = new Set<string>()
  if (['RULE-SET', 'GEOIP', 'IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR'].includes(type)) suggestions.add('no-resolve')
  if (type === 'NETWORK') {
    suggestions.add('tcp')
    suggestions.add('udp')
  }
  splitFormList(ruleForm.value.paramsText).forEach((item) => suggestions.add(item))
  return Array.from(suggestions).filter(Boolean).slice(0, 10)
})
const ruleFormParamsCount = computed(() => {
  const count = String(ruleForm.value.paramsText || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).length
  return `params: ${count}`
})
const ruleFormHints = computed(() => {
  const hints: string[] = []
  const type = normalizedRuleType.value
  const payload = String(ruleForm.value.payload || '').trim()
  const target = String(ruleForm.value.target || '').trim()
  if (!type) hints.push(t('configRulesHintTypeMissing'))
  if (type && !['MATCH', 'FINAL'].includes(type) && !payload) hints.push(t('configRulesHintPayloadMissing'))
  if (!target) hints.push(t('configRulesHintTargetMissing'))
  if (type === 'RULE-SET' && payload) {
    const hasProvider = parsedRuleProviders.value.some((item) => String(item.name || '').trim().toLowerCase() === payload.toLowerCase())
    if (!hasProvider) hints.push(t('configRulesHintMissingProvider', { name: payload }))
  }
  if (target) {
    const knownTarget = ruleTargetSuggestions.value.some((item) => item.toLowerCase() === target.toLowerCase())
    if (!knownTarget) hints.push(t('configRulesHintCustomTarget', { name: target }))
  }
  return Array.from(new Set(hints))
})

const previewGroupLabel = (group: QuickEditorGroup) => {
  switch (group) {
    case 'runtime':
      return t('configQuickEditorGroupRuntime')
    case 'network':
      return t('configQuickEditorGroupNetwork')
    case 'controller':
      return t('configQuickEditorGroupController')
    case 'ports':
      return t('configQuickEditorGroupPorts')
    case 'tun':
      return t('configQuickEditorGroupTun')
    case 'dns':
      return t('configQuickEditorGroupDns')
    default:
      return '—'
  }
}

const previewFieldLabel = (key: QuickEditorFieldKey) => {
  switch (key) {
    case 'mode':
      return t('configOverviewMode')
    case 'logLevel':
      return t('configOverviewLogLevel')
    case 'allowLan':
      return t('configOverviewAllowLan')
    case 'ipv6':
      return t('configOverviewIpv6')
    case 'unifiedDelay':
      return t('configOverviewUnifiedDelay')
    case 'findProcessMode':
      return t('configOverviewFindProcessMode')
    case 'geodataMode':
      return t('configOverviewGeodataMode')
    case 'controller':
      return t('configOverviewController')
    case 'secret':
      return t('configQuickEditorSecret')
    case 'mixedPort':
      return t('configOverviewMixedPort')
    case 'port':
      return t('configOverviewPort')
    case 'socksPort':
      return t('configOverviewSocksPort')
    case 'redirPort':
      return t('configOverviewRedirPort')
    case 'tproxyPort':
      return t('configOverviewTproxyPort')
    case 'tunEnable':
      return t('configQuickEditorTunEnable')
    case 'tunStack':
      return t('configQuickEditorTunStack')
    case 'tunAutoRoute':
      return t('configQuickEditorTunAutoRoute')
    case 'tunAutoDetectInterface':
      return t('configQuickEditorTunAutoDetectInterface')
    case 'dnsEnable':
      return t('configQuickEditorDnsEnable')
    case 'dnsIpv6':
      return t('configQuickEditorDnsIpv6')
    case 'dnsListen':
      return t('configQuickEditorDnsListen')
    case 'dnsEnhancedMode':
      return t('configQuickEditorDnsEnhancedMode')
    default:
      return String(key)
  }
}

const previewChangeTypeText = (changeType: QuickEditorChangeType) => {
  switch (changeType) {
    case 'add':
      return t('configQuickEditorPreviewAddAction')
    case 'remove':
      return t('configQuickEditorPreviewRemoveAction')
    default:
      return t('configQuickEditorPreviewChangeAction')
  }
}

const previewChangeBadgeClass = (changeType: QuickEditorChangeType) => {
  switch (changeType) {
    case 'add':
      return 'badge-success'
    case 'remove':
      return 'badge-error'
    default:
      return 'badge-warning'
  }
}

const previewValueText = (value?: string | number | null) => {
  const text = String(value ?? '').trim()
  return text || t('configQuickEditorPreviewEmptyValue')
}

const overviewText = (value?: string | number | null) => {
  const text = String(value ?? '').trim()
  return text || '—'
}

const overviewBoolText = (value?: string | number | null) => {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return '—'
  if (['true', 'on', 'yes'].includes(text)) return t('enabled')
  if (['false', 'off', 'no'].includes(text)) return t('disabled')
  return String(value ?? '')
}

const sectionStateText = (value: ConfigOverviewSectionState) => {
  switch (value) {
    case 'enabled':
      return t('enabled')
    case 'disabled':
      return t('disabled')
    case 'present':
      return t('configOverviewPresent')
    default:
      return t('configOverviewMissing')
  }
}

const sectionStateBadgeClass = (value: ConfigOverviewSectionState) => {
  switch (value) {
    case 'enabled':
      return 'badge-success'
    case 'disabled':
      return 'badge-error'
    case 'present':
      return 'badge-ghost'
    default:
      return 'badge-neutral'
  }
}

const compareLeftResolved = computed<DiffSourceKind>(() => normalizeDiffSource(compareLeft.value as DiffSourceKind))
const compareRightResolved = computed<DiffSourceKind>(() => normalizeDiffSource(compareRight.value as DiffSourceKind))

const diffSourceContent = (kind: DiffSourceKind) => {
  if (kind === 'editor') return String(payload.value || '')
  if (kind === 'last-success') return String(lastSuccessfulPayload.value || '')
  return String(managedPayloads.value[kind as ManagedPayloadKind] || '')
}

const normalizeDiffText = (value: string) => String(value || '').replace(/\r\n/g, '\n')

const escapeRegExp = (value: string) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getTopLevelScalarValue = (value: string, key: string) => {
  const normalized = normalizeDiffText(value)
  const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`, 'm')
  const match = normalized.match(re)
  if (!match) return ''
  return sanitizeScalarValue(match[1] || '')
}

const getNestedScalarValue = (value: string, section: string, key: string) => {
  const normalized = normalizeDiffText(value)
  if (!normalized.trim().length) return ''
  const lines = normalized.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line))
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] || ''
    if (!line.trim().length || /^\s*#/.test(line)) continue
    if (!/^\s/.test(line)) {
      end = i
      break
    }
  }
  const re = new RegExp(`^\\s+${escapeRegExp(key)}:\\s*(.*?)\\s*$`)
  for (let i = start + 1; i < end; i += 1) {
    const match = (lines[i] || '').match(re)
    if (match) return sanitizeScalarValue(match[1] || '')
  }
  return ''
}

type QuickEditorFieldMetaWithYaml = QuickEditorFieldMeta & { yamlKey: string }
type QuickEditorFieldMetaWithNested = QuickEditorFieldMeta & { section: 'tun' | 'dns'; nestedKey: string }

const isTopLevelQuickEditorField = (field: QuickEditorFieldMeta): field is QuickEditorFieldMetaWithYaml => Boolean(field.yamlKey)
const isNestedQuickEditorField = (field: QuickEditorFieldMeta): field is QuickEditorFieldMetaWithNested => Boolean(field.section && field.nestedKey)

const getQuickEditorFieldValue = (source: string, field: QuickEditorFieldMeta) => {
  if (field.yamlKey) return getTopLevelScalarValue(source, field.yamlKey)
  if (field.section && field.nestedKey) return getNestedScalarValue(source, field.section, field.nestedKey)
  return ''
}

const syncQuickEditorFromPayload = () => {
  const source = normalizeDiffText(payload.value)
  const next = emptyQuickEditorModel()
  for (const field of quickEditorFieldMeta) {
    next[field.key] = getQuickEditorFieldValue(source, field)
  }
  quickEditor.value = next
}

const upsertTopLevelInlineScalars = (value: string, entries: Array<[string, string]>) => {
  const normalized = normalizeDiffText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const findLineIndex = (key: string) => lines.findIndex((line) => new RegExp(`^${escapeRegExp(key)}:\\s*.*$`).test(line))

  for (const [key, rawValue] of entries) {
    const cleaned = String(rawValue || '').trim()
    const idx = findLineIndex(key)
    if (!cleaned.length) {
      if (idx >= 0) lines.splice(idx, 1)
      continue
    }
    const nextLine = `${key}: ${cleaned}`
    if (idx >= 0) lines[idx] = nextLine
  }

  const pending = entries
    .filter(([key, rawValue]) => String(rawValue || '').trim().length > 0 && findLineIndex(key) < 0)
    .map(([key, rawValue]) => `${key}: ${String(rawValue || '').trim()}`)

  if (pending.length) {
    let insertAt = 0
    while (insertAt < lines.length && (!lines[insertAt]?.trim().length || /^\s*#/.test(lines[insertAt] || ''))) insertAt += 1
    lines.splice(insertAt, 0, ...pending)
  }

  const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  return joined ? `${joined}\n` : ''
}

const upsertNestedInlineScalars = (value: string, section: 'tun' | 'dns', entries: Array<[string, string]>) => {
  const normalized = normalizeDiffText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const findSectionIndex = () => lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line))
  const findSectionEnd = (start: number) => {
    let end = lines.length
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i] || ''
      if (!line.trim().length || /^\s*#/.test(line)) continue
      if (!/^\s/.test(line)) {
        end = i
        break
      }
    }
    return end
  }
  const hasAnyValue = entries.some(([, rawValue]) => String(rawValue || '').trim().length > 0)
  const sectionStart = findSectionIndex()

  if (sectionStart < 0) {
    if (!hasAnyValue) return normalized
    const preferredAnchors = ['proxies', 'proxy-groups', 'proxy-providers', 'rule-providers', 'rules']
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(line)))
    if (insertAt < 0) {
      insertAt = lines.length
      while (insertAt > 0 && !String(lines[insertAt - 1] || '').trim().length) insertAt -= 1
    }
    const block = [
      section + ':',
      ...entries.filter(([, rawValue]) => String(rawValue || '').trim().length > 0).map(([key, rawValue]) => `  ${key}: ${String(rawValue || '').trim()}`),
    ]
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length) block.unshift('')
    lines.splice(insertAt, 0, ...block)
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  }

  let sectionEnd = findSectionEnd(sectionStart)
  const findNestedLineIndex = (key: string) => {
    for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
      if (new RegExp(`^\\s+${escapeRegExp(key)}:\\s*.*$`).test(lines[i] || '')) return i
    }
    return -1
  }

  for (const [key, rawValue] of entries) {
    const cleaned = String(rawValue || '').trim()
    const idx = findNestedLineIndex(key)
    if (!cleaned.length) {
      if (idx >= 0) {
        lines.splice(idx, 1)
        sectionEnd -= 1
      }
      continue
    }
    const nextLine = `  ${key}: ${cleaned}`
    if (idx >= 0) lines[idx] = nextLine
    else {
      lines.splice(sectionEnd, 0, nextLine)
      sectionEnd += 1
    }
  }

  const meaningful = lines.slice(sectionStart + 1, sectionEnd).some((line) => {
    const trimmed = String(line || '').trim()
    return trimmed.length > 0 && !trimmed.startsWith('#')
  })
  if (!meaningful) {
    let removeFrom = sectionStart
    if (removeFrom > 0 && !String(lines[removeFrom - 1] || '').trim().length) removeFrom -= 1
    lines.splice(removeFrom, sectionEnd - removeFrom)
  }

  const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  return joined ? `${joined}\n` : ''
}

const applyQuickEditorToPayload = () => {
  if (!quickEditorCanApply.value) {
    showNotification({ content: 'configQuickEditorEmptyToast', type: 'alert-warning' })
    return
  }

  const topLevelEntries = quickEditorFieldMeta
    .filter(isTopLevelQuickEditorField)
    .map((field) => [field.yamlKey, quickEditor.value[field.key]] as [string, string])
  const tunEntries = quickEditorFieldMeta
    .filter((field): field is QuickEditorFieldMetaWithNested => isNestedQuickEditorField(field) && field.section === 'tun')
    .map((field) => [field.nestedKey, quickEditor.value[field.key]] as [string, string])
  const dnsEntries = quickEditorFieldMeta
    .filter((field): field is QuickEditorFieldMetaWithNested => isNestedQuickEditorField(field) && field.section === 'dns')
    .map((field) => [field.nestedKey, quickEditor.value[field.key]] as [string, string])

  let nextPayload = upsertTopLevelInlineScalars(payload.value, topLevelEntries)
  nextPayload = upsertNestedInlineScalars(nextPayload, 'tun', tunEntries)
  nextPayload = upsertNestedInlineScalars(nextPayload, 'dns', dnsEntries)
  payload.value = nextPayload

  showNotification({ content: 'configQuickEditorAppliedToast', type: 'alert-success' })
}

const syncAdvancedSectionsFromPayload = () => {
  advancedSectionsForm.value = advancedSectionsFormFromConfig(payload.value)
}

const applyAdvancedSectionsToPayload = () => {
  if (!quickEditorHasPayload.value) {
    showNotification({ content: 'configAdvancedSectionsEmptyEditor', type: 'alert-warning' })
    return
  }
  if (!advancedSectionsCanApply.value) {
    showNotification({ content: 'configAdvancedSectionsNoChangesToast', type: 'alert-warning' })
    return
  }
  payload.value = advancedSectionsAppliedPreview.value
  advancedSectionsForm.value = advancedSectionsFormFromConfig(payload.value)
  showNotification({ content: 'configAdvancedSectionsAppliedToast', type: 'alert-success' })
}

const syncDnsEditorFromPayload = () => {
  dnsEditorForm.value = dnsEditorFormFromConfig(payload.value)
}

const applyDnsEditorToPayload = () => {
  if (!quickEditorHasPayload.value) {
    showNotification({ content: 'configDnsStructuredEmptyEditor', type: 'alert-warning' })
    return
  }
  if (!dnsEditorCanApply.value) {
    showNotification({ content: 'configDnsStructuredNoChangesToast', type: 'alert-warning' })
    return
  }
  payload.value = dnsEditorAppliedPreview.value
  dnsEditorForm.value = dnsEditorFormFromConfig(payload.value)
  showNotification({ content: 'configDnsStructuredAppliedToast', type: 'alert-success' })
}

const prepareNewProxy = () => {
  proxySelectedName.value = ''
  proxyForm.value = emptyProxyForm()
}

const loadProxyIntoForm = (proxyName: string) => {
  const entry = parsedProxies.value.find((item) => item.name === proxyName)
  if (!entry) return
  proxySelectedName.value = entry.name
  proxyForm.value = proxyFormFromEntry(entry)
}

const applyProxyTypePreset = (type: string) => {
  const normalizedType = String(type || '').trim().toLowerCase()
  if (!normalizedType.length) return
  proxyForm.value.type = normalizedType
  if (['vmess', 'vless', 'trojan', 'hysteria2', 'tuic'].includes(normalizedType) && !String(proxyForm.value.tls || '').trim().length) proxyForm.value.tls = 'true'
  if (['wireguard', 'hysteria2', 'tuic'].includes(normalizedType) && !String(proxyForm.value.udp || '').trim().length) proxyForm.value.udp = 'true'
  showNotification({ content: 'configProxiesTypePresetAppliedToast', type: 'alert-success' })
}

const duplicateSelectedProxy = () => {
  const entry = selectedProxyEntry.value
  if (!entry) return
  const next = proxyFormFromEntry(entry)
  next.originalName = ''
  next.name = `${entry.name}-copy`
  proxySelectedName.value = ''
  proxyForm.value = next
}

const saveProxyToPayload = () => {
  if (!proxyFormCanSave.value) {
    showNotification({ content: 'configProxiesSaveNameRequired', type: 'alert-warning' })
    return
  }
  payload.value = upsertProxyInConfig(payload.value, proxyForm.value)
  proxySelectedName.value = String(proxyForm.value.name || '').trim()
  showNotification({ content: 'configProxiesSavedToast', type: 'alert-success' })
}

const disableSelectedProxy = () => {
  const entry = selectedProxyEntry.value
  if (!entry) return
  const result = removeProxyFromConfig(payload.value, entry.name)
  payload.value = result.yaml
  proxySelectedName.value = ''
  proxyForm.value = emptyProxyForm()
  showNotification({
    content: result.rulesTouched > 0 || result.impacts.some((item) => item.fallbackInjected)
      ? 'configProxiesDisabledWithCleanupToast'
      : 'configProxiesDisabledToast',
    type: 'alert-success',
  })
}


const buildProxyCreationTemplateForm = (templateId: string) => {
  const existingNames = parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const next = emptyProxyForm()
  switch (templateId) {
    case 'vless-reality':
      next.name = makeUniqueName('VLESS-Reality', existingNames)
      next.type = 'vless'
      next.server = 'edge.example.com'
      next.port = '443'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.clientFingerprint = 'chrome'
      next.uuid = '<uuid>'
      next.flow = 'xtls-rprx-vision'
      next.realityPublicKey = '<public-key>'
      next.realityShortId = '<short-id>'
      break
    case 'vless-ws-tls':
      next.name = makeUniqueName('VLESS-WS-TLS', existingNames)
      next.type = 'vless'
      next.server = 'edge.example.com'
      next.port = '443'
      next.network = 'ws'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.clientFingerprint = 'chrome'
      next.uuid = '<uuid>'
      next.wsPath = '/app'
      break
    case 'vmess-ws-tls':
      next.name = makeUniqueName('VMess-WS-TLS', existingNames)
      next.type = 'vmess'
      next.server = 'edge.example.com'
      next.port = '443'
      next.network = 'ws'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.clientFingerprint = 'chrome'
      next.uuid = '<uuid>'
      next.wsPath = '/'
      break
    case 'trojan-grpc':
      next.name = makeUniqueName('Trojan-gRPC', existingNames)
      next.type = 'trojan'
      next.server = 'edge.example.com'
      next.port = '443'
      next.network = 'grpc'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.password = '<password>'
      next.grpcServiceName = 'trojan-grpc'
      break
    case 'trojan-tls':
      next.name = makeUniqueName('Trojan-TLS', existingNames)
      next.type = 'trojan'
      next.server = 'edge.example.com'
      next.port = '443'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.password = '<password>'
      break
    case 'wireguard-peer':
    case 'wireguard-basic':
      next.name = makeUniqueName('WireGuard-Peer', existingNames)
      next.type = 'wireguard'
      next.server = '203.0.113.10'
      next.port = '51820'
      next.udp = 'true'
      next.packetEncoding = 'xudp'
      next.wireguardIpText = '172.16.0.2/32'
      next.wireguardMtu = '1420'
      next.wireguardPublicKey = '<server-public-key>'
      next.wireguardPrivateKey = '<client-private-key>'
      break
    case 'hysteria2-basic':
      next.name = makeUniqueName('Hysteria2', existingNames)
      next.type = 'hysteria2'
      next.server = 'edge.example.com'
      next.port = '443'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.password = '<password>'
      next.hysteriaObfs = 'salamander'
      next.hysteriaObfsPassword = '<obfs-password>'
      break
    case 'tuic-basic':
      next.name = makeUniqueName('TUIC', existingNames)
      next.type = 'tuic'
      next.server = 'edge.example.com'
      next.port = '443'
      next.tls = 'true'
      next.udp = 'true'
      next.servername = next.server
      next.uuid = '<uuid>'
      next.password = '<password>'
      next.tuicCongestionController = 'bbr'
      next.tuicUdpRelayMode = 'native'
      next.tuicHeartbeatInterval = '3s'
      break
    default:
      next.name = makeUniqueName('Proxy', existingNames)
      next.type = 'vless'
  }
  return next
}

const buildProxyProviderCreationTemplateForm = (templateId: string) => {
  const existingNames = parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const next = emptyProxyProviderForm()
  switch (templateId) {
    case 'local-file':
      next.name = makeUniqueName('LocalProvider', existingNames)
      next.type = 'file'
      next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`
      next.filter = '(?i)proxy|auto'
      break
    case 'inline-source':
      next.name = makeUniqueName('InlineProvider', existingNames)
      next.type = 'inline'
      next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`
      next.overrideBody = 'additional-prefix: "INLINE"'
      break
    default:
      next.name = makeUniqueName('RemoteProvider', existingNames)
      next.type = 'http'
      next.url = 'https://example.com/subscription.yaml'
      next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`
      next.interval = '86400'
      next.healthCheckEnable = 'true'
      next.healthCheckUrl = 'https://www.gstatic.com/generate_204'
      next.healthCheckInterval = '300'
      break
  }
  return next
}

const buildProxyGroupCreationTemplateForm = (templateId: string) => {
  const existingNames = parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const next = emptyProxyGroupForm()
  const preferredMembers = buildPreferredGroupMembers(3)
  const providerRefs = buildProviderRefs(2)
  switch (templateId) {
    case 'url-test':
      next.name = makeUniqueName('AUTO', existingNames)
      next.type = 'url-test'
      next.url = 'https://www.gstatic.com/generate_204'
      next.interval = '300'
      next.tolerance = '50'
      next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT'])
      break
    case 'fallback':
      next.name = makeUniqueName('FAILOVER', existingNames)
      next.type = 'fallback'
      next.url = 'https://www.gstatic.com/generate_204'
      next.interval = '300'
      next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT'])
      break
    case 'load-balance':
      next.name = makeUniqueName('BALANCE', existingNames)
      next.type = 'load-balance'
      next.url = 'https://www.gstatic.com/generate_204'
      next.interval = '300'
      next.strategy = 'consistent-hashing'
      next.tolerance = '50'
      if (providerRefs.length) next.useText = joinFormList(providerRefs)
      else next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT'])
      break
    case 'relay':
      next.name = makeUniqueName('CHAIN', existingNames)
      next.type = 'relay'
      next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers.slice(0, 2) : [])
      break
    default:
      next.name = makeUniqueName('PROXY', existingNames)
      next.type = 'select'
      next.proxiesText = joinFormList(preferredMembers.length ? ['DIRECT', ...preferredMembers].slice(0, 4) : ['DIRECT'])
      break
  }
  return next
}

const buildRuleProviderCreationTemplateForm = (templateId: string) => {
  const existingNames = parsedRuleProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean)
  const next = emptyRuleProviderForm()
  next.type = 'http'
  next.format = 'yaml'
  next.interval = '86400'
  switch (templateId) {
    case 'domain-remote':
      next.name = makeUniqueName('domains-main', existingNames)
      next.behavior = 'domain'
      next.url = 'https://example.com/rules/domain.yaml'
      break
    case 'ipcidr-remote':
      next.name = makeUniqueName('cidr-main', existingNames)
      next.behavior = 'ipcidr'
      next.url = 'https://example.com/rules/ipcidr.yaml'
      break
    default:
      next.name = makeUniqueName('rules-main', existingNames)
      next.behavior = 'classical'
      next.url = 'https://example.com/rules/classical.yaml'
      break
  }
  next.path = `./rule-providers/${slugifyTemplateValue(next.name)}.yaml`
  return next
}

const startProxyCreationWizard = () => {
  proxyCreationWizard.value = { ...emptyProxyCreationWizard(), active: true }
}

const selectProxyCreationWizardTemplate = (templateId: string) => {
  const next = buildProxyCreationTemplateForm(templateId)
  proxyCreationWizard.value = {
    active: true,
    step: 2,
    templateId,
    type: next.type,
    name: next.name,
    server: next.server,
    port: next.port,
    network: next.network,
    tls: next.tls,
    servername: next.servername,
    clientFingerprint: next.clientFingerprint,
    uuid: next.uuid,
    password: next.password,
    cipher: next.cipher,
    flow: next.flow,
    wsPath: next.wsPath,
    grpcServiceName: next.grpcServiceName,
    realityPublicKey: next.realityPublicKey,
    realityShortId: next.realityShortId,
    wireguardIpText: next.wireguardIpText,
    wireguardPrivateKey: next.wireguardPrivateKey,
    wireguardPublicKey: next.wireguardPublicKey,
    wireguardMtu: next.wireguardMtu,
    hysteriaObfs: next.hysteriaObfs,
    hysteriaObfsPassword: next.hysteriaObfsPassword,
    tuicCongestionController: next.tuicCongestionController,
    tuicUdpRelayMode: next.tuicUdpRelayMode,
    tuicHeartbeatInterval: next.tuicHeartbeatInterval,
  }
}

const finalizeProxyCreationWizard = () => {
  const state = proxyCreationWizard.value
  if (!state.templateId) return
  const next = buildProxyCreationTemplateForm(state.templateId)
  if (String(state.name || '').trim()) next.name = String(state.name || '').trim()
  if (String(state.server || '').trim()) next.server = String(state.server || '').trim()
  if (String(state.port || '').trim()) next.port = String(state.port || '').trim()
  if (String(state.network || '').trim()) next.network = String(state.network || '').trim()
  if (String(state.tls || '').trim()) next.tls = String(state.tls || '').trim()
  if (String(state.servername || '').trim()) next.servername = String(state.servername || '').trim()
  if (String(state.clientFingerprint || '').trim()) next.clientFingerprint = String(state.clientFingerprint || '').trim()
  if (String(state.uuid || '').trim()) next.uuid = String(state.uuid || '').trim()
  if (String(state.password || '').trim()) next.password = String(state.password || '').trim()
  if (String(state.cipher || '').trim()) next.cipher = String(state.cipher || '').trim()
  if (String(state.flow || '').trim()) next.flow = String(state.flow || '').trim()
  if (String(state.wsPath || '').trim()) next.wsPath = String(state.wsPath || '').trim()
  if (String(state.grpcServiceName || '').trim()) next.grpcServiceName = String(state.grpcServiceName || '').trim()
  if (String(state.realityPublicKey || '').trim()) next.realityPublicKey = String(state.realityPublicKey || '').trim()
  if (String(state.realityShortId || '').trim()) next.realityShortId = String(state.realityShortId || '').trim()
  if (String(state.wireguardIpText || '').trim()) next.wireguardIpText = String(state.wireguardIpText || '').trim()
  if (String(state.wireguardPrivateKey || '').trim()) next.wireguardPrivateKey = String(state.wireguardPrivateKey || '').trim()
  if (String(state.wireguardPublicKey || '').trim()) next.wireguardPublicKey = String(state.wireguardPublicKey || '').trim()
  if (String(state.wireguardMtu || '').trim()) next.wireguardMtu = String(state.wireguardMtu || '').trim()
  if (String(state.hysteriaObfs || '').trim()) next.hysteriaObfs = String(state.hysteriaObfs || '').trim()
  if (String(state.hysteriaObfsPassword || '').trim()) next.hysteriaObfsPassword = String(state.hysteriaObfsPassword || '').trim()
  if (String(state.tuicCongestionController || '').trim()) next.tuicCongestionController = String(state.tuicCongestionController || '').trim()
  if (String(state.tuicUdpRelayMode || '').trim()) next.tuicUdpRelayMode = String(state.tuicUdpRelayMode || '').trim()
  if (String(state.tuicHeartbeatInterval || '').trim()) next.tuicHeartbeatInterval = String(state.tuicHeartbeatInterval || '').trim()
  if (next.server && ['vless', 'vmess', 'trojan', 'hysteria2', 'tuic'].includes(next.type) && !String(next.servername || '').trim()) next.servername = next.server
  proxySelectedName.value = ''
  proxyForm.value = next
  proxyCreationWizard.value = emptyProxyCreationWizard()
  showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxiesTitle') }, type: 'alert-success' })
}

const cancelProxyCreationWizard = () => {
  proxyCreationWizard.value = emptyProxyCreationWizard()
}

const prevProxyCreationWizardStep = () => {
  if (proxyCreationWizard.value.step > 1) proxyCreationWizard.value.step = (proxyCreationWizard.value.step - 1) as CreationWizardStep
}

const nextProxyCreationWizardStep = () => {
  if (!proxyCreationWizard.value.templateId || proxyCreationWizard.value.step >= 3) return
  proxyCreationWizard.value.step = (proxyCreationWizard.value.step + 1) as CreationWizardStep
}

const applyProxyCreationTemplate = (templateId: string) => {
  proxySelectedName.value = ''
  proxyForm.value = buildProxyCreationTemplateForm(templateId)
  showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxiesTitle') }, type: 'alert-success' })
}

const startProxyProviderCreationWizard = () => {
  proxyProviderCreationWizard.value = { ...emptyProxyProviderCreationWizard(), active: true }
}

const selectProxyProviderCreationWizardTemplate = (templateId: string) => {
  const next = buildProxyProviderCreationTemplateForm(templateId)
  proxyProviderCreationWizard.value = {
    active: true,
    step: 2,
    templateId,
    name: next.name,
    type: next.type,
    url: next.url,
    path: next.path,
    interval: next.interval,
  }
}

const finalizeProxyProviderCreationWizard = () => {
  const state = proxyProviderCreationWizard.value
  if (!state.templateId) return
  const next = buildProxyProviderCreationTemplateForm(state.templateId)
  if (String(state.name || '').trim()) {
    const normalizedName = String(state.name || '').trim()
    const previousSlug = slugifyTemplateValue(next.name)
    next.name = normalizedName
    if (String(next.path || '').includes(previousSlug)) next.path = `./providers/${slugifyTemplateValue(normalizedName)}.yaml`
  }
  if (String(state.type || '').trim()) next.type = String(state.type || '').trim()
  if (String(state.url || '').trim()) next.url = String(state.url || '').trim()
  if (String(state.path || '').trim()) next.path = String(state.path || '').trim()
  if (String(state.interval || '').trim()) next.interval = String(state.interval || '').trim()
  proxyProviderSelectedName.value = ''
  proxyProviderForm.value = next
  proxyProviderCreationWizard.value = emptyProxyProviderCreationWizard()
  showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxyProvidersTitle') }, type: 'alert-success' })
}

const cancelProxyProviderCreationWizard = () => {
  proxyProviderCreationWizard.value = emptyProxyProviderCreationWizard()
}

const prevProxyProviderCreationWizardStep = () => {
  if (proxyProviderCreationWizard.value.step > 1) proxyProviderCreationWizard.value.step = (proxyProviderCreationWizard.value.step - 1) as CreationWizardStep
}

const nextProxyProviderCreationWizardStep = () => {
  if (!proxyProviderCreationWizard.value.templateId || proxyProviderCreationWizard.value.step >= 3) return
  proxyProviderCreationWizard.value.step = (proxyProviderCreationWizard.value.step + 1) as CreationWizardStep
}

const applyProxyProviderCreationTemplate = (templateId: string) => {
  proxyProviderSelectedName.value = ''
  proxyProviderForm.value = buildProxyProviderCreationTemplateForm(templateId)
  showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxyProvidersTitle') }, type: 'alert-success' })
}

const startProxyGroupCreationWizard = () => {
  proxyGroupCreationWizard.value = { ...emptyProxyGroupCreationWizard(), active: true }
}

const selectProxyGroupCreationWizardTemplate = (templateId: string) => {
  const next = buildProxyGroupCreationTemplateForm(templateId)
  proxyGroupCreationWizard.value = {
    active: true,
    step: 2,
    templateId,
    name: next.name,
    type: next.type,
    membersText: next.proxiesText,
    providersText: next.useText,
    url: next.url,
    interval: next.interval,
  }
}

const finalizeProxyGroupCreationWizard = () => {
  const state = proxyGroupCreationWizard.value
  if (!state.templateId) return
  const next = buildProxyGroupCreationTemplateForm(state.templateId)
  if (String(state.name || '').trim()) next.name = String(state.name || '').trim()
  if (String(state.type || '').trim()) next.type = String(state.type || '').trim()
  if (String(state.membersText || '').trim()) next.proxiesText = joinFormList(splitFormList(state.membersText))
  if (String(state.providersText || '').trim()) next.useText = joinFormList(splitFormList(state.providersText))
  if (String(state.url || '').trim()) next.url = String(state.url || '').trim()
  if (String(state.interval || '').trim()) next.interval = String(state.interval || '').trim()
  proxyGroupSelectedName.value = ''
  proxyGroupForm.value = next
  proxyGroupCreationWizard.value = emptyProxyGroupCreationWizard()
  showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxyGroupsTitle') }, type: 'alert-success' })
}

const cancelProxyGroupCreationWizard = () => {
  proxyGroupCreationWizard.value = emptyProxyGroupCreationWizard()
}

const prevProxyGroupCreationWizardStep = () => {
  if (proxyGroupCreationWizard.value.step > 1) proxyGroupCreationWizard.value.step = (proxyGroupCreationWizard.value.step - 1) as CreationWizardStep
}

const nextProxyGroupCreationWizardStep = () => {
  if (!proxyGroupCreationWizard.value.templateId || proxyGroupCreationWizard.value.step >= 3) return
  proxyGroupCreationWizard.value.step = (proxyGroupCreationWizard.value.step + 1) as CreationWizardStep
}

const applyProxyGroupCreationTemplate = (templateId: string) => {
  proxyGroupSelectedName.value = ''
  proxyGroupForm.value = buildProxyGroupCreationTemplateForm(templateId)
  showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxyGroupsTitle') }, type: 'alert-success' })
}

const startRuleProviderCreationWizard = () => {
  ruleProviderCreationWizard.value = { ...emptyRuleProviderCreationWizard(), active: true }
}

const selectRuleProviderCreationWizardTemplate = (templateId: string) => {
  const next = buildRuleProviderCreationTemplateForm(templateId)
  ruleProviderCreationWizard.value = {
    active: true,
    step: 2,
    templateId,
    name: next.name,
    behavior: next.behavior,
    url: next.url,
    path: next.path,
    interval: next.interval,
  }
}

const finalizeRuleProviderCreationWizard = () => {
  const state = ruleProviderCreationWizard.value
  if (!state.templateId) return
  const next = buildRuleProviderCreationTemplateForm(state.templateId)
  if (String(state.name || '').trim()) {
    const normalizedName = String(state.name || '').trim()
    const previousSlug = slugifyTemplateValue(next.name)
    next.name = normalizedName
    if (String(next.path || '').includes(previousSlug)) next.path = `./rule-providers/${slugifyTemplateValue(normalizedName)}.yaml`
  }
  if (String(state.behavior || '').trim()) next.behavior = String(state.behavior || '').trim()
  if (String(state.url || '').trim()) next.url = String(state.url || '').trim()
  if (String(state.path || '').trim()) next.path = String(state.path || '').trim()
  if (String(state.interval || '').trim()) next.interval = String(state.interval || '').trim()
  ruleProviderSelectedName.value = ''
  ruleProviderForm.value = next
  ruleProviderCreationWizard.value = emptyRuleProviderCreationWizard()
  showNotification({ content: 'configWizardAppliedToast', params: { section: t('configRuleProvidersTitle') }, type: 'alert-success' })
}

const cancelRuleProviderCreationWizard = () => {
  ruleProviderCreationWizard.value = emptyRuleProviderCreationWizard()
}

const prevRuleProviderCreationWizardStep = () => {
  if (ruleProviderCreationWizard.value.step > 1) ruleProviderCreationWizard.value.step = (ruleProviderCreationWizard.value.step - 1) as CreationWizardStep
}

const nextRuleProviderCreationWizardStep = () => {
  if (!ruleProviderCreationWizard.value.templateId || ruleProviderCreationWizard.value.step >= 3) return
  ruleProviderCreationWizard.value.step = (ruleProviderCreationWizard.value.step + 1) as CreationWizardStep
}

const applyRuleProviderCreationTemplate = (templateId: string) => {
  ruleProviderSelectedName.value = ''
  ruleProviderForm.value = buildRuleProviderCreationTemplateForm(templateId)
  showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configRuleProvidersTitle') }, type: 'alert-success' })
}

const clearProxyFilter = () => {
  proxyListQuery.value = ''
}

const providerReferenceBadgeClass = (count: number) => {
  if (count <= 0) return 'badge-ghost'
  if (count <= 2) return 'badge-warning badge-outline'
  return 'badge-error badge-outline'
}

const proxyProviderDisplayValue = (value?: string) => {
  const s = String(value || '').trim()
  return s.length ? s : '—'
}

const clearProxyProviderFilter = () => {
  proxyProviderListQuery.value = ''
}

const applyProxyProviderTypePreset = (type: typeof proxyProviderTypePresets[number]) => {
  proxyProviderForm.value.type = type
  if (type === 'http' && !String(proxyProviderForm.value.interval || '').trim().length) proxyProviderForm.value.interval = '86400'
  if (type === 'http' && !String(proxyProviderForm.value.healthCheckEnable || '').trim().length) proxyProviderForm.value.healthCheckEnable = 'true'
  if (type === 'http' && !String(proxyProviderForm.value.healthCheckUrl || '').trim().length) proxyProviderForm.value.healthCheckUrl = 'https://www.gstatic.com/generate_204'
  if (type === 'http' && !String(proxyProviderForm.value.healthCheckInterval || '').trim().length) proxyProviderForm.value.healthCheckInterval = '300'
  showNotification({ content: 'configProxyProvidersTypePresetAppliedToast', type: 'alert-success' })
}

const applyProxyProviderHealthPreset = (url: string) => {
  const normalized = String(url || '').trim()
  if (!normalized) return
  proxyProviderForm.value.healthCheckEnable = 'true'
  proxyProviderForm.value.healthCheckUrl = normalized
  if (!String(proxyProviderForm.value.healthCheckInterval || '').trim().length) proxyProviderForm.value.healthCheckInterval = '300'
}

const prepareNewProxyProvider = () => {
  proxyProviderSelectedName.value = ''
  proxyProviderForm.value = emptyProxyProviderForm()
}

const loadProxyProviderIntoForm = (providerName: string) => {
  const entry = parsedProxyProviders.value.find((item) => item.name === providerName)
  if (!entry) return
  proxyProviderSelectedName.value = entry.name
  proxyProviderForm.value = proxyProviderFormFromEntry(entry)
}

const duplicateSelectedProxyProvider = () => {
  const entry = selectedProxyProviderEntry.value
  if (!entry) return
  const next = proxyProviderFormFromEntry(entry)
  next.originalName = ''
  next.name = `${entry.name}-copy`
  proxyProviderSelectedName.value = ''
  proxyProviderForm.value = next
}

const saveProxyProviderToPayload = () => {
  if (!proxyProviderFormCanSave.value) {
    showNotification({ content: 'configProxyProvidersSaveNameRequired', type: 'alert-warning' })
    return
  }
  payload.value = upsertProxyProviderInConfig(payload.value, proxyProviderForm.value)
  proxyProviderSelectedName.value = String(proxyProviderForm.value.name || '').trim()
  showNotification({ content: 'configProxyProvidersSavedToast', type: 'alert-success' })
}

const disableSelectedProxyProvider = () => {
  const entry = selectedProxyProviderEntry.value
  if (!entry) return
  const result = removeProxyProviderFromConfig(payload.value, entry.name)
  payload.value = result.yaml
  proxyProviderSelectedName.value = ''
  proxyProviderForm.value = emptyProxyProviderForm()
  showNotification({
    content: result.impacts.some((item) => item.fallbackInjected)
      ? 'configProxyProvidersDisabledWithFallbackToast'
      : 'configProxyProvidersDisabledToast',
    type: 'alert-success',
  })
}

const prepareNewProxyGroup = () => {
  proxyGroupSelectedName.value = ''
  proxyGroupForm.value = emptyProxyGroupForm()
}

const loadProxyGroupIntoForm = (groupName: string) => {
  const entry = parsedProxyGroups.value.find((item) => item.name === groupName)
  if (!entry) return
  proxyGroupSelectedName.value = entry.name
  proxyGroupForm.value = proxyGroupFormFromEntry(entry)
}

const duplicateSelectedProxyGroup = () => {
  const entry = selectedProxyGroupEntry.value
  if (!entry) return
  const next = proxyGroupFormFromEntry(entry)
  next.originalName = ''
  next.name = `${entry.name}-copy`
  proxyGroupSelectedName.value = ''
  proxyGroupForm.value = next
}

const saveProxyGroupToPayload = () => {
  if (!proxyGroupFormCanSave.value) {
    showNotification({ content: 'configProxyGroupsSaveNameRequired', type: 'alert-warning' })
    return
  }
  payload.value = upsertProxyGroupInConfig(payload.value, proxyGroupForm.value)
  proxyGroupSelectedName.value = String(proxyGroupForm.value.name || '').trim()
  showNotification({ content: 'configProxyGroupsSavedToast', type: 'alert-success' })
}

const disableSelectedProxyGroup = () => {
  const entry = selectedProxyGroupEntry.value
  if (!entry) return
  const result = removeProxyGroupFromConfig(payload.value, entry.name)
  payload.value = result.yaml
  proxyGroupSelectedName.value = ''
  proxyGroupForm.value = emptyProxyGroupForm()
  showNotification({
    content: result.rulesTouched > 0 || result.impacts.some((item) => item.fallbackInjected)
      ? 'configProxyGroupsDisabledWithFallbackToast'
      : 'configProxyGroupsDisabledToast',
    type: 'alert-success',
  })
}

const clearRuleProviderFilter = () => {
  ruleProviderListQuery.value = ''
}

const applyRuleProviderBehaviorPreset = (behavior: typeof ruleProviderBehaviorPresets[number]) => {
  ruleProviderForm.value.behavior = behavior
  if (!String(ruleProviderForm.value.format || '').trim().length) ruleProviderForm.value.format = 'yaml'
  showNotification({ content: 'configRuleProvidersBehaviorPresetAppliedToast', type: 'alert-success' })
}

const prepareNewRuleProvider = () => {
  ruleProviderSelectedName.value = ''
  ruleProviderForm.value = emptyRuleProviderForm()
}

const loadRuleProviderIntoForm = (providerName: string) => {
  const entry = parsedRuleProviders.value.find((item) => item.name === providerName)
  if (!entry) return
  ruleProviderSelectedName.value = entry.name
  ruleProviderForm.value = ruleProviderFormFromEntry(entry)
}

const duplicateSelectedRuleProvider = () => {
  const entry = selectedRuleProviderEntry.value
  if (!entry) return
  const next = ruleProviderFormFromEntry(entry)
  next.originalName = ''
  next.name = `${entry.name}-copy`
  ruleProviderSelectedName.value = ''
  ruleProviderForm.value = next
}

const saveRuleProviderToPayload = () => {
  if (!ruleProviderFormCanSave.value) {
    showNotification({ content: 'configRuleProvidersSaveNameRequired', type: 'alert-warning' })
    return
  }
  payload.value = upsertRuleProviderInConfig(payload.value, ruleProviderForm.value)
  ruleProviderSelectedName.value = String(ruleProviderForm.value.name || '').trim()
  showNotification({ content: 'configRuleProvidersSavedToast', type: 'alert-success' })
}

const disableSelectedRuleProvider = () => {
  const entry = selectedRuleProviderEntry.value
  if (!entry) return
  const result = removeRuleProviderFromConfig(payload.value, entry.name)
  payload.value = result.yaml
  ruleProviderSelectedName.value = ''
  ruleProviderForm.value = emptyRuleProviderForm()
  showNotification({
    content: result.rulesRemoved > 0 ? 'configRuleProvidersDisabledWithCleanupToast' : 'configRuleProvidersDisabledToast',
    type: 'alert-success',
  })
}

const prepareNewRule = () => {
  ruleSelectedIndex.value = ''
  ruleForm.value = emptyRuleForm()
}

const clearRuleFilter = () => {
  ruleListQuery.value = ''
}

const filterRulesByType = (type: string) => {
  const normalized = String(type || '').trim().toUpperCase()
  ruleListQuery.value = normalizedRuleListFilter.value === normalized ? '' : normalized
}

const applyRuleTemplate = (templateId: 'match-direct' | 'rule-set' | 'geoip-cn' | 'geosite-ads' | 'domain-suffix') => {
  const target = preferredRuleTarget.value || 'DIRECT'
  if (templateId === 'match-direct') {
    ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'MATCH,DIRECT' })
    return
  }
  if (templateId === 'rule-set') {
    const provider = parsedRuleProviders.value[0]?.name || 'provider-name'
    ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: `RULE-SET,${provider},${target}` })
    return
  }
  if (templateId === 'geoip-cn') {
    ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'GEOIP,CN,DIRECT' })
    return
  }
  if (templateId === 'geosite-ads') {
    ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'GEOSITE,category-ads-all,REJECT' })
    return
  }
  ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: `DOMAIN-SUFFIX,example.com,${target}` })
}

const syncRuleFormFromRawLine = () => {
  ruleForm.value = syncRuleFormFromRaw(ruleForm.value)
}

const syncRuleRawFromStructuredForm = () => {
  ruleForm.value = syncRuleRawFromForm(ruleForm.value)
}

const loadRuleIntoForm = (ruleIndex: number) => {
  const entry = parsedRules.value.find((item) => item.index === ruleIndex)
  if (!entry) return
  ruleSelectedIndex.value = String(entry.index)
  ruleForm.value = ruleFormFromEntry(entry)
}

const duplicateSelectedRule = () => {
  const entry = selectedRuleEntry.value
  if (!entry) return
  const next = ruleFormFromEntry(entry)
  next.originalIndex = ''
  ruleSelectedIndex.value = ''
  ruleForm.value = next
}

const saveRuleToPayload = () => {
  if (!ruleFormCanSave.value) {
    showNotification({ content: 'configRulesSaveRequired', type: 'alert-warning' })
    return
  }
  const wasNew = !String(ruleForm.value.originalIndex || '').trim().length
  const originalIndex = String(ruleForm.value.originalIndex || '').trim()
  const nextPayload = upsertRuleInConfig(payload.value, ruleForm.value)
  payload.value = nextPayload
  const nextEntries = parseRulesFromConfig(nextPayload)
  if (wasNew) {
    const created = nextEntries[nextEntries.length - 1]
    if (created) {
      ruleSelectedIndex.value = String(created.index)
      ruleForm.value = ruleFormFromEntry(created)
    }
  } else {
    const selected = nextEntries.find((item) => String(item.index) === originalIndex)
    if (selected) {
      ruleSelectedIndex.value = String(selected.index)
      ruleForm.value = ruleFormFromEntry(selected)
    }
  }
  showNotification({ content: 'configRulesSavedToast', type: 'alert-success' })
}

const disableSelectedRule = () => {
  const entry = selectedRuleEntry.value
  if (!entry) return
  payload.value = removeRuleFromConfig(payload.value, entry.index)
  ruleSelectedIndex.value = ''
  ruleForm.value = emptyRuleForm()
  showNotification({ content: 'configRulesDisabledToast', type: 'alert-success' })
}


const splitDiffLines = (value: string) => {
  const normalized = normalizeDiffText(value)
  if (!normalized.length) return [] as string[]
  const lines = normalized.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

const buildLineDiffRows = (leftLines: string[], rightLines: string[]): DiffRow[] => {
  const m = leftLines.length
  const n = rightLines.length
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1))

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (leftLines[i] === rightLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  let leftNo = 1
  let rightNo = 1

  while (i < m && j < n) {
    if (leftLines[i] === rightLines[j]) {
      rows.push({
        type: 'context',
        leftNo,
        rightNo,
        leftText: leftLines[i],
        rightText: rightLines[j],
      })
      i += 1
      j += 1
      leftNo += 1
      rightNo += 1
      continue
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({
        type: 'remove',
        leftNo,
        rightNo: null,
        leftText: leftLines[i],
        rightText: '',
      })
      i += 1
      leftNo += 1
    } else {
      rows.push({
        type: 'add',
        leftNo: null,
        rightNo,
        leftText: '',
        rightText: rightLines[j],
      })
      j += 1
      rightNo += 1
    }
  }

  while (i < m) {
    rows.push({
      type: 'remove',
      leftNo,
      rightNo: null,
      leftText: leftLines[i],
      rightText: '',
    })
    i += 1
    leftNo += 1
  }

  while (j < n) {
    rows.push({
      type: 'add',
      leftNo: null,
      rightNo,
      leftText: '',
      rightText: rightLines[j],
    })
    j += 1
    rightNo += 1
  }

  return rows
}

const diffRows = computed(() => buildLineDiffRows(
  splitDiffLines(diffSourceContent(compareLeftResolved.value)),
  splitDiffLines(diffSourceContent(compareRightResolved.value)),
))

const diffRowsVisible = computed(() => (compareChangesOnly.value ? diffRows.value.filter((row) => row.type !== 'context') : diffRows.value))

const diffSummary = computed(() => diffRows.value.reduce((acc, row) => {
  if (row.type === 'add') acc.added += 1
  else if (row.type === 'remove') acc.removed += 1
  else acc.context += 1
  return acc
}, { context: 0, added: 0, removed: 0 }))

const diffHasChanges = computed(() => diffSummary.value.added > 0 || diffSummary.value.removed > 0)

const swapDiffSources = () => {
  const currentLeft = compareLeft.value
  compareLeft.value = compareRight.value
  compareRight.value = currentLeft
}

const dumpYaml = (value: any): string => {
  const isScalar = (v: any) => v === null || ['string', 'number', 'boolean'].includes(typeof v)

  const scalarInline = (v: any) => {
    if (v === null) return 'null'
    if (typeof v === 'string') return JSON.stringify(v)
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return JSON.stringify(String(v))
  }

  const emit = (v: any, indent = 0): string[] => {
    const sp = ' '.repeat(indent)

    if (isScalar(v)) {
      if (typeof v === 'string' && v.includes('\n')) {
        const lines = v.split(/\r?\n/)
        return [sp + '|-', ...lines.map((l) => sp + '  ' + l)]
      }
      return [sp + scalarInline(v)]
    }

    if (Array.isArray(v)) {
      if (!v.length) return [sp + '[]']
      const out: string[] = []
      for (const item of v) {
        if (isScalar(item)) {
          if (typeof item === 'string' && item.includes('\n')) {
            const lines = item.split(/\r?\n/)
            out.push(sp + '- |-')
            out.push(...lines.map((l) => sp + '  ' + l))
          } else {
            out.push(sp + '- ' + scalarInline(item))
          }
        } else {
          out.push(sp + '-')
          out.push(...emit(item, indent + 2))
        }
      }
      return out
    }

    if (typeof v === 'object') {
      const keys = Object.keys(v || {})
      if (!keys.length) return [sp + '{}']
      const out: string[] = []
      for (const k of keys) {
        const key = /^[A-Za-z0-9_.-]+$/.test(k) ? k : JSON.stringify(k)
        const val = (v as any)[k]
        if (isScalar(val)) {
          if (typeof val === 'string' && val.includes('\n')) {
            const lines = val.split(/\r?\n/)
            out.push(sp + key + ': |-')
            out.push(...lines.map((l) => sp + '  ' + l))
          } else {
            out.push(sp + key + ': ' + scalarInline(val))
          }
        } else {
          if (Array.isArray(val) && !val.length) {
            out.push(sp + key + ': []')
          } else {
            out.push(sp + key + ':')
            out.push(...emit(val, indent + 2))
          }
        }
      }
      return out
    }

    return [sp + JSON.stringify(String(v))]
  }

  return emit(value, 0).join('\n') + '\n'
}

const looksLikeFullConfig = (s: string) => {
  const t = (s || '').trim()
  if (!t) return false
  return (
    /(^|\n)\s*proxies\s*:/m.test(t) ||
    /(^|\n)\s*proxy-groups\s*:/m.test(t) ||
    /(^|\n)\s*proxy-providers\s*:/m.test(t) ||
    /(^|\n)\s*rule-providers\s*:/m.test(t) ||
    /(^|\n)\s*rules\s*:/m.test(t)
  )
}

const looksLikeRuntimeConfigs = (obj: any) => {
  if (!obj || typeof obj !== 'object') return false
  const keys = Object.keys(obj)
  const hasPorts = keys.some((k) => ['port', 'socks-port', 'redir-port', 'tproxy-port', 'mixed-port'].includes(k))
  const hasGroups = keys.some((k) => ['proxy-groups', 'proxies', 'rules', 'proxy-providers', 'rule-providers'].includes(k))
  return hasPorts && !hasGroups
}

const tryLoadFromFileLikeEndpoints = async (pathValue: string): Promise<string | null> => {
  const candidates: Array<{ url: string; params?: Record<string, any> }> = [
    { url: '/configs', params: { path: pathValue, format: 'raw' } },
    { url: '/configs', params: { path: pathValue, raw: true } },
    { url: '/configs', params: { path: pathValue, file: true } },
    { url: '/configs', params: { path: pathValue, download: true } },
    { url: '/configs/raw', params: { path: pathValue } },
    { url: '/configs/file', params: { path: pathValue } },
  ]

  for (const c of candidates) {
    try {
      const r = await axios.get(c.url, {
        params: c.params,
        responseType: 'text',
        silent: true as any,
        headers: {
          Accept: 'text/plain, application/x-yaml, application/yaml, */*',
          'X-Zash-Silent': '1',
        } as any,
      })
      const data: any = (r as any)?.data
      if (typeof data === 'string') {
        const s = data.trim()
        if (looksLikeFullConfig(s)) return data
        if ((s.startsWith('{') || s.startsWith('[')) && (s.endsWith('}') || s.endsWith(']'))) {
          try {
            const parsed = JSON.parse(s)
            const payloadValue = (parsed && (parsed.payload || parsed.data?.payload || parsed.config || parsed.yaml)) as any
            if (typeof payloadValue === 'string' && looksLikeFullConfig(payloadValue)) return payloadValue
          } catch {
            // ignore
          }
        }
      } else if (data && typeof data === 'object') {
        const payloadValue = (data.payload || data.data?.payload || data.config || data.yaml) as any
        if (typeof payloadValue === 'string' && looksLikeFullConfig(payloadValue)) return payloadValue
      }
    } catch {
      // try next
    }
  }
  return null
}

const legacyLoad = async () => {
  if (legacyLoadBusy.value) return
  legacyLoadBusy.value = true
  try {
    if (agentEnabled.value) {
      const res = await agentMihomoConfigAPI()
      if (res?.ok && res?.contentB64) {
        payload.value = decodeB64Utf8(res.contentB64)
        showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' })
        return
      }
    }

    const fileText = await tryLoadFromFileLikeEndpoints(path.value)
    if (fileText) {
      payload.value = fileText
      showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' })
      return
    }

    const raw = await getConfigsRawAPI({ path: path.value })
    const data: any = raw?.data
    if (typeof data === 'string' && data.trim().length > 0) {
      const s = data.trim()
      if (looksLikeFullConfig(s)) {
        payload.value = data
        showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' })
        return
      }
      if (s.startsWith('{') || s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s)
          if (looksLikeRuntimeConfigs(parsed)) {
            payload.value =
              `# Mihomo API /configs does not expose the full YAML file on this build.\n` +
              `# Showing runtime config (ports/tun/etc). If your backend supports reading the file,\n` +
              `# enable it to load: ${path.value}\n\n` +
              dumpYaml(parsed)
            showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' })
            return
          }
          payload.value = `# Converted from /configs (JSON)\n# Comments/ordering may differ from the original mihomo YAML.\n\n${dumpYaml(parsed)}`
          showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' })
          return
        } catch {
          // ignore
        }
      }
      payload.value = data
      showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' })
      return
    }

    const json = await getConfigsAPI()
    payload.value = `# Converted from /configs (JSON)\n# Comments/ordering may differ from the original mihomo YAML.\n\n${dumpYaml(json.data)}`
    showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' })
  } catch {
    showNotification({ content: 'mihomoConfigLoadFailed', type: 'alert-error' })
  } finally {
    legacyLoadBusy.value = false
  }
}

const legacyApply = async () => {
  if (legacyApplyBusy.value) return
  legacyApplyBusy.value = true
  try {
    await reloadConfigsAPI({ path: path.value || '', payload: payload.value || '' })
    showNotification({ content: 'reloadConfigsSuccess', type: 'alert-success' })
  } catch {
    // interceptor handles details
  } finally {
    legacyApplyBusy.value = false
  }
}

const legacyRestart = async () => {
  if (legacyRestartBusy.value) return
  legacyRestartBusy.value = true
  try {
    await restartCoreAPI()
    showNotification({ content: 'restartCoreSuccess', type: 'alert-success' })
  } catch {
    // interceptor handles details
  } finally {
    legacyRestartBusy.value = false
  }
}

const clearDraft = () => {
  payload.value = ''
  advancedSectionsForm.value = emptyAdvancedSectionsForm()
  dnsEditorForm.value = emptyDnsEditorForm()
}

watch(payload, () => {
  syncQuickEditorFromPayload()
  syncAdvancedSectionsFromPayload()
  syncDnsEditorFromPayload()
}, { immediate: true })

watch(parsedProxies, (entries) => {
  const selectedName = String(proxySelectedName.value || '').trim()
  if (selectedName) {
    const entry = entries.find((item) => item.name === selectedName)
    if (entry) {
      proxyForm.value = proxyFormFromEntry(entry)
      return
    }
  }
  if (!selectedName && !String(proxyForm.value.name || '').trim().length) {
    proxyForm.value = emptyProxyForm()
  }
}, { immediate: true, deep: true })

watch(parsedProxyProviders, (entries) => {
  const selectedName = String(proxyProviderSelectedName.value || '').trim()
  if (selectedName) {
    const entry = entries.find((item) => item.name === selectedName)
    if (entry) {
      proxyProviderForm.value = proxyProviderFormFromEntry(entry)
      return
    }
  }
  if (!selectedName && !String(proxyProviderForm.value.name || '').trim().length) {
    proxyProviderForm.value = emptyProxyProviderForm()
  }
}, { immediate: true, deep: true })

watch(parsedProxyGroups, (entries) => {
  const selectedName = String(proxyGroupSelectedName.value || '').trim()
  if (selectedName) {
    const entry = entries.find((item) => item.name === selectedName)
    if (entry) {
      proxyGroupForm.value = proxyGroupFormFromEntry(entry)
      return
    }
  }
  if (!selectedName && !String(proxyGroupForm.value.name || '').trim().length) {
    proxyGroupForm.value = emptyProxyGroupForm()
  }
}, { immediate: true, deep: true })

watch(parsedRuleProviders, (entries) => {
  const selectedName = String(ruleProviderSelectedName.value || '').trim()
  if (selectedName) {
    const entry = entries.find((item) => item.name === selectedName)
    if (entry) {
      ruleProviderForm.value = ruleProviderFormFromEntry(entry)
      return
    }
  }
  if (!selectedName && !String(ruleProviderForm.value.name || '').trim().length) {
    ruleProviderForm.value = emptyRuleProviderForm()
  }
}, { immediate: true, deep: true })

watch(parsedRules, (entries) => {
  const selectedIndex = Number.parseInt(String(ruleSelectedIndex.value || ''), 10)
  if (Number.isFinite(selectedIndex)) {
    const entry = entries.find((item) => item.index === selectedIndex)
    if (entry) {
      ruleForm.value = ruleFormFromEntry(entry)
      return
    }
  }
  if (!String(ruleSelectedIndex.value || '').trim().length && !String(ruleForm.value.raw || '').trim().length) {
    ruleForm.value = emptyRuleForm()
  }
}, { immediate: true, deep: true })

watch(
  [managedMode, configWorkspaceSections],
  () => {
    const current = configWorkspaceSections.value.find((section) => section.id === configWorkspaceSection.value)
    if (current && !current.disabled) return
    const fallback = configWorkspaceSections.value.find((section) => !section.disabled)?.id || 'editor'
    if (configWorkspaceSection.value !== fallback) configWorkspaceSection.value = fallback
  },
  { immediate: true },
)

onMounted(async () => {
  await refreshAll(true)
  syncAdvancedSectionsFromPayload()
  syncDnsEditorFromPayload()
})
