/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { agentMihomoConfigAPI, agentMihomoConfigManagedApplyAPI, agentMihomoConfigManagedCopyAPI, agentMihomoConfigManagedGetAPI, agentMihomoConfigManagedGetRevAPI, agentMihomoConfigManagedHistoryAPI, agentMihomoConfigManagedPutDraftAPI, agentMihomoConfigManagedRestoreBaselineAPI, agentMihomoConfigManagedRestoreRevAPI, agentMihomoConfigManagedSetBaselineFromActiveAPI, agentMihomoConfigManagedValidateAPI, agentMihomoConfigStateAPI, } from '@/api/agent';
import { getConfigsAPI, getConfigsRawAPI, reloadConfigsAPI, restartCoreAPI } from '@/api';
import { decodeB64Utf8 } from '@/helper/b64';
import { emptyProxyForm, parseProxiesFromConfig, proxyFormFromEntry, removeProxyFromConfig, simulateProxyDisableImpact, upsertProxyInConfig, } from '@/helper/mihomoConfigProxies';
import { emptyProxyProviderForm, parseProxyProvidersFromConfig, proxyProviderFormFromEntry, removeProxyProviderFromConfig, simulateProxyProviderDisableImpact, upsertProxyProviderInConfig, } from '@/helper/mihomoConfigProviders';
import { emptyProxyGroupForm, parseProxyGroupsFromConfig, proxyGroupFormFromEntry, removeProxyGroupFromConfig, simulateProxyGroupDisableImpact, upsertProxyGroupInConfig, } from '@/helper/mihomoConfigGroups';
import { emptyRuleProviderForm, parseRuleProvidersFromConfig, removeRuleProviderFromConfig, ruleProviderFormFromEntry, simulateRuleProviderDisableImpact, upsertRuleProviderInConfig, } from '@/helper/mihomoConfigRuleProviders';
import { emptyRuleForm, parseRulesFromConfig, removeRuleFromConfig, ruleFormFromEntry, syncRuleFormFromRaw, syncRuleRawFromForm, upsertRuleInConfig, } from '@/helper/mihomoConfigRules';
import { dnsEditorFormFromConfig, emptyDnsEditorForm, upsertDnsEditorInConfig, } from '@/helper/mihomoConfigDns';
import { advancedSectionsFormFromConfig, emptyAdvancedSectionsForm, upsertAdvancedSectionsInConfig, } from '@/helper/mihomoConfigAdvanced';
import { showNotification } from '@/helper/notification';
import { agentEnabled } from '@/store/agent';
import { useStorage } from '@vueuse/core';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline';
import axios from 'axios';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const path = useStorage('config/mihomo-config-path', '/opt/etc/mihomo/config.yaml');
const payload = useStorage('config/mihomo-config-payload', '');
const expanded = useStorage('config/mihomo-config-expanded', false);
const compareLeft = useStorage('config/mihomo-config-diff-left', 'active');
const compareRight = useStorage('config/mihomo-config-diff-right', 'draft');
const compareChangesOnly = useStorage('config/mihomo-config-diff-only-changes', true);
const overviewSource = useStorage('config/mihomo-config-overview-source', 'draft');
const proxySelectedName = useStorage('config/mihomo-config-proxy-selected', '');
const proxyListQuery = useStorage('config/mihomo-config-proxy-query', '');
const proxyProviderSelectedName = useStorage('config/mihomo-config-provider-selected', '');
const proxyProviderListQuery = useStorage('config/mihomo-config-provider-query', '');
const proxyGroupSelectedName = useStorage('config/mihomo-config-group-selected', '');
const ruleProviderSelectedName = useStorage('config/mihomo-config-rule-provider-selected', '');
const ruleProviderListQuery = useStorage('config/mihomo-config-rule-provider-query', '');
const ruleSelectedIndex = useStorage('config/mihomo-config-rule-selected', '');
const ruleListQuery = useStorage('config/mihomo-config-rule-query', '');
const configWorkspaceSection = useStorage('config/mihomo-config-workspace-section', 'editor');
const structuredEditorSection = useStorage('config/mihomo-config-structured-section', 'quick');
const { t } = useI18n();
const refreshBusy = ref(false);
const historyBusy = ref(false);
const actionBusy = ref(false);
const managedState = ref(null);
const historyItems = ref([]);
const validationOutput = ref('');
const validationCmd = ref('');
const validationOk = ref(false);
const lastAction = ref(null);
const managedPayloads = ref({
    active: '',
    draft: '',
    baseline: '',
});
const lastSuccessfulPayload = ref('');
const quickEditorFieldMeta = [
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
];
const emptyQuickEditorModel = () => ({
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
});
const quickEditor = ref(emptyQuickEditorModel());
const advancedSectionsForm = ref(emptyAdvancedSectionsForm());
const dnsEditorForm = ref(emptyDnsEditorForm());
const proxyForm = ref(emptyProxyForm());
const proxyProviderForm = ref(emptyProxyProviderForm());
const proxyGroupForm = ref(emptyProxyGroupForm());
const ruleProviderForm = ref(emptyRuleProviderForm());
const ruleForm = ref(emptyRuleForm());
const legacyLoadBusy = ref(false);
const legacyApplyBusy = ref(false);
const legacyRestartBusy = ref(false);
const currentPath = computed(() => managedMode.value ? (managedState.value?.active?.path || path.value) : path.value);
const managedMode = computed(() => agentEnabled.value && Boolean(managedState.value?.ok));
const configWorkspaceSections = computed(() => [
    { id: 'editor', labelKey: 'mihomoConfigEditor', disabled: false },
    { id: 'overview', labelKey: 'configOverviewTitle', disabled: false },
    { id: 'structured', labelKey: 'configWorkspaceStructuredTitle', disabled: false },
    { id: 'diagnostics', labelKey: 'configDiagnosticsTitle', disabled: false },
    { id: 'compare', labelKey: 'configDiffTitle', disabled: !managedMode.value },
    { id: 'history', labelKey: 'configHistoryTitle', disabled: !managedMode.value },
]);
const setConfigWorkspaceSection = (id) => {
    if (configWorkspaceSections.value.find((section) => section.id === id && !section.disabled)) {
        configWorkspaceSection.value = id;
    }
};
const structuredEditorSections = computed(() => [
    { id: 'quick', labelKey: 'configQuickEditorTitle', count: quickEditorPreviewChanges.value.length },
    { id: 'runtime-sections', labelKey: 'configAdvancedSectionsTitle', count: advancedSectionsSummary.value.totalItems },
    { id: 'proxies', labelKey: 'configProxiesTitle', count: parsedProxies.value.length },
    { id: 'proxy-providers', labelKey: 'configProxyProvidersTitle', count: parsedProxyProviders.value.length },
    { id: 'proxy-groups', labelKey: 'configProxyGroupsTitle', count: parsedProxyGroups.value.length },
    { id: 'rule-providers', labelKey: 'configRuleProvidersTitle', count: parsedRuleProviders.value.length },
    { id: 'rules', labelKey: 'configRulesTitle', count: parsedRules.value.length },
    { id: 'dns', labelKey: 'configDnsStructuredTitle', count: dnsStructuredSummary.value.totalItems },
]);
const setStructuredEditorSection = (id) => {
    if (structuredEditorSections.value.find((section) => section.id === id)) {
        structuredEditorSection.value = id;
    }
};
const busyAny = computed(() => refreshBusy.value || historyBusy.value || actionBusy.value);
const lastSuccessfulExists = computed(() => Boolean(managedState.value?.lastSuccessful?.exists));
const lastSuccessfulStatusText = computed(() => {
    if (!lastSuccessfulExists.value)
        return t('configLastSuccessfulMissing');
    return managedState.value?.lastSuccessful?.current ? t('configLastSuccessfulCurrent') : t('configLastSuccessfulSavedSnapshot');
});
const lastSuccessfulBadgeClass = computed(() => (managedState.value?.lastSuccessful?.current ? 'badge-success' : 'badge-ghost'));
const fmtTextTs = (value) => {
    const s = String(value || '').trim();
    if (!s)
        return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return s;
    return d.toLocaleString();
};
const fmtBytes = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0)
        return '0 B';
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
};
const managedStatusText = computed(() => {
    const status = String(managedState.value?.lastApplyStatus || '').trim();
    switch (status) {
        case 'ok':
            return 'OK';
        case 'validate-failed':
            return 'validate failed';
        case 'rolled-back':
            return 'rolled back';
        case 'restored-baseline':
            return 'baseline restored';
        case 'failed':
            return 'failed';
        default:
            return 'idle';
    }
});
const managedStatusBadgeClass = computed(() => {
    const status = String(managedState.value?.lastApplyStatus || '').trim();
    if (status === 'ok')
        return 'badge-success';
    if (status === 'rolled-back' || status === 'restored-baseline')
        return 'badge-warning';
    if (status === 'validate-failed' || status === 'failed')
        return 'badge-error';
    return 'badge-ghost';
});
const hasText = (value) => String(value ?? '').trim().length > 0;
const actionTypeText = (kind) => {
    switch (kind) {
        case 'validate':
            return t('configDiagActionValidate');
        case 'apply':
            return t('configDiagActionApply');
        case 'restore-baseline':
            return t('configDiagActionRestoreBaseline');
        case 'restore-revision':
            return t('configDiagActionRestoreRevision');
        default:
            return '—';
    }
};
const phaseText = (phase) => {
    switch (String(phase || '').trim()) {
        case 'validate':
            return t('configDiagPhaseValidate');
        case 'apply':
            return t('configDiagPhaseApply');
        case 'restart':
            return t('configDiagPhaseRestart');
        default:
            return '—';
    }
};
const recoveryText = (value) => {
    switch (String(value || '').trim()) {
        case 'none':
            return t('configDiagRecoveryNone');
        case 'previous-active':
            return t('configDiagRecoveryPreviousActive');
        case 'baseline':
            return t('configDiagRecoveryBaseline');
        case 'failed':
            return t('configDiagRecoveryFailed');
        default:
            return value || '—';
    }
};
const sourceText = (value) => {
    const source = String(value || '').trim();
    if (!source)
        return '—';
    if (source === 'draft')
        return t('configCompareSourceDraft');
    if (source === 'baseline')
        return t('configCompareSourceBaseline');
    if (source === 'active')
        return t('configCompareSourceActive');
    if (source.startsWith('history:'))
        return `${t('configHistoryRevisionLabel')} ${source.slice('history:'.length)}`;
    return source;
};
const setLastAction = (next) => {
    lastAction.value = {
        ...next,
        at: new Date().toISOString(),
    };
};
const fetchManagedPayloadText = async (kind) => {
    const r = await agentMihomoConfigManagedGetAPI(kind);
    if (!r.ok || !r.contentB64)
        return '';
    return decodeB64Utf8(r.contentB64);
};
const refreshManagedPayloads = async (state) => {
    const next = {
        active: '',
        draft: '',
        baseline: '',
    };
    const kinds = ['active', 'draft', 'baseline'];
    await Promise.all(kinds.map(async (kind) => {
        if (state[kind]?.exists) {
            next[kind] = await fetchManagedPayloadText(kind);
        }
    }));
    managedPayloads.value = next;
    return next;
};
const refreshLastSuccessfulPayload = async (state, nextPayloads) => {
    const last = state.lastSuccessful;
    if (!last?.exists || !last.rev) {
        lastSuccessfulPayload.value = '';
        return '';
    }
    if (last.current || (state.active?.rev && last.rev === state.active.rev)) {
        lastSuccessfulPayload.value = nextPayloads.active || '';
        return lastSuccessfulPayload.value;
    }
    try {
        const r = await agentMihomoConfigManagedGetRevAPI(last.rev);
        lastSuccessfulPayload.value = r.ok && r.contentB64 ? decodeB64Utf8(r.contentB64) : '';
    }
    catch {
        lastSuccessfulPayload.value = '';
    }
    return lastSuccessfulPayload.value;
};
const loadHistory = async () => {
    if (!agentEnabled.value)
        return;
    historyBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedHistoryAPI();
        historyItems.value = Array.isArray(r.items) ? r.items : [];
    }
    finally {
        historyBusy.value = false;
    }
};
const refreshManaged = async (loadEditor = false) => {
    const state = await agentMihomoConfigStateAPI();
    managedState.value = state;
    if (!state.ok)
        return false;
    const managedTexts = await refreshManagedPayloads(state);
    await refreshLastSuccessfulPayload(state, managedTexts);
    if (loadEditor) {
        if (state.draft?.exists) {
            payload.value = managedTexts.draft;
            path.value = state.draft?.path || path.value;
        }
        else if (state.active?.exists) {
            payload.value = managedTexts.active;
            path.value = state.active?.path || path.value;
        }
    }
    await loadHistory();
    return true;
};
const refreshAll = async (loadEditor = false) => {
    if (refreshBusy.value)
        return;
    refreshBusy.value = true;
    try {
        if (agentEnabled.value) {
            const ok = await refreshManaged(loadEditor);
            if (ok)
                return;
        }
        await legacyLoad();
    }
    finally {
        refreshBusy.value = false;
    }
};
const ensureDraftSaved = async () => {
    const r = await agentMihomoConfigManagedPutDraftAPI(payload.value || '');
    if (!r.ok) {
        throw new Error(r.error || 'save-failed');
    }
    await refreshManaged(false);
};
const saveDraft = async () => {
    if (!managedMode.value || actionBusy.value)
        return;
    actionBusy.value = true;
    try {
        await ensureDraftSaved();
        showNotification({ content: 'configDraftSavedRemoteSuccess', type: 'alert-success' });
    }
    catch (e) {
        showNotification({ content: 'configDraftSaveFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const copyFromManaged = async (from) => {
    if (!managedMode.value || actionBusy.value)
        return;
    actionBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedCopyAPI(from);
        if (!r.ok)
            throw new Error(r.error || 'copy-failed');
        await refreshManaged(false);
        payload.value = managedPayloads.value.draft;
        validationOutput.value = '';
        showNotification({ content: from === 'active' ? 'configDraftLoadedFromActive' : 'configDraftLoadedFromBaseline', type: 'alert-success' });
    }
    catch (e) {
        showNotification({ content: 'configDraftCopyFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const validateDraft = async () => {
    if (!managedMode.value || actionBusy.value)
        return;
    actionBusy.value = true;
    try {
        await ensureDraftSaved();
        const r = await agentMihomoConfigManagedValidateAPI('draft');
        validationOk.value = Boolean(r.ok);
        validationCmd.value = String(r.cmd || '');
        validationOutput.value = String(r.output || r.error || '');
        setLastAction({
            kind: 'validate',
            ok: Boolean(r.ok),
            phase: r.phase || 'validate',
            source: r.source || 'draft',
            validateCmd: String(r.cmd || ''),
            exitCode: r.exitCode,
            output: String(r.output || ''),
            error: String(r.error || ''),
        });
        showNotification({ content: r.ok ? 'configValidationSuccess' : 'configValidationFailedToast', type: r.ok ? 'alert-success' : 'alert-error' });
    }
    catch (e) {
        validationOk.value = false;
        validationCmd.value = '';
        validationOutput.value = e?.message || 'failed';
        setLastAction({
            kind: 'validate',
            ok: false,
            phase: 'validate',
            source: 'draft',
            error: e?.message || 'failed',
        });
        showNotification({ content: 'configValidationFailedToast', type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const applyDraft = async () => {
    if (!managedMode.value || actionBusy.value)
        return;
    actionBusy.value = true;
    try {
        await ensureDraftSaved();
        const r = await agentMihomoConfigManagedApplyAPI();
        await refreshManaged(true);
        validationOk.value = Boolean(r.ok);
        validationCmd.value = String(r.validateCmd || '');
        validationOutput.value = String(r.restartOutput || r.output || r.error || '');
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
        });
        if (!r.ok)
            throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'apply-failed');
        showNotification({ content: 'configApplySuccess', type: 'alert-success' });
    }
    catch (e) {
        if (!lastAction.value || lastAction.value.kind !== 'apply') {
            setLastAction({
                kind: 'apply',
                ok: false,
                phase: 'apply',
                source: 'draft',
                error: e?.message || 'failed',
            });
        }
        showNotification({ content: 'configApplyFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const setBaselineFromActive = async () => {
    if (!managedMode.value || actionBusy.value)
        return;
    if (!window.confirm('Сделать текущий активный конфиг новым эталонным?'))
        return;
    actionBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedSetBaselineFromActiveAPI();
        if (!r.ok)
            throw new Error(r.error || 'baseline-failed');
        await refreshManaged(false);
        showNotification({ content: 'configBaselinePromoted', type: 'alert-success' });
    }
    catch (e) {
        showNotification({ content: 'configBaselinePromoteFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const restoreBaseline = async () => {
    if (!managedMode.value || actionBusy.value)
        return;
    if (!window.confirm('Восстановить эталонный конфиг как активный?'))
        return;
    actionBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedRestoreBaselineAPI();
        await refreshManaged(true);
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
        });
        if (!r.ok)
            throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'restore-failed');
        showNotification({ content: 'configBaselineRestored', type: 'alert-success' });
    }
    catch (e) {
        if (!lastAction.value || lastAction.value.kind !== 'restore-baseline') {
            setLastAction({
                kind: 'restore-baseline',
                ok: false,
                phase: 'apply',
                source: 'baseline',
                error: e?.message || 'failed',
            });
        }
        showNotification({ content: 'configBaselineRestoreFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const loadHistoryRev = async (rev) => {
    if (actionBusy.value)
        return;
    actionBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedGetRevAPI(rev);
        if (!r.ok || !r.contentB64)
            throw new Error(r.error || 'not-found');
        payload.value = decodeB64Utf8(r.contentB64);
        validationOutput.value = '';
        validationCmd.value = '';
        showNotification({ content: 'configHistoryLoadedIntoEditor', type: 'alert-success' });
    }
    catch (e) {
        showNotification({ content: 'configHistoryLoadFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const restoreHistoryRev = async (rev) => {
    if (actionBusy.value)
        return;
    if (!window.confirm(`Восстановить ревизию ${rev} как активный конфиг?`))
        return;
    actionBusy.value = true;
    try {
        const r = await agentMihomoConfigManagedRestoreRevAPI(rev);
        await refreshManaged(true);
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
        });
        if (!r.ok)
            throw new Error(r.error || r.output || r.restartOutput || r.firstRestartOutput || 'restore-failed');
        showNotification({ content: 'configHistoryRestoreSuccess', type: 'alert-success' });
    }
    catch (e) {
        if (!lastAction.value || lastAction.value.kind !== 'restore-revision') {
            setLastAction({
                kind: 'restore-revision',
                ok: false,
                phase: 'apply',
                source: `history:${rev}`,
                error: e?.message || 'failed',
            });
        }
        showNotification({ content: 'configHistoryRestoreFailed', params: { error: e?.message || 'failed' }, type: 'alert-error' });
    }
    finally {
        actionBusy.value = false;
    }
};
const loadLastSuccessfulIntoEditor = () => {
    if (!lastSuccessfulExists.value)
        return;
    payload.value = lastSuccessfulPayload.value || '';
    validationOutput.value = '';
    validationCmd.value = '';
    showNotification({ content: 'configLastSuccessfulLoadedIntoEditor', type: 'alert-success' });
};
const compareDraftWithLastSuccessful = () => {
    if (!lastSuccessfulExists.value)
        return;
    compareLeft.value = 'last-success';
    compareRight.value = diffSourceAvailable('draft') ? 'draft' : 'editor';
};
const compareActiveWithLastSuccessful = () => {
    if (!lastSuccessfulExists.value)
        return;
    compareLeft.value = 'last-success';
    compareRight.value = diffSourceAvailable('active') ? 'active' : 'editor';
};
const diffSourceLabel = (kind) => {
    switch (kind) {
        case 'active':
            return t('configCompareSourceActive');
        case 'draft':
            return t('configCompareSourceDraft');
        case 'baseline':
            return t('configCompareSourceBaseline');
        case 'last-success':
            return t('configCompareSourceLastSuccess');
        case 'editor':
        default:
            return t('configCompareSourceEditor');
    }
};
const diffSourceAvailable = (kind) => {
    if (kind === 'editor')
        return true;
    if (kind === 'last-success')
        return Boolean(managedState.value?.lastSuccessful?.exists);
    return Boolean(managedState.value?.[kind]?.exists);
};
const normalizeDiffSource = (kind) => {
    if (diffSourceAvailable(kind))
        return kind;
    if (kind !== 'editor')
        return 'editor';
    return 'editor';
};
const diffSourceOptions = computed(() => ([
    { value: 'active', label: diffSourceLabel('active'), disabled: !diffSourceAvailable('active') },
    { value: 'draft', label: diffSourceLabel('draft'), disabled: !diffSourceAvailable('draft') },
    { value: 'baseline', label: diffSourceLabel('baseline'), disabled: !diffSourceAvailable('baseline') },
    { value: 'last-success', label: diffSourceLabel('last-success'), disabled: !diffSourceAvailable('last-success') },
    { value: 'editor', label: diffSourceLabel('editor'), disabled: false },
]));
const overviewSourceResolved = computed(() => normalizeDiffSource(overviewSource.value));
const emptyConfigOverview = () => ({
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
});
const unquoteYamlKey = (value) => {
    const s = String(value || '').trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))
        return s.slice(1, -1);
    return s;
};
const sanitizeScalarValue = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    const withoutComment = trimmed.replace(/\s+#.*$/, '').trim();
    if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
        return withoutComment.slice(1, -1);
    }
    return withoutComment;
};
const countListItemsInSection = (lines) => lines.reduce((acc, line) => acc + (/^\s{2}-\s+/.test(line) ? 1 : 0), 0);
const countMapItemsInSection = (lines) => lines.reduce((acc, line) => {
    if (/^\s{2}(?:[^#\s][^:]*|"[^"]+"|'[^']+'):\s*(?:#.*)?$/.test(line))
        return acc + 1;
    return acc;
}, 0);
const detectSectionState = (sectionLines) => {
    if (!sectionLines || !sectionLines.length)
        return 'missing';
    const enabledLine = sectionLines.find((line) => /^\s{2}enabled:\s*/.test(line) || /^\s{2}enable:\s*/.test(line));
    if (!enabledLine)
        return 'present';
    const raw = sanitizeScalarValue(enabledLine.replace(/^\s{2}(?:enabled|enable):\s*/, ''));
    const lowered = raw.toLowerCase();
    if (['true', 'on', 'yes'].includes(lowered))
        return 'enabled';
    if (['false', 'off', 'no'].includes(lowered))
        return 'disabled';
    return 'present';
};
const buildConfigOverview = (value) => {
    const normalized = normalizeDiffText(value);
    const overview = emptyConfigOverview();
    const trimmed = normalized.trim();
    if (!trimmed)
        return overview;
    const lines = normalized.split('\n');
    overview.stats.totalLines = lines.length;
    overview.stats.nonEmptyLines = lines.filter((line) => line.trim().length > 0).length;
    overview.stats.commentLines = lines.filter((line) => /^\s*#/.test(line)).length;
    const sectionLines = {};
    let currentTopLevel = '';
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        const trimmedLine = line.trim();
        if (!trimmedLine.length) {
            if (currentTopLevel)
                sectionLines[currentTopLevel].push(line);
            continue;
        }
        if (/^#/.test(trimmedLine)) {
            if (currentTopLevel)
                sectionLines[currentTopLevel].push(line);
            continue;
        }
        const topMatch = line.match(/^([A-Za-z0-9_.@-]+|"[^"]+"|'[^']+'):\s*(.*)$/);
        if (topMatch && !/^\s/.test(line)) {
            const key = unquoteYamlKey(topMatch[1]);
            currentTopLevel = key;
            if (!overview.topLevelSections.includes(key))
                overview.topLevelSections.push(key);
            sectionLines[key] = [];
            const rest = sanitizeScalarValue(topMatch[2]);
            if (rest && !['|', '|-', '>', '>-', '{}', '[]'].includes(rest)) {
                switch (key) {
                    case 'mode':
                        overview.scalars.mode = rest;
                        break;
                    case 'log-level':
                        overview.scalars.logLevel = rest;
                        break;
                    case 'allow-lan':
                        overview.scalars.allowLan = rest;
                        break;
                    case 'ipv6':
                        overview.scalars.ipv6 = rest;
                        break;
                    case 'unified-delay':
                        overview.scalars.unifiedDelay = rest;
                        break;
                    case 'find-process-mode':
                        overview.scalars.findProcessMode = rest;
                        break;
                    case 'geodata-mode':
                        overview.scalars.geodataMode = rest;
                        break;
                    case 'external-controller':
                        overview.scalars.controller = rest;
                        break;
                    case 'secret':
                        overview.scalars.secretState = rest ? t('configOverviewSecretSet') : t('configOverviewSecretEmpty');
                        break;
                    case 'port':
                        overview.scalars.port = rest;
                        break;
                    case 'mixed-port':
                        overview.scalars.mixedPort = rest;
                        break;
                    case 'socks-port':
                        overview.scalars.socksPort = rest;
                        break;
                    case 'redir-port':
                        overview.scalars.redirPort = rest;
                        break;
                    case 'tproxy-port':
                        overview.scalars.tproxyPort = rest;
                        break;
                }
            }
            continue;
        }
        if (currentTopLevel)
            sectionLines[currentTopLevel].push(line);
    }
    overview.counts.proxies = countListItemsInSection(sectionLines['proxies'] || []);
    overview.counts.proxyGroups = countListItemsInSection(sectionLines['proxy-groups'] || []);
    overview.counts.rules = countListItemsInSection(sectionLines['rules'] || []);
    overview.counts.proxyProviders = countMapItemsInSection(sectionLines['proxy-providers'] || []);
    overview.counts.ruleProviders = countMapItemsInSection(sectionLines['rule-providers'] || []);
    overview.sections.tun = detectSectionState(sectionLines.tun);
    overview.sections.dns = detectSectionState(sectionLines.dns);
    overview.sections.profile = detectSectionState(sectionLines.profile);
    overview.sections.sniffer = detectSectionState(sectionLines.sniffer);
    if (!overview.scalars.secretState)
        overview.scalars.secretState = overview.topLevelSections.includes('secret') ? t('configOverviewSecretEmpty') : t('configOverviewSecretNotSet');
    return overview;
};
const overviewSummary = computed(() => buildConfigOverview(diffSourceContent(overviewSourceResolved.value)));
const overviewHasContent = computed(() => overviewSummary.value.stats.totalLines > 0);
const quickEditorHasPayload = computed(() => normalizeDiffText(payload.value).trim().length > 0);
const quickEditorPreviewChanges = computed(() => {
    const source = normalizeDiffText(payload.value);
    if (!source.trim().length)
        return [];
    return quickEditorFieldMeta.flatMap((field) => {
        const before = getQuickEditorFieldValue(source, field);
        const after = String(quickEditor.value[field.key] || '').trim();
        if (before === after)
            return [];
        let changeType = 'change';
        if (!before.length && after.length)
            changeType = 'add';
        else if (before.length && !after.length)
            changeType = 'remove';
        return [{ key: field.key, group: field.group, changeType, before, after }];
    });
});
const quickEditorPreviewSummary = computed(() => quickEditorPreviewChanges.value.reduce((acc, item) => {
    if (item.changeType === 'add')
        acc.added += 1;
    else if (item.changeType === 'remove')
        acc.removed += 1;
    else
        acc.changed += 1;
    return acc;
}, { added: 0, changed: 0, removed: 0 }));
const quickEditorAffectedGroups = computed(() => Array.from(new Set(quickEditorPreviewChanges.value.map((item) => item.group))));
const quickEditorCanApply = computed(() => quickEditorHasPayload.value && quickEditorPreviewChanges.value.length > 0);
const advancedSectionsAppliedPreview = computed(() => upsertAdvancedSectionsInConfig(payload.value, advancedSectionsForm.value));
const advancedSectionsCanApply = computed(() => quickEditorHasPayload.value && normalizeDiffText(advancedSectionsAppliedPreview.value) !== normalizeDiffText(payload.value));
const advancedSectionsSummary = computed(() => {
    const countLines = (value) => normalizeDiffText(value).split('\n').map((line) => line.trim()).filter(Boolean).length;
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
        + countLines(advancedSectionsForm.value.tunExcludeInterfaceText);
    const profile = [
        advancedSectionsForm.value.profileStoreSelected,
        advancedSectionsForm.value.profileStoreFakeIp,
    ].filter((item) => String(item || '').trim().length).length;
    const sniffer = [
        advancedSectionsForm.value.snifferEnable,
        advancedSectionsForm.value.snifferParsePureIp,
        advancedSectionsForm.value.snifferOverrideDestination,
    ].filter((item) => String(item || '').trim().length).length
        + countLines(advancedSectionsForm.value.snifferForceDomainText)
        + countLines(advancedSectionsForm.value.snifferSkipDomainText)
        + countLines(advancedSectionsForm.value.snifferSniffText);
    return {
        tun,
        profile,
        sniffer,
        totalItems: tun + profile + sniffer,
    };
});
const dnsEditorAppliedPreview = computed(() => upsertDnsEditorInConfig(payload.value, dnsEditorForm.value));
const dnsEditorCanApply = computed(() => quickEditorHasPayload.value && normalizeDiffText(dnsEditorAppliedPreview.value) !== normalizeDiffText(payload.value));
const dnsStructuredSummary = computed(() => {
    const countLines = (value) => normalizeDiffText(value).split('\n').map((line) => line.trim()).filter(Boolean).length;
    return {
        defaultNameserver: countLines(dnsEditorForm.value.defaultNameserverText),
        nameserver: countLines(dnsEditorForm.value.nameserverText),
        fallback: countLines(dnsEditorForm.value.fallbackText),
        fakeIpFilter: countLines(dnsEditorForm.value.fakeIpFilterText),
        dnsHijack: countLines(dnsEditorForm.value.dnsHijackText),
        nameserverPolicy: countLines(dnsEditorForm.value.nameserverPolicyText),
        totalItems: countLines(dnsEditorForm.value.defaultNameserverText)
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
    };
});
const parsedProxies = computed(() => parseProxiesFromConfig(payload.value));
const selectedProxyEntry = computed(() => parsedProxies.value.find((item) => item.name === proxySelectedName.value) || null);
const normalizedProxyListQuery = computed(() => String(proxyListQuery.value || '').trim().toLowerCase());
const filteredProxies = computed(() => {
    const query = normalizedProxyListQuery.value;
    if (!query)
        return parsedProxies.value;
    const parts = query.split(/\s+/).filter(Boolean);
    if (!parts.length)
        return parsedProxies.value;
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
        ].join(' ').toLowerCase();
        return parts.every((part) => haystack.includes(part));
    });
});
const normalizedProxyType = computed(() => String(proxyForm.value.type || '').trim().toLowerCase());
const proxyTypePresets = computed(() => [
    { id: 'ss', label: 'ss' },
    { id: 'vmess', label: 'vmess' },
    { id: 'vless', label: 'vless' },
    { id: 'trojan', label: 'trojan' },
    { id: 'wireguard', label: 'wireguard' },
    { id: 'hysteria2', label: 'hysteria2' },
    { id: 'tuic', label: 'tuic' },
]);
const proxyFormHasSecurityValues = computed(() => [proxyForm.value.tls, proxyForm.value.skipCertVerify, proxyForm.value.sni, proxyForm.value.servername, proxyForm.value.clientFingerprint, proxyForm.value.alpnText, proxyForm.value.realityPublicKey, proxyForm.value.realityShortId].some((value) => String(value || '').trim().length > 0));
const proxyFormHasAuthValues = computed(() => [proxyForm.value.uuid, proxyForm.value.password, proxyForm.value.cipher, proxyForm.value.flow].some((value) => String(value || '').trim().length > 0));
const proxyFormHasTransportValues = computed(() => [proxyForm.value.network, proxyForm.value.wsPath, proxyForm.value.wsHeadersBody, proxyForm.value.grpcServiceName, proxyForm.value.grpcMultiMode].some((value) => String(value || '').trim().length > 0));
const proxyFormHasPluginValues = computed(() => [proxyForm.value.plugin, proxyForm.value.pluginOptsBody].some((value) => String(value || '').trim().length > 0));
const proxyFormHasHttpOptsValues = computed(() => [proxyForm.value.httpMethod, proxyForm.value.httpPathText, proxyForm.value.httpHeadersBody].some((value) => String(value || '').trim().length > 0));
const proxyFormHasSmuxValues = computed(() => [proxyForm.value.smuxEnabled, proxyForm.value.smuxProtocol, proxyForm.value.smuxMaxConnections, proxyForm.value.smuxMinStreams, proxyForm.value.smuxMaxStreams, proxyForm.value.smuxPadding, proxyForm.value.smuxStatistic].some((value) => String(value || '').trim().length > 0));
const proxyFormHasWireguardValues = computed(() => [proxyForm.value.wireguardIpText, proxyForm.value.wireguardIpv6Text, proxyForm.value.wireguardPrivateKey, proxyForm.value.wireguardPublicKey, proxyForm.value.wireguardPresharedKey, proxyForm.value.wireguardMtu, proxyForm.value.wireguardReservedText, proxyForm.value.wireguardWorkers].some((value) => String(value || '').trim().length > 0));
const proxyFormHasHysteria2Values = computed(() => [proxyForm.value.hysteriaUp, proxyForm.value.hysteriaDown, proxyForm.value.hysteriaObfs, proxyForm.value.hysteriaObfsPassword].some((value) => String(value || '').trim().length > 0));
const proxyFormHasTuicValues = computed(() => [proxyForm.value.tuicCongestionController, proxyForm.value.tuicUdpRelayMode, proxyForm.value.tuicHeartbeatInterval, proxyForm.value.tuicRequestTimeout, proxyForm.value.tuicFastOpen, proxyForm.value.tuicReduceRtt, proxyForm.value.tuicDisableSni].some((value) => String(value || '').trim().length > 0));
const proxyTypeVisibility = computed(() => {
    const type = normalizedProxyType.value;
    const network = String(proxyForm.value.network || '').trim().toLowerCase();
    const securityTypes = ['vmess', 'vless', 'trojan', 'http', 'hysteria2', 'tuic'];
    const authTypes = ['ss', 'vmess', 'vless', 'trojan', 'socks5', 'http', 'hysteria2', 'tuic'];
    const transportTypes = ['vmess', 'vless', 'trojan'];
    const pluginTypes = ['ss', 'trojan'];
    const smuxTypes = ['vmess', 'vless', 'trojan', 'hysteria2', 'tuic'];
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
    };
});
const proxyTypeSummary = computed(() => {
    switch (normalizedProxyType.value) {
        case 'ss': return t('configProxiesTypeSummarySs');
        case 'vmess': return t('configProxiesTypeSummaryVmess');
        case 'vless': return t('configProxiesTypeSummaryVless');
        case 'trojan': return t('configProxiesTypeSummaryTrojan');
        case 'wireguard': return t('configProxiesTypeSummaryWireguard');
        case 'hysteria2': return t('configProxiesTypeSummaryHysteria2');
        case 'tuic': return t('configProxiesTypeSummaryTuic');
        default: return t('configProxiesTypeSummaryDefault');
    }
});
const proxyTypeProfileLabel = computed(() => `${t('configProxiesFieldType')}: ${String(proxyForm.value.type || '').trim() || t('configQuickEditorKeepEmpty')}`);
const proxyTypeFocusBadges = computed(() => {
    const out = [];
    if (proxyTypeVisibility.value.security)
        out.push(t('configProxiesSecurityTitle'));
    if (proxyTypeVisibility.value.auth)
        out.push(t('configProxiesAuthTitle'));
    if (proxyTypeVisibility.value.transport)
        out.push(t('configProxiesTransportTitle'));
    if (proxyTypeVisibility.value.plugin)
        out.push(t('configProxiesPluginTitle'));
    if (proxyTypeVisibility.value.httpOpts)
        out.push(t('configProxiesHttpOptsTitle'));
    if (proxyTypeVisibility.value.smux)
        out.push(t('configProxiesSmuxTitle'));
    if (proxyTypeVisibility.value.wireguard)
        out.push(t('configProxiesWireguardTitle'));
    if (proxyTypeVisibility.value.hysteria2)
        out.push('hysteria2');
    if (proxyTypeVisibility.value.tuic)
        out.push('tuic');
    return Array.from(new Set(out));
});
const topProxyTypeCounts = computed(() => {
    const counts = new Map();
    for (const item of parsedProxies.value) {
        const key = String(item.type || '').trim() || '—';
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
        .slice(0, 8);
});
const proxyFormCanSave = computed(() => String(proxyForm.value.name || '').trim().length > 0 && String(proxyForm.value.type || '').trim().length > 0);
const proxyReferencesSummary = computed(() => {
    const entry = selectedProxyEntry.value;
    if (!entry)
        return { groupRefs: [], ruleRefs: [] };
    return {
        groupRefs: entry.references.filter((item) => item.kind === 'group'),
        ruleRefs: entry.references.filter((item) => item.kind === 'rule'),
    };
});
const proxyDisablePlan = computed(() => {
    const name = String(selectedProxyEntry.value?.name || '').trim();
    if (!name)
        return { impacts: [], rulesTouched: 0, ruleSamples: [] };
    return simulateProxyDisableImpact(payload.value, name);
});
const parsedProxyProviders = computed(() => parseProxyProvidersFromConfig(payload.value));
const selectedProxyProviderEntry = computed(() => parsedProxyProviders.value.find((item) => item.name === proxyProviderSelectedName.value) || null);
const proxyProviderFormCanSave = computed(() => String(proxyProviderForm.value.name || '').trim().length > 0);
const normalizedProxyProviderListFilter = computed(() => String(proxyProviderListQuery.value || '').trim().toLowerCase());
const filteredProxyProviders = computed(() => {
    const query = normalizedProxyProviderListFilter.value;
    if (!query)
        return parsedProxyProviders.value;
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
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
});
const normalizedProxyProviderType = computed(() => String(proxyProviderForm.value.type || '').trim().toLowerCase());
const proxyProviderTypePresets = ['http', 'file', 'inline'];
const proxyProviderTypeProfile = computed(() => {
    switch (normalizedProxyProviderType.value) {
        case 'file':
            return {
                accent: 'badge-secondary',
                summary: t('configProxyProvidersTypeSummaryFile'),
            };
        case 'inline':
            return {
                accent: 'badge-accent',
                summary: t('configProxyProvidersTypeSummaryInline'),
            };
        default:
            return {
                accent: 'badge-info',
                summary: t('configProxyProvidersTypeSummaryHttp'),
            };
    }
});
const proxyProviderDisableImpact = computed(() => {
    const name = String(selectedProxyProviderEntry.value?.name || '').trim();
    if (!name)
        return [];
    return simulateProxyProviderDisableImpact(payload.value, name);
});
const parsedProxyGroups = computed(() => parseProxyGroupsFromConfig(payload.value));
const selectedProxyGroupEntry = computed(() => parsedProxyGroups.value.find((item) => item.name === proxyGroupSelectedName.value) || null);
const proxyGroupFormCanSave = computed(() => String(proxyGroupForm.value.name || '').trim().length > 0);
const proxyGroupDisablePlan = computed(() => {
    const name = String(selectedProxyGroupEntry.value?.name || '').trim();
    if (!name)
        return { impacts: [], rulesTouched: 0, ruleSamples: [] };
    return simulateProxyGroupDisableImpact(payload.value, name);
});
const proxyGroupReferencesSummary = computed(() => {
    const entry = selectedProxyGroupEntry.value;
    if (!entry)
        return { groupRefs: [], ruleRefs: [] };
    return {
        groupRefs: entry.references.filter((item) => item.kind === 'group'),
        ruleRefs: entry.references.filter((item) => item.kind === 'rule'),
    };
});
const splitFormList = (value) => String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
const joinFormList = (items) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean))).join('\n');
const makeUniqueName = (base, existing) => {
    const normalizedBase = String(base || '').trim() || 'item';
    const used = new Set(existing.map((item) => String(item || '').trim()).filter(Boolean));
    if (!used.has(normalizedBase))
        return normalizedBase;
    let counter = 2;
    let candidate = `${normalizedBase}-${counter}`;
    while (used.has(candidate)) {
        counter += 1;
        candidate = `${normalizedBase}-${counter}`;
    }
    return candidate;
};
const slugifyTemplateValue = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
const proxyCreationTemplates = [
    { id: 'vless-reality', labelKey: 'configProxiesTemplateVlessReality', descKey: 'configProxiesTemplateVlessRealityDesc' },
    { id: 'vless-ws-tls', labelKey: 'configProxiesTemplateVlessWsTls', descKey: 'configProxiesTemplateVlessWsTlsDesc' },
    { id: 'vmess-ws-tls', labelKey: 'configProxiesTemplateVmessWsTls', descKey: 'configProxiesTemplateVmessWsTlsDesc' },
    { id: 'trojan-grpc', labelKey: 'configProxiesTemplateTrojanGrpc', descKey: 'configProxiesTemplateTrojanGrpcDesc' },
    { id: 'trojan-tls', labelKey: 'configProxiesTemplateTrojanTls', descKey: 'configProxiesTemplateTrojanTlsDesc' },
    { id: 'wireguard-peer', labelKey: 'configProxiesTemplateWireguardPeer', descKey: 'configProxiesTemplateWireguardPeerDesc' },
    { id: 'hysteria2-basic', labelKey: 'configProxiesTemplateHysteria2Basic', descKey: 'configProxiesTemplateHysteria2BasicDesc' },
    { id: 'tuic-basic', labelKey: 'configProxiesTemplateTuicBasic', descKey: 'configProxiesTemplateTuicBasicDesc' },
];
const proxyProviderCreationTemplates = [
    { id: 'remote-http', labelKey: 'configProxyProvidersTemplateRemoteHttp', descKey: 'configProxyProvidersTemplateRemoteHttpDesc' },
    { id: 'local-file', labelKey: 'configProxyProvidersTemplateLocalFile', descKey: 'configProxyProvidersTemplateLocalFileDesc' },
    { id: 'inline-source', labelKey: 'configProxyProvidersTemplateInlineSource', descKey: 'configProxyProvidersTemplateInlineSourceDesc' },
];
const proxyGroupCreationTemplates = [
    { id: 'select', labelKey: 'configProxyGroupsTemplateSelect', descKey: 'configProxyGroupsTemplateSelectDesc' },
    { id: 'url-test', labelKey: 'configProxyGroupsTemplateUrlTest', descKey: 'configProxyGroupsTemplateUrlTestDesc' },
    { id: 'fallback', labelKey: 'configProxyGroupsTemplateFallback', descKey: 'configProxyGroupsTemplateFallbackDesc' },
    { id: 'load-balance', labelKey: 'configProxyGroupsTemplateLoadBalance', descKey: 'configProxyGroupsTemplateLoadBalanceDesc' },
    { id: 'relay', labelKey: 'configProxyGroupsTemplateRelay', descKey: 'configProxyGroupsTemplateRelayDesc' },
];
const ruleProviderCreationTemplates = [
    { id: 'classical-remote', labelKey: 'configRuleProvidersTemplateClassicalRemote', descKey: 'configRuleProvidersTemplateClassicalRemoteDesc' },
    { id: 'domain-remote', labelKey: 'configRuleProvidersTemplateDomainRemote', descKey: 'configRuleProvidersTemplateDomainRemoteDesc' },
    { id: 'ipcidr-remote', labelKey: 'configRuleProvidersTemplateIpcidrRemote', descKey: 'configRuleProvidersTemplateIpcidrRemoteDesc' },
];
const emptyProxyCreationWizard = () => ({
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
});
const emptyProxyProviderCreationWizard = () => ({
    active: false,
    step: 1,
    templateId: '',
    name: '',
    type: '',
    url: '',
    path: '',
    interval: '',
});
const emptyProxyGroupCreationWizard = () => ({
    active: false,
    step: 1,
    templateId: '',
    name: '',
    type: '',
    membersText: '',
    providersText: '',
    url: '',
    interval: '',
});
const emptyRuleProviderCreationWizard = () => ({
    active: false,
    step: 1,
    templateId: '',
    name: '',
    behavior: '',
    url: '',
    path: '',
    interval: '',
});
const proxyCreationWizard = ref(emptyProxyCreationWizard());
const proxyProviderCreationWizard = ref(emptyProxyProviderCreationWizard());
const proxyGroupCreationWizard = ref(emptyProxyGroupCreationWizard());
const ruleProviderCreationWizard = ref(emptyRuleProviderCreationWizard());
const normalizedProxyCreationWizardType = computed(() => String(proxyCreationWizard.value.type || '').trim().toLowerCase());
const proxyCreationWizardVisibility = computed(() => {
    const type = normalizedProxyCreationWizardType.value;
    const network = String(proxyCreationWizard.value.network || '').trim().toLowerCase();
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
    };
});
const proxyCreationWizardTypeSummary = computed(() => {
    switch (normalizedProxyCreationWizardType.value) {
        case 'ss': return t('configProxiesTypeSummarySs');
        case 'vmess': return t('configProxiesTypeSummaryVmess');
        case 'vless': return t('configProxiesTypeSummaryVless');
        case 'trojan': return t('configProxiesTypeSummaryTrojan');
        case 'wireguard': return t('configProxiesTypeSummaryWireguard');
        case 'hysteria2': return t('configProxiesTypeSummaryHysteria2');
        case 'tuic': return t('configProxiesTypeSummaryTuic');
        default: return t('configProxiesTypeSummaryDefault');
    }
});
const proxyCreationWizardFocusBadges = computed(() => {
    const out = [];
    const visibility = proxyCreationWizardVisibility.value;
    if (visibility.security)
        out.push(t('configProxiesSecurityTitle'));
    if (visibility.uuid || visibility.password || visibility.cipher || visibility.flow || visibility.wireguard)
        out.push(t('configProxiesAuthTitle'));
    if (visibility.transport || visibility.wsPath || visibility.grpcServiceName)
        out.push(t('configProxiesTransportTitle'));
    if (visibility.reality)
        out.push('reality');
    if (visibility.wireguard)
        out.push(t('configProxiesWireguardTitle'));
    if (visibility.hysteria2)
        out.push('hysteria2');
    if (visibility.tuic)
        out.push('tuic');
    return Array.from(new Set(out));
});
const activeProxyCreationWizardTemplate = computed(() => proxyCreationTemplates.find((item) => item.id === proxyCreationWizard.value.templateId) || null);
const proxyCreationWizardScenarioBadges = computed(() => {
    switch (proxyCreationWizard.value.templateId) {
        case 'vless-reality':
            return ['Reality', 'TLS', 'Vision', 'uuid'];
        case 'vless-ws-tls':
            return ['WS', 'TLS', 'uuid', 'path'];
        case 'vmess-ws-tls':
            return ['WS', 'TLS', 'uuid', 'vmess'];
        case 'trojan-grpc':
            return ['gRPC', 'TLS', 'password'];
        case 'trojan-tls':
            return ['TLS', 'password'];
        case 'wireguard-peer':
        case 'wireguard-basic':
            return ['WireGuard', 'peer', 'keys', 'IP'];
        case 'hysteria2-basic':
            return ['UDP', 'TLS', 'obfs'];
        case 'tuic-basic':
            return ['UDP', 'TLS', 'uuid', 'password'];
        default:
            return proxyCreationWizardFocusBadges.value;
    }
});
const proxyCreationWizardScenarioSummary = computed(() => {
    const template = activeProxyCreationWizardTemplate.value;
    return template ? t(template.descKey) : t('configProxiesWizardTip');
});
const proxyCreationWizardRequiredFields = computed(() => {
    const state = proxyCreationWizard.value;
    const text = (value) => String(value || '').trim();
    const fields = [
        { label: t('configProxiesFieldName'), ok: Boolean(text(state.name)) },
        { label: t('configProxiesFieldServer'), ok: Boolean(text(state.server)) },
        { label: t('configProxiesFieldPort'), ok: Boolean(text(state.port)) },
    ];
    switch (state.templateId) {
        case 'vless-reality':
            fields.push({ label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) }, { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) }, { label: t('configProxiesFieldRealityPublicKey'), ok: Boolean(text(state.realityPublicKey)) }, { label: t('configProxiesFieldFlow'), ok: Boolean(text(state.flow)) });
            break;
        case 'vless-ws-tls':
        case 'vmess-ws-tls':
            fields.push({ label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) }, { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) }, { label: t('configProxiesFieldWsPath'), ok: Boolean(text(state.wsPath)) });
            break;
        case 'trojan-grpc':
            fields.push({ label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) }, { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) }, { label: t('configProxiesFieldGrpcServiceName'), ok: Boolean(text(state.grpcServiceName)) });
            break;
        case 'trojan-tls':
        case 'hysteria2-basic':
            fields.push({ label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) }, { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) });
            break;
        case 'wireguard-peer':
        case 'wireguard-basic':
            fields.push({ label: t('configProxiesFieldWireguardIp'), ok: Boolean(text(state.wireguardIpText)) }, { label: t('configProxiesFieldWireguardPrivateKey'), ok: Boolean(text(state.wireguardPrivateKey)) }, { label: t('configProxiesFieldWireguardPublicKey'), ok: Boolean(text(state.wireguardPublicKey)) });
            break;
        case 'tuic-basic':
            fields.push({ label: t('configProxiesFieldUuid'), ok: Boolean(text(state.uuid)) }, { label: t('configProxiesFieldPassword'), ok: Boolean(text(state.password)) }, { label: t('configProxiesFieldServername'), ok: Boolean(text(state.servername)) });
            break;
        default:
            break;
    }
    return fields;
});
const proxyCreationWizardMissingFieldLabels = computed(() => proxyCreationWizardRequiredFields.value.filter((item) => !item.ok).map((item) => item.label));
const proxyCreationWizardCanProceed = computed(() => proxyCreationWizardMissingFieldLabels.value.length === 0);
const proxyCreationWizardTransportSummary = computed(() => {
    const parts = [];
    const type = normalizedProxyCreationWizardType.value;
    if (String(proxyCreationWizard.value.network || '').trim())
        parts.push(String(proxyCreationWizard.value.network || '').trim());
    if (String(proxyCreationWizard.value.wsPath || '').trim())
        parts.push(`ws:${String(proxyCreationWizard.value.wsPath || '').trim()}`);
    if (String(proxyCreationWizard.value.grpcServiceName || '').trim())
        parts.push(`grpc:${String(proxyCreationWizard.value.grpcServiceName || '').trim()}`);
    if (String(proxyCreationWizard.value.tls || '').trim())
        parts.push(`TLS=${String(proxyCreationWizard.value.tls || '').trim()}`);
    if (type === 'wireguard' && String(proxyCreationWizard.value.wireguardMtu || '').trim())
        parts.push(`mtu=${String(proxyCreationWizard.value.wireguardMtu || '').trim()}`);
    if (type === 'tuic' && String(proxyCreationWizard.value.tuicUdpRelayMode || '').trim())
        parts.push(`udp=${String(proxyCreationWizard.value.tuicUdpRelayMode || '').trim()}`);
    return parts.length ? parts.join(' · ') : '—';
});
const proxyCreationWizardAuthSummary = computed(() => {
    const parts = [];
    if (String(proxyCreationWizard.value.uuid || '').trim())
        parts.push(`uuid:${String(proxyCreationWizard.value.uuid || '').trim()}`);
    if (String(proxyCreationWizard.value.password || '').trim())
        parts.push(`password:${String(proxyCreationWizard.value.password || '').trim()}`);
    if (String(proxyCreationWizard.value.cipher || '').trim())
        parts.push(`cipher:${String(proxyCreationWizard.value.cipher || '').trim()}`);
    if (String(proxyCreationWizard.value.flow || '').trim())
        parts.push(`flow:${String(proxyCreationWizard.value.flow || '').trim()}`);
    if (normalizedProxyCreationWizardType.value === 'wireguard') {
        if (String(proxyCreationWizard.value.wireguardIpText || '').trim())
            parts.push(`ip:${String(proxyCreationWizard.value.wireguardIpText || '').trim()}`);
        if (String(proxyCreationWizard.value.wireguardPublicKey || '').trim())
            parts.push('public-key');
        if (String(proxyCreationWizard.value.wireguardPrivateKey || '').trim())
            parts.push('private-key');
    }
    return parts.length ? parts.join(' · ') : '—';
});
const buildPreferredGroupMembers = (limit = 3) => {
    const fromProxies = parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const fromGroups = parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const unique = Array.from(new Set([...fromProxies, ...fromGroups]));
    return unique.slice(0, Math.max(1, limit));
};
const buildProviderRefs = (limit = 2) => Array.from(new Set(parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean))).slice(0, limit);
const toggleProxyGroupListValue = (field, item) => {
    const normalized = String(item || '').trim();
    if (!normalized)
        return;
    const current = splitFormList(proxyGroupForm.value[field]);
    const next = current.includes(normalized)
        ? current.filter((entry) => entry !== normalized)
        : [...current, normalized];
    proxyGroupForm.value[field] = joinFormList(next);
};
const setRulePayloadSuggestion = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized)
        return;
    ruleForm.value.payload = normalized;
    syncRuleRawFromStructuredForm();
};
const setRuleTargetSuggestion = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized)
        return;
    ruleForm.value.target = normalized;
    syncRuleRawFromStructuredForm();
};
const appendRuleParamSuggestion = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized)
        return;
    const current = splitFormList(ruleForm.value.paramsText);
    if (!current.includes(normalized))
        ruleForm.value.paramsText = joinFormList([...current, normalized]);
    syncRuleRawFromStructuredForm();
};
const normalizedProxyGroupType = computed(() => String(proxyGroupForm.value.type || '').trim().toLowerCase());
const proxyGroupTypePresets = [
    'select',
    'url-test',
    'fallback',
    'load-balance',
    'relay',
];
const proxyGroupTypeProfile = computed(() => {
    switch (normalizedProxyGroupType.value) {
        case 'url-test':
            return {
                accent: 'badge-info',
                summary: t('configProxyGroupsTypeAwareSummaryUrlTest'),
                fields: ['url', 'interval', 'tolerance'],
            };
        case 'fallback':
            return {
                accent: 'badge-warning',
                summary: t('configProxyGroupsTypeAwareSummaryFallback'),
                fields: ['url', 'interval'],
            };
        case 'load-balance':
            return {
                accent: 'badge-secondary',
                summary: t('configProxyGroupsTypeAwareSummaryLoadBalance'),
                fields: ['strategy', 'url', 'interval', 'tolerance'],
            };
        case 'relay':
            return {
                accent: 'badge-accent',
                summary: t('configProxyGroupsTypeAwareSummaryRelay'),
                fields: ['proxies'],
            };
        default:
            return {
                accent: 'badge-success',
                summary: t('configProxyGroupsTypeAwareSummarySelect'),
                fields: ['proxies'],
            };
    }
});
const proxyGroupSelectedLists = computed(() => ({
    proxies: splitFormList(proxyGroupForm.value.proxiesText),
    use: splitFormList(proxyGroupForm.value.useText),
    providers: splitFormList(proxyGroupForm.value.providersText),
}));
const proxyGroupAvailableProxyMembers = computed(() => Array.from(new Set([
    'DIRECT',
    'REJECT',
    'REJECT-DROP',
    ...parsedProxyGroups.value
        .map((item) => String(item.name || '').trim())
        .filter((name) => name && name !== String(proxyGroupForm.value.name || '').trim()),
    ...parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean),
])).filter(Boolean));
const proxyGroupAvailableProviderRefs = computed(() => Array.from(new Set(parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean))));
const proxyGroupSuggestedProxyMembers = computed(() => proxyGroupAvailableProxyMembers.value.filter((item) => !proxyGroupSelectedLists.value.proxies.includes(item)).slice(0, 24));
const proxyGroupSuggestedUseMembers = computed(() => proxyGroupAvailableProviderRefs.value.filter((item) => !proxyGroupSelectedLists.value.use.includes(item)).slice(0, 16));
const proxyGroupSuggestedProviderMembers = computed(() => proxyGroupAvailableProviderRefs.value.filter((item) => !proxyGroupSelectedLists.value.providers.includes(item)).slice(0, 16));
const applyProxyGroupTypePreset = (type) => {
    proxyGroupForm.value.type = type;
    if (['url-test', 'fallback', 'load-balance'].includes(type) && !String(proxyGroupForm.value.url || '').trim().length)
        proxyGroupForm.value.url = 'http://www.gstatic.com/generate_204';
    if (['url-test', 'fallback', 'load-balance'].includes(type) && !String(proxyGroupForm.value.interval || '').trim().length)
        proxyGroupForm.value.interval = '300';
    if (type === 'load-balance' && !String(proxyGroupForm.value.strategy || '').trim().length)
        proxyGroupForm.value.strategy = 'consistent-hashing';
    if (type === 'url-test' && !String(proxyGroupForm.value.tolerance || '').trim().length)
        proxyGroupForm.value.tolerance = '50';
    if (type === 'relay' && !proxyGroupSelectedLists.value.proxies.length)
        proxyGroupForm.value.proxiesText = joinFormList(['DIRECT']);
    showNotification({ content: 'configProxyGroupsTypePresetAppliedToast', type: 'alert-success' });
};
const parsedRuleProviders = computed(() => parseRuleProvidersFromConfig(payload.value));
const selectedRuleProviderEntry = computed(() => parsedRuleProviders.value.find((item) => item.name === ruleProviderSelectedName.value) || null);
const ruleProviderFormCanSave = computed(() => String(ruleProviderForm.value.name || '').trim().length > 0);
const normalizedRuleProviderListFilter = computed(() => String(ruleProviderListQuery.value || '').trim().toLowerCase());
const filteredRuleProviders = computed(() => {
    const query = normalizedRuleProviderListFilter.value;
    if (!query)
        return parsedRuleProviders.value;
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
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
});
const normalizedRuleProviderBehavior = computed(() => String(ruleProviderForm.value.behavior || '').trim().toLowerCase());
const ruleProviderBehaviorPresets = ['classical', 'domain', 'ipcidr'];
const ruleProviderBehaviorProfile = computed(() => {
    switch (normalizedRuleProviderBehavior.value) {
        case 'domain':
            return {
                accent: 'badge-info',
                summary: t('configRuleProvidersBehaviorSummaryDomain'),
            };
        case 'ipcidr':
            return {
                accent: 'badge-warning',
                summary: t('configRuleProvidersBehaviorSummaryIpcidr'),
            };
        default:
            return {
                accent: 'badge-success',
                summary: t('configRuleProvidersBehaviorSummaryClassical'),
            };
    }
});
const ruleProviderDisableImpact = computed(() => {
    const name = String(selectedRuleProviderEntry.value?.name || '').trim();
    if (!name)
        return { rulesRemoved: 0, samples: [] };
    return simulateRuleProviderDisableImpact(payload.value, name);
});
const parsedRules = computed(() => parseRulesFromConfig(payload.value));
const selectedRuleEntry = computed(() => parsedRules.value.find((item) => String(item.index) == String(ruleSelectedIndex.value)) || null);
const ruleFormCanSave = computed(() => String(ruleForm.value.raw || '').trim().length > 0);
const normalizedRuleType = computed(() => String(ruleForm.value.type || '').trim().toUpperCase());
const normalizedRuleListFilter = computed(() => String(ruleListQuery.value || '').trim().toUpperCase());
const ruleTargetSuggestions = computed(() => Array.from(new Set([
    'DIRECT',
    'REJECT',
    'REJECT-DROP',
    'GLOBAL',
    ...parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean),
    ...parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean),
    ...parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean),
])).filter(Boolean));
const rulePayloadSuggestions = computed(() => {
    const type = normalizedRuleType.value;
    const dynamic = new Set();
    if (type === 'RULE-SET') {
        parsedRuleProviders.value.forEach((item) => {
            const name = String(item.name || '').trim();
            if (name)
                dynamic.add(name);
        });
    }
    else if (type === 'GEOIP') {
        ;
        ['CN', 'RU', 'PRIVATE', 'LAN'].forEach((item) => dynamic.add(item));
    }
    else if (type === 'GEOSITE') {
        ;
        ['category-ads-all', 'cn', 'private', 'geolocation-!cn'].forEach((item) => dynamic.add(item));
    }
    else if (type === 'NETWORK') {
        ;
        ['tcp', 'udp', 'tcp,udp'].forEach((item) => dynamic.add(item));
    }
    const current = String(ruleForm.value.payload || '').trim();
    if (current)
        dynamic.add(current);
    return Array.from(dynamic);
});
const filteredRules = computed(() => {
    const query = String(ruleListQuery.value || '').trim().toLowerCase();
    if (!query)
        return parsedRules.value;
    const parts = query.split(/\s+/).filter(Boolean);
    if (!parts.length)
        return parsedRules.value;
    return parsedRules.value.filter((item) => {
        const haystack = [item.raw, item.type, item.payload, item.target, item.provider, String(item.lineNo)].join(' ').toLowerCase();
        return parts.every((part) => haystack.includes(part));
    });
});
const topRuleTypeCounts = computed(() => {
    const counts = new Map();
    for (const item of parsedRules.value) {
        const key = String(item.type || '').trim().toUpperCase() || '—';
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
        .slice(0, 8);
});
const preferredRuleTarget = computed(() => String(ruleForm.value.target || '').trim() || parsedProxyGroups.value[0]?.name || 'DIRECT');
const rulePayloadPlaceholder = computed(() => {
    switch (normalizedRuleType.value) {
        case 'RULE-SET':
            return parsedRuleProviders.value[0]?.name || 'social-media';
        case 'DOMAIN':
        case 'DOMAIN-SUFFIX':
            return 'example.com';
        case 'DOMAIN-KEYWORD':
            return 'google';
        case 'GEOIP':
            return 'CN';
        case 'GEOSITE':
            return 'category-ads-all';
        case 'IP-CIDR':
            return '1.1.1.0/24';
        case 'IP-CIDR6':
            return '2001:db8::/32';
        case 'SRC-IP-CIDR':
            return '192.168.0.0/16';
        case 'SRC-PORT':
            return '443';
        case 'DST-PORT':
            return '53';
        case 'NETWORK':
            return 'tcp';
        case 'PROCESS-NAME':
            return 'curl.exe';
        case 'PROCESS-PATH':
            return '/usr/bin/curl';
        default:
            return t('configRulesFieldPayloadPlaceholder');
    }
});
const ruleTargetPlaceholder = computed(() => preferredRuleTarget.value || t('configRulesFieldTargetPlaceholder'));
const ruleQuickTargets = computed(() => ruleTargetSuggestions.value.slice(0, 18));
const ruleQuickPayloads = computed(() => rulePayloadSuggestions.value.slice(0, 12));
const ruleQuickParams = computed(() => {
    const type = normalizedRuleType.value;
    const suggestions = new Set();
    if (['RULE-SET', 'GEOIP', 'IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR'].includes(type))
        suggestions.add('no-resolve');
    if (type === 'NETWORK') {
        suggestions.add('tcp');
        suggestions.add('udp');
    }
    splitFormList(ruleForm.value.paramsText).forEach((item) => suggestions.add(item));
    return Array.from(suggestions).filter(Boolean).slice(0, 10);
});
const ruleFormParamsCount = computed(() => {
    const count = String(ruleForm.value.paramsText || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).length;
    return `params: ${count}`;
});
const ruleFormHints = computed(() => {
    const hints = [];
    const type = normalizedRuleType.value;
    const payload = String(ruleForm.value.payload || '').trim();
    const target = String(ruleForm.value.target || '').trim();
    if (!type)
        hints.push(t('configRulesHintTypeMissing'));
    if (type && !['MATCH', 'FINAL'].includes(type) && !payload)
        hints.push(t('configRulesHintPayloadMissing'));
    if (!target)
        hints.push(t('configRulesHintTargetMissing'));
    if (type === 'RULE-SET' && payload) {
        const hasProvider = parsedRuleProviders.value.some((item) => String(item.name || '').trim().toLowerCase() === payload.toLowerCase());
        if (!hasProvider)
            hints.push(t('configRulesHintMissingProvider', { name: payload }));
    }
    if (target) {
        const knownTarget = ruleTargetSuggestions.value.some((item) => item.toLowerCase() === target.toLowerCase());
        if (!knownTarget)
            hints.push(t('configRulesHintCustomTarget', { name: target }));
    }
    return Array.from(new Set(hints));
});
const previewGroupLabel = (group) => {
    switch (group) {
        case 'runtime':
            return t('configQuickEditorGroupRuntime');
        case 'network':
            return t('configQuickEditorGroupNetwork');
        case 'controller':
            return t('configQuickEditorGroupController');
        case 'ports':
            return t('configQuickEditorGroupPorts');
        case 'tun':
            return t('configQuickEditorGroupTun');
        case 'dns':
            return t('configQuickEditorGroupDns');
        default:
            return '—';
    }
};
const previewFieldLabel = (key) => {
    switch (key) {
        case 'mode':
            return t('configOverviewMode');
        case 'logLevel':
            return t('configOverviewLogLevel');
        case 'allowLan':
            return t('configOverviewAllowLan');
        case 'ipv6':
            return t('configOverviewIpv6');
        case 'unifiedDelay':
            return t('configOverviewUnifiedDelay');
        case 'findProcessMode':
            return t('configOverviewFindProcessMode');
        case 'geodataMode':
            return t('configOverviewGeodataMode');
        case 'controller':
            return t('configOverviewController');
        case 'secret':
            return t('configQuickEditorSecret');
        case 'mixedPort':
            return t('configOverviewMixedPort');
        case 'port':
            return t('configOverviewPort');
        case 'socksPort':
            return t('configOverviewSocksPort');
        case 'redirPort':
            return t('configOverviewRedirPort');
        case 'tproxyPort':
            return t('configOverviewTproxyPort');
        case 'tunEnable':
            return t('configQuickEditorTunEnable');
        case 'tunStack':
            return t('configQuickEditorTunStack');
        case 'tunAutoRoute':
            return t('configQuickEditorTunAutoRoute');
        case 'tunAutoDetectInterface':
            return t('configQuickEditorTunAutoDetectInterface');
        case 'dnsEnable':
            return t('configQuickEditorDnsEnable');
        case 'dnsIpv6':
            return t('configQuickEditorDnsIpv6');
        case 'dnsListen':
            return t('configQuickEditorDnsListen');
        case 'dnsEnhancedMode':
            return t('configQuickEditorDnsEnhancedMode');
        default:
            return String(key);
    }
};
const previewChangeTypeText = (changeType) => {
    switch (changeType) {
        case 'add':
            return t('configQuickEditorPreviewAddAction');
        case 'remove':
            return t('configQuickEditorPreviewRemoveAction');
        default:
            return t('configQuickEditorPreviewChangeAction');
    }
};
const previewChangeBadgeClass = (changeType) => {
    switch (changeType) {
        case 'add':
            return 'badge-success';
        case 'remove':
            return 'badge-error';
        default:
            return 'badge-warning';
    }
};
const previewValueText = (value) => {
    const text = String(value ?? '').trim();
    return text || t('configQuickEditorPreviewEmptyValue');
};
const overviewText = (value) => {
    const text = String(value ?? '').trim();
    return text || '—';
};
const overviewBoolText = (value) => {
    const text = String(value ?? '').trim().toLowerCase();
    if (!text)
        return '—';
    if (['true', 'on', 'yes'].includes(text))
        return t('enabled');
    if (['false', 'off', 'no'].includes(text))
        return t('disabled');
    return String(value ?? '');
};
const sectionStateText = (value) => {
    switch (value) {
        case 'enabled':
            return t('enabled');
        case 'disabled':
            return t('disabled');
        case 'present':
            return t('configOverviewPresent');
        default:
            return t('configOverviewMissing');
    }
};
const sectionStateBadgeClass = (value) => {
    switch (value) {
        case 'enabled':
            return 'badge-success';
        case 'disabled':
            return 'badge-error';
        case 'present':
            return 'badge-ghost';
        default:
            return 'badge-neutral';
    }
};
const compareLeftResolved = computed(() => normalizeDiffSource(compareLeft.value));
const compareRightResolved = computed(() => normalizeDiffSource(compareRight.value));
const diffSourceContent = (kind) => {
    if (kind === 'editor')
        return String(payload.value || '');
    if (kind === 'last-success')
        return String(lastSuccessfulPayload.value || '');
    return String(managedPayloads.value[kind] || '');
};
const normalizeDiffText = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getTopLevelScalarValue = (value, key) => {
    const normalized = normalizeDiffText(value);
    const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`, 'm');
    const match = normalized.match(re);
    if (!match)
        return '';
    return sanitizeScalarValue(match[1] || '');
};
const getNestedScalarValue = (value, section, key) => {
    const normalized = normalizeDiffText(value);
    if (!normalized.trim().length)
        return '';
    const lines = normalized.split('\n');
    const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line));
    if (start < 0)
        return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i] || '';
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (!/^\s/.test(line)) {
            end = i;
            break;
        }
    }
    const re = new RegExp(`^\\s+${escapeRegExp(key)}:\\s*(.*?)\\s*$`);
    for (let i = start + 1; i < end; i += 1) {
        const match = (lines[i] || '').match(re);
        if (match)
            return sanitizeScalarValue(match[1] || '');
    }
    return '';
};
const isTopLevelQuickEditorField = (field) => Boolean(field.yamlKey);
const isNestedQuickEditorField = (field) => Boolean(field.section && field.nestedKey);
const getQuickEditorFieldValue = (source, field) => {
    if (field.yamlKey)
        return getTopLevelScalarValue(source, field.yamlKey);
    if (field.section && field.nestedKey)
        return getNestedScalarValue(source, field.section, field.nestedKey);
    return '';
};
const syncQuickEditorFromPayload = () => {
    const source = normalizeDiffText(payload.value);
    const next = emptyQuickEditorModel();
    for (const field of quickEditorFieldMeta) {
        next[field.key] = getQuickEditorFieldValue(source, field);
    }
    quickEditor.value = next;
};
const upsertTopLevelInlineScalars = (value, entries) => {
    const normalized = normalizeDiffText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const findLineIndex = (key) => lines.findIndex((line) => new RegExp(`^${escapeRegExp(key)}:\\s*.*$`).test(line));
    for (const [key, rawValue] of entries) {
        const cleaned = String(rawValue || '').trim();
        const idx = findLineIndex(key);
        if (!cleaned.length) {
            if (idx >= 0)
                lines.splice(idx, 1);
            continue;
        }
        const nextLine = `${key}: ${cleaned}`;
        if (idx >= 0)
            lines[idx] = nextLine;
    }
    const pending = entries
        .filter(([key, rawValue]) => String(rawValue || '').trim().length > 0 && findLineIndex(key) < 0)
        .map(([key, rawValue]) => `${key}: ${String(rawValue || '').trim()}`);
    if (pending.length) {
        let insertAt = 0;
        while (insertAt < lines.length && (!lines[insertAt]?.trim().length || /^\s*#/.test(lines[insertAt] || '')))
            insertAt += 1;
        lines.splice(insertAt, 0, ...pending);
    }
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
const upsertNestedInlineScalars = (value, section, entries) => {
    const normalized = normalizeDiffText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const findSectionIndex = () => lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line));
    const findSectionEnd = (start) => {
        let end = lines.length;
        for (let i = start + 1; i < lines.length; i += 1) {
            const line = lines[i] || '';
            if (!line.trim().length || /^\s*#/.test(line))
                continue;
            if (!/^\s/.test(line)) {
                end = i;
                break;
            }
        }
        return end;
    };
    const hasAnyValue = entries.some(([, rawValue]) => String(rawValue || '').trim().length > 0);
    const sectionStart = findSectionIndex();
    if (sectionStart < 0) {
        if (!hasAnyValue)
            return normalized;
        const preferredAnchors = ['proxies', 'proxy-groups', 'proxy-providers', 'rule-providers', 'rules'];
        let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(line)));
        if (insertAt < 0) {
            insertAt = lines.length;
            while (insertAt > 0 && !String(lines[insertAt - 1] || '').trim().length)
                insertAt -= 1;
        }
        const block = [
            section + ':',
            ...entries.filter(([, rawValue]) => String(rawValue || '').trim().length > 0).map(([key, rawValue]) => `  ${key}: ${String(rawValue || '').trim()}`),
        ];
        if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
            block.unshift('');
        lines.splice(insertAt, 0, ...block);
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    }
    let sectionEnd = findSectionEnd(sectionStart);
    const findNestedLineIndex = (key) => {
        for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
            if (new RegExp(`^\\s+${escapeRegExp(key)}:\\s*.*$`).test(lines[i] || ''))
                return i;
        }
        return -1;
    };
    for (const [key, rawValue] of entries) {
        const cleaned = String(rawValue || '').trim();
        const idx = findNestedLineIndex(key);
        if (!cleaned.length) {
            if (idx >= 0) {
                lines.splice(idx, 1);
                sectionEnd -= 1;
            }
            continue;
        }
        const nextLine = `  ${key}: ${cleaned}`;
        if (idx >= 0)
            lines[idx] = nextLine;
        else {
            lines.splice(sectionEnd, 0, nextLine);
            sectionEnd += 1;
        }
    }
    const meaningful = lines.slice(sectionStart + 1, sectionEnd).some((line) => {
        const trimmed = String(line || '').trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
    });
    if (!meaningful) {
        let removeFrom = sectionStart;
        if (removeFrom > 0 && !String(lines[removeFrom - 1] || '').trim().length)
            removeFrom -= 1;
        lines.splice(removeFrom, sectionEnd - removeFrom);
    }
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
const applyQuickEditorToPayload = () => {
    if (!quickEditorCanApply.value) {
        showNotification({ content: 'configQuickEditorEmptyToast', type: 'alert-warning' });
        return;
    }
    const topLevelEntries = quickEditorFieldMeta
        .filter(isTopLevelQuickEditorField)
        .map((field) => [field.yamlKey, quickEditor.value[field.key]]);
    const tunEntries = quickEditorFieldMeta
        .filter((field) => isNestedQuickEditorField(field) && field.section === 'tun')
        .map((field) => [field.nestedKey, quickEditor.value[field.key]]);
    const dnsEntries = quickEditorFieldMeta
        .filter((field) => isNestedQuickEditorField(field) && field.section === 'dns')
        .map((field) => [field.nestedKey, quickEditor.value[field.key]]);
    let nextPayload = upsertTopLevelInlineScalars(payload.value, topLevelEntries);
    nextPayload = upsertNestedInlineScalars(nextPayload, 'tun', tunEntries);
    nextPayload = upsertNestedInlineScalars(nextPayload, 'dns', dnsEntries);
    payload.value = nextPayload;
    showNotification({ content: 'configQuickEditorAppliedToast', type: 'alert-success' });
};
const syncAdvancedSectionsFromPayload = () => {
    advancedSectionsForm.value = advancedSectionsFormFromConfig(payload.value);
};
const applyAdvancedSectionsToPayload = () => {
    if (!quickEditorHasPayload.value) {
        showNotification({ content: 'configAdvancedSectionsEmptyEditor', type: 'alert-warning' });
        return;
    }
    if (!advancedSectionsCanApply.value) {
        showNotification({ content: 'configAdvancedSectionsNoChangesToast', type: 'alert-warning' });
        return;
    }
    payload.value = advancedSectionsAppliedPreview.value;
    advancedSectionsForm.value = advancedSectionsFormFromConfig(payload.value);
    showNotification({ content: 'configAdvancedSectionsAppliedToast', type: 'alert-success' });
};
const syncDnsEditorFromPayload = () => {
    dnsEditorForm.value = dnsEditorFormFromConfig(payload.value);
};
const applyDnsEditorToPayload = () => {
    if (!quickEditorHasPayload.value) {
        showNotification({ content: 'configDnsStructuredEmptyEditor', type: 'alert-warning' });
        return;
    }
    if (!dnsEditorCanApply.value) {
        showNotification({ content: 'configDnsStructuredNoChangesToast', type: 'alert-warning' });
        return;
    }
    payload.value = dnsEditorAppliedPreview.value;
    dnsEditorForm.value = dnsEditorFormFromConfig(payload.value);
    showNotification({ content: 'configDnsStructuredAppliedToast', type: 'alert-success' });
};
const prepareNewProxy = () => {
    proxySelectedName.value = '';
    proxyForm.value = emptyProxyForm();
};
const loadProxyIntoForm = (proxyName) => {
    const entry = parsedProxies.value.find((item) => item.name === proxyName);
    if (!entry)
        return;
    proxySelectedName.value = entry.name;
    proxyForm.value = proxyFormFromEntry(entry);
};
const applyProxyTypePreset = (type) => {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (!normalizedType.length)
        return;
    proxyForm.value.type = normalizedType;
    if (['vmess', 'vless', 'trojan', 'hysteria2', 'tuic'].includes(normalizedType) && !String(proxyForm.value.tls || '').trim().length)
        proxyForm.value.tls = 'true';
    if (['wireguard', 'hysteria2', 'tuic'].includes(normalizedType) && !String(proxyForm.value.udp || '').trim().length)
        proxyForm.value.udp = 'true';
    showNotification({ content: 'configProxiesTypePresetAppliedToast', type: 'alert-success' });
};
const duplicateSelectedProxy = () => {
    const entry = selectedProxyEntry.value;
    if (!entry)
        return;
    const next = proxyFormFromEntry(entry);
    next.originalName = '';
    next.name = `${entry.name}-copy`;
    proxySelectedName.value = '';
    proxyForm.value = next;
};
const saveProxyToPayload = () => {
    if (!proxyFormCanSave.value) {
        showNotification({ content: 'configProxiesSaveNameRequired', type: 'alert-warning' });
        return;
    }
    payload.value = upsertProxyInConfig(payload.value, proxyForm.value);
    proxySelectedName.value = String(proxyForm.value.name || '').trim();
    showNotification({ content: 'configProxiesSavedToast', type: 'alert-success' });
};
const disableSelectedProxy = () => {
    const entry = selectedProxyEntry.value;
    if (!entry)
        return;
    const result = removeProxyFromConfig(payload.value, entry.name);
    payload.value = result.yaml;
    proxySelectedName.value = '';
    proxyForm.value = emptyProxyForm();
    showNotification({
        content: result.rulesTouched > 0 || result.impacts.some((item) => item.fallbackInjected)
            ? 'configProxiesDisabledWithCleanupToast'
            : 'configProxiesDisabledToast',
        type: 'alert-success',
    });
};
const buildProxyCreationTemplateForm = (templateId) => {
    const existingNames = parsedProxies.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const next = emptyProxyForm();
    switch (templateId) {
        case 'vless-reality':
            next.name = makeUniqueName('VLESS-Reality', existingNames);
            next.type = 'vless';
            next.server = 'edge.example.com';
            next.port = '443';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.clientFingerprint = 'chrome';
            next.uuid = '<uuid>';
            next.flow = 'xtls-rprx-vision';
            next.realityPublicKey = '<public-key>';
            next.realityShortId = '<short-id>';
            break;
        case 'vless-ws-tls':
            next.name = makeUniqueName('VLESS-WS-TLS', existingNames);
            next.type = 'vless';
            next.server = 'edge.example.com';
            next.port = '443';
            next.network = 'ws';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.clientFingerprint = 'chrome';
            next.uuid = '<uuid>';
            next.wsPath = '/app';
            break;
        case 'vmess-ws-tls':
            next.name = makeUniqueName('VMess-WS-TLS', existingNames);
            next.type = 'vmess';
            next.server = 'edge.example.com';
            next.port = '443';
            next.network = 'ws';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.clientFingerprint = 'chrome';
            next.uuid = '<uuid>';
            next.wsPath = '/';
            break;
        case 'trojan-grpc':
            next.name = makeUniqueName('Trojan-gRPC', existingNames);
            next.type = 'trojan';
            next.server = 'edge.example.com';
            next.port = '443';
            next.network = 'grpc';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.password = '<password>';
            next.grpcServiceName = 'trojan-grpc';
            break;
        case 'trojan-tls':
            next.name = makeUniqueName('Trojan-TLS', existingNames);
            next.type = 'trojan';
            next.server = 'edge.example.com';
            next.port = '443';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.password = '<password>';
            break;
        case 'wireguard-peer':
        case 'wireguard-basic':
            next.name = makeUniqueName('WireGuard-Peer', existingNames);
            next.type = 'wireguard';
            next.server = '203.0.113.10';
            next.port = '51820';
            next.udp = 'true';
            next.packetEncoding = 'xudp';
            next.wireguardIpText = '172.16.0.2/32';
            next.wireguardMtu = '1420';
            next.wireguardPublicKey = '<server-public-key>';
            next.wireguardPrivateKey = '<client-private-key>';
            break;
        case 'hysteria2-basic':
            next.name = makeUniqueName('Hysteria2', existingNames);
            next.type = 'hysteria2';
            next.server = 'edge.example.com';
            next.port = '443';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.password = '<password>';
            next.hysteriaObfs = 'salamander';
            next.hysteriaObfsPassword = '<obfs-password>';
            break;
        case 'tuic-basic':
            next.name = makeUniqueName('TUIC', existingNames);
            next.type = 'tuic';
            next.server = 'edge.example.com';
            next.port = '443';
            next.tls = 'true';
            next.udp = 'true';
            next.servername = next.server;
            next.uuid = '<uuid>';
            next.password = '<password>';
            next.tuicCongestionController = 'bbr';
            next.tuicUdpRelayMode = 'native';
            next.tuicHeartbeatInterval = '3s';
            break;
        default:
            next.name = makeUniqueName('Proxy', existingNames);
            next.type = 'vless';
    }
    return next;
};
const buildProxyProviderCreationTemplateForm = (templateId) => {
    const existingNames = parsedProxyProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const next = emptyProxyProviderForm();
    switch (templateId) {
        case 'local-file':
            next.name = makeUniqueName('LocalProvider', existingNames);
            next.type = 'file';
            next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`;
            next.filter = '(?i)proxy|auto';
            break;
        case 'inline-source':
            next.name = makeUniqueName('InlineProvider', existingNames);
            next.type = 'inline';
            next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`;
            next.overrideBody = 'additional-prefix: "INLINE"';
            break;
        default:
            next.name = makeUniqueName('RemoteProvider', existingNames);
            next.type = 'http';
            next.url = 'https://example.com/subscription.yaml';
            next.path = `./providers/${slugifyTemplateValue(next.name)}.yaml`;
            next.interval = '86400';
            next.healthCheckEnable = 'true';
            next.healthCheckUrl = 'https://www.gstatic.com/generate_204';
            next.healthCheckInterval = '300';
            break;
    }
    return next;
};
const buildProxyGroupCreationTemplateForm = (templateId) => {
    const existingNames = parsedProxyGroups.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const next = emptyProxyGroupForm();
    const preferredMembers = buildPreferredGroupMembers(3);
    const providerRefs = buildProviderRefs(2);
    switch (templateId) {
        case 'url-test':
            next.name = makeUniqueName('AUTO', existingNames);
            next.type = 'url-test';
            next.url = 'https://www.gstatic.com/generate_204';
            next.interval = '300';
            next.tolerance = '50';
            next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT']);
            break;
        case 'fallback':
            next.name = makeUniqueName('FAILOVER', existingNames);
            next.type = 'fallback';
            next.url = 'https://www.gstatic.com/generate_204';
            next.interval = '300';
            next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT']);
            break;
        case 'load-balance':
            next.name = makeUniqueName('BALANCE', existingNames);
            next.type = 'load-balance';
            next.url = 'https://www.gstatic.com/generate_204';
            next.interval = '300';
            next.strategy = 'consistent-hashing';
            next.tolerance = '50';
            if (providerRefs.length)
                next.useText = joinFormList(providerRefs);
            else
                next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers : ['DIRECT']);
            break;
        case 'relay':
            next.name = makeUniqueName('CHAIN', existingNames);
            next.type = 'relay';
            next.proxiesText = joinFormList(preferredMembers.length ? preferredMembers.slice(0, 2) : []);
            break;
        default:
            next.name = makeUniqueName('PROXY', existingNames);
            next.type = 'select';
            next.proxiesText = joinFormList(preferredMembers.length ? ['DIRECT', ...preferredMembers].slice(0, 4) : ['DIRECT']);
            break;
    }
    return next;
};
const buildRuleProviderCreationTemplateForm = (templateId) => {
    const existingNames = parsedRuleProviders.value.map((item) => String(item.name || '').trim()).filter(Boolean);
    const next = emptyRuleProviderForm();
    next.type = 'http';
    next.format = 'yaml';
    next.interval = '86400';
    switch (templateId) {
        case 'domain-remote':
            next.name = makeUniqueName('domains-main', existingNames);
            next.behavior = 'domain';
            next.url = 'https://example.com/rules/domain.yaml';
            break;
        case 'ipcidr-remote':
            next.name = makeUniqueName('cidr-main', existingNames);
            next.behavior = 'ipcidr';
            next.url = 'https://example.com/rules/ipcidr.yaml';
            break;
        default:
            next.name = makeUniqueName('rules-main', existingNames);
            next.behavior = 'classical';
            next.url = 'https://example.com/rules/classical.yaml';
            break;
    }
    next.path = `./rule-providers/${slugifyTemplateValue(next.name)}.yaml`;
    return next;
};
const startProxyCreationWizard = () => {
    proxyCreationWizard.value = { ...emptyProxyCreationWizard(), active: true };
};
const selectProxyCreationWizardTemplate = (templateId) => {
    const next = buildProxyCreationTemplateForm(templateId);
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
    };
};
const finalizeProxyCreationWizard = () => {
    const state = proxyCreationWizard.value;
    if (!state.templateId)
        return;
    const next = buildProxyCreationTemplateForm(state.templateId);
    if (String(state.name || '').trim())
        next.name = String(state.name || '').trim();
    if (String(state.server || '').trim())
        next.server = String(state.server || '').trim();
    if (String(state.port || '').trim())
        next.port = String(state.port || '').trim();
    if (String(state.network || '').trim())
        next.network = String(state.network || '').trim();
    if (String(state.tls || '').trim())
        next.tls = String(state.tls || '').trim();
    if (String(state.servername || '').trim())
        next.servername = String(state.servername || '').trim();
    if (String(state.clientFingerprint || '').trim())
        next.clientFingerprint = String(state.clientFingerprint || '').trim();
    if (String(state.uuid || '').trim())
        next.uuid = String(state.uuid || '').trim();
    if (String(state.password || '').trim())
        next.password = String(state.password || '').trim();
    if (String(state.cipher || '').trim())
        next.cipher = String(state.cipher || '').trim();
    if (String(state.flow || '').trim())
        next.flow = String(state.flow || '').trim();
    if (String(state.wsPath || '').trim())
        next.wsPath = String(state.wsPath || '').trim();
    if (String(state.grpcServiceName || '').trim())
        next.grpcServiceName = String(state.grpcServiceName || '').trim();
    if (String(state.realityPublicKey || '').trim())
        next.realityPublicKey = String(state.realityPublicKey || '').trim();
    if (String(state.realityShortId || '').trim())
        next.realityShortId = String(state.realityShortId || '').trim();
    if (String(state.wireguardIpText || '').trim())
        next.wireguardIpText = String(state.wireguardIpText || '').trim();
    if (String(state.wireguardPrivateKey || '').trim())
        next.wireguardPrivateKey = String(state.wireguardPrivateKey || '').trim();
    if (String(state.wireguardPublicKey || '').trim())
        next.wireguardPublicKey = String(state.wireguardPublicKey || '').trim();
    if (String(state.wireguardMtu || '').trim())
        next.wireguardMtu = String(state.wireguardMtu || '').trim();
    if (String(state.hysteriaObfs || '').trim())
        next.hysteriaObfs = String(state.hysteriaObfs || '').trim();
    if (String(state.hysteriaObfsPassword || '').trim())
        next.hysteriaObfsPassword = String(state.hysteriaObfsPassword || '').trim();
    if (String(state.tuicCongestionController || '').trim())
        next.tuicCongestionController = String(state.tuicCongestionController || '').trim();
    if (String(state.tuicUdpRelayMode || '').trim())
        next.tuicUdpRelayMode = String(state.tuicUdpRelayMode || '').trim();
    if (String(state.tuicHeartbeatInterval || '').trim())
        next.tuicHeartbeatInterval = String(state.tuicHeartbeatInterval || '').trim();
    if (next.server && ['vless', 'vmess', 'trojan', 'hysteria2', 'tuic'].includes(next.type) && !String(next.servername || '').trim())
        next.servername = next.server;
    proxySelectedName.value = '';
    proxyForm.value = next;
    proxyCreationWizard.value = emptyProxyCreationWizard();
    showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxiesTitle') }, type: 'alert-success' });
};
const cancelProxyCreationWizard = () => {
    proxyCreationWizard.value = emptyProxyCreationWizard();
};
const prevProxyCreationWizardStep = () => {
    if (proxyCreationWizard.value.step > 1)
        proxyCreationWizard.value.step = (proxyCreationWizard.value.step - 1);
};
const nextProxyCreationWizardStep = () => {
    if (!proxyCreationWizard.value.templateId || proxyCreationWizard.value.step >= 3)
        return;
    proxyCreationWizard.value.step = (proxyCreationWizard.value.step + 1);
};
const applyProxyCreationTemplate = (templateId) => {
    proxySelectedName.value = '';
    proxyForm.value = buildProxyCreationTemplateForm(templateId);
    showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxiesTitle') }, type: 'alert-success' });
};
const startProxyProviderCreationWizard = () => {
    proxyProviderCreationWizard.value = { ...emptyProxyProviderCreationWizard(), active: true };
};
const selectProxyProviderCreationWizardTemplate = (templateId) => {
    const next = buildProxyProviderCreationTemplateForm(templateId);
    proxyProviderCreationWizard.value = {
        active: true,
        step: 2,
        templateId,
        name: next.name,
        type: next.type,
        url: next.url,
        path: next.path,
        interval: next.interval,
    };
};
const finalizeProxyProviderCreationWizard = () => {
    const state = proxyProviderCreationWizard.value;
    if (!state.templateId)
        return;
    const next = buildProxyProviderCreationTemplateForm(state.templateId);
    if (String(state.name || '').trim()) {
        const normalizedName = String(state.name || '').trim();
        const previousSlug = slugifyTemplateValue(next.name);
        next.name = normalizedName;
        if (String(next.path || '').includes(previousSlug))
            next.path = `./providers/${slugifyTemplateValue(normalizedName)}.yaml`;
    }
    if (String(state.type || '').trim())
        next.type = String(state.type || '').trim();
    if (String(state.url || '').trim())
        next.url = String(state.url || '').trim();
    if (String(state.path || '').trim())
        next.path = String(state.path || '').trim();
    if (String(state.interval || '').trim())
        next.interval = String(state.interval || '').trim();
    proxyProviderSelectedName.value = '';
    proxyProviderForm.value = next;
    proxyProviderCreationWizard.value = emptyProxyProviderCreationWizard();
    showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxyProvidersTitle') }, type: 'alert-success' });
};
const cancelProxyProviderCreationWizard = () => {
    proxyProviderCreationWizard.value = emptyProxyProviderCreationWizard();
};
const prevProxyProviderCreationWizardStep = () => {
    if (proxyProviderCreationWizard.value.step > 1)
        proxyProviderCreationWizard.value.step = (proxyProviderCreationWizard.value.step - 1);
};
const nextProxyProviderCreationWizardStep = () => {
    if (!proxyProviderCreationWizard.value.templateId || proxyProviderCreationWizard.value.step >= 3)
        return;
    proxyProviderCreationWizard.value.step = (proxyProviderCreationWizard.value.step + 1);
};
const applyProxyProviderCreationTemplate = (templateId) => {
    proxyProviderSelectedName.value = '';
    proxyProviderForm.value = buildProxyProviderCreationTemplateForm(templateId);
    showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxyProvidersTitle') }, type: 'alert-success' });
};
const startProxyGroupCreationWizard = () => {
    proxyGroupCreationWizard.value = { ...emptyProxyGroupCreationWizard(), active: true };
};
const selectProxyGroupCreationWizardTemplate = (templateId) => {
    const next = buildProxyGroupCreationTemplateForm(templateId);
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
    };
};
const finalizeProxyGroupCreationWizard = () => {
    const state = proxyGroupCreationWizard.value;
    if (!state.templateId)
        return;
    const next = buildProxyGroupCreationTemplateForm(state.templateId);
    if (String(state.name || '').trim())
        next.name = String(state.name || '').trim();
    if (String(state.type || '').trim())
        next.type = String(state.type || '').trim();
    if (String(state.membersText || '').trim())
        next.proxiesText = joinFormList(splitFormList(state.membersText));
    if (String(state.providersText || '').trim())
        next.useText = joinFormList(splitFormList(state.providersText));
    if (String(state.url || '').trim())
        next.url = String(state.url || '').trim();
    if (String(state.interval || '').trim())
        next.interval = String(state.interval || '').trim();
    proxyGroupSelectedName.value = '';
    proxyGroupForm.value = next;
    proxyGroupCreationWizard.value = emptyProxyGroupCreationWizard();
    showNotification({ content: 'configWizardAppliedToast', params: { section: t('configProxyGroupsTitle') }, type: 'alert-success' });
};
const cancelProxyGroupCreationWizard = () => {
    proxyGroupCreationWizard.value = emptyProxyGroupCreationWizard();
};
const prevProxyGroupCreationWizardStep = () => {
    if (proxyGroupCreationWizard.value.step > 1)
        proxyGroupCreationWizard.value.step = (proxyGroupCreationWizard.value.step - 1);
};
const nextProxyGroupCreationWizardStep = () => {
    if (!proxyGroupCreationWizard.value.templateId || proxyGroupCreationWizard.value.step >= 3)
        return;
    proxyGroupCreationWizard.value.step = (proxyGroupCreationWizard.value.step + 1);
};
const applyProxyGroupCreationTemplate = (templateId) => {
    proxyGroupSelectedName.value = '';
    proxyGroupForm.value = buildProxyGroupCreationTemplateForm(templateId);
    showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configProxyGroupsTitle') }, type: 'alert-success' });
};
const startRuleProviderCreationWizard = () => {
    ruleProviderCreationWizard.value = { ...emptyRuleProviderCreationWizard(), active: true };
};
const selectRuleProviderCreationWizardTemplate = (templateId) => {
    const next = buildRuleProviderCreationTemplateForm(templateId);
    ruleProviderCreationWizard.value = {
        active: true,
        step: 2,
        templateId,
        name: next.name,
        behavior: next.behavior,
        url: next.url,
        path: next.path,
        interval: next.interval,
    };
};
const finalizeRuleProviderCreationWizard = () => {
    const state = ruleProviderCreationWizard.value;
    if (!state.templateId)
        return;
    const next = buildRuleProviderCreationTemplateForm(state.templateId);
    if (String(state.name || '').trim()) {
        const normalizedName = String(state.name || '').trim();
        const previousSlug = slugifyTemplateValue(next.name);
        next.name = normalizedName;
        if (String(next.path || '').includes(previousSlug))
            next.path = `./rule-providers/${slugifyTemplateValue(normalizedName)}.yaml`;
    }
    if (String(state.behavior || '').trim())
        next.behavior = String(state.behavior || '').trim();
    if (String(state.url || '').trim())
        next.url = String(state.url || '').trim();
    if (String(state.path || '').trim())
        next.path = String(state.path || '').trim();
    if (String(state.interval || '').trim())
        next.interval = String(state.interval || '').trim();
    ruleProviderSelectedName.value = '';
    ruleProviderForm.value = next;
    ruleProviderCreationWizard.value = emptyRuleProviderCreationWizard();
    showNotification({ content: 'configWizardAppliedToast', params: { section: t('configRuleProvidersTitle') }, type: 'alert-success' });
};
const cancelRuleProviderCreationWizard = () => {
    ruleProviderCreationWizard.value = emptyRuleProviderCreationWizard();
};
const prevRuleProviderCreationWizardStep = () => {
    if (ruleProviderCreationWizard.value.step > 1)
        ruleProviderCreationWizard.value.step = (ruleProviderCreationWizard.value.step - 1);
};
const nextRuleProviderCreationWizardStep = () => {
    if (!ruleProviderCreationWizard.value.templateId || ruleProviderCreationWizard.value.step >= 3)
        return;
    ruleProviderCreationWizard.value.step = (ruleProviderCreationWizard.value.step + 1);
};
const applyRuleProviderCreationTemplate = (templateId) => {
    ruleProviderSelectedName.value = '';
    ruleProviderForm.value = buildRuleProviderCreationTemplateForm(templateId);
    showNotification({ content: 'configTemplateAppliedToast', params: { section: t('configRuleProvidersTitle') }, type: 'alert-success' });
};
const clearProxyFilter = () => {
    proxyListQuery.value = '';
};
const providerReferenceBadgeClass = (count) => {
    if (count <= 0)
        return 'badge-ghost';
    if (count <= 2)
        return 'badge-warning badge-outline';
    return 'badge-error badge-outline';
};
const proxyProviderDisplayValue = (value) => {
    const s = String(value || '').trim();
    return s.length ? s : '—';
};
const clearProxyProviderFilter = () => {
    proxyProviderListQuery.value = '';
};
const applyProxyProviderTypePreset = (type) => {
    proxyProviderForm.value.type = type;
    if (type === 'http' && !String(proxyProviderForm.value.interval || '').trim().length)
        proxyProviderForm.value.interval = '86400';
    if (type === 'http' && !String(proxyProviderForm.value.healthCheckEnable || '').trim().length)
        proxyProviderForm.value.healthCheckEnable = 'true';
    if (type === 'http' && !String(proxyProviderForm.value.healthCheckUrl || '').trim().length)
        proxyProviderForm.value.healthCheckUrl = 'https://www.gstatic.com/generate_204';
    if (type === 'http' && !String(proxyProviderForm.value.healthCheckInterval || '').trim().length)
        proxyProviderForm.value.healthCheckInterval = '300';
    showNotification({ content: 'configProxyProvidersTypePresetAppliedToast', type: 'alert-success' });
};
const applyProxyProviderHealthPreset = (url) => {
    const normalized = String(url || '').trim();
    if (!normalized)
        return;
    proxyProviderForm.value.healthCheckEnable = 'true';
    proxyProviderForm.value.healthCheckUrl = normalized;
    if (!String(proxyProviderForm.value.healthCheckInterval || '').trim().length)
        proxyProviderForm.value.healthCheckInterval = '300';
};
const prepareNewProxyProvider = () => {
    proxyProviderSelectedName.value = '';
    proxyProviderForm.value = emptyProxyProviderForm();
};
const loadProxyProviderIntoForm = (providerName) => {
    const entry = parsedProxyProviders.value.find((item) => item.name === providerName);
    if (!entry)
        return;
    proxyProviderSelectedName.value = entry.name;
    proxyProviderForm.value = proxyProviderFormFromEntry(entry);
};
const duplicateSelectedProxyProvider = () => {
    const entry = selectedProxyProviderEntry.value;
    if (!entry)
        return;
    const next = proxyProviderFormFromEntry(entry);
    next.originalName = '';
    next.name = `${entry.name}-copy`;
    proxyProviderSelectedName.value = '';
    proxyProviderForm.value = next;
};
const saveProxyProviderToPayload = () => {
    if (!proxyProviderFormCanSave.value) {
        showNotification({ content: 'configProxyProvidersSaveNameRequired', type: 'alert-warning' });
        return;
    }
    payload.value = upsertProxyProviderInConfig(payload.value, proxyProviderForm.value);
    proxyProviderSelectedName.value = String(proxyProviderForm.value.name || '').trim();
    showNotification({ content: 'configProxyProvidersSavedToast', type: 'alert-success' });
};
const disableSelectedProxyProvider = () => {
    const entry = selectedProxyProviderEntry.value;
    if (!entry)
        return;
    const result = removeProxyProviderFromConfig(payload.value, entry.name);
    payload.value = result.yaml;
    proxyProviderSelectedName.value = '';
    proxyProviderForm.value = emptyProxyProviderForm();
    showNotification({
        content: result.impacts.some((item) => item.fallbackInjected)
            ? 'configProxyProvidersDisabledWithFallbackToast'
            : 'configProxyProvidersDisabledToast',
        type: 'alert-success',
    });
};
const prepareNewProxyGroup = () => {
    proxyGroupSelectedName.value = '';
    proxyGroupForm.value = emptyProxyGroupForm();
};
const loadProxyGroupIntoForm = (groupName) => {
    const entry = parsedProxyGroups.value.find((item) => item.name === groupName);
    if (!entry)
        return;
    proxyGroupSelectedName.value = entry.name;
    proxyGroupForm.value = proxyGroupFormFromEntry(entry);
};
const duplicateSelectedProxyGroup = () => {
    const entry = selectedProxyGroupEntry.value;
    if (!entry)
        return;
    const next = proxyGroupFormFromEntry(entry);
    next.originalName = '';
    next.name = `${entry.name}-copy`;
    proxyGroupSelectedName.value = '';
    proxyGroupForm.value = next;
};
const saveProxyGroupToPayload = () => {
    if (!proxyGroupFormCanSave.value) {
        showNotification({ content: 'configProxyGroupsSaveNameRequired', type: 'alert-warning' });
        return;
    }
    payload.value = upsertProxyGroupInConfig(payload.value, proxyGroupForm.value);
    proxyGroupSelectedName.value = String(proxyGroupForm.value.name || '').trim();
    showNotification({ content: 'configProxyGroupsSavedToast', type: 'alert-success' });
};
const disableSelectedProxyGroup = () => {
    const entry = selectedProxyGroupEntry.value;
    if (!entry)
        return;
    const result = removeProxyGroupFromConfig(payload.value, entry.name);
    payload.value = result.yaml;
    proxyGroupSelectedName.value = '';
    proxyGroupForm.value = emptyProxyGroupForm();
    showNotification({
        content: result.rulesTouched > 0 || result.impacts.some((item) => item.fallbackInjected)
            ? 'configProxyGroupsDisabledWithFallbackToast'
            : 'configProxyGroupsDisabledToast',
        type: 'alert-success',
    });
};
const clearRuleProviderFilter = () => {
    ruleProviderListQuery.value = '';
};
const applyRuleProviderBehaviorPreset = (behavior) => {
    ruleProviderForm.value.behavior = behavior;
    if (!String(ruleProviderForm.value.format || '').trim().length)
        ruleProviderForm.value.format = 'yaml';
    showNotification({ content: 'configRuleProvidersBehaviorPresetAppliedToast', type: 'alert-success' });
};
const prepareNewRuleProvider = () => {
    ruleProviderSelectedName.value = '';
    ruleProviderForm.value = emptyRuleProviderForm();
};
const loadRuleProviderIntoForm = (providerName) => {
    const entry = parsedRuleProviders.value.find((item) => item.name === providerName);
    if (!entry)
        return;
    ruleProviderSelectedName.value = entry.name;
    ruleProviderForm.value = ruleProviderFormFromEntry(entry);
};
const duplicateSelectedRuleProvider = () => {
    const entry = selectedRuleProviderEntry.value;
    if (!entry)
        return;
    const next = ruleProviderFormFromEntry(entry);
    next.originalName = '';
    next.name = `${entry.name}-copy`;
    ruleProviderSelectedName.value = '';
    ruleProviderForm.value = next;
};
const saveRuleProviderToPayload = () => {
    if (!ruleProviderFormCanSave.value) {
        showNotification({ content: 'configRuleProvidersSaveNameRequired', type: 'alert-warning' });
        return;
    }
    payload.value = upsertRuleProviderInConfig(payload.value, ruleProviderForm.value);
    ruleProviderSelectedName.value = String(ruleProviderForm.value.name || '').trim();
    showNotification({ content: 'configRuleProvidersSavedToast', type: 'alert-success' });
};
const disableSelectedRuleProvider = () => {
    const entry = selectedRuleProviderEntry.value;
    if (!entry)
        return;
    const result = removeRuleProviderFromConfig(payload.value, entry.name);
    payload.value = result.yaml;
    ruleProviderSelectedName.value = '';
    ruleProviderForm.value = emptyRuleProviderForm();
    showNotification({
        content: result.rulesRemoved > 0 ? 'configRuleProvidersDisabledWithCleanupToast' : 'configRuleProvidersDisabledToast',
        type: 'alert-success',
    });
};
const prepareNewRule = () => {
    ruleSelectedIndex.value = '';
    ruleForm.value = emptyRuleForm();
};
const clearRuleFilter = () => {
    ruleListQuery.value = '';
};
const filterRulesByType = (type) => {
    const normalized = String(type || '').trim().toUpperCase();
    ruleListQuery.value = normalizedRuleListFilter.value === normalized ? '' : normalized;
};
const applyRuleTemplate = (templateId) => {
    const target = preferredRuleTarget.value || 'DIRECT';
    if (templateId === 'match-direct') {
        ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'MATCH,DIRECT' });
        return;
    }
    if (templateId === 'rule-set') {
        const provider = parsedRuleProviders.value[0]?.name || 'provider-name';
        ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: `RULE-SET,${provider},${target}` });
        return;
    }
    if (templateId === 'geoip-cn') {
        ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'GEOIP,CN,DIRECT' });
        return;
    }
    if (templateId === 'geosite-ads') {
        ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: 'GEOSITE,category-ads-all,REJECT' });
        return;
    }
    ruleForm.value = syncRuleFormFromRaw({ ...emptyRuleForm(), raw: `DOMAIN-SUFFIX,example.com,${target}` });
};
const syncRuleFormFromRawLine = () => {
    ruleForm.value = syncRuleFormFromRaw(ruleForm.value);
};
const syncRuleRawFromStructuredForm = () => {
    ruleForm.value = syncRuleRawFromForm(ruleForm.value);
};
const loadRuleIntoForm = (ruleIndex) => {
    const entry = parsedRules.value.find((item) => item.index === ruleIndex);
    if (!entry)
        return;
    ruleSelectedIndex.value = String(entry.index);
    ruleForm.value = ruleFormFromEntry(entry);
};
const duplicateSelectedRule = () => {
    const entry = selectedRuleEntry.value;
    if (!entry)
        return;
    const next = ruleFormFromEntry(entry);
    next.originalIndex = '';
    ruleSelectedIndex.value = '';
    ruleForm.value = next;
};
const saveRuleToPayload = () => {
    if (!ruleFormCanSave.value) {
        showNotification({ content: 'configRulesSaveRequired', type: 'alert-warning' });
        return;
    }
    const wasNew = !String(ruleForm.value.originalIndex || '').trim().length;
    const originalIndex = String(ruleForm.value.originalIndex || '').trim();
    const nextPayload = upsertRuleInConfig(payload.value, ruleForm.value);
    payload.value = nextPayload;
    const nextEntries = parseRulesFromConfig(nextPayload);
    if (wasNew) {
        const created = nextEntries[nextEntries.length - 1];
        if (created) {
            ruleSelectedIndex.value = String(created.index);
            ruleForm.value = ruleFormFromEntry(created);
        }
    }
    else {
        const selected = nextEntries.find((item) => String(item.index) === originalIndex);
        if (selected) {
            ruleSelectedIndex.value = String(selected.index);
            ruleForm.value = ruleFormFromEntry(selected);
        }
    }
    showNotification({ content: 'configRulesSavedToast', type: 'alert-success' });
};
const disableSelectedRule = () => {
    const entry = selectedRuleEntry.value;
    if (!entry)
        return;
    payload.value = removeRuleFromConfig(payload.value, entry.index);
    ruleSelectedIndex.value = '';
    ruleForm.value = emptyRuleForm();
    showNotification({ content: 'configRulesDisabledToast', type: 'alert-success' });
};
const splitDiffLines = (value) => {
    const normalized = normalizeDiffText(value);
    if (!normalized.length)
        return [];
    const lines = normalized.split('\n');
    if (lines.length && lines[lines.length - 1] === '')
        lines.pop();
    return lines;
};
const buildLineDiffRows = (leftLines, rightLines) => {
    const m = leftLines.length;
    const n = rightLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i -= 1) {
        for (let j = n - 1; j >= 0; j -= 1) {
            if (leftLines[i] === rightLines[j])
                dp[i][j] = dp[i + 1][j + 1] + 1;
            else
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const rows = [];
    let i = 0;
    let j = 0;
    let leftNo = 1;
    let rightNo = 1;
    while (i < m && j < n) {
        if (leftLines[i] === rightLines[j]) {
            rows.push({
                type: 'context',
                leftNo,
                rightNo,
                leftText: leftLines[i],
                rightText: rightLines[j],
            });
            i += 1;
            j += 1;
            leftNo += 1;
            rightNo += 1;
            continue;
        }
        if (dp[i + 1][j] >= dp[i][j + 1]) {
            rows.push({
                type: 'remove',
                leftNo,
                rightNo: null,
                leftText: leftLines[i],
                rightText: '',
            });
            i += 1;
            leftNo += 1;
        }
        else {
            rows.push({
                type: 'add',
                leftNo: null,
                rightNo,
                leftText: '',
                rightText: rightLines[j],
            });
            j += 1;
            rightNo += 1;
        }
    }
    while (i < m) {
        rows.push({
            type: 'remove',
            leftNo,
            rightNo: null,
            leftText: leftLines[i],
            rightText: '',
        });
        i += 1;
        leftNo += 1;
    }
    while (j < n) {
        rows.push({
            type: 'add',
            leftNo: null,
            rightNo,
            leftText: '',
            rightText: rightLines[j],
        });
        j += 1;
        rightNo += 1;
    }
    return rows;
};
const diffRows = computed(() => buildLineDiffRows(splitDiffLines(diffSourceContent(compareLeftResolved.value)), splitDiffLines(diffSourceContent(compareRightResolved.value))));
const diffRowsVisible = computed(() => (compareChangesOnly.value ? diffRows.value.filter((row) => row.type !== 'context') : diffRows.value));
const diffSummary = computed(() => diffRows.value.reduce((acc, row) => {
    if (row.type === 'add')
        acc.added += 1;
    else if (row.type === 'remove')
        acc.removed += 1;
    else
        acc.context += 1;
    return acc;
}, { context: 0, added: 0, removed: 0 }));
const diffHasChanges = computed(() => diffSummary.value.added > 0 || diffSummary.value.removed > 0);
const swapDiffSources = () => {
    const currentLeft = compareLeft.value;
    compareLeft.value = compareRight.value;
    compareRight.value = currentLeft;
};
const dumpYaml = (value) => {
    const isScalar = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
    const scalarInline = (v) => {
        if (v === null)
            return 'null';
        if (typeof v === 'string')
            return JSON.stringify(v);
        if (typeof v === 'number' || typeof v === 'boolean')
            return String(v);
        return JSON.stringify(String(v));
    };
    const emit = (v, indent = 0) => {
        const sp = ' '.repeat(indent);
        if (isScalar(v)) {
            if (typeof v === 'string' && v.includes('\n')) {
                const lines = v.split(/\r?\n/);
                return [sp + '|-', ...lines.map((l) => sp + '  ' + l)];
            }
            return [sp + scalarInline(v)];
        }
        if (Array.isArray(v)) {
            if (!v.length)
                return [sp + '[]'];
            const out = [];
            for (const item of v) {
                if (isScalar(item)) {
                    if (typeof item === 'string' && item.includes('\n')) {
                        const lines = item.split(/\r?\n/);
                        out.push(sp + '- |-');
                        out.push(...lines.map((l) => sp + '  ' + l));
                    }
                    else {
                        out.push(sp + '- ' + scalarInline(item));
                    }
                }
                else {
                    out.push(sp + '-');
                    out.push(...emit(item, indent + 2));
                }
            }
            return out;
        }
        if (typeof v === 'object') {
            const keys = Object.keys(v || {});
            if (!keys.length)
                return [sp + '{}'];
            const out = [];
            for (const k of keys) {
                const key = /^[A-Za-z0-9_.-]+$/.test(k) ? k : JSON.stringify(k);
                const val = v[k];
                if (isScalar(val)) {
                    if (typeof val === 'string' && val.includes('\n')) {
                        const lines = val.split(/\r?\n/);
                        out.push(sp + key + ': |-');
                        out.push(...lines.map((l) => sp + '  ' + l));
                    }
                    else {
                        out.push(sp + key + ': ' + scalarInline(val));
                    }
                }
                else {
                    if (Array.isArray(val) && !val.length) {
                        out.push(sp + key + ': []');
                    }
                    else {
                        out.push(sp + key + ':');
                        out.push(...emit(val, indent + 2));
                    }
                }
            }
            return out;
        }
        return [sp + JSON.stringify(String(v))];
    };
    return emit(value, 0).join('\n') + '\n';
};
const looksLikeFullConfig = (s) => {
    const t = (s || '').trim();
    if (!t)
        return false;
    return (/(^|\n)\s*proxies\s*:/m.test(t) ||
        /(^|\n)\s*proxy-groups\s*:/m.test(t) ||
        /(^|\n)\s*proxy-providers\s*:/m.test(t) ||
        /(^|\n)\s*rule-providers\s*:/m.test(t) ||
        /(^|\n)\s*rules\s*:/m.test(t));
};
const looksLikeRuntimeConfigs = (obj) => {
    if (!obj || typeof obj !== 'object')
        return false;
    const keys = Object.keys(obj);
    const hasPorts = keys.some((k) => ['port', 'socks-port', 'redir-port', 'tproxy-port', 'mixed-port'].includes(k));
    const hasGroups = keys.some((k) => ['proxy-groups', 'proxies', 'rules', 'proxy-providers', 'rule-providers'].includes(k));
    return hasPorts && !hasGroups;
};
const tryLoadFromFileLikeEndpoints = async (pathValue) => {
    const candidates = [
        { url: '/configs', params: { path: pathValue, format: 'raw' } },
        { url: '/configs', params: { path: pathValue, raw: true } },
        { url: '/configs', params: { path: pathValue, file: true } },
        { url: '/configs', params: { path: pathValue, download: true } },
        { url: '/configs/raw', params: { path: pathValue } },
        { url: '/configs/file', params: { path: pathValue } },
    ];
    for (const c of candidates) {
        try {
            const r = await axios.get(c.url, {
                params: c.params,
                responseType: 'text',
                silent: true,
                headers: {
                    Accept: 'text/plain, application/x-yaml, application/yaml, */*',
                    'X-Zash-Silent': '1',
                },
            });
            const data = r?.data;
            if (typeof data === 'string') {
                const s = data.trim();
                if (looksLikeFullConfig(s))
                    return data;
                if ((s.startsWith('{') || s.startsWith('[')) && (s.endsWith('}') || s.endsWith(']'))) {
                    try {
                        const parsed = JSON.parse(s);
                        const payloadValue = (parsed && (parsed.payload || parsed.data?.payload || parsed.config || parsed.yaml));
                        if (typeof payloadValue === 'string' && looksLikeFullConfig(payloadValue))
                            return payloadValue;
                    }
                    catch {
                        // ignore
                    }
                }
            }
            else if (data && typeof data === 'object') {
                const payloadValue = (data.payload || data.data?.payload || data.config || data.yaml);
                if (typeof payloadValue === 'string' && looksLikeFullConfig(payloadValue))
                    return payloadValue;
            }
        }
        catch {
            // try next
        }
    }
    return null;
};
const legacyLoad = async () => {
    if (legacyLoadBusy.value)
        return;
    legacyLoadBusy.value = true;
    try {
        if (agentEnabled.value) {
            const res = await agentMihomoConfigAPI();
            if (res?.ok && res?.contentB64) {
                payload.value = decodeB64Utf8(res.contentB64);
                showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' });
                return;
            }
        }
        const fileText = await tryLoadFromFileLikeEndpoints(path.value);
        if (fileText) {
            payload.value = fileText;
            showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' });
            return;
        }
        const raw = await getConfigsRawAPI({ path: path.value });
        const data = raw?.data;
        if (typeof data === 'string' && data.trim().length > 0) {
            const s = data.trim();
            if (looksLikeFullConfig(s)) {
                payload.value = data;
                showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' });
                return;
            }
            if (s.startsWith('{') || s.startsWith('[')) {
                try {
                    const parsed = JSON.parse(s);
                    if (looksLikeRuntimeConfigs(parsed)) {
                        payload.value =
                            `# Mihomo API /configs does not expose the full YAML file on this build.\n` +
                                `# Showing runtime config (ports/tun/etc). If your backend supports reading the file,\n` +
                                `# enable it to load: ${path.value}\n\n` +
                                dumpYaml(parsed);
                        showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' });
                        return;
                    }
                    payload.value = `# Converted from /configs (JSON)\n# Comments/ordering may differ from the original mihomo YAML.\n\n${dumpYaml(parsed)}`;
                    showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' });
                    return;
                }
                catch {
                    // ignore
                }
            }
            payload.value = data;
            showNotification({ content: 'mihomoConfigLoadSuccess', type: 'alert-success' });
            return;
        }
        const json = await getConfigsAPI();
        payload.value = `# Converted from /configs (JSON)\n# Comments/ordering may differ from the original mihomo YAML.\n\n${dumpYaml(json.data)}`;
        showNotification({ content: 'mihomoConfigLoadPartial', type: 'alert-info' });
    }
    catch {
        showNotification({ content: 'mihomoConfigLoadFailed', type: 'alert-error' });
    }
    finally {
        legacyLoadBusy.value = false;
    }
};
const legacyApply = async () => {
    if (legacyApplyBusy.value)
        return;
    legacyApplyBusy.value = true;
    try {
        await reloadConfigsAPI({ path: path.value || '', payload: payload.value || '' });
        showNotification({ content: 'reloadConfigsSuccess', type: 'alert-success' });
    }
    catch {
        // interceptor handles details
    }
    finally {
        legacyApplyBusy.value = false;
    }
};
const legacyRestart = async () => {
    if (legacyRestartBusy.value)
        return;
    legacyRestartBusy.value = true;
    try {
        await restartCoreAPI();
        showNotification({ content: 'restartCoreSuccess', type: 'alert-success' });
    }
    catch {
        // interceptor handles details
    }
    finally {
        legacyRestartBusy.value = false;
    }
};
const clearDraft = () => {
    payload.value = '';
    advancedSectionsForm.value = emptyAdvancedSectionsForm();
    dnsEditorForm.value = emptyDnsEditorForm();
};
watch(payload, () => {
    syncQuickEditorFromPayload();
    syncAdvancedSectionsFromPayload();
    syncDnsEditorFromPayload();
}, { immediate: true });
watch(parsedProxies, (entries) => {
    const selectedName = String(proxySelectedName.value || '').trim();
    if (selectedName) {
        const entry = entries.find((item) => item.name === selectedName);
        if (entry) {
            proxyForm.value = proxyFormFromEntry(entry);
            return;
        }
    }
    if (!selectedName && !String(proxyForm.value.name || '').trim().length) {
        proxyForm.value = emptyProxyForm();
    }
}, { immediate: true, deep: true });
watch(parsedProxyProviders, (entries) => {
    const selectedName = String(proxyProviderSelectedName.value || '').trim();
    if (selectedName) {
        const entry = entries.find((item) => item.name === selectedName);
        if (entry) {
            proxyProviderForm.value = proxyProviderFormFromEntry(entry);
            return;
        }
    }
    if (!selectedName && !String(proxyProviderForm.value.name || '').trim().length) {
        proxyProviderForm.value = emptyProxyProviderForm();
    }
}, { immediate: true, deep: true });
watch(parsedProxyGroups, (entries) => {
    const selectedName = String(proxyGroupSelectedName.value || '').trim();
    if (selectedName) {
        const entry = entries.find((item) => item.name === selectedName);
        if (entry) {
            proxyGroupForm.value = proxyGroupFormFromEntry(entry);
            return;
        }
    }
    if (!selectedName && !String(proxyGroupForm.value.name || '').trim().length) {
        proxyGroupForm.value = emptyProxyGroupForm();
    }
}, { immediate: true, deep: true });
watch(parsedRuleProviders, (entries) => {
    const selectedName = String(ruleProviderSelectedName.value || '').trim();
    if (selectedName) {
        const entry = entries.find((item) => item.name === selectedName);
        if (entry) {
            ruleProviderForm.value = ruleProviderFormFromEntry(entry);
            return;
        }
    }
    if (!selectedName && !String(ruleProviderForm.value.name || '').trim().length) {
        ruleProviderForm.value = emptyRuleProviderForm();
    }
}, { immediate: true, deep: true });
watch(parsedRules, (entries) => {
    const selectedIndex = Number.parseInt(String(ruleSelectedIndex.value || ''), 10);
    if (Number.isFinite(selectedIndex)) {
        const entry = entries.find((item) => item.index === selectedIndex);
        if (entry) {
            ruleForm.value = ruleFormFromEntry(entry);
            return;
        }
    }
    if (!String(ruleSelectedIndex.value || '').trim().length && !String(ruleForm.value.raw || '').trim().length) {
        ruleForm.value = emptyRuleForm();
    }
}, { immediate: true, deep: true });
watch([managedMode, configWorkspaceSections], () => {
    const current = configWorkspaceSections.value.find((section) => section.id === configWorkspaceSection.value);
    if (current && !current.disabled)
        return;
    const fallback = configWorkspaceSections.value.find((section) => !section.disabled)?.id || 'editor';
    if (configWorkspaceSection.value !== fallback)
        configWorkspaceSection.value = fallback;
}, { immediate: true });
onMounted(async () => {
    await refreshAll(true);
    syncAdvancedSectionsFromPayload();
    syncDnsEditorFromPayload();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card w-full max-w-none" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-none']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title flex items-center justify-between gap-2 px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.expanded = !__VLS_ctx.expanded;
            // @ts-ignore
            [expanded, expanded,];
        } },
    type: "button",
    ...{ class: "btn btn-ghost btn-circle btn-sm" },
    title: (__VLS_ctx.expanded ? __VLS_ctx.$t('collapse') : __VLS_ctx.$t('expand')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
if (__VLS_ctx.expanded) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.ChevronUpIcon} */
    ChevronUpIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else {
    let __VLS_5;
    /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
    ChevronDownIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('mihomoConfigEditor'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
(__VLS_ctx.managedMode ? __VLS_ctx.$t('configManagedMode') : __VLS_ctx.$t('configDirectMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.refreshAll(true);
            // @ts-ignore
            [expanded, expanded, $t, $t, $t, $t, $t, managedMode, refreshAll,];
        } },
    ...{ class: "btn btn-sm" },
    ...{ class: (__VLS_ctx.refreshBusy && 'loading') },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-3" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('configPath'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentPath);
if (__VLS_ctx.managedMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
        ...{ class: (__VLS_ctx.managedStatusBadgeClass) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.managedStatusText);
    if (__VLS_ctx.managedState?.active?.rev) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configActiveTitle'));
        (__VLS_ctx.managedState?.active?.rev);
    }
    if (__VLS_ctx.managedState?.draft?.rev) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDraftTitle'));
        (__VLS_ctx.managedState?.draft?.rev);
    }
    if (__VLS_ctx.managedState?.validator?.bin) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.managedState?.validator?.bin);
    }
    if (__VLS_ctx.managedState?.restart?.mode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDiagRestartMethod'));
        (__VLS_ctx.managedState?.restart?.mode);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configActiveTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 font-mono text-[11px] opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.managedState?.active?.path || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('updatedAt'));
    (__VLS_ctx.fmtTextTs(__VLS_ctx.managedState?.active?.updatedAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('size'));
    (__VLS_ctx.fmtBytes(__VLS_ctx.managedState?.active?.sizeBytes));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configDraftTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 font-mono text-[11px] opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.managedState?.draft?.path || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('updatedAt'));
    (__VLS_ctx.fmtTextTs(__VLS_ctx.managedState?.draft?.updatedAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('size'));
    (__VLS_ctx.fmtBytes(__VLS_ctx.managedState?.draft?.sizeBytes));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configBaselineTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 font-mono text-[11px] opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.managedState?.baseline?.path || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('updatedAt'));
    (__VLS_ctx.fmtTextTs(__VLS_ctx.managedState?.baseline?.updatedAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('size'));
    (__VLS_ctx.fmtBytes(__VLS_ctx.managedState?.baseline?.sizeBytes));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 text-[11px] opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configManagedTip'));
    if (__VLS_ctx.managedState?.lastError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 break-words text-[11px] text-warning" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
        (__VLS_ctx.managedState?.lastError);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "transparent-collapse collapse rounded-none shadow-none" },
    ...{ class: (__VLS_ctx.expanded ? 'collapse-open' : '') },
});
/** @type {__VLS_StyleScopedClasses['transparent-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-none']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "collapse-content p-0" },
});
/** @type {__VLS_StyleScopedClasses['collapse-content']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
if (__VLS_ctx.expanded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.managedMode ? __VLS_ctx.$t('configManagedEditorTip') : __VLS_ctx.$t('mihomoConfigEditorTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "overflow-x-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-200/60 p-1" },
    });
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-max']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1']} */ ;
    for (const [section] of __VLS_vFor((__VLS_ctx.configWorkspaceSections))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    __VLS_ctx.setConfigWorkspaceSection(section.id);
                    // @ts-ignore
                    [expanded, expanded, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, managedMode, managedMode, refreshBusy, currentPath, managedStatusBadgeClass, managedStatusText, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, fmtTextTs, fmtTextTs, fmtTextTs, fmtBytes, fmtBytes, fmtBytes, configWorkspaceSections, setConfigWorkspaceSection,];
                } },
            key: (section.id),
            type: "button",
            ...{ class: "tab whitespace-nowrap border-0" },
            ...{ class: ([__VLS_ctx.configWorkspaceSection === section.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100', section.disabled ? 'pointer-events-none opacity-40' : '']) },
            disabled: (section.disabled),
        });
        /** @type {__VLS_StyleScopedClasses['tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
        (__VLS_ctx.$t(section.labelKey));
        // @ts-ignore
        [$t, configWorkspaceSection,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'editor') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.managedMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!(__VLS_ctx.managedMode))
                        return;
                    __VLS_ctx.copyFromManaged('active');
                    // @ts-ignore
                    [managedMode, configWorkspaceSection, copyFromManaged,];
                } },
            ...{ class: "btn btn-sm" },
            disabled: (__VLS_ctx.busyAny),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('configLoadActiveToDraft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!(__VLS_ctx.managedMode))
                        return;
                    __VLS_ctx.copyFromManaged('baseline');
                    // @ts-ignore
                    [$t, copyFromManaged, busyAny,];
                } },
            ...{ class: "btn btn-sm" },
            disabled: (__VLS_ctx.busyAny || !__VLS_ctx.managedState?.baseline?.exists),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('configLoadBaselineToDraft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveDraft) },
            ...{ class: "btn btn-sm" },
            disabled: (__VLS_ctx.busyAny),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('saveDraft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.validateDraft) },
            ...{ class: "btn btn-sm" },
            disabled: (__VLS_ctx.busyAny),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('configValidateDraft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.applyDraft) },
            ...{ class: "btn btn-sm" },
            disabled: (__VLS_ctx.busyAny),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('configApplyDraft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.setBaselineFromActive) },
            ...{ class: "btn btn-sm btn-ghost" },
            disabled: (__VLS_ctx.busyAny || !__VLS_ctx.managedState?.active?.exists),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configPromoteActiveToBaseline'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.restoreBaseline) },
            ...{ class: "btn btn-sm btn-warning" },
            disabled: (__VLS_ctx.busyAny || !__VLS_ctx.managedState?.baseline?.exists),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configRestoreBaseline'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.legacyLoad) },
            ...{ class: "btn btn-sm" },
            ...{ class: (__VLS_ctx.legacyLoadBusy && 'loading') },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('load'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.legacyApply) },
            ...{ class: "btn btn-sm" },
            ...{ class: (__VLS_ctx.legacyApplyBusy && 'loading') },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('applyAndReload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.legacyRestart) },
            ...{ class: "btn btn-sm" },
            ...{ class: (__VLS_ctx.legacyRestartBusy && 'loading') },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('restartCore'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-sm h-[70vh] min-h-[28rem] w-full resize-y overflow-x-auto whitespace-pre font-mono leading-5 [tab-size:2]" },
        wrap: "off",
        value: (__VLS_ctx.payload),
        placeholder: (__VLS_ctx.$t('pasteYamlHere')),
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-[70vh]']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[28rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center justify-between gap-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.managedMode ? __VLS_ctx.$t('configDraftRemoteSaved') : __VLS_ctx.$t('mihomoConfigDraftSaved'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearDraft) },
        ...{ class: "btn btn-ghost btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('clearDraft'));
    if (__VLS_ctx.validationOutput) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.validationOk ? 'badge-success' : 'badge-error') },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.validationOk ? __VLS_ctx.$t('configValidationOk') : __VLS_ctx.$t('configValidationFailed'));
        if (__VLS_ctx.validationCmd) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.validationCmd);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "mt-2 whitespace-pre-wrap break-words font-mono text-[11px] opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.validationOutput);
    }
    if (__VLS_ctx.managedMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configLastSuccessfulTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configLastSuccessfulTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.lastSuccessfulBadgeClass) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.lastSuccessfulStatusText);
        if (__VLS_ctx.managedState?.lastSuccessful?.current) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-primary badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulCurrent'));
        }
        else if (__VLS_ctx.managedState?.lastSuccessful?.rev) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.$t('configHistoryRevisionLabel'));
            (__VLS_ctx.managedState?.lastSuccessful?.rev);
        }
        if (!__VLS_ctx.lastSuccessfulExists) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "space-y-2" },
            });
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulRevision'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.managedState?.lastSuccessful?.rev ?? '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagSource'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.sourceText(__VLS_ctx.managedState?.lastSuccessful?.source));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('updatedAt'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.fmtTextTs(__VLS_ctx.managedState?.lastSuccessful?.updatedAt));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulStorage'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.managedState?.lastSuccessful?.current ? __VLS_ctx.$t('configLastSuccessfulFromCurrent') : __VLS_ctx.$t('configLastSuccessfulFromHistory'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.loadLastSuccessfulIntoEditor) },
                ...{ class: "btn btn-sm" },
                disabled: (__VLS_ctx.busyAny || !__VLS_ctx.lastSuccessfulExists),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            (__VLS_ctx.$t('configLoadIntoEditor'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.compareDraftWithLastSuccessful) },
                ...{ class: "btn btn-sm btn-ghost" },
                disabled: (!__VLS_ctx.lastSuccessfulExists),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulCompareDraft'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.compareActiveWithLastSuccessful) },
                ...{ class: "btn btn-sm btn-ghost" },
                disabled: (!__VLS_ctx.lastSuccessfulExists || __VLS_ctx.managedState?.lastSuccessful?.current),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configLastSuccessfulCompareActive'));
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'overview') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configOverviewTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configOverviewTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configOverviewRows', { count: __VLS_ctx.overviewSummary.stats.totalLines }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configOverviewSectionsCount', { count: __VLS_ctx.overviewSummary.topLevelSections.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configOverviewSource'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.overviewSource),
        ...{ class: "select select-xs max-w-[220px]" },
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[220px]']} */ ;
    for (const [option] of __VLS_vFor((__VLS_ctx.diffSourceOptions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (`overview-${option.value}`),
            value: (option.value),
            disabled: (option.disabled),
        });
        (option.label);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, managedMode, managedMode, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, managedState, fmtTextTs, configWorkspaceSection, busyAny, busyAny, busyAny, busyAny, busyAny, busyAny, busyAny, saveDraft, validateDraft, applyDraft, setBaselineFromActive, restoreBaseline, legacyLoad, legacyLoadBusy, legacyApply, legacyApplyBusy, legacyRestart, legacyRestartBusy, payload, clearDraft, validationOutput, validationOutput, validationOk, validationOk, validationCmd, validationCmd, lastSuccessfulBadgeClass, lastSuccessfulStatusText, lastSuccessfulExists, lastSuccessfulExists, lastSuccessfulExists, lastSuccessfulExists, sourceText, loadLastSuccessfulIntoEditor, compareDraftWithLastSuccessful, compareActiveWithLastSuccessful, overviewSummary, overviewSummary, overviewSource, diffSourceOptions,];
    }
    if (!__VLS_ctx.overviewHasContent) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewEmpty'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-2 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configOverviewModeTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.mode));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewLogLevel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.logLevel));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewAllowLan'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewBoolText(__VLS_ctx.overviewSummary.scalars.allowLan));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewIpv6'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewBoolText(__VLS_ctx.overviewSummary.scalars.ipv6));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewUnifiedDelay'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewBoolText(__VLS_ctx.overviewSummary.scalars.unifiedDelay));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewFindProcessMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.findProcessMode));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configOverviewPortsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewMixedPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.mixedPort));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.port));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewSocksPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.socksPort));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewRedirPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.redirPort));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewTproxyPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.tproxyPort));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewController'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 break-all font-mono text-[11px]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.controller));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewSecretState'));
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.secretState));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-2 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configOverviewModulesTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
            ...{ class: (__VLS_ctx.sectionStateBadgeClass(__VLS_ctx.overviewSummary.sections.tun)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configOverviewTun'));
        (__VLS_ctx.sectionStateText(__VLS_ctx.overviewSummary.sections.tun));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
            ...{ class: (__VLS_ctx.sectionStateBadgeClass(__VLS_ctx.overviewSummary.sections.dns)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configOverviewDns'));
        (__VLS_ctx.sectionStateText(__VLS_ctx.overviewSummary.sections.dns));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
            ...{ class: (__VLS_ctx.sectionStateBadgeClass(__VLS_ctx.overviewSummary.sections.profile)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configOverviewProfile'));
        (__VLS_ctx.sectionStateText(__VLS_ctx.overviewSummary.sections.profile));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
            ...{ class: (__VLS_ctx.sectionStateBadgeClass(__VLS_ctx.overviewSummary.sections.sniffer)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configOverviewSniffer'));
        (__VLS_ctx.sectionStateText(__VLS_ctx.overviewSummary.sections.sniffer));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewGeodataMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.overviewText(__VLS_ctx.overviewSummary.scalars.geodataMode));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewTopLevelSections'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-wrap gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [section] of __VLS_vFor((__VLS_ctx.overviewSummary.topLevelSections))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (section),
                ...{ class: "badge badge-ghost badge-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (section);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewHasContent, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewText, overviewBoolText, overviewBoolText, overviewBoolText, sectionStateBadgeClass, sectionStateBadgeClass, sectionStateBadgeClass, sectionStateBadgeClass, sectionStateText, sectionStateText, sectionStateText, sectionStateText,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configOverviewRoutingTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewProxiesCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.counts.proxies);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewProxyGroupsCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.counts.proxyGroups);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewRulesCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.counts.rules);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewProxyProvidersCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.counts.proxyProviders);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewRuleProvidersCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.counts.ruleProviders);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewNonEmptyRows'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-lg font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.overviewSummary.stats.nonEmptyLines);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewCommentRows', { count: __VLS_ctx.overviewSummary.stats.commentLines }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configOverviewApproximate'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'structured') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configWorkspaceStructuredTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configWorkspaceStructuredTabTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-outline" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    (__VLS_ctx.$t('configWorkspaceStructuredTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.structuredEditorSections.find((item) => item.id === __VLS_ctx.structuredEditorSection)?.count ?? 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 overflow-x-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-100/60 p-1" },
    });
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-max']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.structuredEditorSections))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    __VLS_ctx.setStructuredEditorSection(item.id);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, configWorkspaceSection, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, overviewSummary, structuredEditorSections, structuredEditorSections, structuredEditorSection, setStructuredEditorSection,];
                } },
            key: (item.id),
            type: "button",
            ...{ class: "tab whitespace-nowrap border-0" },
            ...{ class: (__VLS_ctx.structuredEditorSection === item.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100') },
        });
        /** @type {__VLS_StyleScopedClasses['tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t(item.labelKey));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 badge badge-ghost badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (item.count);
        // @ts-ignore
        [$t, structuredEditorSection,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'quick') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configQuickEditorTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configQuickEditorTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configQuickEditorEditorScope'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.syncQuickEditorFromPayload) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configQuickEditorReadFromEditor'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyQuickEditorToPayload) },
        ...{ class: "btn btn-xs" },
        disabled: (!__VLS_ctx.quickEditorCanApply),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('configQuickEditorApplyToEditor'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorEmpty'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configQuickEditorGeneralTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.mode),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "rule",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "global",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "direct",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "script",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewLogLevel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.logLevel),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "info",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "warning",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "error",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "debug",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "silent",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewAllowLan'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.allowLan),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewIpv6'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.ipv6),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewUnifiedDelay'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.unifiedDelay),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewFindProcessMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.findProcessMode),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "off",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "always",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "strict",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewGeodataMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.geodataMode),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewController'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.controller),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configQuickEditorControllerPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorSecret'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.secret),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configQuickEditorSecretPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configQuickEditorPortsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewMixedPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.mixedPort),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "7890",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.port),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "7891",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewSocksPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.socksPort),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "7892",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewRedirPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.redirPort),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "7893",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configOverviewTproxyPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.tproxyPort),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "7894",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunEnable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.tunEnable),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunStack'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.tunStack),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "system",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "mixed",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "gvisor",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunAutoRoute'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.tunAutoRoute),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorTunAutoDetectInterface'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.tunAutoDetectInterface),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsEnable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.dnsEnable),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsIpv6'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.dnsIpv6),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        (__VLS_ctx.$t('enabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        (__VLS_ctx.$t('disabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsListen'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.quickEditor.dnsListen),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configQuickEditorDnsListenPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorDnsEnhancedMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.quickEditor.dnsEnhancedMode),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "redir-host",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "fake-ip",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "normal",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configQuickEditorPreviewTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configQuickEditorPreviewTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configQuickEditorPreviewAdded', { count: __VLS_ctx.quickEditorPreviewSummary.added }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configQuickEditorPreviewChanged', { count: __VLS_ctx.quickEditorPreviewSummary.changed }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-error badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configQuickEditorPreviewRemoved', { count: __VLS_ctx.quickEditorPreviewSummary.removed }));
        if (!__VLS_ctx.quickEditorPreviewChanges.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configQuickEditorPreviewNoChanges'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "space-y-3" },
            });
            /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.$t('configQuickEditorPreviewTotal', { count: __VLS_ctx.quickEditorPreviewChanges.length }));
            for (const [group] of __VLS_vFor((__VLS_ctx.quickEditorAffectedGroups))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (group),
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (__VLS_ctx.previewGroupLabel(group));
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, structuredEditorSection, syncQuickEditorFromPayload, applyQuickEditorToPayload, quickEditorCanApply, quickEditorHasPayload, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditor, quickEditorPreviewSummary, quickEditorPreviewSummary, quickEditorPreviewSummary, quickEditorPreviewChanges, quickEditorPreviewChanges, quickEditorAffectedGroups, previewGroupLabel,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "grid grid-cols-1 gap-2 xl:grid-cols-2" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.quickEditorPreviewChanges))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (item.key),
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.previewFieldLabel(item.key));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge" },
                    ...{ class: (__VLS_ctx.previewChangeBadgeClass(item.changeType)) },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                (__VLS_ctx.previewChangeTypeText(item.changeType));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (__VLS_ctx.previewGroupLabel(item.group));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 grid grid-cols-1 gap-2 md:grid-cols-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configQuickEditorPreviewBefore'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all font-mono text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.previewValueText(item.before));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configQuickEditorPreviewAfter'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all font-mono text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.previewValueText(item.after));
                // @ts-ignore
                [$t, $t, quickEditorPreviewChanges, previewGroupLabel, previewFieldLabel, previewChangeBadgeClass, previewChangeTypeText, previewValueText, previewValueText,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configQuickEditorCommonScope'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('configQuickEditorEmptyRemoves'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'runtime-sections') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configAdvancedSectionsTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configAdvancedSectionsTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configAdvancedSectionsCount', { count: __VLS_ctx.advancedSectionsSummary.totalItems }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.syncAdvancedSectionsFromPayload) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configAdvancedSectionsReadFromEditor'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyAdvancedSectionsToPayload) },
        ...{ class: "btn btn-xs" },
        disabled: (!__VLS_ctx.advancedSectionsCanApply),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('configAdvancedSectionsApplyToEditor'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('configAdvancedSectionsScopeTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configAdvancedTunTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunEnable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.tunEnable),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunStack'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.advancedSectionsForm.tunStack),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunStackPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunDevice'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.advancedSectionsForm.tunDevice),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunDevicePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunAutoRoute'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.tunAutoRoute),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunAutoDetectInterface'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.tunAutoDetectInterface),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunMtu'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.advancedSectionsForm.tunMtu),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunMtuPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2 xl:col-span-3" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunStrictRoute'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.tunStrictRoute),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunDnsHijack'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.tunDnsHijackText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunDnsHijackPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunIncludeAddress'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.tunRouteIncludeAddressText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunIncludeAddressPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunExcludeAddress'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.tunRouteExcludeAddressText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunExcludeAddressPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunIncludeInterface'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.tunIncludeInterfaceText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunIncludeInterfacePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedTunExcludeInterface'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.tunExcludeInterfaceText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedTunExcludeInterfacePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configAdvancedProfileTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedProfileTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedProfileStoreSelected'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.profileStoreSelected),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedProfileStoreFakeIp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.profileStoreFakeIp),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferEnable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.snifferEnable),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferParsePureIp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.snifferParsePureIp),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferOverrideDestination'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.advancedSectionsForm.snifferOverrideDestination),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferSniffProtocols'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.snifferSniffText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedSnifferSniffProtocolsPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferForceDomain'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.snifferForceDomainText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedSnifferForceDomainPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSnifferSkipDomain'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.advancedSectionsForm.snifferSkipDomainText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configAdvancedSnifferSkipDomainPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsSummaryTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsSummaryTun', { count: __VLS_ctx.advancedSectionsSummary.tun }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsSummaryProfile', { count: __VLS_ctx.advancedSectionsSummary.profile }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsSummarySniffer', { count: __VLS_ctx.advancedSectionsSummary.sniffer }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configAdvancedSectionsSummaryTip'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'proxies') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configProxiesTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configProxiesTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configProxiesCount', { count: __VLS_ctx.parsedProxies.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.prepareNewProxy) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configProxiesNew'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[22rem,minmax(0,1fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesListTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.filteredProxies.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control mb-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFilterLabel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyListQuery),
            type: "text",
            ...{ class: "input input-sm w-full" },
            placeholder: (__VLS_ctx.$t('configProxiesFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearProxyFilter) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.proxyListQuery),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('clear'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.topProxyTypeCounts))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (item.type),
                ...{ class: "badge badge-ghost badge-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (item.type);
            (item.count);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, structuredEditorSection, structuredEditorSection, quickEditorHasPayload, quickEditorHasPayload, advancedSectionsSummary, advancedSectionsSummary, advancedSectionsSummary, advancedSectionsSummary, syncAdvancedSectionsFromPayload, applyAdvancedSectionsToPayload, advancedSectionsCanApply, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, advancedSectionsForm, parsedProxies, prepareNewProxy, filteredProxies, proxyListQuery, proxyListQuery, clearProxyFilter, topProxyTypeCounts,];
        }
        if (!__VLS_ctx.filteredProxies.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesListEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-h-[32rem] space-y-2 overflow-auto pr-1" },
            });
            /** @type {__VLS_StyleScopedClasses['max-h-[32rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.filteredProxies))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!!(!__VLS_ctx.filteredProxies.length))
                                return;
                            __VLS_ctx.loadProxyIntoForm(item.name);
                            // @ts-ignore
                            [$t, filteredProxies, filteredProxies, loadProxyIntoForm,];
                        } },
                    key: (item.name),
                    type: "button",
                    ...{ class: "w-full rounded-lg border p-3 text-left transition" },
                    ...{ class: (__VLS_ctx.proxySelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40') },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (item.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (item.server || '—');
                if (item.port) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (item.port);
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (item.type || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge" },
                    ...{ class: (__VLS_ctx.providerReferenceBadgeClass(item.references.length)) },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                (__VLS_ctx.$t('configProxiesRefsShort', { count: item.references.length }));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 flex flex-wrap gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                if (item.network) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.network);
                }
                if (item.tls === 'true') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-success badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.udp === 'true') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-info badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.wsPath) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.grpcServiceName) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.httpMethod || item.httpPath.length || item.httpHeadersBody) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.smuxEnabled || item.smuxProtocol || item.smuxMaxConnections) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.wireguardPrivateKey || item.wireguardIp.length || item.wireguardReserved.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-info badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.hysteriaUp || item.hysteriaDown || item.hysteriaObfs) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-secondary badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.tuicCongestionController || item.tuicUdpRelayMode || item.tuicHeartbeatInterval) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-accent badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-accent']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.plugin) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-warning badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.realityPublicKey) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-secondary badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                // @ts-ignore
                [$t, proxySelectedName, providerReferenceBadgeClass,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.selectedProxyEntry ? __VLS_ctx.$t('configProxiesEditSelected') : __VLS_ctx.$t('configProxiesEditNew'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesEditTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startProxyCreationWizard) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configWizardStart'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.prepareNewProxy) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxiesResetForm'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.duplicateSelectedProxy) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.selectedProxyEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxiesDuplicate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveProxyToPayload) },
            ...{ class: "btn btn-xs" },
            disabled: (!__VLS_ctx.proxyFormCanSave),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('configProxiesSaveToEditor'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.disableSelectedProxy) },
            ...{ class: "btn btn-xs btn-warning" },
            disabled: (!__VLS_ctx.selectedProxyEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configProxiesDisable'));
        if (__VLS_ctx.proxyCreationWizard.active) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-primary/20 bg-primary/5 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configWizardTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesWizardTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.cancelProxyCreationWizard) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardCancel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap gap-2 text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepChooseTemplate'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepFillBasics'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepReview'));
            if (__VLS_ctx.proxyCreationWizard.step === 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
                for (const [template] of __VLS_vFor((__VLS_ctx.proxyCreationTemplates))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.expanded))
                                    return;
                                if (!!(!__VLS_ctx.quickEditorHasPayload))
                                    return;
                                if (!(__VLS_ctx.proxyCreationWizard.active))
                                    return;
                                if (!(__VLS_ctx.proxyCreationWizard.step === 1))
                                    return;
                                __VLS_ctx.selectProxyCreationWizardTemplate(template.id);
                                // @ts-ignore
                                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, prepareNewProxy, selectedProxyEntry, selectedProxyEntry, selectedProxyEntry, startProxyCreationWizard, duplicateSelectedProxy, saveProxyToPayload, proxyFormCanSave, disableSelectedProxy, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, cancelProxyCreationWizard, proxyCreationTemplates, selectProxyCreationWizardTemplate,];
                            } },
                        key: (`proxy-wizard-template-${template.id}`),
                        type: "button",
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t(template.labelKey));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t(template.descKey));
                    // @ts-ignore
                    [$t, $t,];
                }
            }
            else if (__VLS_ctx.proxyCreationWizard.step === 2) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 space-y-3" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2 xl:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configProxiesTypeAwareTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (__VLS_ctx.normalizedProxyCreationWizardType || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.proxyCreationWizardTypeSummary);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2 xl:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryTemplate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.activeProxyCreationWizardTemplate ? __VLS_ctx.$t(__VLS_ctx.activeProxyCreationWizardTemplate.labelKey) : '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.proxyCreationWizardScenarioSummary);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 flex flex-wrap gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                for (const [badge] of __VLS_vFor((__VLS_ctx.proxyCreationWizardScenarioBadges))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        key: (`wizard-scenario-${badge}`),
                        ...{ class: "badge badge-ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    (badge);
                    // @ts-ignore
                    [$t, $t, $t, proxyCreationWizard, normalizedProxyCreationWizardType, proxyCreationWizardTypeSummary, activeProxyCreationWizardTemplate, activeProxyCreationWizardTemplate, proxyCreationWizardScenarioSummary, proxyCreationWizardScenarioBadges,];
                }
                if (!__VLS_ctx.proxyCreationWizardScenarioBadges.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    (__VLS_ctx.normalizedProxyCreationWizardType || 'proxy');
                }
                if (__VLS_ctx.proxyCreationWizardMissingFieldLabels.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t('configWizardTitle'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 opacity-80" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
                    (__VLS_ctx.$t('configProxiesWizardTip'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-2 flex flex-wrap gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    for (const [label] of __VLS_vFor((__VLS_ctx.proxyCreationWizardMissingFieldLabels))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            key: (`wizard-missing-${label}`),
                            ...{ class: "badge badge-warning badge-outline" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                        (label);
                        // @ts-ignore
                        [$t, $t, normalizedProxyCreationWizardType, proxyCreationWizardScenarioBadges, proxyCreationWizardMissingFieldLabels, proxyCreationWizardMissingFieldLabels,];
                    }
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "rounded-lg border border-success/20 bg-success/10 p-3 text-sm opacity-90" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-success/20']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-success/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
                    (__VLS_ctx.$t('configProxiesTemplatesTip'));
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
                });
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesFieldName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyCreationWizard.name),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesFieldServer'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyCreationWizard.server),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesFieldPort'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyCreationWizard.port),
                    type: "text",
                    inputmode: "numeric",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                if (__VLS_ctx.proxyCreationWizardVisibility.transport) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldNetwork'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                        value: (__VLS_ctx.proxyCreationWizard.network),
                        ...{ class: "select select-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['select']} */ ;
                    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "",
                    });
                    (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "tcp",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "ws",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "grpc",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "http",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "h2",
                    });
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.security) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldTls'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                        value: (__VLS_ctx.proxyCreationWizard.tls),
                        ...{ class: "select select-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['select']} */ ;
                    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "",
                    });
                    (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        value: "false",
                    });
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.security) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldServername'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.servername),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldServernamePlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.security && __VLS_ctx.normalizedProxyCreationWizardType !== 'hysteria2') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldClientFingerprint'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.clientFingerprint),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldClientFingerprintPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.uuid) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldUuid'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.uuid),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldUuidPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.password) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldPassword'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.password),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldPasswordPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.cipher) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldCipher'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.cipher),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldCipherPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.flow) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldFlow'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.flow),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldFlowPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.wsPath) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldWsPath'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.wsPath),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldWsPathPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.grpcServiceName) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldGrpcServiceName'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.grpcServiceName),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldGrpcServiceNamePlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.reality) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldRealityPublicKey'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.realityPublicKey),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldRealityPublicKeyPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.reality) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldRealityShortId'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.realityShortId),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldRealityShortIdPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.wireguard) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldWireguardIp'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
                        value: (__VLS_ctx.proxyCreationWizard.wireguardIpText),
                        ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardIpPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
                    /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
                    /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.wireguard) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldWireguardPrivateKey'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
                        value: (__VLS_ctx.proxyCreationWizard.wireguardPrivateKey),
                        ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardPrivateKeyPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
                    /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
                    /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.wireguard) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control md:col-span-2 xl:col-span-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldWireguardPublicKey'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
                        value: (__VLS_ctx.proxyCreationWizard.wireguardPublicKey),
                        ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardPublicKeyPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
                    /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
                    /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.wireguard) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldWireguardMtu'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.wireguardMtu),
                        type: "text",
                        inputmode: "numeric",
                        ...{ class: "input input-sm" },
                        placeholder: "1420",
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.hysteria2) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldHysteriaObfs'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.hysteriaObfs),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.hysteria2) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPassword'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.hysteriaObfsPassword),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPasswordPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.tuic) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldTuicCongestionController'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.tuicCongestionController),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldTuicCongestionControllerPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.tuic) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldTuicUdpRelayMode'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.tuicUdpRelayMode),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldTuicUdpRelayModePlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
                if (__VLS_ctx.proxyCreationWizardVisibility.tuic) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "form-control" },
                    });
                    /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "label-text text-xs opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxiesFieldTuicHeartbeatInterval'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        value: (__VLS_ctx.proxyCreationWizard.tuicHeartbeatInterval),
                        type: "text",
                        ...{ class: "input input-sm" },
                        placeholder: (__VLS_ctx.$t('configProxiesFieldTuicHeartbeatIntervalPlaceholder')),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                }
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryTemplate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.$t(__VLS_ctx.proxyCreationTemplates.find((item) => item.id === __VLS_ctx.proxyCreationWizard.templateId)?.labelKey || 'configProxiesTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyCreationWizard.name || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryAddress'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyCreationWizard.server || '—');
                if (__VLS_ctx.proxyCreationWizard.port) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.proxyCreationWizard.port);
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configProxiesFieldType'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (__VLS_ctx.normalizedProxyCreationWizardType || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.proxyCreationWizardTypeSummary);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configProxiesTransportTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyCreationWizardTransportSummary);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configProxiesAuthTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyCreationWizardAuthSummary);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.prevProxyCreationWizardStep) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardBack'));
            if (__VLS_ctx.proxyCreationWizard.step < 3) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.nextProxyCreationWizardStep) },
                    ...{ class: "btn btn-xs" },
                    disabled: ((__VLS_ctx.proxyCreationWizard.step === 1 && !__VLS_ctx.proxyCreationWizard.templateId) || (__VLS_ctx.proxyCreationWizard.step === 2 && !__VLS_ctx.proxyCreationWizardCanProceed)),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardNext'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.finalizeProxyCreationWizard) },
                    ...{ class: "btn btn-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardApplyToForm'));
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configTemplateCardsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesTemplatesTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        for (const [template] of __VLS_vFor((__VLS_ctx.proxyCreationTemplates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyCreationTemplate(template.id);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationWizard, proxyCreationTemplates, proxyCreationTemplates, normalizedProxyCreationWizardType, normalizedProxyCreationWizardType, proxyCreationWizardTypeSummary, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardVisibility, proxyCreationWizardTransportSummary, proxyCreationWizardAuthSummary, prevProxyCreationWizardStep, nextProxyCreationWizardStep, proxyCreationWizardCanProceed, finalizeProxyCreationWizard, applyProxyCreationTemplate,];
                    } },
                key: (`proxy-template-${template.id}`),
                type: "button",
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t(template.labelKey));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t(template.descKey));
            // @ts-ignore
            [$t, $t,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2 xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.name),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.type),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "ss",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "vmess",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "vless",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "trojan",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "socks5",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "http",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "wireguard",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "hysteria2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "tuic",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "direct",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "reject",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2 xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldServer'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.server),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldServerPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldPort'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.port),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "443",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldNetwork'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.network),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "tcp",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "ws",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "grpc",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "http",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "h2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldUdp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.udp),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTfo'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.tfo),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldDialerProxy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.dialerProxy),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldDialerProxyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldInterfaceName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.interfaceName),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldInterfaceNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldPacketEncoding'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.packetEncoding),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldPacketEncodingPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-start justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesTypeAwareTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.proxyTypeSummary);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-1 text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configProxiesTypePresetLabel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [preset] of __VLS_vFor((__VLS_ctx.proxyTypePresets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyTypePreset(preset.id);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyTypeSummary, proxyTypePresets, applyProxyTypePreset,];
                    } },
                key: (preset.id),
                type: "button",
                ...{ class: "badge cursor-pointer border-0 px-2 py-2 transition" },
                ...{ class: (__VLS_ctx.normalizedProxyType === preset.id ? 'badge-primary' : 'badge-ghost hover:badge-outline') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            (preset.label);
            // @ts-ignore
            [normalizedProxyType,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.proxyTypeProfileLabel);
        for (const [focus] of __VLS_vFor((__VLS_ctx.proxyTypeFocusBadges))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (focus),
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (focus);
            // @ts-ignore
            [proxyTypeProfileLabel, proxyTypeFocusBadges,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configProxiesTypeAwareTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.security) }, null, null);
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesSecurityTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesSecurityTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTls'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.tls),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSkipCertVerify'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.skipCertVerify),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSni'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.sni),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldSniPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldServername'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.servername),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldServernamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldClientFingerprint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.clientFingerprint),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldClientFingerprintPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-4" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldAlpn'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.alpnText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldAlpnPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldRealityPublicKey'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.realityPublicKey),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldRealityPublicKeyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldRealityShortId'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.realityShortId),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldRealityShortIdPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.auth) }, null, null);
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesAuthTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesAuthTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldUuid'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.uuid),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldUuidPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldPassword'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.password),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldPasswordPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldCipher'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.cipher),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldCipherPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldFlow'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.flow),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldFlowPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.transport) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesTransportTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesTransportTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWsPath'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wsPath),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWsPathPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWsHeaders'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.wsHeadersBody),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWsHeadersPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldGrpcServiceName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.grpcServiceName),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldGrpcServiceNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldGrpcMultiMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.grpcMultiMode),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.plugin) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesPluginTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesPluginTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldPlugin'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.plugin),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldPluginPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldPluginOpts'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.pluginOptsBody),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldPluginOptsPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.httpOpts) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesHttpOptsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesHttpOptsTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHttpMethod'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.httpMethod),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHttpMethodPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHttpPath'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.httpPathText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHttpPathPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHttpHeaders'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.httpHeadersBody),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHttpHeadersPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.smux) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesSmuxTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesSmuxTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxEnabled'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.smuxEnabled),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxProtocol'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.smuxProtocol),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldSmuxProtocolPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxMaxConnections'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.smuxMaxConnections),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "4",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxMinStreams'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.smuxMinStreams),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "4",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxMaxStreams'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.smuxMaxStreams),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "16",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxPadding'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.smuxPadding),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldSmuxStatistic'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.smuxStatistic),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 xl:col-span-2" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.wireguard) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesWireguardTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesWireguardTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardIp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.wireguardIpText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardIpPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardIpv6'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.wireguardIpv6Text),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardIpv6Placeholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardPrivateKey'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wireguardPrivateKey),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardPrivateKeyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardPublicKey'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wireguardPublicKey),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardPublicKeyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardPresharedKey'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wireguardPresharedKey),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardPresharedKeyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardMtu'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wireguardMtu),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "1420",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardWorkers'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.wireguardWorkers),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "2",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-4" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldWireguardReserved'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.wireguardReservedText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldWireguardReservedPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.protocolExtras) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesProtocolExtrasTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesProtocolExtrasTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.hysteria2) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs font-semibold opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHysteriaUp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.hysteriaUp),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaUpPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHysteriaDown'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.hysteriaDown),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaDownPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHysteriaObfs'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.hysteriaObfs),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPassword'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.hysteriaObfsPassword),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldHysteriaObfsPasswordPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.proxyTypeVisibility.tuic) }, null, null);
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs font-semibold opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicCongestionController'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.tuicCongestionController),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldTuicCongestionControllerPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicUdpRelayMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.tuicUdpRelayMode),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldTuicUdpRelayModePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicHeartbeatInterval'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.tuicHeartbeatInterval),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldTuicHeartbeatIntervalPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicRequestTimeout'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyForm.tuicRequestTimeout),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxiesFieldTuicRequestTimeoutPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicFastOpen'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.tuicFastOpen),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicReduceRtt'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.tuicReduceRtt),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesFieldTuicDisableSni'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyForm.tuicDisableSni),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-1 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesExtraYamlTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesExtraYamlTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyForm.extraBody),
            ...{ class: "textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configProxiesExtraYamlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-32']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesReferencesTitle'));
        if (!__VLS_ctx.selectedProxyEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesReferencesSelect'));
        }
        else if (!__VLS_ctx.selectedProxyEntry.references.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesReferencesEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 space-y-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            if (__VLS_ctx.proxyReferencesSummary.groupRefs.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] font-semibold opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesReferencesGroups'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                for (const [refItem] of __VLS_vFor((__VLS_ctx.proxyReferencesSummary.groupRefs))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        key: (`g-${refItem.text}-${refItem.key}`),
                        ...{ class: "badge badge-outline" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    (refItem.text);
                    (refItem.key);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, selectedProxyEntry, selectedProxyEntry, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyForm, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyTypeVisibility, proxyReferencesSummary, proxyReferencesSummary,];
                }
            }
            if (__VLS_ctx.proxyReferencesSummary.ruleRefs.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] font-semibold opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesReferencesRules'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                for (const [refItem] of __VLS_vFor((__VLS_ctx.proxyReferencesSummary.ruleRefs))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (`r-${refItem.lineNo}-${refItem.text}`),
                        ...{ class: "rounded border border-base-content/10 bg-base-100/80 px-2 py-1 font-mono text-[11px]" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    (refItem.lineNo);
                    (refItem.text);
                    // @ts-ignore
                    [$t, proxyReferencesSummary, proxyReferencesSummary,];
                }
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxiesDisableImpactTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxiesDisableImpactTip'));
        if (!__VLS_ctx.selectedProxyEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesDisableImpactSelect'));
        }
        else if (!__VLS_ctx.proxyDisablePlan.impacts.length && !__VLS_ctx.proxyDisablePlan.rulesTouched) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxiesDisableImpactEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 space-y-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            for (const [impact] of __VLS_vFor((__VLS_ctx.proxyDisablePlan.impacts))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (impact.group),
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-2" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (impact.group);
                if (impact.fallbackInjected) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-warning badge-outline" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (impact.fallbackInjected ? __VLS_ctx.$t('configProxiesDisableImpactFallback') : __VLS_ctx.$t('configProxiesDisableImpactClean'));
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, selectedProxyEntry, proxyDisablePlan, proxyDisablePlan, proxyDisablePlan,];
            }
            if (__VLS_ctx.proxyDisablePlan.rulesTouched) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-2" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.$t('configProxiesDisableImpactRules', { count: __VLS_ctx.proxyDisablePlan.rulesTouched }));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxiesDisableImpactRulesTip'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                for (const [sample] of __VLS_vFor((__VLS_ctx.proxyDisablePlan.ruleSamples))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (`sample-${sample.lineNo}-${sample.text}`),
                        ...{ class: "rounded border border-base-content/10 bg-base-100 px-2 py-1 font-mono text-[11px]" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    (sample.lineNo);
                    (sample.text);
                    // @ts-ignore
                    [$t, $t, proxyDisablePlan, proxyDisablePlan, proxyDisablePlan,];
                }
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'proxy-providers') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configProxyProvidersTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configProxyProvidersTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configProxyProvidersCount', { count: __VLS_ctx.parsedProxyProviders.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.prepareNewProxyProvider) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configProxyProvidersNew'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[22rem,minmax(0,1fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersListTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.filteredProxyProviders.length);
        (__VLS_ctx.parsedProxyProviders.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "input input-sm input-bordered flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderListQuery),
            type: "text",
            ...{ class: "grow" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        if (__VLS_ctx.proxyProviderListQuery) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.clearProxyProviderFilter) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        }
        if (!__VLS_ctx.parsedProxyProviders.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersListEmpty'));
        }
        else if (!__VLS_ctx.filteredProxyProviders.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersFilteredEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 max-h-[32rem] space-y-2 overflow-auto pr-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[32rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.filteredProxyProviders))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!!(!__VLS_ctx.parsedProxyProviders.length))
                                return;
                            if (!!(!__VLS_ctx.filteredProxyProviders.length))
                                return;
                            __VLS_ctx.loadProxyProviderIntoForm(item.name);
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, $t, $t, $t, structuredEditorSection, quickEditorHasPayload, parsedProxyProviders, parsedProxyProviders, parsedProxyProviders, prepareNewProxyProvider, filteredProxyProviders, filteredProxyProviders, filteredProxyProviders, proxyProviderListQuery, proxyProviderListQuery, clearProxyProviderFilter, loadProxyProviderIntoForm,];
                        } },
                    key: (item.name),
                    type: "button",
                    ...{ class: "w-full rounded-lg border p-3 text-left transition" },
                    ...{ class: (__VLS_ctx.proxyProviderSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40') },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (item.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.proxyProviderDisplayValue(item.url || item.path));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (__VLS_ctx.proxyProviderDisplayValue(item.type));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge" },
                    ...{ class: (__VLS_ctx.providerReferenceBadgeClass(item.references.length)) },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                (__VLS_ctx.$t('configProxyProvidersReferencesCount', { count: item.references.length }));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 flex flex-wrap gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                if (item.path) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (__VLS_ctx.$t('configProxyProvidersPathShort'));
                    (item.path);
                }
                if (item.interval) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (__VLS_ctx.$t('configProxyProvidersIntervalShort'));
                    (item.interval);
                }
                if (item.filter) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.excludeFilter) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.healthCheckUrl || item.healthCheckEnable) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-success badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.overrideBody) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-warning badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                // @ts-ignore
                [$t, $t, $t, providerReferenceBadgeClass, proxyProviderSelectedName, proxyProviderDisplayValue, proxyProviderDisplayValue,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3 rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.selectedProxyProviderEntry ? __VLS_ctx.$t('configProxyProvidersEditSelected') : __VLS_ctx.$t('configProxyProvidersEditNew'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersEditTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startProxyProviderCreationWizard) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configWizardStart'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.prepareNewProxyProvider) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxyProvidersResetForm'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.duplicateSelectedProxyProvider) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.selectedProxyProviderEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxyProvidersDuplicate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveProxyProviderToPayload) },
            ...{ class: "btn btn-xs" },
            disabled: (!__VLS_ctx.proxyProviderFormCanSave),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('configProxyProvidersSaveToEditor'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.disableSelectedProxyProvider) },
            ...{ class: "btn btn-xs btn-warning" },
            disabled: (!__VLS_ctx.selectedProxyProviderEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configProxyProvidersDisable'));
        if (__VLS_ctx.proxyProviderCreationWizard.active) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-primary/20 bg-primary/5 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configWizardTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersWizardTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.cancelProxyProviderCreationWizard) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardCancel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap gap-2 text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyProviderCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepChooseTemplate'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyProviderCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepFillBasics'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyProviderCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepReview'));
            if (__VLS_ctx.proxyProviderCreationWizard.step === 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
                for (const [template] of __VLS_vFor((__VLS_ctx.proxyProviderCreationTemplates))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.expanded))
                                    return;
                                if (!!(!__VLS_ctx.quickEditorHasPayload))
                                    return;
                                if (!(__VLS_ctx.proxyProviderCreationWizard.active))
                                    return;
                                if (!(__VLS_ctx.proxyProviderCreationWizard.step === 1))
                                    return;
                                __VLS_ctx.selectProxyProviderCreationWizardTemplate(template.id);
                                // @ts-ignore
                                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, prepareNewProxyProvider, selectedProxyProviderEntry, selectedProxyProviderEntry, selectedProxyProviderEntry, startProxyProviderCreationWizard, duplicateSelectedProxyProvider, saveProxyProviderToPayload, proxyProviderFormCanSave, disableSelectedProxyProvider, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, cancelProxyProviderCreationWizard, proxyProviderCreationTemplates, selectProxyProviderCreationWizardTemplate,];
                            } },
                        key: (`provider-wizard-template-${template.id}`),
                        type: "button",
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t(template.labelKey));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t(template.descKey));
                    // @ts-ignore
                    [$t, $t,];
                }
            }
            else if (__VLS_ctx.proxyProviderCreationWizard.step === 2) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersFieldName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyProviderCreationWizard.name),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersFieldType'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (__VLS_ctx.proxyProviderCreationWizard.type),
                    ...{ class: "select select-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['select']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "http",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "file",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "inline",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersFieldUrl'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyProviderCreationWizard.url),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersFieldPath'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyProviderCreationWizard.path),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersFieldInterval'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyProviderCreationWizard.interval),
                    type: "text",
                    inputmode: "numeric",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryTemplate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.$t(__VLS_ctx.proxyProviderCreationTemplates.find((item) => item.id === __VLS_ctx.proxyProviderCreationWizard.templateId)?.labelKey || 'configProxyProvidersTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyProviderCreationWizard.name || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryPath'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyProviderCreationWizard.path || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryInterval'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.proxyProviderCreationWizard.interval || '—');
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.prevProxyProviderCreationWizardStep) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardBack'));
            if (__VLS_ctx.proxyProviderCreationWizard.step < 3) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.nextProxyProviderCreationWizardStep) },
                    ...{ class: "btn btn-xs" },
                    disabled: (__VLS_ctx.proxyProviderCreationWizard.step === 1 && !__VLS_ctx.proxyProviderCreationWizard.templateId),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardNext'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.finalizeProxyProviderCreationWizard) },
                    ...{ class: "btn btn-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardApplyToForm'));
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configTemplateCardsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersTemplatesTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        for (const [template] of __VLS_vFor((__VLS_ctx.proxyProviderCreationTemplates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyProviderCreationTemplate(template.id);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationWizard, proxyProviderCreationTemplates, proxyProviderCreationTemplates, prevProxyProviderCreationWizardStep, nextProxyProviderCreationWizardStep, finalizeProxyProviderCreationWizard, applyProxyProviderCreationTemplate,];
                    } },
                key: (`proxy-provider-template-${template.id}`),
                type: "button",
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t(template.labelKey));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t(template.descKey));
            // @ts-ignore
            [$t, $t,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersTypeAwareTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersTypeAwareTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.proxyProviderTypeProfile.accent) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.proxyProviderDisplayValue(__VLS_ctx.proxyProviderForm.type));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        for (const [type] of __VLS_vFor((__VLS_ctx.proxyProviderTypePresets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyProviderTypePreset(type);
                        // @ts-ignore
                        [$t, $t, proxyProviderDisplayValue, proxyProviderTypeProfile, proxyProviderForm, proxyProviderTypePresets, applyProxyProviderTypePreset,];
                    } },
                key: (`proxy-provider-type-${type}`),
                type: "button",
                ...{ class: "badge badge-outline cursor-pointer" },
                ...{ class: (__VLS_ctx.normalizedProxyProviderType === type ? 'badge-primary' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            (type);
            // @ts-ignore
            [normalizedProxyProviderType,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-200/50 p-3 text-[11px] opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.proxyProviderTypeProfile.summary);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-3 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersSectionIdentity'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.name),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFieldNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyProviderForm.type),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "http",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "file",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "inline",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-3 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersSectionSource'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldUrl'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.url),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFieldUrlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldPath'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.path),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFieldPathPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldInterval'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.interval),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "86400",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldFilter'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.filter),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFieldFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersFieldExcludeFilter'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.excludeFilter),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersFieldExcludeFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyProxyProviderHealthPreset('https://www.gstatic.com/generate_204');
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyProviderTypeProfile, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, applyProxyProviderHealthPreset,];
                } },
            type: "button",
            ...{ class: "badge badge-outline cursor-pointer" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyProxyProviderHealthPreset('https://connectivitycheck.gstatic.com/generate_204');
                    // @ts-ignore
                    [applyProxyProviderHealthPreset,];
                } },
            type: "button",
            ...{ class: "badge badge-outline cursor-pointer" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckEnable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyProviderForm.healthCheckEnable),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckUrl'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.healthCheckUrl),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyProvidersHealthCheckUrlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckInterval'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyProviderForm.healthCheckInterval),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "300",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckLazy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyProviderForm.healthCheckLazy),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control xl:col-span-3" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:col-span-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersHealthCheckExtra'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyProviderForm.healthCheckExtraBody),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configProxyProvidersHealthCheckExtraPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersOverrideTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersOverrideTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyProviderForm.overrideBody),
            ...{ class: "mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configProxyProvidersOverridePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersExtraYamlTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersExtraYamlTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyProviderForm.extraBody),
            ...{ class: "mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configProxyProvidersExtraYamlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersReferencesTitle'));
        if (!__VLS_ctx.selectedProxyProviderEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersReferencesSelect'));
        }
        else if (!__VLS_ctx.selectedProxyProviderEntry.references.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersReferencesEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [refItem] of __VLS_vFor((__VLS_ctx.selectedProxyProviderEntry.references))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`${refItem.group}-${refItem.key}`),
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (refItem.group);
                (refItem.key);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, selectedProxyProviderEntry, selectedProxyProviderEntry, selectedProxyProviderEntry, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm, proxyProviderForm,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyProvidersDisableImpactTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyProvidersDisableImpactTip'));
        if (!__VLS_ctx.selectedProxyProviderEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyProvidersDisableImpactSelect'));
        }
        else {
            if (!__VLS_ctx.proxyProviderDisableImpact.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyProvidersDisableImpactEmpty'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                for (const [impact] of __VLS_vFor((__VLS_ctx.proxyProviderDisableImpact))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (`${impact.group}-${impact.keys.join('-')}`),
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/50 p-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap items-center justify-between gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (impact.group);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    (impact.keys.join(', '));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (impact.fallbackInjected ? __VLS_ctx.$t('configProxyProvidersDisableImpactFallback') : __VLS_ctx.$t('configProxyProvidersDisableImpactClean'));
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, selectedProxyProviderEntry, proxyProviderDisableImpact, proxyProviderDisableImpact,];
                }
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'proxy-groups') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configProxyGroupsTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configProxyGroupsTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configProxyGroupsCount', { count: __VLS_ctx.parsedProxyGroups.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.prepareNewProxyGroup) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configProxyGroupsNew'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[24rem,minmax(0,1fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[24rem,minmax(0,1fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyGroupsListTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.parsedProxyGroups.length);
        if (!__VLS_ctx.parsedProxyGroups.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyGroupsListEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-h-[36rem] space-y-2 overflow-auto pr-1" },
            });
            /** @type {__VLS_StyleScopedClasses['max-h-[36rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.parsedProxyGroups))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!!(!__VLS_ctx.parsedProxyGroups.length))
                                return;
                            __VLS_ctx.loadProxyGroupIntoForm(item.name);
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, $t, structuredEditorSection, quickEditorHasPayload, parsedProxyGroups, parsedProxyGroups, parsedProxyGroups, parsedProxyGroups, prepareNewProxyGroup, loadProxyGroupIntoForm,];
                        } },
                    key: (item.name),
                    type: "button",
                    ...{ class: "w-full rounded-lg border p-3 text-left transition" },
                    ...{ class: (__VLS_ctx.proxyGroupSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40') },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (item.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (item.type || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (item.type || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (__VLS_ctx.$t('configProxyGroupsRefsShort', { count: item.references.length }));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 flex flex-wrap gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                if (item.proxies.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.proxies.length);
                }
                if (item.use.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.use.length);
                }
                if (item.providers.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.providers.length);
                }
                if (item.url) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                if (item.interval) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.interval);
                }
                if (item.includeAll) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-success badge-outline badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                }
                // @ts-ignore
                [$t, proxyGroupSelectedName,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.selectedProxyGroupEntry ? __VLS_ctx.$t('configProxyGroupsEditSelected') : __VLS_ctx.$t('configProxyGroupsEditNew'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsEditTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startProxyGroupCreationWizard) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configWizardStart'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.prepareNewProxyGroup) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxyGroupsResetForm'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.duplicateSelectedProxyGroup) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.selectedProxyGroupEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configProxyGroupsDuplicate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveProxyGroupToPayload) },
            ...{ class: "btn btn-xs" },
            disabled: (!__VLS_ctx.proxyGroupFormCanSave),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('configProxyGroupsSaveToEditor'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.disableSelectedProxyGroup) },
            ...{ class: "btn btn-xs btn-warning" },
            disabled: (!__VLS_ctx.selectedProxyGroupEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configProxyGroupsDisable'));
        if (__VLS_ctx.proxyGroupCreationWizard.active) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-primary/20 bg-primary/5 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configWizardTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyGroupsWizardTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.cancelProxyGroupCreationWizard) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardCancel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap gap-2 text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyGroupCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepChooseTemplate'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyGroupCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepFillBasics'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.proxyGroupCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepReview'));
            if (__VLS_ctx.proxyGroupCreationWizard.step === 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
                for (const [template] of __VLS_vFor((__VLS_ctx.proxyGroupCreationTemplates))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.expanded))
                                    return;
                                if (!!(!__VLS_ctx.quickEditorHasPayload))
                                    return;
                                if (!(__VLS_ctx.proxyGroupCreationWizard.active))
                                    return;
                                if (!(__VLS_ctx.proxyGroupCreationWizard.step === 1))
                                    return;
                                __VLS_ctx.selectProxyGroupCreationWizardTemplate(template.id);
                                // @ts-ignore
                                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, prepareNewProxyGroup, selectedProxyGroupEntry, selectedProxyGroupEntry, selectedProxyGroupEntry, startProxyGroupCreationWizard, duplicateSelectedProxyGroup, saveProxyGroupToPayload, proxyGroupFormCanSave, disableSelectedProxyGroup, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, cancelProxyGroupCreationWizard, proxyGroupCreationTemplates, selectProxyGroupCreationWizardTemplate,];
                            } },
                        key: (`group-wizard-template-${template.id}`),
                        type: "button",
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t(template.labelKey));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t(template.descKey));
                    // @ts-ignore
                    [$t, $t,];
                }
            }
            else if (__VLS_ctx.proxyGroupCreationWizard.step === 2) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsFieldName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.name),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsFieldType'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.type),
                    ...{ class: "select select-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['select']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "select",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "url-test",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "fallback",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "load-balance",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "relay",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configWizardSummaryMembers'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.membersText),
                    ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
                });
                /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
                /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
                /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.providersText),
                    ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
                });
                /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
                /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
                /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsFieldUrl'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.url),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsFieldInterval'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.proxyGroupCreationWizard.interval),
                    type: "text",
                    inputmode: "numeric",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryTemplate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.$t(__VLS_ctx.proxyGroupCreationTemplates.find((item) => item.id === __VLS_ctx.proxyGroupCreationWizard.templateId)?.labelKey || 'configProxyGroupsTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.proxyGroupCreationWizard.name || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryMembers'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.splitFormList(__VLS_ctx.proxyGroupCreationWizard.membersText).length);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryInterval'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.proxyGroupCreationWizard.interval || '—');
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.prevProxyGroupCreationWizardStep) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardBack'));
            if (__VLS_ctx.proxyGroupCreationWizard.step < 3) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.nextProxyGroupCreationWizardStep) },
                    ...{ class: "btn btn-xs" },
                    disabled: (__VLS_ctx.proxyGroupCreationWizard.step === 1 && !__VLS_ctx.proxyGroupCreationWizard.templateId),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardNext'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.finalizeProxyGroupCreationWizard) },
                    ...{ class: "btn btn-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardApplyToForm'));
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configTemplateCardsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsTemplatesTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        for (const [template] of __VLS_vFor((__VLS_ctx.proxyGroupCreationTemplates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyGroupCreationTemplate(template.id);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationWizard, proxyGroupCreationTemplates, proxyGroupCreationTemplates, splitFormList, prevProxyGroupCreationWizardStep, nextProxyGroupCreationWizardStep, finalizeProxyGroupCreationWizard, applyProxyGroupCreationTemplate,];
                    } },
                key: (`proxy-group-template-${template.id}`),
                type: "button",
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t(template.labelKey));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t(template.descKey));
            // @ts-ignore
            [$t, $t,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.name),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyGroupForm.type),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "select",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "url-test",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "fallback",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "load-balance",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "relay",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "md:col-span-2 rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyGroupsTypeAwareTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.proxyGroupTypeProfile.summary);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.proxyGroupTypeProfile.accent) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.normalizedProxyGroupType || 'select');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        for (const [preset] of __VLS_vFor((__VLS_ctx.proxyGroupTypePresets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyProxyGroupTypePreset(preset);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, proxyGroupForm, proxyGroupForm, proxyGroupTypeProfile, proxyGroupTypeProfile, normalizedProxyGroupType, proxyGroupTypePresets, applyProxyGroupTypePreset,];
                    } },
                key: (`proxy-group-preset-${preset}`),
                type: "button",
                ...{ class: "btn btn-xs" },
                ...{ class: (__VLS_ctx.normalizedProxyGroupType === preset ? 'btn-primary' : 'btn-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (preset);
            // @ts-ignore
            [normalizedProxyGroupType,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap items-center gap-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configProxyGroupsTypeAwareFields'));
        for (const [field] of __VLS_vFor((__VLS_ctx.proxyGroupTypeProfile.fields))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`proxy-group-field-${field}`),
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (field);
            // @ts-ignore
            [$t, proxyGroupTypeProfile,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldUrl'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.url),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldUrlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldInterval'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.interval),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "300",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldStrategy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.strategy),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldStrategyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldLazy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyGroupForm.lazy),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldDisableUdp'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyGroupForm.disableUdp),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldIncludeAll'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.proxyGroupForm.includeAll),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldTolerance'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.tolerance),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "50",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldTimeout'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.proxyGroupForm.timeout),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "3000",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldProxies'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configProxyGroupsMembersHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyGroupForm.proxiesText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldProxiesPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        if (__VLS_ctx.proxyGroupSelectedLists.proxies.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSelectedLists.proxies))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSelectedLists.proxies.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('proxiesText', item);
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupForm, proxyGroupSelectedLists, proxyGroupSelectedLists, toggleProxyGroupListValue,];
                        } },
                    key: (`selected-group-proxy-${item}`),
                    type: "button",
                    ...{ class: "badge badge-primary badge-outline gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (item);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                // @ts-ignore
                [];
            }
        }
        if (__VLS_ctx.proxyGroupSuggestedProxyMembers.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSuggestedProxyMembers))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSuggestedProxyMembers.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('proxiesText', item);
                            // @ts-ignore
                            [toggleProxyGroupListValue, proxyGroupSuggestedProxyMembers, proxyGroupSuggestedProxyMembers,];
                        } },
                    key: (`suggest-group-proxy-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldUse'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configProxyGroupsProvidersHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyGroupForm.useText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldUsePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        if (__VLS_ctx.proxyGroupSelectedLists.use.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSelectedLists.use))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSelectedLists.use.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('useText', item);
                            // @ts-ignore
                            [$t, $t, $t, proxyGroupForm, proxyGroupSelectedLists, proxyGroupSelectedLists, toggleProxyGroupListValue,];
                        } },
                    key: (`selected-group-use-${item}`),
                    type: "button",
                    ...{ class: "badge badge-secondary badge-outline gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (item);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                // @ts-ignore
                [];
            }
        }
        if (__VLS_ctx.proxyGroupSuggestedUseMembers.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSuggestedUseMembers))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSuggestedUseMembers.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('useText', item);
                            // @ts-ignore
                            [toggleProxyGroupListValue, proxyGroupSuggestedUseMembers, proxyGroupSuggestedUseMembers,];
                        } },
                    key: (`suggest-group-use-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsFieldProviders'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configProxyGroupsProvidersHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyGroupForm.providersText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configProxyGroupsFieldProvidersPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        if (__VLS_ctx.proxyGroupSelectedLists.providers.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSelectedLists.providers))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSelectedLists.providers.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('providersText', item);
                            // @ts-ignore
                            [$t, $t, $t, proxyGroupForm, proxyGroupSelectedLists, proxyGroupSelectedLists, toggleProxyGroupListValue,];
                        } },
                    key: (`selected-group-provider-${item}`),
                    type: "button",
                    ...{ class: "badge badge-accent badge-outline gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-accent']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (item);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                // @ts-ignore
                [];
            }
        }
        if (__VLS_ctx.proxyGroupSuggestedProviderMembers.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.proxyGroupSuggestedProviderMembers))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.proxyGroupSuggestedProviderMembers.length))
                                return;
                            __VLS_ctx.toggleProxyGroupListValue('providersText', item);
                            // @ts-ignore
                            [toggleProxyGroupListValue, proxyGroupSuggestedProviderMembers, proxyGroupSuggestedProviderMembers,];
                        } },
                    key: (`suggest-group-provider-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-1 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyGroupsExtraYamlTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsExtraYamlTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.proxyGroupForm.extraBody),
            ...{ class: "textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configProxyGroupsExtraYamlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-32']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyGroupsReferencesTitle'));
        if (!__VLS_ctx.selectedProxyGroupEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyGroupsReferencesSelect'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyGroupsReferencesTip'));
            if (!__VLS_ctx.proxyGroupReferencesSummary.groupRefs.length && !__VLS_ctx.proxyGroupReferencesSummary.ruleRefs.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsReferencesEmpty'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                if (__VLS_ctx.proxyGroupReferencesSummary.groupRefs.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mb-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxyGroupsReferencesGroups'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    for (const [refItem] of __VLS_vFor((__VLS_ctx.proxyGroupReferencesSummary.groupRefs))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            key: (`group-${refItem.text}-${refItem.key}`),
                            ...{ class: "badge badge-outline" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                        (refItem.text);
                        (refItem.key);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, selectedProxyGroupEntry, proxyGroupForm, proxyGroupReferencesSummary, proxyGroupReferencesSummary, proxyGroupReferencesSummary, proxyGroupReferencesSummary,];
                    }
                }
                if (__VLS_ctx.proxyGroupReferencesSummary.ruleRefs.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mb-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t('configProxyGroupsReferencesRules'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    for (const [refItem] of __VLS_vFor((__VLS_ctx.proxyGroupReferencesSummary.ruleRefs.slice(0, 8)))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            key: (`rule-${refItem.lineNo}-${refItem.text}`),
                            ...{ class: "badge badge-ghost" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                        (refItem.lineNo);
                        // @ts-ignore
                        [$t, proxyGroupReferencesSummary, proxyGroupReferencesSummary,];
                    }
                    if (__VLS_ctx.proxyGroupReferencesSummary.ruleRefs.length > 8) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "badge badge-outline" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                        (__VLS_ctx.proxyGroupReferencesSummary.ruleRefs.length - 8);
                    }
                }
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configProxyGroupsDisableImpactTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configProxyGroupsDisableImpactTip'));
        if (!__VLS_ctx.selectedProxyGroupEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configProxyGroupsDisableImpactSelect'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.$t('configProxyGroupsDisableImpactRules', { count: __VLS_ctx.proxyGroupDisablePlan.rulesTouched }));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.$t('configProxyGroupsDisableImpactGroups', { count: __VLS_ctx.proxyGroupDisablePlan.impacts.length }));
            if (!__VLS_ctx.proxyGroupDisablePlan.impacts.length && !__VLS_ctx.proxyGroupDisablePlan.rulesTouched) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configProxyGroupsDisableImpactEmpty'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                for (const [impact] of __VLS_vFor((__VLS_ctx.proxyGroupDisablePlan.impacts))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (impact.group),
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap items-center justify-between gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (impact.group);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    (impact.keys.join(', '));
                    if (impact.fallbackInjected) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "badge badge-warning badge-outline" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (impact.fallbackInjected ? __VLS_ctx.$t('configProxyGroupsDisableImpactFallback') : __VLS_ctx.$t('configProxyGroupsDisableImpactClean'));
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, selectedProxyGroupEntry, proxyGroupReferencesSummary, proxyGroupReferencesSummary, proxyGroupDisablePlan, proxyGroupDisablePlan, proxyGroupDisablePlan, proxyGroupDisablePlan, proxyGroupDisablePlan,];
                }
                if (__VLS_ctx.proxyGroupDisablePlan.ruleSamples.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t('configProxyGroupsDisableImpactRulesTitle'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-2 space-y-1" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                    for (const [sample] of __VLS_vFor((__VLS_ctx.proxyGroupDisablePlan.ruleSamples))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            key: (`rule-sample-${sample.lineNo}-${sample.text}`),
                            ...{ class: "font-mono text-[11px] break-all" },
                        });
                        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                        (sample.lineNo);
                        (sample.text);
                        // @ts-ignore
                        [$t, proxyGroupDisablePlan, proxyGroupDisablePlan,];
                    }
                }
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'rule-providers') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configRuleProvidersTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configRuleProvidersTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configRuleProvidersCount', { count: __VLS_ctx.parsedRuleProviders.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.prepareNewRuleProvider) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configRuleProvidersNew'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[22rem,minmax(0,1fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersListTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.filteredRuleProviders.length);
        (__VLS_ctx.parsedRuleProviders.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "input input-sm input-bordered flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleProviderListQuery),
            type: "text",
            ...{ class: "grow" },
            placeholder: (__VLS_ctx.$t('configRuleProvidersFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        if (__VLS_ctx.ruleProviderListQuery) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.clearRuleProviderFilter) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        }
        if (!__VLS_ctx.parsedRuleProviders.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRuleProvidersListEmpty'));
        }
        else if (!__VLS_ctx.filteredRuleProviders.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRuleProvidersFilteredEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 max-h-[32rem] space-y-2 overflow-auto pr-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[32rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.filteredRuleProviders))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!!(!__VLS_ctx.parsedRuleProviders.length))
                                return;
                            if (!!(!__VLS_ctx.filteredRuleProviders.length))
                                return;
                            __VLS_ctx.loadRuleProviderIntoForm(item.name);
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, $t, $t, $t, structuredEditorSection, quickEditorHasPayload, parsedRuleProviders, parsedRuleProviders, parsedRuleProviders, prepareNewRuleProvider, filteredRuleProviders, filteredRuleProviders, filteredRuleProviders, ruleProviderListQuery, ruleProviderListQuery, clearRuleProviderFilter, loadRuleProviderIntoForm,];
                        } },
                    key: (item.name),
                    type: "button",
                    ...{ class: "w-full rounded-lg border p-3 text-left transition" },
                    ...{ class: (__VLS_ctx.ruleProviderSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40') },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (item.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.proxyProviderDisplayValue(item.url || item.path));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (item.behavior || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge" },
                    ...{ class: (__VLS_ctx.providerReferenceBadgeClass(item.references.length)) },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                (__VLS_ctx.$t('configRuleProvidersReferencesCount', { count: item.references.length }));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 flex flex-wrap gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                if (item.path) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.path);
                }
                if (item.interval) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.interval);
                }
                if (item.format) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.format);
                }
                if (item.type) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (item.type);
                }
                // @ts-ignore
                [$t, providerReferenceBadgeClass, proxyProviderDisplayValue, ruleProviderSelectedName,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3 rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.selectedRuleProviderEntry ? __VLS_ctx.$t('configRuleProvidersEditSelected') : __VLS_ctx.$t('configRuleProvidersEditNew'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersEditTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startRuleProviderCreationWizard) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configWizardStart'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.prepareNewRuleProvider) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRuleProvidersResetForm'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.duplicateSelectedRuleProvider) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.selectedRuleProviderEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRuleProvidersDuplicate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveRuleProviderToPayload) },
            ...{ class: "btn btn-xs" },
            disabled: (!__VLS_ctx.ruleProviderFormCanSave),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('configRuleProvidersSaveToEditor'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.disableSelectedRuleProvider) },
            ...{ class: "btn btn-xs btn-warning" },
            disabled: (!__VLS_ctx.selectedRuleProviderEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configRuleProvidersDisable'));
        if (__VLS_ctx.ruleProviderCreationWizard.active) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-primary/20 bg-primary/5 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-primary/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-primary/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configWizardTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRuleProvidersWizardTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.cancelRuleProviderCreationWizard) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardCancel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap gap-2 text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.ruleProviderCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepChooseTemplate'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.ruleProviderCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepFillBasics'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge" },
                ...{ class: (__VLS_ctx.ruleProviderCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            (__VLS_ctx.$t('configWizardStepReview'));
            if (__VLS_ctx.ruleProviderCreationWizard.step === 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
                for (const [template] of __VLS_vFor((__VLS_ctx.ruleProviderCreationTemplates))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.expanded))
                                    return;
                                if (!!(!__VLS_ctx.quickEditorHasPayload))
                                    return;
                                if (!(__VLS_ctx.ruleProviderCreationWizard.active))
                                    return;
                                if (!(__VLS_ctx.ruleProviderCreationWizard.step === 1))
                                    return;
                                __VLS_ctx.selectRuleProviderCreationWizardTemplate(template.id);
                                // @ts-ignore
                                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, prepareNewRuleProvider, selectedRuleProviderEntry, selectedRuleProviderEntry, selectedRuleProviderEntry, startRuleProviderCreationWizard, duplicateSelectedRuleProvider, saveRuleProviderToPayload, ruleProviderFormCanSave, disableSelectedRuleProvider, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, cancelRuleProviderCreationWizard, ruleProviderCreationTemplates, selectRuleProviderCreationWizardTemplate,];
                            } },
                        key: (`rule-provider-wizard-template-${template.id}`),
                        type: "button",
                        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "font-semibold" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    (__VLS_ctx.$t(template.labelKey));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[11px] opacity-70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                    (__VLS_ctx.$t(template.descKey));
                    // @ts-ignore
                    [$t, $t,];
                }
            }
            else if (__VLS_ctx.ruleProviderCreationWizard.step === 2) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersFieldName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.ruleProviderCreationWizard.name),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersFieldBehavior'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (__VLS_ctx.ruleProviderCreationWizard.behavior),
                    ...{ class: "select select-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['select']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "classical",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "domain",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "ipcidr",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersFieldUrl'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.ruleProviderCreationWizard.url),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control md:col-span-2" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersFieldPath'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.ruleProviderCreationWizard.path),
                    type: "text",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "form-control" },
                });
                /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "label-text text-xs opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersFieldInterval'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    value: (__VLS_ctx.ruleProviderCreationWizard.interval),
                    type: "text",
                    inputmode: "numeric",
                    ...{ class: "input input-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryTemplate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.$t(__VLS_ctx.ruleProviderCreationTemplates.find((item) => item.id === __VLS_ctx.ruleProviderCreationWizard.templateId)?.labelKey || 'configRuleProvidersTitle'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryName'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.ruleProviderCreationWizard.name || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryBehavior'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (__VLS_ctx.ruleProviderCreationWizard.behavior || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configWizardSummaryPath'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 font-semibold break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (__VLS_ctx.ruleProviderCreationWizard.path || '—');
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex flex-wrap justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.prevRuleProviderCreationWizardStep) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('configWizardBack'));
            if (__VLS_ctx.ruleProviderCreationWizard.step < 3) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.nextRuleProviderCreationWizardStep) },
                    ...{ class: "btn btn-xs" },
                    disabled: (__VLS_ctx.ruleProviderCreationWizard.step === 1 && !__VLS_ctx.ruleProviderCreationWizard.templateId),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardNext'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.finalizeRuleProviderCreationWizard) },
                    ...{ class: "btn btn-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configWizardApplyToForm'));
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configTemplateCardsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersTemplatesTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        for (const [template] of __VLS_vFor((__VLS_ctx.ruleProviderCreationTemplates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyRuleProviderCreationTemplate(template.id);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationWizard, ruleProviderCreationTemplates, ruleProviderCreationTemplates, prevRuleProviderCreationWizardStep, nextRuleProviderCreationWizardStep, finalizeRuleProviderCreationWizard, applyRuleProviderCreationTemplate,];
                    } },
                key: (`rule-provider-template-${template.id}`),
                type: "button",
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-primary/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-primary/5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t(template.labelKey));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t(template.descKey));
            // @ts-ignore
            [$t, $t,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersBehaviorAwareTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersBehaviorAwareTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.ruleProviderBehaviorProfile.accent) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.ruleProviderForm.behavior || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        for (const [behavior] of __VLS_vFor((__VLS_ctx.ruleProviderBehaviorPresets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.applyRuleProviderBehaviorPreset(behavior);
                        // @ts-ignore
                        [$t, $t, ruleProviderBehaviorProfile, ruleProviderForm, ruleProviderBehaviorPresets, applyRuleProviderBehaviorPreset,];
                    } },
                key: (`rule-provider-behavior-${behavior}`),
                type: "button",
                ...{ class: "badge badge-outline cursor-pointer" },
                ...{ class: (__VLS_ctx.normalizedRuleProviderBehavior === behavior ? 'badge-primary' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            (behavior);
            // @ts-ignore
            [normalizedRuleProviderBehavior,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-200/50 p-3 text-[11px] opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.ruleProviderBehaviorProfile.summary);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-3 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersSectionIdentity'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleProviderForm.name),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configRuleProvidersFieldNamePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.ruleProviderForm.type),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "http",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "file",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "inline",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldBehavior'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.ruleProviderForm.behavior),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "classical",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "domain",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "ipcidr",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldFormat'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.ruleProviderForm.format),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "yaml",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "text",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "mrs",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-3 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersSectionSource'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldUrl'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleProviderForm.url),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configRuleProvidersFieldUrlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldPath'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleProviderForm.path),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configRuleProvidersFieldPathPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersFieldInterval'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleProviderForm.interval),
            type: "text",
            inputmode: "numeric",
            ...{ class: "input input-sm" },
            placeholder: "86400",
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersExtraYamlTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersExtraYamlTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.ruleProviderForm.extraBody),
            ...{ class: "mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configRuleProvidersExtraYamlPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersReferencesTitle'));
        if (!__VLS_ctx.selectedRuleProviderEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRuleProvidersReferencesSelect'));
        }
        else {
            if (!__VLS_ctx.selectedRuleProviderEntry.references.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersReferencesEmpty'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                for (const [refItem] of __VLS_vFor((__VLS_ctx.selectedRuleProviderEntry.references.slice(0, 8)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (`rp-${refItem.lineNo}-${refItem.text}`),
                        ...{ class: "font-mono text-[11px] break-all" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    (refItem.lineNo);
                    (refItem.text);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, selectedRuleProviderEntry, selectedRuleProviderEntry, selectedRuleProviderEntry, ruleProviderBehaviorProfile, ruleProviderForm, ruleProviderForm, ruleProviderForm, ruleProviderForm, ruleProviderForm, ruleProviderForm, ruleProviderForm, ruleProviderForm,];
                }
                if (__VLS_ctx.selectedRuleProviderEntry.references.length > 8) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "opacity-60" },
                    });
                    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                    (__VLS_ctx.selectedRuleProviderEntry.references.length - 8);
                }
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRuleProvidersDisableImpactTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRuleProvidersDisableImpactTip'));
        if (!__VLS_ctx.selectedRuleProviderEntry) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRuleProvidersDisableImpactSelect'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.$t('configRuleProvidersDisableImpactRules', { count: __VLS_ctx.ruleProviderDisableImpact.rulesRemoved }));
            if (!__VLS_ctx.ruleProviderDisableImpact.rulesRemoved) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('configRuleProvidersDisableImpactEmpty'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-2 space-y-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
                for (const [sample] of __VLS_vFor((__VLS_ctx.ruleProviderDisableImpact.samples))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (`rp-sample-${sample.lineNo}-${sample.text}`),
                        ...{ class: "font-mono text-[11px] break-all" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    (sample.lineNo);
                    (sample.text);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, selectedRuleProviderEntry, selectedRuleProviderEntry, selectedRuleProviderEntry, ruleProviderDisableImpact, ruleProviderDisableImpact, ruleProviderDisableImpact,];
                }
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'rules') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configRulesTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configRulesTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configRulesCount', { count: __VLS_ctx.parsedRules.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.prepareNewRule) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configRulesNew'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "input input-sm input-bordered flex min-w-[16rem] flex-1 items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-[16rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.ruleListQuery),
            type: "text",
            ...{ class: "grow" },
            placeholder: (__VLS_ctx.$t('configRulesFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.filteredRules.length);
        (__VLS_ctx.parsedRules.length);
        if (__VLS_ctx.ruleListQuery) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.clearRuleFilter) },
                ...{ class: "btn btn-xs btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.topRuleTypeCounts))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.expanded))
                            return;
                        if (!!(!__VLS_ctx.quickEditorHasPayload))
                            return;
                        __VLS_ctx.filterRulesByType(item.type);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, structuredEditorSection, quickEditorHasPayload, parsedRules, parsedRules, prepareNewRule, ruleListQuery, ruleListQuery, filteredRules, clearRuleFilter, topRuleTypeCounts, filterRulesByType,];
                    } },
                key: (`rule-type-${item.type}`),
                type: "button",
                ...{ class: "badge badge-outline cursor-pointer" },
                ...{ class: (__VLS_ctx.normalizedRuleListFilter === item.type ? 'badge-primary' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            (item.type);
            (item.count);
            // @ts-ignore
            [normalizedRuleListFilter,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[22rem,minmax(0,1fr)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRulesListTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.filteredRules.length);
        if (!__VLS_ctx.parsedRules.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRulesListEmpty'));
        }
        else if (!__VLS_ctx.filteredRules.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('configRulesFilterEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-h-[28rem] space-y-2 overflow-auto pr-1" },
            });
            /** @type {__VLS_StyleScopedClasses['max-h-[28rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.filteredRules))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!!(!__VLS_ctx.parsedRules.length))
                                return;
                            if (!!(!__VLS_ctx.filteredRules.length))
                                return;
                            __VLS_ctx.loadRuleIntoForm(item.index);
                            // @ts-ignore
                            [$t, $t, $t, parsedRules, filteredRules, filteredRules, filteredRules, loadRuleIntoForm,];
                        } },
                    key: (`rule-${item.index}-${item.lineNo}`),
                    type: "button",
                    ...{ class: "w-full rounded-lg border p-3 text-left transition" },
                    ...{ class: (String(__VLS_ctx.ruleSelectedIndex) === String(item.index) ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40') },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "font-semibold" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                (item.lineNo);
                (item.type || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-all text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (item.raw);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                if (item.provider) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-outline" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                    (item.provider);
                }
                if (item.target) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    (item.target);
                }
                // @ts-ignore
                [ruleSelectedIndex,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.selectedRuleEntry ? __VLS_ctx.$t('configRulesEditSelected') : __VLS_ctx.$t('configRulesEditNew'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesEditTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.prepareNewRule) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRulesResetForm'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.duplicateSelectedRule) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (!__VLS_ctx.selectedRuleEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRulesDuplicate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveRuleToPayload) },
            ...{ class: "btn btn-xs" },
            disabled: (!__VLS_ctx.ruleFormCanSave),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('configRulesSaveToEditor'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.disableSelectedRule) },
            ...{ class: "btn btn-xs btn-warning" },
            disabled: (!__VLS_ctx.selectedRuleEntry),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        (__VLS_ctx.$t('configRulesDisable'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesFieldType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: (__VLS_ctx.syncRuleRawFromStructuredForm) },
            value: (__VLS_ctx.ruleForm.type),
            type: "text",
            ...{ class: "input input-sm" },
            list: "mihomo-rule-types",
            placeholder: (__VLS_ctx.$t('configRulesFieldTypePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesFieldPayload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: (__VLS_ctx.syncRuleRawFromStructuredForm) },
            value: (__VLS_ctx.ruleForm.payload),
            type: "text",
            ...{ class: "input input-sm" },
            list: "mihomo-rule-payloads",
            placeholder: (__VLS_ctx.rulePayloadPlaceholder),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        if (__VLS_ctx.ruleQuickPayloads.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.ruleQuickPayloads))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.ruleQuickPayloads.length))
                                return;
                            __VLS_ctx.setRulePayloadSuggestion(item);
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, prepareNewRule, selectedRuleEntry, selectedRuleEntry, selectedRuleEntry, duplicateSelectedRule, saveRuleToPayload, ruleFormCanSave, disableSelectedRule, syncRuleRawFromStructuredForm, syncRuleRawFromStructuredForm, ruleForm, ruleForm, rulePayloadPlaceholder, ruleQuickPayloads, ruleQuickPayloads, setRulePayloadSuggestion,];
                        } },
                    key: (`rule-payload-chip-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesFieldTarget'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: (__VLS_ctx.syncRuleRawFromStructuredForm) },
            value: (__VLS_ctx.ruleForm.target),
            type: "text",
            ...{ class: "input input-sm" },
            list: "mihomo-rule-targets",
            placeholder: (__VLS_ctx.ruleTargetPlaceholder),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        if (__VLS_ctx.ruleQuickTargets.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.ruleQuickTargets))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.ruleQuickTargets.length))
                                return;
                            __VLS_ctx.setRuleTargetSuggestion(item);
                            // @ts-ignore
                            [$t, syncRuleRawFromStructuredForm, ruleForm, ruleTargetPlaceholder, ruleQuickTargets, ruleQuickTargets, setRuleTargetSuggestion,];
                        } },
                    key: (`rule-target-chip-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control md:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesFieldParams'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            ...{ onInput: (__VLS_ctx.syncRuleRawFromStructuredForm) },
            value: (__VLS_ctx.ruleForm.paramsText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configRulesFieldParamsPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        if (__VLS_ctx.ruleQuickParams.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.ruleQuickParams))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!!(!__VLS_ctx.quickEditorHasPayload))
                                return;
                            if (!(__VLS_ctx.ruleQuickParams.length))
                                return;
                            __VLS_ctx.appendRuleParamSuggestion(item);
                            // @ts-ignore
                            [$t, $t, syncRuleRawFromStructuredForm, ruleForm, ruleQuickParams, ruleQuickParams, appendRuleParamSuggestion,];
                        } },
                    key: (`rule-param-chip-${item}`),
                    type: "button",
                    ...{ class: "badge badge-ghost" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                (item);
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configRulesTemplatesTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyRuleTemplate('match-direct');
                    // @ts-ignore
                    [$t, applyRuleTemplate,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyRuleTemplate('rule-set');
                    // @ts-ignore
                    [applyRuleTemplate,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyRuleTemplate('geoip-cn');
                    // @ts-ignore
                    [applyRuleTemplate,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyRuleTemplate('geosite-ads');
                    // @ts-ignore
                    [applyRuleTemplate,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expanded))
                        return;
                    if (!!(!__VLS_ctx.quickEditorHasPayload))
                        return;
                    __VLS_ctx.applyRuleTemplate('domain-suffix');
                    // @ts-ignore
                    [applyRuleTemplate,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
            id: "mihomo-rule-types",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "MATCH",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "FINAL",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "RULE-SET",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "DOMAIN",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "DOMAIN-SUFFIX",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "DOMAIN-KEYWORD",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "GEOSITE",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "GEOIP",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "IP-CIDR",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "IP-CIDR6",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "SRC-IP-CIDR",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "SRC-PORT",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "DST-PORT",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "NETWORK",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "PROCESS-NAME",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "PROCESS-PATH",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
            id: "mihomo-rule-payloads",
        });
        for (const [item] of __VLS_vFor((__VLS_ctx.rulePayloadSuggestions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (`rule-payload-${item}`),
                value: (item),
            });
            // @ts-ignore
            [rulePayloadSuggestions,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
            id: "mihomo-rule-targets",
        });
        for (const [item] of __VLS_vFor((__VLS_ctx.ruleTargetSuggestions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (`rule-target-${item}`),
                value: (item),
            });
            // @ts-ignore
            [ruleTargetSuggestions,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 flex flex-wrap items-center gap-2 text-[11px] opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configRulesStructuredMode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.normalizedRuleType || '—');
        if (__VLS_ctx.ruleForm.paramsText.trim().length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.ruleFormParamsCount);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.syncRuleFormFromRawLine) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRulesParseRaw'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.syncRuleRawFromStructuredForm) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configRulesBuildRaw'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesStructuredTip'));
        if (__VLS_ctx.ruleFormHints.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 rounded-lg border border-warning/20 bg-warning/5 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-warning/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-warning/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mb-2 font-semibold text-warning" },
            });
            /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
            (__VLS_ctx.$t('configRulesHintsTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            for (const [hint] of __VLS_vFor((__VLS_ctx.ruleFormHints))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (hint),
                    ...{ class: "badge badge-warning badge-outline" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                (hint);
                // @ts-ignore
                [$t, $t, $t, $t, $t, syncRuleRawFromStructuredForm, ruleForm, normalizedRuleType, ruleFormParamsCount, syncRuleFormFromRawLine, ruleFormHints, ruleFormHints,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control mt-3" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configRulesRawField'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.ruleForm.raw),
            ...{ class: "textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            wrap: "off",
            placeholder: (__VLS_ctx.$t('configRulesRawPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-32']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 grid grid-cols-1 gap-2 md:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configRulesPreviewType'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.ruleForm.type || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configRulesPreviewPayload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.ruleForm.payload || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/70 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configRulesPreviewTarget'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.ruleForm.target || '—');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.structuredEditorSection === 'dns') }, null, null);
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('configDnsStructuredTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('configDnsStructuredTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('configDnsStructuredCount', { count: __VLS_ctx.dnsStructuredSummary.totalItems }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.syncDnsEditorFromPayload) },
        ...{ class: "btn btn-xs btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('configDnsStructuredReadFromEditor'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyDnsEditorToPayload) },
        ...{ class: "btn btn-xs" },
        disabled: (!__VLS_ctx.dnsEditorCanApply),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('configDnsStructuredApplyToEditor'));
    if (!__VLS_ctx.quickEditorHasPayload) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredEmptyEditor'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('configDnsStructuredScopeTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDnsStructuredResolversTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredDefaultNameserver'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.defaultNameserverText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredDefaultNameserverPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredNameserver'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.nameserverText),
            ...{ class: "textarea textarea-sm h-28 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredNameserverPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-28']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallback'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.fallbackText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFallbackPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredProxyNameserver'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.proxyServerNameserverText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredProxyNameserverPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDnsStructuredPolicyTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredNameserverPolicy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.nameserverPolicyText),
            ...{ class: "textarea textarea-sm h-28 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredNameserverPolicyPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-28']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallbackGeoip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.dnsEditorForm.fallbackFilterGeoip),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('configQuickEditorKeepEmpty'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "true",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "false",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallbackGeoipCode'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.dnsEditorForm.fallbackFilterGeoipCode),
            type: "text",
            ...{ class: "input input-sm" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFallbackGeoipCodePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallbackGeosite'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.fallbackFilterGeositeText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFallbackGeositePlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallbackIpcidr'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.fallbackFilterIpcidrText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFallbackIpcidrPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFallbackDomain'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.fallbackFilterDomainText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFallbackDomainPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-3 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFiltersTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredFakeIpFilter'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.fakeIpFilterText),
            ...{ class: "textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredFakeIpFilterPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-24']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredDnsHijack'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.dnsEditorForm.dnsHijackText),
            ...{ class: "textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" },
            placeholder: (__VLS_ctx.$t('configDnsStructuredDnsHijackPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['[tab-size:2]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryDefaultNameserver', { count: __VLS_ctx.dnsStructuredSummary.defaultNameserver }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryNameserver', { count: __VLS_ctx.dnsStructuredSummary.nameserver }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryFallback', { count: __VLS_ctx.dnsStructuredSummary.fallback }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryFakeIpFilter', { count: __VLS_ctx.dnsStructuredSummary.fakeIpFilter }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryDnsHijack', { count: __VLS_ctx.dnsStructuredSummary.dnsHijack }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDnsStructuredSummaryPolicy', { count: __VLS_ctx.dnsStructuredSummary.nameserverPolicy }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDnsStructuredPolicyFormatTip'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'diagnostics') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.lastAction) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDiagnosticsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDiagnosticsTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
            ...{ class: (__VLS_ctx.lastAction.ok ? 'badge-success' : 'badge-error') },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.lastAction.ok ? __VLS_ctx.$t('configDiagStatusOk') : __VLS_ctx.$t('configDiagStatusFailed'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.actionTypeText(__VLS_ctx.lastAction.kind));
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.phase)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.phaseText(__VLS_ctx.lastAction.phase));
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.recovery) && __VLS_ctx.lastAction.recovery !== 'none') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.recoveryText(__VLS_ctx.lastAction.recovery));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configDiagAction'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.actionTypeText(__VLS_ctx.lastAction.kind));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configDiagPhase'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.phaseText(__VLS_ctx.lastAction.phase));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configDiagSource'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.sourceText(__VLS_ctx.lastAction.source));
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.validateCmd)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagValidateCommand'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 break-all font-mono text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            (__VLS_ctx.lastAction.validateCmd);
        }
        if (__VLS_ctx.lastAction.exitCode !== null && __VLS_ctx.lastAction.exitCode !== undefined && __VLS_ctx.lastAction.exitCode !== '') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagExitCode'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (String(__VLS_ctx.lastAction.exitCode));
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.restartMethod)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagRestartMethod'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.lastAction.restartMethod);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.recovery)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagRecovery'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.recoveryText(__VLS_ctx.lastAction.recovery));
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.restored)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configDiagRestored'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.recoveryText(__VLS_ctx.lastAction.restored));
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.updatedAt)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('updatedAt'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            (__VLS_ctx.fmtTextTs(__VLS_ctx.lastAction.updatedAt));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('configDiagCapturedAt'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.fmtTextTs(__VLS_ctx.lastAction.at));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 xl:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.error)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-warning/20 bg-warning/5 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-warning/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-warning/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-warning" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
            (__VLS_ctx.$t('configDiagError'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.error);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.output)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configDiagOutput'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.output);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.restartOutput)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configDiagRestartOutput'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.restartOutput);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.firstRestartOutput)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configDiagFirstRestartOutput'));
            if (__VLS_ctx.hasText(__VLS_ctx.lastAction.firstRestartMethod)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configDiagRestartMethod'));
                (__VLS_ctx.lastAction.firstRestartMethod);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.firstRestartOutput);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.rollbackRestartOutput)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configDiagRollbackOutput'));
            if (__VLS_ctx.hasText(__VLS_ctx.lastAction.rollbackRestartMethod)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configDiagRestartMethod'));
                (__VLS_ctx.lastAction.rollbackRestartMethod);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.rollbackRestartOutput);
        }
        if (__VLS_ctx.hasText(__VLS_ctx.lastAction.baselineRestartOutput)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.$t('configDiagBaselineOutput'));
            if (__VLS_ctx.hasText(__VLS_ctx.lastAction.baselineRestartMethod)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('configDiagRestartMethod'));
                (__VLS_ctx.lastAction.baselineRestartMethod);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
            (__VLS_ctx.lastAction.baselineRestartOutput);
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-dashed border-base-content/15 bg-base-100/50 p-3 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/15']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDiagnosticsEmpty'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'compare') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.managedMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configDiffTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configDiffTip'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "label cursor-pointer gap-2 py-0" },
        });
        /** @type {__VLS_StyleScopedClasses['label']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.$t('configDiffOnlyChanges'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            ...{ class: "toggle toggle-sm" },
        });
        (__VLS_ctx.compareChangesOnly);
        /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
        /** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.swapDiffSources) },
            ...{ class: "btn btn-xs btn-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('configSwapCompareSides'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['lg:items-end']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configCompareLeft'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.compareLeft),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        for (const [option] of __VLS_vFor((__VLS_ctx.diffSourceOptions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (`left-${option.value}`),
                value: (option.value),
                disabled: (option.disabled),
            });
            (option.label);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, managedMode, fmtTextTs, fmtTextTs, configWorkspaceSection, configWorkspaceSection, sourceText, diffSourceOptions, structuredEditorSection, quickEditorHasPayload, ruleForm, ruleForm, ruleForm, ruleForm, dnsStructuredSummary, dnsStructuredSummary, dnsStructuredSummary, dnsStructuredSummary, dnsStructuredSummary, dnsStructuredSummary, dnsStructuredSummary, syncDnsEditorFromPayload, applyDnsEditorToPayload, dnsEditorCanApply, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, dnsEditorForm, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, lastAction, actionTypeText, actionTypeText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, hasText, phaseText, phaseText, recoveryText, recoveryText, recoveryText, compareChangesOnly, swapDiffSources, compareLeft,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hidden justify-center pb-2 text-lg opacity-40 lg:flex" },
        });
        /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
        /** @type {__VLS_StyleScopedClasses['lg:flex']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "form-control gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['form-control']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "label-text text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('configCompareRight'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.compareRight),
            ...{ class: "select select-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        for (const [option] of __VLS_vFor((__VLS_ctx.diffSourceOptions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (`right-${option.value}`),
                value: (option.value),
                disabled: (option.disabled),
            });
            (option.label);
            // @ts-ignore
            [$t, diffSourceOptions, compareRight,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDiffRowsCount', { count: __VLS_ctx.diffRows.length }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configDiffAddedCount', { count: __VLS_ctx.diffSummary.added }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-error badge-outline" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.$t('configDiffRemovedCount', { count: __VLS_ctx.diffSummary.removed }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.$t('configDiffContextCount', { count: __VLS_ctx.diffSummary.context }));
        if (!__VLS_ctx.diffRowsVisible.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.diffHasChanges ? __VLS_ctx.$t('configDiffHiddenByFilter') : __VLS_ctx.$t('configDiffNoChanges'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 max-h-[28rem] overflow-auto rounded-lg border border-base-content/10 bg-base-100/60" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-[28rem]']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs w-full font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
                ...{ class: "sticky top-0 z-10 bg-base-100/95 text-[10px] uppercase tracking-[0.08em] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['sticky']} */ ;
            /** @type {__VLS_StyleScopedClasses['top-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/95']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-[0.08em]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ class: "w-12 text-right" },
            });
            /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.diffSourceLabel(__VLS_ctx.compareLeftResolved));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ class: "w-12 text-right" },
            });
            /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.diffSourceLabel(__VLS_ctx.compareRightResolved));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [row, index] of __VLS_vFor((__VLS_ctx.diffRowsVisible))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (`${row.type}-${row.leftNo ?? 'n'}-${row.rightNo ?? 'n'}-${index}`),
                    ...{ class: (row.type === 'add' ? 'bg-success/10' : row.type === 'remove' ? 'bg-error/10' : '') },
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "w-12 select-none text-right align-top opacity-50" },
                });
                /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
                (row.leftNo ?? '');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "whitespace-pre-wrap break-all align-top" },
                });
                /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                (row.leftText);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "w-12 select-none text-right align-top opacity-50" },
                });
                /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
                (row.rightNo ?? '');
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "whitespace-pre-wrap break-all align-top" },
                });
                /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['align-top']} */ ;
                (row.rightText);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, diffRows, diffSummary, diffSummary, diffSummary, diffRowsVisible, diffRowsVisible, diffHasChanges, diffSourceLabel, diffSourceLabel, compareLeftResolved, compareRightResolved,];
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'history') }, null, null);
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.managedMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 flex flex-wrap items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('configHistoryTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.loadHistory) },
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.historyBusy),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('refresh'));
        if (!__VLS_ctx.historyItems.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('configHistoryEmpty'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "space-y-2" },
            });
            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
            for (const [item] of __VLS_vFor((__VLS_ctx.historyItems))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (`${item.rev}-${item.current ? 'current' : 'old'}`),
                    ...{ class: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (item.rev);
                if (item.current) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-primary badge-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                    (__VLS_ctx.$t('current'));
                }
                if (item.source) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                    (__VLS_ctx.sourceText(item.source));
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.fmtTextTs(item.updatedAt));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expanded))
                                return;
                            if (!(__VLS_ctx.managedMode))
                                return;
                            if (!!(!__VLS_ctx.historyItems.length))
                                return;
                            __VLS_ctx.loadHistoryRev(item.rev);
                            // @ts-ignore
                            [$t, $t, $t, $t, managedMode, fmtTextTs, configWorkspaceSection, sourceText, loadHistory, historyBusy, historyItems, historyItems, loadHistoryRev,];
                        } },
                    ...{ class: "btn btn-ghost btn-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('configLoadIntoEditor'));
                if (!item.current) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.expanded))
                                    return;
                                if (!(__VLS_ctx.managedMode))
                                    return;
                                if (!!(!__VLS_ctx.historyItems.length))
                                    return;
                                if (!(!item.current))
                                    return;
                                __VLS_ctx.restoreHistoryRev(item.rev);
                                // @ts-ignore
                                [$t, restoreHistoryRev,];
                            } },
                        ...{ class: "btn btn-ghost btn-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                    (__VLS_ctx.$t('configRestoreRevision'));
                }
                // @ts-ignore
                [$t,];
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-60" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.configWorkspaceSection === 'editor') }, null, null);
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.managedMode ? __VLS_ctx.$t('configManagedFallbackNote') : __VLS_ctx.$t('mihomoConfigLoadNote'));
}
if (!__VLS_ctx.expanded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('configCollapsedTip'));
}
// @ts-ignore
[expanded, $t, $t, $t, managedMode, configWorkspaceSection,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
