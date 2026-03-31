<template>
  <div class="flex h-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2">
    <div class="card gap-3 p-3">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="font-semibold">{{ $t('trafficWorkspaceTitle') }}</div>
          <div class="text-sm opacity-70">{{ $t('trafficWorkspaceTip') }}</div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" :class="activeTab === 'clients' ? '' : 'btn-ghost'" @click="setTab('clients')">
            {{ $t('trafficClientStateTitle') }}
          </button>
          <button type="button" class="btn btn-sm" :class="activeTab === 'connections' ? '' : 'btn-ghost'" @click="setTab('connections')">
            {{ $t('connections') }}
          </button>
          <button type="button" class="btn btn-sm" :class="activeTab === 'users' ? '' : 'btn-ghost'" @click="setTab('users')">
            {{ $t('users') }}
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-100/70 p-3 text-sm opacity-75">
        {{ $t('trafficWorkspaceOperationalTip') }}
      </div>
    </div>

    <TrafficRuntimeSummaryCard
      :items="trafficClientItems"
      :agent-live="trafficAgentLive"
      :last-agent-update-at="trafficLastAgentUpdateAt"
    />

    <section v-show="activeTab === 'clients'" class="space-y-2">
      <TrafficClientsStateCard ref="clientsStateCard" />

      <div class="card gap-2 p-3 text-sm opacity-70">
        {{ $t('trafficWorkspaceHostOnlyTip') }}
      </div>
    </section>

    <section v-show="activeTab === 'connections'" class="space-y-2">
      <div class="card gap-3 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-semibold">{{ $t('connections') }}</div>
            <div class="text-sm opacity-70">{{ $t('mihomoRuntimeConnectionsTip') }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn btn-sm" :class="connectionTabShow === CONNECTION_TAB_TYPE.ACTIVE ? '' : 'btn-ghost'" @click="connectionTabShow = CONNECTION_TAB_TYPE.ACTIVE">
              {{ $t('activeConnections') }}
            </button>
            <button type="button" class="btn btn-sm" :class="connectionTabShow === CONNECTION_TAB_TYPE.CLOSED ? '' : 'btn-ghost'" @click="connectionTabShow = CONNECTION_TAB_TYPE.CLOSED">
              {{ $t('closedConnections') }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="goConnections">{{ $t('open') }}</button>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-base-content/10 bg-base-100/40">
        <ConnectionCardList v-if="useConnectionCard" class="overflow-x-hidden p-2" />
        <ConnectionTable v-else />
      </div>
      <ConnectionDetails />
    </section>

    <section v-show="activeTab === 'users'" class="space-y-2">
      <div class="card gap-2 p-3 text-sm opacity-70">
        {{ $t('userTrafficTip') }}
      </div>
      <UserTrafficStats />
    </section>
  </div>
</template>

<script setup lang="ts">
import ConnectionCardList from '@/components/connections/ConnectionCardList.vue'
import ConnectionDetails from '@/components/connections/ConnectionDetails.vue'
import ConnectionTable from '@/components/connections/ConnectionTable.vue'
import TrafficClientsStateCard from '@/components/traffic/TrafficClientsStateCard.vue'
import TrafficRuntimeSummaryCard from '@/components/traffic/TrafficRuntimeSummaryCard.vue'
import UserTrafficStats from '@/components/users/UserTrafficStats.vue'
import { ROUTE_NAME, CONNECTION_TAB_TYPE } from '@/constant'
import { connectionTabShow } from '@/store/connections'
import { useConnectionCard } from '@/store/settings'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref<'clients' | 'connections' | 'users'>('clients')
const clientsStateCard = ref<any>(null)

const setTab = (tab: 'clients' | 'connections' | 'users') => {
  activeTab.value = tab
}

const goConnections = () => {
  router.push({ name: ROUTE_NAME.connections })
}

const trafficClientItems = computed(() => clientsStateCard.value?.rows?.value || [])
const trafficAgentLive = computed(() => !!clientsStateCard.value?.agentLive?.value)
const trafficLastAgentUpdateAt = computed(() => Number(clientsStateCard.value?.lastAgentUpdateAt?.value || 0))
</script>
