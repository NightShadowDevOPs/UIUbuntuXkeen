<template>
  <div class="page px-4 pb-6 pt-4 lg:px-6">
    <div class="mx-auto flex max-w-7xl flex-col gap-4">
      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <h2 class="text-xl font-semibold">{{ $t('subscriptionsTitle') }}</h2>
            <p class="text-sm text-base-content/70">
              {{ $t('subscriptionsDesc') }}
            </p>
            <div class="badge badge-info badge-outline gap-2">
              <span>router-agent</span>
              <span>{{ $t('subscriptionsDirectNote') }}</span>
            </div>
          </div>
          <div class="grid gap-2 sm:grid-cols-2 lg:w-[32rem]">
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsName') }}</span>
              </div>
              <input v-model.trim="bundleName" class="input input-bordered input-sm" :placeholder="$t('subscriptionsNamePlaceholder')" />
            </label>
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsMode') }}</span>
              </div>
              <select v-model="selectionMode" class="select select-bordered select-sm">
                <option value="all">{{ $t('subscriptionsModeAll') }}</option>
                <option value="available">{{ $t('subscriptionsModeAvailable') }}</option>
                <option value="custom">{{ $t('subscriptionsModeCustom') }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-base-content/70">
          <span class="badge badge-neutral badge-outline">{{ $t('subscriptionsProvidersSelected') }}: {{ selectedProviderNames.length }}</span>
          <span class="badge badge-neutral badge-outline">{{ $t('subscriptionsProvidersTotal') }}: {{ providers.length }}</span>
          <button class="btn btn-ghost btn-xs" @click="refreshProviders">{{ $t('refresh') }}</button>
        </div>
        <div class="mt-2 text-xs text-base-content/60">{{ $t('subscriptionsProvidersHint') }}</div>

        <div class="mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
              <div class="text-sm font-semibold">{{ $t('subscriptionsProvidersInventoryTitle') }}</div>
              <div class="text-xs text-base-content/60">{{ $t('subscriptionsProvidersCardsHint') }}</div>
            </div>
            <div class="flex flex-col gap-2 lg:items-end">
              <div class="flex flex-wrap gap-2">
                <label class="label cursor-pointer justify-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 lg:self-start">
                  <span class="label-text text-xs">{{ $t('subscriptionsAvailableOnlyFilter') }}</span>
                  <input v-model="providerQuickAvailableOnly" type="checkbox" class="toggle toggle-xs" />
                </label>
                <label class="form-control w-full min-w-[11rem] sm:w-48">
                  <div class="label py-1">
                    <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsProtocolFilter') }}</span>
                  </div>
                  <select v-model="providerQuickProtoFilter" class="select select-bordered select-sm bg-base-100">
                    <option value="all">{{ $t('all') }}</option>
                    <option v-for="proto in providerProtoOptions" :key="proto" :value="proto">{{ proto }}</option>
                  </select>
                </label>
                <label class="form-control w-full min-w-[11rem] sm:w-48">
                  <div class="label py-1">
                    <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsCountryFilter') }}</span>
                  </div>
                  <select v-model="providerQuickCountryFilter" class="select select-bordered select-sm bg-base-100">
                    <option value="all">{{ $t('all') }}</option>
                    <option v-for="country in providerCountryOptions" :key="country" :value="country">{{ countryOptionLabel(country) }}</option>
                  </select>
                </label>
              </div>
              <div class="text-[11px] text-base-content/55">{{ $t('subscriptionsInventoryFilterHint') }}</div>
            </div>
          </div>

          <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="provider in inventoryProviders"
              :key="provider.name"
              type="button"
              class="flex h-full min-h-[7.5rem] flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left shadow-sm transition-colors"
              :class="providerChipClass(provider)"
              @click="handleProviderChipClick(provider.name)"
            >
              <div class="flex w-full flex-wrap items-center gap-2">
                <span class="min-w-0 flex-1 truncate font-medium">{{ provider.name }}</span>
                <span class="badge badge-xs badge-neutral badge-outline">{{ provider.nodeCount }} {{ $t('subscriptionsNodesShort') }}</span>
                <span class="badge badge-xs" :class="provider.health.badgeCls">{{ $t(provider.health.labelKey) }}</span>
              </div>
              <div class="flex flex-wrap gap-1 text-[11px]">
                <span
                  v-for="proto in provider.topProtocols"
                  :key="`${provider.name}-proto-${proto.label}`"
                  class="badge badge-xs badge-outline border-primary/30 bg-primary/5"
                >
                  {{ proto.label }} · {{ proto.count }}
                </span>
                <span v-if="!provider.topProtocols.length" class="badge badge-xs badge-ghost">{{ $t('subscriptionsNoProtoHints') }}</span>
              </div>
              <div class="flex flex-wrap gap-1 text-[11px]">
                <span
                  v-for="country in provider.topCountries"
                  :key="`${provider.name}-country-${country.code}`"
                  class="badge badge-xs badge-outline border-secondary/30 bg-secondary/5"
                >
                  {{ country.flag || '🌐' }} {{ country.code }} · {{ country.count }}
                </span>
                <span v-if="!provider.topCountries.length" class="badge badge-xs badge-ghost">{{ $t('subscriptionsMixedCountries') }}</span>
              </div>
            </button>
            <span v-if="!inventoryProviders.length" class="text-sm text-base-content/60">{{ $t('subscriptionsNoProvidersFiltered') }}</span>
          </div>
        </div>

        <div v-if="selectionMode === 'custom'" class="mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-3">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <button class="btn btn-xs" @click="selectAllProviders">{{ $t('subscriptionsSelectAll') }}</button>
            <button class="btn btn-ghost btn-xs" @click="selectAvailableProviders">{{ $t('subscriptionsSelectAvailable') }}</button>
            <button class="btn btn-ghost btn-xs" @click="clearSelectedProviders">{{ $t('clear') }}</button>
          </div>
          <div class="text-xs text-base-content/60">{{ $t('subscriptionsCustomSelectionHint') }}</div>
        </div>
      </div>

      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <h3 class="text-lg font-semibold">{{ $t('subscriptionsHttpsTitle') }}</h3>
            <p class="text-sm text-base-content/70">{{ $t('subscriptionsHttpsDesc') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="badge gap-1" :class="publishedHttpsReady ? 'badge-success badge-outline' : 'badge-neutral badge-outline'">
              {{ publishedHttpsReady ? $t('subscriptionsHttpsReady') : $t('subscriptionsHttpsLocalMode') }}
            </span>
            <span v-if="publishedBaseUrlNormalized && !publishedBaseUrlLooksHttps" class="badge badge-warning badge-outline">
              {{ $t('subscriptionsHttpsNeedsTls') }}
            </span>
          </div>
        </div>
        <div class="mt-3 rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70">
          <p>{{ publishedHttpsReady ? $t('subscriptionsHttpsHintConfigured') : $t('subscriptionsHttpsHintLocalOnly') }}</p>
          <p class="mt-2">{{ $t('subscriptionsHttpsHint2') }}</p>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline" @click="togglePublicationSettings">
            {{ publicationSettingsOpen ? $t('subscriptionsHttpsAdvancedHide') : $t('subscriptionsHttpsAdvancedShow') }}
          </button>
          <button v-if="publishedBaseUrlNormalized" class="btn btn-sm" @click="copyText(publishedBaseUrlNormalized)">
            {{ $t('copyLink') }}
          </button>
          <button v-if="publishedBaseUrl" class="btn btn-sm btn-ghost" @click="clearPublishedBase">
            {{ $t('clear') }}
          </button>
        </div>
        <div v-if="publicationSettingsOpen" class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div class="space-y-3">
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsPublishedBase') }}</span>
              </div>
              <input
                v-model.trim="publishedBaseUrl"
                class="input input-bordered input-sm"
                :placeholder="$t('subscriptionsPublishedBasePlaceholder')"
              />
            </label>
            <div class="rounded-2xl border border-base-300 bg-base-100 p-3 text-xs text-base-content/70">
              <p>{{ $t('subscriptionsHttpsHint') }}</p>
              <p v-if="publishedBaseUrlNormalized" class="mt-2 break-all"><span class="font-medium">{{ $t('subscriptionsPublishedLink') }}:</span> {{ publishedBaseUrlNormalized }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!agentReady" class="alert alert-warning shadow-sm">
        <span>{{ $t('subscriptionsAgentRequired') }}</span>
      </div>

      <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">{{ $t('subscriptionsUsageModesTitle') }}</h3>
          <p class="text-sm text-base-content/70">{{ $t('subscriptionsUsageModesDesc') }}</p>
        </div>
        <div class="mt-4 grid gap-4 xl:grid-cols-2">
          <div class="rounded-2xl border border-success/30 bg-success/5 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-sm font-semibold text-base-content">{{ $t('subscriptionsUsageImportTitle') }}</div>
              <span class="badge badge-success badge-outline">{{ $t('subscriptionsUsageImportBadge') }}</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-base-content/75">{{ $t('subscriptionsUsageImportDesc') }}</p>
          </div>
          <div class="rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-sm font-semibold text-base-content">{{ $t('subscriptionsUsageRefreshTitle') }}</div>
              <span class="badge badge-warning badge-outline">{{ $t('subscriptionsUsageRefreshBadge') }}</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-base-content/75">{{ $t('subscriptionsUsageRefreshDesc') }}</p>
          </div>
        </div>
        <div class="mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-4">
          <div class="text-sm font-semibold text-base-content">{{ $t('subscriptionsUsageClientsTitle') }}</div>
          <div class="mt-3 grid gap-3 lg:grid-cols-2">
            <div class="rounded-2xl border border-base-300 bg-base-100 px-3 py-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">Mihomo / Clash</span>
                <span class="badge badge-success badge-outline">{{ $t('subscriptionsUsageReadyBadge') }}</span>
              </div>
              <p class="mt-2 text-sm leading-6 text-base-content/75">{{ $t('subscriptionsUsageMihomoDesc') }}</p>
            </div>
            <div class="rounded-2xl border border-base-300 bg-base-100 px-3 py-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">V2Ray / Xray</span>
                <span class="badge badge-info badge-outline">{{ $t('subscriptionsUsagePartialBadge') }}</span>
              </div>
              <p class="mt-2 text-sm leading-6 text-base-content/75">{{ $t('subscriptionsUsageUniversalDesc') }}</p>
              <p class="mt-2 text-sm leading-6 text-warning-content/90">{{ $t('subscriptionsUsageV2RayTunDesc') }}</p>
            </div>
          </div>
        </div>
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold">{{ $t('subscriptionsMihomoTitle') }}</h3>
              <p class="mt-1 text-sm text-base-content/70">{{ $t('subscriptionsMihomoDesc') }}</p>
            </div>
            <span class="badge badge-primary badge-outline self-start whitespace-nowrap shrink-0">Mihomo / Clash</span>
          </div>

          <div class="space-y-3">
            <div class="rounded-2xl border border-success/30 bg-success/5 p-3 text-xs text-base-content/80">
              <div class="font-semibold text-base-content">{{ $t('subscriptionsImportReadyTitle') }}</div>
              <p class="mt-1 leading-5">{{ $t('subscriptionsImportReadyMihomoDesc') }}</p>
            </div>
            <div class="rounded-2xl border border-base-300 bg-base-200/40 p-3 text-xs text-base-content/75">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-base-content">{{ $t('subscriptionsCurrentSourceLabel') }}:</span>
                <span class="badge badge-outline" :class="effectiveMihomoUsesPublished ? 'badge-success' : 'badge-neutral'">
                  {{ effectiveMihomoUsesPublished ? $t('subscriptionsCurrentSourcePublished') : $t('subscriptionsCurrentSourceLocal') }}
                </span>
              </div>
              <p class="mt-2 leading-5">{{ $t('subscriptionsCurrentSourceHint') }}</p>
            </div>
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsLocalLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-28 text-xs" :value="mihomoUrl" readonly />
            </label>
            <label v-if="publishedMihomoUrl" class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsPublishedLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="publishedMihomoUrl" readonly />
            </label>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm" :disabled="!effectiveMihomoUrl" @click="copyText(effectiveMihomoUrl)">{{ $t('subscriptionsCopyCurrentUrl') }}</button>
              <button class="btn btn-sm" :disabled="!mihomoUrl" @click="copyText(mihomoUrl)">{{ $t('subscriptionsCopyLocalUrl') }}</button>
              <a class="btn btn-sm btn-primary" :class="!clashDeepLink && 'btn-disabled'" :href="clashDeepLink || undefined">{{ $t('subscriptionsOpenInClash') }}</a>
            </div>
            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div class="space-y-2">
                <label class="form-control max-w-xs">
                  <div class="label py-1">
                    <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsQrMode') }}</span>
                  </div>
                  <select v-model="mihomoQrMode" class="select select-bordered select-sm">
                    <option value="url">{{ $t('subscriptionsQrModeUrl') }}</option>
                    <option value="clash">{{ $t('subscriptionsQrModeClash') }}</option>
                  </select>
                </label>
                <div class="rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70">
                  {{ $t('subscriptionsMihomoTip') }}
                </div>
              </div>
              <QrCodeSvg :text="mihomoQrText" />
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold">{{ $t('subscriptionsUniversalTitle') }}</h3>
              <p class="mt-1 text-sm text-base-content/70">{{ $t('subscriptionsUniversalDesc') }}</p>
            </div>
            <span class="badge badge-secondary badge-outline self-start whitespace-nowrap shrink-0">V2Ray / Xray</span>
          </div>

          <div class="space-y-3">
            <div class="rounded-2xl border border-info/30 bg-info/10 p-3 text-xs text-base-content/80">
              <div class="font-semibold text-base-content">{{ $t('subscriptionsImportReadyTitle') }}</div>
              <p class="mt-1 leading-5">{{ $t('subscriptionsImportReadyUniversalDesc') }}</p>
            </div>
            <div class="rounded-2xl border border-base-300 bg-base-200/40 p-3 text-xs text-base-content/75">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-base-content">{{ $t('subscriptionsCurrentSourceLabel') }}:</span>
                <span class="badge badge-outline" :class="effectiveUniversalUsesPublished ? 'badge-success' : 'badge-neutral'">
                  {{ effectiveUniversalUsesPublished ? $t('subscriptionsCurrentSourcePublished') : $t('subscriptionsCurrentSourceLocal') }}
                </span>
                <span class="badge badge-outline" :class="effectiveJsonUsesPublished ? 'badge-success' : 'badge-neutral'">
                  JSON: {{ effectiveJsonUsesPublished ? $t('subscriptionsCurrentSourcePublished') : $t('subscriptionsCurrentSourceLocal') }}
                </span>
                <span class="badge badge-outline" :class="effectiveV2rayTunUsesPublished ? 'badge-success' : 'badge-neutral'">
                  V2RayTun: {{ effectiveV2rayTunUsesPublished ? $t('subscriptionsCurrentSourcePublished') : $t('subscriptionsCurrentSourceLocal') }}
                </span>
              </div>
              <p class="mt-2 leading-5">{{ $t('subscriptionsCurrentSourceHint') }}</p>
            </div>
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsLocalLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-28 text-xs" :value="universalUrl" readonly />
            </label>
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsLocalJsonLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="jsonUrl" readonly />
            </label>
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsLocalV2rayTunLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="v2rayTunUrl" readonly />
            </label>
            <label v-if="publishedUniversalUrl" class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsPublishedLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="publishedUniversalUrl" readonly />
            </label>
            <label v-if="publishedJsonUrl" class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsPublishedJsonLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="publishedJsonUrl" readonly />
            </label>
            <label v-if="publishedV2rayTunUrl" class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsPublishedV2rayTunLink') }}</span>
              </div>
              <textarea class="textarea textarea-bordered min-h-24 text-xs" :value="publishedV2rayTunUrl" readonly />
            </label>
            <div class="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-base-content/80">
              <div class="font-semibold text-base-content">{{ $t('subscriptionsV2rayTunPendingTitle') }}</div>
              <p class="mt-1 leading-5">{{ $t('subscriptionsV2rayTunPendingDesc') }}</p>
              <p v-if="publishedHttpsReady" class="mt-2 leading-5">{{ $t('subscriptionsV2rayTunPendingHttpsReady') }}</p>
              <p v-else class="mt-2 leading-5">{{ $t('subscriptionsV2rayTunPendingLocalOnly') }}</p>
              <p class="mt-2 leading-5">{{ $t('subscriptionsV2rayTunExperimentalNote') }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm" :disabled="!effectiveUniversalUrl" @click="copyText(effectiveUniversalUrl)">{{ $t('subscriptionsCopyCurrentUrl') }}</button>
              <button class="btn btn-sm" :disabled="!universalUrl" @click="copyText(universalUrl)">{{ $t('subscriptionsCopyLocalUrl') }}</button>
              <button class="btn btn-sm" :disabled="!effectiveJsonUrl" @click="copyText(effectiveJsonUrl)">{{ $t('subscriptionsCopyCurrentJsonUrl') }}</button>
              <button class="btn btn-sm" :disabled="!effectiveV2rayTunUrl" @click="copyText(effectiveV2rayTunUrl)">{{ $t('subscriptionsCopyCurrentV2rayTunUrl') }}</button>
              <a class="btn btn-sm" :class="!v2rayNgDeepLink && 'btn-disabled'" :href="v2rayNgDeepLink || undefined">v2rayNG</a>
              <a class="btn btn-sm" :class="!hiddifyDeepLink && 'btn-disabled'" :href="hiddifyDeepLink || undefined">Hiddify</a>
              <a class="btn btn-sm btn-secondary" :class="!v2rayTunDeepLink && 'btn-disabled'" :href="v2rayTunDeepLink || undefined">{{ $t('subscriptionsOpenInV2rayTun') }}</a>
            </div>
            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div class="space-y-2">
                <label class="form-control max-w-xs">
                  <div class="label py-1">
                    <span class="label-text text-xs text-base-content/70">{{ $t('subscriptionsQrMode') }}</span>
                  </div>
                  <select v-model="universalQrMode" class="select select-bordered select-sm">
                    <option value="url">{{ $t('subscriptionsQrModeUrl') }}</option>
                    <option value="v2rayng">v2rayNG</option>
                    <option value="hiddify">Hiddify</option>
                    <option value="v2raytun">{{ $t('subscriptionsQrModeV2rayTun') }}</option>
                  </select>
                </label>
                <div class="rounded-2xl bg-base-200/40 p-3 text-xs text-base-content/70">
                  {{ $t('subscriptionsUniversalTip') }}
                </div>
              </div>
              <QrCodeSvg :text="universalQrText" />
            </div>
          </div>
        </section>
      </div>

      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-lg font-semibold">{{ $t('subscriptionsSelectedProvidersTitle') }}</h3>
          <span class="text-xs text-base-content/60">{{ $t('subscriptionsSelectedProvidersHint') }}</span>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="provider in selectedProvidersMeta"
            :key="provider.name"
            class="rounded-2xl border border-base-300 bg-base-200/40 px-3 py-3 text-sm"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="min-w-0 flex-1 truncate font-medium">{{ provider.name }}</span>
              <span class="badge badge-xs badge-neutral badge-outline">{{ provider.nodeCount }} {{ $t('subscriptionsNodesShort') }}</span>
              <span class="badge badge-xs" :class="provider.health.badgeCls">{{ $t(provider.health.labelKey) }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1 text-[11px]">
              <span
                v-for="proto in provider.topProtocols"
                :key="`${provider.name}-selected-proto-${proto.label}`"
                class="badge badge-xs badge-outline border-primary/30 bg-primary/5"
              >
                {{ proto.label }} · {{ proto.count }}
              </span>
              <span v-if="!provider.topProtocols.length" class="badge badge-xs badge-ghost">{{ $t('subscriptionsNoProtoHints') }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1 text-[11px]">
              <span
                v-for="country in provider.topCountries"
                :key="`${provider.name}-selected-country-${country.code}`"
                class="badge badge-xs badge-outline border-secondary/30 bg-secondary/5"
              >
                {{ country.flag || '🌐' }} {{ country.code }} · {{ country.count }}
              </span>
              <span v-if="!provider.topCountries.length" class="badge badge-xs badge-ghost">{{ $t('subscriptionsMixedCountries') }}</span>
            </div>
          </div>
          <span v-if="!selectedProvidersMeta.length" class="text-sm text-base-content/60">{{ $t('subscriptionsNoProviders') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QrCodeSvg from '@/components/common/QrCodeSvg.vue'
import { ROUTE_NAME } from '@/constant'
import { countryCodeToFlagEmoji, flagEmojiToCountryCode } from '@/helper/providerIcon'
import { getProxyProtoLabel } from '@/helper/proxyProto'
import { getProviderHealth } from '@/helper/providerHealth'
import { showNotification } from '@/helper/notification'
import { agentToken, agentUrl } from '@/store/agent'
import {
  agentProviderByName,
  agentProvidersSslRefreshPending,
  agentProvidersSslRefreshing,
} from '@/store/providerHealth'
import { fetchProxyProvidersOnly, proxyProviederList } from '@/store/proxies'
import { proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings'
import { useStorage } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineOptions({ name: ROUTE_NAME.subscriptions })

type SelectionMode = 'all' | 'available' | 'custom'

const bundleName = useStorage('config/subscriptions-bundle-name-v1', 'Zash Aggregated')
const selectionMode = useStorage<SelectionMode>('config/subscriptions-selection-mode-v1', 'all')
const customProviderNames = useStorage<string[]>('config/subscriptions-custom-providers-v1', [])
const mihomoQrMode = useStorage<'url' | 'clash'>('config/subscriptions-mihomo-qr-mode-v1', 'url')
const universalQrMode = useStorage<'url' | 'v2rayng' | 'hiddify' | 'v2raytun'>(
  'config/subscriptions-universal-qr-mode-v1',
  'url',
)
const publishedBaseUrl = useStorage('config/subscriptions-published-base-v1', '')
const publicationSettingsOpen = ref(!!String(publishedBaseUrl.value || '').trim())
const busy = ref(false)
const providerQuickAvailableOnly = useStorage('config/subscriptions-provider-quick-available-only-v1', false)
const providerQuickProtoFilter = useStorage('config/subscriptions-provider-quick-proto-filter-v1', 'all')
const providerQuickCountryFilter = useStorage('config/subscriptions-provider-quick-country-filter-v1', 'all')

const COUNTRY_HINTS: Record<string, string> = {
  germany: 'DE', deutschland: 'DE', berlin: 'DE', frankfurt: 'DE',
  finland: 'FI', helsinki: 'FI', suomi: 'FI',
  sweden: 'SE', stockholm: 'SE', sverige: 'SE',
  netherlands: 'NL', holland: 'NL', amsterdam: 'NL',
  swiss: 'CH', switzerland: 'CH', zurich: 'CH',
  russia: 'RU', russian: 'RU', moscow: 'RU', moskva: 'RU', spb: 'RU',
  france: 'FR', paris: 'FR',
  poland: 'PL', warsaw: 'PL',
  czech: 'CZ', prague: 'CZ',
  austria: 'AT', vienna: 'AT',
  spain: 'ES', madrid: 'ES',
  italy: 'IT', milan: 'IT', rome: 'IT',
  norway: 'NO', oslo: 'NO',
  japan: 'JP', tokyo: 'JP',
  singapore: 'SG',
  hongkong: 'HK', 'hong kong': 'HK',
  turkey: 'TR', istanbul: 'TR',
  ukraine: 'UA', kyiv: 'UA', kiev: 'UA',
  britain: 'GB', england: 'GB', london: 'GB',
  usa: 'US', america: 'US', 'united states': 'US',
}
const COUNTRY_CODE_ALLOW = new Set(Object.values(COUNTRY_HINTS).concat(['DE', 'FI', 'SE', 'NL', 'CH', 'RU', 'FR', 'PL', 'CZ', 'AT', 'ES', 'IT', 'NO', 'JP', 'SG', 'HK', 'TR', 'UA', 'GB', 'US']))
const COUNTRY_CODE_STOP = new Set(['WG', 'SS', 'WS', 'TCP', 'UDP', 'TLS', 'MT', 'HY', 'VM', 'GR', 'IP', 'DNS', 'CDN'])

const inferCountryCode = (input: any): string => {
  const text = String(input || '').trim()
  if (!text) return ''
  const fromFlag = flagEmojiToCountryCode(text)
  if (fromFlag) return fromFlag
  const low = text.toLowerCase()
  for (const [needle, code] of Object.entries(COUNTRY_HINTS)) {
    if (low.includes(needle)) return code
  }
  const matches = text.match(/(?:^|[\s\[\](){}._\-])([A-Z]{2})(?=$|[\s\[\](){}._\-])/g) || []
  for (const raw of matches) {
    const code = raw.replace(/[^A-Z]/g, '')
    if (!code || COUNTRY_CODE_STOP.has(code)) continue
    if (COUNTRY_CODE_ALLOW.has(code)) return code
  }
  return ''
}

const summarizeProviderNodes = (provider: any) => {
  const protocolCounts: Record<string, number> = {}
  const countryCounts: Record<string, number> = {}
  const nodes = Array.isArray(provider?.proxies) ? provider.proxies : []
  for (const node of nodes) {
    const proto = getProxyProtoLabel((node as any)?.type || '')
    if (proto) protocolCounts[proto] = (protocolCounts[proto] || 0) + 1
    const country = inferCountryCode((node as any)?.name || (node as any)?.server || '')
    if (country) countryCounts[country] = (countryCounts[country] || 0) + 1
  }
  const topProtocols = Object.entries(protocolCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
    .slice(0, 4)
  const topCountries = Object.entries(countryCounts)
    .map(([code, count]) => ({ code, count, flag: countryCodeToFlagEmoji(code) }))
    .sort((a, b) => (b.count - a.count) || a.code.localeCompare(b.code))
    .slice(0, 4)
  return { protocolCounts, countryCounts, topProtocols, topCountries }
}

const providers = computed(() => (proxyProviederList.value || []).filter((p: any) => Array.isArray((p as any)?.proxies) && String(p?.name || '') !== 'default'))
const providerNames = computed(() => providers.value.map((p: any) => String(p.name || '')).filter(Boolean))

const providerWarnDays = (providerName: string) => {
  const key = String(providerName || '').trim()
  const override = Number((proxyProviderSslWarnDaysMap.value || {})[key])
  if (Number.isFinite(override)) return Math.max(0, Math.min(365, Math.trunc(override)))
  const base = Number(sslNearExpiryDaysDefault.value)
  return Number.isFinite(base) ? Math.max(0, Math.min(365, Math.trunc(base))) : 2
}

const providerMetaList = computed(() => {
  return providers.value.map((provider: any) => {
    const health = getProviderHealth(provider, agentProviderByName.value?.[provider.name], {
      nearExpiryDays: providerWarnDays(String(provider?.name || '')),
      sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
    })
    const nodeCount = Array.isArray(provider?.proxies) ? provider.proxies.length : 0
    const available = nodeCount > 0 && health.status !== 'offline'
    const summary = summarizeProviderNodes(provider)
    return {
      provider,
      name: String(provider?.name || ''),
      nodeCount,
      available,
      health,
      protocolCounts: summary.protocolCounts,
      countryCounts: summary.countryCounts,
      topProtocols: summary.topProtocols,
      topCountries: summary.topCountries,
    }
  })
})

const providerProtoOptions = computed(() => {
  const set = new Set<string>()
  for (const provider of providerMetaList.value) {
    for (const key of Object.keys(provider.protocolCounts || {})) if (key) set.add(key)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const providerCountryOptions = computed(() => {
  const set = new Set<string>()
  for (const provider of providerMetaList.value) {
    for (const key of Object.keys(provider.countryCounts || {})) if (key) set.add(key)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const inventoryProviders = computed(() => {
  const protoRaw = String(providerQuickProtoFilter.value || 'all').trim()
  const countryRaw = String(providerQuickCountryFilter.value || 'all').trim().toUpperCase()
  const proto = protoRaw !== 'all' && providerProtoOptions.value.includes(protoRaw) ? protoRaw : 'all'
  const country = countryRaw !== 'all' && providerCountryOptions.value.includes(countryRaw) ? countryRaw : 'all'
  return providerMetaList.value.filter((provider) => {
    if (providerQuickAvailableOnly.value && !provider.available) return false
    if (proto !== 'all' && !provider.protocolCounts?.[proto]) return false
    if (country !== 'all' && !provider.countryCounts?.[country]) return false
    return true
  })
})

const availableProviderNames = computed(() => providerMetaList.value.filter((provider) => provider.available).map((provider) => provider.name))

const selectedProviderNames = computed(() => {
  if (selectionMode.value === 'custom') {
    const wanted = new Set(customProviderNames.value || [])
    return providerNames.value.filter((name) => wanted.has(name))
  }
  if (selectionMode.value === 'available') {
    return availableProviderNames.value.length ? availableProviderNames.value : providerNames.value
  }
  return providerNames.value
})

const selectedProvidersMeta = computed(() => {
  const wanted = new Set(selectedProviderNames.value)
  return providerMetaList.value.filter((provider) => wanted.has(provider.name))
})

const agentBase = computed(() => String(agentUrl.value || '').trim().replace(/\/+$/g, ''))
const agentReady = computed(() => !!agentBase.value)
const safeBundleName = computed(() => String(bundleName.value || '').trim() || 'Zash Aggregated')
const noProvidersSelected = computed(() => selectionMode.value === 'custom' && selectedProviderNames.value.length === 0)

const normalizeSubscriptionBase = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withProto)
    url.hash = ''
    url.search = ''
    url.pathname = url.pathname.replace(/\/+$/g, '')
    return url.toString().replace(/\/+$/g, '')
  } catch {
    return raw.replace(/\/+$/g, '')
  }
}

const buildSubscriptionUrlFromBase = (base: string, format: 'mihomo' | 'b64' | 'plain' | 'v2raytun' | 'json') => {
  const normalizedBase = normalizeSubscriptionBase(base)
  if (!normalizedBase || noProvidersSelected.value) return ''
  const params = new URLSearchParams({
    cmd: 'subscription',
    format,
    name: safeBundleName.value,
  })
  const token = String(agentToken.value || '').trim()
  if (token) params.set('token', token)
  if (selectedProviderNames.value.length && selectedProviderNames.value.length !== providerNames.value.length) {
    params.set('providers', selectedProviderNames.value.join(','))
  }
  return `${normalizedBase}/cgi-bin/api.sh?${params.toString()}`
}

const buildSubscriptionUrl = (format: 'mihomo' | 'b64' | 'plain' | 'v2raytun' | 'json') => buildSubscriptionUrlFromBase(agentBase.value, format)

const mihomoUrl = computed(() => buildSubscriptionUrl('mihomo'))
const universalUrl = computed(() => buildSubscriptionUrl('b64'))
const jsonUrl = computed(() => buildSubscriptionUrl('json'))
const v2rayTunUrl = computed(() => buildSubscriptionUrl('v2raytun'))
const publishedBaseUrlNormalized = computed(() => normalizeSubscriptionBase(publishedBaseUrl.value))
const publishedBaseUrlLooksHttps = computed(() => /^https:\/\//i.test(publishedBaseUrlNormalized.value))
const publishedHttpsReady = computed(() => !!publishedBaseUrlNormalized.value && publishedBaseUrlLooksHttps.value)
const publishedMihomoUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'mihomo'))
const publishedUniversalUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'b64'))
const publishedJsonUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'json'))
const publishedV2rayTunUrl = computed(() => buildSubscriptionUrlFromBase(publishedBaseUrlNormalized.value, 'v2raytun'))
const effectiveMihomoUrl = computed(() => publishedMihomoUrl.value || mihomoUrl.value)
const effectiveUniversalUrl = computed(() => publishedUniversalUrl.value || universalUrl.value)
const effectiveJsonUrl = computed(() => publishedJsonUrl.value || jsonUrl.value)
const effectiveV2rayTunUrl = computed(() => publishedV2rayTunUrl.value || v2rayTunUrl.value)
const effectiveMihomoUsesPublished = computed(() => !!publishedMihomoUrl.value)
const effectiveUniversalUsesPublished = computed(() => !!publishedUniversalUrl.value)
const effectiveJsonUsesPublished = computed(() => !!publishedJsonUrl.value)
const effectiveV2rayTunUsesPublished = computed(() => !!publishedV2rayTunUrl.value)
const encodedMihomoUrl = computed(() => (effectiveMihomoUrl.value ? encodeURIComponent(effectiveMihomoUrl.value) : ''))
const clashDeepLink = computed(() => (encodedMihomoUrl.value ? `clash://install-config?url=${encodedMihomoUrl.value}` : ''))
const encodedUniversalUrl = computed(() => (effectiveUniversalUrl.value ? encodeURIComponent(effectiveUniversalUrl.value) : ''))
const encodedBundleName = computed(() => encodeURIComponent(safeBundleName.value))

const v2rayNgDeepLink = computed(() => (
  encodedUniversalUrl.value
    ? `v2rayng://install-config?url=${encodedUniversalUrl.value}&name=${encodedBundleName.value}`
    : ''
))
const hiddifyDeepLink = computed(() => (
  encodedUniversalUrl.value
    ? `hiddify://import/${encodedUniversalUrl.value}#${encodedBundleName.value}`
    : ''
))
const v2rayTunDeepLink = computed(() => (
  effectiveV2rayTunUrl.value
    ? `v2raytun://import/${effectiveV2rayTunUrl.value}`
    : ''
))

const mihomoQrText = computed(() => (mihomoQrMode.value === 'clash' ? clashDeepLink.value : effectiveMihomoUrl.value))
const universalQrText = computed(() => {
  switch (universalQrMode.value) {
    case 'v2rayng':
      return v2rayNgDeepLink.value
    case 'hiddify':
      return hiddifyDeepLink.value
    case 'v2raytun':
      return v2rayTunDeepLink.value
    default:
      return effectiveUniversalUrl.value
  }
})

const countryOptionLabel = (code: string) => {
  const cc = String(code || '').trim().toUpperCase()
  if (!cc) return cc
  const flag = countryCodeToFlagEmoji(cc)
  return flag ? `${flag} ${cc}` : cc
}

const providerChipClass = (provider: { name: string; available: boolean; health: { status: string } }) => {
  const selected = selectedProviderNames.value.includes(provider.name)
  return [
    selected ? 'border-primary/45 bg-primary/10 text-base-content' : 'border-base-300 bg-base-100 hover:border-base-content/20',
    !provider.available && !selected ? 'opacity-80' : '',
    provider.health.status === 'offline' && !selected ? 'border-error/30' : '',
  ]
}

const handleProviderChipClick = (name: string) => {
  if (!name) return
  if (selectionMode.value !== 'custom') {
    selectionMode.value = 'custom'
    customProviderNames.value = [...selectedProviderNames.value]
  }
  const next = new Set(customProviderNames.value || [])
  if (next.has(name)) next.delete(name)
  else next.add(name)
  customProviderNames.value = providerNames.value.filter((providerName) => next.has(providerName))
}

const togglePublicationSettings = () => {
  publicationSettingsOpen.value = !publicationSettingsOpen.value
}

const clearPublishedBase = () => {
  publishedBaseUrl.value = ''
}

const copyText = async (value: string) => {
  if (!value) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      throw new Error('clipboard-unavailable')
    }
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = value
    textArea.setAttribute('readonly', 'readonly')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      const ok = document.execCommand('copy')
      if (!ok) throw new Error('execCommand-copy-failed')
      showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
    } catch {
      showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 })
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

const refreshProviders = async () => {
  if (busy.value) return
  busy.value = true
  try {
    await fetchProxyProvidersOnly()
  } finally {
    busy.value = false
  }
}

const selectAllProviders = () => {
  customProviderNames.value = [...providerNames.value]
}

const selectAvailableProviders = () => {
  customProviderNames.value = [...availableProviderNames.value]
}

const clearSelectedProviders = () => {
  customProviderNames.value = []
}

onMounted(() => {
  if (!['url', 'v2rayng', 'hiddify', 'v2raytun'].includes(String(universalQrMode.value || ''))) universalQrMode.value = 'url'
  if (!providerNames.value.length) {
    fetchProxyProvidersOnly()
  }
})
</script>
