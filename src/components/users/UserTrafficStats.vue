<template>
  <div class="card">
    <div class="card-title px-4 pt-4 flex items-center justify-between gap-2">
      <span>{{ $t('userTraffic') }}</span>
      <div class="flex items-center gap-2">
        <select class="select select-sm" v-model="preset">
          <option value="1h">{{ $t('last1h') }}</option>
          <option value="24h">{{ $t('last24h') }}</option>
          <option value="7d">{{ $t('last7d') }}</option>
          <option value="30d">{{ $t('last30d') }}</option>
          <option value="custom">{{ $t('custom') }}</option>
        </select>
        <select class="select select-sm" v-model.number="topN">
          <option :value="0">{{ $t('all') }}</option>
          <option v-for="n in [10, 20, 30, 50, 100]" :key="n" :value="n">top {{ n }}</option>
        </select>
	      <button type="button" class="btn btn-sm" @click="reportDialogOpen = true">
          {{ $t('reports') }}
        </button>
	      <button type="button" class="btn btn-sm" @click="clearHistory">
          {{ $t('clearHistory') }}
        </button>
      </div>
    </div>

    <div class="card-body gap-3">
      <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-sm opacity-75">
        {{ $t('hostQosBulkHint') }}
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2">
        <div class="flex flex-wrap items-center gap-2">
          <div class="text-sm font-semibold">QoS runtime</div>
          <span v-if="!agentEnabled" class="badge badge-ghost">{{ $t('disabled') }}</span>
          <span v-else-if="!agentRuntimeReady" class="badge badge-error">{{ $t('offline') }}</span>
          <span v-else-if="qosStatus.ok && (qosStatus.supported || qosAppliedIpCount)" class="badge badge-success">{{ $t('online') }}</span>
          <span v-else-if="agentRuntimeReady && !qosStatus.supported" class="badge badge-warning">no-tc</span>
          <span v-else class="badge badge-error">runtime error</span>
          <span v-if="qosStatus.qosMode === 'wan-only'" class="badge badge-info">Safe QoS · uplink/WAN only</span>
          <span class="badge badge-ghost">WAN {{ qosStatus.wanRateMbit || '—' }} Мбит</span>
          <span class="badge badge-ghost">LAN {{ qosStatus.lanRateMbit || '—' }} Мбит</span>
          <span class="badge badge-ghost">Agent IP: {{ qosAppliedIpCount }}</span>
        </div>
        <div class="mt-1 text-xs opacity-70">
          <template v-if="qosStatus.qosMode === 'wan-only'">
            Safe mode активен: приоритет хоста применяется только на uplink/WAN и не трогает LAN bridge.
          </template>
          <template v-else-if="qosStatus.ok && qosStatus.supported">
            Runtime получен с router-agent. По строкам ниже видно, на какие IP профиль реально подтверждён агентом.
          </template>
          <template v-else-if="agentRuntimeReady && !qosStatus.supported">
            router-agent доступен, но tc/QoS на нём недоступен.
          </template>
          <template v-else>
            Нет подтверждённого QoS runtime от router-agent.
          </template>
        </div>
      </div>
      <div v-if="preset === 'custom'" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="opacity-70">{{ $t('from') }}</span>
          <input class="input input-sm" type="datetime-local" v-model="customFrom" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="opacity-70">{{ $t('to') }}</span>
          <input class="input input-sm" type="datetime-local" v-model="customTo" />
        </label>
      </div>


      <div class="rounded-lg border border-base-content/10 bg-base-200/30 p-2">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold">{{ $t('blockedUsers') }}</div>
            <span v-if="blockedList.length" class="badge badge-error">{{ blockedList.length }}</span>
            <span v-else class="badge">{{ blockedList.length }}</span>
          </div>
          <button
            type="button"
            class="btn btn-xs btn-ghost"
            @click="applyNow"
            :disabled="blockedActionBusy"
            :title="$t('applyEnforcementNow')"
          >
            <ArrowPathIcon class="h-4 w-4" :class="blockedActionBusy ? 'animate-spin' : ''" />
          </button>
        </div>

        <div v-if="!blockedList.length" class="mt-1 text-sm opacity-60">
          {{ $t('noBlockedUsers') }}
        </div>

        <div v-else class="mt-2 overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>{{ $t('user') }}</th>
                <th class="max-md:hidden">IP</th>
                <th class="text-right">{{ $t('traffic') }}</th>
                <th class="text-right max-lg:hidden">{{ $t('limits') }}</th>
                <th class="text-right">{{ $t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in blockedList" :key="b.user">
                <td class="font-medium">
                  <div class="flex items-center gap-2">
                    <LockClosedIcon class="h-4 w-4 text-error" />
                    <span class="truncate inline-block max-w-[240px]" :title="b.user">{{ b.user }}</span>
                    <div class="flex items-center gap-1">
                      <span
                        v-if="b.trafficLimitBytes"
                        class="inline-flex pointer-events-auto"
                        :title="trafficIconTitle(b.trafficLimitBytes, b.periodKey, b.limitEnabled)"
                      >
                        <CircleStackIcon
                          class="h-4 w-4"
                          :class="b.limitEnabled ? 'text-info' : 'opacity-40'"
                          @mouseenter="showTip($event, trafficIconTitle(b.trafficLimitBytes, b.periodKey, b.limitEnabled))"
                          @mouseleave="hideTip"
                        />
                      </span>
                      <span
                        v-if="b.bandwidthLimitBps"
                        class="inline-flex pointer-events-auto"
                        :title="bandwidthIconTitle(b.bandwidthLimitBps, b.limitEnabled)"
                      >
                        <BoltIcon
                          class="h-4 w-4"
                          :class="b.limitEnabled ? 'text-warning' : 'opacity-40'"
                          @mouseenter="showTip($event, bandwidthIconTitle(b.bandwidthLimitBps, b.limitEnabled))"
                          @mouseleave="hideTip"
                        />
                      </span>
                    </div>
                    <span v-if="b.reasonManual" class="badge badge-error badge-outline">{{ $t('manualBlock') }}</span>
                    <span v-else-if="b.reasonTraffic" class="badge badge-warning badge-outline">{{ $t('trafficExceeded') }}</span>
                    <span v-else-if="b.reasonBandwidth" class="badge badge-warning badge-outline">{{ $t('bandwidthExceeded') }}</span>
                  </div>
                </td>
                <td class="max-md:hidden">
                  <span class="truncate inline-block max-w-[420px] opacity-70" :title="b.ips">{{ b.ips }}</span>
                </td>
                <td class="text-right font-mono whitespace-nowrap">
                  <span v-if="b.limitEnabled && b.trafficLimitBytes">
                    {{ format(b.usageBytes) }} / {{ format(b.trafficLimitBytes) }}
                  </span>
                  <span v-else class="opacity-60">—</span>
                </td>
                <td class="text-right font-mono max-lg:hidden whitespace-nowrap">
                  <span v-if="b.limitEnabled">
                    {{ b.periodLabel }}
                  </span>
                  <span v-else class="opacity-60">—</span>
                </td>
                <td class="text-right relative z-40 pointer-events-auto">
  <div class="flex justify-end gap-1 pointer-events-auto">
    <button
      type="button"
      class="btn btn-ghost btn-circle btn-xs relative z-20"
      @click.stop.prevent="openLimits(b.user)"
      @pointerdown.stop.prevent
      @mousedown.stop.prevent
      @touchstart.stop.prevent
      :title="$t('limits')"
    >
      <AdjustmentsHorizontalIcon class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="btn btn-ghost btn-xs relative z-20"
      @click.stop.prevent="unblockAndReset(b.user)"
      @pointerdown.stop.prevent
      @mousedown.stop.prevent
      @touchstart.stop.prevent
      :disabled="blockedActionBusy"
      :title="$t('unblockAndReset')"
    >
      {{ $t('unblockAndReset') }}
    </button>
    <button
      type="button"
      class="btn btn-ghost btn-xs relative z-20"
      @click.stop.prevent="disableLimitsQuick(b.user)"
      @pointerdown.stop.prevent
      @mousedown.stop.prevent
      @touchstart.stop.prevent
      :disabled="blockedActionBusy"
      :title="$t('disableLimits')"
    >
      {{ $t('disableLimits') }}
    </button>
  </div>
</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


      <div v-if="selectedList.length" class="rounded-lg border border-base-content/10 bg-base-200/30 p-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold">{{ $t('selected') }}: {{ selectedList.length }}</div>
          <div class="flex flex-wrap items-center gap-2">
            <select class="select select-sm" v-model="bulkProfileId">
              <option value="">{{ $t('applyProfile') }}</option>
              <option v-for="p in limitProfiles" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button type="button" class="btn btn-sm" @click="applyProfileBulk" :disabled="!bulkProfileId || bulkBusy">
              {{ $t('apply') }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="bulkUnblockReset" :disabled="bulkBusy">
              {{ $t('unblockAndReset') }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="bulkDisableLimits" :disabled="bulkBusy">
              {{ $t('disableLimits') }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="goPolicies">
              {{ $t('limitProfiles') }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="clearSelection">
              {{ $t('clearSelection') }}
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th style="width: 38px">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  :checked="allSelected"
                  @click="toggleSelectAll"
                  :title="$t('selectAll')"
                />
              </th>
              <th class="cursor-pointer select-none" @click="setSort('user')">
                {{ $t('user') }}
                <span class="opacity-60" v-if="sortKey === 'user'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="max-md:hidden cursor-pointer select-none" @click="setSort('keys')">
                {{ $t('keys') }}
                <span class="opacity-60" v-if="sortKey === 'keys'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="text-right cursor-pointer select-none" @click="setSort('dl')">
                {{ $t('download') }}
                <span class="opacity-60" v-if="sortKey === 'dl'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="text-right cursor-pointer select-none" @click="setSort('ul')">
                {{ $t('upload') }}
                <span class="opacity-60" v-if="sortKey === 'ul'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="text-right cursor-pointer select-none" @click="setSort('total')">
                {{ $t('total') }}
                <span class="opacity-60" v-if="sortKey === 'total'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="text-right max-lg:hidden">{{ $t('trafficLimit') }}</th>
              <th class="text-right max-lg:hidden">{{ $t('bandwidthLimit') }}</th>
              <th class="text-right min-w-[220px]">{{ $t('hostQosColumn') }}</th>
              <th class="text-right">{{ $t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.user">
              <td>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  v-model="selectedMap[row.user]"
                  @click.stop
                  :title="$t('selectUser')"
                />
              </td>
              <td class="font-medium">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <LockClosedIcon
                      v-if="limitStates[row.user]?.blocked"
                      class="h-4 w-4 text-error"
                      :title="$t('userBlockedTip')"
                    />
                    <template v-if="editingUser === row.user">
                      <input
                        class="input input-xs w-full max-w-[260px]"
                        v-model="editingName"
                        :placeholder="$t('user')"
                      />
                    </template>
                    <template v-else>
                      <span class="truncate inline-block max-w-[240px]" :title="row.user">{{ row.user }}</span>
                      <div class="flex items-center gap-1">
                        <span
                          v-if="limitStates[row.user]?.trafficLimitBytes"
                          class="inline-flex pointer-events-auto"
                          :title="trafficIconTitle(limitStates[row.user].trafficLimitBytes, rowLimit(row).trafficPeriod, limitStates[row.user].enabled)"
                        >
                          <CircleStackIcon
                            class="h-4 w-4"
                            :class="limitStates[row.user].enabled ? 'text-info' : 'opacity-40'"
                            @mouseenter="showTip($event, trafficIconTitle(limitStates[row.user].trafficLimitBytes, rowLimit(row).trafficPeriod, limitStates[row.user].enabled))"
                            @mouseleave="hideTip"
                          />
                        </span>
                        <span
                          v-if="limitStates[row.user]?.bandwidthLimitBps"
                          class="inline-flex pointer-events-auto"
                          :title="bandwidthIconTitle(limitStates[row.user].bandwidthLimitBps, limitStates[row.user].enabled)"
                        >
                          <BoltIcon
                            class="h-4 w-4"
                            :class="limitStates[row.user].enabled ? 'text-warning' : 'opacity-40'"
                            @mouseenter="showTip($event, bandwidthIconTitle(limitStates[row.user].bandwidthLimitBps, limitStates[row.user].enabled))"
                            @mouseleave="hideTip"
                          />
                        </span>
                      </div>
                      <span
                        v-if="row.currentQos && row.currentQos !== 'mixed'"
                        class="badge badge-xs"
                        :class="profileBadgeClass(row.currentQos)"
                      >
                        {{ profileIcon(row.currentQos) }} {{ profileLabel(row.currentQos) }}
                      </span>
                      <span
                        v-else-if="row.currentQos === 'mixed'"
                        class="badge badge-xs badge-warning"
                      >
                        ≋ {{ $t('hostQosMixed') }}
                      </span>
                    </template>
                  </div>
                  <div
                    v-if="editingUser !== row.user && rowSourceRuleBadges(row).length"
                    class="flex flex-wrap items-center gap-1 text-[11px]"
                  >
                    <span
                      v-for="badge in rowSourceRuleBadges(row)"
                      :key="`${row.user}-${badge.text}`"
                      class="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
                      :class="badge.cls"
                      :title="badge.title"
                    >
                      {{ badge.text }}
                    </span>
                  </div>
                  <div
                    v-if="editingUser !== row.user && rowOwnerResolutionBadges(row).length"
                    class="flex flex-wrap items-center gap-1 text-[11px]"
                  >
                    <span
                      v-for="badge in rowOwnerResolutionBadges(row)"
                      :key="`${row.user}-${badge.text}`"
                      class="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
                      :class="badge.cls"
                      :title="badge.title"
                    >
                      {{ badge.text }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="max-md:hidden">
                <span class="truncate inline-block max-w-[420px] opacity-70" :title="row.keys">{{ row.keys }}</span>
              </td>
              <td class="text-right font-mono">{{ format(row.dl) }}</td>
              <td class="text-right font-mono">{{ format(row.ul) }}</td>
              <td class="text-right font-mono">{{ format(row.dl + row.ul) }}</td>

              <td class="text-right font-mono max-lg:hidden">
                <template v-if="limitStates[row.user]?.trafficLimitBytes">
                  <div
                    class="whitespace-nowrap"
                    :class="limitStates[row.user].enabled ? '' : 'opacity-40'"
                  >
                    {{ format(limitStates[row.user].usageBytes) }} /
                    {{ format(limitStates[row.user].trafficLimitBytes) }}
                  </div>
                  <div
                    class="text-xs opacity-60 flex items-center justify-end gap-1"
                    :class="limitStates[row.user].enabled ? '' : 'opacity-40'"
                  >
                    <span>{{ limitStates[row.user].periodLabel }} · {{ limitStates[row.user].percent }}%</span>
                    <CircleStackIcon
                      class="h-4 w-4"
                      :class="limitStates[row.user].enabled ? 'text-info' : 'opacity-40'"
                      :title="trafficIconTitle(limitStates[row.user].trafficLimitBytes, rowLimit(row).trafficPeriod, limitStates[row.user].enabled)"
                      @mouseenter="showTip($event, trafficIconTitle(limitStates[row.user].trafficLimitBytes, rowLimit(row).trafficPeriod, limitStates[row.user].enabled))"
                      @mouseleave="hideTip"
                    />
                    <BoltIcon
                      v-if="limitStates[row.user].bandwidthLimitBps"
                      class="h-4 w-4"
                      :class="limitStates[row.user].enabled ? 'text-warning' : 'opacity-40'"
                      :title="bandwidthIconTitle(limitStates[row.user].bandwidthLimitBps, limitStates[row.user].enabled)"
                      @mouseenter="showTip($event, bandwidthIconTitle(limitStates[row.user].bandwidthLimitBps, limitStates[row.user].enabled))"
                      @mouseleave="hideTip"
                    />
                  </div>
                </template>
                <template v-else>
                  <span class="opacity-50">—</span>
                </template>
              </td>

              <td class="text-right font-mono max-lg:hidden">
                <template v-if="limitStates[row.user]?.bandwidthLimitBps">
                  <div
                    class="whitespace-nowrap"
                    :class="limitStates[row.user].enabled ? '' : 'opacity-40'"
                  >
                    {{ speed(limitStates[row.user].speedBps) }} /
                    {{ speed(limitStates[row.user].bandwidthLimitBps) }}
                  </div>
                </template>
                <template v-else>
                  <span class="opacity-50">—</span>
                </template>
              </td>

              <td class="text-right">
                <div class="flex flex-col items-end gap-1">
                  <div class="flex items-center justify-end gap-1">
                    <select
                      class="select select-xs w-[128px]"
                      v-model="qosDraftByUser[row.user]"
                      :disabled="applyingQosUser === row.user || !rowHasEffectiveIps(row)"
                      :title="rowHasEffectiveIps(row) ? (qosStatus.qosMode === 'wan-only' ? 'Safe QoS: только uplink/WAN' : '') : 'Не найден IP для применения QoS'"
                    >
                      <option v-for="profile in profileOrder" :key="`qos-${row.user}-${profile}`" :value="profile">
                        {{ profileLabel(profile) }}
                      </option>
                    </select>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      :disabled="applyingQosUser === row.user || !rowHasEffectiveIps(row)"
                      :title="rowHasEffectiveIps(row) ? (qosStatus.qosMode === 'wan-only' ? 'Safe QoS: только uplink/WAN' : '') : 'Не найден IP для применения QoS'"
                      @click="applyUserQos(row)"
                    >
                      {{ $t('apply') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      :disabled="applyingQosUser === row.user || !row.currentQos"
                      :title="qosStatus.qosMode === 'wan-only' ? 'Очистить Safe QoS (uplink/WAN)' : ''"
                      @click="clearUserQos(row)"
                    >
                      {{ $t('clear') }}
                    </button>
                  </div>
                  <div v-if="qosStatus.qosMode === 'wan-only'" class="flex max-w-[340px] flex-wrap justify-end gap-1 text-right">
                    <span class="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                      Safe QoS · uplink/WAN only
                    </span>
                  </div>
                  <div
                    v-if="rowRuntimeBadges(row).length"
                    class="flex max-w-[340px] flex-wrap justify-end gap-1 text-right"
                    :title="rowRuntimeTitle(row)"
                  >
                    <span
                      v-for="badge in rowRuntimeBadges(row)"
                      :key="`${row.user}-${badge.text}`"
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      :class="badge.cls"
                      :title="badge.title || rowRuntimeTitle(row)"
                    >
                      {{ badge.text }}
                    </span>
                  </div>
                  <div
                    v-if="rowRuntimeMetaLine(row)"
                    class="max-w-[340px] text-[11px] leading-4 opacity-65 text-right"
                    :title="rowRuntimeTitle(row)"
                  >
                    {{ rowRuntimeMetaLine(row) }}
                  </div>
                </div>
              </td>

              <td class="text-right relative z-30 pointer-events-auto">
                <div class="flex justify-end gap-1 pointer-events-auto">
                  <template v-if="editingUser === row.user">
                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      :disabled="!editingName.trim()"
                      @click.stop.prevent="saveEdit"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('save')"
                    >
                      <CheckIcon class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      @click.stop.prevent="cancelEdit"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('cancel')"
                    >
                      <XMarkIcon class="h-4 w-4" />
                    </button>
                  </template>
                  <template v-else>
                    <template v-if="shaperBadge[row.user]">
                      <span
                        class="inline-flex items-center justify-center px-1"
                        :title="shaperBadge[row.user].title"
                      >
                        <component
                          :is="shaperBadge[row.user].icon"
                          class="h-4 w-4"
                          :class="shaperBadge[row.user].cls"
                        />
                      </span>
                      <button
                        v-if="shaperBadge[row.user].showReapply"
                        type="button"
                        class="btn btn-ghost btn-circle btn-xs relative z-20"
                        :disabled="applyingShaperUser === row.user"
                        @click.stop.prevent="reapplyShaper(row)"
                        @pointerdown.stop.prevent
                        @mousedown.stop.prevent
                        @touchstart.stop.prevent
                        :title="$t('reapply')"
                      >
                        <span v-if="applyingShaperUser === row.user" class="loading loading-spinner loading-xs"></span>
                        <ArrowPathIcon v-else class="h-4 w-4" />
                      </button>
                    </template>
                    <button
                      v-if="row.currentQos || limitStates[row.user]?.bandwidthLimitBps"
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      :disabled="refreshingRuntimeUser === row.user"
                      @click.stop.prevent="refreshRowRuntime(row)"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('refresh')"
                    >
                      <span v-if="refreshingRuntimeUser === row.user" class="loading loading-spinner loading-xs"></span>
                      <ArrowPathIcon v-else class="h-4 w-4 opacity-70" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      @click.stop.prevent="openLimits(rowLimitOwner(row), row.user)"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('limits')"
                    >
                      <AdjustmentsHorizontalIcon class="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      @click.stop.prevent="startEdit(row.user)"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('edit')"
                    >
                      <PencilSquareIcon class="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs relative z-20"
                      :disabled="!hasMapping(row.user)"
                      @click.stop.prevent="removeUser(row.user)"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @touchstart.stop.prevent
                      :title="$t('delete')"
                    >
                      <TrashIcon class="h-4 w-4" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>

            <tr v-if="!rows.length">
              <td colspan="10" class="text-center opacity-60">{{ $t('noContent') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-xs opacity-60">
        {{ $t('userTrafficTip') }} ({{ $t('buckets') }}: {{ buckets }})
      </div>

      
      <DialogWrapper v-model="reportDialogOpen">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="text-base font-semibold">{{ $t('reports') }}</div>
          <div class="text-xs opacity-70 font-mono">
            {{ reportRangeLabel }}
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="opacity-70">{{ $t('groupBy') }}</span>
            <select class="select select-sm" v-model="reportGroupBy">
              <option value="day">{{ $t('day') }}</option>
              <option value="week">{{ $t('week') }}</option>
              <option value="month">{{ $t('month') }}</option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="opacity-70">{{ $t('user') }}</span>
            <select class="select select-sm" v-model="reportUser">
              <option value="">{{ $t('allUsers') }}</option>
              <option v-for="u in reportUsers" :key="u" :value="u">
                {{ u }}
              </option>
            </select>
          </label>

          <label class="flex items-center justify-between gap-2 sm:pt-6">
            <span class="text-sm opacity-70">{{ $t('skipEmpty') }}</span>
            <input type="checkbox" class="toggle" v-model="reportSkipEmpty" />
          </label>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 mt-2">
          <button type="button" class="btn btn-sm" @click="exportTableCsv">
            {{ $t('exportTableCsv') }}
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="exportReportCsv">
            {{ $t('exportReportCsv') }}
          </button>
        </div>

        <div class="mt-3 overflow-x-auto max-h-[52vh]">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>{{ $t('period') }}</th>
                <th>{{ $t('user') }}</th>
                <th class="text-right">{{ $t('download') }}</th>
                <th class="text-right">{{ $t('upload') }}</th>
                <th class="text-right">{{ $t('total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reportPreviewRows" :key="r.period + '|' + r.user">
                <td class="font-mono whitespace-nowrap">{{ r.period }}</td>
                <td class="truncate max-w-[320px]" :title="r.user">{{ r.user }}</td>
                <td class="text-right font-mono">{{ format(r.dl) }}</td>
                <td class="text-right font-mono">{{ format(r.ul) }}</td>
                <td class="text-right font-mono">{{ format(r.dl + r.ul) }}</td>
              </tr>

              <tr v-if="!reportPreviewRows.length">
                <td colspan="5" class="text-center opacity-60">{{ $t('noContent') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-2 text-xs opacity-60">
          {{ $t('reportRows') }}: {{ reportRowsCount }}
          <span v-if="reportPreviewLimited">
            · {{ $t('previewLimited') }}
          </span>
        </div>
      </DialogWrapper>

      <DialogWrapper v-model="limitsDialogOpen">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="text-base font-semibold">{{ $t('limits') }}</div>
          <div class="flex flex-col items-end max-w-[60%]">
            <div class="text-sm opacity-70 truncate" :title="limitsUserDisplay || limitsUser">{{ limitsUserDisplay || limitsUser }}</div>
            <div v-if="limitsUserDisplay && limitsUserDisplay !== limitsUser" class="text-[11px] opacity-50 truncate" :title="limitsUser">{{ limitsUser }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <label class="flex items-center justify-between gap-2">
            <span class="text-sm">{{ $t('enabled') }}</span>
            <input type="checkbox" class="toggle" v-model="draftEnabled" />
          </label>

          <label class="flex items-center justify-between gap-2">
            <span class="text-sm">{{ $t('blocked') }}</span>
            <input type="checkbox" class="toggle" v-model="draftDisabled" />
          </label>

          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm">
                MAC
                <span class="text-xs opacity-60">({{ $t('routerAgent') }})</span>
              </div>
              <div class="flex items-center gap-2">
                <code
                  class="text-xs px-2 py-1 rounded bg-base-200"
                  :class="draftMac ? '' : 'opacity-50'"
                  :title="draftMac || ''"
                >
                  {{ draftMac || '—' }}
                </code>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!agentRuntimeReady"
                  @click="refreshMac"
                  :title="$t('rebindMac')"
                >
                  <ArrowPathIcon class="h-4 w-4" :class="macLoading ? 'animate-spin' : ''" />
                </button>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!agentRuntimeReady"
                  @click="refreshMacAndApply"
                  :title="$t('rebindMacApply')"
                >
                  <div class="flex items-center gap-1">
                    <ArrowPathIcon class="h-4 w-4" :class="macApplyLoading ? 'animate-spin' : ''" />
                    <CheckIcon class="h-4 w-4" />
                  </div>
                </button>

                <button type="button" class="btn btn-ghost btn-xs" :disabled="!draftMac" @click="clearMac">
                  {{ $t('clear') }}
                </button>
              </div>
            </div>

            <div v-if="macCandidates.length > 1" class="flex items-center gap-2">
              <select class="select select-sm" v-model="draftMac">
                <option v-for="m in macCandidates" :key="m" :value="m">{{ m }}</option>
              </select>
              <span class="text-xs opacity-60">{{ $t('multipleMacsFound') }}</span>
            </div>
          </div>

          <div class="divider my-0"></div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-sm opacity-70">{{ $t('trafficLimit') }}</span>
              <div class="flex items-center gap-2">
                <input
                  class="input input-sm flex-1"
                  type="number"
                  min="0"
                  step="0.1"
                  v-model.number="draftTrafficValue"
                  :disabled="!draftEnabled"
                />
                <select class="select select-sm w-20" v-model="draftTrafficUnit" :disabled="!draftEnabled">
                  <option value="GB">GB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-sm opacity-70">{{ $t('period') }}</span>
              <select class="select select-sm" v-model="draftPeriod" :disabled="!draftEnabled">
                <option value="1d">{{ $t('last24h') }}</option>
                <option value="30d">{{ $t('last30d') }}</option>
                <option value="month">{{ $t('thisMonth') }}</option>
              </select>
            </label>
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-sm opacity-70">{{ $t('bandwidthLimit') }} (Mbps)</span>
            <input class="input input-sm" type="number" min="0" step="0.1" v-model.number="draftBandwidthMbps" :disabled="!draftEnabled" />
            <span class="text-xs opacity-60">{{ $t('bandwidthLimitTip') }}</span>
          </label>

          <div class="flex items-center justify-between gap-2">
            <div class="text-xs opacity-70">{{ $t('autoDisconnectLimitedUsers') }}</div>
            <input type="checkbox" class="toggle toggle-sm" v-model="autoDisconnectLimitedUsers" />
          </div>

          <div class="flex items-center justify-between gap-2">
            <div class="text-xs opacity-70">{{ $t('hardBlockLimitedUsers') }}</div>
            <input type="checkbox" class="toggle toggle-sm" v-model="hardBlockLimitedUsers" />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <button type="button" class="btn btn-sm" @click="resetCounter" :disabled="!draftEnabled">{{ $t('resetUsage') }}</button>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-ghost btn-sm" @click="clearLimits">{{ $t('clearLimits') }}</button>
              <button type="button" class="btn btn-primary btn-sm" @click="saveLimits">{{ $t('save') }}</button>
            </div>
          </div>

          <div class="text-xs opacity-60">
            {{ $t('limitsEnforcementNote') }}
          </div>
        </div>
      </DialogWrapper>
    </div>
  </div>
</template>

<script setup lang="ts">
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import { agentLanHostsAPI, agentQosStatusAPI, agentRemoveHostQosAPI, agentSetHostQosAPI, agentStatusAPI, type AgentLanHost, type AgentQosProfile, type AgentQosStatus, type AgentQosStatusItem } from '@/api/agent'
import { getExactIPLabelFromMap, getIPLabelFromMap, getPrimarySourceIpRule, type SourceIpRuleKind } from '@/helper/sourceip'
import { prettyBytesHelper } from '@/helper/utils'
import { showNotification } from '@/helper/notification'
import { activeConnections } from '@/store/connections'
import { sourceIPLabelList } from '@/store/settings'
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles, setRouterHostQosAppliedProfile } from '@/store/routerHostQos'
import { autoDisconnectLimitedUsers, hardBlockLimitedUsers, userLimits, type UserLimitPeriod } from '@/store/userLimits'
import { userLimitProfiles } from '@/store/userLimitProfiles'
import { agentEnabled, agentEnforceBandwidth, agentShaperStatus, bootstrapRouterAgentForLan, managedAgentShapers } from '@/store/agent'
import {
  clearUserLimit,
  getIpsForUser,
  getUserLimit,
  getUserLimitState,
  applyUserEnforcementNow,
  reapplyAgentShapingForUser,
  setUserLimit,
} from '@/composables/userLimits'
import { applyProfileToUsers, disableLimitsForUsers, unblockResetUsers } from '@/composables/userLimitProfiles'
import {
  clearUserTrafficHistory,
  formatTraffic,
  getTrafficGrouped,
  getTrafficRange,
  getUserHourBucket,
  type TrafficGroupBy,
  userTrafficStoreSize,
} from '@/composables/userTraffic'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usersDbPullNow } from '@/store/usersDbSync'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { useTooltip } from '@/helper/tooltip'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckIcon,
  CheckCircleIcon,
  CircleStackIcon,
  LockClosedIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

type RowQosState = AgentQosProfile | 'mixed' | undefined
type LimitOwnerResolutionReason = 'self' | 'persisted' | 'name' | 'ip' | 'mac'

type Row = {
  user: string
  keys: string
  dl: number
  ul: number
  ips: string[]
  macs: string[]
  limitOwner: string
  limitOwnerReason: LimitOwnerResolutionReason
  limitOwnerMatch?: string
  currentQos?: RowQosState
}

const editingUser = ref<string | null>(null)
const editingName = ref('')
const profileOrder: AgentQosProfile[] = ['critical', 'high', 'elevated', 'normal', 'low', 'background']
const qosStatus = ref<AgentQosStatus>({ ok: false, supported: false, items: [] })
const qosDraftByUser = ref<Record<string, AgentQosProfile>>({})
const applyingQosUser = ref('')
let qosTimer: number | undefined

const router = useRouter()
const { t } = useI18n()
const { showTip, hideTip } = useTooltip()

// --- Bulk actions (profiles / mass apply) ---
const selectedMap = ref<Record<string, boolean>>({})
const selectedList = computed(() => Object.keys(selectedMap.value || {}).filter((u) => selectedMap.value[u]))
const clearSelection = () => {
  selectedMap.value = {}
}

const agentRuntimeReady = ref(false)
const agentLanHosts = ref<AgentLanHost[]>([])

const refreshAgentRuntime = async () => {
  try {
    const st = await agentStatusAPI()
    const ok = !!st?.ok
    agentRuntimeReady.value = ok
    if (!ok) {
      agentLanHosts.value = []
      return false
    }

    if (!agentEnabled.value) agentEnabled.value = true
    if (!agentEnforceBandwidth.value) agentEnforceBandwidth.value = true

    const hosts = await agentLanHostsAPI().catch(() => ({ ok: false, items: [] as AgentLanHost[] }))
    agentLanHosts.value = hosts?.ok && Array.isArray(hosts.items) ? hosts.items : []
    return true
  } catch {
    agentRuntimeReady.value = false
    agentLanHosts.value = []
    return false
  }
}

const ensureAgentReady = async () => {
  bootstrapRouterAgentForLan()
  if (agentRuntimeReady.value && agentEnabled.value) return true
  const ok = await refreshAgentRuntime()
  if (ok) await usersDbPullNow()
  return ok
}

const qosMap = computed<Record<string, AgentQosStatusItem>>(() => {
  const out: Record<string, AgentQosStatusItem> = {}
  for (const item of qosStatus.value.items || []) {
    if (item?.ip) out[item.ip] = item
  }
  return out
})

const normalizeMac = (value: string) => {
  const v = String(value || '').trim().toLowerCase().replace(/-/g, ':')
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(v) ? v : ''
}

const hasPersistedLimit = (user: string) => {
  if (isReservedPseudoTrafficUser(user)) return false
  const l = getUserLimit(user)
  return !!(l.enabled || l.disabled || (l.trafficLimitBytes || 0) > 0 || (l.bandwidthLimitBps || 0) > 0 || normalizeMac(l.mac || ''))
}

const lanHostMacByIp = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const host of agentLanHosts.value || []) {
    const ip = String((host as any)?.ip || '').trim()
    const mac = normalizeMac(String((host as any)?.mac || ''))
    if (!looksLikeIP(ip) || !mac) continue
    out[ip] = mac
  }
  return out
})

const lanHostIpsByMac = computed<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {}
  for (const host of agentLanHosts.value || []) {
    const ip = String((host as any)?.ip || '').trim()
    const mac = normalizeMac(String((host as any)?.mac || ''))
    if (!looksLikeIP(ip) || !mac) continue
    ;(out[mac] ||= []).push(ip)
  }
  for (const mac of Object.keys(out)) out[mac] = Array.from(new Set(out[mac])).sort((a, b) => a.localeCompare(b))
  return out
})

const resolveMacsForIdentity = (user: string, ips: string[], limitOwner = '') => {
  const out = new Set<string>()
  const add = (value: string) => {
    const mac = normalizeMac(value)
    if (mac) out.add(mac)
  }

  add(getUserLimit(user).mac || '')
  if (limitOwner && limitOwner !== user) add(getUserLimit(limitOwner).mac || '')
  for (const ip of ips || []) add(lanHostMacByIp.value[ip] || '')

  const want = normalizeUserName(user)
  for (const host of agentLanHosts.value || []) {
    const ip = String((host as any)?.ip || '').trim()
    const hostname = String((host as any)?.hostname || '').trim()
    const display = String(getExactHostLabel(ip, hostname) || ip).trim()
    if (normalizeUserName(display) === want || normalizeUserName(ip) === want || normalizeUserName(hostname) === want) {
      add(String((host as any)?.mac || ''))
    }
  }

  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

const ipsForLimitOwner = (user: string, knownIps: string[] = [], knownMacs: string[] = []) => {
  if (isReservedPseudoTrafficUser(user)) return []
  const out = new Set<string>()
  const addIp = (value: string) => {
    const ip = String(value || '').trim()
    if (looksLikeIP(ip)) out.add(ip)
  }

  for (const ip of knownIps || []) addIp(ip)
  for (const ip of getIpsForUser(user) || []) addIp(ip)

  const macs = new Set<string>((knownMacs || []).map((value) => normalizeMac(value)).filter(Boolean))
  const savedMac = normalizeMac(getUserLimit(user).mac || '')
  if (savedMac) macs.add(savedMac)
  for (const mac of macs) {
    for (const ip of lanHostIpsByMac.value[mac] || []) addIp(ip)
  }

  const want = normalizeUserName(user)
  for (const c of activeConnections.value || []) {
    const ip = String((c as any)?.metadata?.sourceIP || '').trim()
    if (!looksLikeIP(ip)) continue
    const display = String(getExactHostLabel(ip) || ip).trim()
    if (normalizeUserName(display) === want || normalizeUserName(ip) === want) addIp(ip)
  }

  for (const host of agentLanHosts.value || []) {
    const ip = String((host as any)?.ip || '').trim()
    const hostname = String((host as any)?.hostname || '').trim()
    const display = String(getExactHostLabel(ip, hostname) || ip).trim()
    if (normalizeUserName(display) === want || normalizeUserName(ip) === want || normalizeUserName(hostname) === want) addIp(ip)
  }

  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

const resolveLimitOwnerForRow = (user: string, ips: string[], macs: string[]): { owner: string; reason: LimitOwnerResolutionReason; match?: string } => {
  if (isReservedPseudoTrafficUser(user)) return { owner: user, reason: 'self' }
  if (hasPersistedLimit(user)) return { owner: user, reason: 'persisted' }

  const want = normalizeUserName(user)
  const ipSet = new Set((ips || []).filter((ip) => looksLikeIP(ip)))
  const macSet = new Set((macs || []).map((value) => normalizeMac(value)).filter(Boolean))
  let byName = ''
  let byIp = ''
  let byIpMatch = ''

  for (const candidate of Object.keys(userLimits.value || {})) {
    if (!candidate || candidate === user) continue
    if (isReservedPseudoTrafficUser(candidate)) continue
    if (!shouldIncludeTrafficUser(candidate)) continue
    if (!hasPersistedLimit(candidate)) continue

    if (!byName && normalizeUserName(candidate) === want) byName = candidate

    const candidateMac = normalizeMac(getUserLimit(candidate).mac || '')
    if (candidateMac && macSet.has(candidateMac)) return { owner: candidate, reason: 'mac', match: candidateMac }

    const candidateIps = new Set<string>()
    if (looksLikeIP(candidate)) candidateIps.add(candidate)
    for (const ip of getIpsForUser(candidate) || []) if (looksLikeIP(ip)) candidateIps.add(ip)
    if (candidateMac) {
      for (const ip of lanHostIpsByMac.value[candidateMac] || []) if (looksLikeIP(ip)) candidateIps.add(ip)
    }
    for (const ip of candidateIps) {
      if (ipSet.has(ip)) {
        byIp = candidate
        byIpMatch = ip
        break
      }
    }
    if (byIp) break
  }

  if (byIp) return { owner: byIp, reason: 'ip', match: byIpMatch }
  if (byName) return { owner: byName, reason: 'name' }
  return { owner: user, reason: 'self' }
}

const rowLimitOwner = (row: Row) => row.limitOwner || row.user
const rowLimit = (row: Row) => getUserLimit(rowLimitOwner(row))

const syncAppliedQosProfiles = () => {
  const next: Record<string, AgentQosProfile> = {}
  for (const item of qosStatus.value.items || []) {
    if (item?.ip && item?.profile) next[item.ip] = item.profile
  }
  mergeRouterHostQosAppliedProfiles(next)
}

const resolveRowQos = (ips: string[]): RowQosState => {
  const profiles = Array.from(new Set(ips
    .map((ip) => qosMap.value[ip]?.profile || routerHostQosAppliedProfiles.value[ip])
    .filter(Boolean))) as AgentQosProfile[]
  if (!profiles.length) return undefined
  if (profiles.length === 1) return profiles[0]
  return 'mixed'
}

const ensureQosDrafts = () => {
  const next = { ...qosDraftByUser.value }
  for (const row of rows.value || []) {
    if (!next[row.user]) next[row.user] = row.currentQos && row.currentQos !== 'mixed' ? row.currentQos : 'normal'
  }
  qosDraftByUser.value = next
}


const effectiveIpsForRow = (row: Row) => {
  const out = new Set<string>()
  for (const ip of ipsForLimitOwner(row.user, row.ips, row.macs)) out.add(ip)
  const owner = rowLimitOwner(row)
  if (owner && owner !== row.user) {
    for (const ip of ipsForLimitOwner(owner, row.ips, row.macs)) out.add(ip)
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

const rowHasEffectiveIps = (row: Row) => effectiveIpsForRow(row).length > 0

const resolveIpsForQosAction = async (row: Row) => {
  let ips = effectiveIpsForRow(row)
  if (ips.length) return ips

  await ensureAgentReady()
  await usersDbPullNow()
  await refreshAgentRuntime()
  ips = effectiveIpsForRow(row)
  if (ips.length) return ips

  await refreshQosStatus()
  return effectiveIpsForRow(row)
}

const refreshQosStatus = async () => {
  const ready = await ensureAgentReady()
  if (!ready) return
  const res = await agentQosStatusAPI()
  qosStatus.value = res.ok ? res : { ok: false, supported: false, items: [], error: res.error }
  if (res.ok) syncAppliedQosProfiles()
}

const profileLabel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return t('hostQosCritical')
  if (profile === 'high') return t('hostQosHigh')
  if (profile === 'elevated') return t('hostQosElevated')
  if (profile === 'low') return t('hostQosLow')
  if (profile === 'background') return t('hostQosBackground')
  return t('hostQosNormal')
}

const profileIcon = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return '⏫'
  if (profile === 'high') return '⬆'
  if (profile === 'elevated') return '↗'
  if (profile === 'low') return '↘'
  if (profile === 'background') return '⬇'
  return '•'
}

const profileBadgeClass = (profile: AgentQosProfile) => {
  if (profile === 'critical') return 'badge-error'
  if (profile === 'high') return 'badge-success'
  if (profile === 'elevated') return 'badge-accent'
  if (profile === 'low') return 'badge-warning'
  if (profile === 'background') return 'badge-ghost'
  return 'badge-info'
}

const limitProfiles = computed(() => userLimitProfiles.value || [])
const bulkProfileId = ref<string>('')
const bulkBusy = ref(false)

const allSelected = computed(() => {
  const list = rows.value || []
  if (!list.length) return false
  return list.every((r) => !!selectedMap.value[r.user])
})

const toggleSelectAll = () => {
  const list = rows.value || []
  const want = !allSelected.value
  const next: Record<string, boolean> = { ...(selectedMap.value || {}) }
  for (const r of list) next[r.user] = want
  selectedMap.value = next
}

const applyProfileBulk = async () => {
  const id = (bulkProfileId.value || '').trim()
  if (!id) return
  const p = (limitProfiles.value || []).find((x) => x.id === id)
  if (!p) return
  if (bulkBusy.value) return
  bulkBusy.value = true
  try {
    await applyProfileToUsers(selectedList.value, p)
    clearSelection()
  } finally {
    bulkBusy.value = false
  }
}

const bulkUnblockReset = async () => {
  if (bulkBusy.value) return
  bulkBusy.value = true
  try {
    await unblockResetUsers(selectedList.value)
    clearSelection()
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    bulkBusy.value = false
  }
}

const bulkDisableLimits = async () => {
  if (bulkBusy.value) return
  bulkBusy.value = true
  try {
    await disableLimitsForUsers(selectedList.value)
    clearSelection()
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
  } catch {
    showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
  } finally {
    bulkBusy.value = false
  }
}

const goPolicies = () => {
  router.push({ name: 'policies' })
}

const looksLikeIP = (s: string) => {
  const v = (s || '').trim()
  if (!v) return false
  const v4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(v)
  const v6 = v.includes(':')
  return v4 || v6
}

// Normalize user display strings to prevent duplicates (case/whitespace variations).
const normalizeUserName = (s: string) => {
  return (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase()
}


const isPatternSourceKey = (key: string) => {
  const raw = String(key || '').trim()
  if (!raw) return false
  return raw.startsWith('/') || raw.includes('/')
}

const getExactHostLabel = (ip: string, hostname = '') => {
  const exact = String(getExactIPLabelFromMap(ip) || '').trim()
  if (exact && !isReservedPseudoTrafficUser(exact)) return exact

  const grouped = String(getIPLabelFromMap(ip) || '').trim()
  if (grouped && grouped !== ip && !isReservedPseudoTrafficUser(grouped)) return grouped

  const host = String(hostname || '').trim()
  if (host && !isReservedPseudoTrafficUser(host)) return host
  return ip
}

const hasExactHostMappingForUser = (user: string) => {
  const want = normalizeUserName(user)
  if (!want || isReservedPseudoTrafficUser(user)) return false
  return sourceIPLabelList.value.some((it) => {
    const key = String(it.key || '').trim()
    if (!key || isPatternSourceKey(key)) return false
    const label = String(it.label || it.key || '').trim()
    return normalizeUserName(label) === want
  })
}

const hasGroupedSourceMappingForUser = (user: string) => {
  const want = normalizeUserName(user)
  if (!want || isReservedPseudoTrafficUser(user)) return false
  return sourceIPLabelList.value.some((it) => {
    const key = String(it.key || '').trim()
    if (!key || !isPatternSourceKey(key)) return false
    const label = String(it.label || '').trim()
    return normalizeUserName(label) === want
  })
}

const hasLanHostIdentityForUser = (user: string) => {
  const want = normalizeUserName(user)
  if (!want || isReservedPseudoTrafficUser(user)) return false
  return (agentLanHosts.value || []).some((host) => {
    const hostname = String((host as any)?.hostname || '').trim()
    return !!hostname && normalizeUserName(hostname) === want
  })
}

const hasSavedMacIdentityForUser = (user: string) => {
  if (!user || isReservedPseudoTrafficUser(user)) return false
  return !!normalizeMac(getUserLimit(user).mac || '')
}

const reservedPseudoTrafficLabels = new Set(['dhcp', 'arp', 'dnsmasq'])

const isReservedPseudoTrafficUser = (user: string) => {
  const want = normalizeUserName(user)
  if (!want) return false
  return reservedPseudoTrafficLabels.has(want)
}

const hasResolvedIpsForUser = (user: string) => (getIpsForUser(user) || []).some((ip) => looksLikeIP(ip))

const isHostResolvableTrafficUser = (user: string) => {
  const value = String(user || '').trim()
  if (!value) return false
  if (looksLikeIP(value)) return true
  if (hasExactHostMappingForUser(value)) return true
  if (hasGroupedSourceMappingForUser(value) && hasResolvedIpsForUser(value)) return true
  if (hasLanHostIdentityForUser(value)) return true
  if (hasSavedMacIdentityForUser(value)) return true
  return false
}

const isSyntheticTrafficGroupUser = (user: string) => {
  const value = String(user || '').trim()
  if (!value || looksLikeIP(value)) return false
  if (isReservedPseudoTrafficUser(value) && !isHostResolvableTrafficUser(value)) return true
  if (!hasGroupedSourceMappingForUser(value)) return false
  return !hasExactHostMappingForUser(value) && !hasResolvedIpsForUser(value)
}

const shouldIncludeTrafficUser = (user: string) => {
  const value = String(user || '').trim()
  if (!value) return false
  if (isReservedPseudoTrafficUser(value)) return false
  if (looksLikeIP(value)) return true
  if (isSyntheticTrafficGroupUser(value)) return false
  return isHostResolvableTrafficUser(value)
}

const primaryIdentityForRow = (row: Row) => {
  if (row.limitOwner && hasPersistedLimit(row.limitOwner) && !isReservedPseudoTrafficUser(row.limitOwner)) {
    return `owner:${normalizeUserName(row.limitOwner)}`
  }
  const firstMac = (row.macs || []).map((value) => normalizeMac(value)).find(Boolean)
  if (firstMac) return `mac:${firstMac}`
  const firstIp = (row.ips || []).find((ip) => looksLikeIP(ip))
  if (firstIp) return `ip:${firstIp}`
  return `user:${normalizeUserName(row.user)}`
}

const pickBestDisplayForRow = (row: Row) => {
  const candidates = [row.user, row.limitOwner, ...(row.ips || [])]
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    if (isReservedPseudoTrafficUser(value)) continue
    if (looksLikeIP(value)) {
      const label = getExactHostLabel(value)
      if (label && !isReservedPseudoTrafficUser(label)) return label
      return value
    }
    return value
  }
  return row.user
}

const hasMapping = (user: string) => {
  const u = (user || '').trim()
  if (!u) return false
  return sourceIPLabelList.value.some((it) => (it.label || it.key) === u || it.key === u)
}

const startEdit = (user: string) => {
  editingUser.value = user
  const mapped = sourceIPLabelList.value.find((it) => it.key === user) || null
  editingName.value = (mapped?.label || user || '').toString()
}

const cancelEdit = () => {
  editingUser.value = null
  editingName.value = ''
}

const saveEdit = () => {
  const oldUser = editingUser.value
  const next = editingName.value.trim()
  if (!oldUser || !next) return

  let changed = false
  for (const it of sourceIPLabelList.value) {
    const u = it.label || it.key
    if (u === oldUser || it.key === oldUser) {
      it.label = next
      changed = true
    }
  }

  if (!changed && looksLikeIP(oldUser)) {
    sourceIPLabelList.value.push({
      key: oldUser,
      label: next,
      id: uuidv4(),
    })
  }

  cancelEdit()
}

const removeUser = (user: string) => {
  const u = (user || '').trim()
  if (!u) return
  for (let i = sourceIPLabelList.value.length - 1; i >= 0; i--) {
    const it = sourceIPLabelList.value[i]
    const name = it.label || it.key
    if (name === u || it.key === u) sourceIPLabelList.value.splice(i, 1)
  }
}

const preset = ref<'1h' | '24h' | '7d' | '30d' | 'custom'>('24h')
const topN = ref<number>(30)

type SortKey = 'user' | 'keys' | 'dl' | 'ul' | 'total'
const sortKey = ref<SortKey>('total')
const sortDir = ref<'asc' | 'desc'>('desc')

const setSort = (k: SortKey) => {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = k
    sortDir.value = k === 'user' || k === 'keys' ? 'asc' : 'desc'
  }
}

const customFrom = ref(dayjs().subtract(24, 'hour').format('YYYY-MM-DDTHH:mm'))
const customTo = ref(dayjs().format('YYYY-MM-DDTHH:mm'))

const range = computed(() => {
  const now = dayjs()
  if (preset.value === '1h') return { start: now.subtract(1, 'hour').valueOf(), end: now.valueOf() }
  if (preset.value === '24h') return { start: now.subtract(24, 'hour').valueOf(), end: now.valueOf() }
  if (preset.value === '7d') return { start: now.subtract(7, 'day').valueOf(), end: now.valueOf() }
  if (preset.value === '30d') return { start: now.subtract(30, 'day').valueOf(), end: now.valueOf() }

  const s = dayjs(customFrom.value)
  const e = dayjs(customTo.value)
  return {
    start: (s.isValid() ? s : now.subtract(24, 'hour')).valueOf(),
    end: (e.isValid() ? e : now).valueOf(),
  }
})

const knownKeysByUser = computed(() => {
  // Map normalized display user -> list of IP keys.
  const map = new Map<string, string[]>()
  for (const item of sourceIPLabelList.value || []) {
    const display = String((item as any)?.label || (item as any)?.key || '').trim()
    const ip = String((item as any)?.key || '').trim()
    if (!display || !ip || isPatternSourceKey(ip)) continue
    const norm = normalizeUserName(display)
    const keys = map.get(norm) || []
    if (!keys.includes(ip)) keys.push(ip)
    map.set(norm, keys)
  }
  return map
})

const canonicalUserByNorm = computed(() => {
  // Prefer explicit labels over raw IPs for display.
  const map = new Map<string, string>()
  for (const item of sourceIPLabelList.value || []) {
    const ip = String((item as any)?.key || '').trim()
    const label = String((item as any)?.label || '').trim()
    const display = (label || ip).trim()
    if (!display || isPatternSourceKey(ip)) continue
    const norm = normalizeUserName(display)
    const prev = map.get(norm)
    if (!prev) map.set(norm, display)
    else if (label && looksLikeIP(prev)) map.set(norm, display)
  }
  return map
})

const rows = computed<Row[]>(() => {
  const { start, end } = range.value
  // Traffic history buckets are primarily stored by stable keys (IP).
  const aggByKey = getTrafficRange(start, end)

  const normToIps = new Map<string, Set<string>>()
  for (const [norm, ips] of knownKeysByUser.value.entries()) {
    normToIps.set(norm, new Set(ips))
  }

  const matchedTrafficIpsByNorm = new Map<string, Set<string>>()
  for (const k of aggByKey.keys()) {
    const key = String(k || '').trim()
    if (!looksLikeIP(key)) continue
    const display = getExactHostLabel(key)
    const norm = normalizeUserName(display)
    if (!norm || norm === normalizeUserName(key)) continue
    const set = matchedTrafficIpsByNorm.get(norm) || new Set<string>()
    set.add(key)
    matchedTrafficIpsByNorm.set(norm, set)
  }

  const trafficResolvableNorms = new Set<string>(matchedTrafficIpsByNorm.keys())

  // Legacy buckets could still be stored under a label/synthetic key.
  const legacyKeysByNorm = new Map<string, Set<string>>()
  for (const k of aggByKey.keys()) {
    const key = String(k || '').trim()
    if (!key) continue
    if (looksLikeIP(key)) continue
    const norm = normalizeUserName(key)
    const set = legacyKeysByNorm.get(norm) || new Set<string>()
    set.add(key)
    legacyKeysByNorm.set(norm, set)
  }

  const canonicalFor = (s: string) => {
    const raw = String(s || '').trim()
    if (!raw) return ''
    const norm = normalizeUserName(raw)
    return canonicalUserByNorm.value.get(norm) || raw
  }

  const isTrafficResolvableUser = (user: string) => {
    const norm = normalizeUserName(user)
    return shouldIncludeTrafficUser(user) || trafficResolvableNorms.has(norm)
  }

  const addUser = (map: Map<string, string>, raw: string) => {
    const disp = canonicalFor(raw)
    if (!disp || !isTrafficResolvableUser(disp)) return
    const norm = normalizeUserName(disp)
    if (!map.has(norm)) map.set(norm, disp)
  }

  const all = new Map<string, string>()

  // From saved mapping.
  for (const [norm, ips] of normToIps.entries()) {
    const disp = canonicalUserByNorm.value.get(norm) || (ips.values().next().value || '')
    if (disp) all.set(norm, disp)
  }

  const displayUserForKey = (k: string) => {
    const key = String(k || '').trim()
    if (!key) return ''
    if (looksLikeIP(key)) return getExactHostLabel(key)
    return key
  }

  // From traffic buckets.
  for (const k of aggByKey.keys()) {
    addUser(all, displayUserForKey(String(k)))
  }

  // Also include users with saved limits (after applying profiles)
  for (const u of Object.keys(userLimits.value || {})) {
    if (!shouldIncludeTrafficUser(u)) continue
    addUser(all, u)
  }

  // Fallback: ensure active users are still visible even if traffic history is empty
  for (const c of activeConnections.value || []) {
    const ip = String((c as any)?.metadata?.sourceIP || '').trim()
    const u = getExactHostLabel(ip)
    addUser(all, u)
  }

  // Also include users that have QoS applied on the router, even if they are idle
  // and browser local storage was cleared. This keeps the row visible and lets the
  // UI restore QoS state from agent qos_status instead of depending on cached pins.
  for (const item of qosStatus.value.items || []) {
    const ip = String(item?.ip || '').trim()
    if (!looksLikeIP(ip)) continue
    const u = getExactHostLabel(ip)
    addUser(all, u)
  }

  const rawList: Row[] = Array.from(all.entries()).map(([norm, user]) => {
    const keysSet = new Set<string>()

    // IP keys from mapping.
    for (const ip of normToIps.get(norm) || []) keysSet.add(ip)

    // Pattern-based mapping (CIDR / regex) resolved from recorded traffic buckets.
    for (const ip of matchedTrafficIpsByNorm.get(norm) || []) keysSet.add(ip)

    // If the displayed user is an IP itself, include it.
    if (looksLikeIP(user)) keysSet.add(user)

    // Legacy buckets stored under a label/synthetic key.
    for (const lk of legacyKeysByNorm.get(norm) || []) keysSet.add(lk)

    let dl = 0
    let ul = 0
    for (const k of keysSet) {
      const t = aggByKey.get(k)
      dl += t?.dl || 0
      ul += t?.ul || 0
    }

    const liveIps = (activeConnections.value || [])
      .map((c) => String((c as any)?.metadata?.sourceIP || '').trim())
      .filter((ip) => {
        if (!looksLikeIP(ip)) return false
        const display = getExactHostLabel(ip)
        return normalizeUserName(display) === norm || normalizeUserName(ip) === norm
      })

    const baseIps = Array.from(new Set([
      ...Array.from(keysSet).filter((k) => looksLikeIP(k)),
      ...(getIpsForUser(user) || []),
      ...liveIps,
    ].filter((k) => looksLikeIP(k)))).sort((a, b) => a.localeCompare(b))

    const baseMacs = resolveMacsForIdentity(user, baseIps)
    const limitOwnerResolution = resolveLimitOwnerForRow(user, baseIps, baseMacs)
    const limitOwner = limitOwnerResolution.owner
    const resolvedMacs = resolveMacsForIdentity(user, baseIps, limitOwner)

    const resolvedIps = Array.from(new Set([
      ...baseIps,
      ...ipsForLimitOwner(user, baseIps, resolvedMacs),
      ...(limitOwner !== user ? ipsForLimitOwner(limitOwner, baseIps, resolvedMacs) : []),
    ].filter((k) => looksLikeIP(k)))).sort((a, b) => a.localeCompare(b))

    const keys = resolvedIps.length ? resolvedIps.join(', ') : resolvedMacs.join(', ')
    const currentQos = resolveRowQos(resolvedIps)

    return {
      user,
      keys,
      dl,
      ul,
      ips: resolvedIps,
      macs: resolvedMacs,
      limitOwner,
      limitOwnerReason: limitOwnerResolution.reason,
      limitOwnerMatch: limitOwnerResolution.match,
      currentQos,
    }
  })

  const mergeQosState = (left: RowQosState, right: RowQosState): RowQosState => {
    const values = Array.from(new Set([left, right].filter(Boolean))) as RowQosState[]
    if (!values.length) return undefined
    if (values.includes('mixed')) return 'mixed'
    return values.length === 1 ? values[0] : 'mixed'
  }

  const list = Array.from(rawList.reduce((acc, row) => {
    const key = primaryIdentityForRow(row)
    const current = acc.get(key)
    if (!current) {
      acc.set(key, { ...row, ips: [...row.ips], macs: [...row.macs] })
      return acc
    }

    current.dl += row.dl
    current.ul += row.ul
    current.ips = Array.from(new Set([...(current.ips || []), ...(row.ips || [])].filter((ip) => looksLikeIP(ip)))).sort((a, b) => a.localeCompare(b))
    current.macs = Array.from(new Set([...(current.macs || []), ...(row.macs || [])].map((value) => normalizeMac(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    current.currentQos = mergeQosState(current.currentQos, row.currentQos)
    if (current.limitOwner === current.user && row.limitOwner !== row.user) {
      current.limitOwner = row.limitOwner
      current.limitOwnerReason = row.limitOwnerReason
      current.limitOwnerMatch = row.limitOwnerMatch
    } else if (!current.limitOwnerMatch && row.limitOwnerMatch) {
      current.limitOwnerMatch = row.limitOwnerMatch
    }
    if (!isSyntheticTrafficGroupUser(row.user)) {
      if (looksLikeIP(current.user) && !looksLikeIP(row.user)) current.user = row.user
      else if (current.user === current.limitOwner && row.user !== row.limitOwner && !looksLikeIP(row.user)) current.user = row.user
    }
    current.user = pickBestDisplayForRow(current)
    current.keys = current.ips.length ? current.ips.join(', ') : current.macs.join(', ')
    return acc
  }, new Map<string, Row>()).values()).map((row) => ({
    ...row,
    user: pickBestDisplayForRow(row),
  })).filter((row) => isTrafficResolvableUser(row.user) && isTrafficResolvableUser(row.limitOwner || ''))

  const sorted = list.sort((a, b) => {
    const dir = sortDir.value === 'asc' ? 1 : -1
    if (sortKey.value === 'user') return dir * a.user.localeCompare(b.user)
    if (sortKey.value === 'keys') return dir * a.keys.localeCompare(b.keys)
    if (sortKey.value === 'dl') return dir * (a.dl - b.dl)
    if (sortKey.value === 'ul') return dir * (a.ul - b.ul)
    const at = a.dl + a.ul
    const bt = b.dl + b.ul
    return dir * (at - bt)
  })

  if (topN.value > 0) {
    const pinnedUsers = new Set(Object.keys(userLimits.value || {}).filter((user) => Boolean(user) && shouldIncludeTrafficUser(user)))
    const sliced = sorted.slice(0, topN.value)
    const keep = new Set(sliced.map((row) => row.user))
    for (const row of sorted) {
      if (keep.has(row.user)) continue
      if (!pinnedUsers.has(row.user) && !pinnedUsers.has(row.limitOwner) && !row.currentQos) continue
      sliced.push(row)
      keep.add(row.user)
    }
    return sliced
  }
  return sorted
})

watch(rows, () => {
  ensureQosDrafts()
}, { deep: true, immediate: true })

const applyUserQos = async (row: Row) => {
  const ready = await ensureAgentReady()
  const ips = await resolveIpsForQosAction(row)
  if (!ready || !ips.length) {
    showNotification({ content: 'Не найден IP для применения QoS', type: 'alert-warning', timeout: 2200 })
    return
  }
  const profile = qosDraftByUser.value[row.user] || 'normal'
  applyingQosUser.value = row.user
  try {
    const results = await Promise.all(ips.map((ip) => agentSetHostQosAPI({ ip, profile })))
    const failed = results.find((it) => !it.ok)
    if (failed) {
      showNotification({ content: failed.error || 'QoS apply failed', type: 'alert-error', timeout: 2200 })
      return
    }
    for (const ip of ips) setRouterHostQosAppliedProfile(ip, profile)
    await refreshQosStatus()
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
  } finally {
    applyingQosUser.value = ''
  }
}

const clearUserQos = async (row: Row) => {
  const ready = await ensureAgentReady()
  const ips = await resolveIpsForQosAction(row)
  if (!ready || !ips.length) {
    showNotification({ content: 'Не найден IP для очистки QoS', type: 'alert-warning', timeout: 2200 })
    return
  }
  applyingQosUser.value = row.user
  try {
    const results = await Promise.all(ips.map((ip) => agentRemoveHostQosAPI(ip)))
    const failed = results.find((it) => !it.ok)
    if (failed) {
      showNotification({ content: failed.error || 'QoS clear failed', type: 'alert-error', timeout: 2200 })
      return
    }
    for (const ip of ips) setRouterHostQosAppliedProfile(ip)
    await refreshQosStatus()
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 })
  } finally {
    applyingQosUser.value = ''
  }
}

onMounted(() => {
  bootstrapRouterAgentForLan()
  void (async () => {
    await ensureAgentReady()
    await usersDbPullNow()
    await refreshQosStatus()
  })()
  qosTimer = window.setInterval(() => {
    void refreshQosStatus()
  }, 12000)
})

onBeforeUnmount(() => {
  if (qosTimer) window.clearInterval(qosTimer)
})

const speed = (bps: number) => `${prettyBytesHelper(bps || 0)}/s`
const format = (b: number) => formatTraffic(b)
const buckets = computed(() => userTrafficStoreSize.value)

type ReportGroupBy = 'day' | 'week' | 'month'
type ReportPreviewRow = { period: string; user: string; dl: number; ul: number }

const reportDialogOpen = ref(false)
const reportGroupBy = ref<ReportGroupBy>('day')
const reportUser = ref('')
const reportSkipEmpty = ref(true)

const reportUsers = computed(() => rows.value.map((row) => row.user).filter(Boolean).sort((a, b) => a.localeCompare(b)))

const reportRangeLabel = computed(() => {
  const start = dayjs(range.value.start)
  const end = dayjs(range.value.end)
  return `${start.format('YYYY-MM-DD HH:mm')} → ${end.format('YYYY-MM-DD HH:mm')}`
})

const reportPreviewRows = computed<ReportPreviewRow[]>(() => {
  const grouped = getTrafficGrouped(range.value.start, range.value.end, reportGroupBy.value as TrafficGroupBy)
  const out: ReportPreviewRow[] = []

  for (const [period, users] of grouped.entries()) {
    for (const [key, bucket] of users.entries()) {
      const displayUser = key ? getExactHostLabel(key) : ''
      const user = displayUser || key || t('unknown')
      if (reportUser.value && user !== reportUser.value) continue
      const dl = Number(bucket?.dl || 0)
      const ul = Number(bucket?.ul || 0)
      if (reportSkipEmpty.value && dl <= 0 && ul <= 0) continue
      out.push({ period, user, dl, ul })
    }
  }

  return out.sort((a, b) => {
    const p = a.period.localeCompare(b.period)
    if (p !== 0) return p
    return a.user.localeCompare(b.user)
  })
})

const reportRowsCount = computed(() => reportPreviewRows.value.length)
const reportPreviewLimited = computed(() => reportPreviewRows.value.length >= 500)

const csvEscape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`
const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const text = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const exportTableCsv = () => {
  const tableRows = rows.value.map((row) => [row.user, row.keys, row.dl, row.ul, row.dl + row.ul])
  downloadCsv('user-traffic-table.csv', ['user', 'keys', 'download', 'upload', 'total'], tableRows)
}

const exportReportCsv = () => {
  const dataRows = reportPreviewRows.value.map((row) => [row.period, row.user, row.dl, row.ul, row.dl + row.ul])
  downloadCsv('user-traffic-report.csv', ['period', 'user', 'download', 'upload', 'total'], dataRows)
}

const bpsToMbps = (bps: number) => {
  const v = ((bps || 0) * 8) / 1_000_000
  if (!Number.isFinite(v) || v <= 0) return '0'
  const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10
  return String(r).replace(/\.0$/, '')
}

const trafficIconTitle = (limitBytes: number, period: UserLimitPeriod, enabled: boolean) => {
  const on = enabled ? '' : ' (выкл)'
  return `Лимит трафика: ${format(limitBytes)} / ${periodLabel(period)}${on}`
}

const bandwidthIconTitle = (bps: number, enabled: boolean) => {
  const on = enabled ? '' : ' (выкл)'
  return `Лимит канала: ${bpsToMbps(bps)} Mbps${on}`
}

const clearHistory = () => {
  clearUserTrafficHistory()
}

// --- Limits aggregation for the table ---
const normalizeResetAt = (ts: number) => {
  // legacy fallback (when baseline fields are missing)
  const d = dayjs(ts)
  if (d.minute() === 0 && d.second() === 0 && d.millisecond() === 0) return ts
  return d.add(1, 'hour').startOf('hour').valueOf()
}

const hasResetBaseline = (l: any) => {
  return !!l?.resetHourKey && Number.isFinite(l?.resetHourDl) && Number.isFinite(l?.resetHourUl)
}

const windowForLimit = (l: ReturnType<typeof getUserLimit>) => {
  const now = dayjs()
  let start = now.subtract(30, 'day')
  if (l.trafficPeriod === '1d') start = now.subtract(24, 'hour')
  if (l.trafficPeriod === 'month') start = now.startOf('month')
  let startTs = start.valueOf()

  let useBaseline = false
  if (l.resetAt && l.resetAt > startTs) {
    if (hasResetBaseline(l)) {
      startTs = l.resetAt
      useBaseline = true
    } else {
      startTs = normalizeResetAt(l.resetAt)
      useBaseline = false
    }
  }

  const startHourTs = dayjs(startTs).startOf('hour').valueOf()
  return { startTs, startHourTs, endTs: now.valueOf(), useBaseline }
}

const periodLabel = (p: UserLimitPeriod) => {
  if (p === '1d') return '24h'
  if (p === 'month') return 'month'
  return '30d'
}

const speedByIp = computed(() => {
  const map: Record<string, number> = {}
  for (const c of activeConnections.value || []) {
    const ip = String((c as any)?.metadata?.sourceIP || '').trim()
    if (!looksLikeIP(ip)) continue
    map[ip] = (map[ip] || 0) + Number((c as any)?.downloadSpeed || 0) + Number((c as any)?.uploadSpeed || 0)
  }
  return map
})

const limitStates = computed(() => {
  const out: Record<
    string,
    {
      enabled: boolean
      usageBytes: number
      trafficLimitBytes: number
      bandwidthLimitBps: number
      speedBps: number
      blocked: boolean
      percent: string
      periodLabel: string
    }
  > = {}

  // Build windows per user appearing in the table.
  const windows = new Map<string, { startHourTs: number; endTs: number; users: string[] }>()
  for (const row of rows.value) {
    const l = rowLimit(row)
    const hasTraffic = (l.trafficLimitBytes || 0) > 0
    const hasBw = (l.bandwidthLimitBps || 0) > 0
    if (!hasTraffic && !hasBw && !l.disabled) continue

    const w = windowForLimit(l)
    const key = `${l.trafficPeriod}:${w.startHourTs}`
    const item = windows.get(key) || { startHourTs: w.startHourTs, endTs: w.endTs, users: [] }
    item.users.push(row.user)
    windows.set(key, item)
  }

  const aggByKey = new Map<string, Map<string, { dl: number; ul: number }>>()
  for (const [key, w] of windows.entries()) {
    aggByKey.set(key, getTrafficRange(w.startHourTs, w.endTs))
  }

  for (const row of rows.value) {
    const l = rowLimit(row)
    const w = windowForLimit(l)
    const key = `${l.trafficPeriod}:${w.startHourTs}`
    const agg = aggByKey.get(key)
    const keys = new Set<string>([rowLimitOwner(row), row.user])
    for (const ip of effectiveIpsForRow(row)) keys.add(ip)

    let dl = 0
    let ul = 0
    for (const k of keys) {
      const t = agg?.get(k)
      dl += t?.dl || 0
      ul += t?.ul || 0
    }
    if (w.useBaseline) {
      dl = Math.max(0, dl - (l.resetHourDl || 0))
      ul = Math.max(0, ul - (l.resetHourUl || 0))
    }
    const usage = dl + ul
    const tl = l.trafficLimitBytes || 0

    const sp = effectiveIpsForRow(row).reduce((sum, ip) => sum + (speedByIp.value[ip] || 0), 0)
    const bl = l.bandwidthLimitBps || 0

    const trafficExceeded = l.enabled && tl > 0 && usage >= tl
    const bandwidthExceeded = l.enabled && bl > 0 && sp >= bl

    const bwViaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value

    // Manual block works regardless of "enabled".
    const blocked = l.disabled || (l.enabled && (trafficExceeded || (!bwViaAgent && bandwidthExceeded)))

    const pct = tl > 0 ? Math.min(999, Math.floor((usage / tl) * 100)) : 0

    out[row.user] = {
      enabled: !!l.enabled,
      usageBytes: usage,
      trafficLimitBytes: tl,
      bandwidthLimitBps: bl,
      speedBps: sp,
      blocked,
      percent: tl > 0 ? String(pct) : '0',
      periodLabel: periodLabel(l.trafficPeriod),
    }
  }

  return out
})

const blockedActionBusy = ref(false)

const setResetBaselineNow = (user: string, extra: Record<string, any> = {}) => {
  const now = Date.now()
  const keys = new Set<string>([user])
  for (const ip of ipsForLimitOwner(user)) keys.add(ip)

  let dl = 0
  let ul = 0
  for (const k of keys) {
    const b = getUserHourBucket(k, now)
    dl += b.dl || 0
    ul += b.ul || 0
  }

  setUserLimit(user, {
    ...extra,
    resetAt: now,
    resetHourKey: dayjs(now).format('YYYY-MM-DDTHH'),
    resetHourDl: dl,
    resetHourUl: ul,
  })
}

const applyNow = async () => {
  if (blockedActionBusy.value) return
  blockedActionBusy.value = true
  try {
    await applyUserEnforcementNow()
  } finally {
    blockedActionBusy.value = false
  }
}

const blockedList = computed(() => {
  const out: Array<{
    user: string
    ips: string
    usageBytes: number
    trafficLimitBytes: number
    bandwidthLimitBps: number
    limitEnabled: boolean
    periodLabel: string
    periodKey: UserLimitPeriod
    reasonManual: boolean
    reasonTraffic: boolean
    reasonBandwidth: boolean
  }> = []

  const keys = Object.keys(userLimits.value || {})
  for (const user of keys) {
    if (!shouldIncludeTrafficUser(user)) continue
    const st = getUserLimitState(user)
    if (!st.blocked) continue
    const ips = (getIpsForUser(user) || []).join(', ')
    out.push({
      user,
      ips,
      usageBytes: st.usageBytes || 0,
      trafficLimitBytes: st.limit.trafficLimitBytes || 0,
      bandwidthLimitBps: st.limit.bandwidthLimitBps || 0,
      limitEnabled: !!st.limit.enabled,
      periodLabel: periodLabel(st.limit.trafficPeriod),
      periodKey: st.limit.trafficPeriod,
      reasonManual: !!st.limit.disabled,
      reasonTraffic: !!st.trafficExceeded,
      reasonBandwidth: !!st.bandwidthExceeded,
    })
  }

  // Sort: manual first, then traffic exceed, then bandwidth.
  out.sort((a, b) => {
    const pa = a.reasonManual ? 0 : a.reasonTraffic ? 1 : a.reasonBandwidth ? 2 : 3
    const pb = b.reasonManual ? 0 : b.reasonTraffic ? 1 : b.reasonBandwidth ? 2 : 3
    if (pa !== pb) return pa - pb
    return a.user.localeCompare(b.user)
  })

  return out
})

const unblockAndReset = async (user: string) => {
  if (!user) return
  if (blockedActionBusy.value) return
  blockedActionBusy.value = true
  try {
    const l = getUserLimit(user)
    setResetBaselineNow(user, {
      disabled: false,
      // Keep enabled as-is.
      enabled: l.enabled,
    })
    await applyUserEnforcementNow()
    showNotification({ content: 'blockedUnblockDone', params: { user }, type: 'alert-success', timeout: 2200 })
  } catch (e) {
    console.error(e)
    showNotification({ content: 'blockedActionFailed', params: { user }, type: 'alert-error', timeout: 4500 })
  } finally {
    blockedActionBusy.value = false
  }
}

const disableLimitsQuick = async (user: string) => {
  if (!user) return
  if (blockedActionBusy.value) return
  blockedActionBusy.value = true
  try {
    setResetBaselineNow(user, { enabled: false, disabled: false })
    await applyUserEnforcementNow()
    showNotification({ content: 'blockedDisableDone', params: { user }, type: 'alert-success', timeout: 2200 })
  } catch (e) {
    console.error(e)
    showNotification({ content: 'blockedActionFailed', params: { user }, type: 'alert-error', timeout: 4500 })
  } finally {
    blockedActionBusy.value = false
  }
}


type ShaperBadge = { icon: any; cls: string; title: string; showReapply: boolean; summary: string }
type RuntimeBadge = { text: string; cls: string; title?: string }

const qosAppliedIpCount = computed(() => (qosStatus.value.items || []).length)

const shaperBadge = computed<Record<string, ShaperBadge | null>>(() => {
  const out: Record<string, ShaperBadge | null> = {}
  const viaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value
  if (!viaAgent) return out

  const st = agentShaperStatus.value || {}
  const managed = managedAgentShapers.value || {}

  for (const row of rows.value) {
    const l = rowLimit(row)
    if (!l.enabled || !l.bandwidthLimitBps || l.bandwidthLimitBps <= 0) {
      out[row.user] = null
      continue
    }

    const ips = effectiveIpsForRow(row)
    if (!ips.length) {
      out[row.user] = {
        icon: QuestionMarkCircleIcon,
        cls: 'text-base-content/60',
        title: `${row.user}: no IPs`,
        showReapply: true,
        summary: t('shaperUnknown'),
      }
      continue
    }

    const expectedMbps = +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2)
    const statuses = ips.map((ip) => st[ip]).filter(Boolean)
    const hasFail = ips.some((ip) => st[ip] && st[ip].ok === false)
    const allOk = ips.every((ip) => st[ip] && st[ip].ok === true)
    const managedMismatch = ips.some((ip) => {
      const shaped = managed[ip]
      if (!shaped) return true
      return Math.abs((shaped.upMbps || 0) - expectedMbps) > 0.05 || Math.abs((shaped.downMbps || 0) - expectedMbps) > 0.05
    })
    const ipSuffix = ips.length ? ` · ${ips.join(', ')}` : ''

    if (hasFail) {
      const firstErr = ips.map((ip) => st[ip]).find((x) => x && !x.ok)?.error
      out[row.user] = {
        icon: XMarkIcon,
        cls: 'text-error',
        title: `${t('shaperFailed')}${firstErr ? `: ${firstErr}` : ''}${ipSuffix}`,
        showReapply: true,
        summary: t('shaperFailed'),
      }
    } else if (allOk && !managedMismatch) {
      out[row.user] = {
        icon: CheckCircleIcon,
        cls: 'text-success',
        title: `${t('shaperApplied')} · ${expectedMbps} Mbps${ipSuffix}`,
        showReapply: false,
        summary: t('shaperApplied'),
      }
    } else if (!statuses.length || managedMismatch) {
      out[row.user] = {
        icon: QuestionMarkCircleIcon,
        cls: 'text-base-content/60',
        title: `${managedMismatch ? `${t('shaperUnknown')} · UI/agent mismatch` : t('shaperUnknown')}${ipSuffix}`,
        showReapply: true,
        summary: t('shaperUnknown'),
      }
    } else {
      out[row.user] = {
        icon: QuestionMarkCircleIcon,
        cls: 'text-base-content/60',
        title: `${t('shaperUnknown')}${ipSuffix}`,
        showReapply: true,
        summary: t('shaperUnknown'),
      }
    }
  }

  return out
})

const runtimeBadgeClass = (tone: 'neutral' | 'success' | 'warning' | 'error' | 'info') => {
  if (tone === 'success') return 'border-success/30 bg-success/10 text-success'
  if (tone === 'warning') return 'border-warning/30 bg-warning/10 text-warning'
  if (tone === 'error') return 'border-error/30 bg-error/10 text-error'
  if (tone === 'info') return 'border-info/30 bg-info/10 text-info'
  return 'border-base-content/15 bg-base-200/60 text-base-content/80'
}

const runtimeProfileBadgeClass = (profile: AgentQosProfile | 'mixed') => {
  if (profile === 'mixed') return runtimeBadgeClass('warning')
  if (profile === 'critical') return 'border-error/30 bg-error/10 text-error'
  if (profile === 'high') return 'border-success/30 bg-success/10 text-success'
  if (profile === 'elevated') return 'border-accent/30 bg-accent/10 text-accent'
  if (profile === 'low') return 'border-warning/30 bg-warning/10 text-warning'
  if (profile === 'background') return 'border-base-content/15 bg-base-200/60 text-base-content/75'
  return 'border-info/30 bg-info/10 text-info'
}

const formatMbpsCompact = (value?: number) => {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n))
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

const compactList = (items: string[], max = 2) => {
  const list = Array.from(new Set((items || []).filter(Boolean)))
  if (!list.length) return ''
  if (list.length <= max) return list.join(', ')
  return `${list.slice(0, max).join(', ')} +${list.length - max}`
}

type RowSourceRuleSummary = {
  kind: SourceIpRuleKind
  ruleKeys: string[]
  matchedIps: string[]
}

const sourceRuleKindLabel = (kind: SourceIpRuleKind) => {
  if (kind === 'cidr') return t('sourceIpRuleKindCidr')
  if (kind === 'regex') return t('sourceIpRuleKindRegex')
  if (kind === 'suffix') return t('sourceIpRuleKindSuffix')
  return t('sourceIpRuleKindExact')
}

const sourceRuleBadgeClass = (kind: SourceIpRuleKind) => {
  if (kind === 'cidr') return runtimeBadgeClass('info')
  if (kind === 'regex') return runtimeBadgeClass('warning')
  if (kind === 'suffix') return 'border-secondary/30 bg-secondary/10 text-secondary'
  return runtimeBadgeClass('neutral')
}

const rowSourceRuleSummaries = (row: Row): RowSourceRuleSummary[] => {
  const grouped = new Map<SourceIpRuleKind, { kind: SourceIpRuleKind; ruleKeys: Set<string>; matchedIps: Set<string> }>()

  for (const ip of effectiveIpsForRow(row)) {
    const resolved = getPrimarySourceIpRule(ip)
    if (!resolved?.kind) continue

    const current = grouped.get(resolved.kind) || {
      kind: resolved.kind,
      ruleKeys: new Set<string>(),
      matchedIps: new Set<string>(),
    }
    if (resolved.key) current.ruleKeys.add(resolved.key)
    current.matchedIps.add(ip)
    grouped.set(resolved.kind, current)
  }

  return Array.from(grouped.values())
    .map((item) => ({
      kind: item.kind,
      ruleKeys: Array.from(item.ruleKeys).sort((a, b) => a.localeCompare(b)),
      matchedIps: Array.from(item.matchedIps).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      if (b.matchedIps.length !== a.matchedIps.length) return b.matchedIps.length - a.matchedIps.length
      return sourceRuleKindLabel(a.kind).localeCompare(sourceRuleKindLabel(b.kind))
    })
}

const rowSourceRuleBadgeTitle = (summary: RowSourceRuleSummary) => {
  const kind = sourceRuleKindLabel(summary.kind)
  const rules = compactList(summary.ruleKeys, 3) || '—'
  const ips = compactList(summary.matchedIps, 4) || '—'
  return [
    t('sourceIpRowMatchedTitle', { kind, count: summary.matchedIps.length }),
    t('sourceIpRowRulesTitle', { rules }),
    t('sourceIpRowIpsTitle', { ips }),
  ].join('\n')
}

const rowSourceRuleBadges = (row: Row): RuntimeBadge[] => {
  return rowSourceRuleSummaries(row).map((summary) => ({
    text: `${sourceRuleKindLabel(summary.kind)} · ${t('sourceIpRowIpCountShort', { count: summary.matchedIps.length })}`,
    cls: sourceRuleBadgeClass(summary.kind),
    title: rowSourceRuleBadgeTitle(summary),
  }))
}

const rowOwnerResolutionReasonLabel = (row: Row) => {
  if (row.limitOwnerReason === 'persisted') return t('userTrafficOwnerReasonPersisted')
  if (row.limitOwnerReason === 'mac') return t('userTrafficOwnerReasonMac')
  if (row.limitOwnerReason === 'ip') return t('userTrafficOwnerReasonIp')
  if (row.limitOwnerReason === 'name') return t('userTrafficOwnerReasonName')
  return t('userTrafficOwnerReasonSelf')
}

const rowOwnerResolutionBadges = (row: Row): RuntimeBadge[] => {
  const owner = rowLimitOwner(row)
  if (!owner || owner === row.user) return []
  return [{
    text: t('userTrafficLimitOwnerBadge', { owner }),
    cls: runtimeBadgeClass('warning'),
    title: [
      t('userTrafficLimitOwnerTitle', { display: row.user, owner }),
      t('userTrafficLimitOwnerReasonTitle', { reason: rowOwnerResolutionReasonLabel(row), match: row.limitOwnerMatch || '—' }),
    ].join('\n'),
  }]
}

const rowResolvedMacs = (row: Row) => resolveMacsForIdentity(row.user, effectiveIpsForRow(row), rowLimitOwner(row))

const rowAgentQosItems = (row: Row) => {
  const seen = new Set<string>()
  return effectiveIpsForRow(row)
    .map((ip) => qosMap.value[ip])
    .filter((item): item is AgentQosStatusItem => {
      if (!item?.ip || seen.has(item.ip)) return false
      seen.add(item.ip)
      return true
    })
}

const rowStoredOnlyQosIps = (row: Row) => {
  const seen = new Set<string>()
  return effectiveIpsForRow(row).filter((ip) => {
    if (seen.has(ip)) return false
    seen.add(ip)
    return !qosMap.value[ip] && !!routerHostQosAppliedProfiles.value[ip]
  })
}

const rowRuntimeBadges = (row: Row): RuntimeBadge[] => {
  const out: RuntimeBadge[] = []
  const ips = effectiveIpsForRow(row)
  const agentItems = rowAgentQosItems(row)
  const storedOnlyIps = rowStoredOnlyQosIps(row)

  if (row.currentQos === 'mixed') {
    out.push({ text: `QoS: ${t('hostQosMixed')}`, cls: runtimeProfileBadgeClass('mixed') })
  } else if (row.currentQos) {
    out.push({ text: `QoS: ${profileLabel(row.currentQos)}`, cls: runtimeProfileBadgeClass(row.currentQos) })
  }

  if (agentItems.length) {
    out.push({
      text: `agent ${agentItems.length}/${ips.length || agentItems.length} IP`,
      cls: runtimeBadgeClass('success'),
      title: 'Профиль подтверждён router-agent для указанных IP.',
    })
  } else if (storedOnlyIps.length) {
    out.push({
      text: `UI ${storedOnlyIps.length}/${ips.length || storedOnlyIps.length} IP`,
      cls: runtimeBadgeClass('warning'),
      title: 'Профиль сохранён в UI, но пока не подтверждён в свежем ответе router-agent.',
    })
  }

  const priorities = Array.from(new Set(agentItems.map((item) => item.priority).filter((value) => value !== undefined && value !== null)))
  if (priorities.length === 1) out.push({ text: `prio ${priorities[0]}`, cls: runtimeBadgeClass('neutral') })

  const upValues = Array.from(new Set(agentItems.map((item) => Number(item.upMinMbit || 0)).filter((value) => value > 0)))
  if (upValues.length === 1) out.push({ text: `↑ ${formatMbpsCompact(upValues[0])} Мбит`, cls: runtimeBadgeClass('info') })

  if (qosStatus.value.qosDownlinkEnabled) {
    const downValues = Array.from(new Set(agentItems.map((item) => Number(item.downMinMbit || 0)).filter((value) => value > 0)))
    if (downValues.length === 1) out.push({ text: `↓ ${formatMbpsCompact(downValues[0])} Мбит`, cls: runtimeBadgeClass('info') })
  }

  const shape = shaperBadge.value[row.user]
  if (shape?.summary) {
    const tone: 'success' | 'warning' | 'error' = shape.cls.includes('text-success') ? 'success' : shape.cls.includes('text-error') ? 'error' : 'warning'
    out.push({ text: `Shape: ${shape.summary}`, cls: runtimeBadgeClass(tone), title: shape.title })
  }

  return out
}

const rowRuntimeMetaLine = (row: Row) => {
  const parts: string[] = []
  const ips = effectiveIpsForRow(row)
  const macs = rowResolvedMacs(row)
  if (rowLimitOwner(row) !== row.user) parts.push(t('userTrafficLimitOwnerMeta', { owner: rowLimitOwner(row) }))
  if (ips.length) parts.push(`IP: ${compactList(ips, 2)}`)
  if (macs.length) parts.push(`MAC: ${compactList(macs, 1)}`)
  if ((row.currentQos || rowStoredOnlyQosIps(row).length) && qosStatus.value.qosMode === 'wan-only') parts.push('safe WAN-only')
  return parts.join(' · ')
}

const rowRuntimeTitle = (row: Row) => {
  const parts: string[] = []
  const ips = effectiveIpsForRow(row)
  const macs = rowResolvedMacs(row)
  const agentItems = rowAgentQosItems(row)
  const storedOnlyIps = rowStoredOnlyQosIps(row)
  if (row.currentQos === 'mixed') parts.push(`QoS: ${t('hostQosMixed')}`)
  else if (row.currentQos) parts.push(`QoS: ${profileLabel(row.currentQos)}`)
  else parts.push(`QoS: ${t('hostQosNone')}`)
  if (rowLimitOwner(row) !== row.user) parts.push(t('userTrafficLimitOwnerRuntimeTitle', { display: row.user, owner: rowLimitOwner(row), reason: rowOwnerResolutionReasonLabel(row), match: row.limitOwnerMatch || '—' }))
  if (qosStatus.value.qosMode) parts.push(`Mode: ${qosStatus.value.qosMode}`)
  if (agentItems.length) parts.push(`Agent confirmed IP: ${agentItems.map((item) => item.ip).join(', ')}`)
  if (storedOnlyIps.length) parts.push(`UI-only IP: ${storedOnlyIps.join(', ')}`)
  for (const summary of rowSourceRuleSummaries(row)) {
    parts.push(`Source ${sourceRuleKindLabel(summary.kind)}: ${summary.ruleKeys.join(', ')} -> ${summary.matchedIps.join(', ')}`)
  }
  if (ips.length) parts.push(`Effective IP: ${ips.join(', ')}`)
  if (macs.length) parts.push(`MAC: ${macs.join(', ')}`)
  const priorities = Array.from(new Set(agentItems.map((item) => item.priority).filter((value) => value !== undefined && value !== null)))
  if (priorities.length === 1) parts.push(`Queue priority: ${priorities[0]}`)
  const upValues = Array.from(new Set(agentItems.map((item) => Number(item.upMinMbit || 0)).filter((value) => value > 0)))
  if (upValues.length === 1) parts.push(`Guaranteed uplink: ${formatMbpsCompact(upValues[0])} Мбит`)
  if (qosStatus.value.qosDownlinkEnabled) {
    const downValues = Array.from(new Set(agentItems.map((item) => Number(item.downMinMbit || 0)).filter((value) => value > 0)))
    if (downValues.length === 1) parts.push(`Guaranteed downlink: ${formatMbpsCompact(downValues[0])} Мбит`)
  }
  const badge = shaperBadge.value[row.user]
  if (badge?.title) parts.push(badge.title)
  return parts.join('\n')
}

const applyingShaperUser = ref<string | null>(null)
const refreshingRuntimeUser = ref<string | null>(null)

const refreshRowRuntime = async (row: Row) => {
  refreshingRuntimeUser.value = row.user
  try {
    await ensureAgentReady()
    await usersDbPullNow()
    await refreshAgentRuntime()
    await refreshQosStatus()
  } finally {
    refreshingRuntimeUser.value = null
  }
}

const reapplyShaper = async (row: Row) => {
  const user = rowLimitOwner(row)
  if (!user) return
  await ensureAgentReady()
  applyingShaperUser.value = row.user
  try {
    await reapplyAgentShapingForUser(user)
    await refreshAgentRuntime()
    await refreshQosStatus()
  } finally {
    applyingShaperUser.value = null
  }
}

// --- Limits dialog ---
const limitsDialogOpen = ref(false)
const limitsUser = ref('')
const limitsUserDisplay = ref('')

const draftEnabled = ref(false)
const draftDisabled = ref(false)
const draftMac = ref('')
const macCandidates = ref<string[]>([])
const macLoading = ref(false)
const macApplyLoading = ref(false)
const draftTrafficValue = ref<number>(0)
const draftTrafficUnit = ref<'GB' | 'MB'>('GB')
const draftBandwidthMbps = ref<number>(0)
const draftPeriod = ref<UserLimitPeriod>('30d')

const bytesFromTraffic = (value: number, unit: 'GB' | 'MB') => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  const factor = unit === 'GB' ? 1_000_000_000 : 1_000_000
  return Math.round(n * factor)
}

const bpsFromMbps = (mbps: number) => {
  const n = Number(mbps)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round((n * 1_000_000) / 8)
}

const openLimits = (user: string, displayUser = user) => {
  limitsUser.value = user
  limitsUserDisplay.value = displayUser
  const l = getUserLimit(user)
  draftEnabled.value = l.enabled
  draftDisabled.value = l.disabled
  draftMac.value = (l.mac || '').toString().trim().toLowerCase()
  macCandidates.value = draftMac.value ? [draftMac.value] : []
  draftPeriod.value = l.trafficPeriod
  draftTrafficUnit.value = (l.trafficLimitUnit as any) || (l.trafficLimitBytes >= 1_000_000_000 ? 'GB' : 'MB')
  const factor = draftTrafficUnit.value === 'GB' ? 1_000_000_000 : 1_000_000
  draftTrafficValue.value = l.trafficLimitBytes ? +(l.trafficLimitBytes / factor).toFixed(2) : 0
  draftBandwidthMbps.value = l.bandwidthLimitBps ? +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2) : 0
  limitsDialogOpen.value = true
}

const refreshMac = async () => {
  const user = limitsUser.value
  if (!user) return
  const ready = await ensureAgentReady()
  if (!ready) return

  const ips = ipsForLimitOwner(user)
  if (!ips.length) return

  macLoading.value = true
  try {
    const macs = new Set<string>()

    const macRe = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i
    const extractMac = (val: any): string => {
      if (!val) return ''
      if (typeof val === 'string') {
        const v = val.trim().toLowerCase()
        return macRe.test(v) ? v : ''
      }
      if (typeof val !== 'object') return ''
      const candidates = [
        (val as any).mac,
        (val as any).MAC,
        (val as any).result,
        (val as any).value,
        (val as any).data?.mac,
        (val as any).data?.value,
      ]
      for (const c of candidates) {
        const m = extractMac(c)
        if (m) return m
      }
      return ''
    }

    // Lazy import to avoid increasing initial bundle work.
    const { agentIpToMacAPI, agentNeighborsAPI } = await import('@/api/agent')

    // Neighbors fallback (single request), used when ip2mac fails or returns unexpected shape.
    let neighbors: any[] | null = null
    const loadNeighbors = async () => {
      if (neighbors !== null) return neighbors
      const n = await agentNeighborsAPI().catch(() => null)
      neighbors = n?.ok && n.items ? (n.items as any[]) : []
      return neighbors
    }

    // Prefer a direct ip->mac lookup (new agent). Fall back to neighbors list.
    for (const ip of ips) {
      const r = await agentIpToMacAPI(ip)
      const mac = extractMac(r)
      if ((r as any)?.ok && mac) {
        macs.add(mac)
        continue
      }

      // Fallback: neighbors table.
      const nitems = await loadNeighbors()
      for (const it of nitems) {
        if ((it?.ip || '').trim() !== ip) continue
        const m = extractMac(it?.mac)
        if (m) macs.add(m)
      }
    }

    const list = Array.from(macs).filter(Boolean)
    macCandidates.value = list
    if (list.length === 1) draftMac.value = list[0]
  } finally {
    macLoading.value = false
  }
}

const refreshMacAndApply = async () => {
  const user = limitsUser.value
  if (!user) return
  const ready = await ensureAgentReady()
  if (!ready) return

  macApplyLoading.value = true
  try {
    await refreshMac()
    const mac = (draftMac.value || '').trim().toLowerCase()
    if (!mac) return

    // Persist learned MAC even if the user doesn't press "Save".
    setUserLimit(user, { mac })

    // Apply blocks/shaping right away (helps when DHCP changes IPs).
    await applyUserEnforcementNow()
    // Best-effort: also re-apply shaping for this user.
    await reapplyAgentShapingForUser(user)
  } finally {
    macApplyLoading.value = false
  }
}

const clearMac = () => {
  draftMac.value = ''
  macCandidates.value = []
}

const saveLimits = async () => {
  const user = limitsUser.value
  if (!user) return

  const trafficLimitBytes = bytesFromTraffic(draftTrafficValue.value, draftTrafficUnit.value)
  const bandwidthLimitBps = bpsFromMbps(draftBandwidthMbps.value)

  const enabled = !!draftEnabled.value
  const disabled = !!draftDisabled.value

  // Default: don't persist an entry unless user really sets something.
  if (!enabled && !disabled && !trafficLimitBytes && !bandwidthLimitBps) {
    clearUserLimit(user)
    limitsDialogOpen.value = false
    return
  }

  setUserLimit(user, {
    enabled,
    disabled,
    mac: draftMac.value ? draftMac.value : undefined,
    trafficPeriod: draftPeriod.value,
    trafficLimitBytes: trafficLimitBytes || undefined,
    trafficLimitUnit: trafficLimitBytes ? draftTrafficUnit.value : undefined,
    bandwidthLimitBps: bandwidthLimitBps || undefined,
  })

  limitsDialogOpen.value = false

  // Apply right away so that manual block/limits feel instant.
  try {
    await ensureAgentReady()
    await applyUserEnforcementNow()
  } catch {
    // ignore
  }
}

const clearLimits = async () => {
  const user = limitsUser.value
  if (!user) return
  clearUserLimit(user)
  limitsDialogOpen.value = false
  try {
    await ensureAgentReady()
    await applyUserEnforcementNow()
  } catch {
    // ignore
  }
}

const resetCounter = async () => {
  const user = limitsUser.value
  if (!user) return
  setResetBaselineNow(user)
  try {
    await ensureAgentReady()
    await applyUserEnforcementNow()
  } catch {
    // ignore
  }
}
</script>
