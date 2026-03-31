# UIUbuntuXkeen v0.6.13 — экранный аудит (черновик)

Источник: дистрибутив `UIUbuntuXkeen-dist-v0.6.13.zip`.

## Сводка по экранам

| Экран | Кнопки | Inputs | Select | Textarea | Legacy-зависимости | Будущий Ubuntu/service-контур |
|---|---:|---:|---:|---:|---|---|
| ConnectionsPage.vue | 0 | 0 | 0 | 0 | — | — |
| HomePage.vue | 3 | 0 | 0 | 0 | @/api/agent, @/store/agent, agentStatusAPI, bootstrapRouterAgentForLan, agentEnabled, agentEnforceBandwidth | — |
| LogsPage.vue | 0 | 0 | 0 | 0 | — | — |
| MihomoPage.vue | 18 | 0 | 0 | 0 | — | — |
| OverviewPage.vue | 0 | 0 | 0 | 0 | — | — |
| PoliciesPage.vue | 11 | 5 | 2 | 0 | — | — |
| ProxiesPage.vue | 1 | 0 | 0 | 0 | — | — |
| ProxiesRoutePage.vue | 0 | 0 | 0 | 0 | — | — |
| ProxyProvidersRoutePage.vue | 0 | 0 | 0 | 0 | — | — |
| RouterPage.vue | 3 | 0 | 0 | 0 | — | — |
| RulesPage.vue | 0 | 0 | 0 | 0 | — | — |
| SettingsPage.vue | 5 | 0 | 0 | 0 | — | — |
| SetupPage.vue | 6 | 1 | 2 | 0 | — | backendContract |
| SubscriptionsPage.vue | 14 | 3 | 5 | 8 | @/store/agent, router-agent, cgi-bin/api.sh | — |
| TasksPage.vue | 54 | 31 | 4 | 0 | @/api/agent, @/store/agent, router-agent, agentStatusAPI, agentEnabled | — |
| TrafficPage.vue | 6 | 0 | 0 | 0 | @/store/agent, agentEnabled | — |
| UsersPage.vue | 6 | 2 | 0 | 0 | @/api/agent | — |

## Детали по экранам

### ConnectionsPage.vue
Ключевые компоненты:
- `ConnectionCardList`
- `ConnectionDetails`
- `ConnectionTable`

### HomePage.vue
Ключевые компоненты:
- `Component`
- `DialogWrapper`
- `GlobalSearchModal`
- `PageTitleBar`
- `RouterView`
- `SideBar`
- `Transition`
Первые кнопки/действия:
- `router.push({ name: r })` → {{ $t(r) }}
- `autoSwitchBackendDialog = false` → {{ $t('cancel') }}
- `autoSwitchBackend` → {{ $t('confirm') }}

### LogsPage.vue
Ключевые компоненты:
- `LogsCard`
- `VirtualScroller`

### MihomoPage.vue
Видимые секции/заголовки:
- {{ $t('mihomoWorkspaceTitle') }}
- {{ $t(activeSectionMeta.labelKey) }}
- {{ $t('mihomoWorkspaceSafetyTitle') }}
- {{ $t('mihomoSectionOverviewTitle') }}
- {{ $t('mihomoOverviewStructureTitle') }}
- {{ $t('mihomoSectionRuntimeTitle') }}
- {{ $t('mihomoSectionProvidersTitle') }}
- {{ $t('mihomoSectionRulesTitle') }}
- {{ $t('mihomoConfigSectionTitle') }}
- {{ $t('mihomoCardRuntimeTitle') }}
- {{ $t('mihomoRuntimeTrafficTitle') }}
- {{ $t('mihomoRuntimeConnectionsTitle') }}
Ключевые компоненты:
- `MihomoConfigEditor`
Первые кнопки/действия:
- `setSection('config')` → {{ $t('mihomoWorkspaceOpenConfig') }}
- `goToRoute(ROUTE_NAME.router)` → {{ $t('mihomoWorkspaceOpenRuntime') }}
- `goToRoute(ROUTE_NAME.proxyProviders)` → {{ $t('mihomoWorkspaceOpenProviders') }}
- `goToRoute(ROUTE_NAME.rules)` → {{ $t('mihomoWorkspaceOpenRules') }}
- `setSection(section.id)` → {{ $t(section.labelKey) }}
- `setSection('runtime')` → {{ $t('mihomoSectionRuntimeTitle') }} {{ $t('mihomoSectionRuntimeTip') }}
- `setSection('providers')` → {{ $t('mihomoSectionProvidersTitle') }} {{ $t('mihomoSectionProvidersTip') }}
- `setSection('rules')` → {{ $t('mihomoSectionRulesTitle') }} {{ $t('mihomoSectionRulesTip') }}
- `setSection('config')` → {{ $t('mihomoConfigSectionTitle') }} {{ $t('mihomoConfigSectionTip') }}
- `goToRoute(ROUTE_NAME.router)` → {{ $t('mihomoCardRuntimeTitle') }} {{ $t('mihomoCardRuntimeTip') }}
- `goToRoute(ROUTE_NAME.traffic)` → {{ $t('mihomoRuntimeTrafficTitle') }} {{ $t('mihomoRuntimeTrafficTip') }}
- `goToRoute(ROUTE_NAME.connections)` → {{ $t('mihomoRuntimeConnectionsTitle') }} {{ $t('mihomoRuntimeConnectionsTip') }}

### OverviewPage.vue
Ключевые компоненты:
- `BackendVersion`
- `ConnectionHistory`
- `ProxiesRuleCharts`

### PoliciesPage.vue
Видимые секции/заголовки:
- {{ $t('limitProfiles') }}
- {{ $t('edit') }}
- {{ $t('snapshots') }}
- {{ $t('exportImport') }}
Первые кнопки/действия:
- `addProfile` → {{ $t('add') }}
- `resetDefaults` → {{ $t('resetToDefaults') }}
- `deleteProfile` → {{ $t('delete') }}
- `revertDraft` → {{ $t('revert') }}
- `saveDraft` → {{ $t('save') }}
- `createSnapshot` → {{ $t('createSnapshot') }}
- `clearSnapshots` → {{ $t('clear') }}
- `restore(s.id)` → {{ $t('restore') }}
- `exportBundle` → {{ $t('export') }}
- `importBundle('merge')` → {{ $t('importMerge') }}
- `importBundle('replace')` → {{ $t('importReplace') }}

### ProxiesPage.vue
Ключевые компоненты:
- `ProxyProvidersHealthSummary`
Первые кнопки/действия:
- `resetProviderFilters` → {{ $t('resetFilters') }}

### ProxiesRoutePage.vue
Ключевые компоненты:
- `ProxiesPage`

### ProxyProvidersRoutePage.vue
Ключевые компоненты:
- `ProxiesPage`

### RouterPage.vue
Видимые секции/заголовки:
- {{ t(workspaceTitleKey) }}
- {{ t(activeSectionMeta.labelKey) }}
- {{ t(infoTitleKey) }}
- {{ t(isUbuntuService ? 'hostSectionOverviewTitle' : 'routerSectionOverviewTitle') }}
- {{ t('hostSectionServicesTitle') }}
- {{ t('hostSectionLogsTitle') }}
- {{ t('routerSectionTrafficTitle') }}
- {{ t('hostQosTitle') }}
- {{ t('routerSectionNetworkTitle') }}
Ключевые компоненты:
- `AgentCard`
- `BackendDataFlowCard`
- `BackendVersion`
- `ChartsCard`
- `HostLogsCard`
- `HostRuntimeCard`
- `HostServicesCard`
- `NetcrazeTrafficCard`
- `NetworkCard`
- `SystemCard`
Первые кнопки/действия:
- `setSection(section.id)` → {{ t(section.labelKey) }}
- `setSection(section.id)` → {{ t(section.labelKey) }}
- `goUsersTraffic` → {{ t('open') }} · {{ t('traffic') }}

### RulesPage.vue
Ключевые компоненты:
- `RuleCard`
- `RuleProvider`
- `RulesTable`
- `VirtualScroller`

### SettingsPage.vue
Видимые секции/заголовки:
- {{ $t('settingsSectionsTitle') }}
- {{ $t('settingsSectionInterface') }}
- {{ $t('settingsSectionBackend') }}
- {{ $t('settingsSectionTraffic') }}
- {{ $t('settingsSectionPages') }}
Ключевые компоненты:
- `BackendSettings`
- `ConnectionsSettings`
- `GeneralSettings`
- `OverviewSettings`
- `ProxiesSettings`
- `TunnelDescriptionsSettings`
- `ZashboardSettings`
Первые кнопки/действия:
- `openMihomo` → {{ $t('openMihomoSection') }}
- `scrollToSection('settings-interface')` → {{ $t('settingsSectionInterface') }}
- `scrollToSection('settings-backend')` → {{ $t('settingsSectionBackend') }}
- `scrollToSection('settings-traffic')` → {{ $t('settingsSectionTraffic') }}
- `scrollToSection('settings-pages')` → {{ $t('settingsSectionPages') }}

### SetupPage.vue
Видимые секции/заголовки:
- {{ $t('backendModeHelpTitle') }}
Ключевые компоненты:
- `BackendContractCard`
- `BackendDataFlowCard`
- `ChevronUpDownIcon`
- `Draggable`
- `EditBackendModal`
- `ImportSettings`
- `LanguageSelect`
- `PencilIcon`
- `QuestionMarkCircleIcon`
- `TextInput`
- `TrashIcon`
Первые кнопки/действия:
- `applyRecommendedPath()` → {{ $t('backendModeUseRecommendedPath') }}
- `handleSubmit(form)` → {{ $t('submit') }}
- `selectBackend(element.uuid)` → {{ getLabelFromBackend(element) }} {{ element.kind === BACKEND_KINDS.UBUNTU_SERVICE ? $t('backendModeShortUbuntu') : $t(
- `editBackend(element)` → без текста
- `без @click` → removeBackend(element.uuid)" >

### SubscriptionsPage.vue
Видимые секции/заголовки:
- {{ $t('subscriptionsProvidersInventoryTitle') }}
- {{ $t('subscriptionsUsageImportTitle') }}
- {{ $t('subscriptionsUsageRefreshTitle') }}
- {{ $t('subscriptionsUsageClientsTitle') }}
- {{ $t('subscriptionsImportReadyTitle') }}
- {{ $t('subscriptionsV2rayTunPendingTitle') }}
Ключевые компоненты:
- `QrCodeSvg`
Первые кнопки/действия:
- `refreshProviders` → {{ $t('refresh') }}
- `handleProviderChipClick(provider.name)` → {{ provider.name }} {{ provider.nodeCount }} {{ $t('subscriptionsNodesShort') }} {{ $t(provider.health.labelKey) }} {{ p
- `selectAllProviders` → {{ $t('subscriptionsSelectAll') }}
- `selectAvailableProviders` → {{ $t('subscriptionsSelectAvailable') }}
- `clearSelectedProviders` → {{ $t('clear') }}
- `togglePublicationSettings` → {{ publicationSettingsOpen ? $t('subscriptionsHttpsAdvancedHide') : $t('subscriptionsHttpsAdvancedShow') }}
- `copyText(publishedBaseUrlNormalized)` → {{ $t('copyLink') }}
- `clearPublishedBase` → {{ $t('clear') }}
- `copyText(effectiveMihomoUrl)` → {{ $t('subscriptionsCopyCurrentUrl') }}
- `copyText(mihomoUrl)` → {{ $t('subscriptionsCopyLocalUrl') }}
- `copyText(effectiveUniversalUrl)` → {{ $t('subscriptionsCopyCurrentUrl') }}
- `copyText(universalUrl)` → {{ $t('subscriptionsCopyLocalUrl') }}

### TasksPage.vue
Видимые секции/заголовки:
- {{ $t('quickActions') }}
- {{ $t('routerUiUrlTitle') }}
- {{ $t('providersPanelTitle') }}
- {{ $t('providerTrafficDebugTitle') }}
- {{ $t('liveLogs') }}
- {{ $t('dataFreshness') }}
- {{ $t('geoFiles') }}
- {{ $t('filterPoliciesFiles') }}
- {{ $t('topRulesTitle') }}
- {{ $t('localRulesDir') }}
- {{ $t('diagnostics') }}
- {{ $t('upstreamTracking') }}
Ключевые компоненты:
- `BackendVersion`
- `ChevronDownIcon`
- `ProviderIconBadge`
- `Teleport`
- `TopologyActionButtons`
Первые кнопки/действия:
- `applyEnforcement` → {{ $t('applyEnforcementNow') }}
- `refreshSsl` → {{ $t('refreshProvidersSsl') }}
- `copyRouterUiUrl(false)` → {{ $t('copy') }}
- `copyRouterUiUrl(true)` → {{ $t('copyYamlLine') }}
- `toggleProvidersPanelExpanded` → {{ $t('providersPanelTitle') }}
- `refreshProvidersPanel(true)` → {{ $t('refresh') }}
- `refreshProviderSslCacheNow` → {{ $t('refreshProviderSslCache') }}
- `без @click` → openProviderIconPicker(e, p.name)" :title="$t('providerIcon')" >
- `clearProviderSslWarnOverride(p.name)` → {{ $t('clear') }}
- `без @click` → pickProviderIconFromPicker('')">
- `без @click` → pickProviderIconFromPicker('globe')">
- `без @click` → pickProviderIconFromPicker(cc)" :title="cc" >

### TrafficPage.vue
Видимые секции/заголовки:
- {{ $t('trafficWorkspaceTitle') }}
- {{ $t('connections') }}
Ключевые компоненты:
- `ConnectionCardList`
- `ConnectionDetails`
- `ConnectionTable`
- `HostQosCard`
- `NetcrazeTrafficCard`
- `TrafficClientsStateCard`
- `TrafficRuntimeSummaryCard`
- `UserTrafficStats`
Первые кнопки/действия:
- `setTab('clients')` → {{ $t('trafficClientStateTitle') }}
- `setTab('connections')` → {{ $t('connections') }}
- `setTab('users')` → {{ $t('users') }}
- `connectionTabShow = CONNECTION_TAB_TYPE.ACTIVE` → {{ $t('activeConnections') }}
- `connectionTabShow = CONNECTION_TAB_TYPE.CLOSED` → {{ $t('closedConnections') }}
- `goConnections` → {{ $t('open') }}

### UsersPage.vue
Видимые секции/заголовки:
- {{ t('traffic') }}
Ключевые компоненты:
- `ArrowDownTrayIcon`
- `ChevronDownIcon`
- `ChevronUpDownIcon`
- `CloudIcon`
- `CollapseCard`
- `Draggable`
- `LockClosedIcon`
- `PlusIcon`
- `SourceIPInput`
- `TagIcon`
- `TopologyActionButtons`
- `TrashIcon`
Первые кнопки/действия:
- `toggleImportPanel` → {{ t('importLanHosts') }}
- `closeImportPanel` → {{ t('close') }}
- `applyImport` → {{ t('importLanHostsApply') }}
- `handlerLabelRemove(sourceIP.id)` → без текста
- `handlerLabelAdd` → без текста
- `goTraffic` → {{ t('open') }} · {{ t('traffic') }}
