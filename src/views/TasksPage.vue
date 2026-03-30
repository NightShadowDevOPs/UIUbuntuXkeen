<template>
  <div class="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('quickActions') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-sm" @click="applyEnforcement" :disabled="busy">
          {{ $t('applyEnforcementNow') }}
        </button>
        <button type="button" class="btn btn-sm" @click="refreshSsl" :disabled="busy || !agentEnabled">
          {{ $t('refreshProvidersSsl') }}
        </button>
      </div>

      <div class="text-xs opacity-70">
        <div>• {{ $t('applyEnforcementTip') }}</div>
        <div>• {{ $t('refreshProvidersSslTip') }}</div>
      </div>

      <div class="mt-2 rounded-lg border border-base-content/10 bg-base-200/40 p-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-semibold opacity-80">{{ $t('routerUiUrlTitle') }}</div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-xs btn-ghost" @click="copyRouterUiUrl(false)">
              {{ $t('copy') }}
            </button>
            <button type="button" class="btn btn-xs btn-ghost" @click="copyRouterUiUrl(true)">
              {{ $t('copyYamlLine') }}
            </button>
          </div>
        </div>
        <div class="mt-1 text-[11px] opacity-60">{{ $t('routerUiUrlTip') }}</div>
        <div class="mt-1 break-all font-mono text-xs opacity-80">{{ routerUiUrl }}</div>
      </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="flex min-w-0 items-center gap-2 text-left" @click="toggleProvidersPanelExpanded">
          <ChevronDownIcon class="h-4 w-4 opacity-70 transition-transform" :class="providersPanelExpanded ? 'rotate-180' : ''" />
          <div class="truncate font-semibold">{{ $t('providersPanelTitle') }}</div>
        </button>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="refreshProvidersPanel(true)"
            :disabled="providersPanelBusy || panelSslProbeLoading || providerSslCacheRefreshBusy || !agentEnabled"
          >
            {{ $t('refresh') }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="refreshProviderSslCacheNow"
            :disabled="providersPanelBusy || panelSslProbeLoading || providerSslCacheRefreshBusy || !agentEnabled"
          >
            <span v-if="providerSslCacheRefreshBusy" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ $t('refreshProviderSslCache') }}</span>
          </button>
        </div>
      </div>

      <div v-show="providersPanelExpanded">
        <div class="text-xs opacity-70">{{ $t('providersPanelTip') }}</div>

        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="opacity-70">{{ $t('sslWarnThreshold') }}:</span>
          <input
            type="number"
            min="0"
            max="365"
            class="input input-bordered input-xs w-20"
            v-model.number="sslNearExpiryDaysDefault"
          />
          <span class="opacity-60">{{ $t('daysShort') }}</span>
        </div>
        <div class="text-[11px] opacity-60">{{ $t('sslWarnThresholdTip') }}</div>

        <div v-if="!agentEnabled" class="text-sm opacity-70">
          {{ $t('agentDisabled') }}
        </div>
        <div v-else-if="providersPanelBusy" class="text-sm opacity-70">…</div>
		  <div v-else>
			<div v-if="providersPanelError" class="text-xs text-error" :title="providersPanelError">{{ friendlyProviderPanelError(providersPanelError, 'providers') }}</div>
			<div v-else>
			  <div v-if="panelSslProbeError" class="mb-2 text-xs text-warning" :title="panelSslProbeError">{{ friendlyProviderPanelError(panelSslProbeError, 'ssl') }}</div>
			  <div v-if="providerSslCacheStatusText" class="mb-2 text-xs" :class="providerSslCacheStatusClass" :title="$t('providerSslRefreshingTip')">{{ providerSslCacheStatusText }}</div>
			  <div v-if="!providersPanelRenderList.length" class="text-sm opacity-70">—</div>
			  <div v-else>
				<div class="mt-1 text-[11px] opacity-60">
				  <div>{{ $t('providersPanelColumnsExplain') }}</div>
				  <div class="mt-0.5">{{ $t('sslSource') }} • {{ $t('checkedAt') }}: {{ fmtTs(providersPanelAt) }}</div>
				</div>
				
				<div class="mt-2 overflow-x-auto">
				  <table class="table table-zebra table-sm">
					<thead>
					  <tr>
						<th class="w-[160px]">{{ $t('provider') }}</th>
						<th>{{ $t('panelUrl') }}</th>
						<th class="w-[140px]">{{ $t('sslWarnDays') }}</th>
						<th class="w-[190px]">{{ $t('sslExpires') }}</th>
					  </tr>
					</thead>
					<tbody>
					  <tr v-for="p in providersPanelRenderList" :key="p.name">
						<td class="font-mono text-xs">
              <div class="flex items-center gap-2">
								<button
                      type="button"
                      class="btn btn-ghost btn-xs h-7 w-10 shrink-0 px-0"
                      @click.stop="(e) => openProviderIconPicker(e, p.name)"
                      :title="$t('providerIcon')"
                    >
                      <ProviderIconBadge :icon="getProviderIconRaw(p.name)" />
                    </button>
                    <select
                      class="select select-bordered select-xs w-24"
                      :value="getProviderIconRaw(p.name)"
                      @change="(e) => setProviderIcon(p.name, ((e.target as HTMLSelectElement)?.value || ''))"
                      :title="$t('providerIcon')"
                    >
                      <option value="">—</option>
                      <option value="globe">🌐 globe</option>
                      <option v-for="cc in providerIconCountries" :key="`sel-${p.name}-${cc}`" :value="cc">{{ fmtProviderIcon(cc) }}</option>
                    </select>

                <span class="min-w-0 truncate" :title="p.name">{{ p.name }}</span>
                <TopologyActionButtons :stage="'P'" :value="p.name" :grouped="true" />
              </div>
            </td>
						<td>
						  <div class="flex items-center gap-2">
							<input
							  type="text"
							  class="input input-bordered input-xs flex-1 min-w-[220px]"
							  :placeholder="$t('providerPanelUrlPlaceholder')"
							  :value="proxyProviderPanelUrlMap[p.name] || ''"
							  @input="(e) => setProviderPanelUrl(p.name, (e && e.target && e.target.value) || '')"
							/>
							<a
							  v-if="proxyProviderPanelUrlMap[p.name]"
							  class="btn btn-ghost btn-xs"
							  :href="proxyProviderPanelUrlMap[p.name]"
							  target="_blank"
							  rel="noreferrer"
							>
							  {{ $t('open') }}
							</a>
						  </div>
						</td>
						<td>
						  <div class="flex items-center gap-2">
							<input
							  type="number"
							  min="0"
							  max="365"
							  class="input input-bordered input-xs w-20"
							  :placeholder="String(sslNearExpiryDaysDefault)"
							  :value="getProviderSslWarnOverride(p.name) === null ? '' : String(getProviderSslWarnOverride(p.name))"
							  @input="(e) => setProviderSslWarnOverride(p.name, (e && e.target && e.target.value) || '')"
							/>
							<button type="button" class="btn btn-ghost btn-xs" @click="clearProviderSslWarnOverride(p.name)">
							  {{ $t('clear') }}
							</button>
						  </div>
						  <div class="mt-0.5 text-[10px] opacity-60">{{ $t('sslWarnDaysHint', { d: sslNearExpiryDaysDefault }) }}</div>
						</td>
						<td>
						  <span
							class="text-[11px] font-mono"
                            :class="sslPanelInfo(p.name, getPanelNotAfter(p.name) || p.panelSslNotAfter || p.sslNotAfter, Boolean(getPanelNotAfter(p.name) || p.panelSslNotAfter)).cls"
                            :title="sslPanelInfo(p.name, getPanelNotAfter(p.name) || p.panelSslNotAfter || p.sslNotAfter, Boolean(getPanelNotAfter(p.name) || p.panelSslNotAfter)).title"
						  >
                            {{ sslPanelInfo(p.name, getPanelNotAfter(p.name) || p.panelSslNotAfter || p.sslNotAfter, Boolean(getPanelNotAfter(p.name) || p.panelSslNotAfter)).text }}
						  </span>
						</td>
					  </tr>
					</tbody>
				  </table>
				</div>

          <!-- Provider icon picker (teleported to body to avoid clipping in overflow containers) -->
          <Teleport to="body">
            <div v-if="providerIconPickerOpen" class="fixed inset-0 z-[9999]" @mousedown.self="closeProviderIconPicker">
              <div
                ref="providerIconPickerRoot"
                class="absolute w-[min(18rem,calc(100vw-16px))] rounded-box bg-base-200 p-2 shadow ring-1 ring-base-300"
                :style="providerIconPickerStyle"
                @mousedown.stop
              >
                <div class="text-[11px] opacity-70">{{ $t('providerIconTip') }}</div>
                <input
                  type="text"
                  class="input input-bordered input-xs mt-2 w-full"
                  v-model="providerIconSearch"
                  :placeholder="$t('search') + ' (RU/US/DE...)'"
                  @keydown.stop
                />
                <div class="mt-2 max-h-64 overflow-auto pr-1 flex flex-wrap gap-1">
                  <button type="button" class="btn btn-ghost btn-xs px-2" @click.stop="() => pickProviderIconFromPicker('')">
                    <ProviderIconBadge icon="" />
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs px-2" @click.stop="() => pickProviderIconFromPicker('globe')">
                    <ProviderIconBadge icon="globe" />
                  </button>
                  <button
                    v-for="cc in providerIconCountries"
                    :key="cc"
                    type="button"
                    class="btn btn-ghost btn-xs px-2"
                    @click.stop="() => pickProviderIconFromPicker(cc)"
                    :title="cc"
                  >
                    <ProviderIconBadge :icon="cc" />
                  </button>
                </div>
              </div>
            </div>
          </Teleport>
			</div>
		  </div>
      </div>
    </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="flex min-w-0 items-center gap-2 text-left" @click="toggleProviderTrafficDebugExpanded">
          <ChevronDownIcon class="h-4 w-4 opacity-70 transition-transform" :class="providerTrafficDebugExpanded ? 'rotate-180' : ''" />
          <div class="truncate font-semibold">{{ $t('providerTrafficDebugTitle') }}</div>
        </button>
        <div v-if="providerTrafficDebugSelectedName" class="text-xs opacity-70">
          {{ $t('connections') }}: {{ providerTrafficDebugSummary.total }}
          · {{ $t('activeConnections') }}: {{ providerTrafficDebugSummary.active }}
          · {{ $t('closedConnections') }}: {{ providerTrafficDebugSummary.closed }}
        </div>
      </div>

      <div v-show="providerTrafficDebugExpanded">
        <div class="text-xs opacity-70">{{ $t('providerTrafficDebugTip') }}</div>
        <div class="mt-2 rounded-lg border border-base-content/10 bg-base-200/45 p-2 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="opacity-60">{{ $t('providerTrafficSyncStatus') }}:</span>
              <span class="badge badge-xs" :class="providerTrafficSyncBadgeClass">{{ providerTrafficSyncBadgeText }}</span>
              <span v-if="providerTrafficSyncState.rev > 0" class="badge badge-ghost badge-xs">rev {{ providerTrafficSyncState.rev }}</span>
              <span v-if="providerTrafficSyncState.remoteUpdatedAt" class="badge badge-ghost badge-xs">remote {{ providerTrafficSyncState.remoteUpdatedAt }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-ghost btn-xs" @click="refreshProviderTrafficSync" :disabled="!agentEnabled">{{ $t('refresh') }}</button>
              <button type="button" class="btn btn-ghost btn-xs" @click="flushProviderTrafficSync" :disabled="!agentEnabled || !providerTrafficSyncState.dirty">{{ $t('providerTrafficSyncFlush') }}</button>
            </div>
          </div>
          <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 opacity-70">
            <span><span class="opacity-60">{{ $t('providerTrafficSyncLastPull') }}:</span> {{ fmtTs(providerTrafficSyncState.lastPullAt) }}</span>
            <span><span class="opacity-60">{{ $t('providerTrafficSyncLastPush') }}:</span> {{ fmtTs(providerTrafficSyncState.lastPushAt) }}</span>
            <span v-if="providerTrafficSyncState.dirty" class="text-warning">{{ $t('providerTrafficSyncDirty') }}</span>
          </div>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <select class="select select-bordered select-sm min-w-56" v-model="providerTrafficDebugProvider">
            <option value="">{{ $t('providerTrafficDebugSelectProvider') }}</option>
            <option v-for="name in providerTrafficDebugProviderNames" :key="`ptd-${name}`" :value="name">{{ name }}</option>
          </select>
          <label class="label cursor-pointer gap-2 py-0">
            <span class="label-text text-xs">{{ $t('providerTrafficDebugIncludeClosed') }}</span>
            <input class="checkbox checkbox-xs" type="checkbox" v-model="providerTrafficDebugIncludeClosed" />
          </label>
          <div class="flex items-center gap-2 text-xs">
            <span>{{ $t('providerTrafficDebugLimit') }}</span>
            <input type="number" min="10" max="200" class="input input-bordered input-xs w-20" v-model.number="providerTrafficDebugLimit" />
          </div>
        </div>

        <div v-if="providerTrafficDebugSelectedName" class="mt-2 rounded-lg border border-base-content/10 bg-base-200/55 p-2 text-xs">
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <span><span class="opacity-60">{{ $t('proxies') }}:</span> {{ providerTrafficDebugProxyNames.length }}</span>
            <span><span class="opacity-60">{{ $t('connections') }}:</span> {{ providerTrafficDebugSummary.total }}</span>
            <span><span class="opacity-60">providerCandidates:</span> {{ providerTrafficDebugSummary.byProvider }}</span>
            <span><span class="opacity-60">proxyCandidates:</span> {{ providerTrafficDebugSummary.byProxy }}</span>
          </div>
          <div class="mt-1 break-all opacity-70">{{ providerTrafficDebugProxyNames.join(' • ') || '—' }}</div>
        </div>

        <div v-if="!providerTrafficDebugSelectedName" class="mt-3 text-sm opacity-70">{{ $t('providerTrafficDebugSelectProvider') }}</div>
        <div v-else-if="!providerTrafficDebugRows.length" class="mt-3 rounded-lg border border-base-content/10 bg-base-200/40 p-3 text-sm opacity-70">
          {{ $t('providerTrafficDebugNoRows') }}
        </div>
        <div v-else class="mt-3 space-y-2">
          <div v-for="row in providerTrafficDebugRows" :key="row.key" class="rounded-lg border border-base-content/10 bg-base-200/55 p-2 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-xs" :class="row.source === 'active' ? 'badge-success' : 'badge-ghost'">{{ row.source === 'active' ? $t('activeConnections') : $t('closedConnections') }}</span>
              <span class="badge badge-xs" :class="row.matchedBy === 'provider' ? 'badge-info' : 'badge-warning'">{{ row.matchedBy === 'provider' ? $t('providerTrafficDebugMatchedByProvider') : $t('providerTrafficDebugMatchedByProxy') }}</span>
              <span class="font-mono">{{ row.id }}</span>
              <span class="opacity-70">{{ row.startLabel }}</span>
              <span class="truncate opacity-70" :title="row.hostLabel">{{ row.hostLabel }}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span><span class="opacity-60">proxy:</span> <span class="font-mono">{{ row.matchedProxy || '—' }}</span></span>
              <span><span class="opacity-60">dl:</span> {{ prettyBytesHelper(row.download, { binary: true }) }}</span>
              <span><span class="opacity-60">ul:</span> {{ prettyBytesHelper(row.upload, { binary: true }) }}</span>
              <span><span class="opacity-60">total:</span> {{ prettyBytesHelper(row.totalBytes, { binary: true }) }}</span>
              <span v-if="row.speed > 0"><span class="opacity-60">speed:</span> {{ prettyBytesHelper(row.speed, { binary: true }) }}/s</span>
            </div>
            <div class="mt-1 grid gap-1 text-[11px] opacity-75 sm:grid-cols-2">
              <div><span class="opacity-60">providerCandidates:</span> <span class="font-mono break-all">{{ row.providerCandidatesLabel }}</span></div>
              <div><span class="opacity-60">proxyCandidates:</span> <span class="font-mono break-all">{{ row.proxyCandidatesLabel }}</span></div>
              <div><span class="opacity-60">chains:</span> <span class="font-mono break-all">{{ row.chainsLabel }}</span></div>
              <div><span class="opacity-60">providerChains:</span> <span class="font-mono break-all">{{ row.providerChainsLabel }}</span></div>
              <div><span class="opacity-60">specialProxy:</span> <span class="font-mono break-all">{{ row.specialProxy || '—' }}</span></div>
              <div><span class="opacity-60">providerName:</span> <span class="font-mono break-all">{{ row.providerNameField || '—' }}</span></div>
              <div class="sm:col-span-2"><span class="opacity-60">rule:</span> <span class="font-mono break-all">{{ row.ruleLabel }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('liveLogs') }}</div>
        <div class="flex items-center gap-2">
          <select class="select select-bordered select-sm" v-model="logSource">
            <option value="mihomo">{{ $t('mihomoLog') }}</option>
            <option value="config">{{ $t('mihomoConfig') }}</option>
            <option value="agent">{{ $t('agentLog') }}</option>
          </select>
          <select class="select select-bordered select-sm" v-model.number="logLines">
            <option :value="50">50</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
            <option :value="1000">1000</option>
          </select>
          <button type="button" class="btn btn-sm" @click="forceRefreshLogs" :disabled="logsBusy || !agentEnabled">
            {{ $t('refresh') }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs opacity-70">
        <div>
          <span class="opacity-60">{{ $t('path') }}:</span>
          <span class="font-mono">{{ logPath || '—' }}</span>
        </div>
        <label class="flex items-center gap-2">
          <span>{{ $t('autoRefresh') }}</span>
          <input type="checkbox" class="toggle toggle-sm" v-model="logsAuto" />
        </label>
      </div>

      <div v-if="!agentEnabled" class="text-sm opacity-70">
        {{ $t('agentDisabled') }}
      </div>
      <div v-else class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
        <pre class="max-h-[48vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4">{{ logText || '—' }}</pre>
      </div>
    </div>


    <div class="card gap-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('dataFreshness') }}</div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm" @click="updateGeoNow" :disabled="geoUpdateBusy || !agentEnabled">
            {{ $t('updateGeoNow') }}
          </button>
          <button type="button" class="btn btn-sm" @click="updateRuleProvidersNow" :disabled="providersUpdateBusy">
            {{ $t('updateRuleProvidersNow') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="rescanLocalRules" :disabled="rulesRescanBusy || !agentEnabled">
            {{ $t('rescanLocalRules') }}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="refreshFreshness" :disabled="freshnessBusy">
            {{ $t('refresh') }}
          </button>
        </div>
      </div>

      <div class="text-xs opacity-70">
        <span class="opacity-60">{{ $t('lastUiRefresh') }}:</span>
        <span class="ml-1 font-mono">{{ fmtTs(lastFreshnessOkAt) }}</span>
      </div>

      <details v-if="lastGeoUpdate?.ranAt" class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
        <summary class="cursor-pointer text-xs font-semibold opacity-80">
          {{ $t('lastGeoUpdateResult') }}
          <span class="ml-2 font-mono opacity-70" :title="$t('dataTimestamp')">
            {{ lastGeoUpdate.dataAtSec ? fmtMtime(lastGeoUpdate.dataAtSec) : fmtTs(lastGeoUpdate.ranAt) }}
          </span>
          <span v-if="lastGeoUpdate.ok" class="ml-2 badge badge-success badge-xs">OK</span>
          <span v-else class="ml-2 badge badge-error badge-xs">ERR</span>
        </summary>

        <div class="mt-2 flex flex-col gap-1 text-xs">
          <div v-for="it in (lastGeoUpdate.items || [])" :key="it.kind + ':' + it.path" class="flex flex-col gap-1 rounded-md border border-base-content/10 bg-base-100/40 p-2">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="font-semibold opacity-80">{{ geoKindLabel(it.kind) }}</span>
                <span class="ml-2 font-mono opacity-70" :title="it.path">{{ shortPath(it.path) }}</span>
                <span v-if="it.changed" class="ml-2 badge badge-info badge-xs">{{ $t('changed') }}</span>
              </div>
              <div class="shrink-0 font-mono opacity-80">{{ fmtMtime(it.mtimeSec) }}</div>
            </div>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70">
              <div v-if="it.method">
                <span class="opacity-60">{{ $t('method') }}:</span>
                <span class="ml-1 font-mono">{{ it.method }}</span>
              </div>
              <div v-if="typeof it.sizeBytes === 'number' && it.sizeBytes >= 0">
                <span class="opacity-60">{{ $t('size') }}:</span>
                <span class="ml-1 font-mono">{{ prettyBytesHelper(it.sizeBytes) }}</span>
              </div>
              <div v-if="it.source" class="min-w-0">
                <span class="opacity-60">{{ $t('source') }}:</span>
                <span class="ml-1 truncate font-mono" :title="it.source">{{ it.source }}</span>
              </div>
            </div>

            <div v-if="it.ok === false || it.error" class="text-error">
              {{ it.error || 'failed' }}
            </div>
          </div>

          <div class="mt-1 text-[11px] opacity-60">
            {{ $t('runTimestamp') }}: <span class="font-mono">{{ fmtTs(lastGeoUpdate.ranAt) }}</span>
          </div>
          <div v-if="lastGeoUpdate.note" class="mt-1 text-[11px] opacity-60">
            {{ lastGeoUpdate.note }}
          </div>
          <div class="text-[11px] opacity-60">
            {{ $t('geoRestartTip') }}
          </div>
        </div>
      </details>

      <details v-if="lastRuleProvidersUpdate?.ranAt" class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
        <summary class="cursor-pointer text-xs font-semibold opacity-80">
          {{ $t('lastRuleProvidersUpdateResult') }}
          <span class="ml-2 font-mono opacity-70" :title="$t('dataTimestamp')">
            {{ lastRuleProvidersUpdate.dataAt ? fmtUpdatedAt(lastRuleProvidersUpdate.dataAt) : fmtTs(lastRuleProvidersUpdate.ranAt) }}
          </span>
          <span v-if="lastRuleProvidersUpdate.ok" class="ml-2 badge badge-success badge-xs">OK</span>
          <span v-else class="ml-2 badge badge-error badge-xs">ERR</span>
        </summary>

        <div class="mt-2 flex flex-col gap-2 text-xs">
          <div class="text-[11px] opacity-60">
            {{ $t('runTimestamp') }}: <span class="font-mono">{{ fmtTs(lastRuleProvidersUpdate.ranAt) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70">
            <div>
              <span class="opacity-60">{{ $t('total') }}:</span>
              <span class="ml-1 font-mono">{{ lastRuleProvidersUpdate.total }}</span>
            </div>
            <div>
              <span class="opacity-60">OK:</span>
              <span class="ml-1 font-mono">{{ lastRuleProvidersUpdate.okCount }}</span>
            </div>
            <div>
              <span class="opacity-60">ERR:</span>
              <span class="ml-1 font-mono">{{ lastRuleProvidersUpdate.failCount }}</span>
            </div>
          </div>

          <div v-for="it in (lastRuleProvidersUpdate.items || [])" :key="it.name" class="flex flex-col gap-1 rounded-md border border-base-content/10 bg-base-100/40 p-2">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="min-w-0 truncate font-mono" :title="it.name">{{ it.name }}</span>
                <span v-if="it.changed" class="ml-2 badge badge-info badge-xs">{{ $t('changed') }}</span>
                <span v-if="it.ok" class="ml-2 badge badge-success badge-xs">OK</span>
                <span v-else class="ml-2 badge badge-error badge-xs">ERR</span>
              </div>
              <div class="shrink-0 font-mono opacity-70">{{ it.durationMs != null ? fmtMs(it.durationMs) : '—' }}</div>
            </div>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70">
              <div>
                <span class="opacity-60">{{ $t('before') }}:</span>
                <span class="ml-1 font-mono">{{ fmtUpdatedAt(it.beforeUpdatedAt) }}</span>
              </div>
              <div>
                <span class="opacity-60">{{ $t('after') }}:</span>
                <span class="ml-1 font-mono">{{ fmtUpdatedAt(it.afterUpdatedAt) }}</span>
              </div>
            </div>

            <div v-if="it.error" class="text-error">{{ it.error }}</div>
          </div>
        </div>
      </details>

      <div class="grid gap-2 md:grid-cols-2">
        <div class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="mb-1 text-sm font-semibold">{{ $t('geoFiles') }}</div>
          <div v-if="!agentEnabled" class="text-sm opacity-70">
            {{ $t('agentDisabled') }}
          </div>
          <div v-else-if="geoBusy" class="text-sm opacity-70">…</div>
          <div v-else>
            <div v-if="geoError" class="text-xs text-error">{{ geoError }}</div>
            <div v-else-if="!geoItems.length" class="text-sm opacity-70">—</div>
            <div v-else class="flex flex-col gap-1">
              <div v-for="g in geoItems" :key="g.kind + ':' + g.path" class="flex items-center justify-between gap-2 text-xs">
                <div class="min-w-0">
                  <span class="opacity-70">{{ geoKindLabel(g.kind) }}:</span>
                  <span class="ml-1 font-mono opacity-70" :title="g.path">{{ shortPath(g.path) }}</span>
                  <span v-if="typeof g.sizeBytes === 'number' && g.sizeBytes >= 0" class="ml-2 opacity-60">({{ prettyBytesHelper(g.sizeBytes) }})</span>
                </div>
                <div class="shrink-0 font-mono opacity-80">{{ fmtMtime(g.mtimeSec) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="mb-1 text-sm font-semibold">{{ $t('filterPoliciesFiles') }}</div>
          <div v-if="providersBusy" class="text-sm opacity-70">…</div>
          <div v-else>
            <div v-if="providersError" class="text-xs text-error">{{ providersError }}</div>
            <div v-else-if="!ruleProviders.length" class="text-sm opacity-70">—</div>
            <div v-else class="flex flex-col gap-1 text-xs">
              <div>
                <span class="opacity-70">{{ $t('ruleProvidersCount') }}:</span>
                <span class="ml-1 font-mono">{{ ruleProviders.length }}</span>
              </div>
              <div>
                <span class="opacity-70">{{ $t('newestUpdate') }}:</span>
                <span class="ml-1 font-mono">{{ fmtUpdatedAt(newestProviderAt) }}</span>
              </div>
              <div>
                <span class="opacity-70">{{ $t('oldestUpdate') }}:</span>
                <span class="ml-1 font-mono">{{ fmtUpdatedAt(oldestProviderAt) }}</span>
              </div>
              <details class="mt-1">
                <summary class="cursor-pointer opacity-80">{{ $t('showList') }}</summary>
                <div class="mt-2 flex flex-col gap-1">
                  <div v-for="p in sortedProviders" :key="p.name" class="flex items-center justify-between gap-2">
                    <span class="min-w-0 truncate font-mono" :title="p.name">{{ p.name }}</span>
                    <span class="shrink-0 font-mono opacity-70">{{ fmtUpdatedAt(p.updatedAt) }}</span>
                  </div>
                </div>
              </details>

              <div class="mt-2 border-t border-base-content/10 pt-2">
                <div class="mb-1 text-xs font-semibold opacity-80">{{ $t('topRulesTitle') }}</div>
                <div v-if="!topHitRules.length" class="text-sm opacity-70">—</div>
                <details v-else class="mt-1">
                  <summary class="cursor-pointer opacity-80">{{ $t('showList') }}</summary>
                  <div class="mt-2 flex flex-col gap-1">
                    <div v-for="r in topHitRules" :key="r.key" class="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        class="link min-w-0 truncate text-left font-mono"
                        :title="$t('openInTopology')"
                        @click="openTopologyWithRule(r.ruleText, 'none')"
                      >
                        {{ r.ruleText }}
                      </button>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="font-mono opacity-70">{{ r.hits }}</span>
                        <TopologyActionButtons :stage="'R'" :value="r.ruleText" :grouped="true" />
                      </div>
                    </div>
                  </div>
                </details>
                <div class="mt-1 text-[11px] opacity-60">{{ $t('topRulesTip') }}</div>
              </div>
            </div>

            <div v-if="agentEnabled" class="mt-2 border-t border-base-content/10 pt-2">
              <div class="mb-1 text-xs font-semibold opacity-80">{{ $t('localRulesDir') }}</div>
              <div v-if="rulesBusy" class="text-sm opacity-70">…</div>
              <div v-else>
                <div v-if="rulesError" class="text-xs text-error">{{ rulesError }}</div>
                <div v-else-if="!rulesDir" class="text-sm opacity-70">—</div>
                <div v-else class="flex flex-col gap-1 text-xs">
                  <div>
                    <span class="opacity-70">{{ $t('path') }}:</span>
                    <span class="ml-1 font-mono" :title="rulesDir">{{ shortPath(rulesDir) }}</span>
                  </div>
                  <div>
                    <span class="opacity-70">{{ $t('filesCount') }}:</span>
                    <span class="ml-1 font-mono">{{ rulesCount }}</span>
                  </div>
                  <div>
                    <span class="opacity-70">{{ $t('newestUpdate') }}:</span>
                    <span class="ml-1 font-mono">{{ fmtMtime(rulesNewest) }}</span>
                  </div>
                  <div>
                    <span class="opacity-70">{{ $t('oldestUpdate') }}:</span>
                    <span class="ml-1 font-mono">{{ fmtMtime(rulesOldest) }}</span>
                  </div>

                  <details v-if="rulesItems.length" class="mt-1">
                    <summary class="cursor-pointer opacity-80">{{ $t('showList') }}</summary>
                    <div class="mt-2 flex flex-col gap-1">
                      <div v-for="f in rulesItems" :key="f.path" class="flex items-center justify-between gap-2">
                        <span class="min-w-0 truncate font-mono" :title="f.path">{{ f.name || shortPath(f.path) }}</span>
                        <span class="shrink-0 font-mono opacity-70">{{ fmtMtime(f.mtimeSec) }}</span>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="text-[11px] opacity-60">
        {{ $t('dataFreshnessTip') }}
      </div>
    </div>


    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('diagnostics') }}</div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-sm" @click="downloadDiagnostics" :disabled="diagBusy">
          {{ $t('downloadReport') }}
        </button>
        <button type="button" class="btn btn-sm btn-ghost" @click="copyDiagnostics" :disabled="diagBusy">
          {{ $t('copy') }}
        </button>
      </div>

      <div class="text-xs opacity-70">
        {{ $t('diagnosticsTip') }}
      </div>
    </div>


    <div class="card gap-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('upstreamTracking') }}</div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-sm btn-ghost" @click="checkUpstream" :disabled="upstreamBusy">
            {{ $t('refresh') }}
          </button>
          <button type="button" class="btn btn-sm" @click="markUpstreamReviewed" :disabled="!upstreamLatest.releaseTag && !upstreamLatest.commitSha">
            {{ $t('markReviewed') }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs opacity-70">
        <div>
          <span class="opacity-60">{{ $t('repo') }}:</span>
          <a class="link ml-1 font-mono" :href="upstreamRepoUrl" target="_blank" rel="noreferrer">{{ upstreamRepo }}</a>
        </div>
        <span v-if="upstreamHasNew" class="badge badge-warning badge-xs">{{ $t('new') }}</span>
        <div class="ml-auto">
          <span class="opacity-60">{{ $t('lastChecked') }}:</span>
          <span class="ml-1 font-mono">{{ fmtTs(upstreamCheckedAt) }}</span>
        </div>
      </div>

      <div v-if="upstreamError" class="text-xs text-error">{{ upstreamError }}</div>

      <div v-else class="grid gap-2 md:grid-cols-2">
        <div class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="mb-1 text-sm font-semibold">{{ $t('latestRelease') }}</div>
          <div class="flex flex-col gap-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="opacity-70">{{ $t('tag') }}:</span>
                <a
                  v-if="upstreamLatest.releaseUrl"
                  class="link ml-1 font-mono"
                  :href="upstreamLatest.releaseUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ upstreamLatest.releaseTag || '—' }}
                </a>
                <span v-else class="ml-1 font-mono">{{ upstreamLatest.releaseTag || '—' }}</span>
              </div>
              <div class="shrink-0 font-mono opacity-80">{{ fmtIso(upstreamLatest.releasePublishedAt) }}</div>
            </div>

            <div v-if="upstreamCompareReleaseUrl" class="opacity-70">
              <a class="link" :href="upstreamCompareReleaseUrl" target="_blank" rel="noreferrer">
                {{ $t('compareSinceLastReview') }}
              </a>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="mb-1 text-sm font-semibold">{{ $t('latestCommit') }}</div>
          <div class="flex flex-col gap-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <span class="opacity-70">SHA:</span>
                <a
                  v-if="upstreamLatest.commitUrl"
                  class="link ml-1 font-mono"
                  :href="upstreamLatest.commitUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ shortSha(upstreamLatest.commitSha) || '—' }}
                </a>
                <span v-else class="ml-1 font-mono">{{ shortSha(upstreamLatest.commitSha) || '—' }}</span>
              </div>
              <div class="shrink-0 font-mono opacity-80">{{ fmtIso(upstreamLatest.commitDate) }}</div>
            </div>
            <div v-if="upstreamLatest.commitMessage" class="max-h-[32px] overflow-hidden break-words opacity-80" :title="upstreamLatest.commitMessage">
              {{ upstreamLatest.commitMessage }}
            </div>
            <div v-if="upstreamCompareCommitUrl" class="opacity-70">
              <a class="link" :href="upstreamCompareCommitUrl" target="_blank" rel="noreferrer">
                {{ $t('compareCommits') }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="text-[11px] opacity-60">
        {{ $t('upstreamTrackingTip') }}
      </div>
    </div>


    <div class="card gap-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('usersDbSyncTitle') }}</div>
        <span class="badge badge-sm" :class="usersDbBadge.cls">{{ usersDbBadge.text }}</span>
      </div>

      <div class="text-sm opacity-80">
        {{ $t('usersDbSyncDesc') }}
      </div>

      <div class="text-xs opacity-70">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div><span class="opacity-60">rev:</span> <span class="font-mono">{{ usersDbRemoteRev }}</span></div>
          <div class="min-w-0"><span class="opacity-60">{{ $t('updated') }}:</span> <span class="font-mono">{{ usersDbRemoteUpdatedAt || '—' }}</span></div>
          <div v-if="agentEnabled && (agentStatusLite.version || agentStatusLite.serverVersion)" class="min-w-0">
            <span class="opacity-60">{{ $t('agentVersion') }}:</span>
            <span class="font-mono ml-1">{{ agentStatusLite.version || '—' }}</span>
            <template v-if="agentStatusLite.serverVersion">
              <span class="opacity-60 ml-2">{{ $t('agentServerVersion') }}:</span>
              <span class="font-mono ml-1">{{ agentStatusLite.serverVersion }}</span>
            </template>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
          <div><span class="opacity-60">{{ $t('lastPull') }}:</span> <span class="font-mono">{{ usersDbLastPullAt ? fmtTs(usersDbLastPullAt) : '—' }}</span></div>
          <div><span class="opacity-60">{{ $t('lastPush') }}:</span> <span class="font-mono">{{ usersDbLastPushAt ? fmtTs(usersDbLastPushAt) : '—' }}</span></div>
          <div><span class="opacity-60">{{ $t('conflicts') }}:</span> <span class="font-mono">{{ usersDbConflictCount || 0 }}</span></div>
          <div v-if="usersDbLocalDirty"><span class="badge badge-warning badge-xs">{{ $t('pendingChanges') }}</span></div>
        </div>
      </div>

      <div v-if="usersDbLastError" class="text-xs text-error">{{ usersDbLastError }}</div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-sm" @click="usersDbPullNow" :disabled="!usersDbSyncEnabled || !agentEnabled || usersDbBusy">
          {{ $t('pull') }}
        </button>
        <button type="button" class="btn btn-sm" @click="usersDbPushNow" :disabled="!usersDbSyncEnabled || !agentEnabled || usersDbBusy || usersDbHasConflict">
          {{ $t('push') }}
        </button>
      </div>

      <div v-if="usersDbHasConflict && usersDbConflictDiff && usersDbConflictSummary" class="rounded-lg border border-error/30 bg-error/5 p-2 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold text-error">{{ $t('usersDbConflictTitle') }}</div>
          <span class="badge badge-error badge-sm">{{ $t('conflict') }}</span>
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 opacity-80">
          <div>
            <span class="opacity-60">{{ $t('usersDbLabels') }}:</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.labelsLocalOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.labelsRemoteOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.labelsChanged }}</span>
          </div>
          <div>
            <span class="opacity-60">{{ $t('usersDbPanels') }}:</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.urlsLocalOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.urlsRemoteOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.urlsChanged }}</span>
          </div>
          <div>
            <span class="opacity-60">{{ $t('providerIcon') }}:</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.iconsLocalOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.iconsRemoteOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.iconsChanged }}</span>
          </div>
          <div>
            <span class="opacity-60">{{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}:</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.tunnelsLocalOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.tunnelsRemoteOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.tunnelsChanged }}</span>
          </div>
          <div>
            <span class="opacity-60">SSL:</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.sslDefaultChanged + usersDbConflictSummary.warnDaysChanged }}</span>
          </div>
          <div>
            <span class="opacity-60">{{ $t('usersDbUserLimits') }}:</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.userLimitsLocalOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">+{{ usersDbConflictSummary.userLimitsRemoteOnly }}</span>
            <span class="opacity-60 ml-1">/</span>
            <span class="font-mono ml-1">~{{ usersDbConflictSummary.userLimitsChanged }}</span>
          </div>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-xs" @click="usersDbResolveMerge" :disabled="usersDbBusy">
            {{ $t('usersDbMergeAndPush') }}
          </button>
          <button type="button" class="btn btn-xs" @click="usersDbResolvePull" :disabled="usersDbBusy">
            {{ $t('usersDbAcceptRouter') }}
          </button>
          <button type="button" class="btn btn-xs" @click="usersDbResolvePush" :disabled="usersDbBusy">
            {{ $t('usersDbAcceptLocal') }}
          </button>
          <button type="button" class="btn btn-xs btn-ghost" @click="usersDbSmartOpen = !usersDbSmartOpen" :disabled="usersDbBusy">
            {{ $t('usersDbSmartMerge') }}
          </button>
          <button type="button" class="btn btn-xs btn-ghost" @click="copyUsersDbConflictPreview" :disabled="usersDbBusy || !usersDbConflictPreviewText">
            {{ $t('copy') }} {{ $t('usersDbConflictPreview') }}
          </button>
          <button type="button" class="btn btn-xs btn-ghost" @click="exportUsersDbConflictPreview" :disabled="usersDbBusy || !usersDbConflictPreviewText">
            {{ $t('export') }} JSON
          </button>
        </div>
        <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbConflictPreviewHint') }}</div>

        <div v-if="usersDbLabelChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('usersDbLabels') }} — {{ $t('usersDbWinner') }}</div>
            <span class="badge badge-warning badge-xs">{{ usersDbLabelChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbWinnerHint') }}</div>
          <div class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 220px">key</th>
                  <th style="width: 260px">{{ $t('router') }}</th>
                  <th style="width: 260px">{{ $t('local') }}</th>
                  <th style="width: 280px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbLabelChangedRows" :key="row.key">
                  <td class="font-mono">{{ row.key }}</td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <div class="max-w-[260px] truncate" :title="row.remote">{{ row.remote || '—' }}</div>
                      <div class="text-[10px] opacity-60">{{ $t('agentRestoreScope') }}: {{ row.remoteScopeText }}</div>
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <div class="max-w-[260px] truncate" :title="row.local">{{ row.local || '—' }}</div>
                      <div class="text-[10px] opacity-60">{{ $t('agentRestoreScope') }}: {{ row.localScopeText }}</div>
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                        <span class="font-mono break-all" :title="row.resultSummary">{{ row.resultLabel || '—' }}</span>
                      </div>
                      <div class="text-[10px] opacity-60">{{ $t('agentRestoreScope') }}: {{ row.resultScopeText }}</div>
                      <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbUserLimitChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('usersDbUserLimits') }} — {{ $t('usersDbWinner') }}</div>
            <span class="badge badge-warning badge-xs">{{ usersDbUserLimitChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbUserLimitsHint') }}</div>
          <div class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 220px">user</th>
                  <th style="width: 280px">{{ $t('router') }}</th>
                  <th style="width: 280px">{{ $t('local') }}</th>
                  <th style="width: 320px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbUserLimitChangedRows" :key="row.user">
                  <td class="font-mono">{{ row.user }}</td>
                  <td class="max-w-[280px] truncate" :title="row.remote">{{ row.remote }}</td>
                  <td class="max-w-[280px] truncate" :title="row.local">{{ row.local }}</td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                        <span class="font-mono break-all" :title="row.result">{{ row.result }}</span>
                      </div>
                      <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbTunnelChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('usersDbTunnelConflictDiagnostics') }}</div>
            <span class="badge badge-warning badge-xs">{{ usersDbTunnelChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbTunnelConflictDiagnosticsHint') }}</div>
          <div class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 160px">iface</th>
                  <th style="width: 260px">{{ $t('router') }}</th>
                  <th style="width: 260px">{{ $t('local') }}</th>
                  <th style="width: 240px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbTunnelChangedRows" :key="row.name">
                  <td class="font-mono">{{ row.name }}</td>
                  <td class="max-w-[260px] truncate" :title="row.remote">{{ row.remote }}</td>
                  <td class="max-w-[260px] truncate" :title="row.local">{{ row.local }}</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                      <span class="font-mono" :title="row.result">{{ row.result }}</span>
                    </div>
                    <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbUrlChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('usersDbPanels') }} — {{ $t('usersDbWinner') }}</div>
            <span class="badge badge-warning badge-xs">{{ usersDbUrlChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbWinnerHint') }}</div>
          <div class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 180px">{{ $t('provider') }}</th>
                  <th style="width: 320px">{{ $t('router') }}</th>
                  <th style="width: 320px">{{ $t('local') }}</th>
                  <th style="width: 280px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbUrlChangedRows" :key="row.provider">
                  <td class="font-mono">{{ row.provider }}</td>
                  <td class="max-w-[320px] truncate" :title="row.remote">{{ row.remote }}</td>
                  <td class="max-w-[320px] truncate" :title="row.local">{{ row.local }}</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                      <span class="font-mono break-all" :title="row.result || '—'">{{ row.result || '—' }}</span>
                    </div>
                    <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbIconChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('providerIcon') }} — {{ $t('usersDbWinner') }}</div>
            <span class="badge badge-warning badge-xs">{{ usersDbIconChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbWinnerHint') }}</div>
          <div class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 180px">{{ $t('provider') }}</th>
                  <th style="width: 180px">{{ $t('router') }}</th>
                  <th style="width: 180px">{{ $t('local') }}</th>
                  <th style="width: 240px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbIconChangedRows" :key="row.provider">
                  <td class="font-mono">{{ row.provider }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <ProviderIconBadge :icon="row.remote" />
                      <span class="font-mono">{{ fmtProviderIcon(row.remote) }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <ProviderIconBadge :icon="row.local" />
                      <span class="font-mono">{{ fmtProviderIcon(row.local) }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                        <div class="flex items-center gap-2">
                          <ProviderIconBadge :icon="row.result" />
                          <span class="font-mono">{{ fmtProviderIcon(row.result) }}</span>
                        </div>
                      </div>
                      <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbSslDefaultRow || usersDbWarnDaysChangedRows.length" class="mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">SSL — {{ $t('usersDbWinner') }}</div>
            <span class="badge badge-warning badge-xs">{{ (usersDbSslDefaultRow ? 1 : 0) + usersDbWarnDaysChangedRows.length }}</span>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbWinnerHint') }}</div>

          <div v-if="usersDbSslDefaultRow" class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 180px">{{ $t('fieldName') }}</th>
                  <th style="width: 120px">{{ $t('router') }}</th>
                  <th style="width: 120px">{{ $t('local') }}</th>
                  <th style="width: 220px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ $t('sslWarnThreshold') }}</td>
                  <td class="font-mono">{{ usersDbSslDefaultRow.remote }}</td>
                  <td class="font-mono">{{ usersDbSslDefaultRow.local }}</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-outline badge-xs">{{ usersDbSslDefaultRow.modeLabel }}</span>
                      <span class="font-mono">{{ usersDbSslDefaultRow.result }}</span>
                    </div>
                    <div class="text-[10px] opacity-60">{{ usersDbSslDefaultRow.reason }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="usersDbWarnDaysChangedRows.length" class="mt-2 overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th style="width: 180px">{{ $t('provider') }}</th>
                  <th style="width: 120px">{{ $t('router') }}</th>
                  <th style="width: 120px">{{ $t('local') }}</th>
                  <th style="width: 220px">{{ $t('usersDbWinner') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in usersDbWarnDaysChangedRows" :key="row.provider">
                  <td class="font-mono">{{ row.provider }}</td>
                  <td class="font-mono">{{ row.remote }}</td>
                  <td class="font-mono">{{ row.local }}</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span>
                      <span class="font-mono">{{ row.result }}</span>
                    </div>
                    <div class="text-[10px] opacity-60">{{ row.reason }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="usersDbSmartOpen" class="mt-2 rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold">{{ $t('usersDbSmartMergeTitle') }}</div>
            <button type="button" class="btn btn-xs btn-ghost" @click="usersDbSmartOpen = false" :disabled="usersDbBusy">✕</button>
          </div>
          <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbSmartMergeDesc') }}</div>

          <div class="mt-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-xs font-semibold">{{ $t('usersDbApplyPreviewTitle') }}</div>
              <div class="flex flex-wrap items-center gap-2 text-[11px]">
                <span class="badge badge-outline badge-xs">{{ $t('usersDbChanged') }}: {{ usersDbSmartPreviewStats.changedRows }}</span>
                <span class="badge badge-outline badge-xs">{{ $t('usersDbPreviewSections') }}: {{ usersDbSmartPreviewStats.changedSections }}</span>
                <span class="badge badge-outline badge-xs">{{ $t('usersDbLocalOnly') }}: {{ usersDbSmartPreviewStats.localOnlyRows }}</span>
                <span class="badge badge-outline badge-xs">{{ $t('usersDbRouterOnly') }}: {{ usersDbSmartPreviewStats.routerOnlyRows }}</span>
              </div>
            </div>
            <div class="mt-1 text-[11px] opacity-70">{{ $t('usersDbApplyPreviewHint') }}</div>
            <div v-if="usersDbSmartPreviewRows.length" class="mt-2 overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th style="width: 140px">{{ $t('fieldName') }}</th>
                    <th style="width: 220px">{{ $t('provider') }} / key</th>
                    <th style="width: 120px">{{ $t('usersDbWinner') }}</th>
                    <th style="width: 260px">{{ $t('usersDbWinner') }}</th>
                    <th>{{ $t('usersDbReason') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in usersDbSmartPreviewRows" :key="`${row.section}-${row.key}`">
                    <td>{{ row.sectionLabel }}</td>
                    <td class="font-mono break-all">{{ row.key }}</td>
                    <td><span class="badge badge-outline badge-xs">{{ row.modeLabel }}</span></td>
                    <td class="font-mono break-all">{{ row.resultText }}</td>
                    <td class="text-[11px] opacity-70">{{ row.reason }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="mt-2 text-[11px] opacity-60">{{ $t('usersDbPreviewNoChanges') }}</div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-xs" @click="usersDbSmartApply" :disabled="usersDbBusy">
                {{ $t('usersDbSmartMergeAndPush') }}
              </button>
            </div>
          </div>

          <div class="mt-2 space-y-4">
            <div v-if="usersDbConflictDiff.labels.changed.length">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-xs">{{ $t('usersDbLabels') }}: {{ $t('usersDbChanged') }} ({{ usersDbConflictDiff.labels.changed.length }})</div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('labels','local')" :disabled="usersDbBusy">{{ $t('usersDbSetAllLocal') }}</button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('labels','remote')" :disabled="usersDbBusy">{{ $t('usersDbSetAllRouter') }}</button>
                </div>
              </div>

              <div class="mt-1 overflow-x-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th style="width: 220px">key</th>
                      <th style="width: 260px">{{ $t('router') }}</th>
                      <th style="width: 260px">{{ $t('local') }}</th>
                      <th>{{ $t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="it in usersDbConflictDiff.labels.changed" :key="it.key">
                      <td class="font-mono">{{ it.key }}</td>
                      <td>
                        <div class="flex flex-col gap-1">
                          <div class="max-w-[260px] truncate" :title="it.remote.label">{{ it.remote.label || '—' }}</div>
                          <div class="text-[10px] opacity-60">{{ $t('agentRestoreScope') }}: {{ usersDbFormatScopeText(it.remote.scope) }}</div>
                        </div>
                      </td>
                      <td>
                        <div class="flex flex-col gap-1">
                          <div class="max-w-[260px] truncate" :title="it.local.label">{{ it.local.label || '—' }}</div>
                          <div class="text-[10px] opacity-60">{{ $t('agentRestoreScope') }}: {{ usersDbFormatScopeText(it.local.scope) }}</div>
                        </div>
                      </td>
                      <td class="min-w-[260px]">
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-l-${it.key}`" value="remote" v-model="usersDbSmartChoices.labels[it.key].mode" />
                            <span class="text-[11px]">{{ $t('router') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-l-${it.key}`" value="local" v-model="usersDbSmartChoices.labels[it.key].mode" />
                            <span class="text-[11px]">{{ $t('local') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-l-${it.key}`" value="custom" v-model="usersDbSmartChoices.labels[it.key].mode" />
                            <span class="text-[11px]">{{ $t('custom') }}</span>
                          </label>
                        </div>
                        <input
                          v-if="usersDbSmartChoices.labels[it.key].mode === 'custom'"
                          type="text"
                          class="input input-bordered input-xs mt-1 w-full"
                          v-model="usersDbSmartChoices.labels[it.key].customLabel"
                          :placeholder="it.local.label"
                        />
                        <div v-if="usersDbSmartChoices.labels[it.key].mode === 'custom'" class="mt-1 text-[10px] opacity-60">
                          {{ $t('agentRestoreScope') }}: {{ usersDbFormatScopeText(it.local.scope) }} · {{ $t('local') }}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.urls.changed.length">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-xs">{{ $t('usersDbPanels') }}: {{ $t('usersDbChanged') }} ({{ usersDbConflictDiff.urls.changed.length }})</div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('urls','local')" :disabled="usersDbBusy">{{ $t('usersDbSetAllLocal') }}</button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('urls','remote')" :disabled="usersDbBusy">{{ $t('usersDbSetAllRouter') }}</button>
                </div>
              </div>

              <div class="mt-1 overflow-x-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th style="width: 200px">{{ $t('provider') }}</th>
                      <th style="width: 320px">{{ $t('router') }}</th>
                      <th style="width: 320px">{{ $t('local') }}</th>
                      <th>{{ $t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="it in usersDbConflictDiff.urls.changed" :key="it.provider">
                      <td class="font-mono">{{ it.provider }}</td>
                      <td class="max-w-[320px] truncate">{{ it.remote }}</td>
                      <td class="max-w-[320px] truncate">{{ it.local }}</td>
                      <td class="min-w-[260px]">
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-u-${it.provider}`" value="remote" v-model="usersDbSmartChoices.urls[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('router') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-u-${it.provider}`" value="local" v-model="usersDbSmartChoices.urls[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('local') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-u-${it.provider}`" value="custom" v-model="usersDbSmartChoices.urls[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('custom') }}</span>
                          </label>
                        </div>
                        <input
                          v-if="usersDbSmartChoices.urls[it.provider].mode === 'custom'"
                          type="text"
                          class="input input-bordered input-xs mt-1 w-full"
                          v-model="usersDbSmartChoices.urls[it.provider].customUrl"
                          :placeholder="it.local"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.tunnels.changed.length">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-xs">{{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}: {{ $t('usersDbChanged') }} ({{ usersDbConflictDiff.tunnels.changed.length }})</div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('tunnels','local')" :disabled="usersDbBusy">{{ $t('usersDbSetAllLocal') }}</button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('tunnels','remote')" :disabled="usersDbBusy">{{ $t('usersDbSetAllRouter') }}</button>
                </div>
              </div>

              <div class="mt-1 overflow-x-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th style="width: 160px">iface</th>
                      <th style="width: 260px">{{ $t('router') }}</th>
                      <th style="width: 260px">{{ $t('local') }}</th>
                      <th>{{ $t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="it in usersDbConflictDiff.tunnels.changed" :key="it.name">
                      <td class="font-mono">{{ it.name }}</td>
                      <td class="max-w-[260px] truncate" :title="it.remote">{{ it.remote }}</td>
                      <td class="max-w-[260px] truncate" :title="it.local">{{ it.local }}</td>
                      <td class="min-w-[260px]">
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-t-${it.name}`" value="remote" v-model="usersDbSmartChoices.tunnels[it.name].mode" />
                            <span class="text-[11px]">{{ $t('router') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-t-${it.name}`" value="local" v-model="usersDbSmartChoices.tunnels[it.name].mode" />
                            <span class="text-[11px]">{{ $t('local') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-t-${it.name}`" value="custom" v-model="usersDbSmartChoices.tunnels[it.name].mode" />
                            <span class="text-[11px]">{{ $t('custom') }}</span>
                          </label>
                        </div>
                        <input
                          v-if="usersDbSmartChoices.tunnels[it.name].mode === 'custom'"
                          type="text"
                          class="input input-bordered input-xs mt-1 w-full"
                          v-model="usersDbSmartChoices.tunnels[it.name].customDescription"
                          :placeholder="it.local"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="(usersDbConflictDiff as any).icons && (usersDbConflictDiff as any).icons.changed && (usersDbConflictDiff as any).icons.changed.length">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-xs">{{ $t('providerIcon') }}: {{ $t('usersDbChanged') }} ({{ (usersDbConflictDiff as any).icons.changed.length }})</div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('icons','local')" :disabled="usersDbBusy">{{ $t('usersDbSetAllLocal') }}</button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('icons','remote')" :disabled="usersDbBusy">{{ $t('usersDbSetAllRouter') }}</button>
                </div>
              </div>

              <div class="mt-1 overflow-x-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th style="width: 200px">{{ $t('provider') }}</th>
                      <th style="width: 220px">{{ $t('router') }}</th>
                      <th style="width: 220px">{{ $t('local') }}</th>
                      <th>{{ $t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="it in (usersDbConflictDiff as any).icons.changed" :key="it.provider">
                      <td class="font-mono">{{ it.provider }}</td>
                      <td class="font-mono">{{ fmtProviderIcon(it.remote) }}</td>
                      <td class="font-mono">{{ fmtProviderIcon(it.local) }}</td>
                      <td class="min-w-[260px]">
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-i-${it.provider}`" value="remote" v-model="usersDbSmartChoices.icons[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('router') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-i-${it.provider}`" value="local" v-model="usersDbSmartChoices.icons[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('local') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-i-${it.provider}`" value="custom" v-model="usersDbSmartChoices.icons[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('custom') }}</span>
                          </label>
                        </div>
                        <input
                          v-if="usersDbSmartChoices.icons[it.provider].mode === 'custom'"
                          type="text"
                          class="input input-bordered input-xs mt-1 w-full"
                          v-model="usersDbSmartChoices.icons[it.provider].customIcon"
                          :placeholder="it.local"
                        />
                        <div class="mt-0.5 text-[10px] opacity-60">{{ $t('providerIconHint') }}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.ssl.defaultDays.changed">
              <div class="font-semibold text-xs">{{ $t('sslWarnThreshold') }}: {{ $t('usersDbChanged') }}</div>
              <div class="mt-1 flex flex-wrap items-center gap-3">
                <label class="inline-flex items-center gap-1 cursor-pointer">
                  <input class="radio radio-xs" type="radio" name="udb-ssl-default" value="remote" v-model="usersDbSmartChoices.sslDefault.mode" />
                  <span class="text-[11px]">{{ $t('router') }}: <span class="font-mono">{{ usersDbConflictDiff.ssl.defaultDays.remote }}</span></span>
                </label>
                <label class="inline-flex items-center gap-1 cursor-pointer">
                  <input class="radio radio-xs" type="radio" name="udb-ssl-default" value="local" v-model="usersDbSmartChoices.sslDefault.mode" />
                  <span class="text-[11px]">{{ $t('local') }}: <span class="font-mono">{{ usersDbConflictDiff.ssl.defaultDays.local }}</span></span>
                </label>
                <label class="inline-flex items-center gap-1 cursor-pointer">
                  <input class="radio radio-xs" type="radio" name="udb-ssl-default" value="custom" v-model="usersDbSmartChoices.sslDefault.mode" />
                  <span class="text-[11px]">{{ $t('custom') }}</span>
                </label>

                <input
                  v-if="usersDbSmartChoices.sslDefault.mode === 'custom'"
                  type="number"
                  min="0"
                  max="365"
                  class="input input-bordered input-xs w-24"
                  v-model.number="usersDbSmartChoices.sslDefault.customDays"
                />
              </div>
            </div>

            <div v-if="usersDbConflictDiff.ssl.providerDays.changed.length">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-xs">{{ $t('sslWarnDays') }}: {{ $t('usersDbChanged') }} ({{ usersDbConflictDiff.ssl.providerDays.changed.length }})</div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('warnDays','local')" :disabled="usersDbBusy">{{ $t('usersDbSetAllLocal') }}</button>
                  <button type="button" class="btn btn-ghost btn-xs" @click="usersDbSmartSetAll('warnDays','remote')" :disabled="usersDbBusy">{{ $t('usersDbSetAllRouter') }}</button>
                </div>
              </div>

              <div class="mt-1 overflow-x-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th style="width: 200px">{{ $t('provider') }}</th>
                      <th style="width: 120px">{{ $t('router') }}</th>
                      <th style="width: 120px">{{ $t('local') }}</th>
                      <th>{{ $t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="it in usersDbConflictDiff.ssl.providerDays.changed" :key="it.provider">
                      <td class="font-mono">{{ it.provider }}</td>
                      <td class="font-mono">{{ it.remote }}</td>
                      <td class="font-mono">{{ it.local }}</td>
                      <td class="min-w-[260px]">
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-w-${it.provider}`" value="remote" v-model="usersDbSmartChoices.warnDays[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('router') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-w-${it.provider}`" value="local" v-model="usersDbSmartChoices.warnDays[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('local') }}</span>
                          </label>
                          <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input class="radio radio-xs" type="radio" :name="`udb-w-${it.provider}`" value="custom" v-model="usersDbSmartChoices.warnDays[it.provider].mode" />
                            <span class="text-[11px]">{{ $t('custom') }}</span>
                          </label>
                        </div>
                        <input
                          v-if="usersDbSmartChoices.warnDays[it.provider].mode === 'custom'"
                          type="number"
                          min="0"
                          max="365"
                          class="input input-bordered input-xs mt-1 w-24"
                          v-model.number="usersDbSmartChoices.warnDays[it.provider].customDays"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <details class="mt-2">
          <summary class="cursor-pointer select-none opacity-80">{{ $t('details') }}</summary>

          <div class="mt-2 space-y-3">
            <div v-if="usersDbConflictDiff.labels.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('usersDbLabels') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in usersDbConflictDiff.labels.changed.slice(0, 50)" :key="it.key" class="font-mono">
                  <span class="opacity-60">{{ it.key }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ usersDbFormatLabelSummary(it.remote.label, it.remote.scope) }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ usersDbFormatLabelSummary(it.local.label, it.local.scope) }}</span>
                </div>
                <div v-if="usersDbConflictDiff.labels.changed.length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.labels.localOnly.length || usersDbConflictDiff.labels.remoteOnly.length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('usersDbLabels') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.labels.localOnly.slice(0, 50)" :key="it.key" class="font-mono">
                      <span class="opacity-60">{{ it.key }}</span><span class="opacity-60"> : </span><span>{{ usersDbFormatLabelSummary(it.label, it.scope) }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.labels.localOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.labels.remoteOnly.slice(0, 50)" :key="it.key" class="font-mono">
                      <span class="opacity-60">{{ it.key }}</span><span class="opacity-60"> : </span><span>{{ usersDbFormatLabelSummary(it.label, it.scope) }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.labels.remoteOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.userLimits.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('usersDbUserLimits') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in usersDbUserLimitChangedRows.slice(0, 50)" :key="it.user" class="font-mono break-all">
                  <span class="opacity-60">{{ it.user }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ it.remote }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ it.result }}</span>
                  <span class="opacity-60"> · </span>
                  <span>{{ it.reason }}</span>
                </div>
                <div v-if="usersDbConflictDiff.userLimits.changed.length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.userLimits.localOnly.length || usersDbConflictDiff.userLimits.remoteOnly.length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('usersDbUserLimits') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.userLimits.localOnly.slice(0, 50)" :key="it.user" class="font-mono break-all">
                      <span class="opacity-60">{{ it.user }}</span><span class="opacity-60"> : </span><span>{{ fmtUserLimitSummary(it.local) }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.userLimits.localOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.userLimits.remoteOnly.slice(0, 50)" :key="it.user" class="font-mono break-all">
                      <span class="opacity-60">{{ it.user }}</span><span class="opacity-60"> : </span><span>{{ fmtUserLimitSummary(it.remote) }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.userLimits.remoteOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.urls.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('usersDbPanels') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in usersDbConflictDiff.urls.changed.slice(0, 50)" :key="it.provider" class="font-mono break-all">
                  <span class="opacity-60">{{ it.provider }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ it.remote }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ it.local }}</span>
                </div>
                <div v-if="usersDbConflictDiff.urls.changed.length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.urls.localOnly.length || usersDbConflictDiff.urls.remoteOnly.length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('usersDbPanels') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.urls.localOnly.slice(0, 50)" :key="it.provider" class="font-mono break-all">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ it.url }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.urls.localOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.urls.remoteOnly.slice(0, 50)" :key="it.provider" class="font-mono break-all">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ it.url }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.urls.remoteOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="(usersDbConflictDiff as any).icons && (usersDbConflictDiff as any).icons.changed && (usersDbConflictDiff as any).icons.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('providerIcon') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in ((usersDbConflictDiff as any).icons.changed || []).slice(0, 50)" :key="it.provider" class="font-mono">
                  <span class="opacity-60">{{ it.provider }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ fmtProviderIcon(it.remote) }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ fmtProviderIcon(it.local) }}</span>
                </div>
                <div v-if="((usersDbConflictDiff as any).icons.changed || []).length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="((usersDbConflictDiff as any).icons?.localOnly || []).length || ((usersDbConflictDiff as any).icons?.remoteOnly || []).length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('providerIcon') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in (((usersDbConflictDiff as any).icons?.localOnly) || []).slice(0, 50)" :key="it.provider" class="font-mono">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ fmtProviderIcon(it.icon) }}</span>
                    </div>
                    <div v-if="(((usersDbConflictDiff as any).icons?.localOnly) || []).length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in (((usersDbConflictDiff as any).icons?.remoteOnly) || []).slice(0, 50)" :key="it.provider" class="font-mono">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ fmtProviderIcon(it.icon) }}</span>
                    </div>
                    <div v-if="(((usersDbConflictDiff as any).icons?.remoteOnly) || []).length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.tunnels.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in usersDbConflictDiff.tunnels.changed.slice(0, 50)" :key="it.name" class="font-mono">
                  <span class="opacity-60">{{ it.name }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ it.remote }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ it.local }}</span>
                </div>
                <div v-if="usersDbConflictDiff.tunnels.changed.length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.tunnels.localOnly.length || usersDbConflictDiff.tunnels.remoteOnly.length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.tunnels.localOnly.slice(0, 50)" :key="it.name" class="font-mono">
                      <span class="opacity-60">{{ it.name }}</span><span class="opacity-60"> : </span><span>{{ it.description }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.tunnels.localOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.tunnels.remoteOnly.slice(0, 50)" :key="it.name" class="font-mono">
                      <span class="opacity-60">{{ it.name }}</span><span class="opacity-60"> : </span><span>{{ it.description }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.tunnels.remoteOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.ssl.defaultDays.changed">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('sslWarnThreshold') }}</div>
              <div class="mt-1 font-mono">
                <span>{{ usersDbConflictDiff.ssl.defaultDays.remote }}</span>
                <span class="opacity-60"> → </span>
                <span>{{ usersDbConflictDiff.ssl.defaultDays.local }}</span>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.ssl.providerDays.changed.length">
              <div class="font-semibold">{{ $t('usersDbChanged') }}: {{ $t('sslWarnDays') }}</div>
              <div class="mt-1 space-y-1">
                <div v-for="it in usersDbConflictDiff.ssl.providerDays.changed.slice(0, 50)" :key="it.provider" class="font-mono">
                  <span class="opacity-60">{{ it.provider }}</span>
                  <span class="opacity-60"> : </span>
                  <span>{{ it.remote }}</span>
                  <span class="opacity-60"> → </span>
                  <span>{{ it.local }}</span>
                </div>
                <div v-if="usersDbConflictDiff.ssl.providerDays.changed.length > 50" class="opacity-60">…</div>
              </div>
            </div>

            <div v-if="usersDbConflictDiff.ssl.providerDays.localOnly.length || usersDbConflictDiff.ssl.providerDays.remoteOnly.length">
              <div class="font-semibold">{{ $t('usersDbAddedRemoved') }}: {{ $t('sslWarnDays') }}</div>
              <div class="mt-1 grid gap-3 md:grid-cols-2">
                <div>
                  <div class="opacity-70">{{ $t('usersDbLocalOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.ssl.providerDays.localOnly.slice(0, 50)" :key="it.provider" class="font-mono">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ it.days }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.ssl.providerDays.localOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
                <div>
                  <div class="opacity-70">{{ $t('usersDbRouterOnly') }}</div>
                  <div class="mt-1 space-y-1">
                    <div v-for="it in usersDbConflictDiff.ssl.providerDays.remoteOnly.slice(0, 50)" :key="it.provider" class="font-mono">
                      <span class="opacity-60">{{ it.provider }}</span><span class="opacity-60"> : </span><span>{{ it.days }}</span>
                    </div>
                    <div v-if="usersDbConflictDiff.ssl.providerDays.remoteOnly.length > 50" class="opacity-60">…</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      <details v-if="agentEnabled" class="rounded-lg border border-base-content/10 bg-base-200/40 p-2 text-xs">
        <summary class="cursor-pointer select-none opacity-80 flex items-center justify-between gap-2">
          <span>{{ $t('usersDbHistoryTitle') }}</span>
          <span class="badge badge-ghost badge-sm">{{ usersDbHistoryItems.length }}</span>
        </summary>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-xs btn-ghost" @click="refreshUsersDbHistory" :disabled="usersDbBusy">
            {{ $t('refresh') }}
          </button>
        </div>

        <div v-if="!usersDbHistoryItems.length" class="mt-1 opacity-70">
          {{ $t('noData') }}
        </div>

        <div v-else class="mt-2 overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th style="width: 80px">rev</th>
                <th style="width: 210px">{{ $t('updated') }}</th>
                <th style="width: 90px">{{ $t('status') }}</th>
                <th style="width: 180px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in usersDbHistoryItems" :key="it.rev">
                <td class="font-mono">{{ it.rev }}</td>
                <td class="font-mono">{{ it.updatedAt || '—' }}</td>
                <td>
                  <span v-if="it.current" class="badge badge-success badge-sm">{{ $t('current') }}</span>
                  <span v-else class="badge badge-ghost badge-sm">—</span>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-1">
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost"
                      @click="usersDbOpenRevPreview(it.rev)"
                      :disabled="usersDbBusy || usersDbViewBusy"
                    >
                      {{ $t('usersDbView') }}
                    </button>
                    <button v-if="!it.current" type="button" class="btn btn-xs" @click="usersDbRestoreRev(it.rev)" :disabled="usersDbBusy">
                      {{ $t('restore') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="usersDbViewRev" class="mt-3 rounded-lg border border-base-content/10 bg-base-200/40 p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold">
                {{ $t('usersDbRevisionPreview') }}: <span class="font-mono">rev {{ usersDbViewRev }}</span>
              </div>
              <div class="mt-0.5 text-[11px] opacity-70">
                <span class="opacity-60">{{ $t('updated') }}:</span>
                <span class="font-mono ml-1">{{ usersDbViewUpdatedAt || '—' }}</span>
                <span v-if="usersDbViewSummary" class="ml-2 opacity-60">
                  • {{ $t('usersDbLabels') }}: <span class="font-mono">{{ usersDbViewSummary.labels }}</span>
                  • {{ $t('usersDbPanels') }}: <span class="font-mono">{{ usersDbViewSummary.panels }}</span>
                  • {{ $t('providerIcon') }}: <span class="font-mono">{{ usersDbViewSummary.icons }}</span>
                  • {{ $t('routerTrafficTunnelDescriptionsSettingsTitle') }}: <span class="font-mono">{{ usersDbViewSummary.tunnels }}</span>
                  • {{ $t('usersDbUserLimits') }}: <span class="font-mono">{{ usersDbViewSummary.userLimits }}</span>
                  • SSL: <span class="font-mono">{{ usersDbViewSummary.sslDefault }}</span>
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-xs btn-ghost" @click="copyUsersDbViewJson" :disabled="usersDbViewBusy || !usersDbViewJsonText">
                {{ $t('copy') }} JSON
              </button>
              <button type="button" class="btn btn-xs btn-ghost" @click="copyUsersDbViewLabels" :disabled="usersDbViewBusy || !usersDbViewPayload">
                {{ $t('copy') }} {{ $t('usersDbLabels') }}
              </button>
              <button type="button" class="btn btn-xs btn-ghost" @click="copyUsersDbViewPanels" :disabled="usersDbViewBusy || !usersDbViewPayload">
                {{ $t('copy') }} {{ $t('usersDbPanels') }}
              </button>
              <button type="button" class="btn btn-xs btn-ghost" @click="copyUsersDbViewIcons" :disabled="usersDbViewBusy || !usersDbViewPayload">
                {{ $t('copy') }} {{ $t('providerIcon') }}
              </button>
              <button type="button" class="btn btn-xs" @click="usersDbCloseRevPreview">
                {{ $t('close') }}
              </button>
            </div>
          </div>

          <div v-if="usersDbViewError" class="mt-2 text-xs text-error">{{ usersDbViewError }}</div>
          <div v-else-if="usersDbViewBusy" class="mt-2 text-xs opacity-70">…</div>

          <div v-if="usersDbViewJsonText" class="mt-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2">
            <pre class="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4">{{ usersDbViewJsonText }}</pre>
          </div>
        </div>
      </details>

      <div class="text-[11px] opacity-60">
        {{ $t('usersDbSyncCurrent') }}
      </div>
    </div>

    <div class="card gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold">{{ $t('operationsHistory') }}</div>
        <button type="button" class="btn btn-sm btn-ghost" @click="clearJobs" :disabled="!jobs.length">
          {{ $t('clear') }}
        </button>
      </div>

      <div v-if="!jobs.length" class="text-sm opacity-70">
        {{ $t('noOperationsYet') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th style="width: 140px">{{ $t('time') }}</th>
              <th>{{ $t('operation') }}</th>
              <th style="width: 120px">{{ $t('status') }}</th>
              <th style="width: 110px">{{ $t('duration') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in jobs" :key="j.id">
              <td class="font-mono text-xs">{{ fmtTime(j.startedAt) }}</td>
              <td>
                <div class="text-sm">{{ j.title }}</div>
                <div v-if="j.error" class="text-xs text-error">{{ j.error }}</div>
                <div v-else-if="j.meta && Object.keys(j.meta).length" class="text-[11px] opacity-70">
                  <span v-for="(v, k) in j.meta" :key="k" class="mr-2">
                    <span class="opacity-60">{{ k }}:</span>
                    <span class="font-mono">{{ v }}</span>
                  </span>
                </div>
              </td>
              <td>
                <span v-if="j.endedAt && j.ok" class="badge badge-success">{{ $t('done') }}</span>
                <span v-else-if="j.endedAt && j.ok === false" class="badge badge-error">{{ $t('failed') }}</span>
                <span v-else class="badge badge-warning">{{ $t('running') }}</span>
              </td>
              <td class="font-mono text-xs">
                {{ j.endedAt ? fmtMs(j.endedAt - j.startedAt) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex-1"></div>

    <div class="card items-center justify-center gap-2 p-2 sm:flex-row">
      {{ getLabelFromBackend(activeBackend!) }} :
      <BackendVersion />
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchRuleProvidersAPI, updateRuleProviderSilentAPI, zashboardVersion, version as coreVersion } from '@/api'
import { buildRollingReleaseUrl } from '@/config/project'
import {
  agentGeoInfoAPI,
  agentGeoUpdateAPI,
  agentLogsAPI,
  agentLogsFollowAPI,
  agentMihomoProvidersAPI,
  agentRulesInfoAPI,
  agentStatusAPI,
  agentUsersDbGetRevAPI,
} from '@/api/agent'
import BackendVersion from '@/components/common/BackendVersion.vue'
import ProviderIconBadge from '@/components/common/ProviderIconBadge.vue'
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue'
import { useStorage } from '@vueuse/core'
import { getLabelFromBackend, prettyBytesHelper } from '@/helper/utils'
import { navigateToTopology } from '@/helper/topologyNav'
import { parseDateMaybe } from '@/helper/providerHealth'
import { showNotification } from '@/helper/notification'
import { decodeB64Utf8 } from '@/helper/b64'
import { countryCodeToFlagEmoji, normalizeProviderIcon } from '@/helper/providerIcon'
import { FLAG_CODES } from '@/helper/flagIcons'
import { activeBackend, backendList } from '@/store/setup'
import { agentEnabled, agentUrl } from '@/store/agent'
import { proxyProviderIconMap, proxyProviderPanelUrlMap, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { agentProvidersSslCacheReady, agentProvidersSslRefreshPending, agentProvidersSslRefreshing, fetchAgentProviders, panelSslCheckedAt, panelSslNotAfterByName, panelSslProbeError, panelSslProbeLoading, probePanelSsl, refreshAgentProviderSslCache } from '@/store/providerHealth'
import { proxyProviederList } from '@/store/proxies'
import { userLimitProfiles } from '@/store/userLimitProfiles'
import { userLimitSnapshots } from '@/store/userLimitSnapshots'
import { autoDisconnectLimitedUsers, hardBlockLimitedUsers, managedLanDisallowedCidrs, userLimits, type UserLimit } from '@/store/userLimits'
import { activeConnections, closedConnections } from '@/store/connections'
import { ruleHitMap } from '@/store/rules'
import { clearJobs, finishJob, jobHistory, startJob } from '@/store/jobs'
import {
  connectionProviderCandidates,
  connectionProxyCandidates,
  providerProxyNames,
  providerTrafficPullNow,
  providerTrafficPushNow,
  providerTrafficSyncState,
} from '@/store/providerActivity'
import { applyUserEnforcementNow, getUserLimitState } from '@/composables/userLimits'
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { RuleProvider } from '@/types'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { ROUTE_NAME } from '@/constant'
import { ChevronDownIcon } from '@heroicons/vue/20/solid'
import {
  usersDbConflictCount,
  usersDbConflictDiff,
  usersDbHasConflict,
  usersDbHistoryItems,
  usersDbLastError,
  usersDbLastPullAt,
  usersDbLastPushAt,
  usersDbLocalDirty,
  usersDbPhase,
  usersDbPullNow,
  usersDbPushNow,
  usersDbRemoteRev,
  usersDbRemoteUpdatedAt,
  usersDbResolveMerge,
  usersDbResolvePull,
  usersDbResolvePush,
  usersDbResolveSmartMerge,
  usersDbRestoreRev,
  usersDbFetchHistory,
  usersDbSyncEnabled,
} from '@/store/usersDbSync'

const busy = ref(false)
const jobs = computed(() => jobHistory.value || [])
// --- Router-agent status (versions) ---
const agentStatusLite = ref<any>({ ok: false })
const refreshAgentStatusLite = async () => {
  if (!agentEnabled.value) {
    agentStatusLite.value = { ok: false }
    return
  }
  agentStatusLite.value = await agentStatusAPI()
}

watch([agentEnabled, agentUrl], () => {
  refreshAgentStatusLite()
})


// --- Router external-ui-url helper (anti-cache) ---
const routerUiUrl = computed(() => {
  const v = encodeURIComponent(zashboardVersion.value || '')
  return buildRollingReleaseUrl(v)
})

const copyRouterUiUrl = async (asYaml: boolean) => {
  try {
    const text = asYaml ? `external-ui-url: "${routerUiUrl.value}"` : routerUiUrl.value
    await navigator.clipboard.writeText(text)
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  }
}



// --- Proxy providers: shared management panel URLs (synced via users DB) ---
const providersPanelBusy = ref(false)
const providersPanelError = ref('')
const providersPanelList = ref<Array<{ name: string; url?: string; host?: string; port?: string; sslNotAfter?: string; panelUrl?: string; panelSslNotAfter?: string }>>([])
const providersPanelExpanded = ref<boolean>(false)
const providersPanelAt = ref<number>(0)

const PROVIDERS_PANEL_EXPANDED_LS_KEY = 'zash.tasks.providersPanels.expanded'
try {
  const v = localStorage.getItem(PROVIDERS_PANEL_EXPANDED_LS_KEY)
  // default: collapsed
  if (v === '0') providersPanelExpanded.value = false
  if (v === '1') providersPanelExpanded.value = true
} catch {
  // ignore
}

watch(
  providersPanelExpanded,
  (v) => {
    try {
      localStorage.setItem(PROVIDERS_PANEL_EXPANDED_LS_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  },
  { flush: 'post' },
)

const toggleProvidersPanelExpanded = () => {
  providersPanelExpanded.value = !providersPanelExpanded.value
}

// (no per-provider accordion state; rendered as a table)

// Render list should include *all* providers known to UI (proxyProviederList), even if agent SSL probe returns only a subset.
// Also include any providers that exist only in the synced panel-url map (so users can set URLs even before providers load).
const providersPanelRenderList = computed(() => {
  const names = new Set<string>()

  try {
    for (const p of (proxyProviederList.value || []) as any[]) {
      const name = String(p?.name || '').trim()
      if (!name) continue
      if (name === 'default') continue
      if (p?.vehicleType === 'Compatible') continue
      names.add(name)
    }
  } catch {
    // ignore
  }

  try {
    for (const k of Object.keys(proxyProviderPanelUrlMap.value || {})) {
      const name = String(k || '').trim()
      if (!name) continue
      names.add(name)
    }
  } catch {
    // ignore
  }

  const byName = new Map<string, any>()
  for (const it of (providersPanelList.value || []) as any[]) {
    const name = String(it?.name || '').trim()
    if (!name) continue
    byName.set(name, it)
    names.add(name)
  }

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const it = byName.get(name)
      if (it) return it
      return { name }
    })
})

const fmtSslPanel = (v: any) => {
  const d = parseDateMaybe(v)
  return d ? d.format('DD-MM-YYYY HH:mm:ss') : '—'
}

const fmtTs = (ms: any) => {
  const n = typeof ms === 'number' ? ms : typeof ms === 'string' ? Number(ms) : 0
  if (!n) return '—'
  return dayjs(n).format('DD-MM-YYYY HH:mm:ss')
}

const getProviderWarnDays = (name: string): number => {
  const k = String(name || '').trim()
  const override = Number((proxyProviderSslWarnDaysMap.value || {})[k])
  const base = Number(sslNearExpiryDaysDefault.value)
  const v = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2
  return Math.max(0, Math.min(365, Math.trunc(v)))
}

const getProviderSslWarnOverride = (name: string): number | null => {
  const k = String(name || '').trim()
  const v = Number((proxyProviderSslWarnDaysMap.value || {})[k])
  return Number.isFinite(v) ? Math.max(0, Math.min(365, Math.trunc(v))) : null
}

const setProviderSslWarnOverride = (name: string, raw: any) => {
  const k = String(name || '').trim()
  if (!k) return
  const s = String(raw ?? '').trim()
  const cur = { ...(proxyProviderSslWarnDaysMap.value || {}) }
  if (!s) {
    delete cur[k]
    proxyProviderSslWarnDaysMap.value = cur
    return
  }
  const n = Math.trunc(Number(s))
  if (!Number.isFinite(n)) return
  cur[k] = Math.max(0, Math.min(365, n))
  proxyProviderSslWarnDaysMap.value = cur
}

const clearProviderSslWarnOverride = (name: string) => {
  const k = String(name || '').trim()
  if (!k) return
  const cur = { ...(proxyProviderSslWarnDaysMap.value || {}) }
  delete cur[k]
  proxyProviderSslWarnDaysMap.value = cur
}

const sslPanelInfo = (name: string, v: any, fromPanel: boolean) => {
  const d = parseDateMaybe(v)
  if (!d) {
    const pending = agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value || !agentProvidersSslCacheReady.value
    if (pending) {
      return {
        text: t('providerSslRefreshing'),
        cls: 'text-info',
        title: t('providerSslRefreshingTip'),
      }
    }
    return {
      text: '—',
      cls: '',
      title: `${(name || '').trim()} • ${String(v || '').trim()}`.trim(),
    }
  }
  const days = d.diff(dayjs(), 'day')
  const date = d.format('DD-MM-YYYY HH:mm:ss')
  const warnDays = getProviderWarnDays(name)
  const cls = days < 0 ? 'text-error' : days <= warnDays ? 'text-warning' : 'text-base-content/60'
  const text = days < 0 ? `${date} (expired)` : `${date} (${days}d)`
  const checkedMs = fromPanel ? panelSslCheckedAt.value : providersPanelAt.value
  const title = `Source: TLS cert of ${fromPanel ? "panel URL" : "proxy-provider URL"} (router-agent) • Checked: ${fmtTs(checkedMs)}`
  return { text, cls, title }
}

const getPanelNotAfter = (name: string): string => {
  const k = String(name || '').trim()
  return (panelSslNotAfterByName.value || {})[k] || ''
}

const setProviderPanelUrl = (name: string, url: string) => {
  const k = String(name || '').trim()
  if (!k) return
  const v = String(url || '').trim()
  const cur = { ...(proxyProviderPanelUrlMap.value || {}) }
  if (!v) delete cur[k]
  else cur[k] = v
  proxyProviderPanelUrlMap.value = cur
}

// ---- Provider icon (flag/globe) ----
const providerIconPopular = [
  'RU','US','DE','FR','GB','NL','FI','SE','NO','EE','LV','LT','PL','UA','RO','TR','ES','IT','CH','AT','CZ','SG','JP','KR','CN','HK','IN',
]

const providerIconSearch = ref('')

const providerIconCountries = computed(() => {
  const all = Array.isArray(FLAG_CODES) ? FLAG_CODES : []
  const q = String(providerIconSearch.value || '').trim().toUpperCase()

  if (q) {
    return all.filter((cc) => cc.includes(q))
  }

  // default: popular first
  const pop = providerIconPopular.filter((cc) => all.includes(cc))
  const popSet = new Set(pop)
  const rest = all.filter((cc) => !popSet.has(cc))
  return [...pop, ...rest]
})

const getProviderIconRaw = (name: string): string => {
  const k = String(name || '').trim()
  if (!k) return ''
  return normalizeProviderIcon((proxyProviderIconMap.value || {})[k])
}

const setProviderIcon = (name: string, icon: string) => {
  const k = String(name || '').trim()
  if (!k) return
  const nv = normalizeProviderIcon(icon)
  const cur = { ...(proxyProviderIconMap.value || {}) }
  if (!nv) delete cur[k]
  else cur[k] = nv
  proxyProviderIconMap.value = cur
}

// Icon picker popover (teleported to body)
const providerIconPickerOpen = ref(false)
const providerIconPickerProvider = ref('')
const providerIconPickerAnchor = ref<HTMLElement | null>(null)
const providerIconPickerRoot = ref<HTMLElement | null>(null)
const providerIconPickerPos = reactive({ top: 0, left: 0 })

const providerIconPickerStyle = computed(() => ({
  top: `${providerIconPickerPos.top}px`,
  left: `${providerIconPickerPos.left}px`,
}))

const repositionProviderIconPicker = () => {
  const el = providerIconPickerAnchor.value
  if (!el) return
  const r = el.getBoundingClientRect()
	  // Keep the popover fully visible even on narrow viewports.
	  const W = Math.min(288, Math.max(220, window.innerWidth - 16))
  const PAD = 8
  let left = Math.round(r.left)
  // Prefer aligning right edge with trigger if possible.
  left = Math.round(r.right - W)
  const maxLeft = Math.max(PAD, window.innerWidth - W - PAD)
  left = Math.max(PAD, Math.min(maxLeft, left))

  // Place below, but keep inside viewport.
  let top = Math.round(r.bottom + 8)
  const approxH = 220
  const maxTop = Math.max(PAD, window.innerHeight - approxH - PAD)
  top = Math.max(PAD, Math.min(maxTop, top))

  providerIconPickerPos.left = left
  providerIconPickerPos.top = top
}

const openProviderIconPicker = (e: any, name: string) => {
  providerIconPickerProvider.value = String(name || '').trim()
  providerIconPickerAnchor.value = (e?.currentTarget as any) as HTMLElement
  providerIconPickerOpen.value = true
  nextTick(() => repositionProviderIconPicker())
}

const closeProviderIconPicker = () => {
  providerIconPickerOpen.value = false
  providerIconPickerProvider.value = ''
  providerIconPickerAnchor.value = null
  providerIconPickerRoot.value = null
  providerIconSearch.value = ''
}

const pickProviderIconFromPicker = (icon: string) => {
  const name = providerIconPickerProvider.value
  if (!name) return
  setProviderIcon(name, icon)
  closeProviderIconPicker()
}

const onDocKeydownProviderIconPicker = (ev: KeyboardEvent) => {
  if (!providerIconPickerOpen.value) return
  if (ev.key === 'Escape') closeProviderIconPicker()
}

const onDocMousedownProviderIconPicker = (ev: MouseEvent) => {
  if (!providerIconPickerOpen.value) return
  const t = ev.target as HTMLElement | null
  if (!t) return
  const anchor = providerIconPickerAnchor.value
  if (anchor && (t === anchor || anchor.contains(t))) return
  // Click inside picker is stopped at the picker root; this is a last-resort close.
  closeProviderIconPicker()
}

let providerIconPickerRaf = 0
const onScrollProviderIconPicker = (ev: Event) => {
  if (!providerIconPickerOpen.value) return

  // Don't close/reposition while the user scrolls inside the picker itself.
  const root = providerIconPickerRoot.value
  const t = ev.target as any
  if (root && t && typeof (t as any).nodeType === 'number') {
    try {
      if (root.contains(t as Node)) return
    } catch {
      // ignore
    }
  }

  if (providerIconPickerRaf) return
  providerIconPickerRaf = window.requestAnimationFrame(() => {
    providerIconPickerRaf = 0
    repositionProviderIconPicker()
  })
}

onMounted(() => {
  window.addEventListener('resize', repositionProviderIconPicker)
  window.addEventListener('scroll', onScrollProviderIconPicker, true)
  document.addEventListener('keydown', onDocKeydownProviderIconPicker)
  document.addEventListener('mousedown', onDocMousedownProviderIconPicker)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', repositionProviderIconPicker)
  window.removeEventListener('scroll', onScrollProviderIconPicker, true)
  document.removeEventListener('keydown', onDocKeydownProviderIconPicker)
  document.removeEventListener('mousedown', onDocMousedownProviderIconPicker)
})

const fmtProviderIcon = (v: any): string => {
  const n = normalizeProviderIcon(v)
  if (!n) return '—'
  if (n === 'globe') return '🌐'
  const f = countryCodeToFlagEmoji(n)
  return f ? `${f} ${n}` : n
}


const friendlyProviderPanelError = (err: any, kind: 'providers' | 'ssl' = 'providers'): string => {
  const raw = String(err || '').trim()
  if (!raw) return '—'
  const low = raw.toLowerCase()
  if (low.includes('timeout')) {
    return kind === 'ssl'
      ? 'SSL-проверка не успела завершиться. Остальные данные страницы доступны.'
      : 'Список провайдеров отвечает слишком долго. Попробуйте обновить ещё раз.'
  }
  if (low.includes('offline') || low.includes('network error') || low.includes('failed to fetch')) {
    return kind === 'ssl'
      ? 'SSL-проверка сейчас недоступна.'
      : 'Не удалось получить список провайдеров.'
  }
  return raw
}

const loadProvidersPanel = async (force = false) => {
  if (!agentEnabled.value) {
    providersPanelList.value = []
    providersPanelError.value = ''
    return
  }
  if (providersPanelBusy.value) return
  providersPanelBusy.value = true
  providersPanelError.value = ''
  try {
    const r: any = await agentMihomoProvidersAPI(force)
    if (!r?.ok) {
      providersPanelError.value = r?.error || 'failed'
      providersPanelList.value = []
      return
    }
    providersPanelList.value = Array.isArray(r?.providers) ? r.providers : []
    providersPanelAt.value = typeof r?.checkedAtSec === "number" && r.checkedAtSec > 0 ? r.checkedAtSec * 1000 : Date.now()
  } catch (e: any) {
    providersPanelError.value = e?.message || 'failed'
    providersPanelList.value = []
  } finally {
    providersPanelBusy.value = false
  }
}

const refreshProvidersPanel = async (force = false) => {
  await loadProvidersPanel(force)
  try {
    await fetchAgentProviders(force)
  } catch {
    // ignore store refresh failure here
  }
  try {
    await probePanelSsl(force)
  } catch {
    // Keep provider list visible even if SSL probing is unavailable.
  }
}

const providerSslCacheRefreshBusy = ref(false)
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const providerSslCacheStatusText = computed(() => {
  if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value) return t('providerSslRefreshing')
  if (!agentProvidersSslCacheReady.value && providersPanelRenderList.value.length > 0) return t('providerSslPending')
  return ''
})

const providerSslCacheStatusClass = computed(() => {
  if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value) return 'text-info'
  if (!agentProvidersSslCacheReady.value && providersPanelRenderList.value.length > 0) return 'text-warning'
  return 'text-base-content/60'
})

const refreshProviderSslCacheNow = async () => {
  if (!agentEnabled.value || providerSslCacheRefreshBusy.value) return
  providerSslCacheRefreshBusy.value = true
  try {
    const res: any = await refreshAgentProviderSslCache()
    if (!res?.ok) {
      showNotification({ content: res?.error || 'operationFailed', type: 'alert-error', timeout: 2200 })
      return
    }
    for (let i = 0; i < 6; i += 1) {
      await refreshProvidersPanel(true)
      if (agentProvidersSslCacheReady.value && !agentProvidersSslRefreshing.value && !agentProvidersSslRefreshPending.value) break
      await sleep(900)
    }
    showNotification({ content: 'refreshProviderSslCache', type: 'alert-success', timeout: 1600 })
  } catch (e: any) {
    showNotification({ content: e?.message || 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    providerSslCacheRefreshBusy.value = false
  }
}

type ProviderTrafficDebugRow = {
  key: string
  source: 'active' | 'closed'
  id: string
  matchedBy: 'provider' | 'proxy'
  matchedProxy: string
  providerCandidatesLabel: string
  proxyCandidatesLabel: string
  chainsLabel: string
  providerChainsLabel: string
  specialProxy: string
  providerNameField: string
  startLabel: string
  startedAt: number
  hostLabel: string
  ruleLabel: string
  download: number
  upload: number
  totalBytes: number
  speed: number
}

const PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY = 'zash.tasks.providerTrafficDebug.expanded'
const providerTrafficDebugExpanded = ref(false)
const providerTrafficDebugProvider = ref('')
const providerTrafficDebugIncludeClosed = ref(true)
const providerTrafficDebugLimit = ref(60)

try {
  const v = localStorage.getItem(PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY)
  if (v === '1') providerTrafficDebugExpanded.value = true
} catch {
  // ignore
}

watch(
  providerTrafficDebugExpanded,
  (v) => {
    try {
      localStorage.setItem(PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  },
  { flush: 'post' },
)

const toggleProviderTrafficDebugExpanded = () => {
  providerTrafficDebugExpanded.value = !providerTrafficDebugExpanded.value
}

const providerTrafficDebugProviderNames = computed(() => {
  const names = new Set<string>()
  for (const p of (proxyProviederList.value || []) as any[]) {
    const name = String(p?.name || '').trim()
    if (!name || name === 'default') continue
    names.add(name)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b))
})

watch(
  providerTrafficDebugProviderNames,
  (names) => {
    if (!names.length) {
      providerTrafficDebugProvider.value = ''
      return
    }
    if (!names.includes(providerTrafficDebugProvider.value)) {
      providerTrafficDebugProvider.value = names[0] || ''
    }
  },
  { immediate: true },
)

const providerTrafficSyncBadgeClass = computed(() => {
  if (!agentEnabled.value) return 'badge-ghost'
  if (providerTrafficSyncState.value.pushing || providerTrafficSyncState.value.pulling) return 'badge-info'
  if (!providerTrafficSyncState.value.bootstrapped) return 'badge-warning'
  if (providerTrafficSyncState.value.dirty) return 'badge-warning'
  return 'badge-success'
})

const providerTrafficSyncBadgeText = computed(() => {
  if (!agentEnabled.value) return t('agentDisabled')
  if (providerTrafficSyncState.value.pushing) return t('providerTrafficSyncPushing')
  if (providerTrafficSyncState.value.pulling) return t('providerTrafficSyncPulling')
  if (!providerTrafficSyncState.value.bootstrapped) return t('providerTrafficSyncBootstrapping')
  if (providerTrafficSyncState.value.dirty) return t('providerTrafficSyncDirty')
  return t('providerTrafficSyncSynced')
})

const refreshProviderTrafficSync = async () => {
  await providerTrafficPullNow()
}

const flushProviderTrafficSync = async () => {
  await providerTrafficPushNow()
}

const providerTrafficDebugSelectedName = computed(() => String(providerTrafficDebugProvider.value || '').trim())

const providerTrafficDebugSelectedProvider = computed(() => {
  const name = providerTrafficDebugSelectedName.value
  return (proxyProviederList.value || []).find((p: any) => String(p?.name || '').trim() === name) || null
})

const providerTrafficDebugProxyNames = computed(() => {
  const provider = providerTrafficDebugSelectedProvider.value as any
  const names = provider ? providerProxyNames(provider) : []
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
})

const providerTrafficDebugProxySet = computed(() => new Set(providerTrafficDebugProxyNames.value))

const formatDebugNames = (items: unknown[]) => {
  const names = (items || []).map((item) => String(item || '').trim()).filter(Boolean)
  return names.length ? names.join(' • ') : '—'
}

const toDebugRow = (conn: any, source: 'active' | 'closed'): ProviderTrafficDebugRow | null => {
  const selected = providerTrafficDebugSelectedName.value
  if (!selected) return null

  const providerCandidates = connectionProviderCandidates(conn as any)
  const proxyCandidates = connectionProxyCandidates(conn as any)

  let matchedBy: 'provider' | 'proxy' | '' = ''
  let matchedProxy = ''

  if (providerCandidates.includes(selected)) {
    matchedBy = 'provider'
    matchedProxy = proxyCandidates[0] || ''
  } else {
    for (const candidate of proxyCandidates) {
      if (providerTrafficDebugProxySet.value.has(candidate)) {
        matchedBy = 'proxy'
        matchedProxy = candidate
        break
      }
    }
  }

  if (!matchedBy) return null

  const download = Number((conn as any)?.download ?? 0) || 0
  const upload = Number((conn as any)?.upload ?? 0) || 0
  const speed = source === 'active'
    ? (Number((conn as any)?.downloadSpeed ?? 0) || 0) + (Number((conn as any)?.uploadSpeed ?? 0) || 0)
    : 0
  const startedAt = dayjs(String((conn as any)?.start || '')).valueOf()
  const metadata = (conn as any)?.metadata || {}
  const providerChains = Array.isArray((conn as any)?.providerChains)
    ? (conn as any).providerChains
    : Array.isArray(metadata?.providerChains)
      ? metadata.providerChains
      : []
  const host = String(metadata?.host || metadata?.sniffHost || metadata?.destinationIP || '—').trim() || '—'
  const port = String(metadata?.destinationPort || '').trim()
  const rule = String((conn as any)?.rule || '').trim()
  const rulePayload = String((conn as any)?.rulePayload || '').trim()

  return {
    key: `${source}:${String((conn as any)?.id || '').trim()}`,
    source,
    id: String((conn as any)?.id || '').trim() || '—',
    matchedBy: matchedBy as 'provider' | 'proxy',
    matchedProxy,
    providerCandidatesLabel: formatDebugNames(providerCandidates),
    proxyCandidatesLabel: formatDebugNames(proxyCandidates),
    chainsLabel: formatDebugNames(Array.isArray((conn as any)?.chains) ? (conn as any).chains : []),
    providerChainsLabel: formatDebugNames(providerChains),
    specialProxy: String(metadata?.specialProxy || '').trim(),
    providerNameField: String((conn as any)?.providerName || (conn as any)?.provider || metadata?.providerName || metadata?.provider || '').trim(),
    startLabel: startedAt && Number.isFinite(startedAt) ? dayjs(startedAt).format('DD-MM HH:mm:ss') : '—',
    startedAt: Number.isFinite(startedAt) ? startedAt : 0,
    hostLabel: port ? `${host}:${port}` : host,
    ruleLabel: [rule, rulePayload].filter(Boolean).join(' • ') || '—',
    download,
    upload,
    totalBytes: download + upload,
    speed,
  }
}

const providerTrafficDebugAllRows = computed<ProviderTrafficDebugRow[]>(() => {
  const rows: ProviderTrafficDebugRow[] = []
  for (const conn of activeConnections.value || []) {
    const row = toDebugRow(conn as any, 'active')
    if (row) rows.push(row)
  }
  if (providerTrafficDebugIncludeClosed.value) {
    for (const conn of closedConnections.value || []) {
      const row = toDebugRow(conn as any, 'closed')
      if (row) rows.push(row)
    }
  }
  return rows.sort((a, b) => {
    if (b.startedAt !== a.startedAt) return b.startedAt - a.startedAt
    if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes
    return a.id.localeCompare(b.id)
  })
})

const providerTrafficDebugRows = computed(() => {
  const limit = Math.max(10, Math.min(200, Math.trunc(Number(providerTrafficDebugLimit.value) || 60)))
  return providerTrafficDebugAllRows.value.slice(0, limit)
})

const providerTrafficDebugSummary = computed(() => {
  const rows = providerTrafficDebugAllRows.value
  return {
    total: rows.length,
    active: rows.filter((row) => row.source === 'active').length,
    closed: rows.filter((row) => row.source === 'closed').length,
    byProvider: rows.filter((row) => row.matchedBy === 'provider').length,
    byProxy: rows.filter((row) => row.matchedBy === 'proxy').length,
  }
})

// --- Live logs (router-agent) ---
const logSource = ref<'mihomo' | 'config' | 'agent'>('mihomo')
const logLines = ref<number>(200)
const logsAuto = ref(true)
const logsBusy = ref(false)
const logText = ref('')
const logPath = ref('')
const logOffset = ref(0)
const logMode = ref<'poll' | 'delta' | 'full'>('poll')

let logTimer: any = null
const refreshLogs = async () => {
  if (!agentEnabled.value) return
  if (logsBusy.value) return
  logsBusy.value = true
  try {
    if (logSource.value === 'config') {
      const r: any = await agentLogsAPI({ type: 'config', lines: logLines.value })
      logMode.value = 'full'
      logOffset.value = 0
      if (!r?.ok) {
        logText.value = r?.error || 'failed'
        return
      }
      logPath.value = r?.path || ''
      logText.value = decodeB64Utf8(r?.contentB64) || ''
      return
    }

    // Prefer efficient incremental follow (agent >= 0.5.3). Fallback to full polling on older agents.
    const r: any = await agentLogsFollowAPI({ type: logSource.value as any, lines: logLines.value, offset: logOffset.value })
    if (r?.ok) {
      logPath.value = r?.path || ''
      const chunk = decodeB64Utf8(r?.contentB64) || ''
      const mode = (r?.mode || 'delta') as 'full' | 'delta'
      logMode.value = mode
      const newOffset = typeof r?.offset === 'number' ? r.offset : logOffset.value
      const resetLike = logOffset.value === 0 || mode === 'full' || newOffset < logOffset.value
      if (resetLike) logText.value = chunk
      else logText.value = (logText.value || '') + chunk
      logOffset.value = newOffset

      // Keep last N lines (avoid runaway memory).
      const maxLines = Math.min(2000, Math.max(50, logLines.value || 200))
      const arr = (logText.value || '').split(/\r?\n/)
      if (arr.length > maxLines) logText.value = arr.slice(-maxLines).join('\n')
      return
    }

    // Fallback: full fetch
    const r2: any = await agentLogsAPI({ type: logSource.value, lines: logLines.value })
    logMode.value = 'poll'
    logOffset.value = 0
    if (!r2?.ok) {
      logText.value = r2?.error || 'failed'
      return
    }
    logPath.value = r2?.path || ''
    logText.value = decodeB64Utf8(r2?.contentB64) || ''
  } finally {
    logsBusy.value = false
  }
}

const forceRefreshLogs = () => {
  logOffset.value = 0
  logText.value = ''
  refreshLogs()
}


const stopTimer = () => {
  if (logTimer) {
    clearInterval(logTimer)
    logTimer = null
  }
}

const startTimer = () => {
  stopTimer()
  if (!logsAuto.value) return
  if (!agentEnabled.value) return
  logTimer = setInterval(() => {
    refreshLogs()
  }, 2000)
}

onMounted(() => {
  refreshAgentStatusLite()
  refreshLogs()
  startTimer()
  refreshFreshness()
  refreshProvidersPanel(false)
  checkUpstream()
  startUpstreamTimer()
})

onBeforeUnmount(() => {
  stopTimer()
  stopUpstreamTimer()
})

watch([logsAuto, logSource, logLines, agentEnabled], () => {
  logOffset.value = 0
  refreshLogs()
  startTimer()
})


// --- Data freshness (GEO files + filter policy files) ---
const { t } = useI18n()


// --- Shared users DB sync status (Source IP mapping) ---
const usersDbBusy = computed(() => usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing')

const usersDbBadge = computed(() => {
  if (!usersDbSyncEnabled.value) return { text: 'OFF', cls: 'badge-ghost' }
  if (!agentEnabled.value) return { text: t('localOnly'), cls: 'badge-ghost' }

  if (usersDbPhase.value === 'idle' && !usersDbLocalDirty.value) return { text: t('synced'), cls: 'badge-success' }
  if (usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing') return { text: t('running'), cls: 'badge-warning' }
  if (usersDbPhase.value === 'conflict') return { text: t('conflict'), cls: 'badge-warning' }
  if (usersDbPhase.value === 'offline') return { text: t('offline'), cls: 'badge-warning' }
  return { text: t('pendingChanges'), cls: 'badge-warning' }
})


const usersDbConflictSummary = computed(() => {
  const d = usersDbConflictDiff.value
  if (!d) return null
  return {
    labelsLocalOnly: d.labels.localOnly.length,
    labelsRemoteOnly: d.labels.remoteOnly.length,
    labelsChanged: d.labels.changed.length,
    urlsLocalOnly: d.urls.localOnly.length,
    urlsRemoteOnly: d.urls.remoteOnly.length,
    urlsChanged: d.urls.changed.length,
    iconsLocalOnly: (d as any).icons?.localOnly?.length || 0,
    iconsRemoteOnly: (d as any).icons?.remoteOnly?.length || 0,
    iconsChanged: (d as any).icons?.changed?.length || 0,
    tunnelsLocalOnly: d.tunnels.localOnly.length,
    tunnelsRemoteOnly: d.tunnels.remoteOnly.length,
    tunnelsChanged: d.tunnels.changed.length,
    userLimitsLocalOnly: d.userLimits.localOnly.length,
    userLimitsRemoteOnly: d.userLimits.remoteOnly.length,
    userLimitsChanged: d.userLimits.changed.length,
    sslDefaultChanged: d.ssl.defaultDays.changed ? 1 : 0,
    warnDaysChanged: d.ssl.providerDays.changed.length,
    safeAutoMerge: d.safeAutoMerge,
  }
})


// --- Users DB: smart conflict merge (per-row) ---
type SmartChoiceMode = 'local' | 'remote' | 'custom'
type SmartChoices = {
  labels: Record<string, { mode: SmartChoiceMode; customLabel?: string }>
  urls: Record<string, { mode: SmartChoiceMode; customUrl?: string }>
  icons: Record<string, { mode: SmartChoiceMode; customIcon?: string }>
  tunnels: Record<string, { mode: SmartChoiceMode; customDescription?: string }>
  warnDays: Record<string, { mode: SmartChoiceMode; customDays?: number }>
  sslDefault: { mode: SmartChoiceMode; customDays?: number }}

const usersDbSmartOpen = ref(false)
const usersDbSmartChoices = ref<SmartChoices>({
  labels: {},
  urls: {},
  icons: {},
  tunnels: {},
  warnDays: {},
  sslDefault: { mode: 'local' },
})

const initUsersDbSmartChoices = () => {
  const d = usersDbConflictDiff.value
  if (!d) return
  const labels: SmartChoices['labels'] = {}
  const urls: SmartChoices['urls'] = {}
  const icons: SmartChoices['icons'] = {}
  const tunnels: SmartChoices['tunnels'] = {}
  const warnDays: SmartChoices['warnDays'] = {}

  for (const it of d.labels.changed || []) labels[String(it.key)] = { mode: 'local' }
  for (const it of d.urls.changed || []) urls[String(it.provider)] = { mode: 'local' }
  for (const it of ((d as any).icons?.changed || []) as any[]) icons[String(it.provider)] = { mode: 'local' }
  for (const it of d.tunnels.changed || []) tunnels[String(it.name)] = { mode: 'local' }
  for (const it of d.ssl.providerDays.changed || []) warnDays[String(it.provider)] = { mode: 'local' }

  usersDbSmartChoices.value = {
    labels,
    urls,
    icons,
    tunnels,
    warnDays,
    sslDefault: { mode: 'local' },
  }
}

const usersDbSmartSetAll = (section: 'labels' | 'urls' | 'icons' | 'tunnels' | 'warnDays', mode: SmartChoiceMode) => {
  const v = usersDbSmartChoices.value
  const obj: any = (v as any)[section] || {}
  for (const k of Object.keys(obj)) {
    obj[k] = { ...(obj[k] || {}), mode }
  }
  ;(usersDbSmartChoices.value as any)[section] = obj
}

const usersDbSmartApply = async () => {
  const res = await usersDbResolveSmartMerge(usersDbSmartChoices.value as any)
  if (res?.ok) {
    usersDbSmartOpen.value = false
    showNotification({ content: 'done', type: 'alert-success', timeout: 1800 })
  } else {
    showNotification({ content: String(res?.error || 'operationFailed'), type: 'alert-error', timeout: 2600 })
  }
}

watch(
  () => usersDbSmartOpen.value,
  (v) => {
    if (v) initUsersDbSmartChoices()
  },
)

const usersDbModeMeta = (mode: SmartChoiceMode | undefined) => {
  if (mode === 'remote') return { mode: 'remote' as SmartChoiceMode, modeLabel: t('router') }
  if (mode === 'custom') return { mode: 'custom' as SmartChoiceMode, modeLabel: t('custom') }
  return { mode: 'local' as SmartChoiceMode, modeLabel: t('local') }
}

const usersDbReasonText = (mode: SmartChoiceMode, fallback?: 'local' | 'remote', customProvided = false) => {
  if (mode === 'remote') return t('usersDbReasonRouterSelected')
  if (mode === 'local') return t('usersDbReasonLocalSelected')
  if (customProvided) return t('usersDbReasonCustomApplied')
  if (fallback === 'remote') return t('usersDbReasonCustomFallbackRouter')
  return t('usersDbReasonCustomFallbackLocal')
}

const usersDbSectionLabel = (section: 'labels' | 'urls' | 'icons' | 'tunnels' | 'warnDays' | 'sslDefault' | 'userLimits') => {
  if (section === 'labels') return t('usersDbLabels')
  if (section === 'urls') return t('usersDbPanels')
  if (section === 'icons') return t('providerIcon')
  if (section === 'tunnels') return t('routerTrafficTunnelDescriptionsSettingsTitle')
  if (section === 'warnDays') return t('sslWarnDays')
  if (section === 'userLimits') return t('usersDbUserLimits')
  return t('sslWarnThreshold')
}

const fmtUserLimitMbps = (bps?: number) => {
  const n = Number(bps || 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${((n * 8) / (1024 ** 2)).toFixed(1)} Mbps`
}

const fmtUserLimitPeriod = (period?: string) => {
  if (period === '1d') return '24ч'
  if (period === 'month') return 'месяц'
  return '30д'
}

const usersDbNormalizeScope = (scope?: string[]) => {
  const ids = Array.isArray(scope) ? scope.map((it) => String(it || '').trim()).filter(Boolean) : []
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

const usersDbFormatScopeText = (scope?: string[]) => {
  const ids = usersDbNormalizeScope(scope)
  if (!ids.length) return t('all')
  return ids
    .map((id) => {
      const backend = backendList.value.find((it) => String(it?.uuid || '').trim() === id)
      return backend ? getLabelFromBackend(backend as any) : id
    })
    .join(', ')
}

const usersDbFormatLabelSummary = (label?: string, scope?: string[]) => {
  const safeLabel = String(label || '').trim() || '—'
  return `${safeLabel} · ${t('agentRestoreScope')}: ${usersDbFormatScopeText(scope)}`
}

const fmtUserLimitSummary = (limit?: UserLimit | null) => {
  const l = limit || {}
  const parts: string[] = []
  if (l.disabled) parts.push('ручная блокировка')
  if (l.enabled === false) parts.push('лимит выключен')
  if (typeof l.trafficLimitBytes === 'number' && Number.isFinite(l.trafficLimitBytes) && l.trafficLimitBytes > 0) {
    parts.push(`${t('trafficLimit')}: ${prettyBytesHelper(l.trafficLimitBytes)} / ${fmtUserLimitPeriod(l.trafficPeriod)}`)
  }
  if (typeof l.bandwidthLimitBps === 'number' && Number.isFinite(l.bandwidthLimitBps) && l.bandwidthLimitBps > 0) {
    parts.push(`${t('bandwidthLimit')}: ${fmtUserLimitMbps(l.bandwidthLimitBps)}`)
  }
  if (l.mac) parts.push(`MAC: ${l.mac}`)
  return parts.length ? parts.join(' · ') : '—'
}

const usersDbUserLimitReasonChanged = () => t('usersDbReasonUserLimitLocalWins')
const usersDbUserLimitReasonLocalOnly = () => t('usersDbReasonUserLimitLocalOnly')
const usersDbUserLimitReasonRouterOnly = () => t('usersDbReasonUserLimitRouterOnly')

const usersDbLabelChangedRows = computed(() => {
  const changed = usersDbConflictDiff.value?.labels?.changed || []
  return changed.map((it) => {
    const choice = usersDbSmartChoices.value.labels?.[it.key]
    const meta = usersDbModeMeta((choice?.mode || 'local') as SmartChoiceMode)
    const customValue = String(choice?.customLabel || '').trim()
    const resultLabel = meta.mode === 'remote'
      ? it.remote.label
      : meta.mode === 'custom'
        ? (customValue || it.local.label)
        : it.local.label
    const resultScope = meta.mode === 'remote' ? it.remote.scope : it.local.scope
    const reason = usersDbReasonText(meta.mode, customValue ? undefined : 'local', customValue.length > 0)
    return {
      key: it.key,
      remote: it.remote.label,
      local: it.local.label,
      remoteScope: usersDbNormalizeScope((it.remote as any)?.scope),
      localScope: usersDbNormalizeScope((it.local as any)?.scope),
      remoteScopeText: usersDbFormatScopeText((it.remote as any)?.scope),
      localScopeText: usersDbFormatScopeText((it.local as any)?.scope),
      resultLabel,
      resultScope: usersDbNormalizeScope(resultScope as any),
      resultScopeText: usersDbFormatScopeText(resultScope as any),
      resultSummary: usersDbFormatLabelSummary(resultLabel, resultScope as any),
      reason,
      mode: meta.mode,
      modeLabel: meta.modeLabel,
    }
  })
})

const usersDbUrlChangedRows = computed(() => {
  const changed = usersDbConflictDiff.value?.urls?.changed || []
  return changed.map((it) => {
    const choice = usersDbSmartChoices.value.urls?.[it.provider]
    const meta = usersDbModeMeta((choice?.mode || 'local') as SmartChoiceMode)
    const customValue = String(choice?.customUrl || '').trim()
    const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? (customValue || it.remote) : it.local
    const reason = usersDbReasonText(meta.mode, customValue ? undefined : 'remote', customValue.length > 0)
    return {
      provider: it.provider,
      remote: it.remote,
      local: it.local,
      result,
      reason,
      mode: meta.mode,
      modeLabel: meta.modeLabel,
    }
  })
})

const usersDbIconChangedRows = computed(() => {
  const changed = ((usersDbConflictDiff.value as any)?.icons?.changed || []) as Array<{ provider: string; local: string; remote: string }>
  return changed.map((it) => {
    const choice = usersDbSmartChoices.value.icons?.[it.provider]
    const meta = usersDbModeMeta((choice?.mode || 'local') as SmartChoiceMode)
    const customRaw = String(choice?.customIcon || '').trim()
    const customValue = normalizeProviderIcon(choice?.customIcon)
    const result = meta.mode === 'remote'
      ? it.remote
      : meta.mode === 'custom'
        ? (customValue || (customRaw === '' ? '' : it.remote))
        : it.local
    const reason = usersDbReasonText(meta.mode, undefined, meta.mode === 'custom' ? (customRaw === '' || customValue !== '') : false)
    return {
      provider: it.provider,
      remote: it.remote,
      local: it.local,
      result,
      reason,
      mode: meta.mode,
      modeLabel: meta.modeLabel,
    }
  })
})

const usersDbSslDefaultRow = computed(() => {
  const row = usersDbConflictDiff.value?.ssl?.defaultDays
  if (!row?.changed) return null
  const choice = usersDbSmartChoices.value.sslDefault
  const meta = usersDbModeMeta((choice?.mode || 'local') as SmartChoiceMode)
  const customValue = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
    ? Math.max(0, Math.min(365, Math.trunc(choice.customDays)))
    : row.local
  const result = meta.mode === 'remote' ? row.remote : meta.mode === 'custom' ? customValue : row.local
  const hasCustom = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
  return {
    remote: row.remote,
    local: row.local,
    result,
    reason: usersDbReasonText(meta.mode, hasCustom ? undefined : 'local', hasCustom),
    mode: meta.mode,
    modeLabel: meta.modeLabel,
  }
})

const usersDbWarnDaysChangedRows = computed(() => {
  const changed = usersDbConflictDiff.value?.ssl?.providerDays?.changed || []
  return changed.map((it) => {
    const choice = usersDbSmartChoices.value.warnDays?.[it.provider]
    const meta = usersDbModeMeta((choice?.mode || 'local') as SmartChoiceMode)
    const customValue = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
      ? Math.max(0, Math.min(365, Math.trunc(choice.customDays)))
      : it.local
    const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? customValue : it.local
    const hasCustom = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
    return {
      provider: it.provider,
      remote: it.remote,
      local: it.local,
      result,
      reason: usersDbReasonText(meta.mode, hasCustom ? undefined : 'local', hasCustom),
      mode: meta.mode,
      modeLabel: meta.modeLabel,
    }
  })
})

const usersDbTunnelWinnerMeta = (name: string) => {
  const key = String(name || '').trim().toLowerCase()
  const choice = (usersDbSmartChoices.value.tunnels || {})[key]
  const mode = (choice?.mode || 'local') as SmartChoiceMode
  return usersDbModeMeta(mode)
}

const usersDbTunnelChangedRows = computed(() => {
  const changed = usersDbConflictDiff.value?.tunnels?.changed || []
  return changed.map((it) => {
    const meta = usersDbTunnelWinnerMeta(it.name)
    const key = String(it.name || '').trim().toLowerCase()
    const customValue = String(usersDbSmartChoices.value.tunnels?.[key]?.customDescription || '').trim()
    const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? (customValue || it.local) : it.local
    return {
      name: it.name,
      remote: it.remote,
      local: it.local,
      result,
      reason: usersDbReasonText(meta.mode, customValue ? undefined : 'local', customValue.length > 0),
      mode: meta.mode,
      modeLabel: meta.modeLabel,
    }
  })
})

const usersDbUserLimitChangedRows = computed(() => {
  const changed = usersDbConflictDiff.value?.userLimits?.changed || []
  return changed.map((it) => ({
    user: it.user,
    remote: fmtUserLimitSummary(it.remote),
    local: fmtUserLimitSummary(it.local),
    result: fmtUserLimitSummary(it.local),
    reason: usersDbUserLimitReasonChanged(),
    mode: 'local' as SmartChoiceMode,
    modeLabel: t('local'),
  }))
})

const usersDbSmartPreviewRows = computed(() => {
  const rows: Array<{
    section: 'labels' | 'urls' | 'icons' | 'tunnels' | 'warnDays' | 'sslDefault' | 'userLimits'
    sectionLabel: string
    key: string
    result: string | number
    resultText: string
    mode: SmartChoiceMode
    modeLabel: string
    reason: string
  }> = []

  for (const row of usersDbLabelChangedRows.value) {
    rows.push({
      section: 'labels',
      sectionLabel: usersDbSectionLabel('labels'),
      key: row.key,
      result: row.resultLabel,
      resultText: row.resultSummary,
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  for (const row of usersDbUrlChangedRows.value) {
    rows.push({
      section: 'urls',
      sectionLabel: usersDbSectionLabel('urls'),
      key: row.provider,
      result: row.result,
      resultText: row.result || '—',
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  for (const row of usersDbIconChangedRows.value) {
    rows.push({
      section: 'icons',
      sectionLabel: usersDbSectionLabel('icons'),
      key: row.provider,
      result: row.result,
      resultText: fmtProviderIcon(row.result),
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  for (const row of usersDbTunnelChangedRows.value) {
    rows.push({
      section: 'tunnels',
      sectionLabel: usersDbSectionLabel('tunnels'),
      key: row.name,
      result: row.result,
      resultText: row.result || '—',
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  if (usersDbSslDefaultRow.value) {
    rows.push({
      section: 'sslDefault',
      sectionLabel: usersDbSectionLabel('sslDefault'),
      key: 'sslNearExpiryDaysDefault',
      result: usersDbSslDefaultRow.value.result,
      resultText: String(usersDbSslDefaultRow.value.result),
      mode: usersDbSslDefaultRow.value.mode,
      modeLabel: usersDbSslDefaultRow.value.modeLabel,
      reason: usersDbSslDefaultRow.value.reason,
    })
  }
  for (const row of usersDbWarnDaysChangedRows.value) {
    rows.push({
      section: 'warnDays',
      sectionLabel: usersDbSectionLabel('warnDays'),
      key: row.provider,
      result: row.result,
      resultText: String(row.result),
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  for (const row of usersDbUserLimitChangedRows.value) {
    rows.push({
      section: 'userLimits',
      sectionLabel: usersDbSectionLabel('userLimits'),
      key: row.user,
      result: row.result,
      resultText: row.result,
      mode: row.mode,
      modeLabel: row.modeLabel,
      reason: row.reason,
    })
  }
  for (const row of (usersDbConflictDiff.value?.userLimits?.localOnly || [])) {
    rows.push({
      section: 'userLimits',
      sectionLabel: usersDbSectionLabel('userLimits'),
      key: row.user,
      result: fmtUserLimitSummary(row.local),
      resultText: fmtUserLimitSummary(row.local),
      mode: 'local',
      modeLabel: t('local'),
      reason: usersDbUserLimitReasonLocalOnly(),
    })
  }
  for (const row of (usersDbConflictDiff.value?.userLimits?.remoteOnly || [])) {
    rows.push({
      section: 'userLimits',
      sectionLabel: usersDbSectionLabel('userLimits'),
      key: row.user,
      result: fmtUserLimitSummary(row.remote),
      resultText: fmtUserLimitSummary(row.remote),
      mode: 'remote',
      modeLabel: t('router'),
      reason: usersDbUserLimitReasonRouterOnly(),
    })
  }
  return rows
})

const usersDbSmartPreviewStats = computed(() => {
  const d: any = usersDbConflictDiff.value as any
  const rows = usersDbSmartPreviewRows.value
  if (!d) return { changedRows: 0, changedSections: 0, localOnlyRows: 0, routerOnlyRows: 0 }
  const changedSections = new Set(rows.map((row) => row.section)).size
  const localOnlyRows = (d.labels?.localOnly?.length || 0) + (d.urls?.localOnly?.length || 0) + (d.icons?.localOnly?.length || 0) + (d.tunnels?.localOnly?.length || 0) + (d.ssl?.providerDays?.localOnly?.length || 0) + (d.userLimits?.localOnly?.length || 0)
  const routerOnlyRows = (d.labels?.remoteOnly?.length || 0) + (d.urls?.remoteOnly?.length || 0) + (d.icons?.remoteOnly?.length || 0) + (d.tunnels?.remoteOnly?.length || 0) + (d.ssl?.providerDays?.remoteOnly?.length || 0) + (d.userLimits?.remoteOnly?.length || 0)
  const changedRows = (d.labels?.changed?.length || 0) + (d.urls?.changed?.length || 0) + (d.icons?.changed?.length || 0) + (d.tunnels?.changed?.length || 0) + (d.ssl?.providerDays?.changed?.length || 0) + (d.ssl?.defaultDays?.changed ? 1 : 0) + (d.userLimits?.changed?.length || 0)
  return {
    changedRows,
    changedSections,
    localOnlyRows,
    routerOnlyRows,
  }
})

const usersDbConflictPreview = computed(() => {
  const d: any = usersDbConflictDiff.value as any
  const summary = usersDbConflictSummary.value
  if (!d || !summary) return null
  return {
    generatedAt: dayjs().toISOString(),
    summary,
    applyPreview: {
      stats: usersDbSmartPreviewStats.value,
      rows: usersDbSmartPreviewRows.value,
    },
    changed: {
      labels: usersDbLabelChangedRows.value,
      panels: usersDbUrlChangedRows.value,
      icons: usersDbIconChangedRows.value,
      tunnels: usersDbTunnelChangedRows.value,
      sslDefault: usersDbSslDefaultRow.value,
      sslWarnDays: usersDbWarnDaysChangedRows.value,
      userLimits: usersDbUserLimitChangedRows.value,
    },
    localOnly: {
      labels: d.labels?.localOnly || [],
      panels: d.urls?.localOnly || [],
      icons: d.icons?.localOnly || [],
      tunnels: d.tunnels?.localOnly || [],
      sslWarnDays: d.ssl?.providerDays?.localOnly || [],
      userLimits: (d.userLimits?.localOnly || []).map((it: any) => ({ user: it.user, summary: fmtUserLimitSummary(it.local), raw: it.local })),
    },
    routerOnly: {
      labels: d.labels?.remoteOnly || [],
      panels: d.urls?.remoteOnly || [],
      icons: d.icons?.remoteOnly || [],
      tunnels: d.tunnels?.remoteOnly || [],
      sslWarnDays: d.ssl?.providerDays?.remoteOnly || [],
      userLimits: (d.userLimits?.remoteOnly || []).map((it: any) => ({ user: it.user, summary: fmtUserLimitSummary(it.remote), raw: it.remote })),
    },
  }
})

const usersDbConflictPreviewText = computed(() => {
  const p = usersDbConflictPreview.value
  return p ? JSON.stringify(p, null, 2) : ''
})

watch(usersDbHasConflict, (v) => {
  if (!v) usersDbSmartOpen.value = false
})

const refreshUsersDbHistory = async () => {
  if (!agentEnabled.value || !usersDbSyncEnabled.value) return
  await usersDbFetchHistory()
}

watch([agentEnabled, usersDbSyncEnabled], () => {
  refreshUsersDbHistory()
})

// --- Users DB history: read-only revision preview (no restore) ---
const usersDbViewBusy = ref(false)
const usersDbViewError = ref('')
const usersDbViewRev = ref<number>(0)
const usersDbViewUpdatedAt = ref('')
const usersDbViewPayload = ref<any | null>(null)
const usersDbViewRawText = ref('')

const extractUsersDbPayloadView = (v: any) => {
  const labels =
    Array.isArray(v?.labels) ? v.labels : Array.isArray(v?.sourceIPLabels) ? v.sourceIPLabels : Array.isArray(v?.sourceIPLabelList) ? v.sourceIPLabelList : []

  const providerPanelUrls =
    v?.providerPanelUrls && typeof v.providerPanelUrls === 'object'
      ? v.providerPanelUrls
      : v?.proxyProviderPanelUrls && typeof v.proxyProviderPanelUrls === 'object'
        ? v.proxyProviderPanelUrls
        : v?.proxyProviderPanelUrlMap && typeof v.proxyProviderPanelUrlMap === 'object'
          ? v.proxyProviderPanelUrlMap
          : {}

  const providerIcons =
    v?.providerIcons && typeof v.providerIcons === 'object'
      ? v.providerIcons
      : v?.proxyProviderIcons && typeof v.proxyProviderIcons === 'object'
        ? v.proxyProviderIcons
        : v?.proxyProviderIconMap && typeof v.proxyProviderIconMap === 'object'
          ? v.proxyProviderIconMap
          : {}

  const sslNearExpiryDaysDefault =
    typeof v?.sslNearExpiryDaysDefault === 'number'
      ? v.sslNearExpiryDaysDefault
      : typeof v?.sslNearExpiryDaysDefault === 'string'
        ? Number(v.sslNearExpiryDaysDefault)
        : 2

  const providerSslWarnDaysMap =
    v?.providerSslWarnDaysMap && typeof v.providerSslWarnDaysMap === 'object'
      ? v.providerSslWarnDaysMap
      : v?.proxyProviderSslWarnDaysMap && typeof v.proxyProviderSslWarnDaysMap === 'object'
        ? v.proxyProviderSslWarnDaysMap
        : v?.providerSslWarnDays && typeof v.providerSslWarnDays === 'object'
          ? v.providerSslWarnDays
          : {}

  const tunnelInterfaceDescriptions =
    v?.tunnelInterfaceDescriptions && typeof v.tunnelInterfaceDescriptions === 'object'
      ? v.tunnelInterfaceDescriptions
      : v?.tunnelInterfaceDescriptionMap && typeof v.tunnelInterfaceDescriptionMap === 'object'
        ? v.tunnelInterfaceDescriptionMap
        : {}

  const userLimitsMap =
    v?.userLimits && typeof v.userLimits === 'object'
      ? v.userLimits
      : {}

  const cleanUrlMap: Record<string, string> = {}
  try {
    for (const [k, vv] of Object.entries(providerPanelUrls || {})) {
      const kk = String(k || '').trim()
      const vvv = String(vv || '').trim()
      if (!kk || !vvv) continue
      cleanUrlMap[kk] = vvv
    }
  } catch {
    // ignore
  }

  const cleanIconMap: Record<string, string> = {}
  try {
    for (const [k, vv] of Object.entries(providerIcons || {})) {
      const kk = String(k || '').trim()
      const nv = normalizeProviderIcon(vv)
      if (!kk || !nv) continue
      cleanIconMap[kk] = nv
    }
  } catch {
    // ignore
  }

  const cleanWarnMap: Record<string, number> = {}
  try {
    for (const [k, vv] of Object.entries(providerSslWarnDaysMap || {})) {
      const kk = String(k || '').trim()
      const n = typeof vv === 'number' ? vv : typeof vv === 'string' ? Number(vv) : NaN
      if (!kk || !Number.isFinite(n)) continue
      cleanWarnMap[kk] = Math.max(0, Math.min(365, Math.trunc(n)))
    }
  } catch {
    // ignore
  }

  const sslDef = Number.isFinite(sslNearExpiryDaysDefault) ? Math.max(0, Math.min(365, Math.trunc(sslNearExpiryDaysDefault))) : 2

  const cleanTunnelMap: Record<string, string> = {}
  try {
    for (const [k, vv] of Object.entries(tunnelInterfaceDescriptions || {})) {
      const kk = String(k || '').trim().toLowerCase()
      const vvv = String(vv || '').trim()
      if (!kk || !vvv) continue
      cleanTunnelMap[kk] = vvv
    }
  } catch {
    // ignore
  }

  const cleanUserLimits: Record<string, UserLimit> = {}
  try {
    for (const [k, vv] of Object.entries(userLimitsMap || {})) {
      const kk = String(k || '').trim()
      if (!kk || !vv || typeof vv !== 'object' || Array.isArray(vv)) continue
      cleanUserLimits[kk] = { ...(vv as UserLimit) }
    }
  } catch {
    // ignore
  }

  return {
    labels: Array.isArray(labels) ? labels : [],
    providerPanelUrls: cleanUrlMap,
    providerIcons: cleanIconMap,
    sslNearExpiryDaysDefault: sslDef,
    providerSslWarnDaysMap: cleanWarnMap,
    tunnelInterfaceDescriptions: cleanTunnelMap,
    userLimits: cleanUserLimits,
  }
}

const usersDbViewNormalized = computed(() => {
  if (!usersDbViewPayload.value || typeof usersDbViewPayload.value !== 'object') return null
  return extractUsersDbPayloadView(usersDbViewPayload.value)
})

const usersDbViewSummary = computed(() => {
  const p = usersDbViewNormalized.value
  if (!p) return null
  return {
    labels: Array.isArray(p.labels) ? p.labels.length : 0,
    panels: p.providerPanelUrls ? Object.keys(p.providerPanelUrls).length : 0,
    icons: (p as any).providerIcons ? Object.keys((p as any).providerIcons).length : 0,
    sslDefault: p.sslNearExpiryDaysDefault,
    warnMap: p.providerSslWarnDaysMap ? Object.keys(p.providerSslWarnDaysMap).length : 0,
    tunnels: (p as any).tunnelInterfaceDescriptions ? Object.keys((p as any).tunnelInterfaceDescriptions).length : 0,
    userLimits: (p as any).userLimits ? Object.keys((p as any).userLimits).length : 0,
  }
})

const usersDbViewJsonText = computed(() => {
  if (!usersDbViewRev.value) return ''
  if (usersDbViewPayload.value) {
    try {
      return JSON.stringify(usersDbViewPayload.value, null, 2)
    } catch {
      return usersDbViewRawText.value || ''
    }
  }
  return usersDbViewRawText.value || ''
})

const usersDbCloseRevPreview = () => {
  usersDbViewRev.value = 0
  usersDbViewUpdatedAt.value = ''
  usersDbViewError.value = ''
  usersDbViewPayload.value = null
  usersDbViewRawText.value = ''
  usersDbViewBusy.value = false
}

watch([agentEnabled], () => {
  if (!agentEnabled.value) usersDbCloseRevPreview()
})

const usersDbOpenRevPreview = async (rev: number) => {
  const r = Number(rev) || 0
  if (!r || !agentEnabled.value) return

  usersDbViewRev.value = r
  usersDbViewUpdatedAt.value = ''
  usersDbViewError.value = ''
  usersDbViewPayload.value = null
  usersDbViewRawText.value = ''

  usersDbViewBusy.value = true
  try {
    const res = await agentUsersDbGetRevAPI(r)
    if (!res || !res.ok) {
      usersDbViewError.value = String(res?.error || 'operationFailed')
      return
    }
    usersDbViewUpdatedAt.value = String(res.updatedAt || '')
    const raw = decodeB64Utf8(res.contentB64 || '')
    usersDbViewRawText.value = raw
    try {
      usersDbViewPayload.value = raw ? JSON.parse(raw) : null
    } catch {
      usersDbViewPayload.value = null
    }
  } finally {
    usersDbViewBusy.value = false
  }
}

const copyTextToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  }
}

const copyUsersDbViewJson = async () => {
  const text = String(usersDbViewJsonText.value || '')
  if (!text) return
  await copyTextToClipboard(text)
}

const copyUsersDbViewLabels = async () => {
  const p = usersDbViewNormalized.value
  if (!p) return
  await copyTextToClipboard(JSON.stringify(p.labels || [], null, 2))
}

const copyUsersDbViewPanels = async () => {
  const p = usersDbViewNormalized.value
  if (!p) return
  await copyTextToClipboard(JSON.stringify(p.providerPanelUrls || {}, null, 2))
}

const copyUsersDbViewIcons = async () => {
  const p: any = usersDbViewNormalized.value as any
  if (!p) return
  await copyTextToClipboard(JSON.stringify(p.providerIcons || {}, null, 2))
}

const copyUsersDbConflictPreview = async () => {
  const text = String(usersDbConflictPreviewText.value || '')
  if (!text) return
  await copyTextToClipboard(text)
}

const exportUsersDbConflictPreview = () => {
  try {
    const text = String(usersDbConflictPreviewText.value || '')
    if (!text) return
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zash-usersdb-conflict-preview-${dayjs().format('YYYYMMDD-HHmmss')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showNotification({ content: 'done', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  }
}

// --- Top rules -> open Topology with filter (stage R) ---
const normalizeRulePart = (s: string) => (s || '').trim() || '-'

const topHitRules = computed(() => {
  const entries = Array.from(ruleHitMap.value.entries() || [])
    .map(([key, hits]) => {
      const parts = String(key).split('\0')
      const type = normalizeRulePart(parts[0] || '')
      const payloadRaw = String(parts[1] || '').trim()
      const ruleText = payloadRaw ? `${type}: ${normalizeRulePart(payloadRaw)}` : type
      return { key: String(key), ruleText, hits: Number(hits) || 0 }
    })
    .filter((x) => x.ruleText && x.ruleText !== '-')
    .sort((a, b) => b.hits - a.hits)
  return entries.slice(0, 20)
})

const openTopologyWithRule = async (ruleText: string, mode: 'none' | 'only' | 'exclude' = 'only') => {
  const value = String(ruleText || '').trim()
  if (!value) return
  await navigateToTopology(router as any, { stage: 'R', value }, mode)
}

const lastFreshnessOkAt = useStorage<number>('runtime/tasks-last-freshness-ok-at-v1', 0)

type GeoUpdateResult = {
  // When the update operation was triggered from UI
  ranAt: number
  // Best-effort timestamp of the actual data on disk (file mtime, seconds)
  dataAtSec?: number
  ok: boolean
  items: Array<{
    kind: string
    path: string
    ok?: boolean
    changed?: boolean
    mtimeSec?: number
    sizeBytes?: number
    method?: string
    source?: string
    error?: string
  }>
  note?: string
}

const lastGeoUpdate = useStorage<GeoUpdateResult>('runtime/tasks-last-geo-update-v1', {
  ranAt: 0,
  dataAtSec: 0,
  ok: true,
  items: [],
  note: '',
})

type RuleProvidersUpdateResult = {
  // When the update operation was triggered from UI
  ranAt: number
  // Best-effort timestamp of the actual data (newest provider updatedAt)
  dataAt?: string
  ok: boolean
  total: number
  okCount: number
  failCount: number
  items: Array<{
    name: string
    ok: boolean
    changed: boolean
    beforeUpdatedAt?: string
    afterUpdatedAt?: string
    durationMs?: number
    error?: string
  }>
}

const lastRuleProvidersUpdate = useStorage<RuleProvidersUpdateResult>('runtime/tasks-last-rule-providers-update-v1', {
  ranAt: 0,
  dataAt: '',
  ok: true,
  total: 0,
  okCount: 0,
  failCount: 0,
  items: [],
})
type GeoInfoItem = {
  kind: string
  path: string
  exists: boolean
  mtimeSec?: number
  sizeBytes?: number
}

const geoBusy = ref(false)
const geoError = ref('')
const geoItems = ref<GeoInfoItem[]>([])

const providersBusy = ref(false)
const providersError = ref('')
const ruleProviders = ref<RuleProvider[]>([])

const sortedProviders = computed(() => {
  return [...(ruleProviders.value || [])].sort((a, b) => {
    const ta = dayjs(a.updatedAt).valueOf()
    const tb = dayjs(b.updatedAt).valueOf()
    return tb - ta
  })
})

const newestProviderAt = computed(() => sortedProviders.value[0]?.updatedAt || '')
const oldestProviderAt = computed(() => {
  const arr = [...(ruleProviders.value || [])].sort(
    (a, b) => dayjs(a.updatedAt).valueOf() - dayjs(b.updatedAt).valueOf(),
  )
  return arr[0]?.updatedAt || ''
})

const geoKindLabel = (kind: string) => {
  const k = (kind || '').toLowerCase()
  if (k === 'geoip') return t('geoipFile')
  if (k === 'geosite') return t('geositeFile')
  if (k === 'asn') return t('asnMmdbFile')
  if (k === 'mmdb') return t('mmdbFile')
  return kind || '—'
}

const fmtMtime = (mtimeSec?: number) => {
  if (!mtimeSec || !Number.isFinite(mtimeSec)) return '—'
  return dayjs.unix(mtimeSec).format('DD-MM-YYYY HH:mm:ss')
}

const fmtUpdatedAt = (s?: string) => {
  const d = dayjs(s || '')
  if (!d.isValid()) return '—'
  return d.format('DD-MM-YYYY HH:mm:ss')
}

const shortPath = (p?: string) => {
  const s = (p || '').trim()
  if (!s) return '—'
  const parts = s.split('/').filter(Boolean)
  if (parts.length <= 3) return s
  return `…/${parts.slice(-3).join('/')}`
}

const refreshGeoInfo = async () => {
  geoError.value = ''
  geoItems.value = []
  if (!agentEnabled.value) return
  geoBusy.value = true
  try {
    const r: any = await agentGeoInfoAPI()
    if (!r?.ok) {
      geoError.value = r?.error || 'failed'
      return
    }
    const items = Array.isArray(r?.items) ? r.items : []
    geoItems.value = items
      .filter((x: any) => x && x.path)
      .map((x: any) => ({
        kind: String(x.kind || ''),
        path: String(x.path || ''),
        exists: !!x.exists,
        mtimeSec:
          typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
        sizeBytes:
          typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
      }))
      .filter((x) => x.exists)
      .sort((a, b) => (a.kind || '').localeCompare(b.kind || ''))
  } catch (e: any) {
    geoError.value = e?.message || 'failed'
  } finally {
    geoBusy.value = false
  }
}

const refreshRuleProviders = async () => {
  providersBusy.value = true
  providersError.value = ''
  try {
    const { data } = await fetchRuleProvidersAPI()
    ruleProviders.value = Object.values((data as any)?.providers || {})
  } catch (e: any) {
    ruleProviders.value = []
    providersError.value = e?.message || 'failed'
  } finally {
    providersBusy.value = false
  }
}

// Local rules directory (XKeen/mihomo rules folder)
const rulesBusy = ref(false)
const rulesError = ref('')
const rulesDir = ref('')
const rulesCount = ref(0)
const rulesNewest = ref<number | undefined>(undefined)
const rulesOldest = ref<number | undefined>(undefined)
const rulesItems = ref<Array<{ name: string; path: string; mtimeSec?: number; sizeBytes?: number }>>([])

const refreshRulesInfo = async () => {
  rulesError.value = ''
  rulesDir.value = ''
  rulesCount.value = 0
  rulesNewest.value = undefined
  rulesOldest.value = undefined
  rulesItems.value = []
  if (!agentEnabled.value) return
  rulesBusy.value = true
  try {
    const r: any = await agentRulesInfoAPI()
    if (!r?.ok) {
      rulesError.value = r?.error || 'failed'
      return
    }
    rulesDir.value = String(r?.dir || '')
    rulesCount.value = Number(r?.count || 0) || 0
    const newest = typeof r?.newestMtimeSec === 'number' ? r.newestMtimeSec : Number(r?.newestMtimeSec || 0) || 0
    const oldest = typeof r?.oldestMtimeSec === 'number' ? r.oldestMtimeSec : Number(r?.oldestMtimeSec || 0) || 0
    rulesNewest.value = newest > 0 ? newest : undefined
    rulesOldest.value = oldest > 0 ? oldest : undefined
    const items = Array.isArray(r?.items) ? r.items : []
    rulesItems.value = items
      .filter((x: any) => x && x.path)
      .map((x: any) => ({
        name: String(x.name || ''),
        path: String(x.path || ''),
        mtimeSec: typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
        sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
      }))
  } catch (e: any) {
    rulesError.value = e?.message || 'failed'
  } finally {
    rulesBusy.value = false
  }
}

const freshnessBusy = computed(() => geoBusy.value || providersBusy.value || rulesBusy.value)
const refreshFreshness = async () => {
  await Promise.all([refreshGeoInfo(), refreshRuleProviders(), refreshRulesInfo()])

  const okProviders = !providersError.value
  const okGeo = !agentEnabled.value || !geoError.value
  const okRules = !agentEnabled.value || !rulesError.value
  if (okProviders && okGeo && okRules) {
    lastFreshnessOkAt.value = Date.now()
  }
}


// --- Upstream tracking (GitHub: Zephyruso/zashboard) ---
const upstreamRepo = 'Zephyruso/zashboard'
const upstreamRepoUrl = 'https://github.com/Zephyruso/zashboard'
const upstreamApiBase = 'https://api.github.com/repos/Zephyruso/zashboard'

type UpstreamLatest = {
  releaseTag: string
  releasePublishedAt: string
  releaseUrl: string
  commitSha: string
  commitDate: string
  commitMessage: string
  commitUrl: string
}

const upstreamLatest = useStorage<UpstreamLatest>('runtime/tasks-upstream-latest-v1', {
  releaseTag: '',
  releasePublishedAt: '',
  releaseUrl: '',
  commitSha: '',
  commitDate: '',
  commitMessage: '',
  commitUrl: '',
})

const upstreamReviewed = useStorage<{ releaseTag: string; commitSha: string; reviewedAt: number }>(
  'runtime/tasks-upstream-reviewed-v1',
  { releaseTag: '', commitSha: '', reviewedAt: 0 },
)

const upstreamCheckedAt = useStorage<number>('runtime/tasks-upstream-checked-at-v1', 0)
const upstreamLastNotifiedKey = useStorage<string>('runtime/tasks-upstream-last-notified-v1', '')
const upstreamBusy = ref(false)
const upstreamError = ref('')

const upstreamHasNew = computed(() => {
  const newRelease =
    !!upstreamLatest.value.releaseTag &&
    !!upstreamReviewed.value.releaseTag &&
    upstreamLatest.value.releaseTag !== upstreamReviewed.value.releaseTag
  const newCommit =
    !!upstreamLatest.value.commitSha &&
    !!upstreamReviewed.value.commitSha &&
    upstreamLatest.value.commitSha !== upstreamReviewed.value.commitSha
  // If user hasn't marked reviewed yet, still show NEW when we have data.
  const neverReviewed = !upstreamReviewed.value.releaseTag && !upstreamReviewed.value.commitSha
  return neverReviewed ? !!(upstreamLatest.value.releaseTag || upstreamLatest.value.commitSha) : newRelease || newCommit
})

const shortSha = (sha?: string) => (sha || '').trim().slice(0, 7)

const fmtIso = (iso?: string) => {
  const d = dayjs(iso || '')
  if (!d.isValid()) return '—'
  return d.format('DD-MM-YYYY HH:mm:ss')
}

const upstreamCompareReleaseUrl = computed(() => {
  const a = (upstreamReviewed.value.releaseTag || '').trim()
  const b = (upstreamLatest.value.releaseTag || '').trim()
  if (!a || !b || a === b) return ''
  return `https://github.com/Zephyruso/zashboard/compare/${encodeURIComponent(a)}...${encodeURIComponent(b)}`
})

const upstreamCompareCommitUrl = computed(() => {
  const a = (upstreamReviewed.value.commitSha || '').trim()
  const b = (upstreamLatest.value.commitSha || '').trim()
  if (!a || !b || a === b) return ''
  return `https://github.com/Zephyruso/zashboard/compare/${encodeURIComponent(a)}...${encodeURIComponent(b)}`
})

const checkUpstream = async () => {
  if (upstreamBusy.value) return
  upstreamBusy.value = true
  upstreamError.value = ''
  try {
    const ghFetch = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
      })

      // Rate limit hint
      const remaining = res.headers.get('x-ratelimit-remaining')
      if (res.status === 403 && remaining === '0') {
        throw new Error(t('githubRateLimited'))
      }

      if (!res.ok) {
        throw new Error(`${t('operationFailed')}: ${res.status}`)
      }
      return res.json()
    }

    const [rel, commits] = await Promise.all([
      ghFetch(`${upstreamApiBase}/releases/latest`),
      ghFetch(`${upstreamApiBase}/commits?per_page=1`),
    ])

    const latestReleaseTag = String(rel?.tag_name || '')
    const latestReleaseAt = String(rel?.published_at || rel?.created_at || '')
    const latestReleaseUrl = String(rel?.html_url || '')

    const c0 = Array.isArray(commits) ? commits[0] : commits
    const latestCommitSha = String(c0?.sha || '')
    const latestCommitDate = String(c0?.commit?.committer?.date || c0?.commit?.author?.date || '')
    const latestCommitMessage = String(c0?.commit?.message || '').split('\n')[0]
    const latestCommitUrl = String(c0?.html_url || '')

    upstreamLatest.value = {
      releaseTag: latestReleaseTag,
      releasePublishedAt: latestReleaseAt,
      releaseUrl: latestReleaseUrl,
      commitSha: latestCommitSha,
      commitDate: latestCommitDate,
      commitMessage: latestCommitMessage,
      commitUrl: latestCommitUrl,
    }

    upstreamCheckedAt.value = Date.now()

    // Notify only once per new release tag (or commit if no tag)
    const notifyKey = latestReleaseTag || latestCommitSha
    if (upstreamHasNew.value && notifyKey && upstreamLastNotifiedKey.value !== notifyKey) {
      upstreamLastNotifiedKey.value = notifyKey
      showNotification({ content: 'upstreamUpdateAvailable', type: 'alert-warning', timeout: 2600 })
    }
  } catch (e: any) {
    upstreamError.value = e?.message || 'failed'
  } finally {
    upstreamBusy.value = false
  }
}

const markUpstreamReviewed = () => {
  upstreamReviewed.value = {
    releaseTag: upstreamLatest.value.releaseTag || upstreamReviewed.value.releaseTag || '',
    commitSha: upstreamLatest.value.commitSha || upstreamReviewed.value.commitSha || '',
    reviewedAt: Date.now(),
  }
  showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
}

let upstreamTimer: any = null
const startUpstreamTimer = () => {
  stopUpstreamTimer()
  // While Tasks page is open: check every 6 hours.
  upstreamTimer = setInterval(() => {
    checkUpstream()
  }, 6 * 60 * 60 * 1000)
}

const stopUpstreamTimer = () => {
  if (upstreamTimer) {
    clearInterval(upstreamTimer)
    upstreamTimer = null
  }
}

// --- Diagnostics report ---
const diagBusy = ref(false)

const buildDiagnostics = async () => {
  const ts = new Date().toISOString()
  const agentStatus = await agentStatusAPI()

  const takeLog = async (type: 'mihomo' | 'agent' | 'config') => {
    const r: any = await agentLogsAPI({ type, lines: 200 })
    return {
      ok: !!r?.ok,
      path: r?.path || '',
      content: decodeB64Utf8(r?.contentB64) || (r?.error || ''),
    }
  }

  const logs = {
    mihomo: await takeLog('mihomo'),
    agent: await takeLog('agent'),
    config: await takeLog('config'),
  }

  const blocked = [] as any[]
  const keys = Object.keys(userLimits.value || {})
  for (const u of keys) {
    const st = getUserLimitState(u)
    if (st.blocked) {
      blocked.push({
        user: u,
        reasonManual: !!st.limit.disabled,
        trafficExceeded: !!st.trafficExceeded,
        bandwidthExceeded: !!st.bandwidthExceeded,
        usageBytes: st.usageBytes,
        trafficLimitBytes: st.limit.trafficLimitBytes || 0,
        bandwidthLimitBps: st.limit.bandwidthLimitBps || 0,
        mac: st.limit.mac || '',
      })
    }
  }

  return {
    kind: 'zash-diagnostics',
    generatedAt: ts,
    uiVersion: zashboardVersion.value,
    coreVersion: coreVersion.value,
    backend: activeBackend.value ? {
      label: activeBackend.value.label,
      host: activeBackend.value.host,
      port: activeBackend.value.port,
      protocol: activeBackend.value.protocol,
      secondaryPath: activeBackend.value.secondaryPath,
    } : null,
    agent: {
      enabled: !!agentEnabled.value,
      url: agentUrl.value,
      status: agentStatus,
    },
    limits: {
      autoDisconnectLimitedUsers: !!autoDisconnectLimitedUsers.value,
      hardBlockLimitedUsers: !!hardBlockLimitedUsers.value,
      managedLanDisallowedCidrs: managedLanDisallowedCidrs.value || [],
      profiles: userLimitProfiles.value || [],
      snapshotsCount: (userLimitSnapshots.value || []).length,
      userLimits: userLimits.value || {},
      blockedUsers: blocked,
    },
    connections: {
      activeCount: (activeConnections.value || []).length,
    },
    logs,
    ua: navigator.userAgent,
  }
}

const downloadDiagnostics = async () => {
  if (diagBusy.value) return
  diagBusy.value = true
  try {
    const rep = await buildDiagnostics()
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zash-diagnostics-${dayjs().format('YYYYMMDD-HHmmss')}.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    diagBusy.value = false
  }
}

const copyDiagnostics = async () => {
  if (diagBusy.value) return
  diagBusy.value = true
  try {
    const rep = await buildDiagnostics()
    const text = JSON.stringify(rep, null, 2)
    await navigator.clipboard.writeText(text)
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    diagBusy.value = false
  }
}

const fmtTime = (ts: number) => dayjs(ts).format('HH:mm:ss')
const fmtMs = (ms: number) => {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const applyEnforcement = async () => {
  if (busy.value) return
  busy.value = true
  try {
    const id = startJob('Apply limits & blocks')
    try {
      await applyUserEnforcementNow()
      finishJob(id, { ok: true })
      showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
    } catch (e: any) {
      finishJob(id, { ok: false, error: e?.message || 'failed' })
      showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
    }
  } finally {
    busy.value = false
  }
}

const refreshSsl = async () => {
  if (busy.value) return
  if (!agentEnabled.value) {
    showNotification({ content: 'agentDisabled', type: 'alert-warning', timeout: 2000 })
    return
  }
  busy.value = true
  try {
    const id = startJob('Refresh providers SSL')
    try {
      await probePanelSsl(true)
      const n = Object.keys(panelSslNotAfterByName.value || {}).length
      finishJob(id, { ok: true, meta: { probed: n } })
      showNotification({ content: 'sslRefreshed', type: 'alert-success', timeout: 1600 })
    } catch (e: any) {
      finishJob(id, { ok: false, error: e?.message || 'failed' })
      showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
    }
  } finally {
    busy.value = false
  }
}


// --- Data refresh operations (panel) ---
const geoUpdateBusy = ref(false)
const providersUpdateBusy = ref(false)
const rulesRescanBusy = ref(false)

const updateGeoNow = async () => {
  if (!agentEnabled.value) {
    showNotification({ content: 'agentDisabled', type: 'alert-warning', timeout: 2000 })
    return
  }
  if (geoUpdateBusy.value) return
  geoUpdateBusy.value = true
  const id = startJob(t('updateGeoNow'))
  try {
    const r: any = await agentGeoUpdateAPI()
    const itemsRaw = Array.isArray(r?.items) ? r.items : []
    const items = itemsRaw
      .filter((x: any) => x && x.path)
      .map((x: any) => ({
        kind: String(x.kind || ''),
        path: String(x.path || ''),
        ok: typeof x.ok === 'boolean' ? x.ok : (x.ok ?? true),
        changed: !!x.changed,
        mtimeSec: typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
        sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
        method: String(x.method || ''),
        source: String(x.source || ''),
        error: String(x.error || ''),
      }))

    const failItems = items.filter((x: any) => x.ok === false || !!x.error)
    const okAll = !!r?.ok && failItems.length === 0
    const changedKinds = items.filter((x: any) => x.changed).map((x: any) => x.kind).join(', ')

    const ranAt = Date.now()
    const dataAtSec = Math.max(
      0,
      ...items
        .map((x: any) => (typeof x?.mtimeSec === 'number' ? x.mtimeSec : Number(x?.mtimeSec || 0) || 0))
        .filter((n: number) => Number.isFinite(n) && n > 0),
    )

    lastGeoUpdate.value = {
      ranAt,
      dataAtSec: dataAtSec || 0,
      ok: okAll,
      items,
      note: String(r?.note || ''),
    }

    if (!r?.ok) {
      finishJob(id, { ok: false, error: r?.error || 'failed', meta: { changed: changedKinds || '—' } })
      showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
      return
    }

    finishJob(id, { ok: okAll, meta: { changed: changedKinds || '—', fail: failItems.length } })
    showNotification({ content: okAll ? 'updateGeoSuccess' : 'operationFailed', type: okAll ? 'alert-success' : 'alert-warning', timeout: 2200 })
    await refreshFreshness()
  } catch (e: any) {
    finishJob(id, { ok: false, error: e?.message || 'failed' })
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    geoUpdateBusy.value = false
  }
}

const updateRuleProvidersNow = async () => {
  if (providersUpdateBusy.value) return
  providersUpdateBusy.value = true
  const ranAt = Date.now()
  const id = startJob(t('updateRuleProvidersNow'))
  try {
    await refreshRuleProviders()
    const beforeMap = new Map<string, string>()
    for (const p of ruleProviders.value || []) {
      if (p?.name) beforeMap.set(p.name, p.updatedAt || '')
    }

    const names = (ruleProviders.value || []).map((p) => p.name).filter(Boolean) as string[]
    const items: any[] = []
    let ok = 0
    let fail = 0

    for (const name of names) {
      const started = Date.now()
      try {
        await updateRuleProviderSilentAPI(name)
        ok += 1
        items.push({
          name,
          ok: true,
          changed: false,
          beforeUpdatedAt: beforeMap.get(name) || '',
          durationMs: Date.now() - started,
          error: '',
        })
      } catch (e: any) {
        fail += 1
        const d = e?.response?.data
        const msg = (() => {
          if (typeof d === 'string') return d
          if (d && typeof d === 'object') return JSON.stringify(d)
          return String(e?.message || 'failed')
        })()
        items.push({
          name,
          ok: false,
          changed: false,
          beforeUpdatedAt: beforeMap.get(name) || '',
          durationMs: Date.now() - started,
          error: msg,
        })
      }
    }

    await refreshRuleProviders()
    const afterMap = new Map<string, string>()
    for (const p of ruleProviders.value || []) {
      if (p?.name) afterMap.set(p.name, p.updatedAt || '')
    }

    let changed = 0
    for (const it of items) {
      const after = afterMap.get(it.name) || ''
      it.afterUpdatedAt = after
      const before = it.beforeUpdatedAt || ''
      const ch = !!after && !!before && after !== before
      it.changed = ch
      if (ch) changed += 1
    }

    const okAll = fail === 0
    lastRuleProvidersUpdate.value = {
      ranAt,
      dataAt: newestProviderAt.value || '',
      ok: okAll,
      total: names.length,
      okCount: ok,
      failCount: fail,
      items,
    }

    finishJob(id, { ok: okAll, meta: { total: names.length, ok, fail, changed } })
    showNotification({ content: okAll ? 'operationDone' : 'operationFailed', type: okAll ? 'alert-success' : 'alert-warning', timeout: 2200 })
    await refreshFreshness()
  } catch (e: any) {
    finishJob(id, { ok: false, error: e?.message || 'failed' })
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    providersUpdateBusy.value = false
  }
}

const rescanLocalRules = async () => {
  if (!agentEnabled.value) {
    showNotification({ content: 'agentDisabled', type: 'alert-warning', timeout: 2000 })
    return
  }
  if (rulesRescanBusy.value) return
  rulesRescanBusy.value = true
  const id = startJob(t('rescanLocalRules'))
  try {
    await refreshRulesInfo()
    if (rulesError.value) {
      finishJob(id, { ok: false, error: rulesError.value })
      showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
      return
    }
    finishJob(id, { ok: true, meta: { files: rulesCount.value } })
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
    await refreshFreshness()
  } catch (e: any) {
    finishJob(id, { ok: false, error: e?.message || 'failed' })
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    rulesRescanBusy.value = false
  }
}
</script>
