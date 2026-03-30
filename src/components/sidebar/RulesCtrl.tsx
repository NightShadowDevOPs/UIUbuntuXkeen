import { updateRuleProviderAPI } from '@/api'
import { RULE_TAB_TYPE } from '@/constant'
import { showNotification } from '@/helper/notification'
import {
  fetchRules,
  ruleMissCount,
  ruleProviderList,
  rules,
  rulesFilter,
  rulesProxyFilter,
  rulesSortBy,
  rulesTabShow,
  rulesTypeFilter,
  rulesViewMode,
  uniqueRuleProxies,
  uniqueRuleTypes,
} from '@/store/rules'
import { displayLatencyInRule, displayNowNodeInRule } from '@/store/settings'
import { ArrowPathIcon, WrenchScrewdriverIcon } from '@heroicons/vue/24/outline'
import { computed, defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogWrapper from '../common/DialogWrapper.vue'
import TextInput from '../common/TextInput.vue'

export default defineComponent({
  name: 'RulesCtrl',
  props: {
    isLargeCtrlsBar: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const { t } = useI18n()
    const settingsModel = ref(false)
    const isUpgrading = ref(false)
    const hasProviders = computed(() => {
      return ruleProviderList.value.length > 0
    })

    const handlerClickUpgradeAllProviders = async () => {
      if (isUpgrading.value) return
      isUpgrading.value = true
      try {
        let updateCount = 0

        await Promise.all(
          ruleProviderList.value.map((provider) =>
            updateRuleProviderAPI(provider.name).then(() => {
              updateCount++

              const isFinished = updateCount === ruleProviderList.value.length

              showNotification({
                key: 'updateFinishedTip',
                content: 'updateFinishedTip',
                params: {
                  number: `${updateCount}/${ruleProviderList.value.length}`,
                },
                type: isFinished ? 'alert-success' : 'alert-info',
                timeout: isFinished ? 2000 : 0,
              })
            }),
          ),
        )
        await fetchRules()
        isUpgrading.value = false
      } catch {
        await fetchRules()
        isUpgrading.value = false
      }
    }

    const tabsWithNumbers = computed(() => {
      return Object.values(RULE_TAB_TYPE).map((type) => {
        return {
          type,
          count: type === RULE_TAB_TYPE.RULES ? rules.value.length : ruleProviderList.value.length,
        }
      })
    })

    return () => {
      const tabs = (
        <div
          role="tablist"
          class="tabs-box tabs tabs-xs"
        >
          {tabsWithNumbers.value.map(({ type, count }) => {
            return (
              <a
                role="tab"
                key={type}
                class={['tab', rulesTabShow.value === type && 'tab-active']}
                onClick={() => (rulesTabShow.value = type)}
              >
                {t(type)} ({count})
              </a>
            )
          })}
        </div>
      )

      const viewTabs = rulesTabShow.value === RULE_TAB_TYPE.RULES && (
        <div
          role="tablist"
          class="tabs-box tabs tabs-xs"
          title={t('proxiesRelationship')}
        >
          <a
            role="tab"
            class={['tab', rulesViewMode.value === 'card' && 'tab-active']}
            onClick={() => (rulesViewMode.value = 'card')}
          >
            {t('card')}
          </a>
          <a
            role="tab"
            class={['tab', rulesViewMode.value === 'table' && 'tab-active']}
            onClick={() => (rulesViewMode.value = 'table')}
          >
            {t('table')}
          </a>
        </div>
      )

      const sortSelect = rulesTabShow.value === RULE_TAB_TYPE.RULES && (
        <div class={['flex items-center gap-1 text-sm', props.isLargeCtrlsBar ? '' : 'flex-1']}>
          {props.isLargeCtrlsBar && <span class="shrink-0">{t('sortBy')}</span>}
          <select
            class={[
              'select select-sm',
              props.isLargeCtrlsBar ? 'min-w-44' : 'w-full min-w-0 flex-1',
            ]}
            v-model={rulesSortBy.value}
          >
            <option value="config">{t('defaultsort')}</option>
            <option value="hits_desc">{t('hits')} ↓</option>
            <option value="hits_asc">{t('hits')} ↑</option>
            <option value="type_asc">{t('type')} A→Z</option>
            <option value="proxy_asc">{t('proxy')} A→Z</option>
            <option value="updated_desc">{t('updated')} ↓</option>
          </select>
        </div>
      )

      const typeFilterSelect = rulesTabShow.value === RULE_TAB_TYPE.RULES && (
        <select
          class={['select select-sm', props.isLargeCtrlsBar ? 'min-w-36' : 'min-w-24']}
          v-model={rulesTypeFilter.value}
          title={t('type')}
        >
          <option value="">{t('all')} · {t('type')}</option>
          {uniqueRuleTypes.value.map((x) => (
            <option
              key={x}
              value={x}
            >
              {x}
            </option>
          ))}
        </select>
      )

      const proxyFilterSelect = rulesTabShow.value === RULE_TAB_TYPE.RULES && (
        <select
          class={['select select-sm', props.isLargeCtrlsBar ? 'min-w-44' : 'min-w-28']}
          v-model={rulesProxyFilter.value}
          title={t('proxy')}
        >
          <option value="">{t('all')} · {t('proxy')}</option>
          {uniqueRuleProxies.value.map((x) => (
            <option
              key={x}
              value={x}
            >
              {x}
            </option>
          ))}
        </select>
      )
      const upgradeAllIcon = rulesTabShow.value === RULE_TAB_TYPE.PROVIDER && (
        <button
          class="btn btn-circle btn-sm"
          onClick={handlerClickUpgradeAllProviders}
        >
          <ArrowPathIcon class={['h-4 w-4', isUpgrading.value && 'animate-spin']} />
        </button>
      )


      const missBadge = (
        <span
          class="badge badge-ghost badge-sm"
          title={t('ruleMissTip')}
        >
          {t('misses')}: {ruleMissCount.value}
        </span>
      )

      const searchInput = (
        <TextInput
          class={props.isLargeCtrlsBar ? 'w-80' : 'w-32 flex-1'}
          v-model={rulesFilter.value}
          placeholder={`${t('search')} | ${t('searchMultiple')}`}
          clearable={true}
        />
      )

      const settingsModal = (
        <>
          <button
            class={'btn btn-circle btn-sm'}
            onClick={() => (settingsModel.value = true)}
          >
            <WrenchScrewdriverIcon class="h-4 w-4" />
          </button>
          <DialogWrapper v-model={settingsModel.value}>
            <div class="flex flex-col gap-4 p-2 text-sm">
              <div class="flex items-center gap-2">
                {t('displaySelectedNode')}
                <input
                  class="toggle"
                  type="checkbox"
                  v-model={displayNowNodeInRule.value}
                />
              </div>
              <div class="flex items-center gap-2">
                {t('displayLatencyNumber')}
                <input
                  class="toggle"
                  type="checkbox"
                  v-model={displayLatencyInRule.value}
                />
              </div>
            </div>
          </DialogWrapper>
        </>
      )

      if (!props.isLargeCtrlsBar) {
        return (
          <div class="flex flex-col gap-2 p-2">
            <div class="flex flex-wrap gap-2">
              {hasProviders.value && tabs}
              {viewTabs}
              {upgradeAllIcon}
            </div>
            <div class="flex w-full gap-2">
              {searchInput}
              {missBadge}
              {settingsModal}
            </div>
            <div class="flex w-full gap-2">
              {sortSelect}
              {typeFilterSelect}
              {proxyFilterSelect}
            </div>
          </div>
        )
      }
      return (
        <div class="flex flex-wrap gap-2 p-2">
          {hasProviders.value && tabs}
          {viewTabs}
          {searchInput}
          {sortSelect}
          {typeFilterSelect}
          {proxyFilterSelect}
          <div class="flex-1"></div>
          {missBadge}
          {upgradeAllIcon}
          {settingsModal}
        </div>
      )
    }
  },
})
