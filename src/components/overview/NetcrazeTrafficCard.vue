<template>
  <div class="card w-full" :style="trafficColorVars">
    <div class="card-title flex items-center justify-between gap-2 px-4 pt-4">
      <div class="flex min-w-0 flex-col">
        <span>{{ $t('routerTrafficLive') }}</span>
        <span class="text-xs font-normal opacity-60">{{ $t('routerTrafficLiveTip') }}</span>
      </div>
      <div class="rounded-full border border-base-content/10 bg-base-200/60 px-2 py-1 text-[11px] opacity-70">
        {{ maxLabel }}
      </div>
    </div>

    <div class="card-body gap-3 pt-2">
      <div class="relative h-64 w-full overflow-hidden rounded-lg border border-base-content/10 bg-base-200/30">
        <div ref="chartRef" class="h-full w-full" />
        <span
          ref="colorRef"
          class="border-b-success/25 border-t-success/60 border-l-info/25 border-r-info/60 text-base-content/10 bg-base-100/80 hidden [--router-wan-down:#2563eb] [--router-wan-up:#14b8a6] [--router-mihomo-down:#7c3aed] [--router-mihomo-up:#ec4899] [--router-other-down:#f59e0b] [--router-other-up:#22c55e]"
        />
      </div>

      <div class="grid gap-2 px-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
          <div class="mb-1 text-xs opacity-60">{{ $t('routerTrafficTotal') }}</div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.wanDown }" />
            <span class="opacity-80">{{ $t('download') }}:</span>
            <span class="font-mono">{{ currentRouterDownloadLabel }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.wanUp }" />
            <span class="opacity-80">{{ $t('upload') }}:</span>
            <span class="font-mono">{{ currentRouterUploadLabel }}</span>
          </div>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
          <div class="mb-1 text-xs opacity-60">{{ $t('mihomoVersion') }}</div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.mihomoDown }" />
            <span class="opacity-80">{{ $t('download') }}:</span>
            <span class="font-mono">{{ currentMihomoDownloadLabel }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.mihomoUp }" />
            <span class="opacity-80">{{ $t('upload') }}:</span>
            <span class="font-mono">{{ currentMihomoUploadLabel }}</span>
          </div>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
          <div class="mb-1 flex items-center justify-between gap-2 text-xs">
            <span class="opacity-60">{{ $t('routerTrafficVpn') }}</span>
            <span class="badge badge-ghost badge-xs uppercase">VPN</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.vpnDown }" />
            <span class="opacity-80">{{ $t('download') }}:</span>
            <span class="font-mono">{{ currentVpnDownloadLabel }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.vpnUp }" />
            <span class="opacity-80">{{ $t('upload') }}:</span>
            <span class="font-mono">{{ currentVpnUploadLabel }}</span>
          </div>
        </div>

        <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
          <div class="mb-1 flex items-center justify-between gap-2 text-xs">
            <span class="opacity-60">{{ $t('routerTrafficBypass') }}</span>
            <span class="badge badge-ghost badge-xs">Bypass</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.bypassDown }" />
            <span class="opacity-80">{{ $t('download') }}:</span>
            <span class="font-mono">{{ currentBypassDownloadLabel }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: trafficColors.bypassUp }" />
            <span class="opacity-80">{{ $t('upload') }}:</span>
            <span class="font-mono">{{ currentBypassUploadLabel }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span>{{ $t('routerTrafficTunnelDescriptions') }}</span>
              <span class="badge badge-ghost badge-xs">{{ tunnelDescriptionEntries.length }}</span>
            </div>
            <div class="mt-1 text-xs opacity-60">{{ $t('routerTrafficTunnelDescriptionsHint') }}</div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-60">
              <span>{{ tunnelDescriptionStorageHint }}</span>
              <span class="badge badge-outline badge-xs">{{ tunnelDescriptionStorageBadge }}</span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn btn-ghost btn-xs" @click="openTunnelDescriptionsSettings">
              {{ $t('settings') }}
            </button>
            <button type="button" class="btn btn-ghost btn-xs" @click="tunnelDescriptionManagerOpen = !tunnelDescriptionManagerOpen">
              {{ tunnelDescriptionManagerOpen ? $t('collapse') : $t('expand') }}
            </button>
          </div>
        </div>

        <div v-if="tunnelDescriptionManagerOpen" class="mt-3 space-y-2">
          <div v-if="!tunnelDescriptionEntries.length" class="rounded-lg border border-dashed border-base-content/10 bg-base-100/30 px-3 py-2 text-xs opacity-70">
            {{ $t('routerTrafficTunnelDescriptionsEmpty') }}
          </div>

          <div v-if="tunnelDescriptionSuggestions.length" class="flex flex-wrap gap-2">
            <button
              v-for="name in tunnelDescriptionSuggestions"
              :key="`tunnel-desc-suggest-${name}`"
              type="button"
              class="btn btn-ghost btn-xs font-mono"
              @click="prefillTunnelDescriptionName(name)"
            >
              {{ name }}
            </button>
          </div>

          <div
            v-for="entry in tunnelDescriptionEntries"
            :key="`tunnel-desc-${entry.name}`"
            class="grid gap-2 rounded-lg border border-base-content/10 bg-base-100/40 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-medium">{{ ifaceBaseDisplayName(entry.name, entry.kind) }}</div>
              <div class="truncate font-mono text-[11px] opacity-60">{{ entry.name }}</div>
            </div>
            <input
              v-model="tunnelDescriptionDrafts[entry.name]"
              class="input input-sm w-full"
              type="text"
              :placeholder="$t('routerTrafficTunnelDescriptionPlaceholder')"
            />
            <button type="button" class="btn btn-sm" @click="saveTunnelDescription(entry.name)">{{ $t('save') }}</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="clearTunnelDescription(entry.name)">{{ $t('clear') }}</button>
          </div>

          <div class="grid gap-2 rounded-lg border border-dashed border-base-content/10 bg-base-100/30 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
            <input
              v-model="newTunnelInterfaceName"
              class="input input-sm w-full font-mono"
              type="text"
              :placeholder="$t('routerTrafficTunnelInterfacePlaceholder')"
            />
            <input
              v-model="newTunnelInterfaceDescription"
              class="input input-sm w-full"
              type="text"
              :placeholder="$t('routerTrafficTunnelDescriptionPlaceholder')"
            />
            <button type="button" class="btn btn-sm" :disabled="!canAddTunnelDescription" @click="addTunnelDescriptionEntry">
              {{ $t('add') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="currentExtraStats.length" class="grid gap-2 px-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="(item, index) in currentExtraStats"
          :key="`extra-card-${item.name}`"
          class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2"
        >
          <div class="mb-1 flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-xs opacity-80">{{ ifaceBaseDisplayName(item.name, item.kind) }}</div>
              <div v-if="getTunnelDescription(item.name)" class="truncate text-[11px] opacity-60">{{ getTunnelDescription(item.name) }}</div>
            </div>
            <span class="badge badge-ghost badge-xs uppercase">{{ item.kind || 'vpn' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: extraColorPair(index).down }" />
            <span class="opacity-80">{{ $t('download') }}:</span>
            <span class="font-mono">{{ speedLabel(item.down) }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: extraColorPair(index).up }" />
            <span class="opacity-80">{{ $t('upload') }}:</span>
            <span class="font-mono">{{ speedLabel(item.up) }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasTrafficHosts" class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-3">
        <div class="mb-2 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium">{{ $t('routerTrafficTopHosts') }}</div>
            <div class="text-xs opacity-60">{{ $t('routerTrafficTopHostsTip') }}</div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <div class="flex items-center gap-2 text-xs opacity-70">
              <span>{{ $t('filter') }}</span>
              <select v-model="hostScopeFilter" class="select select-xs min-w-[140px] sm:select-sm">
                <option value="all">{{ $t('all') }}</option>
                <option value="mihomo">{{ $t('mihomoVersion') }}</option>
                <option value="vpn">{{ $t('routerTrafficVpn') }}</option>
                <option value="bypass">{{ $t('routerTrafficBypass') }}</option>
                <option value="mixed">{{ $t('routerTrafficHostFilterMixed') }}</option>
                <option value="routed">{{ $t('routerTrafficHostFilterRouted') }}</option>
              </select>
            </div>
            <div class="flex items-center gap-2 text-xs opacity-70">
              <span>{{ $t('sortBy') }}</span>
              <select v-model="hostSortBy" class="select select-xs min-w-[170px] sm:select-sm">
                <option value="traffic">{{ $t('routerTrafficSortTraffic') }}</option>
                <option value="download">{{ $t('downloadSpeed') }}</option>
                <option value="upload">{{ $t('uploadSpeed') }}</option>
                <option value="connections">{{ $t('connections') }}</option>
                <option value="recent">{{ $t('routerTrafficSortRecent') }}</option>
              </select>
            </div>
            <button type="button" class="btn btn-ghost btn-xs sm:btn-sm" @click="expandAllHostGroups">
              {{ $t('routerTrafficExpandAllGroups') }}
            </button>
            <button type="button" class="btn btn-ghost btn-xs sm:btn-sm" @click="collapseAllHostGroups">
              {{ $t('routerTrafficCollapseAllGroups') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs sm:btn-sm"
              :class="{ 'btn-active': autoCollapseQuietHostGroups }"
              @click="toggleAutoCollapseQuietHostGroups"
            >
              {{ $t('routerTrafficAutoCollapseQuietGroups') }}
              <span class="ml-1 badge badge-ghost badge-xs">{{ quietHostGroupsCount }}</span>
            </button>
            <span class="badge badge-ghost badge-sm">{{ visibleTrafficHostsCount }}</span>
            <span class="badge badge-ghost badge-sm">{{ $t('mihomoVersion') }}</span>
            <span class="badge badge-ghost badge-sm">{{ $t('routerTrafficVpn') }}</span>
            <span class="badge badge-ghost badge-sm">{{ $t('routerTrafficBypass') }}</span>
          </div>
        </div>

        <div v-if="stableTrafficHosts.length" class="overflow-hidden rounded-lg border border-base-content/10 bg-base-100/30">
          <div class="grid grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px] items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-wide opacity-60">
            <div>{{ $t('routerTrafficTopHosts') }}</div>
            <div>{{ $t('type') }}</div>
            <div>{{ $t('download') }}</div>
            <div>{{ $t('upload') }}</div>
            <div class="text-right">{{ $t('connections') }}</div>
          </div>

          <template v-for="group in stableTrafficHostGroups" :key="group.key">
            <div class="border-t border-base-content/10 bg-base-200/15 px-3 py-2">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left transition hover:opacity-90"
                  :aria-expanded="!isHostGroupCollapsed(group)"
                  @click="toggleHostGroup(group)"
                >
                  <div class="flex items-start gap-2">
                    <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-base-content/10 bg-base-100/50 text-[11px] opacity-70">
                      {{ isHostGroupCollapsed(group) ? '▶' : '▼' }}
                    </span>
                    <div class="min-w-0">
                      <div class="truncate text-xs font-medium uppercase tracking-wide opacity-75">{{ group.label }}</div>
                      <div v-if="group.note" class="truncate text-[11px] opacity-60">{{ group.note }}</div>
                      <div class="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] opacity-75">
                        <span class="inline-flex items-center gap-1.5">
                          <span class="inline-block h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: hostGroupPrimaryColor(group, 'down') }" />
                          <span>{{ $t('routerTrafficGroupTotal') }} ↓ {{ speedLabel(group.totalDown) }}</span>
                        </span>
                        <span class="inline-flex items-center gap-1.5">
                          <span class="inline-block h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: hostGroupPrimaryColor(group, 'up') }" />
                          <span>{{ $t('routerTrafficGroupTotal') }} ↑ {{ speedLabel(group.totalUp) }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <span
                    class="badge badge-outline badge-xs uppercase"
                    :style="{ borderColor: group.color, color: group.color }"
                  >
                    {{ group.badge }}
                  </span>
                  <span
                    v-for="badge in hostGroupScopeBadges(group)"
                    :key="`${group.key}-${badge.key}`"
                    class="badge badge-outline badge-xs"
                    :style="{ borderColor: badge.color, color: badge.color }"
                  >
                    {{ badge.label }} {{ speedLabel(badge.value) }}
                  </span>
                  <span class="badge badge-ghost badge-xs">{{ group.items.length }} {{ $t('routerTrafficHostsShort') }}</span>
                  <span class="badge badge-ghost badge-xs">{{ group.totalConnections }} {{ $t('connections') }}</span>
                  <button type="button" class="btn btn-ghost btn-xs" @click="toggleHostGroup(group)">
                    {{ isHostGroupCollapsed(group) ? $t('expand') : $t('collapse') }}
                  </button>
                </div>
              </div>
            </div>

            <template v-if="!isHostGroupCollapsed(group)">
              <template v-for="item in group.items" :key="`traffic-host-${group.key}-${item.ip}`">
              <button
                type="button"
                class="grid w-full grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px] items-center gap-3 border-t border-base-content/10 px-3 py-2 text-left text-sm transition hover:bg-base-200/20"
                @click="toggleHostDetails(item.ip)"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate font-medium">{{ item.label }}</span>
                    <span
                      v-if="item.qosProfile"
                      class="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                      :class="qosProfilePillClass(item.qosProfile)"
                      :title="item.qosMeta ? `${qosProfileLabel(item.qosProfile)} · prio ${item.qosMeta.priority ?? '—'} · ↓ ${item.qosMeta.downMinMbit || 0} / ↑ ${item.qosMeta.upMinMbit || 0} Mbit` : qosProfileLabel(item.qosProfile)"
                    >
                      <span aria-hidden="true">{{ qosProfileIcon(item.qosProfile) }}</span>
                      <span class="opacity-80">QoS</span>
                      <span class="inline-flex items-end gap-0.5" aria-hidden="true">
                        <span
                          v-for="bar in qosIndicatorBars(item.qosProfile)"
                          :key="`${item.ip}-qos-${bar.key}`"
                          class="w-1 rounded-full"
                          :class="bar.active ? qosProfileBarClass(item.qosProfile) : 'bg-base-content/10'"
                          :style="{ height: `${bar.height}px` }"
                        />
                      </span>
                      <span class="hidden md:inline">{{ qosProfileShortLabel(item.qosProfile) }}</span>
                    </span>
                    <span v-if="hostSiteBadge(item)" class="badge badge-outline badge-xs" :style="hostSiteBadgeStyle(item)">{{ hostSiteBadge(item) }}</span>
                    <span class="badge badge-ghost badge-xs">{{ isHostDetailsExpanded(item.ip) ? $t('collapse') : $t('details') }}</span>
                  </div>
                  <div class="truncate text-[11px] opacity-60">{{ item.ip }}</div>
                  <div v-if="hostBreakdownLabel(item)" class="truncate text-[11px] opacity-75">{{ hostBreakdownLabel(item) }}</div>
                  <div v-if="item.targets.length" class="truncate text-[11px] opacity-65">{{ item.targets.join(' · ') }}</div>
                </div>
                <div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="badge in hostScopeBadges(item)"
                      :key="`${item.ip}-${badge.key}`"
                      class="badge badge-outline badge-xs sm:badge-sm"
                      :style="{ borderColor: badge.color, color: badge.color }"
                    >
                      {{ badge.label }}
                    </span>
                  </div>
                </div>
                <div class="inline-flex items-center gap-2 font-mono text-xs sm:text-sm">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: hostPrimaryColor(item, 'down') }" />
                  <span>{{ speedLabel(item.down) }}</span>
                </div>
                <div class="inline-flex items-center gap-2 font-mono text-xs sm:text-sm">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: hostPrimaryColor(item, 'up') }" />
                  <span>{{ speedLabel(item.up) }}</span>
                </div>
                <div class="text-right">
                  <span class="badge badge-ghost badge-xs sm:badge-sm">{{ item.connections }}</span>
                </div>
              </button>

              <div v-if="isHostDetailsExpanded(item.ip)" class="border-t border-base-content/10 bg-base-200/10 px-3 py-3">
                <div class="mb-3 text-xs opacity-65">{{ $t('routerTrafficHostDetailsTip') }}</div>
                <div class="grid gap-2 lg:grid-cols-3">
                  <div
                    v-for="card in hostDetailCards(item)"
                    :key="`${item.ip}-detail-${card.key}`"
                    class="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2"
                  >
                    <div class="mb-1 flex items-center justify-between gap-2">
                      <div class="inline-flex items-center gap-2 text-sm font-medium">
                        <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: card.color }" />
                        <span>{{ card.label }}</span>
                      </div>
                      <span v-if="typeof card.connections === 'number'" class="badge badge-ghost badge-xs">{{ card.connections }} {{ $t('connections') }}</span>
                    </div>
                    <div class="flex items-center gap-2 font-mono text-xs sm:text-sm">
                      <span class="opacity-70">{{ $t('download') }}:</span>
                      <span>{{ speedLabel(card.down) }}</span>
                    </div>
                    <div class="mt-1 flex items-center gap-2 font-mono text-xs sm:text-sm">
                      <span class="opacity-70">{{ $t('upload') }}:</span>
                      <span>{{ speedLabel(card.up) }}</span>
                    </div>
                    <div v-if="card.note" class="mt-2 text-[11px] opacity-65">{{ card.note }}</div>
                  </div>
                </div>

                <div class="mt-3 rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3">
                  <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div class="text-sm font-medium">{{ $t('routerTrafficRecentTimeline') }}</div>
                    <span class="badge badge-ghost badge-xs">~{{ hostTimelineWindowSeconds }}s</span>
                  </div>
                  <div class="mb-3 text-xs opacity-60">{{ $t('routerTrafficRecentTimelineTip', { seconds: hostTimelineWindowSeconds }) }}</div>
                  <div v-if="hostTimelineRows(item).length" class="space-y-2">
                    <div
                      v-for="row in hostTimelineRows(item)"
                      :key="`${item.ip}-timeline-${row.key}`"
                      class="rounded-lg border border-base-content/10 bg-base-200/15 px-3 py-2"
                    >
                      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div class="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
                          <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
                          <span class="truncate">{{ row.label }}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-3 font-mono text-[11px] opacity-75">
                          <span>{{ $t('routerTrafficTimelineCurrent') }}: {{ row.current }}</span>
                          <span>{{ $t('routerTrafficTimelinePeak') }}: {{ row.peak }}</span>
                        </div>
                      </div>
                      <div class="flex h-14 items-end gap-1 rounded-lg border border-base-content/10 bg-base-100/40 px-2 py-2">
                        <div
                          v-for="bar in row.bars"
                          :key="`${item.ip}-${row.key}-${bar.key}`"
                          class="min-h-[4px] flex-1 rounded-[4px] transition-[height,opacity] duration-200"
                          :style="{ height: `${bar.height}%`, backgroundColor: row.color, opacity: bar.opacity }"
                          :title="`${row.label}: ${speedLabel(bar.value)}`"
                        />
                      </div>
                    </div>
                  </div>
                  <div v-else class="rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70">
                    {{ $t('routerTrafficTimelineIdle') }}
                  </div>
                </div>

                <div class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                  <div class="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3">
                    <div class="mb-1 text-sm font-medium">{{ $t('routerTrafficActiveTargets') }}</div>
                    <div class="mb-3 text-xs opacity-60">{{ $t('routerTrafficActiveTargetsTip') }}</div>
                    <div v-if="hostTopTargets(item).length" class="space-y-2">
                      <div
                        v-for="target in hostTopTargets(item)"
                        :key="`${item.ip}-target-${target.scope || 'mihomo'}-${target.target}-${target.via || 'direct'}`"
                        class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="truncate text-sm font-medium">{{ target.target }}</div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              <span
                                class="badge badge-outline badge-xs"
                                :style="{ borderColor: hostTargetScopeColor(target), color: hostTargetScopeColor(target) }"
                              >
                                {{ hostTargetScopeLabel(target) }}
                              </span>
                              <span v-if="target.proto" class="badge badge-ghost badge-xs uppercase">{{ target.proto }}</span>
                            </div>
                            <div v-if="target.viaBase || target.via" class="truncate text-[11px] opacity-65">{{ $t('routerTrafficVia') }}: {{ target.viaBase || target.via }}</div>
                            <div v-if="target.viaDescription" class="truncate text-[11px] opacity-65">{{ $t('routerTrafficTunnelDescriptionLabel') }}: {{ target.viaDescription }}</div>
                          </div>
                          <span class="badge badge-ghost badge-xs">{{ target.connections }} {{ $t('connections') }}</span>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs sm:text-sm">
                          <span>{{ $t('download') }}: {{ speedLabel(target.down) }}</span>
                          <span>{{ $t('upload') }}: {{ speedLabel(target.up) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70">
                      {{ $t('routerTrafficNoActiveTargets') }}
                    </div>
                  </div>

                  <div class="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3">
                    <div class="mb-1 text-sm font-medium">{{ $t('details') }}</div>
                    <div class="mb-3 text-xs opacity-60">{{ $t('routerTrafficRouteContext') }}</div>
                    <div class="space-y-2 text-sm">
                      <div v-if="hostTunnelDescription(item)" class="rounded-lg border border-info/20 bg-info/5 px-3 py-2">
                        <div class="text-[11px] opacity-60">{{ $t('routerTrafficTunnelDescriptionLabel') }}</div>
                        <div class="mt-1 text-sm font-medium">{{ hostTunnelDescription(item) }}</div>
                      </div>
                      <div v-for="note in hostDetailNotes(item)" :key="`${item.ip}-${note}`" class="rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2">
                        {{ note }}
                      </div>
                      <div v-if="!hostDetailNotes(item).length" class="rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70">
                        {{ $t('routerTrafficNoExtraContext') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </template>
            </template>
          </template>
        </div>

        <div v-else class="rounded-lg border border-dashed border-base-content/10 bg-base-100/20 px-3 py-4 text-sm opacity-70">
          {{ $t('routerTrafficHostsNoMatches') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { agentHostRemoteTargetsAPI, agentHostTrafficLiveAPI, agentLanHostsAPI, agentQosStatusAPI, agentTrafficLiveAPI, type AgentHostRemoteTargetItem, type AgentHostTrafficLiveItem, type AgentQosProfile, type AgentQosStatusItem, type AgentTrafficLiveIface } from '@/api/agent'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { COMMON_TUNNEL_INTERFACE_SUGGESTIONS, ifaceBaseDisplayName, inferTunnelKindFromName, normalizeTunnelDescription, normalizeTunnelInterfaceName } from '@/helper/tunnelDescriptions'
import { prettyBytesHelper } from '@/helper/utils'
import { ROUTE_NAME } from '@/constant'
import { agentEnabled } from '@/store/agent'
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles } from '@/store/routerHostQos'
import { activeConnections } from '@/store/connections'
import { downloadSpeed, timeSaved, uploadSpeed } from '@/store/overview'
import { font, theme, tunnelInterfaceDescriptionMap } from '@/store/settings'
import { usersDbSyncEnabled } from '@/store/usersDbSync'
import { useElementSize, useStorage } from '@vueuse/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type Point = { name: number; value: number }
type ToolTipParams = {
  axisValue?: number
  seriesName?: string
  color?: string
  value?: number
}
type ExtraHistoryMap = Record<string, { down: Point[]; up: Point[]; kind?: string }>
type ExtraCounterState = Record<string, { rxBytes: number; txBytes: number; ts: number; kind?: string }>

type ExtraColorPair = { down: string; up: string }
type AgentHostTrafficSnapshot = {
  ip: string
  hostname?: string
  mac?: string
  source?: string
  bypassDown: number
  bypassUp: number
  vpnDown: number
  vpnUp: number
}
type HostTargetStat = {
  target: string
  down: number
  up: number
  connections: number
  via?: string
  viaBase?: string
  viaName?: string
  viaDescription?: string
  scope?: 'mihomo' | 'vpn' | 'bypass'
  kind?: string
  proto?: string
}
type HostTrafficStat = {
  label: string
  ip: string
  down: number
  up: number
  mihomoDown: number
  mihomoUp: number
  bypassDown: number
  bypassUp: number
  vpnDown: number
  vpnUp: number
  connections: number
  targets: string[]
  targetStats: HostTargetStat[]
  source?: string
  qosProfile?: AgentQosProfile
  qosMeta?: AgentQosStatusItem
}
type HostTrafficState = HostTrafficStat & {
  displayDown: number
  displayUp: number
  displayMihomoDown: number
  displayMihomoUp: number
  displayBypassDown: number
  displayBypassUp: number
  displayVpnDown: number
  displayVpnUp: number
  lastSeen: number
  score: number
  missingTicks: number
}
type HostHistoryPoint = {
  ts: number
  down: number
  up: number
  mihomoDown: number
  mihomoUp: number
  bypassDown: number
  bypassUp: number
  vpnDown: number
  vpnUp: number
}
type HostTimelineBar = {
  key: string
  value: number
  height: number
  opacity: number
}
type HostTimelineRow = {
  key: string
  label: string
  color: string
  current: string
  peak: string
  bars: HostTimelineBar[]
}
type HostRemoteTargetsState = {
  items: HostTargetStat[]
  fetchedAt: number
}

type HostScopeFilter = 'all' | 'mihomo' | 'vpn' | 'bypass' | 'mixed' | 'routed'
type HostSortMode = 'traffic' | 'download' | 'upload' | 'connections' | 'recent'
type HostSiteMeta = {
  key: string
  label: string
  badge: string
  color: string
  note?: string
  isRouted: boolean
}
type HostTrafficGroup = HostSiteMeta & {
  items: HostTrafficStat[]
  totalDown: number
  totalUp: number
  totalConnections: number
  totalMihomoDown: number
  totalMihomoUp: number
  totalVpnDown: number
  totalVpnUp: number
  totalBypassDown: number
  totalBypassUp: number
}

const { t } = useI18n()
const chartRef = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)

const initValue = () => new Array(timeSaved).fill(0).map((v, i) => ({ name: i, value: v }))
const routerDownloadHistory = ref<Point[]>(initValue())
const routerUploadHistory = ref<Point[]>(initValue())
const mihomoDownloadHistory = ref<Point[]>(initValue())
const mihomoUploadHistory = ref<Point[]>(initValue())
const bypassDownloadHistory = ref<Point[]>(initValue())
const bypassUploadHistory = ref<Point[]>(initValue())
const vpnDownloadHistory = ref<Point[]>(initValue())
const vpnUploadHistory = ref<Point[]>(initValue())
const extraHistories = ref<ExtraHistoryMap>({})
const extraOrder = ref<string[]>([])

const colorSet = {
  baseContent: '',
  baseContent10: '',
  base70: '',
  success25: '',
  success60: '',
  info30: '',
  info60: '',
}
const extraPalette: ExtraColorPair[] = [
  { down: '#06b6d4', up: '#f97316' },
  { down: '#84cc16', up: '#ef4444' },
  { down: '#a855f7', up: '#14b8a6' },
  { down: '#f43f5e', up: '#0ea5e9' },
  { down: '#facc15', up: '#7c3aed' },
  { down: '#22c55e', up: '#e11d48' },
  { down: '#38bdf8', up: '#d97706' },
  { down: '#10b981', up: '#8b5cf6' },
]
const trafficColors = {
  wanDown: '#2563eb',
  wanUp: '#14b8a6',
  mihomoDown: '#7c3aed',
  mihomoUp: '#ec4899',
  bypassDown: '#f59e0b',
  bypassUp: '#22c55e',
  vpnDown: '#0ea5e9',
  vpnUp: '#8b5cf6',
} as const

const trafficColorVars = {
  '--router-wan-down': trafficColors.wanDown,
  '--router-wan-up': trafficColors.wanUp,
  '--router-mihomo-down': trafficColors.mihomoDown,
  '--router-mihomo-up': trafficColors.mihomoUp,
  '--router-other-down': trafficColors.bypassDown,
  '--router-other-up': trafficColors.bypassUp,
  '--router-vpn-down': trafficColors.vpnDown,
  '--router-vpn-up': trafficColors.vpnUp,
} as Record<string, string>

let fontFamily = ''
let pollTimer: number | null = null
let lastRxBytes: number | null = null
let lastTxBytes: number | null = null
let lastSampleTs: number | null = null
const lastExtraCounters = ref<ExtraCounterState>({})
const lanHostNames = ref<Record<string, string>>({})
const agentHostTrafficByIp = ref<Record<string, AgentHostTrafficSnapshot>>({})
const hostRemoteTargetsByIp = ref<Record<string, HostRemoteTargetsState>>({})
const hostRemoteTargetsLoading = ref<Record<string, boolean>>({})
let hostsTimer: number | null = null

const updateColorSet = () => {
  if (!colorRef.value) return
  const colorStyle = getComputedStyle(colorRef.value)
  colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim()
  colorSet.base70 = colorStyle.backgroundColor
  colorSet.baseContent10 = colorStyle.color
  colorSet.success25 = colorStyle.borderBottomColor
  colorSet.success60 = colorStyle.borderTopColor
  colorSet.info30 = colorStyle.borderLeftColor
  colorSet.info60 = colorStyle.borderRightColor
}

const updateFontFamily = () => {
  if (!colorRef.value) return
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const latestValue = (items: Point[]) => {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const v = Number(items[i]?.value || 0)
    if (Number.isFinite(v)) return v
  }
  return 0
}

const pushHistory = (target: { value: Point[] }, timestamp: number, value: number) => {
  target.value.push({ name: timestamp, value: Math.max(0, Number(value) || 0) })
  target.value = target.value.slice(-1 * timeSaved)
}

const speedLabel = (value: number) => `${prettyBytesHelper(value, {
  maximumFractionDigits: value >= 1024 * 1024 ? 2 : 0,
  binary: false,
})}/s`

const currentRouterUploadLabel = computed(() => speedLabel(latestValue(routerUploadHistory.value)))
const currentRouterDownloadLabel = computed(() => speedLabel(latestValue(routerDownloadHistory.value)))
const currentMihomoUploadLabel = computed(() => speedLabel(latestValue(mihomoUploadHistory.value)))
const currentMihomoDownloadLabel = computed(() => speedLabel(latestValue(mihomoDownloadHistory.value)))
const currentBypassUploadLabel = computed(() => speedLabel(latestValue(bypassUploadHistory.value)))
const currentBypassDownloadLabel = computed(() => speedLabel(latestValue(bypassDownloadHistory.value)))
const currentVpnUploadLabel = computed(() => speedLabel(latestValue(vpnUploadHistory.value)))
const currentVpnDownloadLabel = computed(() => speedLabel(latestValue(vpnDownloadHistory.value)))

const router = useRouter()
const tunnelDescriptionMap = tunnelInterfaceDescriptionMap
const tunnelDescriptionStorageBadge = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedBadge') : t('routerTrafficTunnelDescriptionsStorageLocalBadge'))
const tunnelDescriptionStorageHint = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedHint') : t('routerTrafficTunnelDescriptionsStorageHint'))
const tunnelDescriptionManagerOpen = ref(true)
const tunnelDescriptionDrafts = ref<Record<string, string>>({})
const newTunnelInterfaceName = ref('')
const newTunnelInterfaceDescription = ref('')

const getTunnelDescription = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return ''
  return normalizeTunnelDescription((tunnelDescriptionMap.value || {})[key] || '')
}

const ifaceDisplayName = (name: string, kind?: string, includeDescription = false) => {
  const base = ifaceBaseDisplayName(name, kind)
  if (!includeDescription) return base
  const description = getTunnelDescription(name)
  return description ? `${base} · ${description}` : base
}

const ifaceDownLabel = (name: string, kind?: string) => `${ifaceDisplayName(name, kind)} ↓`
const ifaceUpLabel = (name: string, kind?: string) => `${ifaceDisplayName(name, kind)} ↑`
const extraColorPair = (index: number) => extraPalette[index % extraPalette.length]

const ensureExtraHistory = (name: string, kind?: string) => {
  if (!extraHistories.value[name]) {
    extraHistories.value[name] = { down: initValue(), up: initValue(), kind }
  }
  if (!extraOrder.value.includes(name)) {
    extraOrder.value = [...extraOrder.value, name]
  }
  if (kind) extraHistories.value[name].kind = kind
}

const extraInterfaceKeys = computed(() => extraOrder.value.filter((name) => !!extraHistories.value[name]))

const currentExtraStats = computed(() => {
  return extraInterfaceKeys.value
    .map((name) => ({
      name,
      kind: extraHistories.value[name]?.kind || 'vpn',
      down: latestValue(extraHistories.value[name]?.down || []),
      up: latestValue(extraHistories.value[name]?.up || []),
    }))
    .filter((item) => item.down > 0 || item.up > 0 || !!item.kind)
    .sort((a, b) => (b.down + b.up) - (a.down + a.up))
})

const tunnelDescriptionEntries = computed(() => {
  const knownKinds = new Map(currentExtraStats.value.map((item) => [item.name, item.kind || inferTunnelKindFromName(item.name)]))
  const names = new Set<string>([
    ...currentExtraStats.value.map((item) => item.name),
    ...Object.keys(tunnelDescriptionMap.value || {}).map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean),
  ])
  return Array.from(names)
    .map((name) => ({
      name,
      kind: knownKinds.get(name) || inferTunnelKindFromName(name),
      description: getTunnelDescription(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const tunnelDescriptionSuggestions = computed(() => {
  const names = [
    ...currentExtraStats.value.map((item) => item.name),
    ...Object.keys(tunnelDescriptionMap.value || {}),
    ...COMMON_TUNNEL_INTERFACE_SUGGESTIONS,
  ]
  return Array.from(new Set(names.map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
    .filter((name) => !tunnelDescriptionEntries.value.some((entry) => entry.name === name))
    .slice(0, 8)
})
const canAddTunnelDescription = computed(() => normalizeTunnelInterfaceName(newTunnelInterfaceName.value).length > 0)

const prefillTunnelDescriptionName = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  newTunnelInterfaceName.value = key
  if (!tunnelDescriptionManagerOpen.value) tunnelDescriptionManagerOpen.value = true
}

watch(tunnelDescriptionEntries, (entries) => {
  const next: Record<string, string> = { ...tunnelDescriptionDrafts.value }
  for (const entry of entries) {
    if (!(entry.name in next)) next[entry.name] = entry.description
  }
  tunnelDescriptionDrafts.value = next
}, { immediate: true, deep: true })

const saveTunnelDescription = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  const next = { ...(tunnelDescriptionMap.value || {}) }
  const description = normalizeTunnelDescription(tunnelDescriptionDrafts.value[key] || '')
  if (description) next[key] = description
  else delete next[key]
  tunnelDescriptionMap.value = next
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description }
}

const clearTunnelDescription = (name: string) => {
  const key = normalizeTunnelInterfaceName(name)
  if (!key) return
  const next = { ...(tunnelDescriptionMap.value || {}) }
  delete next[key]
  tunnelDescriptionMap.value = next
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: '' }
}

const addTunnelDescriptionEntry = () => {
  const key = normalizeTunnelInterfaceName(newTunnelInterfaceName.value)
  if (!key) return
  const description = normalizeTunnelDescription(newTunnelInterfaceDescription.value)
  tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description }
  const next = { ...(tunnelDescriptionMap.value || {}) }
  if (description) next[key] = description
  else delete next[key]
  tunnelDescriptionMap.value = next
  newTunnelInterfaceName.value = ''
  newTunnelInterfaceDescription.value = ''
}

const openTunnelDescriptionsSettings = () => {
  router.push({ name: ROUTE_NAME.settings })
}

const hostTrafficState = ref<Record<string, HostTrafficState>>({})
const hostQosByIp = ref<Record<string, AgentQosStatusItem>>({})
const storedHostQosProfiles = routerHostQosAppliedProfiles
const hostHistoryState = ref<Record<string, HostHistoryPoint[]>>({})
const hostScopeFilter = ref<HostScopeFilter>('all')
const hostSortBy = ref<HostSortMode>('traffic')
const hostGroupCollapseState = ref<Record<string, 'collapsed' | 'expanded'>>({})
const autoCollapseQuietHostGroups = ref(false)
const expandedHostDetails = ref<Record<string, boolean>>({})
const hostTimelineLimit = 24
const hostTimelineWindowSeconds = Math.round(hostTimelineLimit * 1.5)
const hostRemoteTargetsRefreshMs = 3000
let hostTrafficTimer: number | null = null
let hostTrafficAgentTimer: number | null = null
let hostQosTimer: number | null = null
let hostRemoteTargetsTimer: number | null = null
const hostGroupCollapseStorageKey = 'router-traffic-host-groups-collapsed-v2'
const hostGroupAutoCollapseStorageKey = 'router-traffic-host-groups-autocollapse-v1'
const quietHostGroupThresholdBps = 32 * 1024

const normalizeAgentHostTrafficItem = (item: AgentHostTrafficLiveItem): AgentHostTrafficSnapshot | null => {
  const ip = String(item?.ip || '').trim()
  if (!ip) return null
  return {
    ip,
    hostname: String(item?.hostname || '').trim() || undefined,
    mac: String(item?.mac || '').trim() || undefined,
    source: String(item?.source || '').trim() || undefined,
    bypassDown: Math.max(0, Number(item?.bypassDownBps || 0)),
    bypassUp: Math.max(0, Number(item?.bypassUpBps || 0)),
    vpnDown: Math.max(0, Number(item?.vpnDownBps || 0)),
    vpnUp: Math.max(0, Number(item?.vpnUpBps || 0)),
  }
}

const upsertHostTargetStat = (
  items: HostTargetStat[],
  target: string,
  down: number,
  up: number,
  via?: string,
  meta?: Partial<Pick<HostTargetStat, 'scope' | 'kind' | 'proto'>>,
) => {
  if (!target) return
  const scope = meta?.scope || 'mihomo'
  const kind = meta?.kind
  const proto = meta?.proto
  const existing = items.find((item) => item.target === target && (item.scope || 'mihomo') === scope && (item.via || '') === (via || ''))
  if (existing) {
    existing.down += down
    existing.up += up
    existing.connections += 1
    if (!existing.via && via) existing.via = via
    if (!existing.kind && kind) existing.kind = kind
    if (!existing.proto && proto) existing.proto = proto
    return
  }
  items.push({ target, down, up, connections: 1, via, scope, kind, proto })
}

const normalizeAgentRemoteTargetItem = (item: AgentHostRemoteTargetItem): HostTargetStat | null => {
  const target = String(item?.target || '').trim()
  if (!target) return null
  const scopeRaw = String(item?.scope || '').trim().toLowerCase()
  const scope = scopeRaw === 'vpn' || scopeRaw === 'bypass' ? scopeRaw : 'bypass'
  const kind = String(item?.kind || '').trim() || undefined
  const viaName = String(item?.via || '').trim()
  const viaDescription = viaName ? getTunnelDescription(viaName) : ''
  const viaBase = viaName ? (scope === 'vpn' ? ifaceDisplayName(viaName, kind, false) : viaName) : undefined
  const via = viaName ? (scope === 'vpn' ? ifaceDisplayName(viaName, kind, true) : viaName) : undefined
  const proto = String(item?.proto || '').trim().toUpperCase() || undefined
  return {
    target,
    down: Math.max(0, Number(item?.downBps || 0)),
    up: Math.max(0, Number(item?.upBps || 0)),
    connections: Math.max(0, Number(item?.connections || 0)),
    via,
    viaBase,
    viaName: viaName || undefined,
    viaDescription: viaDescription || undefined,
    scope,
    kind,
    proto,
  }
}

const hostTargetScopeLabel = (target: HostTargetStat) => {
  if (target.scope === 'vpn') return t('routerTrafficVpn')
  if (target.scope === 'bypass') return t('routerTrafficBypass')
  return t('mihomoVersion')
}

const hostTargetScopeColor = (target: HostTargetStat) => {
  if (target.scope === 'vpn') return trafficColors.vpnDown
  if (target.scope === 'bypass') return trafficColors.bypassDown
  return trafficColors.mihomoDown
}

const hostRemoteTargets = (ip: string) => hostRemoteTargetsByIp.value[ip]?.items || []

const parseRouteSource = (source?: string) => {
  const raw = String(source || '').trim()
  if (!raw) return null
  const match = raw.match(/^([a-z0-9_-]+)-route:(.+)$/i)
  if (!match) return null
  const kind = String(match[1] || '').trim().toLowerCase() || 'vpn'
  const payload = String(match[2] || '').trim()
  if (!payload) return null

  const parts = payload.split('|').map((part) => part.trim()).filter(Boolean)
  const via = String(parts.shift() || '').trim()
  if (!via) return null

  const meta: Record<string, string> = {}
  for (const part of parts) {
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const key = part.slice(0, eqIndex).trim().toLowerCase()
    const value = part.slice(eqIndex + 1).trim()
    if (!key || !value) continue
    meta[key] = value
  }

  const ifaceLabel = ifaceDisplayName(via, kind, true)
  const subnet = meta.subnet || undefined
  const peer = meta.peer || undefined
  const peerLabel = peer ? t('routerTrafficPeerLabel', { peer }) : ''
  const siteParts = [ifaceLabel]
  if (peerLabel) siteParts.push(peerLabel)
  if (subnet) siteParts.push(subnet)
  const siteLabel = siteParts.join(' · ')
  const compactSiteLabel = subnet || peerLabel || ifaceLabel
  const siteKey = ['route', kind, via, peer || '-', subnet || '-'].join(':')
  const ifaceDescription = getTunnelDescription(via)

  return {
    kind,
    via,
    ifaceLabel,
    ifaceDescription,
    subnet,
    peer,
    peerLabel,
    siteLabel,
    compactSiteLabel,
    siteKey,
  }
}

const describeHostSource = (source?: string) => {
  const route = parseRouteSource(source)
  if (route) return t('routerTrafficRoutedSource', { iface: route.siteLabel })
  return String(source || '').trim()
}

const hostSiteMeta = (item: Pick<HostTrafficStat, 'source'>): HostSiteMeta => {
  const route = parseRouteSource(item.source)
  if (route) {
    return {
      key: route.siteKey,
      label: t('routerTrafficHostGroupRouted', { site: route.siteLabel }),
      badge: t('routerTrafficHostGroupRoutedBadge'),
      color: trafficColors.vpnDown,
      note: route.subnet
        ? t('routerTrafficDownstreamSiteHintDetailed', { iface: route.ifaceLabel, subnet: route.subnet })
        : t('routerTrafficDownstreamSiteHint', { iface: route.ifaceLabel }),
      isRouted: true,
    }
  }
  return {
    key: 'lan',
    label: t('routerTrafficHostGroupLan'),
    badge: t('routerTrafficHostGroupLanBadge'),
    color: trafficColors.wanDown,
    note: undefined,
    isRouted: false,
  }
}

const hostSiteBadge = (item: Pick<HostTrafficStat, 'source'>) => {
  const route = parseRouteSource(item.source)
  if (!route) return ''
  return `${t('routerTrafficHostGroupRoutedBadge')} · ${route.compactSiteLabel}`
}

const hostSiteBadgeStyle = (item: Pick<HostTrafficStat, 'source'>) => {
  const meta = hostSiteMeta(item)
  return {
    borderColor: meta.color,
    color: meta.color,
  }
}

const qosLevel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return 6
  if (profile === 'high') return 5
  if (profile === 'elevated') return 4
  if (profile === 'low') return 2
  if (profile === 'background') return 1
  return profile === 'normal' ? 3 : 0
}

const qosProfileShortLabel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return 'C6'
  if (profile === 'high') return 'H5'
  if (profile === 'elevated') return 'E4'
  if (profile === 'normal') return 'N3'
  if (profile === 'low') return 'L2'
  if (profile === 'background') return 'B1'
  return ''
}

const qosProfileIcon = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return '⏫'
  if (profile === 'high') return '⬆'
  if (profile === 'elevated') return '↗'
  if (profile === 'low') return '↘'
  if (profile === 'background') return '⬇'
  if (profile === 'normal') return '•'
  return ''
}

const qosProfileLabel = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return t('hostQosCritical')
  if (profile === 'high') return t('hostQosHigh')
  if (profile === 'elevated') return t('hostQosElevated')
  if (profile === 'low') return t('hostQosLow')
  if (profile === 'background') return t('hostQosBackground')
  if (profile === 'normal') return t('hostQosNormal')
  return ''
}

const qosProfilePillClass = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return 'border-error/30 bg-error/10 text-error'
  if (profile === 'high') return 'border-success/30 bg-success/10 text-success'
  if (profile === 'elevated') return 'border-accent/30 bg-accent/10 text-accent'
  if (profile === 'low') return 'border-warning/30 bg-warning/10 text-warning'
  if (profile === 'background') return 'border-base-content/10 bg-base-200/50 text-base-content/70'
  if (profile === 'normal') return 'border-info/30 bg-info/10 text-info'
  return 'border-base-content/10 bg-base-200/40 text-base-content/60'
}

const qosProfileBarClass = (profile?: AgentQosProfile) => {
  if (profile === 'critical') return 'bg-error'
  if (profile === 'high') return 'bg-success'
  if (profile === 'elevated') return 'bg-accent'
  if (profile === 'low') return 'bg-warning'
  if (profile === 'background') return 'bg-base-content/45'
  if (profile === 'normal') return 'bg-info'
  return 'bg-base-content/15'
}

const qosIndicatorBars = (profile?: AgentQosProfile) => {
  const active = qosLevel(profile)
  return [5, 7, 9, 11, 13, 15].map((height, index) => ({
    key: String(index),
    height,
    active: index < active,
  }))
}

const collectHostSnapshot = (): HostTrafficStat[] => {
  const map = new Map<string, HostTrafficStat>()

  for (const conn of activeConnections.value) {
    const ip = String(conn?.metadata?.sourceIP || '').trim()
    if (!ip) continue

    const mihomoDown = Math.max(0, Number(conn?.downloadSpeed || 0))
    const mihomoUp = Math.max(0, Number(conn?.uploadSpeed || 0))
    const target = String(conn?.metadata?.host || conn?.metadata?.sniffHost || conn?.metadata?.destinationIP || '').trim()
    const current = map.get(ip) || {
      ip,
      label: getIPLabelFromMap(ip) || lanHostNames.value[ip] || ip,
      down: 0,
      up: 0,
      mihomoDown: 0,
      mihomoUp: 0,
      bypassDown: 0,
      bypassUp: 0,
      vpnDown: 0,
      vpnUp: 0,
      connections: 0,
      targets: [],
      targetStats: [],
      source: undefined,
      qosProfile: hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip],
      qosMeta: hostQosByIp.value[ip],
    }

    current.label = getIPLabelFromMap(ip) || lanHostNames.value[ip] || current.label || ip
    current.qosProfile = hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip]
    current.qosMeta = hostQosByIp.value[ip]
    current.mihomoDown += mihomoDown
    current.mihomoUp += mihomoUp
    current.down += mihomoDown
    current.up += mihomoUp
    current.connections += 1
    if (target && current.targets.length < 3 && !current.targets.includes(target)) current.targets.push(target)
    const chains = Array.isArray(conn?.chains) ? conn.chains : []
    const via = String(chains?.[chains.length - 1] || chains?.[0] || '').trim() || undefined
    upsertHostTargetStat(current.targetStats, target, mihomoDown, mihomoUp, via, { scope: 'mihomo' })
    current.targetStats = [...current.targetStats]
      .sort((a, b) => ((b.down + b.up) - (a.down + a.up)) || (b.connections - a.connections))
      .slice(0, 6)
    map.set(ip, current)
  }

  for (const [ip, item] of Object.entries(agentHostTrafficByIp.value)) {
    const current = map.get(ip) || {
      ip,
      label: getIPLabelFromMap(ip) || lanHostNames.value[ip] || item.hostname || item.mac || ip,
      down: 0,
      up: 0,
      mihomoDown: 0,
      mihomoUp: 0,
      bypassDown: 0,
      bypassUp: 0,
      vpnDown: 0,
      vpnUp: 0,
      connections: 0,
      targets: [],
      targetStats: [],
      source: item.source,
      qosProfile: hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip],
      qosMeta: hostQosByIp.value[ip],
    }
    current.label = getIPLabelFromMap(ip) || lanHostNames.value[ip] || item.hostname || item.mac || current.label || ip
    current.qosProfile = hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip]
    current.qosMeta = hostQosByIp.value[ip]
    current.source = current.source || item.source
    current.bypassDown += item.bypassDown
    current.bypassUp += item.bypassUp
    current.vpnDown += item.vpnDown
    current.vpnUp += item.vpnUp
    current.down += item.bypassDown + item.vpnDown
    current.up += item.bypassUp + item.vpnUp
    map.set(ip, current)
  }

  return [...map.values()]
}

const refreshHostTraffic = () => {
  const now = Date.now()
  const current = collectHostSnapshot()
  const seen = new Set<string>()
  const next: Record<string, HostTrafficState> = { ...hostTrafficState.value }

  for (const item of current) {
    seen.add(item.ip)
    const prev = next[item.ip]
    const alpha = prev ? 0.38 : 1
    const smooth = (prevValue: number, nextValue: number) => (prev ? ((prevValue * (1 - alpha)) + (nextValue * alpha)) : nextValue)
    const displayMihomoDown = smooth(prev?.displayMihomoDown || 0, item.mihomoDown)
    const displayMihomoUp = smooth(prev?.displayMihomoUp || 0, item.mihomoUp)
    const displayBypassDown = smooth(prev?.displayBypassDown || 0, item.bypassDown)
    const displayBypassUp = smooth(prev?.displayBypassUp || 0, item.bypassUp)
    const displayVpnDown = smooth(prev?.displayVpnDown || 0, item.vpnDown)
    const displayVpnUp = smooth(prev?.displayVpnUp || 0, item.vpnUp)
    const displayDown = displayMihomoDown + displayBypassDown + displayVpnDown
    const displayUp = displayMihomoUp + displayBypassUp + displayVpnUp
    const scoreBase = item.down + item.up + (item.connections * 1024)

    next[item.ip] = {
      ...item,
      displayDown,
      displayUp,
      displayMihomoDown,
      displayMihomoUp,
      displayBypassDown,
      displayBypassUp,
      displayVpnDown,
      displayVpnUp,
      lastSeen: now,
      score: prev ? ((prev.score * 0.7) + (scoreBase * 0.3)) : scoreBase,
      missingTicks: 0,
    }
  }

  for (const [ip, item] of Object.entries(next)) {
    if (seen.has(ip)) continue
    const agedMs = now - Number(item.lastSeen || 0)
    const decay = agedMs > 20000 ? 0.72 : 0.84
    const displayMihomoDown = (item.displayMihomoDown || 0) * decay
    const displayMihomoUp = (item.displayMihomoUp || 0) * decay
    const displayBypassDown = (item.displayBypassDown || 0) * decay
    const displayBypassUp = (item.displayBypassUp || 0) * decay
    const displayVpnDown = (item.displayVpnDown || 0) * decay
    const displayVpnUp = (item.displayVpnUp || 0) * decay
    const displayDown = displayMihomoDown + displayBypassDown + displayVpnDown
    const displayUp = displayMihomoUp + displayBypassUp + displayVpnUp
    const score = (item.score || 0) * decay
    const missingTicks = (item.missingTicks || 0) + 1
    if ((displayDown + displayUp) < 256 && missingTicks > 8) {
      delete next[ip]
      continue
    }
    next[ip] = {
      ...item,
      down: displayDown,
      up: displayUp,
      mihomoDown: displayMihomoDown,
      mihomoUp: displayMihomoUp,
      bypassDown: displayBypassDown,
      bypassUp: displayBypassUp,
      vpnDown: displayVpnDown,
      vpnUp: displayVpnUp,
      displayDown,
      displayUp,
      displayMihomoDown,
      displayMihomoUp,
      displayBypassDown,
      displayBypassUp,
      displayVpnDown,
      displayVpnUp,
      connections: 0,
      score,
      missingTicks,
    }
  }

  hostTrafficState.value = next
  refreshHostHistory(next, now)
}

const refreshHostHistory = (items: Record<string, HostTrafficState>, ts: number) => {
  const next: Record<string, HostHistoryPoint[]> = { ...hostHistoryState.value }

  for (const [ip, item] of Object.entries(items)) {
    const sample: HostHistoryPoint = {
      ts,
      down: Math.max(0, Number(item.displayDown || 0)),
      up: Math.max(0, Number(item.displayUp || 0)),
      mihomoDown: Math.max(0, Number(item.displayMihomoDown || 0)),
      mihomoUp: Math.max(0, Number(item.displayMihomoUp || 0)),
      bypassDown: Math.max(0, Number(item.displayBypassDown || 0)),
      bypassUp: Math.max(0, Number(item.displayBypassUp || 0)),
      vpnDown: Math.max(0, Number(item.displayVpnDown || 0)),
      vpnUp: Math.max(0, Number(item.displayVpnUp || 0)),
    }
    const prev = Array.isArray(next[ip]) ? [...next[ip]] : []
    const last = prev[prev.length - 1]
    if (last && (ts - last.ts) < 1100) prev[prev.length - 1] = sample
    else prev.push(sample)
    next[ip] = prev.slice(-1 * hostTimelineLimit)
  }

  for (const [ip, series] of Object.entries(next)) {
    if (items[ip]) continue
    const last = series[series.length - 1]
    if (!last || (ts - last.ts) > (hostTimelineWindowSeconds * 2500)) delete next[ip]
  }

  hostHistoryState.value = next
}

const scheduleHostTrafficRefresh = () => {
  if (hostTrafficTimer !== null) window.clearTimeout(hostTrafficTimer)
  hostTrafficTimer = window.setTimeout(() => {
    refreshHostTraffic()
    scheduleHostTrafficRefresh()
  }, 1500)
}

const hostScopeTotals = (item: Pick<HostTrafficStat, 'mihomoDown' | 'mihomoUp' | 'vpnDown' | 'vpnUp' | 'bypassDown' | 'bypassUp' | 'connections'>) => ({
  mihomo: Math.max(0, Number(item.mihomoDown || 0)) + Math.max(0, Number(item.mihomoUp || 0)) + (Number(item.connections || 0) > 0 ? 1 : 0),
  vpn: Math.max(0, Number(item.vpnDown || 0)) + Math.max(0, Number(item.vpnUp || 0)),
  bypass: Math.max(0, Number(item.bypassDown || 0)) + Math.max(0, Number(item.bypassUp || 0)),
})

const hostScopeBadges = (item: HostTrafficStat) => {
  const totals = hostScopeTotals(item)
  const badges: Array<{ key: string; label: string; color: string }> = []
  if (totals.mihomo > 1 || item.connections > 0) badges.push({ key: 'mihomo', label: t('mihomoVersion'), color: trafficColors.mihomoDown })
  if (totals.vpn > 1) badges.push({ key: 'vpn', label: t('routerTrafficVpn'), color: trafficColors.vpnDown })
  if (totals.bypass > 1) badges.push({ key: 'bypass', label: t('routerTrafficBypass'), color: trafficColors.bypassDown })
  return badges
}

const hostScopeCount = (item: HostTrafficStat) => hostScopeBadges(item).length

const hostMatchesScopeFilter = (item: HostTrafficState) => {
  if (hostScopeFilter.value === 'all') return true
  if (hostScopeFilter.value === 'mixed') return hostScopeCount(item) > 1
  if (hostScopeFilter.value === 'routed') return hostSiteMeta(item).isRouted
  return hostScopeBadges(item).some((badge) => badge.key === hostScopeFilter.value)
}

const hostPrimaryColor = (item: HostTrafficStat, direction: 'down' | 'up') => {
  const candidates = [
    {
      scope: 'mihomo',
      total: direction === 'down' ? item.mihomoDown : item.mihomoUp,
      color: direction === 'down' ? trafficColors.mihomoDown : trafficColors.mihomoUp,
    },
    {
      scope: 'vpn',
      total: direction === 'down' ? item.vpnDown : item.vpnUp,
      color: direction === 'down' ? trafficColors.vpnDown : trafficColors.vpnUp,
    },
    {
      scope: 'bypass',
      total: direction === 'down' ? item.bypassDown : item.bypassUp,
      color: direction === 'down' ? trafficColors.bypassDown : trafficColors.bypassUp,
    },
  ].sort((a, b) => b.total - a.total)
  return candidates[0]?.total > 0 ? candidates[0].color : (direction === 'down' ? trafficColors.wanDown : trafficColors.wanUp)
}

const hostBreakdownLabel = (item: HostTrafficStat) => {
  const parts: string[] = []
  if ((item.mihomoDown + item.mihomoUp) > 1 || item.connections > 0) parts.push(`${t('mihomoVersion')} ↓${speedLabel(item.mihomoDown)} ↑${speedLabel(item.mihomoUp)}`)
  if ((item.vpnDown + item.vpnUp) > 1) parts.push(`${t('routerTrafficVpn')} ↓${speedLabel(item.vpnDown)} ↑${speedLabel(item.vpnUp)}`)
  if ((item.bypassDown + item.bypassUp) > 1) parts.push(`${t('routerTrafficBypass')} ↓${speedLabel(item.bypassDown)} ↑${speedLabel(item.bypassUp)}`)
  return parts.join(' · ')
}

const hasTrafficHosts = computed(() => Object.values(hostTrafficState.value).some((item) => (item.displayDown + item.displayUp) > 0))

const visibleTrafficHosts = computed(() => {
  return Object.values(hostTrafficState.value)
    .filter((item) => (item.displayDown + item.displayUp) > 0)
    .filter(hostMatchesScopeFilter)
    .sort((a, b) => {
      if (hostSortBy.value === 'download') {
        const diff = (b.displayDown || 0) - (a.displayDown || 0)
        if (Math.abs(diff) > 64) return diff
      } else if (hostSortBy.value === 'upload') {
        const diff = (b.displayUp || 0) - (a.displayUp || 0)
        if (Math.abs(diff) > 64) return diff
      } else if (hostSortBy.value === 'connections') {
        const diff = (b.connections || 0) - (a.connections || 0)
        if (diff !== 0) return diff
      } else if (hostSortBy.value === 'recent') {
        const diff = (b.lastSeen || 0) - (a.lastSeen || 0)
        if (diff !== 0) return diff
      } else {
        const diff = (b.score || 0) - (a.score || 0)
        if (Math.abs(diff) > 128) return diff
      }
      const speedDiff = ((b.displayDown || 0) + (b.displayUp || 0)) - ((a.displayDown || 0) + (a.displayUp || 0))
      if (Math.abs(speedDiff) > 64) return speedDiff
      return (b.lastSeen || 0) - (a.lastSeen || 0)
    })
})

const visibleTrafficHostsCount = computed(() => visibleTrafficHosts.value.length)

const stableTrafficHosts = computed<HostTrafficStat[]>(() => {
  return visibleTrafficHosts.value
    .map((item) => ({
      ip: item.ip,
      label: item.label,
      down: item.displayDown,
      up: item.displayUp,
      mihomoDown: item.displayMihomoDown,
      mihomoUp: item.displayMihomoUp,
      bypassDown: item.displayBypassDown,
      bypassUp: item.displayBypassUp,
      vpnDown: item.displayVpnDown,
      vpnUp: item.displayVpnUp,
      connections: item.connections,
      targets: item.targets,
      targetStats: item.targetStats,
      source: item.source,
      qosProfile: item.qosProfile,
      qosMeta: item.qosMeta,
    }))
})

const stableTrafficHostGroups = computed<HostTrafficGroup[]>(() => {
  const order: string[] = []
  const groups: Record<string, HostTrafficGroup> = {}
  for (const item of stableTrafficHosts.value) {
    const meta = hostSiteMeta(item)
    if (!groups[meta.key]) {
      order.push(meta.key)
      groups[meta.key] = {
        ...meta,
        items: [],
        totalDown: 0,
        totalUp: 0,
        totalConnections: 0,
        totalMihomoDown: 0,
        totalMihomoUp: 0,
        totalVpnDown: 0,
        totalVpnUp: 0,
        totalBypassDown: 0,
        totalBypassUp: 0,
      }
    }
    const group = groups[meta.key]
    group.items.push(item)
    group.totalDown += item.down
    group.totalUp += item.up
    group.totalConnections += item.connections
    group.totalMihomoDown += item.mihomoDown
    group.totalMihomoUp += item.mihomoUp
    group.totalVpnDown += item.vpnDown
    group.totalVpnUp += item.vpnUp
    group.totalBypassDown += item.bypassDown
    group.totalBypassUp += item.bypassUp
  }
  return order.map((key) => groups[key]).sort((a, b) => {
    if (a.isRouted !== b.isRouted) return a.isRouted ? -1 : 1
    const aTotal = a.totalDown + a.totalUp
    const bTotal = b.totalDown + b.totalUp
    if (Math.abs(bTotal - aTotal) > 64) return bTotal - aTotal
    return a.label.localeCompare(b.label)
  })
})

const hostGroupPrimaryColor = (group: HostTrafficGroup, direction: 'down' | 'up') => {
  const downTotals = [
    { color: trafficColors.mihomoDown, value: group.totalMihomoDown },
    { color: trafficColors.vpnDown, value: group.totalVpnDown },
    { color: trafficColors.bypassDown, value: group.totalBypassDown },
  ]
  const upTotals = [
    { color: trafficColors.mihomoUp, value: group.totalMihomoUp },
    { color: trafficColors.vpnUp, value: group.totalVpnUp },
    { color: trafficColors.bypassUp, value: group.totalBypassUp },
  ]
  const primary = (direction === 'down' ? downTotals : upTotals).sort((a, b) => b.value - a.value)[0]
  return primary?.value > 0 ? primary.color : (direction === 'down' ? group.color : trafficColors.wanUp)
}

const hostGroupScopeBadges = (group: HostTrafficGroup) => {
  const badges: Array<{ key: string; label: string; color: string; value: number }> = []
  const mihomoValue = group.totalMihomoDown + group.totalMihomoUp
  if (mihomoValue > 1) badges.push({ key: 'mihomo', label: t('mihomoVersion'), color: trafficColors.mihomoDown, value: mihomoValue })
  const vpnValue = group.totalVpnDown + group.totalVpnUp
  if (vpnValue > 1) badges.push({ key: 'vpn', label: t('routerTrafficVpn'), color: trafficColors.vpnDown, value: vpnValue })
  const bypassValue = group.totalBypassDown + group.totalBypassUp
  if (bypassValue > 1) badges.push({ key: 'bypass', label: t('routerTrafficBypass'), color: trafficColors.bypassDown, value: bypassValue })
  return badges.sort((a, b) => b.value - a.value)
}

const isHostGroupQuiet = (group: HostTrafficGroup) => (group.totalDown + group.totalUp) < quietHostGroupThresholdBps

const isHostGroupCollapsed = (groupOrKey: HostTrafficGroup | string) => {
  const key = typeof groupOrKey === 'string' ? groupOrKey : groupOrKey.key
  const manual = hostGroupCollapseState.value[key]
  if (manual === 'collapsed') return true
  if (manual === 'expanded') return false
  if (typeof groupOrKey === 'string') return false
  return autoCollapseQuietHostGroups.value && isHostGroupQuiet(groupOrKey)
}

const setHostGroupManualState = (key: string, state?: 'collapsed' | 'expanded') => {
  const next = { ...hostGroupCollapseState.value }
  if (state) next[key] = state
  else delete next[key]
  hostGroupCollapseState.value = next
}

const toggleHostGroup = (group: HostTrafficGroup | string) => {
  const target = typeof group === 'string' ? stableTrafficHostGroups.value.find((item) => item.key === group) || group : group
  const key = typeof target === 'string' ? target : target.key
  const collapsed = isHostGroupCollapsed(target)
  if (collapsed) {
    if (typeof target === 'string') setHostGroupManualState(key)
    else if (autoCollapseQuietHostGroups.value && isHostGroupQuiet(target)) setHostGroupManualState(key, 'expanded')
    else setHostGroupManualState(key)
    return
  }
  setHostGroupManualState(key, 'collapsed')
}

const collapseAllHostGroups = () => {
  const next: Record<string, 'collapsed' | 'expanded'> = { ...hostGroupCollapseState.value }
  for (const group of stableTrafficHostGroups.value) {
    next[group.key] = 'collapsed'
  }
  hostGroupCollapseState.value = next
}

const expandAllHostGroups = () => {
  const next = { ...hostGroupCollapseState.value }
  for (const group of stableTrafficHostGroups.value) {
    if (autoCollapseQuietHostGroups.value && isHostGroupQuiet(group)) next[group.key] = 'expanded'
    else delete next[group.key]
  }
  hostGroupCollapseState.value = next
}

const toggleAutoCollapseQuietHostGroups = () => {
  autoCollapseQuietHostGroups.value = !autoCollapseQuietHostGroups.value
}

const quietHostGroupsCount = computed(() => stableTrafficHostGroups.value.filter((group) => isHostGroupQuiet(group)).length)

const isHostDetailsExpanded = (ip: string) => !!expandedHostDetails.value[ip]

const toggleHostDetails = (ip: string) => {
  const willExpand = !expandedHostDetails.value[ip]
  expandedHostDetails.value = {
    ...expandedHostDetails.value,
    [ip]: willExpand,
  }
  if (willExpand) void refreshHostRemoteTargets(ip, true)
}

const hostDetailCards = (item: HostTrafficStat) => {
  const cards: Array<{ key: string; label: string; down: number; up: number; color: string; note?: string; connections?: number }> = []
  if ((item.mihomoDown + item.mihomoUp) > 1 || item.connections > 0) {
    cards.push({
      key: 'mihomo',
      label: t('mihomoVersion'),
      down: item.mihomoDown,
      up: item.mihomoUp,
      color: trafficColors.mihomoDown,
      connections: item.connections,
    })
  }
  if ((item.vpnDown + item.vpnUp) > 1) {
    cards.push({
      key: 'vpn',
      label: t('routerTrafficVpn'),
      down: item.vpnDown,
      up: item.vpnUp,
      color: trafficColors.vpnDown,
      note: t('routerTrafficRouterSideAccounting'),
    })
  }
  if ((item.bypassDown + item.bypassUp) > 1) {
    cards.push({
      key: 'bypass',
      label: t('routerTrafficBypass'),
      down: item.bypassDown,
      up: item.bypassUp,
      color: trafficColors.bypassDown,
      note: t('routerTrafficDirectWan'),
    })
  }
  return cards
}

const hostTopTargets = (item: HostTrafficStat) => {
  const merged = [...(item.targetStats || []), ...hostRemoteTargets(item.ip)]
  return merged
    .filter((target) => (target.down + target.up) > 1 || target.connections > 0)
    .sort((a, b) => ((b.down + b.up) - (a.down + a.up)) || (b.connections - a.connections))
    .slice(0, 8)
}

const hostTunnelDescription = (item: HostTrafficStat) => {
  const route = parseRouteSource(item.source)
  return route?.ifaceDescription || ''
}

const hostDetailNotes = (item: HostTrafficStat) => {
  const notes: string[] = []
  const route = parseRouteSource(item.source)
  const site = hostSiteMeta(item)
  if (item.source) notes.push(`${t('routerTrafficLabelSource')}: ${describeHostSource(item.source)}`)
  if (site.isRouted) notes.push(`${t('routerTrafficHostSiteLabel')}: ${site.label}`)
  if (route) {
    notes.push(t('routerTrafficRoutedHostHint', { iface: route.ifaceLabel }))
    if (route.subnet) notes.push(t('routerTrafficHostSubnetLabel', { subnet: route.subnet }))
    if (route.peer) notes.push(t('routerTrafficHostPeerLabel', { peer: route.peer }))
  }
  if ((item.vpnDown + item.vpnUp + item.bypassDown + item.bypassUp) > 1) notes.push(t('routerTrafficRemoteTargetsWarmupHint'))
  return notes
}

const hostTimelineBars = (values: number[]): HostTimelineBar[] => {
  const clean = values.map((value) => Math.max(0, Number(value || 0))).slice(-1 * hostTimelineLimit)
  const maxValue = Math.max(1, ...clean)
  return clean.map((value, index) => {
    const ratio = value > 0 ? (value / maxValue) : 0
    return {
      key: String(index),
      value,
      height: value > 0 ? Math.max(12, Math.round(ratio * 100)) : 6,
      opacity: value > 0 ? Math.min(1, 0.35 + (ratio * 0.65)) : 0.16,
    }
  })
}

const buildHostTimelineRows = (item: HostTrafficStat): HostTimelineRow[] => {
  const history = hostHistoryState.value[item.ip] || []
  if (!history.length) return []

  const rows: HostTimelineRow[] = []
  const pushRow = (key: string, label: string, color: string, values: number[]) => {
    const hasActivity = values.some((value) => value > 1)
    if (!hasActivity && key !== 'total') return
    rows.push({
      key,
      label,
      color,
      current: speedLabel(values[values.length - 1] || 0),
      peak: speedLabel(Math.max(0, ...values)),
      bars: hostTimelineBars(values),
    })
  }

  pushRow('total', t('routerTrafficTimelineTotal'), hostPrimaryColor(item, 'down'), history.map((entry) => entry.down + entry.up))
  pushRow('mihomo', t('mihomoVersion'), trafficColors.mihomoDown, history.map((entry) => entry.mihomoDown + entry.mihomoUp))
  pushRow('vpn', t('routerTrafficVpn'), trafficColors.vpnDown, history.map((entry) => entry.vpnDown + entry.vpnUp))
  pushRow('bypass', t('routerTrafficBypass'), trafficColors.bypassDown, history.map((entry) => entry.bypassDown + entry.bypassUp))
  return rows
}

const stableTrafficHostTimelineRows = computed<Record<string, HostTimelineRow[]>>(() => {
  const out: Record<string, HostTimelineRow[]> = {}
  for (const item of stableTrafficHosts.value) out[item.ip] = buildHostTimelineRows(item)
  return out
})

const hostTimelineRows = (item: HostTrafficStat) => stableTrafficHostTimelineRows.value[item.ip] || []

watch(stableTrafficHosts, (items) => {
  const visible = new Set(items.map((item) => item.ip))
  const next: Record<string, boolean> = {}
  for (const [ip, expanded] of Object.entries(expandedHostDetails.value)) {
    if (expanded && visible.has(ip)) next[ip] = true
  }
  expandedHostDetails.value = next
}, { deep: true })

const refreshHostRemoteTargets = async (ip: string, force = false) => {
  if (!agentEnabled.value) return
  const key = String(ip || '').trim()
  if (!key) return
  if (hostRemoteTargetsLoading.value[key]) return
  const cachedAt = Number(hostRemoteTargetsByIp.value[key]?.fetchedAt || 0)
  if (!force && cachedAt > 0 && (Date.now() - cachedAt) < Math.max(1200, hostRemoteTargetsRefreshMs - 500)) return

  hostRemoteTargetsLoading.value = { ...hostRemoteTargetsLoading.value, [key]: true }
  try {
    const res = await agentHostRemoteTargetsAPI(key)
    const items = Array.isArray(res?.items)
      ? res.items.map(normalizeAgentRemoteTargetItem).filter((item): item is HostTargetStat => !!item)
      : []
    hostRemoteTargetsByIp.value = {
      ...hostRemoteTargetsByIp.value,
      [key]: { items, fetchedAt: Date.now() },
    }
  } finally {
    const next = { ...hostRemoteTargetsLoading.value }
    delete next[key]
    hostRemoteTargetsLoading.value = next
  }
}

const refreshExpandedHostRemoteTargets = async (force = false) => {
  const ips = Object.entries(expandedHostDetails.value)
    .filter(([, expanded]) => !!expanded)
    .map(([ip]) => ip)
  for (const ip of ips) await refreshHostRemoteTargets(ip, force)
}

const scheduleHostRemoteTargetsRefresh = () => {
  if (hostRemoteTargetsTimer !== null) window.clearTimeout(hostRemoteTargetsTimer)
  hostRemoteTargetsTimer = window.setTimeout(async () => {
    await refreshExpandedHostRemoteTargets()
    scheduleHostRemoteTargetsRefresh()
  }, hostRemoteTargetsRefreshMs)
}

const refreshLanHosts = async () => {
  if (!agentEnabled.value) return
  const res = await agentLanHostsAPI()
  if (!res?.ok || !Array.isArray(res.items)) return
  const next: Record<string, string> = {}
  for (const item of res.items) {
    const ip = String(item?.ip || '').trim()
    if (!ip) continue
    const label = String(item?.hostname || item?.mac || '').trim()
    if (label) next[ip] = label
  }
  lanHostNames.value = next
  refreshHostTraffic()
}

const refreshHostQos = async () => {
  if (!agentEnabled.value) {
    hostQosByIp.value = {}
    refreshHostTraffic()
    return
  }
  const res = await agentQosStatusAPI()
  if (!res?.ok || !Array.isArray(res.items)) {
    hostQosByIp.value = {}
    refreshHostTraffic()
    return
  }
  const next: Record<string, AgentQosStatusItem> = {}
  for (const item of res.items) {
    const ip = String(item?.ip || '').trim()
    if (!ip || !item?.profile) continue
    next[ip] = item
  }
  hostQosByIp.value = next
  mergeRouterHostQosAppliedProfiles(Object.fromEntries(Object.entries(next).map(([ip, item]) => [ip, item.profile])))
  refreshHostTraffic()
}

const scheduleHostQosRefresh = () => {
  if (hostQosTimer !== null) window.clearTimeout(hostQosTimer)
  hostQosTimer = window.setTimeout(async () => {
    await refreshHostQos()
    scheduleHostQosRefresh()
  }, 10000)
}

const refreshAgentHostTraffic = async () => {
  if (!agentEnabled.value) {
    agentHostTrafficByIp.value = {}
    refreshHostTraffic()
    return
  }
  const res = await agentHostTrafficLiveAPI()
  if (!res?.ok || !Array.isArray(res.items)) {
    agentHostTrafficByIp.value = {}
    refreshHostTraffic()
    return
  }
  const next: Record<string, AgentHostTrafficSnapshot> = {}
  for (const item of res.items) {
    const normalized = normalizeAgentHostTrafficItem(item)
    if (!normalized) continue
    next[normalized.ip] = normalized
  }
  agentHostTrafficByIp.value = next
  refreshHostTraffic()
}

const scheduleHostRefresh = () => {
  if (hostsTimer !== null) window.clearTimeout(hostsTimer)
  hostsTimer = window.setTimeout(async () => {
    await refreshLanHosts()
    scheduleHostRefresh()
  }, 60000)
}

const scheduleAgentHostTrafficRefresh = () => {
  if (hostTrafficAgentTimer !== null) window.clearTimeout(hostTrafficAgentTimer)
  hostTrafficAgentTimer = window.setTimeout(async () => {
    await refreshAgentHostTraffic()
    scheduleAgentHostTrafficRefresh()
  }, 3000)
}

const extraSeriesValues = computed(() => {
  return extraInterfaceKeys.value.flatMap((name) => {
    const hist = extraHistories.value[name]
    if (!hist) return [] as number[]
    return [...hist.down, ...hist.up].map((item) => Number(item?.value || 0))
  })
})

const allSeriesValues = computed(() => [
  ...routerDownloadHistory.value,
  ...routerUploadHistory.value,
  ...mihomoDownloadHistory.value,
  ...mihomoUploadHistory.value,
  ...bypassDownloadHistory.value,
  ...bypassUploadHistory.value,
  ...vpnDownloadHistory.value,
  ...vpnUploadHistory.value,
].map((item) => Number(item?.value || 0)).concat(extraSeriesValues.value))

const maxObserved = computed(() => Math.max(0, ...allSeriesValues.value))

const roundedPeak = computed(() => {
  const observed = Math.max(0, Number(maxObserved.value || 0))
  const floor = observed >= 512 * 1024
    ? 256 * 1024
    : observed >= 128 * 1024
      ? 128 * 1024
      : 64 * 1024
  const raw = Math.max(observed * 1.2, floor)
  const step = raw < 256 * 1024
    ? 16 * 1024
    : raw < 1024 * 1024
      ? 64 * 1024
      : raw < 5 * 1024 * 1024
        ? 256 * 1024
        : 1024 * 1024
  return Math.ceil(raw / step) * step
})

const maxLabel = computed(() => `${t('peakScale')}: ${speedLabel(roundedPeak.value)}`)

const formatTime = (value: number) => {
  if (!value) return '—'
  const dt = new Date(Number(value))
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  const ss = String(dt.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

const routerDownLabel = computed(() => t('routerTrafficLegendRouterDown'))
const routerUpLabel = computed(() => t('routerTrafficLegendRouterUp'))
const mihomoDownLabel = computed(() => t('routerTrafficLegendMihomoDown'))
const mihomoUpLabel = computed(() => t('routerTrafficLegendMihomoUp'))
const bypassDownLabel = computed(() => t('routerTrafficLegendBypassDown'))
const bypassUpLabel = computed(() => t('routerTrafficLegendBypassUp'))
const vpnDownLabel = computed(() => t('routerTrafficLegendVpnDown'))
const vpnUpLabel = computed(() => t('routerTrafficLegendVpnUp'))

const dynamicLegendItems = computed(() => extraInterfaceKeys.value.flatMap((name) => {
  const kind = extraHistories.value[name]?.kind
  return [ifaceDownLabel(name, kind), ifaceUpLabel(name, kind)]
}))

const dynamicExtraSeries = computed(() => extraInterfaceKeys.value.flatMap((name, index) => {
  const hist = extraHistories.value[name]
  if (!hist) return []
  const colors = extraColorPair(index)
  return [
    {
      name: ifaceDownLabel(name, hist.kind),
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: hist.down.map((item) => item.value),
      color: colors.down,
      lineStyle: { width: 1.8 },
      emphasis: { focus: 'series' },
    },
    {
      name: ifaceUpLabel(name, hist.kind),
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: hist.up.map((item) => item.value),
      color: colors.up,
      lineStyle: { width: 1.8, type: 'dotted' },
      emphasis: { focus: 'series' },
    },
  ]
}))

const options = computed(() => ({
  grid: {
    left: 12,
    top: 52,
    right: 12,
    bottom: 26,
    containLabel: true,
  },
  legend: {
    type: 'scroll',
    top: 8,
    left: 12,
    right: 12,
    itemWidth: 12,
    itemHeight: 8,
    pageIconColor: colorSet.baseContent,
    pageTextStyle: {
      color: colorSet.baseContent,
      fontFamily,
      fontSize: 10,
    },
    textStyle: {
      color: colorSet.baseContent,
      fontFamily,
      fontSize: 11,
    },
    data: [
      routerDownLabel.value,
      routerUpLabel.value,
      mihomoDownLabel.value,
      mihomoUpLabel.value,
      bypassDownLabel.value,
      bypassUpLabel.value,
      vpnDownLabel.value,
      vpnUpLabel.value,
      ...dynamicLegendItems.value,
    ],
  },
  tooltip: {
    trigger: 'axis',
    confine: true,
    backgroundColor: colorSet.base70,
    borderColor: colorSet.base70,
    textStyle: {
      color: colorSet.baseContent,
      fontFamily,
    },
    formatter: (params: ToolTipParams[]) => {
      const time = formatTime(Number(params?.[0]?.axisValue || 0))
      const lines = [
        `<div style="padding:6px 8px">`,
        `<div style="font-size:12px;opacity:.75;margin-bottom:4px">${time}</div>`,
      ]
      for (const item of params || []) {
        lines.push(
          `<div style="display:flex;align-items:center;gap:8px;margin:2px 0">` +
            `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${item.color}"></span>` +
            `<span>${item.seriesName}: ${speedLabel(Number(item.value || 0))}</span>` +
          `</div>`,
        )
      }
      lines.push(`</div>`)
      return lines.join('')
    },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: routerDownloadHistory.value.map((item) => item.name),
    axisLine: {
      lineStyle: { color: colorSet.baseContent10 },
    },
    axisTick: { show: false },
    axisLabel: {
      color: colorSet.baseContent,
      fontFamily,
      formatter: (value: number, index: number) => {
        const last = routerDownloadHistory.value.length - 1
        return index === 0 || index === last ? formatTime(Number(value)) : ''
      },
    },
    splitLine: { show: false },
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: roundedPeak.value,
    splitNumber: 4,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: colorSet.baseContent,
      fontFamily,
      formatter: (value: number) => (Number(value) === roundedPeak.value ? speedLabel(value) : ''),
    },
    splitLine: {
      show: true,
      lineStyle: {
        type: 'dashed',
        color: colorSet.baseContent10,
      },
    },
  },
  series: [
    {
      name: routerDownLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: routerDownloadHistory.value.map((item) => item.value),
      color: '#2563eb',
      lineStyle: { width: 2.4 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(37,99,235,0.30)' },
          { offset: 1, color: 'rgba(37,99,235,0.05)' },
        ]),
      },
      emphasis: { focus: 'series' },
    },
    {
      name: routerUpLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: routerUploadHistory.value.map((item) => item.value),
      color: '#0d9488',
      lineStyle: { width: 2.4 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(13,148,136,0.28)' },
          { offset: 1, color: 'rgba(13,148,136,0.05)' },
        ]),
      },
      emphasis: { focus: 'series' },
    },
    {
      name: mihomoDownLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: mihomoDownloadHistory.value.map((item) => item.value),
      color: '#7c3aed',
      lineStyle: { width: 1.8, type: 'dashed' },
      emphasis: { focus: 'series' },
    },
    {
      name: mihomoUpLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: mihomoUploadHistory.value.map((item) => item.value),
      color: '#ec4899',
      lineStyle: { width: 1.8, type: 'dashed' },
      emphasis: { focus: 'series' },
    },
    {
      name: bypassDownLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: bypassDownloadHistory.value.map((item) => item.value),
      color: '#f59e0b',
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
    },
    {
      name: bypassUpLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: bypassUploadHistory.value.map((item) => item.value),
      color: '#22c55e',
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
    },
    {
      name: vpnDownLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: vpnDownloadHistory.value.map((item) => item.value),
      color: '#0ea5e9',
      lineStyle: { width: 1.8, type: 'dashdot' },
      emphasis: { focus: 'series' },
    },
    {
      name: vpnUpLabel.value,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: vpnUploadHistory.value.map((item) => item.value),
      color: '#8b5cf6',
      lineStyle: { width: 1.8, type: 'dashdot' },
      emphasis: { focus: 'series' },
    },
    ...dynamicExtraSeries.value,
  ],
}))

const stopPolling = () => {
  if (pollTimer !== null) {
    window.clearTimeout(pollTimer)
    pollTimer = null
  }
}

const scheduleNextPoll = () => {
  stopPolling()
  pollTimer = window.setTimeout(pollTraffic, 2000)
}

const computeExtraSpeeds = (items: AgentTrafficLiveIface[], ts: number) => {
  const speeds: Record<string, { down: number; up: number; kind?: string }> = {}
  const nextState: ExtraCounterState = { ...lastExtraCounters.value }

  for (const item of items) {
    const name = String(item?.name || '').trim()
    if (!name) continue
    const kind = item?.kind || 'vpn'
    const rxBytes = Number(item?.rxBytes || 0)
    const txBytes = Number(item?.txBytes || 0)
    const prev = lastExtraCounters.value[name]
    let down = 0
    let up = 0
    if (prev && ts > prev.ts) {
      const dtSec = Math.max((ts - prev.ts) / 1000, 1)
      down = Math.max(rxBytes - prev.rxBytes, 0) / dtSec
      up = Math.max(txBytes - prev.txBytes, 0) / dtSec
    }
    speeds[name] = { down, up, kind }
    nextState[name] = { rxBytes, txBytes, ts, kind }
    ensureExtraHistory(name, kind)
  }

  lastExtraCounters.value = nextState
  return speeds
}

const pollTraffic = async () => {
  const timestamp = Date.now()
  const mihomoDown = Math.max(0, Number(downloadSpeed.value || 0))
  const mihomoUp = Math.max(0, Number(uploadSpeed.value || 0))

  let routerDown = 0
  let routerUp = 0
  let extraSpeeds: Record<string, { down: number; up: number; kind?: string }> = {}

  if (agentEnabled.value) {
    const live = await agentTrafficLiveAPI()
    const rxBytes = Number(live?.rxBytes || 0)
    const txBytes = Number(live?.txBytes || 0)
    const ts = Number(live?.ts || timestamp)

    if (live.ok && Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
      if (lastRxBytes !== null && lastTxBytes !== null && lastSampleTs !== null && ts > lastSampleTs) {
        const dtSec = Math.max((ts - lastSampleTs) / 1000, 1)
        const rxDelta = Math.max(rxBytes - lastRxBytes, 0)
        const txDelta = Math.max(txBytes - lastTxBytes, 0)
        routerDown = rxDelta / dtSec
        routerUp = txDelta / dtSec
      }
      lastRxBytes = rxBytes
      lastTxBytes = txBytes
      lastSampleTs = ts
      if (Array.isArray(live.extraIfaces) && live.extraIfaces.length) {
        extraSpeeds = computeExtraSpeeds(live.extraIfaces, ts)
      }
    }
  }

  const otherDown = Math.max(routerDown - mihomoDown, 0)
  const otherUp = Math.max(routerUp - mihomoUp, 0)
  const vpnDownRaw = Object.values(extraSpeeds).reduce((sum, item) => sum + Math.max(0, Number(item?.down || 0)), 0)
  const vpnUpRaw = Object.values(extraSpeeds).reduce((sum, item) => sum + Math.max(0, Number(item?.up || 0)), 0)
  const vpnDown = Math.min(otherDown, vpnDownRaw)
  const vpnUp = Math.min(otherUp, vpnUpRaw)
  const bypassDown = Math.max(otherDown - vpnDown, 0)
  const bypassUp = Math.max(otherUp - vpnUp, 0)

  pushHistory(routerDownloadHistory, timestamp, routerDown)
  pushHistory(routerUploadHistory, timestamp, routerUp)
  pushHistory(mihomoDownloadHistory, timestamp, mihomoDown)
  pushHistory(mihomoUploadHistory, timestamp, mihomoUp)
  pushHistory(vpnDownloadHistory, timestamp, vpnDown)
  pushHistory(vpnUploadHistory, timestamp, vpnUp)
  pushHistory(bypassDownloadHistory, timestamp, bypassDown)
  pushHistory(bypassUploadHistory, timestamp, bypassUp)

  for (const name of extraInterfaceKeys.value) {
    const hist = extraHistories.value[name]
    if (!hist) continue
    const current = extraSpeeds[name]
    pushHistory({ value: hist.down }, timestamp, current?.down || 0)
    hist.down = hist.down.slice(-1 * timeSaved)
    pushHistory({ value: hist.up }, timestamp, current?.up || 0)
    hist.up = hist.up.slice(-1 * timeSaved)
    if (current?.kind) hist.kind = current.kind
  }

  scheduleNextPoll()
}

onMounted(() => {
  updateColorSet()
  updateFontFamily()
  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  try {
    const raw = window.localStorage.getItem(hostGroupCollapseStorageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed).filter(([key, value]) => !!key && (value === 'collapsed' || value === 'expanded'))
        hostGroupCollapseState.value = Object.fromEntries(entries) as Record<string, 'collapsed' | 'expanded'>
      }
    }
  } catch {
    // ignore localStorage parse issues
  }

  try {
    autoCollapseQuietHostGroups.value = window.localStorage.getItem(hostGroupAutoCollapseStorageKey) === '1'
  } catch {
    // ignore localStorage read issues
  }

  watch(hostGroupCollapseState, (value) => {
    try {
      window.localStorage.setItem(hostGroupCollapseStorageKey, JSON.stringify(value))
    } catch {
      // ignore localStorage write issues
    }
  }, { deep: true })

  watch(autoCollapseQuietHostGroups, (value) => {
    try {
      window.localStorage.setItem(hostGroupAutoCollapseStorageKey, value ? '1' : '0')
    } catch {
      // ignore localStorage write issues
    }
  })

  const chart = echarts.init(chartRef.value!)
  chart.setOption(options.value)

  watch(options, () => {
    chart.setOption(options.value)
  })

  const { width } = useElementSize(chartRef)
  const resize = debounce(() => chart.resize(), 100)
  watch(width, resize)

  refreshLanHosts()
  scheduleHostRefresh()
  pollTraffic()
  refreshAgentHostTraffic()
  scheduleAgentHostTrafficRefresh()
  refreshHostQos()
  scheduleHostQosRefresh()
  refreshHostTraffic()
  scheduleHostTrafficRefresh()
  scheduleHostRemoteTargetsRefresh()

  watch(activeConnections, refreshHostTraffic, { deep: true })
})

onBeforeUnmount(() => {
  stopPolling()
  if (hostsTimer !== null) {
    window.clearTimeout(hostsTimer)
    hostsTimer = null
  }
  if (hostTrafficTimer !== null) {
    window.clearTimeout(hostTrafficTimer)
    hostTrafficTimer = null
  }
  if (hostTrafficAgentTimer !== null) {
    window.clearTimeout(hostTrafficAgentTimer)
    hostTrafficAgentTimer = null
  }
  if (hostQosTimer !== null) {
    window.clearTimeout(hostQosTimer)
    hostQosTimer = null
  }
  if (hostRemoteTargetsTimer !== null) {
    window.clearTimeout(hostRemoteTargetsTimer)
    hostRemoteTargetsTimer = null
  }
})
</script>
