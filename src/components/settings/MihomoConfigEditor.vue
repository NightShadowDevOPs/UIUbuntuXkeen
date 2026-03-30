<template>
  <div class="card w-full max-w-none">
    <div class="card-title flex items-center justify-between gap-2 px-4 pt-4">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          @click="expanded = !expanded"
          :title="expanded ? $t('collapse') : $t('expand')"
        >
          <ChevronUpIcon v-if="expanded" class="h-4 w-4" />
          <ChevronDownIcon v-else class="h-4 w-4" />
        </button>
        <span>{{ $t('mihomoConfigEditor') }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="badge badge-outline">{{ managedMode ? $t('configManagedMode') : $t('configDirectMode') }}</span>
        <button class="btn btn-sm" :class="refreshBusy && 'loading'" @click="refreshAll(true)">
          {{ $t('refresh') }}
        </button>
      </div>
    </div>

    <div class="card-body gap-3">
      <div class="flex flex-wrap items-center gap-2 text-xs opacity-70">
        <span>{{ $t('configPath') }}:</span>
        <span class="font-mono">{{ currentPath }}</span>
      </div>

      <div v-if="managedMode" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge" :class="managedStatusBadgeClass">{{ managedStatusText }}</span>
          <span v-if="managedState?.active?.rev" class="badge badge-ghost">{{ $t('configActiveTitle') }} rev {{ managedState?.active?.rev }}</span>
          <span v-if="managedState?.draft?.rev" class="badge badge-ghost">{{ $t('configDraftTitle') }} rev {{ managedState?.draft?.rev }}</span>
          <span v-if="managedState?.validator?.bin" class="badge badge-ghost">{{ managedState?.validator?.bin }}</span>
          <span v-if="managedState?.restart?.mode" class="badge badge-ghost">{{ $t('configDiagRestartMethod') }}: {{ managedState?.restart?.mode }}</span>
        </div>

        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
            <div class="font-semibold">{{ $t('configActiveTitle') }}</div>
            <div class="mt-1 font-mono text-[11px] opacity-80">{{ managedState?.active?.path || '—' }}</div>
            <div class="mt-1 opacity-70">{{ $t('updatedAt') }}: {{ fmtTextTs(managedState?.active?.updatedAt) }}</div>
            <div class="opacity-70">{{ $t('size') }}: {{ fmtBytes(managedState?.active?.sizeBytes) }}</div>
          </div>

          <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
            <div class="font-semibold">{{ $t('configDraftTitle') }}</div>
            <div class="mt-1 font-mono text-[11px] opacity-80">{{ managedState?.draft?.path || '—' }}</div>
            <div class="mt-1 opacity-70">{{ $t('updatedAt') }}: {{ fmtTextTs(managedState?.draft?.updatedAt) }}</div>
            <div class="opacity-70">{{ $t('size') }}: {{ fmtBytes(managedState?.draft?.sizeBytes) }}</div>
          </div>

          <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
            <div class="font-semibold">{{ $t('configBaselineTitle') }}</div>
            <div class="mt-1 font-mono text-[11px] opacity-80">{{ managedState?.baseline?.path || '—' }}</div>
            <div class="mt-1 opacity-70">{{ $t('updatedAt') }}: {{ fmtTextTs(managedState?.baseline?.updatedAt) }}</div>
            <div class="opacity-70">{{ $t('size') }}: {{ fmtBytes(managedState?.baseline?.sizeBytes) }}</div>
          </div>
        </div>

        <div class="mt-2 text-[11px] opacity-70">
          {{ $t('configManagedTip') }}
        </div>
        <div v-if="managedState?.lastError" class="mt-1 break-words text-[11px] text-warning">
          {{ managedState?.lastError }}
        </div>
      </div>

      <div
        class="transparent-collapse collapse rounded-none shadow-none"
        :class="expanded ? 'collapse-open' : ''"
      >
        <div class="collapse-content p-0">
          <div v-if="expanded" class="grid grid-cols-1 gap-3">
            <div class="text-xs opacity-70">
              {{ managedMode ? $t('configManagedEditorTip') : $t('mihomoConfigEditorTip') }}
            </div>

            <div class="overflow-x-auto">
              <div class="tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-200/60 p-1">
                <button
                  v-for="section in configWorkspaceSections"
                  :key="section.id"
                  type="button"
                  class="tab whitespace-nowrap border-0"
                  :class="[configWorkspaceSection === section.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100', section.disabled ? 'pointer-events-none opacity-40' : '']"
                  :disabled="section.disabled"
                  @click="setConfigWorkspaceSection(section.id)"
                >
                  {{ $t(section.labelKey) }}
                </button>
              </div>
            </div>

            <section v-show="configWorkspaceSection === 'editor'" class="space-y-3">
            <div v-if="managedMode" class="flex flex-wrap items-center gap-2">
              <button class="btn btn-sm" @click="copyFromManaged('active')" :disabled="busyAny">{{ $t('configLoadActiveToDraft') }}</button>
              <button class="btn btn-sm" @click="copyFromManaged('baseline')" :disabled="busyAny || !managedState?.baseline?.exists">{{ $t('configLoadBaselineToDraft') }}</button>
              <button class="btn btn-sm" @click="saveDraft" :disabled="busyAny">{{ $t('saveDraft') }}</button>
              <button class="btn btn-sm" @click="validateDraft" :disabled="busyAny">{{ $t('configValidateDraft') }}</button>
              <button class="btn btn-sm" @click="applyDraft" :disabled="busyAny">{{ $t('configApplyDraft') }}</button>
              <button class="btn btn-sm btn-ghost" @click="setBaselineFromActive" :disabled="busyAny || !managedState?.active?.exists">{{ $t('configPromoteActiveToBaseline') }}</button>
              <button class="btn btn-sm btn-warning" @click="restoreBaseline" :disabled="busyAny || !managedState?.baseline?.exists">{{ $t('configRestoreBaseline') }}</button>
            </div>
            <div v-else class="flex flex-wrap items-center gap-2">
              <button class="btn btn-sm" :class="legacyLoadBusy && 'loading'" @click="legacyLoad">{{ $t('load') }}</button>
              <button class="btn btn-sm" :class="legacyApplyBusy && 'loading'" @click="legacyApply">{{ $t('applyAndReload') }}</button>
              <button class="btn btn-sm" :class="legacyRestartBusy && 'loading'" @click="legacyRestart">{{ $t('restartCore') }}</button>
            </div>

            <textarea
              class="textarea textarea-sm h-[70vh] min-h-[28rem] w-full resize-y overflow-x-auto whitespace-pre font-mono leading-5 [tab-size:2]"
              wrap="off"
              v-model="payload"
              :placeholder="$t('pasteYamlHere')"
            ></textarea>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="opacity-60">
                {{ managedMode ? $t('configDraftRemoteSaved') : $t('mihomoConfigDraftSaved') }}
              </div>
              <button class="btn btn-ghost btn-sm" @click="clearDraft">{{ $t('clearDraft') }}</button>
            </div>

            <div v-if="validationOutput" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge" :class="validationOk ? 'badge-success' : 'badge-error'">{{ validationOk ? $t('configValidationOk') : $t('configValidationFailed') }}</span>
                <span v-if="validationCmd" class="badge badge-ghost font-mono">{{ validationCmd }}</span>
              </div>
              <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] opacity-80">{{ validationOutput }}</pre>
            </div>

            <div v-if="managedMode" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configLastSuccessfulTitle') }}</div>
                  <div class="opacity-70">{{ $t('configLastSuccessfulTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge" :class="lastSuccessfulBadgeClass">{{ lastSuccessfulStatusText }}</span>
                  <span v-if="managedState?.lastSuccessful?.current" class="badge badge-primary badge-outline">{{ $t('configLastSuccessfulCurrent') }}</span>
                  <span v-else-if="managedState?.lastSuccessful?.rev" class="badge badge-ghost">{{ $t('configHistoryRevisionLabel') }} {{ managedState?.lastSuccessful?.rev }}</span>
                </div>
              </div>

              <div v-if="!lastSuccessfulExists" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configLastSuccessfulEmpty') }}
              </div>

              <div v-else class="space-y-2">
                <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                    <div class="opacity-60">{{ $t('configLastSuccessfulRevision') }}</div>
                    <div class="mt-1 font-mono">rev {{ managedState?.lastSuccessful?.rev ?? '—' }}</div>
                  </div>
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                    <div class="opacity-60">{{ $t('configDiagSource') }}</div>
                    <div class="mt-1">{{ sourceText(managedState?.lastSuccessful?.source) }}</div>
                  </div>
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                    <div class="opacity-60">{{ $t('updatedAt') }}</div>
                    <div class="mt-1">{{ fmtTextTs(managedState?.lastSuccessful?.updatedAt) }}</div>
                  </div>
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                    <div class="opacity-60">{{ $t('configLastSuccessfulStorage') }}</div>
                    <div class="mt-1">{{ managedState?.lastSuccessful?.current ? $t('configLastSuccessfulFromCurrent') : $t('configLastSuccessfulFromHistory') }}</div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button class="btn btn-sm" @click="loadLastSuccessfulIntoEditor" :disabled="busyAny || !lastSuccessfulExists">{{ $t('configLoadIntoEditor') }}</button>
                  <button class="btn btn-sm btn-ghost" @click="compareDraftWithLastSuccessful" :disabled="!lastSuccessfulExists">{{ $t('configLastSuccessfulCompareDraft') }}</button>
                  <button class="btn btn-sm btn-ghost" @click="compareActiveWithLastSuccessful" :disabled="!lastSuccessfulExists || managedState?.lastSuccessful?.current">{{ $t('configLastSuccessfulCompareActive') }}</button>
                </div>
              </div>
            </div>

            </section>

            <section v-show="configWorkspaceSection === 'overview'" class="space-y-3">
            <div class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configOverviewTitle') }}</div>
                  <div class="opacity-70">{{ $t('configOverviewTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configOverviewRows', { count: overviewSummary.stats.totalLines }) }}</span>
                  <span class="badge badge-ghost">{{ $t('configOverviewSectionsCount', { count: overviewSummary.topLevelSections.length }) }}</span>
                  <label class="flex items-center gap-2">
                    <span class="opacity-70">{{ $t('configOverviewSource') }}</span>
                    <select v-model="overviewSource" class="select select-xs max-w-[220px]">
                      <option v-for="option in diffSourceOptions" :key="`overview-${option.value}`" :value="option.value" :disabled="option.disabled">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </div>
              </div>

              <div v-if="!overviewHasContent" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configOverviewEmpty') }}
              </div>

              <div v-else class="space-y-3">
                <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configOverviewModeTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewMode') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.mode) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewLogLevel') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.logLevel) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewAllowLan') }}</div>
                        <div class="mt-1">{{ overviewBoolText(overviewSummary.scalars.allowLan) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewIpv6') }}</div>
                        <div class="mt-1">{{ overviewBoolText(overviewSummary.scalars.ipv6) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewUnifiedDelay') }}</div>
                        <div class="mt-1">{{ overviewBoolText(overviewSummary.scalars.unifiedDelay) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewFindProcessMode') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.findProcessMode) }}</div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configOverviewPortsTitle') }}</div>
                    <div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewMixedPort') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.mixedPort) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewPort') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.port) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewSocksPort') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.socksPort) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewRedirPort') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.redirPort) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewTproxyPort') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.tproxyPort) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewController') }}</div>
                        <div class="mt-1 break-all font-mono text-[11px]">{{ overviewText(overviewSummary.scalars.controller) }}</div>
                      </div>
                    </div>
                    <div class="mt-2 text-[11px] opacity-70">
                      {{ $t('configOverviewSecretState') }}: {{ overviewText(overviewSummary.scalars.secretState) }}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configOverviewModulesTitle') }}</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class="badge badge-outline" :class="sectionStateBadgeClass(overviewSummary.sections.tun)">{{ $t('configOverviewTun') }}: {{ sectionStateText(overviewSummary.sections.tun) }}</span>
                      <span class="badge badge-outline" :class="sectionStateBadgeClass(overviewSummary.sections.dns)">{{ $t('configOverviewDns') }}: {{ sectionStateText(overviewSummary.sections.dns) }}</span>
                      <span class="badge badge-outline" :class="sectionStateBadgeClass(overviewSummary.sections.profile)">{{ $t('configOverviewProfile') }}: {{ sectionStateText(overviewSummary.sections.profile) }}</span>
                      <span class="badge badge-outline" :class="sectionStateBadgeClass(overviewSummary.sections.sniffer)">{{ $t('configOverviewSniffer') }}: {{ sectionStateText(overviewSummary.sections.sniffer) }}</span>
                    </div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewGeodataMode') }}</div>
                        <div class="mt-1">{{ overviewText(overviewSummary.scalars.geodataMode) }}</div>
                      </div>
                      <div>
                        <div class="opacity-60">{{ $t('configOverviewTopLevelSections') }}</div>
                        <div class="mt-1 flex flex-wrap gap-1">
                          <span v-for="section in overviewSummary.topLevelSections" :key="section" class="badge badge-ghost badge-sm">{{ section }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configOverviewRoutingTitle') }}</div>
                    <div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewProxiesCount') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.counts.proxies }}</div>
                      </div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewProxyGroupsCount') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.counts.proxyGroups }}</div>
                      </div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewRulesCount') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.counts.rules }}</div>
                      </div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewProxyProvidersCount') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.counts.proxyProviders }}</div>
                      </div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewRuleProvidersCount') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.counts.ruleProviders }}</div>
                      </div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2">
                        <div class="opacity-60">{{ $t('configOverviewNonEmptyRows') }}</div>
                        <div class="mt-1 text-lg font-semibold">{{ overviewSummary.stats.nonEmptyLines }}</div>
                      </div>
                    </div>
                    <div class="mt-2 text-[11px] opacity-70">{{ $t('configOverviewCommentRows', { count: overviewSummary.stats.commentLines }) }}</div>
                  </div>
                </div>

                <div class="text-[11px] opacity-60">{{ $t('configOverviewApproximate') }}</div>
              </div>
            </div>

            </section>

            <section v-show="configWorkspaceSection === 'structured'" class="space-y-3">
            <div class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configWorkspaceStructuredTitle') }}</div>
                  <div class="opacity-70">{{ $t('configWorkspaceStructuredTabTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-outline">{{ $t('configWorkspaceStructuredTitle') }}</span>
                  <span class="badge badge-ghost">{{ structuredEditorSections.find((item) => item.id === structuredEditorSection)?.count ?? 0 }}</span>
                </div>
              </div>

              <div class="mt-3 overflow-x-auto">
                <div class="tabs tabs-boxed inline-flex min-w-max gap-1 bg-base-100/60 p-1">
                  <button
                    v-for="item in structuredEditorSections"
                    :key="item.id"
                    type="button"
                    class="tab whitespace-nowrap border-0"
                    :class="structuredEditorSection === item.id ? 'tab-active !bg-base-100 shadow-sm' : 'opacity-80 hover:opacity-100'"
                    @click="setStructuredEditorSection(item.id)"
                  >
                    <span>{{ $t(item.labelKey) }}</span>
                    <span class="ml-2 badge badge-ghost badge-sm">{{ item.count }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'quick'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configQuickEditorTitle') }}</div>
                  <div class="opacity-70">{{ $t('configQuickEditorTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configQuickEditorEditorScope') }}</span>
                  <button class="btn btn-xs btn-ghost" @click="syncQuickEditorFromPayload">{{ $t('configQuickEditorReadFromEditor') }}</button>
                  <button class="btn btn-xs" @click="applyQuickEditorToPayload" :disabled="!quickEditorCanApply">{{ $t('configQuickEditorApplyToEditor') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configQuickEditorEmpty') }}
              </div>

              <div v-else class="space-y-3">
                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configQuickEditorGeneralTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewMode') }}</span>
                        <select v-model="quickEditor.mode" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="rule">rule</option>
                          <option value="global">global</option>
                          <option value="direct">direct</option>
                          <option value="script">script</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewLogLevel') }}</span>
                        <select v-model="quickEditor.logLevel" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="info">info</option>
                          <option value="warning">warning</option>
                          <option value="error">error</option>
                          <option value="debug">debug</option>
                          <option value="silent">silent</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewAllowLan') }}</span>
                        <select v-model="quickEditor.allowLan" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewIpv6') }}</span>
                        <select v-model="quickEditor.ipv6" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewUnifiedDelay') }}</span>
                        <select v-model="quickEditor.unifiedDelay" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewFindProcessMode') }}</span>
                        <select v-model="quickEditor.findProcessMode" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="off">off</option>
                          <option value="always">always</option>
                          <option value="strict">strict</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewGeodataMode') }}</span>
                        <select v-model="quickEditor.geodataMode" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control md:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewController') }}</span>
                        <input v-model="quickEditor.controller" type="text" class="input input-sm" :placeholder="$t('configQuickEditorControllerPlaceholder')" />
                      </label>
                      <label class="form-control md:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorSecret') }}</span>
                        <input v-model="quickEditor.secret" type="text" class="input input-sm" :placeholder="$t('configQuickEditorSecretPlaceholder')" />
                      </label>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configQuickEditorPortsTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewMixedPort') }}</span>
                        <input v-model="quickEditor.mixedPort" type="text" inputmode="numeric" class="input input-sm" placeholder="7890" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewPort') }}</span>
                        <input v-model="quickEditor.port" type="text" inputmode="numeric" class="input input-sm" placeholder="7891" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewSocksPort') }}</span>
                        <input v-model="quickEditor.socksPort" type="text" inputmode="numeric" class="input input-sm" placeholder="7892" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewRedirPort') }}</span>
                        <input v-model="quickEditor.redirPort" type="text" inputmode="numeric" class="input input-sm" placeholder="7893" />
                      </label>
                      <label class="form-control md:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configOverviewTproxyPort') }}</span>
                        <input v-model="quickEditor.tproxyPort" type="text" inputmode="numeric" class="input input-sm" placeholder="7894" />
                      </label>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configQuickEditorTunTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configQuickEditorTunTip') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorTunEnable') }}</span>
                        <select v-model="quickEditor.tunEnable" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorTunStack') }}</span>
                        <select v-model="quickEditor.tunStack" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="system">system</option>
                          <option value="mixed">mixed</option>
                          <option value="gvisor">gvisor</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorTunAutoRoute') }}</span>
                        <select v-model="quickEditor.tunAutoRoute" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorTunAutoDetectInterface') }}</span>
                        <select v-model="quickEditor.tunAutoDetectInterface" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configQuickEditorDnsTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configQuickEditorDnsTip') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorDnsEnable') }}</span>
                        <select v-model="quickEditor.dnsEnable" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorDnsIpv6') }}</span>
                        <select v-model="quickEditor.dnsIpv6" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">{{ $t('enabled') }}</option>
                          <option value="false">{{ $t('disabled') }}</option>
                        </select>
                      </label>
                      <label class="form-control md:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorDnsListen') }}</span>
                        <input v-model="quickEditor.dnsListen" type="text" class="input input-sm" :placeholder="$t('configQuickEditorDnsListenPlaceholder')" />
                      </label>
                      <label class="form-control md:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configQuickEditorDnsEnhancedMode') }}</span>
                        <select v-model="quickEditor.dnsEnhancedMode" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="redir-host">redir-host</option>
                          <option value="fake-ip">fake-ip</option>
                          <option value="normal">normal</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ $t('configQuickEditorPreviewTitle') }}</div>
                      <div class="opacity-70">{{ $t('configQuickEditorPreviewTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-success badge-outline">{{ $t('configQuickEditorPreviewAdded', { count: quickEditorPreviewSummary.added }) }}</span>
                      <span class="badge badge-warning badge-outline">{{ $t('configQuickEditorPreviewChanged', { count: quickEditorPreviewSummary.changed }) }}</span>
                      <span class="badge badge-error badge-outline">{{ $t('configQuickEditorPreviewRemoved', { count: quickEditorPreviewSummary.removed }) }}</span>
                    </div>
                  </div>

                  <div v-if="!quickEditorPreviewChanges.length" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                    {{ $t('configQuickEditorPreviewNoChanges') }}
                  </div>

                  <div v-else class="space-y-3">
                    <div class="flex flex-wrap gap-2">
                      <span class="badge badge-outline">{{ $t('configQuickEditorPreviewTotal', { count: quickEditorPreviewChanges.length }) }}</span>
                      <span
                        v-for="group in quickEditorAffectedGroups"
                        :key="group"
                        class="badge badge-ghost"
                      >
                        {{ previewGroupLabel(group) }}
                      </span>
                    </div>

                    <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
                      <div
                        v-for="item in quickEditorPreviewChanges"
                        :key="item.key"
                        class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="font-semibold">{{ previewFieldLabel(item.key) }}</div>
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="badge" :class="previewChangeBadgeClass(item.changeType)">{{ previewChangeTypeText(item.changeType) }}</span>
                            <span class="badge badge-ghost">{{ previewGroupLabel(item.group) }}</span>
                          </div>
                        </div>
                        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div>
                            <div class="opacity-60">{{ $t('configQuickEditorPreviewBefore') }}</div>
                            <div class="mt-1 break-all font-mono text-[11px]">{{ previewValueText(item.before) }}</div>
                          </div>
                          <div>
                            <div class="opacity-60">{{ $t('configQuickEditorPreviewAfter') }}</div>
                            <div class="mt-1 break-all font-mono text-[11px]">{{ previewValueText(item.after) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                  <span class="badge badge-outline">{{ $t('configQuickEditorCommonScope') }}</span>
                  <span>{{ $t('configQuickEditorEmptyRemoves') }}</span>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'runtime-sections'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configAdvancedSectionsTitle') }}</div>
                  <div class="opacity-70">{{ $t('configAdvancedSectionsTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configAdvancedSectionsCount', { count: advancedSectionsSummary.totalItems }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="syncAdvancedSectionsFromPayload">{{ $t('configAdvancedSectionsReadFromEditor') }}</button>
                  <button class="btn btn-xs" @click="applyAdvancedSectionsToPayload" :disabled="!advancedSectionsCanApply">{{ $t('configAdvancedSectionsApplyToEditor') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configAdvancedSectionsEmptyEditor') }}</div>
              <div v-else class="space-y-3">
                <div class="flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                  <span class="badge badge-outline">tun</span>
                  <span class="badge badge-outline">profile</span>
                  <span class="badge badge-outline">sniffer</span>
                  <span>{{ $t('configAdvancedSectionsScopeTip') }}</span>
                </div>

                <div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configAdvancedTunTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configAdvancedTunTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunEnable') }}</span>
                        <select v-model="advancedSectionsForm.tunEnable" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunStack') }}</span>
                        <input v-model="advancedSectionsForm.tunStack" type="text" class="input input-sm" :placeholder="$t('configAdvancedTunStackPlaceholder')" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunDevice') }}</span>
                        <input v-model="advancedSectionsForm.tunDevice" type="text" class="input input-sm" :placeholder="$t('configAdvancedTunDevicePlaceholder')" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunAutoRoute') }}</span>
                        <select v-model="advancedSectionsForm.tunAutoRoute" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunAutoDetectInterface') }}</span>
                        <select v-model="advancedSectionsForm.tunAutoDetectInterface" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunMtu') }}</span>
                        <input v-model="advancedSectionsForm.tunMtu" type="text" class="input input-sm" :placeholder="$t('configAdvancedTunMtuPlaceholder')" />
                      </label>
                      <label class="form-control md:col-span-2 xl:col-span-3">
                        <span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunStrictRoute') }}</span>
                        <select v-model="advancedSectionsForm.tunStrictRoute" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                      </label>
                    </div>
                    <div class="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunDnsHijack') }}</span><textarea v-model="advancedSectionsForm.tunDnsHijackText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedTunDnsHijackPlaceholder')"></textarea></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunIncludeAddress') }}</span><textarea v-model="advancedSectionsForm.tunRouteIncludeAddressText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedTunIncludeAddressPlaceholder')"></textarea></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunExcludeAddress') }}</span><textarea v-model="advancedSectionsForm.tunRouteExcludeAddressText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedTunExcludeAddressPlaceholder')"></textarea></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunIncludeInterface') }}</span><textarea v-model="advancedSectionsForm.tunIncludeInterfaceText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedTunIncludeInterfacePlaceholder')"></textarea></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedTunExcludeInterface') }}</span><textarea v-model="advancedSectionsForm.tunExcludeInterfaceText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedTunExcludeInterfacePlaceholder')"></textarea></label>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                      <div class="font-semibold">{{ $t('configAdvancedProfileTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configAdvancedProfileTip') }}</div>
                      <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedProfileStoreSelected') }}</span><select v-model="advancedSectionsForm.profileStoreSelected" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedProfileStoreFakeIp') }}</span><select v-model="advancedSectionsForm.profileStoreFakeIp" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                      </div>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                      <div class="font-semibold">{{ $t('configAdvancedSnifferTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configAdvancedSnifferTip') }}</div>
                      <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferEnable') }}</span><select v-model="advancedSectionsForm.snifferEnable" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferParsePureIp') }}</span><select v-model="advancedSectionsForm.snifferParsePureIp" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferOverrideDestination') }}</span><select v-model="advancedSectionsForm.snifferOverrideDestination" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferSniffProtocols') }}</span><textarea v-model="advancedSectionsForm.snifferSniffText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedSnifferSniffProtocolsPlaceholder')"></textarea></label>
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferForceDomain') }}</span><textarea v-model="advancedSectionsForm.snifferForceDomainText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedSnifferForceDomainPlaceholder')"></textarea></label>
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configAdvancedSnifferSkipDomain') }}</span><textarea v-model="advancedSectionsForm.snifferSkipDomainText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configAdvancedSnifferSkipDomainPlaceholder')"></textarea></label>
                      </div>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                      <div class="font-semibold">{{ $t('configAdvancedSectionsSummaryTitle') }}</div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <span class="badge badge-ghost">{{ $t('configAdvancedSectionsSummaryTun', { count: advancedSectionsSummary.tun }) }}</span>
                        <span class="badge badge-ghost">{{ $t('configAdvancedSectionsSummaryProfile', { count: advancedSectionsSummary.profile }) }}</span>
                        <span class="badge badge-ghost">{{ $t('configAdvancedSectionsSummarySniffer', { count: advancedSectionsSummary.sniffer }) }}</span>
                      </div>
                      <div class="mt-3 text-[11px] opacity-70">{{ $t('configAdvancedSectionsSummaryTip') }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <div v-show="structuredEditorSection === 'proxies'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configProxiesTitle') }}</div>
                  <div class="opacity-70">{{ $t('configProxiesTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configProxiesCount', { count: parsedProxies.length }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="prepareNewProxy">{{ $t('configProxiesNew') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configProxiesEmptyEditor') }}
              </div>

              <div v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="font-semibold">{{ $t('configProxiesListTitle') }}</div>
                    <span class="badge badge-outline">{{ filteredProxies.length }}</span>
                  </div>

                  <label class="form-control mb-2">
                    <span class="label-text text-xs opacity-70">{{ $t('configProxiesFilterLabel') }}</span>
                    <div class="flex items-center gap-2">
                      <input v-model="proxyListQuery" type="text" class="input input-sm w-full" :placeholder="$t('configProxiesFilterPlaceholder')" />
                      <button class="btn btn-xs btn-ghost" @click="clearProxyFilter" :disabled="!proxyListQuery">{{ $t('clear') }}</button>
                    </div>
                  </label>

                  <div class="mb-2 flex flex-wrap gap-1">
                    <span v-for="item in topProxyTypeCounts" :key="item.type" class="badge badge-ghost badge-sm">{{ item.type }} · {{ item.count }}</span>
                  </div>

                  <div v-if="!filteredProxies.length" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                    {{ $t('configProxiesListEmpty') }}
                  </div>

                  <div v-else class="max-h-[32rem] space-y-2 overflow-auto pr-1">
                    <button
                      v-for="item in filteredProxies"
                      :key="item.name"
                      type="button"
                      class="w-full rounded-lg border p-3 text-left transition"
                      :class="proxySelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40'"
                      @click="loadProxyIntoForm(item.name)"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div class="font-semibold break-all">{{ item.name }}</div>
                          <div class="mt-1 break-all text-[11px] opacity-70">{{ item.server || '—' }}<span v-if="item.port">:{{ item.port }}</span></div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="badge badge-outline">{{ item.type || '—' }}</span>
                          <span class="badge" :class="providerReferenceBadgeClass(item.references.length)">{{ $t('configProxiesRefsShort', { count: item.references.length }) }}</span>
                        </div>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span v-if="item.network" class="badge badge-ghost badge-sm">network: {{ item.network }}</span>
                        <span v-if="item.tls === 'true'" class="badge badge-success badge-outline badge-sm">TLS</span>
                        <span v-if="item.udp === 'true'" class="badge badge-info badge-outline badge-sm">UDP</span>
                        <span v-if="item.wsPath" class="badge badge-ghost badge-sm">ws</span>
                        <span v-if="item.grpcServiceName" class="badge badge-ghost badge-sm">grpc</span>
                        <span v-if="item.httpMethod || item.httpPath.length || item.httpHeadersBody" class="badge badge-ghost badge-sm">http-opts</span>
                        <span v-if="item.smuxEnabled || item.smuxProtocol || item.smuxMaxConnections" class="badge badge-ghost badge-sm">smux</span>
                        <span v-if="item.wireguardPrivateKey || item.wireguardIp.length || item.wireguardReserved.length" class="badge badge-info badge-outline badge-sm">wireguard</span>
                        <span v-if="item.hysteriaUp || item.hysteriaDown || item.hysteriaObfs" class="badge badge-secondary badge-outline badge-sm">hysteria2</span>
                        <span v-if="item.tuicCongestionController || item.tuicUdpRelayMode || item.tuicHeartbeatInterval" class="badge badge-accent badge-outline badge-sm">tuic</span>
                        <span v-if="item.plugin" class="badge badge-warning badge-outline badge-sm">plugin</span>
                        <span v-if="item.realityPublicKey" class="badge badge-secondary badge-outline badge-sm">reality</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ selectedProxyEntry ? $t('configProxiesEditSelected') : $t('configProxiesEditNew') }}</div>
                      <div class="opacity-70">{{ $t('configProxiesEditTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-xs btn-ghost" @click="startProxyCreationWizard">{{ $t('configWizardStart') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="prepareNewProxy">{{ $t('configProxiesResetForm') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="duplicateSelectedProxy" :disabled="!selectedProxyEntry">{{ $t('configProxiesDuplicate') }}</button>
                      <button class="btn btn-xs" @click="saveProxyToPayload" :disabled="!proxyFormCanSave">{{ $t('configProxiesSaveToEditor') }}</button>
                      <button class="btn btn-xs btn-warning" @click="disableSelectedProxy" :disabled="!selectedProxyEntry">{{ $t('configProxiesDisable') }}</button>
                    </div>
                  </div>

                  <div v-if="proxyCreationWizard.active" class="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold">{{ $t('configWizardTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesWizardTip') }}</div>
                      </div>
                      <button class="btn btn-xs btn-ghost" @click="cancelProxyCreationWizard">{{ $t('configWizardCancel') }}</button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span class="badge" :class="proxyCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost'">1 · {{ $t('configWizardStepChooseTemplate') }}</span>
                      <span class="badge" :class="proxyCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost'">2 · {{ $t('configWizardStepFillBasics') }}</span>
                      <span class="badge" :class="proxyCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost'">3 · {{ $t('configWizardStepReview') }}</span>
                    </div>
                    <div v-if="proxyCreationWizard.step === 1" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="template in proxyCreationTemplates"
                        :key="`proxy-wizard-template-${template.id}`"
                        type="button"
                        class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        @click="selectProxyCreationWizardTemplate(template.id)"
                      >
                        <div class="font-semibold">{{ $t(template.labelKey) }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div>
                      </button>
                    </div>
                    <div v-else-if="proxyCreationWizard.step === 2" class="mt-3 space-y-3">
                      <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2 xl:col-span-2">
                          <div class="text-[11px] opacity-60">{{ $t('configProxiesTypeAwareTitle') }}</div>
                          <div class="mt-1 flex flex-wrap items-center gap-2">
                            <span class="badge badge-outline">{{ normalizedProxyCreationWizardType || '—' }}</span>
                            <span class="font-semibold">{{ proxyCreationWizardTypeSummary }}</span>
                          </div>
                        </div>
                        <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2 xl:col-span-2">
                          <div class="text-[11px] opacity-60">{{ $t('configWizardSummaryTemplate') }}</div>
                          <div class="mt-1 font-semibold">{{ activeProxyCreationWizardTemplate ? $t(activeProxyCreationWizardTemplate.labelKey) : '—' }}</div>
                          <div class="mt-1 text-[11px] opacity-70">{{ proxyCreationWizardScenarioSummary }}</div>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <span v-for="badge in proxyCreationWizardScenarioBadges" :key="`wizard-scenario-${badge}`" class="badge badge-ghost">{{ badge }}</span>
                            <span v-if="!proxyCreationWizardScenarioBadges.length" class="badge badge-ghost">{{ normalizedProxyCreationWizardType || 'proxy' }}</span>
                          </div>
                        </div>
                      </div>
                      <div v-if="proxyCreationWizardMissingFieldLabels.length" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                        <div class="font-semibold">{{ $t('configWizardTitle') }}</div>
                        <div class="mt-1 opacity-80">{{ $t('configProxiesWizardTip') }}</div>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <span v-for="label in proxyCreationWizardMissingFieldLabels" :key="`wizard-missing-${label}`" class="badge badge-warning badge-outline">{{ label }}</span>
                        </div>
                      </div>
                      <div v-else class="rounded-lg border border-success/20 bg-success/10 p-3 text-sm opacity-90">
                        {{ $t('configProxiesTemplatesTip') }}
                      </div>
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldName') }}</span><input v-model="proxyCreationWizard.name" type="text" class="input input-sm" /></label>
                        <label class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldServer') }}</span><input v-model="proxyCreationWizard.server" type="text" class="input input-sm" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPort') }}</span><input v-model="proxyCreationWizard.port" type="text" inputmode="numeric" class="input input-sm" /></label>
                        <label v-if="proxyCreationWizardVisibility.transport" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldNetwork') }}</span><select v-model="proxyCreationWizard.network" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="tcp">tcp</option><option value="ws">ws</option><option value="grpc">grpc</option><option value="http">http</option><option value="h2">h2</option></select></label>
                        <label v-if="proxyCreationWizardVisibility.security" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTls') }}</span><select v-model="proxyCreationWizard.tls" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label v-if="proxyCreationWizardVisibility.security" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldServername') }}</span><input v-model="proxyCreationWizard.servername" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldServernamePlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.security && normalizedProxyCreationWizardType !== 'hysteria2'" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldClientFingerprint') }}</span><input v-model="proxyCreationWizard.clientFingerprint" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldClientFingerprintPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.uuid" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldUuid') }}</span><input v-model="proxyCreationWizard.uuid" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldUuidPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.password" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPassword') }}</span><input v-model="proxyCreationWizard.password" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldPasswordPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.cipher" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldCipher') }}</span><input v-model="proxyCreationWizard.cipher" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldCipherPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.flow" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldFlow') }}</span><input v-model="proxyCreationWizard.flow" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldFlowPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.wsPath" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWsPath') }}</span><input v-model="proxyCreationWizard.wsPath" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldWsPathPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.grpcServiceName" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldGrpcServiceName') }}</span><input v-model="proxyCreationWizard.grpcServiceName" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldGrpcServiceNamePlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.reality" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldRealityPublicKey') }}</span><input v-model="proxyCreationWizard.realityPublicKey" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldRealityPublicKeyPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.reality" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldRealityShortId') }}</span><input v-model="proxyCreationWizard.realityShortId" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldRealityShortIdPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.wireguard" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardIp') }}</span><textarea v-model="proxyCreationWizard.wireguardIpText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardIpPlaceholder')"></textarea></label>
                        <label v-if="proxyCreationWizardVisibility.wireguard" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardPrivateKey') }}</span><textarea v-model="proxyCreationWizard.wireguardPrivateKey" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardPrivateKeyPlaceholder')"></textarea></label>
                        <label v-if="proxyCreationWizardVisibility.wireguard" class="form-control md:col-span-2 xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardPublicKey') }}</span><textarea v-model="proxyCreationWizard.wireguardPublicKey" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardPublicKeyPlaceholder')"></textarea></label>
                        <label v-if="proxyCreationWizardVisibility.wireguard" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardMtu') }}</span><input v-model="proxyCreationWizard.wireguardMtu" type="text" inputmode="numeric" class="input input-sm" placeholder="1420" /></label>
                        <label v-if="proxyCreationWizardVisibility.hysteria2" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaObfs') }}</span><input v-model="proxyCreationWizard.hysteriaObfs" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaObfsPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.hysteria2" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaObfsPassword') }}</span><input v-model="proxyCreationWizard.hysteriaObfsPassword" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaObfsPasswordPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.tuic" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicCongestionController') }}</span><input v-model="proxyCreationWizard.tuicCongestionController" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicCongestionControllerPlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.tuic" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicUdpRelayMode') }}</span><input v-model="proxyCreationWizard.tuicUdpRelayMode" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicUdpRelayModePlaceholder')" /></label>
                        <label v-if="proxyCreationWizardVisibility.tuic" class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicHeartbeatInterval') }}</span><input v-model="proxyCreationWizard.tuicHeartbeatInterval" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicHeartbeatIntervalPlaceholder')" /></label>
                      </div>
                    </div>
                    <div v-else class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm">
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryTemplate') }}</div><div class="mt-1 font-semibold">{{ $t(proxyCreationTemplates.find((item) => item.id === proxyCreationWizard.templateId)?.labelKey || 'configProxiesTitle') }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryName') }}</div><div class="mt-1 font-semibold break-all">{{ proxyCreationWizard.name || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryAddress') }}</div><div class="mt-1 font-semibold break-all">{{ proxyCreationWizard.server || '—' }}<span v-if="proxyCreationWizard.port">:{{ proxyCreationWizard.port }}</span></div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configProxiesFieldType') }}</div><div class="mt-1 flex flex-wrap items-center gap-2"><span class="badge badge-outline">{{ normalizedProxyCreationWizardType || '—' }}</span><span class="font-semibold">{{ proxyCreationWizardTypeSummary }}</span></div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configProxiesTransportTitle') }}</div><div class="mt-1 font-semibold break-all">{{ proxyCreationWizardTransportSummary }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configProxiesAuthTitle') }}</div><div class="mt-1 font-semibold break-all">{{ proxyCreationWizardAuthSummary }}</div></div>
                    </div>
                    <div class="mt-3 flex flex-wrap justify-between gap-2">
                      <button class="btn btn-xs btn-ghost" @click="prevProxyCreationWizardStep">{{ $t('configWizardBack') }}</button>
                      <button v-if="proxyCreationWizard.step < 3" class="btn btn-xs" :disabled="(proxyCreationWizard.step === 1 && !proxyCreationWizard.templateId) || (proxyCreationWizard.step === 2 && !proxyCreationWizardCanProceed)" @click="nextProxyCreationWizardStep">{{ $t('configWizardNext') }}</button>
                      <button v-else class="btn btn-xs" @click="finalizeProxyCreationWizard">{{ $t('configWizardApplyToForm') }}</button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configTemplateCardsTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesTemplatesTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="template in proxyCreationTemplates"
                        :key="`proxy-template-${template.id}`"
                        type="button"
                        class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        @click="applyProxyCreationTemplate(template.id)"
                      >
                        <div class="font-semibold">{{ $t(template.labelKey) }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div>
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label class="form-control md:col-span-2 xl:col-span-2">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldName') }}</span>
                      <input v-model="proxyForm.name" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldNamePlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldType') }}</span>
                      <select v-model="proxyForm.type" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="ss">ss</option>
                        <option value="vmess">vmess</option>
                        <option value="vless">vless</option>
                        <option value="trojan">trojan</option>
                        <option value="socks5">socks5</option>
                        <option value="http">http</option>
                        <option value="wireguard">wireguard</option>
                        <option value="hysteria2">hysteria2</option>
                        <option value="tuic">tuic</option>
                        <option value="direct">direct</option>
                        <option value="reject">reject</option>
                      </select>
                    </label>
                    <label class="form-control md:col-span-2 xl:col-span-2">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldServer') }}</span>
                      <input v-model="proxyForm.server" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldServerPlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPort') }}</span>
                      <input v-model="proxyForm.port" type="text" inputmode="numeric" class="input input-sm" placeholder="443" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldNetwork') }}</span>
                      <select v-model="proxyForm.network" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="tcp">tcp</option>
                        <option value="ws">ws</option>
                        <option value="grpc">grpc</option>
                        <option value="http">http</option>
                        <option value="h2">h2</option>
                      </select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldUdp') }}</span>
                      <select v-model="proxyForm.udp" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTfo') }}</span>
                      <select v-model="proxyForm.tfo" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldDialerProxy') }}</span>
                      <input v-model="proxyForm.dialerProxy" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldDialerProxyPlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldInterfaceName') }}</span>
                      <input v-model="proxyForm.interfaceName" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldInterfaceNamePlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPacketEncoding') }}</span>
                      <input v-model="proxyForm.packetEncoding" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldPacketEncodingPlaceholder')" />
                    </label>
                  </div>

                  <div class="mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold">{{ $t('configProxiesTypeAwareTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ proxyTypeSummary }}</div>
                      </div>
                      <div class="space-y-1 text-right">
                        <div class="text-[11px] opacity-60">{{ $t('configProxiesTypePresetLabel') }}</div>
                        <div class="flex flex-wrap justify-end gap-1">
                          <button
                            v-for="preset in proxyTypePresets"
                            :key="preset.id"
                            type="button"
                            class="badge cursor-pointer border-0 px-2 py-2 transition"
                            :class="normalizedProxyType === preset.id ? 'badge-primary' : 'badge-ghost hover:badge-outline'"
                            @click="applyProxyTypePreset(preset.id)"
                          >
                            {{ preset.label }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <span class="badge badge-outline">{{ proxyTypeProfileLabel }}</span>
                      <span v-for="focus in proxyTypeFocusBadges" :key="focus" class="badge badge-ghost">{{ focus }}</span>
                    </div>
                    <div class="mt-2 text-[11px] opacity-60">{{ $t('configProxiesTypeAwareTip') }}</div>
                  </div>

                  <div v-show="proxyTypeVisibility.security" class="mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configProxiesSecurityTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesSecurityTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTls') }}</span><select v-model="proxyForm.tls" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSkipCertVerify') }}</span><select v-model="proxyForm.skipCertVerify" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSni') }}</span><input v-model="proxyForm.sni" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldSniPlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldServername') }}</span><input v-model="proxyForm.servername" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldServernamePlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldClientFingerprint') }}</span><input v-model="proxyForm.clientFingerprint" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldClientFingerprintPlaceholder')" /></label>
                      <label class="form-control xl:col-span-4"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldAlpn') }}</span><textarea v-model="proxyForm.alpnText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldAlpnPlaceholder')"></textarea></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldRealityPublicKey') }}</span><input v-model="proxyForm.realityPublicKey" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldRealityPublicKeyPlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldRealityShortId') }}</span><input v-model="proxyForm.realityShortId" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldRealityShortIdPlaceholder')" /></label>
                    </div>
                  </div>

                  <div v-show="proxyTypeVisibility.auth" class="mt-3 rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configProxiesAuthTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesAuthTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldUuid') }}</span><input v-model="proxyForm.uuid" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldUuidPlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPassword') }}</span><input v-model="proxyForm.password" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldPasswordPlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldCipher') }}</span><input v-model="proxyForm.cipher" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldCipherPlaceholder')" /></label>
                      <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldFlow') }}</span><input v-model="proxyForm.flow" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldFlowPlaceholder')" /></label>
                    </div>
                  </div>

                  <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div v-show="proxyTypeVisibility.transport" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesTransportTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesTransportTip') }}</div>
                      <div class="mt-3 space-y-3">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWsPath') }}</span><input v-model="proxyForm.wsPath" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldWsPathPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWsHeaders') }}</span><textarea v-model="proxyForm.wsHeadersBody" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWsHeadersPlaceholder')"></textarea></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldGrpcServiceName') }}</span><input v-model="proxyForm.grpcServiceName" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldGrpcServiceNamePlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldGrpcMultiMode') }}</span><select v-model="proxyForm.grpcMultiMode" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                      </div>
                    </div>

                    <div v-show="proxyTypeVisibility.plugin" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesPluginTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesPluginTip') }}</div>
                      <div class="mt-3 space-y-3">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPlugin') }}</span><input v-model="proxyForm.plugin" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldPluginPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldPluginOpts') }}</span><textarea v-model="proxyForm.pluginOptsBody" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldPluginOptsPlaceholder')"></textarea></label>
                      </div>
                    </div>
                  </div>


                  <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div v-show="proxyTypeVisibility.httpOpts" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesHttpOptsTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesHttpOptsTip') }}</div>
                      <div class="mt-3 grid grid-cols-1 gap-3">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHttpMethod') }}</span><input v-model="proxyForm.httpMethod" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHttpMethodPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHttpPath') }}</span><textarea v-model="proxyForm.httpPathText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldHttpPathPlaceholder')"></textarea></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHttpHeaders') }}</span><textarea v-model="proxyForm.httpHeadersBody" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldHttpHeadersPlaceholder')"></textarea></label>
                      </div>
                    </div>

                    <div v-show="proxyTypeVisibility.smux" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesSmuxTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesSmuxTip') }}</div>
                      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxEnabled') }}</span><select v-model="proxyForm.smuxEnabled" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxProtocol') }}</span><input v-model="proxyForm.smuxProtocol" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldSmuxProtocolPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxMaxConnections') }}</span><input v-model="proxyForm.smuxMaxConnections" type="text" inputmode="numeric" class="input input-sm" placeholder="4" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxMinStreams') }}</span><input v-model="proxyForm.smuxMinStreams" type="text" inputmode="numeric" class="input input-sm" placeholder="4" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxMaxStreams') }}</span><input v-model="proxyForm.smuxMaxStreams" type="text" inputmode="numeric" class="input input-sm" placeholder="16" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxPadding') }}</span><select v-model="proxyForm.smuxPadding" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldSmuxStatistic') }}</span><select v-model="proxyForm.smuxStatistic" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <div v-show="proxyTypeVisibility.wireguard" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 xl:col-span-2">
                      <div class="font-semibold">{{ $t('configProxiesWireguardTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesWireguardTip') }}</div>
                      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardIp') }}</span><textarea v-model="proxyForm.wireguardIpText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardIpPlaceholder')"></textarea></label>
                        <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardIpv6') }}</span><textarea v-model="proxyForm.wireguardIpv6Text" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardIpv6Placeholder')"></textarea></label>
                        <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardPrivateKey') }}</span><input v-model="proxyForm.wireguardPrivateKey" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldWireguardPrivateKeyPlaceholder')" /></label>
                        <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardPublicKey') }}</span><input v-model="proxyForm.wireguardPublicKey" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldWireguardPublicKeyPlaceholder')" /></label>
                        <label class="form-control xl:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardPresharedKey') }}</span><input v-model="proxyForm.wireguardPresharedKey" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldWireguardPresharedKeyPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardMtu') }}</span><input v-model="proxyForm.wireguardMtu" type="text" inputmode="numeric" class="input input-sm" placeholder="1420" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardWorkers') }}</span><input v-model="proxyForm.wireguardWorkers" type="text" inputmode="numeric" class="input input-sm" placeholder="2" /></label>
                        <label class="form-control xl:col-span-4"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldWireguardReserved') }}</span><textarea v-model="proxyForm.wireguardReservedText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxiesFieldWireguardReservedPlaceholder')"></textarea></label>
                      </div>
                    </div>

                    <div v-show="proxyTypeVisibility.protocolExtras" class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesProtocolExtrasTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesProtocolExtrasTip') }}</div>
                      <div class="mt-3 space-y-3">
                        <div v-show="proxyTypeVisibility.hysteria2" class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                          <div class="text-xs font-semibold opacity-80">hysteria2</div>
                          <div class="mt-2 grid grid-cols-1 gap-3">
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaUp') }}</span><input v-model="proxyForm.hysteriaUp" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaUpPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaDown') }}</span><input v-model="proxyForm.hysteriaDown" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaDownPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaObfs') }}</span><input v-model="proxyForm.hysteriaObfs" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaObfsPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldHysteriaObfsPassword') }}</span><input v-model="proxyForm.hysteriaObfsPassword" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldHysteriaObfsPasswordPlaceholder')" /></label>
                          </div>
                        </div>
                        <div v-show="proxyTypeVisibility.tuic" class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                          <div class="text-xs font-semibold opacity-80">tuic</div>
                          <div class="mt-2 grid grid-cols-1 gap-3">
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicCongestionController') }}</span><input v-model="proxyForm.tuicCongestionController" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicCongestionControllerPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicUdpRelayMode') }}</span><input v-model="proxyForm.tuicUdpRelayMode" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicUdpRelayModePlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicHeartbeatInterval') }}</span><input v-model="proxyForm.tuicHeartbeatInterval" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicHeartbeatIntervalPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicRequestTimeout') }}</span><input v-model="proxyForm.tuicRequestTimeout" type="text" class="input input-sm" :placeholder="$t('configProxiesFieldTuicRequestTimeoutPlaceholder')" /></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicFastOpen') }}</span><select v-model="proxyForm.tuicFastOpen" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicReduceRtt') }}</span><select v-model="proxyForm.tuicReduceRtt" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                            <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxiesFieldTuicDisableSni') }}</span><select v-model="proxyForm.tuicDisableSni" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="true">true</option><option value="false">false</option></select></label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3">
                    <div class="mb-1 font-semibold">{{ $t('configProxiesExtraYamlTitle') }}</div>
                    <div class="mb-2 text-[11px] opacity-70">{{ $t('configProxiesExtraYamlTip') }}</div>
                    <textarea v-model="proxyForm.extraBody" class="textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configProxiesExtraYamlPlaceholder')"></textarea>
                  </div>

                  <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesReferencesTitle') }}</div>
                      <div v-if="!selectedProxyEntry" class="mt-2 opacity-70">{{ $t('configProxiesReferencesSelect') }}</div>
                      <div v-else-if="!selectedProxyEntry.references.length" class="mt-2 opacity-70">{{ $t('configProxiesReferencesEmpty') }}</div>
                      <div v-else class="mt-2 space-y-2">
                        <div v-if="proxyReferencesSummary.groupRefs.length" class="space-y-1">
                          <div class="text-[11px] font-semibold opacity-70">{{ $t('configProxiesReferencesGroups') }}</div>
                          <div class="flex flex-wrap gap-2">
                            <span v-for="refItem in proxyReferencesSummary.groupRefs" :key="`g-${refItem.text}-${refItem.key}`" class="badge badge-outline">{{ refItem.text }} · {{ refItem.key }}</span>
                          </div>
                        </div>
                        <div v-if="proxyReferencesSummary.ruleRefs.length" class="space-y-1">
                          <div class="text-[11px] font-semibold opacity-70">{{ $t('configProxiesReferencesRules') }}</div>
                          <div class="space-y-1">
                            <div v-for="refItem in proxyReferencesSummary.ruleRefs" :key="`r-${refItem.lineNo}-${refItem.text}`" class="rounded border border-base-content/10 bg-base-100/80 px-2 py-1 font-mono text-[11px]">
                              line {{ refItem.lineNo }} · {{ refItem.text }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxiesDisableImpactTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesDisableImpactTip') }}</div>
                      <div v-if="!selectedProxyEntry" class="mt-2 opacity-70">{{ $t('configProxiesDisableImpactSelect') }}</div>
                      <div v-else-if="!proxyDisablePlan.impacts.length && !proxyDisablePlan.rulesTouched" class="mt-2 opacity-70">{{ $t('configProxiesDisableImpactEmpty') }}</div>
                      <div v-else class="mt-2 space-y-2">
                        <div v-for="impact in proxyDisablePlan.impacts" :key="impact.group" class="rounded-lg border border-base-content/10 bg-base-100/80 p-2">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="font-semibold">{{ impact.group }}</div>
                            <span v-if="impact.fallbackInjected" class="badge badge-warning badge-outline">DIRECT</span>
                          </div>
                          <div class="mt-1 text-[11px] opacity-70">{{ impact.fallbackInjected ? $t('configProxiesDisableImpactFallback') : $t('configProxiesDisableImpactClean') }}</div>
                        </div>
                        <div v-if="proxyDisablePlan.rulesTouched" class="rounded-lg border border-base-content/10 bg-base-100/80 p-2">
                          <div class="font-semibold">{{ $t('configProxiesDisableImpactRules', { count: proxyDisablePlan.rulesTouched }) }}</div>
                          <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxiesDisableImpactRulesTip') }}</div>
                          <div class="mt-2 space-y-1">
                            <div v-for="sample in proxyDisablePlan.ruleSamples" :key="`sample-${sample.lineNo}-${sample.text}`" class="rounded border border-base-content/10 bg-base-100 px-2 py-1 font-mono text-[11px]">line {{ sample.lineNo }} · {{ sample.text }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'proxy-providers'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configProxyProvidersTitle') }}</div>
                  <div class="opacity-70">{{ $t('configProxyProvidersTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configProxyProvidersCount', { count: parsedProxyProviders.length }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="prepareNewProxyProvider">{{ $t('configProxyProvidersNew') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configProxyProvidersEmptyEditor') }}
              </div>

              <div v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="font-semibold">{{ $t('configProxyProvidersListTitle') }}</div>
                    <span class="badge badge-outline">{{ filteredProxyProviders.length }} / {{ parsedProxyProviders.length }}</span>
                  </div>

                  <label class="input input-sm input-bordered flex items-center gap-2">
                    <span class="opacity-60">#</span>
                    <input v-model="proxyProviderListQuery" type="text" class="grow" :placeholder="$t('configProxyProvidersFilterPlaceholder')" />
                    <button v-if="proxyProviderListQuery" type="button" class="btn btn-ghost btn-xs" @click="clearProxyProviderFilter">×</button>
                  </label>

                  <div v-if="!parsedProxyProviders.length" class="mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                    {{ $t('configProxyProvidersListEmpty') }}
                  </div>
                  <div v-else-if="!filteredProxyProviders.length" class="mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                    {{ $t('configProxyProvidersFilteredEmpty') }}
                  </div>
                  <div v-else class="mt-3 max-h-[32rem] space-y-2 overflow-auto pr-1">
                    <button
                      v-for="item in filteredProxyProviders"
                      :key="item.name"
                      type="button"
                      class="w-full rounded-lg border p-3 text-left transition"
                      :class="proxyProviderSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40'"
                      @click="loadProxyProviderIntoForm(item.name)"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div class="font-semibold">{{ item.name }}</div>
                          <div class="mt-1 break-all text-[11px] opacity-70">{{ proxyProviderDisplayValue(item.url || item.path) }}</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="badge badge-outline">{{ proxyProviderDisplayValue(item.type) }}</span>
                          <span class="badge" :class="providerReferenceBadgeClass(item.references.length)">
                            {{ $t('configProxyProvidersReferencesCount', { count: item.references.length }) }}
                          </span>
                        </div>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span v-if="item.path" class="badge badge-ghost badge-sm">{{ $t('configProxyProvidersPathShort') }}: {{ item.path }}</span>
                        <span v-if="item.interval" class="badge badge-ghost badge-sm">{{ $t('configProxyProvidersIntervalShort') }}: {{ item.interval }}</span>
                        <span v-if="item.filter" class="badge badge-ghost badge-sm">filter</span>
                        <span v-if="item.excludeFilter" class="badge badge-ghost badge-sm">exclude-filter</span>
                        <span v-if="item.healthCheckUrl || item.healthCheckEnable" class="badge badge-success badge-outline badge-sm">health-check</span>
                        <span v-if="item.overrideBody" class="badge badge-warning badge-outline badge-sm">override</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="space-y-3 rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ selectedProxyProviderEntry ? $t('configProxyProvidersEditSelected') : $t('configProxyProvidersEditNew') }}</div>
                      <div class="opacity-70">{{ $t('configProxyProvidersEditTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-xs btn-ghost" @click="startProxyProviderCreationWizard">{{ $t('configWizardStart') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="prepareNewProxyProvider">{{ $t('configProxyProvidersResetForm') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="duplicateSelectedProxyProvider" :disabled="!selectedProxyProviderEntry">{{ $t('configProxyProvidersDuplicate') }}</button>
                      <button class="btn btn-xs" @click="saveProxyProviderToPayload" :disabled="!proxyProviderFormCanSave">{{ $t('configProxyProvidersSaveToEditor') }}</button>
                      <button class="btn btn-xs btn-warning" @click="disableSelectedProxyProvider" :disabled="!selectedProxyProviderEntry">{{ $t('configProxyProvidersDisable') }}</button>
                    </div>
                  </div>

                  <div v-if="proxyProviderCreationWizard.active" class="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold">{{ $t('configWizardTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersWizardTip') }}</div>
                      </div>
                      <button class="btn btn-xs btn-ghost" @click="cancelProxyProviderCreationWizard">{{ $t('configWizardCancel') }}</button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span class="badge" :class="proxyProviderCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost'">1 · {{ $t('configWizardStepChooseTemplate') }}</span>
                      <span class="badge" :class="proxyProviderCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost'">2 · {{ $t('configWizardStepFillBasics') }}</span>
                      <span class="badge" :class="proxyProviderCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost'">3 · {{ $t('configWizardStepReview') }}</span>
                    </div>
                    <div v-if="proxyProviderCreationWizard.step === 1" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button v-for="template in proxyProviderCreationTemplates" :key="`provider-wizard-template-${template.id}`" type="button" class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" @click="selectProxyProviderCreationWizardTemplate(template.id)"><div class="font-semibold">{{ $t(template.labelKey) }}</div><div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div></button>
                    </div>
                    <div v-else-if="proxyProviderCreationWizard.step === 2" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldName') }}</span><input v-model="proxyProviderCreationWizard.name" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldType') }}</span><select v-model="proxyProviderCreationWizard.type" class="select select-sm"><option value="http">http</option><option value="file">file</option><option value="inline">inline</option></select></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldUrl') }}</span><input v-model="proxyProviderCreationWizard.url" type="text" class="input input-sm" /></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldPath') }}</span><input v-model="proxyProviderCreationWizard.path" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldInterval') }}</span><input v-model="proxyProviderCreationWizard.interval" type="text" inputmode="numeric" class="input input-sm" /></label>
                    </div>
                    <div v-else class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryTemplate') }}</div><div class="mt-1 font-semibold">{{ $t(proxyProviderCreationTemplates.find((item) => item.id === proxyProviderCreationWizard.templateId)?.labelKey || 'configProxyProvidersTitle') }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryName') }}</div><div class="mt-1 font-semibold break-all">{{ proxyProviderCreationWizard.name || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryPath') }}</div><div class="mt-1 font-semibold break-all">{{ proxyProviderCreationWizard.path || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryInterval') }}</div><div class="mt-1 font-semibold">{{ proxyProviderCreationWizard.interval || '—' }}</div></div>
                    </div>
                    <div class="mt-3 flex flex-wrap justify-between gap-2">
                      <button class="btn btn-xs btn-ghost" @click="prevProxyProviderCreationWizardStep">{{ $t('configWizardBack') }}</button>
                      <button v-if="proxyProviderCreationWizard.step < 3" class="btn btn-xs" :disabled="proxyProviderCreationWizard.step === 1 && !proxyProviderCreationWizard.templateId" @click="nextProxyProviderCreationWizardStep">{{ $t('configWizardNext') }}</button>
                      <button v-else class="btn btn-xs" @click="finalizeProxyProviderCreationWizard">{{ $t('configWizardApplyToForm') }}</button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configTemplateCardsTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersTemplatesTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="template in proxyProviderCreationTemplates"
                        :key="`proxy-provider-template-${template.id}`"
                        type="button"
                        class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        @click="applyProxyProviderCreationTemplate(template.id)"
                      >
                        <div class="font-semibold">{{ $t(template.labelKey) }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div>
                      </button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div class="font-semibold">{{ $t('configProxyProvidersTypeAwareTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersTypeAwareTip') }}</div>
                      </div>
                      <span class="badge" :class="proxyProviderTypeProfile.accent">{{ proxyProviderDisplayValue(proxyProviderForm.type) }}</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button
                        v-for="type in proxyProviderTypePresets"
                        :key="`proxy-provider-type-${type}`"
                        type="button"
                        class="badge badge-outline cursor-pointer"
                        :class="normalizedProxyProviderType === type ? 'badge-primary' : ''"
                        @click="applyProxyProviderTypePreset(type)"
                      >
                        {{ type }}
                      </button>
                    </div>
                    <div class="mt-3 rounded-lg border border-base-content/10 bg-base-200/50 p-3 text-[11px] opacity-80">
                      {{ proxyProviderTypeProfile.summary }}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2">
                      <div class="mb-3 font-semibold">{{ $t('configProxyProvidersSectionIdentity') }}</div>
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldName') }}</span>
                          <input v-model="proxyProviderForm.name" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersFieldNamePlaceholder')" />
                        </label>
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldType') }}</span>
                          <select v-model="proxyProviderForm.type" class="select select-sm">
                            <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                            <option value="http">http</option>
                            <option value="file">file</option>
                            <option value="inline">inline</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2">
                      <div class="mb-3 font-semibold">{{ $t('configProxyProvidersSectionSource') }}</div>
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label class="form-control md:col-span-2">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldUrl') }}</span>
                          <input v-model="proxyProviderForm.url" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersFieldUrlPlaceholder')" />
                        </label>
                        <label class="form-control md:col-span-2">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldPath') }}</span>
                          <input v-model="proxyProviderForm.path" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersFieldPathPlaceholder')" />
                        </label>
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldInterval') }}</span>
                          <input v-model="proxyProviderForm.interval" type="text" inputmode="numeric" class="input input-sm" placeholder="86400" />
                        </label>
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldFilter') }}</span>
                          <input v-model="proxyProviderForm.filter" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersFieldFilterPlaceholder')" />
                        </label>
                        <label class="form-control md:col-span-2">
                          <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersFieldExcludeFilter') }}</span>
                          <input v-model="proxyProviderForm.excludeFilter" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersFieldExcludeFilterPlaceholder')" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div class="font-semibold">{{ $t('configProxyProvidersHealthCheckTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersHealthCheckTip') }}</div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <button type="button" class="badge badge-outline cursor-pointer" @click="applyProxyProviderHealthPreset('https://www.gstatic.com/generate_204')">gstatic 204</button>
                        <button type="button" class="badge badge-outline cursor-pointer" @click="applyProxyProviderHealthPreset('https://connectivitycheck.gstatic.com/generate_204')">connectivitycheck</button>
                      </div>
                    </div>
                    <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersHealthCheckEnable') }}</span>
                        <select v-model="proxyProviderForm.healthCheckEnable" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </label>
                      <label class="form-control xl:col-span-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersHealthCheckUrl') }}</span>
                        <input v-model="proxyProviderForm.healthCheckUrl" type="text" class="input input-sm" :placeholder="$t('configProxyProvidersHealthCheckUrlPlaceholder')" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersHealthCheckInterval') }}</span>
                        <input v-model="proxyProviderForm.healthCheckInterval" type="text" inputmode="numeric" class="input input-sm" placeholder="300" />
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersHealthCheckLazy') }}</span>
                        <select v-model="proxyProviderForm.healthCheckLazy" class="select select-sm">
                          <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </label>
                      <label class="form-control xl:col-span-3">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyProvidersHealthCheckExtra') }}</span>
                        <textarea v-model="proxyProviderForm.healthCheckExtraBody" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configProxyProvidersHealthCheckExtraPlaceholder')"></textarea>
                      </label>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyProvidersOverrideTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersOverrideTip') }}</div>
                      <textarea v-model="proxyProviderForm.overrideBody" class="mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configProxyProvidersOverridePlaceholder')"></textarea>
                    </div>
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyProvidersExtraYamlTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersExtraYamlTip') }}</div>
                      <textarea v-model="proxyProviderForm.extraBody" class="mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configProxyProvidersExtraYamlPlaceholder')"></textarea>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyProvidersReferencesTitle') }}</div>
                      <div v-if="!selectedProxyProviderEntry" class="mt-2 opacity-70">{{ $t('configProxyProvidersReferencesSelect') }}</div>
                      <div v-else-if="!selectedProxyProviderEntry.references.length" class="mt-2 opacity-70">{{ $t('configProxyProvidersReferencesEmpty') }}</div>
                      <div v-else class="mt-2 flex flex-wrap gap-2">
                        <span v-for="refItem in selectedProxyProviderEntry.references" :key="`${refItem.group}-${refItem.key}`" class="badge badge-outline">
                          {{ refItem.group }} · {{ refItem.key }}
                        </span>
                      </div>
                    </div>
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyProvidersDisableImpactTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyProvidersDisableImpactTip') }}</div>
                      <div v-if="!selectedProxyProviderEntry" class="mt-2 opacity-70">{{ $t('configProxyProvidersDisableImpactSelect') }}</div>
                      <template v-else>
                        <div v-if="!proxyProviderDisableImpact.length" class="mt-2 opacity-70">{{ $t('configProxyProvidersDisableImpactEmpty') }}</div>
                        <div v-else class="mt-2 space-y-2">
                          <div v-for="impact in proxyProviderDisableImpact" :key="`${impact.group}-${impact.keys.join('-')}`" class="rounded-lg border border-base-content/10 bg-base-200/50 p-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <span class="font-semibold">{{ impact.group }}</span>
                              <span class="badge badge-ghost">{{ impact.keys.join(', ') }}</span>
                            </div>
                            <div class="mt-1 text-[11px] opacity-70">
                              {{ impact.fallbackInjected ? $t('configProxyProvidersDisableImpactFallback') : $t('configProxyProvidersDisableImpactClean') }}
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'proxy-groups'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configProxyGroupsTitle') }}</div>
                  <div class="opacity-70">{{ $t('configProxyGroupsTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configProxyGroupsCount', { count: parsedProxyGroups.length }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="prepareNewProxyGroup">{{ $t('configProxyGroupsNew') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                {{ $t('configProxyGroupsEmptyEditor') }}
              </div>

              <div v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[24rem,minmax(0,1fr)]">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="font-semibold">{{ $t('configProxyGroupsListTitle') }}</div>
                    <span class="badge badge-outline">{{ parsedProxyGroups.length }}</span>
                  </div>

                  <div v-if="!parsedProxyGroups.length" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">
                    {{ $t('configProxyGroupsListEmpty') }}
                  </div>

                  <div v-else class="max-h-[36rem] space-y-2 overflow-auto pr-1">
                    <button
                      v-for="item in parsedProxyGroups"
                      :key="item.name"
                      type="button"
                      class="w-full rounded-lg border p-3 text-left transition"
                      :class="proxyGroupSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40'"
                      @click="loadProxyGroupIntoForm(item.name)"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div class="font-semibold">{{ item.name }}</div>
                          <div class="mt-1 text-[11px] opacity-70">{{ item.type || '—' }}</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="badge badge-outline">{{ item.type || '—' }}</span>
                          <span class="badge badge-ghost">{{ $t('configProxyGroupsRefsShort', { count: item.references.length }) }}</span>
                        </div>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span v-if="item.proxies.length" class="badge badge-ghost badge-sm">proxies: {{ item.proxies.length }}</span>
                        <span v-if="item.use.length" class="badge badge-ghost badge-sm">use: {{ item.use.length }}</span>
                        <span v-if="item.providers.length" class="badge badge-ghost badge-sm">providers: {{ item.providers.length }}</span>
                        <span v-if="item.url" class="badge badge-ghost badge-sm">url</span>
                        <span v-if="item.interval" class="badge badge-ghost badge-sm">interval: {{ item.interval }}</span>
                        <span v-if="item.includeAll" class="badge badge-success badge-outline badge-sm">include-all</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ selectedProxyGroupEntry ? $t('configProxyGroupsEditSelected') : $t('configProxyGroupsEditNew') }}</div>
                      <div class="opacity-70">{{ $t('configProxyGroupsEditTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-xs btn-ghost" @click="startProxyGroupCreationWizard">{{ $t('configWizardStart') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="prepareNewProxyGroup">{{ $t('configProxyGroupsResetForm') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="duplicateSelectedProxyGroup" :disabled="!selectedProxyGroupEntry">{{ $t('configProxyGroupsDuplicate') }}</button>
                      <button class="btn btn-xs" @click="saveProxyGroupToPayload" :disabled="!proxyGroupFormCanSave">{{ $t('configProxyGroupsSaveToEditor') }}</button>
                      <button class="btn btn-xs btn-warning" @click="disableSelectedProxyGroup" :disabled="!selectedProxyGroupEntry">{{ $t('configProxyGroupsDisable') }}</button>
                    </div>
                  </div>

                  <div v-if="proxyGroupCreationWizard.active" class="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold">{{ $t('configWizardTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyGroupsWizardTip') }}</div>
                      </div>
                      <button class="btn btn-xs btn-ghost" @click="cancelProxyGroupCreationWizard">{{ $t('configWizardCancel') }}</button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span class="badge" :class="proxyGroupCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost'">1 · {{ $t('configWizardStepChooseTemplate') }}</span>
                      <span class="badge" :class="proxyGroupCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost'">2 · {{ $t('configWizardStepFillBasics') }}</span>
                      <span class="badge" :class="proxyGroupCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost'">3 · {{ $t('configWizardStepReview') }}</span>
                    </div>
                    <div v-if="proxyGroupCreationWizard.step === 1" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button v-for="template in proxyGroupCreationTemplates" :key="`group-wizard-template-${template.id}`" type="button" class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" @click="selectProxyGroupCreationWizardTemplate(template.id)"><div class="font-semibold">{{ $t(template.labelKey) }}</div><div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div></button>
                    </div>
                    <div v-else-if="proxyGroupCreationWizard.step === 2" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldName') }}</span><input v-model="proxyGroupCreationWizard.name" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldType') }}</span><select v-model="proxyGroupCreationWizard.type" class="select select-sm"><option value="select">select</option><option value="url-test">url-test</option><option value="fallback">fallback</option><option value="load-balance">load-balance</option><option value="relay">relay</option></select></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configWizardSummaryMembers') }}</span><textarea v-model="proxyGroupCreationWizard.membersText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]"></textarea></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">providers / use</span><textarea v-model="proxyGroupCreationWizard.providersText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]"></textarea></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldUrl') }}</span><input v-model="proxyGroupCreationWizard.url" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldInterval') }}</span><input v-model="proxyGroupCreationWizard.interval" type="text" inputmode="numeric" class="input input-sm" /></label>
                    </div>
                    <div v-else class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryTemplate') }}</div><div class="mt-1 font-semibold">{{ $t(proxyGroupCreationTemplates.find((item) => item.id === proxyGroupCreationWizard.templateId)?.labelKey || 'configProxyGroupsTitle') }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryName') }}</div><div class="mt-1 font-semibold break-all">{{ proxyGroupCreationWizard.name || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryMembers') }}</div><div class="mt-1 font-semibold">{{ splitFormList(proxyGroupCreationWizard.membersText).length }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryInterval') }}</div><div class="mt-1 font-semibold">{{ proxyGroupCreationWizard.interval || '—' }}</div></div>
                    </div>
                    <div class="mt-3 flex flex-wrap justify-between gap-2">
                      <button class="btn btn-xs btn-ghost" @click="prevProxyGroupCreationWizardStep">{{ $t('configWizardBack') }}</button>
                      <button v-if="proxyGroupCreationWizard.step < 3" class="btn btn-xs" :disabled="proxyGroupCreationWizard.step === 1 && !proxyGroupCreationWizard.templateId" @click="nextProxyGroupCreationWizardStep">{{ $t('configWizardNext') }}</button>
                      <button v-else class="btn btn-xs" @click="finalizeProxyGroupCreationWizard">{{ $t('configWizardApplyToForm') }}</button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configTemplateCardsTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyGroupsTemplatesTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="template in proxyGroupCreationTemplates"
                        :key="`proxy-group-template-${template.id}`"
                        type="button"
                        class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        @click="applyProxyGroupCreationTemplate(template.id)"
                      >
                        <div class="font-semibold">{{ $t(template.labelKey) }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div>
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldName') }}</span>
                      <input v-model="proxyGroupForm.name" type="text" class="input input-sm" :placeholder="$t('configProxyGroupsFieldNamePlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldType') }}</span>
                      <select v-model="proxyGroupForm.type" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="select">select</option>
                        <option value="url-test">url-test</option>
                        <option value="fallback">fallback</option>
                        <option value="load-balance">load-balance</option>
                        <option value="relay">relay</option>
                      </select>
                    </label>
                    <div class="md:col-span-2 rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div class="font-semibold">{{ $t('configProxyGroupsTypeAwareTitle') }}</div>
                          <div class="mt-1 text-[11px] opacity-70">{{ proxyGroupTypeProfile.summary }}</div>
                        </div>
                        <span class="badge" :class="proxyGroupTypeProfile.accent">{{ normalizedProxyGroupType || 'select' }}</span>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <button
                          v-for="preset in proxyGroupTypePresets"
                          :key="`proxy-group-preset-${preset}`"
                          type="button"
                          class="btn btn-xs"
                          :class="normalizedProxyGroupType === preset ? 'btn-primary' : 'btn-ghost'"
                          @click="applyProxyGroupTypePreset(preset)"
                        >
                          {{ preset }}
                        </button>
                      </div>
                      <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                        <span class="badge badge-outline">{{ $t('configProxyGroupsTypeAwareFields') }}</span>
                        <span v-for="field in proxyGroupTypeProfile.fields" :key="`proxy-group-field-${field}`" class="badge badge-ghost">{{ field }}</span>
                      </div>
                    </div>
                    <label class="form-control md:col-span-2">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldUrl') }}</span>
                      <input v-model="proxyGroupForm.url" type="text" class="input input-sm" :placeholder="$t('configProxyGroupsFieldUrlPlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldInterval') }}</span>
                      <input v-model="proxyGroupForm.interval" type="text" inputmode="numeric" class="input input-sm" placeholder="300" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldStrategy') }}</span>
                      <input v-model="proxyGroupForm.strategy" type="text" class="input input-sm" :placeholder="$t('configProxyGroupsFieldStrategyPlaceholder')" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldLazy') }}</span>
                      <select v-model="proxyGroupForm.lazy" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldDisableUdp') }}</span>
                      <select v-model="proxyGroupForm.disableUdp" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldIncludeAll') }}</span>
                      <select v-model="proxyGroupForm.includeAll" class="select select-sm">
                        <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldTolerance') }}</span>
                      <input v-model="proxyGroupForm.tolerance" type="text" inputmode="numeric" class="input input-sm" placeholder="50" />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldTimeout') }}</span>
                      <input v-model="proxyGroupForm.timeout" type="text" inputmode="numeric" class="input input-sm" placeholder="3000" />
                    </label>
                    <label class="form-control md:col-span-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldProxies') }}</span>
                        <span class="text-[11px] opacity-60">{{ $t('configProxyGroupsMembersHint') }}</span>
                      </div>
                      <textarea v-model="proxyGroupForm.proxiesText" class="textarea textarea-sm h-24 w-full resize-y font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxyGroupsFieldProxiesPlaceholder')"></textarea>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSelectedLists.proxies.length">
                        <button v-for="item in proxyGroupSelectedLists.proxies" :key="`selected-group-proxy-${item}`" type="button" class="badge badge-primary badge-outline gap-1" @click="toggleProxyGroupListValue('proxiesText', item)">
                          <span>{{ item }}</span><span>×</span>
                        </button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSuggestedProxyMembers.length">
                        <button v-for="item in proxyGroupSuggestedProxyMembers" :key="`suggest-group-proxy-${item}`" type="button" class="badge badge-ghost" @click="toggleProxyGroupListValue('proxiesText', item)">+ {{ item }}</button>
                      </div>
                    </label>
                    <label class="form-control md:col-span-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldUse') }}</span>
                        <span class="text-[11px] opacity-60">{{ $t('configProxyGroupsProvidersHint') }}</span>
                      </div>
                      <textarea v-model="proxyGroupForm.useText" class="textarea textarea-sm h-20 w-full resize-y font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxyGroupsFieldUsePlaceholder')"></textarea>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSelectedLists.use.length">
                        <button v-for="item in proxyGroupSelectedLists.use" :key="`selected-group-use-${item}`" type="button" class="badge badge-secondary badge-outline gap-1" @click="toggleProxyGroupListValue('useText', item)">
                          <span>{{ item }}</span><span>×</span>
                        </button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSuggestedUseMembers.length">
                        <button v-for="item in proxyGroupSuggestedUseMembers" :key="`suggest-group-use-${item}`" type="button" class="badge badge-ghost" @click="toggleProxyGroupListValue('useText', item)">+ {{ item }}</button>
                      </div>
                    </label>
                    <label class="form-control md:col-span-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="label-text text-xs opacity-70">{{ $t('configProxyGroupsFieldProviders') }}</span>
                        <span class="text-[11px] opacity-60">{{ $t('configProxyGroupsProvidersHint') }}</span>
                      </div>
                      <textarea v-model="proxyGroupForm.providersText" class="textarea textarea-sm h-20 w-full resize-y font-mono leading-5 [tab-size:2]" :placeholder="$t('configProxyGroupsFieldProvidersPlaceholder')"></textarea>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSelectedLists.providers.length">
                        <button v-for="item in proxyGroupSelectedLists.providers" :key="`selected-group-provider-${item}`" type="button" class="badge badge-accent badge-outline gap-1" @click="toggleProxyGroupListValue('providersText', item)">
                          <span>{{ item }}</span><span>×</span>
                        </button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="proxyGroupSuggestedProviderMembers.length">
                        <button v-for="item in proxyGroupSuggestedProviderMembers" :key="`suggest-group-provider-${item}`" type="button" class="badge badge-ghost" @click="toggleProxyGroupListValue('providersText', item)">+ {{ item }}</button>
                      </div>
                    </label>
                  </div>

                  <div class="mt-3">
                    <div class="mb-1 font-semibold">{{ $t('configProxyGroupsExtraYamlTitle') }}</div>
                    <div class="mb-2 text-[11px] opacity-70">{{ $t('configProxyGroupsExtraYamlTip') }}</div>
                    <textarea
                      v-model="proxyGroupForm.extraBody"
                      class="textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]"
                      wrap="off"
                      :placeholder="$t('configProxyGroupsExtraYamlPlaceholder')"
                    ></textarea>
                  </div>

                  <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyGroupsReferencesTitle') }}</div>
                      <div v-if="!selectedProxyGroupEntry" class="mt-2 opacity-70">{{ $t('configProxyGroupsReferencesSelect') }}</div>
                      <template v-else>
                        <div class="mt-2 text-[11px] opacity-70">{{ $t('configProxyGroupsReferencesTip') }}</div>
                        <div v-if="!proxyGroupReferencesSummary.groupRefs.length && !proxyGroupReferencesSummary.ruleRefs.length" class="mt-2 opacity-70">{{ $t('configProxyGroupsReferencesEmpty') }}</div>
                        <div v-else class="mt-2 space-y-2">
                          <div v-if="proxyGroupReferencesSummary.groupRefs.length">
                            <div class="mb-1 text-[11px] opacity-70">{{ $t('configProxyGroupsReferencesGroups') }}</div>
                            <div class="flex flex-wrap gap-2">
                              <span v-for="refItem in proxyGroupReferencesSummary.groupRefs" :key="`group-${refItem.text}-${refItem.key}`" class="badge badge-outline">
                                {{ refItem.text }} · {{ refItem.key }}
                              </span>
                            </div>
                          </div>
                          <div v-if="proxyGroupReferencesSummary.ruleRefs.length">
                            <div class="mb-1 text-[11px] opacity-70">{{ $t('configProxyGroupsReferencesRules') }}</div>
                            <div class="flex flex-wrap gap-2">
                              <span v-for="refItem in proxyGroupReferencesSummary.ruleRefs.slice(0, 8)" :key="`rule-${refItem.lineNo}-${refItem.text}`" class="badge badge-ghost">
                                L{{ refItem.lineNo }}
                              </span>
                              <span v-if="proxyGroupReferencesSummary.ruleRefs.length > 8" class="badge badge-outline">+{{ proxyGroupReferencesSummary.ruleRefs.length - 8 }}</span>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configProxyGroupsDisableImpactTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configProxyGroupsDisableImpactTip') }}</div>
                      <div v-if="!selectedProxyGroupEntry" class="mt-2 opacity-70">{{ $t('configProxyGroupsDisableImpactSelect') }}</div>
                      <template v-else>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <span class="badge badge-ghost">{{ $t('configProxyGroupsDisableImpactRules', { count: proxyGroupDisablePlan.rulesTouched }) }}</span>
                          <span class="badge badge-ghost">{{ $t('configProxyGroupsDisableImpactGroups', { count: proxyGroupDisablePlan.impacts.length }) }}</span>
                        </div>
                        <div v-if="!proxyGroupDisablePlan.impacts.length && !proxyGroupDisablePlan.rulesTouched" class="mt-2 opacity-70">{{ $t('configProxyGroupsDisableImpactEmpty') }}</div>
                        <div v-else class="mt-2 space-y-2">
                          <div v-for="impact in proxyGroupDisablePlan.impacts" :key="impact.group" class="rounded-lg border border-base-content/10 bg-base-100/80 p-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <div class="font-semibold">{{ impact.group }}</div>
                              <div class="flex flex-wrap gap-2">
                                <span class="badge badge-ghost">{{ impact.keys.join(', ') }}</span>
                                <span v-if="impact.fallbackInjected" class="badge badge-warning badge-outline">DIRECT</span>
                              </div>
                            </div>
                            <div class="mt-1 text-[11px] opacity-70">
                              {{ impact.fallbackInjected ? $t('configProxyGroupsDisableImpactFallback') : $t('configProxyGroupsDisableImpactClean') }}
                            </div>
                          </div>
                          <div v-if="proxyGroupDisablePlan.ruleSamples.length" class="rounded-lg border border-base-content/10 bg-base-100/80 p-2">
                            <div class="font-semibold">{{ $t('configProxyGroupsDisableImpactRulesTitle') }}</div>
                            <div class="mt-2 space-y-1">
                              <div v-for="sample in proxyGroupDisablePlan.ruleSamples" :key="`rule-sample-${sample.lineNo}-${sample.text}`" class="font-mono text-[11px] break-all">
                                L{{ sample.lineNo }} · {{ sample.text }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'rule-providers'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configRuleProvidersTitle') }}</div>
                  <div class="opacity-70">{{ $t('configRuleProvidersTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configRuleProvidersCount', { count: parsedRuleProviders.length }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="prepareNewRuleProvider">{{ $t('configRuleProvidersNew') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRuleProvidersEmptyEditor') }}</div>
              <div v-else class="grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="font-semibold">{{ $t('configRuleProvidersListTitle') }}</div>
                    <span class="badge badge-outline">{{ filteredRuleProviders.length }} / {{ parsedRuleProviders.length }}</span>
                  </div>
                  <label class="input input-sm input-bordered flex items-center gap-2">
                    <span class="opacity-60">#</span>
                    <input v-model="ruleProviderListQuery" type="text" class="grow" :placeholder="$t('configRuleProvidersFilterPlaceholder')" />
                    <button v-if="ruleProviderListQuery" type="button" class="btn btn-ghost btn-xs" @click="clearRuleProviderFilter">×</button>
                  </label>
                  <div v-if="!parsedRuleProviders.length" class="mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRuleProvidersListEmpty') }}</div>
                  <div v-else-if="!filteredRuleProviders.length" class="mt-3 rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRuleProvidersFilteredEmpty') }}</div>
                  <div v-else class="mt-3 max-h-[32rem] space-y-2 overflow-auto pr-1">
                    <button v-for="item in filteredRuleProviders" :key="item.name" type="button" class="w-full rounded-lg border p-3 text-left transition" :class="ruleProviderSelectedName === item.name ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40'" @click="loadRuleProviderIntoForm(item.name)">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div class="font-semibold">{{ item.name }}</div>
                          <div class="mt-1 break-all text-[11px] opacity-70">{{ proxyProviderDisplayValue(item.url || item.path) }}</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="badge badge-outline">{{ item.behavior || '—' }}</span>
                          <span class="badge" :class="providerReferenceBadgeClass(item.references.length)">{{ $t('configRuleProvidersReferencesCount', { count: item.references.length }) }}</span>
                        </div>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span v-if="item.path" class="badge badge-ghost badge-sm">path: {{ item.path }}</span>
                        <span v-if="item.interval" class="badge badge-ghost badge-sm">interval: {{ item.interval }}</span>
                        <span v-if="item.format" class="badge badge-ghost badge-sm">format: {{ item.format }}</span>
                        <span v-if="item.type" class="badge badge-ghost badge-sm">{{ item.type }}</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="space-y-3 rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ selectedRuleProviderEntry ? $t('configRuleProvidersEditSelected') : $t('configRuleProvidersEditNew') }}</div>
                      <div class="opacity-70">{{ $t('configRuleProvidersEditTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-xs btn-ghost" @click="startRuleProviderCreationWizard">{{ $t('configWizardStart') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="prepareNewRuleProvider">{{ $t('configRuleProvidersResetForm') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="duplicateSelectedRuleProvider" :disabled="!selectedRuleProviderEntry">{{ $t('configRuleProvidersDuplicate') }}</button>
                      <button class="btn btn-xs" @click="saveRuleProviderToPayload" :disabled="!ruleProviderFormCanSave">{{ $t('configRuleProvidersSaveToEditor') }}</button>
                      <button class="btn btn-xs btn-warning" @click="disableSelectedRuleProvider" :disabled="!selectedRuleProviderEntry">{{ $t('configRuleProvidersDisable') }}</button>
                    </div>
                  </div>

                  <div v-if="ruleProviderCreationWizard.active" class="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold">{{ $t('configWizardTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configRuleProvidersWizardTip') }}</div>
                      </div>
                      <button class="btn btn-xs btn-ghost" @click="cancelRuleProviderCreationWizard">{{ $t('configWizardCancel') }}</button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span class="badge" :class="ruleProviderCreationWizard.step === 1 ? 'badge-primary' : 'badge-ghost'">1 · {{ $t('configWizardStepChooseTemplate') }}</span>
                      <span class="badge" :class="ruleProviderCreationWizard.step === 2 ? 'badge-primary' : 'badge-ghost'">2 · {{ $t('configWizardStepFillBasics') }}</span>
                      <span class="badge" :class="ruleProviderCreationWizard.step === 3 ? 'badge-primary' : 'badge-ghost'">3 · {{ $t('configWizardStepReview') }}</span>
                    </div>
                    <div v-if="ruleProviderCreationWizard.step === 1" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button v-for="template in ruleProviderCreationTemplates" :key="`rule-provider-wizard-template-${template.id}`" type="button" class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5" @click="selectRuleProviderCreationWizardTemplate(template.id)"><div class="font-semibold">{{ $t(template.labelKey) }}</div><div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div></button>
                    </div>
                    <div v-else-if="ruleProviderCreationWizard.step === 2" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldName') }}</span><input v-model="ruleProviderCreationWizard.name" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldBehavior') }}</span><select v-model="ruleProviderCreationWizard.behavior" class="select select-sm"><option value="classical">classical</option><option value="domain">domain</option><option value="ipcidr">ipcidr</option></select></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldUrl') }}</span><input v-model="ruleProviderCreationWizard.url" type="text" class="input input-sm" /></label>
                      <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldPath') }}</span><input v-model="ruleProviderCreationWizard.path" type="text" class="input input-sm" /></label>
                      <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldInterval') }}</span><input v-model="ruleProviderCreationWizard.interval" type="text" inputmode="numeric" class="input input-sm" /></label>
                    </div>
                    <div v-else class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryTemplate') }}</div><div class="mt-1 font-semibold">{{ $t(ruleProviderCreationTemplates.find((item) => item.id === ruleProviderCreationWizard.templateId)?.labelKey || 'configRuleProvidersTitle') }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryName') }}</div><div class="mt-1 font-semibold break-all">{{ ruleProviderCreationWizard.name || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryBehavior') }}</div><div class="mt-1 font-semibold">{{ ruleProviderCreationWizard.behavior || '—' }}</div></div>
                      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3"><div class="text-[11px] opacity-60">{{ $t('configWizardSummaryPath') }}</div><div class="mt-1 font-semibold break-all">{{ ruleProviderCreationWizard.path || '—' }}</div></div>
                    </div>
                    <div class="mt-3 flex flex-wrap justify-between gap-2">
                      <button class="btn btn-xs btn-ghost" @click="prevRuleProviderCreationWizardStep">{{ $t('configWizardBack') }}</button>
                      <button v-if="ruleProviderCreationWizard.step < 3" class="btn btn-xs" :disabled="ruleProviderCreationWizard.step === 1 && !ruleProviderCreationWizard.templateId" @click="nextRuleProviderCreationWizardStep">{{ $t('configWizardNext') }}</button>
                      <button v-else class="btn btn-xs" @click="finalizeRuleProviderCreationWizard">{{ $t('configWizardApplyToForm') }}</button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configTemplateCardsTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configRuleProvidersTemplatesTip') }}</div>
                    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="template in ruleProviderCreationTemplates"
                        :key="`rule-provider-template-${template.id}`"
                        type="button"
                        class="rounded-lg border border-base-content/10 bg-base-100/80 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        @click="applyRuleProviderCreationTemplate(template.id)"
                      >
                        <div class="font-semibold">{{ $t(template.labelKey) }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t(template.descKey) }}</div>
                      </button>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div class="font-semibold">{{ $t('configRuleProvidersBehaviorAwareTitle') }}</div>
                        <div class="mt-1 text-[11px] opacity-70">{{ $t('configRuleProvidersBehaviorAwareTip') }}</div>
                      </div>
                      <span class="badge" :class="ruleProviderBehaviorProfile.accent">{{ ruleProviderForm.behavior || '—' }}</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button
                        v-for="behavior in ruleProviderBehaviorPresets"
                        :key="`rule-provider-behavior-${behavior}`"
                        type="button"
                        class="badge badge-outline cursor-pointer"
                        :class="normalizedRuleProviderBehavior === behavior ? 'badge-primary' : ''"
                        @click="applyRuleProviderBehaviorPreset(behavior)"
                      >
                        {{ behavior }}
                      </button>
                    </div>
                    <div class="mt-3 rounded-lg border border-base-content/10 bg-base-200/50 p-3 text-[11px] opacity-80">
                      {{ ruleProviderBehaviorProfile.summary }}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2">
                      <div class="mb-3 font-semibold">{{ $t('configRuleProvidersSectionIdentity') }}</div>
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldName') }}</span><input v-model="ruleProviderForm.name" type="text" class="input input-sm" :placeholder="$t('configRuleProvidersFieldNamePlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldType') }}</span><select v-model="ruleProviderForm.type" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="http">http</option><option value="file">file</option><option value="inline">inline</option></select></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldBehavior') }}</span><select v-model="ruleProviderForm.behavior" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="classical">classical</option><option value="domain">domain</option><option value="ipcidr">ipcidr</option></select></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldFormat') }}</span><select v-model="ruleProviderForm.format" class="select select-sm"><option value="">{{ $t('configQuickEditorKeepEmpty') }}</option><option value="yaml">yaml</option><option value="text">text</option><option value="mrs">mrs</option></select></label>
                      </div>
                    </div>

                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 md:col-span-2">
                      <div class="mb-3 font-semibold">{{ $t('configRuleProvidersSectionSource') }}</div>
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label class="form-control md:col-span-2"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldUrl') }}</span><input v-model="ruleProviderForm.url" type="text" class="input input-sm" :placeholder="$t('configRuleProvidersFieldUrlPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldPath') }}</span><input v-model="ruleProviderForm.path" type="text" class="input input-sm" :placeholder="$t('configRuleProvidersFieldPathPlaceholder')" /></label>
                        <label class="form-control"><span class="label-text text-xs opacity-70">{{ $t('configRuleProvidersFieldInterval') }}</span><input v-model="ruleProviderForm.interval" type="text" inputmode="numeric" class="input input-sm" placeholder="86400" /></label>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                    <div class="font-semibold">{{ $t('configRuleProvidersExtraYamlTitle') }}</div>
                    <div class="mt-1 text-[11px] opacity-70">{{ $t('configRuleProvidersExtraYamlTip') }}</div>
                    <textarea v-model="ruleProviderForm.extraBody" class="mt-3 textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configRuleProvidersExtraYamlPlaceholder')"></textarea>
                  </div>

                  <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configRuleProvidersReferencesTitle') }}</div>
                      <div v-if="!selectedRuleProviderEntry" class="mt-2 opacity-70">{{ $t('configRuleProvidersReferencesSelect') }}</div>
                      <template v-else>
                        <div v-if="!selectedRuleProviderEntry.references.length" class="mt-2 opacity-70">{{ $t('configRuleProvidersReferencesEmpty') }}</div>
                        <div v-else class="mt-2 space-y-1">
                          <div v-for="refItem in selectedRuleProviderEntry.references.slice(0, 8)" :key="`rp-${refItem.lineNo}-${refItem.text}`" class="font-mono text-[11px] break-all">L{{ refItem.lineNo }} · {{ refItem.text }}</div>
                          <div v-if="selectedRuleProviderEntry.references.length > 8" class="opacity-60">+{{ selectedRuleProviderEntry.references.length - 8 }}</div>
                        </div>
                      </template>
                    </div>
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3">
                      <div class="font-semibold">{{ $t('configRuleProvidersDisableImpactTitle') }}</div>
                      <div class="mt-1 text-[11px] opacity-70">{{ $t('configRuleProvidersDisableImpactTip') }}</div>
                      <div v-if="!selectedRuleProviderEntry" class="mt-2 opacity-70">{{ $t('configRuleProvidersDisableImpactSelect') }}</div>
                      <template v-else>
                        <div class="mt-2 flex flex-wrap gap-2"><span class="badge badge-ghost">{{ $t('configRuleProvidersDisableImpactRules', { count: ruleProviderDisableImpact.rulesRemoved }) }}</span></div>
                        <div v-if="!ruleProviderDisableImpact.rulesRemoved" class="mt-2 opacity-70">{{ $t('configRuleProvidersDisableImpactEmpty') }}</div>
                        <div v-else class="mt-2 space-y-1"><div v-for="sample in ruleProviderDisableImpact.samples" :key="`rp-sample-${sample.lineNo}-${sample.text}`" class="font-mono text-[11px] break-all">L{{ sample.lineNo }} · {{ sample.text }}</div></div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-show="structuredEditorSection === 'rules'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configRulesTitle') }}</div>
                  <div class="opacity-70">{{ $t('configRulesTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configRulesCount', { count: parsedRules.length }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="prepareNewRule">{{ $t('configRulesNew') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRulesEmptyEditor') }}</div>
              <div v-else class="space-y-3">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <label class="input input-sm input-bordered flex min-w-[16rem] flex-1 items-center gap-2">
                      <span class="opacity-60">#</span>
                      <input v-model="ruleListQuery" type="text" class="grow" :placeholder="$t('configRulesFilterPlaceholder')" />
                    </label>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-outline">{{ filteredRules.length }} / {{ parsedRules.length }}</span>
                      <button v-if="ruleListQuery" class="btn btn-xs btn-ghost" @click="clearRuleFilter">×</button>
                    </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="item in topRuleTypeCounts"
                      :key="`rule-type-${item.type}`"
                      type="button"
                      class="badge badge-outline cursor-pointer"
                      :class="normalizedRuleListFilter === item.type ? 'badge-primary' : ''"
                      @click="filterRulesByType(item.type)"
                    >
                      {{ item.type }} · {{ item.count }}
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 xl:grid-cols-[22rem,minmax(0,1fr)]">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="mb-2 flex items-center justify-between gap-2"><div class="font-semibold">{{ $t('configRulesListTitle') }}</div><span class="badge badge-outline">{{ filteredRules.length }}</span></div>
                    <div v-if="!parsedRules.length" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRulesListEmpty') }}</div>
                    <div v-else-if="!filteredRules.length" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configRulesFilterEmpty') }}</div>
                    <div v-else class="max-h-[28rem] space-y-2 overflow-auto pr-1">
                      <button v-for="item in filteredRules" :key="`rule-${item.index}-${item.lineNo}`" type="button" class="w-full rounded-lg border p-3 text-left transition" :class="String(ruleSelectedIndex) === String(item.index) ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-100/70 hover:border-primary/40'" @click="loadRuleIntoForm(item.index)">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div class="font-semibold">L{{ item.lineNo }} · {{ item.type || '—' }}</div>
                            <div class="mt-1 break-all text-[11px] opacity-70">{{ item.raw }}</div>
                          </div>
                          <div class="flex flex-wrap gap-1">
                            <span v-if="item.provider" class="badge badge-outline">{{ item.provider }}</span>
                            <span v-if="item.target" class="badge badge-ghost">{{ item.target }}</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                  <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{{ selectedRuleEntry ? $t('configRulesEditSelected') : $t('configRulesEditNew') }}</div>
                      <div class="opacity-70">{{ $t('configRulesEditTip') }}</div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-xs btn-ghost" @click="prepareNewRule">{{ $t('configRulesResetForm') }}</button>
                      <button class="btn btn-xs btn-ghost" @click="duplicateSelectedRule" :disabled="!selectedRuleEntry">{{ $t('configRulesDuplicate') }}</button>
                      <button class="btn btn-xs" @click="saveRuleToPayload" :disabled="!ruleFormCanSave">{{ $t('configRulesSaveToEditor') }}</button>
                      <button class="btn btn-xs btn-warning" @click="disableSelectedRule" :disabled="!selectedRuleEntry">{{ $t('configRulesDisable') }}</button>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configRulesFieldType') }}</span>
                      <input
                        v-model="ruleForm.type"
                        type="text"
                        class="input input-sm"
                        list="mihomo-rule-types"
                        :placeholder="$t('configRulesFieldTypePlaceholder')"
                        @input="syncRuleRawFromStructuredForm"
                      />
                    </label>
                    <label class="form-control">
                      <span class="label-text text-xs opacity-70">{{ $t('configRulesFieldPayload') }}</span>
                      <input
                        v-model="ruleForm.payload"
                        type="text"
                        class="input input-sm"
                        list="mihomo-rule-payloads"
                        :placeholder="rulePayloadPlaceholder"
                        @input="syncRuleRawFromStructuredForm"
                      />
                      <div class="mt-2 flex flex-wrap gap-2" v-if="ruleQuickPayloads.length">
                        <button v-for="item in ruleQuickPayloads" :key="`rule-payload-chip-${item}`" type="button" class="badge badge-ghost" @click="setRulePayloadSuggestion(item)">{{ item }}</button>
                      </div>
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text text-xs opacity-70">{{ $t('configRulesFieldTarget') }}</span>
                      <input
                        v-model="ruleForm.target"
                        type="text"
                        class="input input-sm"
                        list="mihomo-rule-targets"
                        :placeholder="ruleTargetPlaceholder"
                        @input="syncRuleRawFromStructuredForm"
                      />
                      <div class="mt-2 flex flex-wrap gap-2" v-if="ruleQuickTargets.length">
                        <button v-for="item in ruleQuickTargets" :key="`rule-target-chip-${item}`" type="button" class="badge badge-ghost" @click="setRuleTargetSuggestion(item)">{{ item }}</button>
                      </div>
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text text-xs opacity-70">{{ $t('configRulesFieldParams') }}</span>
                      <textarea
                        v-model="ruleForm.paramsText"
                        class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]"
                        :placeholder="$t('configRulesFieldParamsPlaceholder')"
                        @input="syncRuleRawFromStructuredForm"
                      ></textarea>
                      <div class="mt-2 flex flex-wrap gap-2" v-if="ruleQuickParams.length">
                        <button v-for="item in ruleQuickParams" :key="`rule-param-chip-${item}`" type="button" class="badge badge-ghost" @click="appendRuleParamSuggestion(item)">{{ item }}</button>
                      </div>
                    </label>
                  </div>

                  <div class="mt-3">
                    <div class="mb-2 font-semibold">{{ $t('configRulesTemplatesTitle') }}</div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="btn btn-xs btn-ghost" @click="applyRuleTemplate('match-direct')">MATCH → DIRECT</button>
                      <button type="button" class="btn btn-xs btn-ghost" @click="applyRuleTemplate('rule-set')">RULE-SET</button>
                      <button type="button" class="btn btn-xs btn-ghost" @click="applyRuleTemplate('geoip-cn')">GEOIP CN</button>
                      <button type="button" class="btn btn-xs btn-ghost" @click="applyRuleTemplate('geosite-ads')">GEOSITE ads</button>
                      <button type="button" class="btn btn-xs btn-ghost" @click="applyRuleTemplate('domain-suffix')">DOMAIN-SUFFIX</button>
                    </div>
                  </div>

                  <datalist id="mihomo-rule-types">
                    <option value="MATCH"></option>
                    <option value="FINAL"></option>
                    <option value="RULE-SET"></option>
                    <option value="DOMAIN"></option>
                    <option value="DOMAIN-SUFFIX"></option>
                    <option value="DOMAIN-KEYWORD"></option>
                    <option value="GEOSITE"></option>
                    <option value="GEOIP"></option>
                    <option value="IP-CIDR"></option>
                    <option value="IP-CIDR6"></option>
                    <option value="SRC-IP-CIDR"></option>
                    <option value="SRC-PORT"></option>
                    <option value="DST-PORT"></option>
                    <option value="NETWORK"></option>
                    <option value="PROCESS-NAME"></option>
                    <option value="PROCESS-PATH"></option>
                  </datalist>
                  <datalist id="mihomo-rule-payloads">
                    <option v-for="item in rulePayloadSuggestions" :key="`rule-payload-${item}`" :value="item"></option>
                  </datalist>
                  <datalist id="mihomo-rule-targets">
                    <option v-for="item in ruleTargetSuggestions" :key="`rule-target-${item}`" :value="item"></option>
                  </datalist>

                  <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
                    <span class="badge badge-outline">{{ $t('configRulesStructuredMode') }}</span>
                    <span class="badge badge-ghost">{{ normalizedRuleType || '—' }}</span>
                    <span v-if="ruleForm.paramsText.trim().length" class="badge badge-ghost">{{ ruleFormParamsCount }}</span>
                    <button class="btn btn-xs btn-ghost" @click="syncRuleFormFromRawLine">{{ $t('configRulesParseRaw') }}</button>
                    <button class="btn btn-xs btn-ghost" @click="syncRuleRawFromStructuredForm">{{ $t('configRulesBuildRaw') }}</button>
                    <span class="opacity-70">{{ $t('configRulesStructuredTip') }}</span>
                  </div>

                  <div v-if="ruleFormHints.length" class="mt-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <div class="mb-2 font-semibold text-warning">{{ $t('configRulesHintsTitle') }}</div>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="hint in ruleFormHints" :key="hint" class="badge badge-warning badge-outline">{{ hint }}</span>
                    </div>
                  </div>

                  <label class="form-control mt-3">
                    <span class="label-text text-xs opacity-70">{{ $t('configRulesRawField') }}</span>
                    <textarea v-model="ruleForm.raw" class="textarea textarea-sm h-32 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" wrap="off" :placeholder="$t('configRulesRawPlaceholder')"></textarea>
                  </label>
                  <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2"><div class="opacity-60">{{ $t('configRulesPreviewType') }}</div><div class="mt-1 break-all">{{ ruleForm.type || '—' }}</div></div>
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2"><div class="opacity-60">{{ $t('configRulesPreviewPayload') }}</div><div class="mt-1 break-all">{{ ruleForm.payload || '—' }}</div></div>
                    <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-2"><div class="opacity-60">{{ $t('configRulesPreviewTarget') }}</div><div class="mt-1 break-all">{{ ruleForm.target || '—' }}</div></div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div v-show="structuredEditorSection === 'dns'" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configDnsStructuredTitle') }}</div>
                  <div class="opacity-70">{{ $t('configDnsStructuredTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-ghost">{{ $t('configDnsStructuredCount', { count: dnsStructuredSummary.totalItems }) }}</span>
                  <button class="btn btn-xs btn-ghost" @click="syncDnsEditorFromPayload">{{ $t('configDnsStructuredReadFromEditor') }}</button>
                  <button class="btn btn-xs" @click="applyDnsEditorToPayload" :disabled="!dnsEditorCanApply">{{ $t('configDnsStructuredApplyToEditor') }}</button>
                </div>
              </div>

              <div v-if="!quickEditorHasPayload" class="rounded-lg border border-dashed border-base-content/15 bg-base-100/50 p-3 opacity-70">{{ $t('configDnsStructuredEmptyEditor') }}</div>
              <div v-else class="space-y-3">
                <div class="flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                  <span class="badge badge-outline">dns</span>
                  <span>{{ $t('configDnsStructuredScopeTip') }}</span>
                </div>

                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configDnsStructuredResolversTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredDefaultNameserver') }}</span>
                        <textarea v-model="dnsEditorForm.defaultNameserverText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredDefaultNameserverPlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredNameserver') }}</span>
                        <textarea v-model="dnsEditorForm.nameserverText" class="textarea textarea-sm h-28 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredNameserverPlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallback') }}</span>
                        <textarea v-model="dnsEditorForm.fallbackText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredFallbackPlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredProxyNameserver') }}</span>
                        <textarea v-model="dnsEditorForm.proxyServerNameserverText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredProxyNameserverPlaceholder')"></textarea>
                      </label>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configDnsStructuredPolicyTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredNameserverPolicy') }}</span>
                        <textarea v-model="dnsEditorForm.nameserverPolicyText" class="textarea textarea-sm h-28 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredNameserverPolicyPlaceholder')"></textarea>
                      </label>

                      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallbackGeoip') }}</span>
                          <select v-model="dnsEditorForm.fallbackFilterGeoip" class="select select-sm">
                            <option value="">{{ $t('configQuickEditorKeepEmpty') }}</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                        <label class="form-control">
                          <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallbackGeoipCode') }}</span>
                          <input v-model="dnsEditorForm.fallbackFilterGeoipCode" type="text" class="input input-sm" :placeholder="$t('configDnsStructuredFallbackGeoipCodePlaceholder')" />
                        </label>
                      </div>

                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallbackGeosite') }}</span>
                        <textarea v-model="dnsEditorForm.fallbackFilterGeositeText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredFallbackGeositePlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallbackIpcidr') }}</span>
                        <textarea v-model="dnsEditorForm.fallbackFilterIpcidrText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredFallbackIpcidrPlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFallbackDomain') }}</span>
                        <textarea v-model="dnsEditorForm.fallbackFilterDomainText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredFallbackDomainPlaceholder')"></textarea>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configDnsStructuredFiltersTitle') }}</div>
                    <div class="mt-2 grid grid-cols-1 gap-2">
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredFakeIpFilter') }}</span>
                        <textarea v-model="dnsEditorForm.fakeIpFilterText" class="textarea textarea-sm h-24 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredFakeIpFilterPlaceholder')"></textarea>
                      </label>
                      <label class="form-control">
                        <span class="label-text text-xs opacity-70">{{ $t('configDnsStructuredDnsHijack') }}</span>
                        <textarea v-model="dnsEditorForm.dnsHijackText" class="textarea textarea-sm h-20 w-full resize-y whitespace-pre font-mono leading-5 [tab-size:2]" :placeholder="$t('configDnsStructuredDnsHijackPlaceholder')"></textarea>
                      </label>
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-3">
                    <div class="font-semibold">{{ $t('configDnsStructuredSummaryTitle') }}</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryDefaultNameserver', { count: dnsStructuredSummary.defaultNameserver }) }}</span>
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryNameserver', { count: dnsStructuredSummary.nameserver }) }}</span>
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryFallback', { count: dnsStructuredSummary.fallback }) }}</span>
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryFakeIpFilter', { count: dnsStructuredSummary.fakeIpFilter }) }}</span>
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryDnsHijack', { count: dnsStructuredSummary.dnsHijack }) }}</span>
                      <span class="badge badge-ghost">{{ $t('configDnsStructuredSummaryPolicy', { count: dnsStructuredSummary.nameserverPolicy }) }}</span>
                    </div>
                    <div class="mt-3 text-[11px] opacity-70">{{ $t('configDnsStructuredPolicyFormatTip') }}</div>
                  </div>
                </div>
              </div>
            </div>


            </section>

            <section v-show="configWorkspaceSection === 'diagnostics'" class="space-y-3">
              <div v-if="lastAction" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configDiagnosticsTitle') }}</div>
                  <div class="opacity-70">{{ $t('configDiagnosticsTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge" :class="lastAction.ok ? 'badge-success' : 'badge-error'">{{ lastAction.ok ? $t('configDiagStatusOk') : $t('configDiagStatusFailed') }}</span>
                  <span class="badge badge-outline">{{ actionTypeText(lastAction.kind) }}</span>
                  <span v-if="hasText(lastAction.phase)" class="badge badge-ghost">{{ phaseText(lastAction.phase) }}</span>
                  <span v-if="hasText(lastAction.recovery) && lastAction.recovery !== 'none'" class="badge badge-warning badge-outline">{{ recoveryText(lastAction.recovery) }}</span>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagAction') }}</div>
                  <div class="mt-1">{{ actionTypeText(lastAction.kind) }}</div>
                </div>
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagPhase') }}</div>
                  <div class="mt-1">{{ phaseText(lastAction.phase) }}</div>
                </div>
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagSource') }}</div>
                  <div class="mt-1">{{ sourceText(lastAction.source) }}</div>
                </div>
                <div v-if="hasText(lastAction.validateCmd)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagValidateCommand') }}</div>
                  <div class="mt-1 break-all font-mono text-[11px]">{{ lastAction.validateCmd }}</div>
                </div>
                <div v-if="lastAction.exitCode !== null && lastAction.exitCode !== undefined && lastAction.exitCode !== ''" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagExitCode') }}</div>
                  <div class="mt-1">{{ String(lastAction.exitCode) }}</div>
                </div>
                <div v-if="hasText(lastAction.restartMethod)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagRestartMethod') }}</div>
                  <div class="mt-1">{{ lastAction.restartMethod }}</div>
                </div>
                <div v-if="hasText(lastAction.recovery)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagRecovery') }}</div>
                  <div class="mt-1">{{ recoveryText(lastAction.recovery) }}</div>
                </div>
                <div v-if="hasText(lastAction.restored)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagRestored') }}</div>
                  <div class="mt-1">{{ recoveryText(lastAction.restored) }}</div>
                </div>
                <div v-if="hasText(lastAction.updatedAt)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('updatedAt') }}</div>
                  <div class="mt-1">{{ fmtTextTs(lastAction.updatedAt) }}</div>
                </div>
                <div class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="opacity-60">{{ $t('configDiagCapturedAt') }}</div>
                  <div class="mt-1">{{ fmtTextTs(lastAction.at) }}</div>
                </div>
              </div>

              <div class="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-3">
                <div v-if="hasText(lastAction.error)" class="rounded-lg border border-warning/20 bg-warning/5 p-2">
                  <div class="font-semibold text-warning">{{ $t('configDiagError') }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.error }}</pre>
                </div>
                <div v-if="hasText(lastAction.output)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="font-semibold">{{ $t('configDiagOutput') }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.output }}</pre>
                </div>
                <div v-if="hasText(lastAction.restartOutput)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="font-semibold">{{ $t('configDiagRestartOutput') }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.restartOutput }}</pre>
                </div>
                <div v-if="hasText(lastAction.firstRestartOutput)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="font-semibold">{{ $t('configDiagFirstRestartOutput') }}</div>
                  <div v-if="hasText(lastAction.firstRestartMethod)" class="mt-1 opacity-60">{{ $t('configDiagRestartMethod') }}: {{ lastAction.firstRestartMethod }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.firstRestartOutput }}</pre>
                </div>
                <div v-if="hasText(lastAction.rollbackRestartOutput)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="font-semibold">{{ $t('configDiagRollbackOutput') }}</div>
                  <div v-if="hasText(lastAction.rollbackRestartMethod)" class="mt-1 opacity-60">{{ $t('configDiagRestartMethod') }}: {{ lastAction.rollbackRestartMethod }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.rollbackRestartOutput }}</pre>
                </div>
                <div v-if="hasText(lastAction.baselineRestartOutput)" class="rounded-lg border border-base-content/10 bg-base-100/60 p-2">
                  <div class="font-semibold">{{ $t('configDiagBaselineOutput') }}</div>
                  <div v-if="hasText(lastAction.baselineRestartMethod)" class="mt-1 opacity-60">{{ $t('configDiagRestartMethod') }}: {{ lastAction.baselineRestartMethod }}</div>
                  <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">{{ lastAction.baselineRestartOutput }}</pre>
                </div>
              </div>
            </div>

              <div v-else class="rounded-box border border-dashed border-base-content/15 bg-base-100/50 p-3 text-xs opacity-70">
                {{ $t('configDiagnosticsEmpty') }}
              </div>
            </section>

            <section v-show="configWorkspaceSection === 'compare'" class="space-y-3">
            <div v-if="managedMode" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ $t('configDiffTitle') }}</div>
                  <div class="opacity-70">{{ $t('configDiffTip') }}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <label class="label cursor-pointer gap-2 py-0">
                    <span class="label-text text-xs">{{ $t('configDiffOnlyChanges') }}</span>
                    <input v-model="compareChangesOnly" type="checkbox" class="toggle toggle-sm" />
                  </label>
                  <button class="btn btn-xs btn-ghost" @click="swapDiffSources">{{ $t('configSwapCompareSides') }}</button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
                <label class="form-control gap-1">
                  <span class="label-text text-[11px] opacity-70">{{ $t('configCompareLeft') }}</span>
                  <select v-model="compareLeft" class="select select-sm">
                    <option v-for="option in diffSourceOptions" :key="`left-${option.value}`" :value="option.value" :disabled="option.disabled">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <div class="hidden justify-center pb-2 text-lg opacity-40 lg:flex">⇄</div>

                <label class="form-control gap-1">
                  <span class="label-text text-[11px] opacity-70">{{ $t('configCompareRight') }}</span>
                  <select v-model="compareRight" class="select select-sm">
                    <option v-for="option in diffSourceOptions" :key="`right-${option.value}`" :value="option.value" :disabled="option.disabled">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="badge badge-ghost">{{ $t('configDiffRowsCount', { count: diffRows.length }) }}</span>
                <span class="badge badge-success badge-outline">{{ $t('configDiffAddedCount', { count: diffSummary.added }) }}</span>
                <span class="badge badge-error badge-outline">{{ $t('configDiffRemovedCount', { count: diffSummary.removed }) }}</span>
                <span class="badge badge-ghost">{{ $t('configDiffContextCount', { count: diffSummary.context }) }}</span>
              </div>

              <div v-if="!diffRowsVisible.length" class="mt-2 opacity-60">
                {{ diffHasChanges ? $t('configDiffHiddenByFilter') : $t('configDiffNoChanges') }}
              </div>

              <div v-else class="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-base-content/10 bg-base-100/60">
                <table class="table table-xs w-full font-mono">
                  <thead class="sticky top-0 z-10 bg-base-100/95 text-[10px] uppercase tracking-[0.08em] opacity-70">
                    <tr>
                      <th class="w-12 text-right">#</th>
                      <th>{{ diffSourceLabel(compareLeftResolved) }}</th>
                      <th class="w-12 text-right">#</th>
                      <th>{{ diffSourceLabel(compareRightResolved) }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, index) in diffRowsVisible"
                      :key="`${row.type}-${row.leftNo ?? 'n'}-${row.rightNo ?? 'n'}-${index}`"
                      :class="row.type === 'add' ? 'bg-success/10' : row.type === 'remove' ? 'bg-error/10' : ''"
                    >
                      <td class="w-12 select-none text-right align-top opacity-50">{{ row.leftNo ?? '' }}</td>
                      <td class="whitespace-pre-wrap break-all align-top">{{ row.leftText }}</td>
                      <td class="w-12 select-none text-right align-top opacity-50">{{ row.rightNo ?? '' }}</td>
                      <td class="whitespace-pre-wrap break-all align-top">{{ row.rightText }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            </section>

            <section v-show="configWorkspaceSection === 'history'" class="space-y-3">
            <div v-if="managedMode" class="rounded-box border border-base-content/10 bg-base-200/40 p-3 text-xs">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold">{{ $t('configHistoryTitle') }}</div>
                <button class="btn btn-xs btn-ghost" @click="loadHistory" :disabled="historyBusy">{{ $t('refresh') }}</button>
              </div>
              <div v-if="!historyItems.length" class="opacity-60">{{ $t('configHistoryEmpty') }}</div>
              <div v-else class="space-y-2">
                <div
                  v-for="item in historyItems"
                  :key="`${item.rev}-${item.current ? 'current' : 'old'}`"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2"
                >
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono">rev {{ item.rev }}</span>
                      <span v-if="item.current" class="badge badge-primary badge-xs">{{ $t('current') }}</span>
                      <span v-if="item.source" class="badge badge-ghost badge-xs">{{ sourceText(item.source) }}</span>
                    </div>
                    <div class="mt-1 opacity-70">{{ fmtTextTs(item.updatedAt) }}</div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <button class="btn btn-ghost btn-xs" @click="loadHistoryRev(item.rev)">{{ $t('configLoadIntoEditor') }}</button>
                    <button v-if="!item.current" class="btn btn-ghost btn-xs" @click="restoreHistoryRev(item.rev)">{{ $t('configRestoreRevision') }}</button>
                  </div>
                </div>
              </div>
            </div>

            </section>

            <div v-show="configWorkspaceSection === 'editor'" class="text-xs opacity-60">
              {{ managedMode ? $t('configManagedFallbackNote') : $t('mihomoConfigLoadNote') }}
            </div>
          </div>
        </div>
      </div>

      <div class="text-xs opacity-60" v-if="!expanded">
        {{ $t('configCollapsedTip') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
</script>
