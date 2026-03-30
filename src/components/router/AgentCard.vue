<template>
  <div class="card gap-2 p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <div class="font-semibold">{{ $t('routerAgent') }}</div>
        <span v-if="!agentEnabled" class="badge badge-ghost">{{ $t('disabled') }}</span>
        <span v-else class="badge" :class="status.ok ? 'badge-success' : 'badge-error'">
          {{ status.ok ? $t('online') : $t('offline') }}
        </span>
        <span v-if="agentEnabled && status.ok && status.tc" class="badge badge-success">tc</span>
        <span v-if="agentEnabled && status.ok && !status.tc" class="badge badge-warning">no-tc</span>
        <span v-if="agentEnabled && status.version" class="badge badge-ghost font-mono">{{ $t('agentVersion') }}: {{ status.version }}</span>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="refresh">{{ $t('test') }}</button>
        <label v-if="configuredCloudRemotes.length" class="flex items-center gap-2 text-xs opacity-80">
          <span>{{ $t('agentBackupTargets') }}</span>
          <select
            v-model="backupTargetRemote"
            class="select select-sm min-w-[180px]"
            :disabled="!agentEnabled || !status.ok || backupLoading || backup.running"
          >
            <option value="">{{ $t('agentBackupTargetAll') }}</option>
            <option v-for="remote in readyCloudRemotes" :key="`backup-target-${remote}`" :value="remote">{{ remote }}</option>
          </select>
        </label>
        <button
          type="button"
          class="btn btn-sm btn-outline"
          @click="runBackup"
          :disabled="!agentEnabled || !status.ok || backupLoading || backup.running"
          :title="backupTargetLabel ? `${$t('agentBackupNow')} · ${backupTargetLabel}` : $t('agentBackupNow')"
        >
          <span v-if="backupLoading || backup.running" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ backupTargetLabel ? `${$t('agentBackupNow')} · ${backupTargetLabel}` : $t('agentBackupNow') }}</span>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label class="flex items-center justify-between gap-2">
        <span class="text-sm">{{ $t('enable') }}</span>
        <input type="checkbox" class="toggle" v-model="agentEnabled" />
      </label>

      <label class="flex items-center justify-between gap-2">
        <span class="text-sm">{{ $t('enforceBandwidth') }}</span>
        <input type="checkbox" class="toggle" v-model="agentEnforceBandwidth" :disabled="!agentEnabled" />
      </label>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label class="flex flex-col gap-1">
        <span class="text-sm opacity-70">{{ $t('agentUrl') }}</span>
        <input class="input input-sm" v-model="agentUrl" placeholder="http://192.168.1.1:9099" :disabled="!agentEnabled" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm opacity-70">{{ $t('agentToken') }}</span>
        <input class="input input-sm" v-model="agentToken" placeholder="(optional)" :disabled="!agentEnabled" />
      </label>
    </div>

        <div class="text-xs opacity-70">
      <div v-if="agentEnabled && status.ok">
        {{ $t('agentDetected') }}: {{ status.lan || 'br0' }} → {{ status.wan || 'eth4' }}
        <div v-if="status.version || status.serverVersion" class="mt-0.5 flex flex-wrap items-center gap-2">
          <span v-if="status.version" class="font-mono">v{{ status.version }}</span>
          <span v-if="status.serverVersion" class="opacity-60">
            latest <span class="font-mono">{{ status.serverVersion }}</span>
          </span>
          <span v-if="needsUpdate" class="badge badge-warning badge-sm">{{ $t('agentUpdate') }}</span>
          <span v-else-if="isAhead" class="badge badge-info badge-sm">{{ $t('agentAhead') }}</span>
        </div>

        <div class="mt-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="opacity-60">{{ $t('agentBackupLast') }}:</span>
            <span v-if="backup.running" class="badge badge-info badge-sm">{{ $t('agentBackupRunning') }}</span>
            <span v-else-if="backup.success" class="badge badge-success badge-sm">{{ $t('agentBackupOk') }}</span>
            <span v-else-if="backup.finishedAt || backup.startedAt" class="badge badge-warning badge-sm">{{ $t('agentBackupFail') }}</span>
            <span v-if="backup.finishedAt || backup.startedAt" class="font-mono">{{ backup.finishedAt || backup.startedAt }}</span>
            <span v-if="backup.file" class="opacity-60 font-mono">{{ backup.file }}</span>
            <span v-if="backup.requestedRemotes" class="badge badge-ghost badge-sm">{{ $t('agentBackupTargets') }}: {{ backup.requestedRemotes }}</span>
            <button type="button" class="btn btn-ghost btn-xs" @click="refreshBackup" :disabled="backupLoading">↻</button>
          </div>
          <details class="mt-1" @toggle="onBackupLogToggle">
            <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentBackupViewLog') }}</summary>
            <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200/60 p-2 text-[11px]">{{ backupLog || '…' }}</pre>
          </details>

          <div class="mt-2 rounded-lg bg-base-200/70 p-2 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="opacity-60">{{ $t('agentBackupCloud') }}:</span>
              <span v-if="cloudStatus.cloudReady" class="badge badge-success badge-sm">{{ $t('agentBackupCloudReady') }}</span>
              <span v-else-if="cloudStatus.rcloneInstalled && configuredCloudRemotes.length && !cloudStatus.cloudReady" class="badge badge-warning badge-sm">{{ $t('agentBackupCloudMissingRemote') }}</span>
              <span v-else-if="!cloudStatus.rcloneInstalled" class="badge badge-warning badge-sm">{{ $t('agentBackupCloudMissingRclone') }}</span>
              <span v-else class="badge badge-ghost badge-sm">{{ $t('agentBackupCloudNotReady') }}</span>
              <button type="button" class="btn btn-ghost btn-xs" @click="refreshCloud" :disabled="cloudLoading">↻</button>
            </div>
            <div class="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              <div>
                <span class="opacity-60">{{ $t('agentBackupCloudRemote') }}:</span>
                <span class="font-mono">{{ cloudRemoteLabel }}</span>
              </div>
              <div>
                <span class="opacity-60">{{ $t('agentBackupCloudKeep') }}:</span>
                <span class="font-mono">{{ cloudKeepLabel }}</span>
              </div>
              <div class="sm:col-span-2" v-if="configuredCloudRemotes.length">
                <span class="opacity-60">{{ $t('agentBackupCloudRemote') }}:</span>
                <div class="mt-1 flex flex-wrap items-center gap-1">
                  <span v-for="it in configuredCloudRemotes" :key="it.name" class="badge badge-sm" :class="it.exists ? 'badge-success' : 'badge-warning'">{{ it.name }}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div
                    v-for="it in configuredCloudRemotes"
                    :key="`status-${it.name}`"
                    class="rounded-lg border border-base-300/50 bg-base-100/60 px-2 py-1.5"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span class="font-mono text-[11px] sm:text-xs">{{ it.name }}</span>
                      <span class="badge badge-xs" :class="remoteStatusBadgeClass(it.name)">
                        {{ it.exists ? $t('agentBackupCloudReady') : $t('agentBackupCloudMissingRemote') }}
                      </span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                      <span>{{ $t('agentBackupCloudCount') }}: {{ remoteArchiveCount(it.name) }}</span>
                      <span v-if="restoreSource === 'cloud' && restoreCloudRemote === it.name" class="badge badge-info badge-xs">restore</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sm:col-span-2" v-if="lastBackupUploadResults.length">
                <span class="opacity-60">{{ $t('agentBackupCloudLastUpload') }}:</span>
                <div class="mt-1 flex flex-wrap items-center gap-1">
                  <span class="badge badge-sm badge-success" v-if="backupUploadOkCount > 0">OK: {{ backupUploadOkCount }}</span>
                  <span class="badge badge-sm badge-error" v-if="backupUploadFailCount > 0">ERR: {{ backupUploadFailCount }}</span>
                  <template v-for="it in lastBackupUploadResults" :key="`upload-${it.remote}`">
                    <span
                      class="badge badge-sm"
                      :class="uploadStatusBadgeClass(it.ok)"
                      :title="it.error || ''"
                    >
                      {{ it.remote }} · {{ it.ok ? $t('agentBackupRemoteOk') : $t('agentBackupRemoteFail') }}
                    </span>
                    <span v-if="!it.ok && it.error" class="w-full break-all text-[11px] text-error">{{ it.remote }}: {{ it.error }}</span>
                  </template>
                </div>
              </div>
              <div class="sm:col-span-2" v-if="cloudStatus.configPath">
                <span class="opacity-60">{{ $t('agentBackupCloudConfig') }}:</span>
                <span class="font-mono break-all">{{ cloudStatus.configPath }}</span>
              </div>
            </div>
          </div>


          <details class="mt-2" @toggle="onUnifiedHistoryToggle">
            <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentBackupUnifiedHistory') }}</summary>
            <div class="mt-2 rounded-lg bg-base-200/60 p-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="opacity-60">{{ $t('agentBackupCount') }}:</span>
                <span class="font-mono">{{ unifiedArchives.length }}</span>
                <span class="opacity-60">{{ $t('agentRestoreSourceLocal') }}:</span>
                <span class="font-mono">{{ backupList.length }}</span>
                <span class="opacity-60">{{ $t('agentRestoreSourceCloud') }}:</span>
                <span class="font-mono">{{ cloudList.length }}</span>
                <button type="button" class="btn btn-ghost btn-xs" @click="refreshUnifiedArchives" :disabled="backupListLoading || cloudLoading || cloudListLoading">↻</button>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" class="btn btn-xs" :class="backupArchiveView === 'all' ? '' : 'btn-outline'" @click="backupArchiveView = 'all'">{{ $t('all') }}</button>
                <button type="button" class="btn btn-xs" :class="backupArchiveView === 'current' ? '' : 'btn-outline'" @click="backupArchiveView = 'current'">{{ $t('agentBackupFilterCurrent') }}</button>
                <button type="button" class="btn btn-xs" :class="backupArchiveView === 'local' ? '' : 'btn-outline'" @click="backupArchiveView = 'local'">{{ $t('agentBackupFilterLocalOnly') }}</button>
                <button type="button" class="btn btn-xs" :class="backupArchiveView === 'cloud' ? '' : 'btn-outline'" @click="backupArchiveView = 'cloud'">{{ $t('agentBackupFilterCloudOnly') }}</button>
                <button type="button" class="btn btn-xs" :class="backupArchiveView === 'both' ? '' : 'btn-outline'" @click="backupArchiveView = 'both'">{{ $t('agentBackupFilterBoth') }}</button>
              </div>

              <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <label class="flex min-w-0 flex-col gap-1">
                  <span class="text-[11px] opacity-60">{{ $t('search') }}</span>
                  <input
                    v-model.trim="backupArchiveQuery"
                    class="input input-xs w-full"
                    :placeholder="$t('agentBackupSearchPlaceholder')"
                  />
                </label>

                <label class="flex flex-col gap-1">
                  <span class="text-[11px] opacity-60">{{ $t('sortBy') }}</span>
                  <select v-model="backupArchiveSort" class="select select-xs w-full">
                    <option value="timeDesc">{{ $t('agentBackupSortNewest') }}</option>
                    <option value="timeAsc">{{ $t('agentBackupSortOldest') }}</option>
                    <option value="sizeDesc">{{ $t('agentBackupSortLargest') }}</option>
                    <option value="sizeAsc">{{ $t('agentBackupSortSmallest') }}</option>
                    <option value="nameAsc">{{ $t('agentBackupSortNameAsc') }}</option>
                    <option value="nameDesc">{{ $t('agentBackupSortNameDesc') }}</option>
                  </select>
                </label>
              </div>

              <div class="mt-2 text-[11px] opacity-60">
                {{ $t('agentBackupShownCount', { shown: filteredUnifiedArchives.length, total: unifiedArchives.length }) }}
              </div>

              <div v-if="filteredUnifiedArchives.length" class="mt-2 max-h-72 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70">
                <div
                  v-for="item in filteredUnifiedArchives"
                  :key="item.name"
                  class="flex flex-col gap-2 border-b border-base-300/50 px-3 py-2 last:border-b-0"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate font-mono text-[11px] sm:text-xs">{{ item.name }}</span>
                      <span v-if="isCurrentBackup(item.name)" class="badge badge-info badge-sm">{{ $t('agentBackupCurrent') }}</span>
                      <span v-if="item.hasLocal && item.hasCloud" class="badge badge-success badge-sm">{{ $t('agentBackupBothLocations') }}</span>
                      <span v-else class="badge badge-ghost badge-sm">{{ item.hasLocal ? $t('agentRestoreSourceLocal') : $t('agentRestoreSourceCloud') }}</span>
                    </div>

                    <div class="mt-1 flex flex-wrap items-center gap-3 opacity-70">
                      <span>{{ formatBackupSize(item.displaySize) }}</span>
                      <span class="font-mono">{{ item.displayTime }}</span>
                    </div>

                    <div v-if="item.hasLocal && item.hasCloud" class="mt-1 flex flex-wrap items-center gap-3 text-[11px] opacity-60">
                      <span>{{ $t('agentRestoreSourceLocal') }}: <span class="font-mono">{{ formatBackupTime(item.local?.mtime) }}</span></span>
                      <span>{{ $t('agentRestoreSourceCloud') }}: <span class="font-mono">{{ formatCloudTime(preferredCloudCopy(item)?.ModTime) }}</span></span>
                    </div>
                    <div v-if="item.hasCloud" class="mt-1 flex flex-wrap items-center gap-1 text-[11px] opacity-80">
                      <span class="opacity-60">Remote:</span>
                      <span
                        v-for="remote in uniqueRemoteNames(item)"
                        :key="remote"
                        class="badge badge-sm"
                        :class="remoteStatusBadgeClass(remote)"
                      >
                        {{ remote }}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="selectUnifiedArchiveForRestore(item)"
                      :disabled="!agentEnabled || !status.ok"
                    >
                      {{ $t('agentBackupUseForRestore') }}
                    </button>

                    <button
                      v-if="item.hasLocal"
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="selectBackupForRestore(item.name)"
                      :disabled="!agentEnabled || !status.ok"
                      :title="$t('agentRestoreSourceLocal')"
                    >
                      {{ $t('agentRestoreSourceLocal') }}
                    </button>

                    <template v-if="item.hasCloud">
                      <button
                        v-for="remote in uniqueRemoteNames(item)"
                        :key="`restore-${item.name}-${remote}`"
                        type="button"
                        class="btn btn-ghost btn-xs"
                        @click="selectCloudBackupForRestore(item.name, remote)"
                        :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady"
                        :title="`${$t('agentRestoreSourceCloud')}: ${remote}`"
                      >
                        {{ $t('agentRestoreSourceCloud') }} · {{ remote }}
                      </button>
                    </template>

                    <button
                      v-if="item.hasLocal"
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteLocalBackup(item.name)"
                      :disabled="!agentEnabled || !status.ok || !!backup.running || !!restore.running || deletingLocalBackup === item.name"
                    >
                      <span v-if="deletingLocalBackup === item.name" class="loading loading-spinner loading-xs"></span>
                      <span v-else>{{ $t('delete') }} {{ $t('agentRestoreSourceLocal') }}</span>
                    </button>

                    <template v-if="item.hasCloud && !item.hasLocal">
                      <button
                        v-for="remote in uniqueRemoteNames(item)"
                        :key="`download-${item.name}-${remote}`"
                        type="button"
                        class="btn btn-ghost btn-xs"
                        @click="downloadCloudBackupToLocal(item.name, remote)"
                        :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady || !!backup.running || !!restore.running || downloadingCloudBackup === `${remote}::${item.name}`"
                      >
                        <span v-if="downloadingCloudBackup === `${remote}::${item.name}`" class="loading loading-spinner loading-xs"></span>
                        <span v-else>{{ $t('agentBackupDownloadToLocal') }} · {{ remote }}</span>
                      </button>
                    </template>

                    <template v-if="item.hasCloud">
                      <button
                        v-for="remote in uniqueRemoteNames(item)"
                        :key="`delete-cloud-${item.name}-${remote}`"
                        type="button"
                        class="btn btn-ghost btn-xs text-error"
                        @click="deleteCloudBackup(item.name, remote)"
                        :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady || !!backup.running || !!restore.running || deletingCloudBackup === `${remote}::${item.name}`"
                      >
                        <span v-if="deletingCloudBackup === `${remote}::${item.name}`" class="loading loading-spinner loading-xs"></span>
                        <span v-else>{{ $t('delete') }} {{ remote }}</span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>

              <div v-else class="mt-2 opacity-70">{{ $t('agentBackupNoItems') }}</div>
            </div>
          </details>

          <details class="mt-2" @toggle="onBackupHistoryToggle">
            <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentBackupHistory') }}</summary>
            <div class="mt-2 rounded-lg bg-base-200/60 p-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="opacity-60">{{ $t('agentBackupCount') }}:</span>
                <span class="font-mono">{{ backupList.length }}</span>
                <span class="opacity-60">{{ $t('agentBackupFolder') }}:</span>
                <span class="font-mono break-all">{{ backupDir || '—' }}</span>
                <button type="button" class="btn btn-ghost btn-xs" @click="refreshBackupList" :disabled="backupListLoading">↻</button>
              </div>

              <div v-if="backupList.length" class="mt-2 max-h-56 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70">
                <div
                  v-for="item in backupList"
                  :key="item.name"
                  class="flex flex-col gap-1 border-b border-base-300/50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate font-mono text-[11px] sm:text-xs">{{ item.name }}</span>
                      <span v-if="isCurrentBackup(item.name)" class="badge badge-info badge-sm">{{ $t('agentBackupCurrent') }}</span>
                      <span v-if="isUploadedBackup(item.name)" class="badge badge-success badge-sm">{{ $t('agentBackupUploaded') }}</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-3 opacity-70">
                      <span>{{ formatBackupSize(item.size) }}</span>
                      <span class="font-mono">{{ formatBackupTime(item.mtime) }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="selectBackupForRestore(item.name)"
                      :disabled="!agentEnabled || !status.ok"
                    >
                      {{ $t('agentBackupUseForRestore') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteLocalBackup(item.name)"
                      :disabled="!agentEnabled || !status.ok || !!backup.running || !!restore.running || deletingLocalBackup === item.name"
                    >
                      <span v-if="deletingLocalBackup === item.name" class="loading loading-spinner loading-xs"></span>
                      <span v-else>{{ $t('delete') }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="mt-2 opacity-70">{{ $t('agentBackupNoItems') }}</div>
            </div>

          </details>

          <details class="mt-2" @toggle="onCloudHistoryToggle">
            <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentBackupCloudHistory') }}</summary>
            <div class="mt-2 rounded-lg bg-base-200/60 p-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="opacity-60">{{ $t('agentBackupCloudCount') }}:</span>
                <span class="font-mono">{{ cloudList.length }}</span>
                <span class="opacity-60">{{ $t('agentBackupCloudRemote') }}:</span>
                <span class="font-mono break-all">{{ cloudRemoteLabel }}</span>
                <button type="button" class="btn btn-ghost btn-xs" @click="refreshCloudHistory" :disabled="cloudListLoading">↻</button>
              </div>

              <div v-if="cloudList.length" class="mt-2 max-h-56 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70">
                <div
                  v-for="item in cloudList"
                  :key="cloudItemKey(item)"
                  class="flex flex-col gap-1 border-b border-base-300/50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate font-mono text-[11px] sm:text-xs">{{ item.Name || item.Path || '—' }}</span>
                      <span v-if="isCurrentBackup(item.Name || item.Path || '')" class="badge badge-info badge-sm">{{ $t('agentBackupCurrent') }}</span>
                      <span v-if="hasLocalBackup(item.Name || item.Path || '')" class="badge badge-success badge-sm">{{ $t('agentBackupCloudAlsoLocal') }}</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-3 opacity-70">
                      <span>{{ formatBackupSize(item.Size) }}</span>
                      <span class="font-mono">{{ formatCloudTime(item.ModTime) }}</span>
                      <span class="badge badge-ghost badge-sm">{{ cloudItemRemote(item) || 'cloud' }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="selectCloudBackupForRestore(item.Name || item.Path || '', cloudItemRemote(item))"
                      :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady"
                    >
                      {{ $t('agentBackupUseForRestore') }}
                    </button>
                    <button
                      v-if="!hasLocalBackup(item.Name || item.Path || '')"
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="downloadCloudBackupToLocal(item.Name || item.Path || '', cloudItemRemote(item))"
                      :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady || !!backup.running || !!restore.running || downloadingCloudBackup === `${cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`"
                    >
                      <span v-if="downloadingCloudBackup === `${cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`" class="loading loading-spinner loading-xs"></span>
                      <span v-else>{{ $t('agentBackupDownloadToLocal') }}</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteCloudBackup(item.Name || item.Path || '', cloudItemRemote(item))"
                      :disabled="!agentEnabled || !status.ok || !cloudStatus.cloudReady || !!backup.running || !!restore.running || deletingCloudBackup === `${cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`"
                    >
                      <span v-if="deletingCloudBackup === `${cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`" class="loading loading-spinner loading-xs"></span>
                      <span v-else>{{ $t('delete') }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="mt-2 opacity-70">{{ cloudStatus.cloudReady ? $t('agentBackupCloudNoItems') : $t('agentBackupCloudNotReady') }}</div>
            </div>
          </details>

          <details class="mt-2" @toggle="onCronToggle">
            <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentBackupSchedule') }}</summary>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label class="flex items-center justify-between gap-2">
                <span class="text-xs opacity-80">{{ $t('agentBackupAuto') }}</span>
                <input type="checkbox" class="toggle toggle-sm" v-model="backupAutoEnabled" :disabled="!agentEnabled || !status.ok" />
              </label>
              <label class="flex items-center justify-between gap-2">
                <span class="text-xs opacity-80">{{ $t('agentBackupTime') }}</span>
                <input type="time" class="input input-sm w-28" v-model="backupAutoTime" :disabled="!agentEnabled || !status.ok" />
              </label>
            </div>

            <div class="mt-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="opacity-60">{{ $t('agentBackupCron') }}:</span>
                <span class="font-mono">{{ cronSchedule }}</span>
                <button type="button" class="btn btn-ghost btn-xs" @click="copyCron" :disabled="!cronLine">{{ $t('copy') }}</button>
              </div>
              <div class="mt-1 font-mono rounded-lg bg-base-200/60 p-2 text-[11px] break-all">{{ cronLine }}</div>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" class="btn btn-xs" @click="applyCron" :disabled="!agentEnabled || !status.ok || cronApplying">
                  <span v-if="cronApplying" class="loading loading-spinner loading-xs"></span>
                  <span v-else>{{ $t('apply') }}</span>
                </button>
                <button type="button" class="btn btn-xs btn-outline" @click="removeCron" :disabled="!agentEnabled || !status.ok || cronApplying">{{ $t('delete') }}</button>
                <button type="button" class="btn btn-xs btn-outline" @click="runBackup" :disabled="!agentEnabled || !status.ok || backupLoading || backup.running || cronApplying">
                  <span v-if="backupLoading || backup.running" class="loading loading-spinner loading-xs"></span>
                  <span v-else>{{ $t('agentBackupNow') }}</span>
                </button>
                <button type="button" class="btn btn-ghost btn-xs" @click="refreshCron" :disabled="cronApplying">↻</button>

                <span class="opacity-60">{{ $t('agentBackupCronOnRouter') }}:</span>
                <span class="badge badge-sm" :class="cronStateBadgeClass">{{ cronStateBadgeText }}</span>
                <span v-if="cronStatus.ok && cronStatus.schedule" class="font-mono opacity-70">{{ cronStatus.schedule }}</span>
                <span v-else-if="cronStatus.error" class="text-warning break-all">{{ cronStatus.error }}</span>
              </div>
              <div v-if="cronStatus.path || cronStatus.line" class="mt-1 flex flex-col gap-1 text-[11px] opacity-70">
                <div v-if="cronStatus.path">
                  <span class="opacity-60">Path:</span>
                  <span class="font-mono break-all">{{ cronStatus.path }}</span>
                </div>
                <div v-if="cronStatus.line">
                  <span class="opacity-60">Line:</span>
                  <span class="font-mono break-all">{{ cronStatus.line }}</span>
                </div>
              </div>
            </div>


          </details>

          <details class="mt-2" @toggle="onRestoreToggle">
  <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentRestore') }}</summary>

  <div class="mt-2">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="opacity-60">{{ $t('agentRestoreLast') }}:</span>
      <span v-if="restore.running" class="badge badge-info badge-sm">{{ $t('agentRestoreRunning') }}</span>
      <span v-else-if="restore.success" class="badge badge-success badge-sm">{{ $t('agentRestoreOk') }}</span>
      <span v-else-if="restore.finishedAt || restore.startedAt" class="badge badge-warning badge-sm">{{ $t('agentRestoreFail') }}</span>
      <span v-if="restore.finishedAt || restore.startedAt" class="font-mono">{{ restore.finishedAt || restore.startedAt }}</span>
      <span v-if="restore.source" class="badge badge-ghost badge-sm">{{ restore.source === 'cloud' ? $t('agentRestoreSourceCloud') : $t('agentRestoreSourceLocal') }}</span>
      <span v-if="restore.file" class="opacity-60 font-mono">{{ restore.file }}</span>
      <button type="button" class="btn btn-ghost btn-xs" @click="refreshRestore" :disabled="restoreLoading">↻</button>
    </div>

    <div v-if="restore.running || restore.stage || restore.detail" class="mt-2 rounded-lg border border-base-300/60 bg-base-200/40 p-2 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="opacity-70">{{ $t('agentRestoreStage') }}:</span>
          <span class="font-medium">{{ restoreStageLabel }}</span>
        </div>
        <span v-if="restoreProgressPct !== null" class="font-mono">{{ restoreProgressPct }}%</span>
      </div>
      <progress v-if="restoreProgressPct !== null" class="progress progress-info mt-2 w-full" :value="restoreProgressPct" max="100"></progress>
      <div class="mt-1 flex flex-wrap items-center justify-between gap-2 opacity-80">
        <span>{{ restore.detail || ' ' }}</span>
        <span v-if="restoreBytesLabel" class="font-mono">{{ restoreBytesLabel }}</span>
      </div>
    </div>

    <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs opacity-80">{{ $t('agentRestoreSource') }}</span>
        <select class="select select-sm" v-model="restoreSource" :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running">
          <option value="local">{{ $t('agentRestoreSourceLocal') }}</option>
          <option value="cloud" :disabled="!cloudStatus.cloudReady">{{ $t('agentRestoreSourceCloud') }}</option>
        </select>
      </label>

      <label v-if="restoreSource === 'cloud' && readyCloudRemotes.length > 1" class="flex flex-col gap-1">
        <span class="text-xs opacity-80">{{ $t('agentBackupCloudRemote') }}</span>
        <select class="select select-sm" v-model="restoreCloudRemote" :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running">
          <option value="">{{ $t('agentRestoreCloudRemoteAuto') }}</option>
          <option v-for="remote in readyCloudRemotes" :key="remote" :value="remote">{{ remote }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs opacity-80">{{ $t('agentRestoreFrom') }}</span>
        <select class="select select-sm" v-model="restoreSelected" :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running">
          <option value="latest">{{ $t('agentBackupLatest') }}</option>
          <option v-for="b in restoreItems" :key="b" :value="b">{{ b }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs opacity-80">{{ $t('agentRestoreScope') }}</span>
        <select class="select select-sm" v-model="restoreScope" :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running">
          <option value="all">{{ $t('agentRestoreScopeAll') }}</option>
          <option value="mihomo">{{ $t('agentRestoreScopeMihomo') }}</option>
          <option value="agent">{{ $t('agentRestoreScopeAgent') }}</option>
        </select>
      </label>
    </div>

    <div v-if="restoreSource === 'cloud'" class="mt-2 rounded-lg border border-base-300/60 bg-base-200/30 p-2 text-xs">
      <div class="flex flex-wrap items-center gap-2">
        <span class="opacity-60">{{ $t('agentBackupCloudRemote') }}:</span>
        <span
          v-for="remote in readyCloudRemotes"
          :key="`ready-remote-${remote}`"
          class="badge badge-sm"
          :class="restoreCloudRemote === remote ? 'badge-info' : 'badge-ghost'"
        >
          {{ remote }}
        </span>
      </div>
      <div v-if="restoreSelected !== 'latest' && selectedCloudArchiveCopies.length" class="mt-2 flex flex-wrap items-center gap-2">
        <span class="opacity-60">{{ $t('agentRestoreFrom') }}:</span>
        <span
          v-for="copy in selectedCloudArchiveCopies"
          :key="`selected-copy-${cloudItemKey(copy)}`"
          class="badge badge-sm"
          :class="restoreCloudRemote && restoreCloudRemote === cloudItemRemote(copy) ? 'badge-info' : 'badge-ghost'"
        >
          {{ cloudItemRemote(copy) }}
        </span>
      </div>
    </div>

    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
      <label class="flex items-center gap-2 text-xs">
        <input type="checkbox" class="checkbox checkbox-sm" v-model="restoreIncludeEnv" :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running" />
        <span class="opacity-80">{{ $t('agentRestoreIncludeEnv') }}</span>
      </label>

      <button
        type="button"
        class="btn btn-xs btn-warning"
        @click="runRestore"
        :disabled="!agentEnabled || !status.ok || restoreLoading || restore.running"
        :title="$t('agentRestoreNow')"
      >
        <span v-if="restoreLoading || restore.running" class="loading loading-spinner loading-xs"></span>
        <span v-else>{{ $t('agentRestoreNow') }}</span>
      </button>
    </div>

    <div class="mt-2 text-xs opacity-70">
      {{ $t('agentRestoreTip') }}
    </div>

    <details class="mt-1" @toggle="onRestoreLogToggle">
      <summary class="cursor-pointer text-xs opacity-80">{{ $t('agentRestoreViewLog') }}</summary>
      <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200/60 p-2 text-[11px]">{{ restoreLog || '…' }}</pre>
    </details>
  </div>
</details>

        </div>
      </div>
      <div v-else-if="agentEnabled && !status.ok">
        {{ $t('agentOfflineTip') }}
      </div>
      <div v-else>
        {{ $t('agentDisabledTip') }}
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import {
  agentBackupCloudDeleteAPI,
  agentBackupCloudDownloadAPI,
  agentBackupCloudListAPI,
  agentBackupCloudStatusAPI,
  agentBackupCronGetAPI,
  agentBackupCronSetAPI,
  agentBackupDeleteAPI,
  agentBackupListAPI,
  agentBackupLogAPI,
  agentBackupStartAPI,
  agentBackupStatusAPI,
  agentRestoreLogAPI,
  agentRestoreStartAPI,
  agentRestoreStatusAPI,
  agentStatusAPI,
} from '@/api/agent'
import {
  agentBackupAutoEnabled,
  agentBackupAutoTime,
  agentEnabled,
  agentEnforceBandwidth,
  agentToken,
  agentUrl,
} from '@/store/agent'
import { prettyBytesHelper } from '@/helper/utils'
import { showNotification } from '@/helper/notification'
import dayjs from 'dayjs'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const status = ref<{ ok: boolean; version?: string; serverVersion?: string; tc?: boolean; wan?: string; lan?: string }>({ ok: false })

// Aliases for template readability (these are persisted refs via useStorage).
const backupAutoEnabled = agentBackupAutoEnabled
const backupAutoTime = agentBackupAutoTime

// Cron state from router.
const cronStatus = ref<any>({ ok: false, enabled: false })
const cronApplying = ref(false)
const cronBootstrapApplied = useStorage<Record<string, number>>('config/agent-backup-cron-bootstrap-v1', {})
const agentCronKey = computed(() => String(agentUrl.value || '').trim().replace(/\/+$/g, ''))

// Convert HH:MM -> "M H * * *". Fallback to 04:00.
const cronSchedule = computed(() => {
  const raw = String(backupAutoTime.value || '04:00').trim()
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  const hh = m ? Number(m[1]) : 4
  const mm = m ? Number(m[2]) : 0

  const H = Number.isFinite(hh) ? Math.min(23, Math.max(0, Math.floor(hh))) : 4
  const M = Number.isFinite(mm) ? Math.min(59, Math.max(0, Math.floor(mm))) : 0
  return `${M} ${H} * * *`
})

// Human-copyable cron line.
const cronLine = computed(() => {
  const s = cronSchedule.value
  if (!s) return ''
  return `${s} /opt/zash-agent/backup.sh >/opt/zash-agent/var/backup.cron.log 2>&1 # zash-backup`
})


const cronStateBadgeText = computed(() => {
  if (cronApplying.value) return '…'
  if (cronStatus.value?.ok && cronStatus.value?.enabled) return 'on'
  if (cronStatus.value?.ok && cronStatus.value?.enabled === false) return 'off'
  if (cronStatus.value?.error) return 'error'
  return '?'
})

const cronStateBadgeClass = computed(() => {
  if (cronApplying.value) return 'badge-info'
  if (cronStatus.value?.ok && cronStatus.value?.enabled) return 'badge-success'
  if (cronStatus.value?.ok && cronStatus.value?.enabled === false) return 'badge-ghost'
  if (cronStatus.value?.error) return 'badge-error'
  return 'badge-warning'
})

const backup = ref<any>({ ok: true, running: false })
const backupLog = ref('')
const backupLoading = ref(false)
const cloudStatus = ref<any>({ ok: true, rcloneInstalled: false, remote: '', path: '' })
const cloudLoading = ref(false)

const backupList = ref<any[]>([])
const backupDir = ref('')
const backupListLoading = ref(false)
const cloudList = ref<any[]>([])
const cloudListLoading = ref(false)
const deletingLocalBackup = ref('')
const deletingCloudBackup = ref('')
const downloadingCloudBackup = ref('')
const backupArchiveView = ref<'all' | 'current' | 'local' | 'cloud' | 'both'>('all')
const backupArchiveQuery = useStorage('config/agent-backup-archive-query-v1', '')
const backupArchiveSort = useStorage<'timeDesc' | 'timeAsc' | 'sizeDesc' | 'sizeAsc' | 'nameAsc' | 'nameDesc'>('config/agent-backup-archive-sort-v1', 'timeDesc')
const backupTargetRemote = useStorage<string>('config/agent-backup-target-remote-v1', '')

const restore = ref<any>({ ok: true, running: false })
const restoreLog = ref('')
const restoreLoading = ref(false)
const restoreSelected = ref<string>('latest')
const restoreScope = ref<string>('all')
const restoreIncludeEnv = ref<boolean>(false)
const restoreSource = ref<'local' | 'cloud'>('local')
const restoreCloudRemote = ref<string>('')

const { t } = useI18n()

const versionCmp = (a?: string, b?: string) => {
  const as = (a || '').match(/\d+/g)?.map((x) => parseInt(x, 10)) || []
  const bs = (b || '').match(/\d+/g)?.map((x) => parseInt(x, 10)) || []
  const n = Math.max(as.length, bs.length)
  for (let i = 0; i < n; i++) {
    const av = as[i] ?? 0
    const bv = bs[i] ?? 0
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return 0
}

const needsUpdate = computed(() => {
  if (!status.value?.ok || !status.value?.version || !status.value?.serverVersion) return false
  return versionCmp(status.value.version, status.value.serverVersion) < 0
})

const isAhead = computed(() => {
  if (!status.value?.ok || !status.value?.version || !status.value?.serverVersion) return false
  return versionCmp(status.value.version, status.value.serverVersion) > 0
})

const configuredCloudRemotes = computed(() => {
  const raw = Array.isArray(cloudStatus.value?.remotes) ? cloudStatus.value.remotes : []
  const items = raw
    .map((it: any) => ({ name: String(it?.name || '').trim(), exists: !!it?.exists }))
    .filter((it: any) => !!it.name)
  if (items.length) return items
  const remote = String(cloudStatus.value?.remote || '').trim()
  return remote ? [{ name: remote, exists: !!cloudStatus.value?.remoteExists }] : []
})

const readyCloudRemotes = computed(() => configuredCloudRemotes.value.filter((it: any) => it.exists).map((it: any) => it.name))

const backupTargetLabel = computed(() => {
  const remote = String(backupTargetRemote.value || '').trim()
  return remote || ''
})

const cloudRemoteLabel = computed(() => {
  const path = String(cloudStatus.value?.path || '').trim()
  const names = configuredCloudRemotes.value.map((it: any) => it.name)
  if (!names.length) return '—'
  const joined = names.join(', ')
  return path ? `${joined}:${path}` : joined
})

const cloudKeepLabel = computed(() => {
  const local = String(cloudStatus.value?.localKeepDays || '').trim() || '—'
  const cloud = String(cloudStatus.value?.keepDays || '').trim() || '—'
  return `${local} / ${cloud} d`
})


const cloudArchiveCountByRemote = computed(() => {
  const counts: Record<string, number> = {}
  for (const item of cloudList.value || []) {
    const remote = cloudItemRemote(item)
    if (!remote) continue
    counts[remote] = (counts[remote] || 0) + 1
  }
  return counts
})

const lastBackupUploadResults = computed(() => {
  const raw = Array.isArray(backup.value?.uploadResults) ? backup.value.uploadResults : []
  return raw
    .map((it: any) => ({
      remote: String(it?.remote || '').trim(),
      ok: !!it?.ok,
      error: String(it?.error || '').trim(),
    }))
    .filter((it: any) => !!it.remote)
})

const backupUploadOkCount = computed(() => Number(backup.value?.uploadOkCount || 0))
const backupUploadFailCount = computed(() => Number(backup.value?.uploadFailCount || 0))

const remoteArchiveCount = (remote: string) => Number(cloudArchiveCountByRemote.value[String(remote || '').trim()] || 0)
const remoteIsReady = (remote: string) => configuredCloudRemotes.value.some((it: any) => it.name === remote && it.exists)
const remoteStatusBadgeClass = (remote: string) => (remoteIsReady(remote) ? 'badge-success' : 'badge-warning')
const uploadStatusBadgeClass = (ok: boolean) => (ok ? 'badge-success' : 'badge-error')

const uniqueRemoteNames = (item: any) => {
  const names = (Array.isArray(item?.cloudCopies) ? item.cloudCopies : [])
    .map((it: any) => cloudItemRemote(it))
    .filter(Boolean)
  return Array.from(new Set(names))
}

const selectedCloudArchiveCopies = computed(() => {
  const selected = String(restoreSelected.value || '').trim()
  if (!selected || selected === 'latest') return []
  const item = (unifiedArchives.value || []).find((it: any) => String(it?.name || '') === selected)
  return item && Array.isArray(item.cloudCopies) ? item.cloudCopies : []
})

const currentBackupName = computed(() => {
  const f = String(backup.value?.file || '').trim()
  if (!f) return ''
  const parts = f.split('/')
  return parts[parts.length - 1] || ''
})

const isCurrentBackup = (name: string) => String(name || '').split('/').pop() === currentBackupName.value
const isUploadedBackup = (name: string) => isCurrentBackup(name) && !!backup.value?.uploaded
const hasLocalBackup = (name: string) => {
  const n = String(name || '').split('/').pop() || ''
  return backupList.value.some((item: any) => String(item?.name || '') === n)
}

const cloudItemName = (item: any) => String(item?.Name || item?.Path || '').split('/').pop() || ''
const cloudItemRemote = (item: any) => String(item?.Remote || '').trim()
const cloudItemKey = (item: any) => `${cloudItemRemote(item)}::${cloudItemName(item)}`

const cloudBackupNames = computed(() => {
  const names = new Set<string>()
  for (const item of cloudList.value || []) {
    const remote = cloudItemRemote(item)
    if (restoreCloudRemote.value && remote && remote !== restoreCloudRemote.value) continue
    const name = cloudItemName(item)
    if (name) names.add(name)
  }
  return Array.from(names.values())
})

const restoreItems = computed(() => (restoreSource.value === 'cloud'
  ? cloudBackupNames.value
  : backupList.value.map((item: any) => String(item?.name || '')).filter(Boolean)))

const cloudItemTs = (item: any) => {
  const raw = String(item?.ModTime || '').trim()
  if (!raw) return 0
  const d = dayjs(raw)
  return d.isValid() ? d.valueOf() : 0
}

const unifiedArchives = computed(() => {
  const map = new Map<string, any>()

  for (const item of backupList.value || []) {
    const name = String(item?.name || '').trim()
    if (!name) continue
    const rec = map.get(name) || { name, hasLocal: false, hasCloud: false, local: null, cloud: null, cloudCopies: [] }
    rec.local = item
    rec.hasLocal = true
    map.set(name, rec)
  }

  for (const item of cloudList.value || []) {
    const name = cloudItemName(item)
    if (!name) continue
    const rec = map.get(name) || { name, hasLocal: false, hasCloud: false, local: null, cloud: null, cloudCopies: [] }
    rec.cloudCopies = Array.isArray(rec.cloudCopies) ? rec.cloudCopies : []
    rec.cloudCopies.push(item)
    rec.cloud = rec.cloud || item
    rec.hasCloud = true
    map.set(name, rec)
  }

  return Array.from(map.values())
    .map((rec: any) => {
      const localTs = Number(rec?.local?.mtime || 0) > 0 ? Number(rec.local.mtime) * 1000 : 0
      const cloudCopies = Array.isArray(rec?.cloudCopies) ? rec.cloudCopies : []
      const cloudTs = cloudCopies.reduce((max: number, item: any) => Math.max(max, cloudItemTs(item)), 0)
      const sortTs = Math.max(localTs, cloudTs)
      const displayTime = sortTs > 0 ? dayjs(sortTs).format('YYYY-MM-DD HH:mm:ss') : '—'
      const localSize = Number(rec?.local?.size || 0)
      const cloudSize = cloudCopies.reduce((max: number, item: any) => Math.max(max, Number(item?.Size || 0)), 0)
      const cloudRemotes = cloudCopies.map((item: any) => cloudItemRemote(item)).filter(Boolean)
      return {
        ...rec,
        cloudCopies,
        cloudRemotes,
        sortTs,
        displayTime,
        displaySize: Math.max(localSize, cloudSize, 0),
      }
    })
    .sort((a: any, b: any) => {
      if ((b.sortTs || 0) !== (a.sortTs || 0)) return (b.sortTs || 0) - (a.sortTs || 0)
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
})

const preferredCloudCopy = (item: any) => {
  const copies = Array.isArray(item?.cloudCopies) ? item.cloudCopies : []
  if (!copies.length) return null
  if (restoreCloudRemote.value) {
    const exact = copies.find((it: any) => cloudItemRemote(it) === restoreCloudRemote.value)
    if (exact) return exact
  }
  const ready = readyCloudRemotes.value
  if (ready.length) {
    const found = copies.find((it: any) => ready.includes(cloudItemRemote(it)))
    if (found) return found
  }
  return copies[0]
}

const filteredUnifiedArchives = computed(() => {
  const mode = backupArchiveView.value || 'all'
  const query = String(backupArchiveQuery.value || '').trim().toLowerCase()
  const sort = backupArchiveSort.value || 'timeDesc'

  return (unifiedArchives.value || [])
    .filter((item: any) => {
      if (mode === 'current' && !isCurrentBackup(item?.name || '')) return false
      if (mode === 'local' && (!item.hasLocal || item.hasCloud)) return false
      if (mode === 'cloud' && (!item.hasCloud || item.hasLocal)) return false
      if (mode === 'both' && (!item.hasLocal || !item.hasCloud)) return false
      if (!query) return true
      return String(item?.name || '').toLowerCase().includes(query)
    })
    .slice()
    .sort((a: any, b: any) => {
      const aTs = Number(a?.sortTs || 0)
      const bTs = Number(b?.sortTs || 0)
      const aSize = Number(a?.displaySize || 0)
      const bSize = Number(b?.displaySize || 0)
      const aName = String(a?.name || '')
      const bName = String(b?.name || '')

      if (sort === 'timeAsc') {
        if (aTs !== bTs) return aTs - bTs
      } else if (sort === 'sizeDesc') {
        if (aSize !== bSize) return bSize - aSize
      } else if (sort === 'sizeAsc') {
        if (aSize !== bSize) return aSize - bSize
      } else if (sort === 'nameAsc') {
        const cmp = aName.localeCompare(bName)
        if (cmp !== 0) return cmp
      } else if (sort === 'nameDesc') {
        const cmp = bName.localeCompare(aName)
        if (cmp !== 0) return cmp
      } else {
        if (aTs !== bTs) return bTs - aTs
      }

      if (bTs !== aTs) return bTs - aTs
      if (bSize !== aSize) return bSize - aSize
      return aName.localeCompare(bName)
    })
})

const formatBackupSize = (size?: number) => {
  const n = Number(size)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  return prettyBytesHelper(n, { binary: true })
}

const formatBackupTime = (mtime?: number) => {
  const n = Number(mtime)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return dayjs(n * 1000).format('YYYY-MM-DD HH:mm:ss')
}

const formatCloudTime = (value?: string) => {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(value)
}


const restoreProgressPct = computed<number | null>(() => {
  const n = Number(restore.value?.progressPct)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n)))
})

const restoreBytesLabel = computed(() => {
  const done = Number(restore.value?.bytesDone)
  const total = Number(restore.value?.bytesTotal)
  if (Number.isFinite(total) && total > 0) {
    const left = Number.isFinite(done) && done >= 0 ? formatBackupSize(done) : '0 B'
    return `${left} / ${formatBackupSize(total)}`
  }
  if (Number.isFinite(done) && done > 0) return formatBackupSize(done)
  return ''
})

const restoreStageLabel = computed(() => {
  const stage = String(restore.value?.stage || '').trim()
  const map: Record<string, string> = {
    queued: t('agentRestoreStageQueued'),
    'resolve-cloud': t('agentRestoreStageResolveCloud'),
    downloading: t('agentRestoreStageDownloading'),
    downloaded: t('agentRestoreStageDownloaded'),
    preparing: t('agentRestoreStagePreparing'),
    restoring: t('agentRestoreStageRestoring'),
    done: t('agentRestoreStageDone'),
    failed: t('agentRestoreStageFailed'),
  }
  return map[stage] || restore.value?.detail || stage || '—'
})

const selectBackupForRestore = (name: string) => {
  restoreSource.value = 'local'
  restoreSelected.value = name
  showNotification({ content: 'agentBackupUseForRestoreDone', type: 'alert-success', timeout: 1400 })
}

const selectCloudBackupForRestore = (name: string, remote: string = '') => {
  restoreSource.value = 'cloud'
  restoreCloudRemote.value = String(remote || '').trim()
  restoreSelected.value = String(name || '').split('/').pop() || 'latest'
  showNotification({ content: 'agentBackupUseForRestoreDone', type: 'alert-success', timeout: 1400 })
}

const selectUnifiedArchiveForRestore = (item: any) => {
  if (item?.hasLocal) {
    selectBackupForRestore(item.name)
    return
  }
  if (item?.hasCloud) {
    const copy = preferredCloudCopy(item)
    selectCloudBackupForRestore(item.name, cloudItemRemote(copy))
  }
}

const refreshUnifiedArchives = async () => {
  await refreshBackupList()
  await refreshCloud()
  await refreshCloudHistory()
}

const onUnifiedHistoryToggle = async (e: any) => {
  if (e?.target?.open) {
    await refreshUnifiedArchives()
  }
}

const refreshCloud = async () => {
  if (!agentEnabled.value || !status.value?.ok) {
    cloudStatus.value = { ok: true, rcloneInstalled: false, remote: '', path: '' }
    return
  }
  cloudLoading.value = true
  cloudStatus.value = await agentBackupCloudStatusAPI()
  if (!cloudStatus.value?.cloudReady) cloudList.value = []
  syncRestoreSource()
  cloudLoading.value = false
}


const refreshCloudHistory = async () => {
  if (!agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady) {
    cloudList.value = []
    return
  }
  cloudListLoading.value = true
  const res = await agentBackupCloudListAPI()
  if (res?.ok && Array.isArray((res as any).items)) {
    cloudList.value = (res as any).items || []
  } else {
    cloudList.value = []
  }
  syncRestoreSource()
  cloudListLoading.value = false
}

const onCloudHistoryToggle = async (e: any) => {
  if (e?.target?.open) {
    await refreshCloud()
    await refreshBackupList()
    await refreshCloudHistory()
  }
}

const deleteLocalBackup = async (name: string) => {
  const file = String(name || '').trim()
  if (!file || !agentEnabled.value || !status.value?.ok) return
  if (backup.value?.running || restore.value?.running) return
  const ok = window.confirm(String(t('agentBackupDeleteConfirm', { name: file })))
  if (!ok) return

  deletingLocalBackup.value = file
  const res = await agentBackupDeleteAPI(file)
  if (res?.ok) {
    showNotification({ content: 'agentBackupDeleteDone', type: 'alert-success', timeout: 1800 })
    await refreshBackupList()
  } else {
    showNotification({ content: 'agentBackupDeleteFail', type: 'alert-error', timeout: 2200 })
  }
  deletingLocalBackup.value = ''
}

const deleteCloudBackup = async (name: string, remote: string = '') => {
  const file = String(name || '').split('/').pop() || ''
  const remoteName = String(remote || '').trim()
  if (!file || !agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady) return
  if (backup.value?.running || restore.value?.running) return
  const ok = window.confirm(String(t('agentBackupCloudDeleteConfirm', { name: remoteName ? `${file} [${remoteName}]` : file })))
  if (!ok) return

  deletingCloudBackup.value = remoteName ? `${remoteName}::${file}` : file
  const res = await agentBackupCloudDeleteAPI(file, remoteName)
  if (res?.ok) {
    showNotification({ content: 'agentBackupCloudDeleteDone', type: 'alert-success', timeout: 1800 })
    await refreshCloudHistory()
  } else {
    showNotification({ content: 'agentBackupCloudDeleteFail', type: 'alert-error', timeout: 2200 })
  }
  deletingCloudBackup.value = ''
}

const downloadCloudBackupToLocal = async (name: string, remote: string = '') => {
  const file = String(name || '').split('/').pop() || ''
  const remoteName = String(remote || '').trim()
  if (!file || !agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady) return
  if (backup.value?.running || restore.value?.running) return

  downloadingCloudBackup.value = remoteName ? `${remoteName}::${file}` : file
  const res = await agentBackupCloudDownloadAPI(file, remoteName)
  if (res?.ok) {
    showNotification({ content: res?.existed ? 'agentBackupDownloadToLocalExists' : 'agentBackupDownloadToLocalDone', type: 'alert-success', timeout: 2000 })
    await refreshBackupList()
    await refreshCloudHistory()
  } else {
    showNotification({
      content: 'agentBackupDownloadToLocalFail',
      params: { error: String(res?.error || 'failed') },
      type: 'alert-error',
      timeout: 2600,
    })
  }
  downloadingCloudBackup.value = ''
}

const syncRestoreSource = () => {
  if (restoreSource.value === 'cloud' && !cloudStatus.value?.cloudReady) {
    restoreSource.value = 'local'
    restoreCloudRemote.value = ''
  }
  const ready = readyCloudRemotes.value
  if (restoreSource.value === 'cloud') {
    if (restoreCloudRemote.value && ready.length && !ready.includes(restoreCloudRemote.value)) {
      restoreCloudRemote.value = ''
    }
    if (!restoreCloudRemote.value && ready.length === 1) {
      restoreCloudRemote.value = ready[0]
    }
  }
  if (backupTargetRemote.value && ready.length && !ready.includes(backupTargetRemote.value)) {
    backupTargetRemote.value = ''
  }
  if (restoreSelected.value !== 'latest' && !restoreItems.value.includes(restoreSelected.value)) {
    restoreSelected.value = 'latest'
  }
}

const refreshCron = async () => {
  if (!agentEnabled.value) {
    cronStatus.value = { ok: false, enabled: false }
    return
  }
  if (!status.value?.ok) {
    cronStatus.value = { ok: false, enabled: false }
    return
  }
  const res: any = await agentBackupCronGetAPI()
  cronStatus.value = res

  // Best-effort sync from router schedule -> UI fields.
  // IMPORTANT: do not blindly overwrite local auto-backup preference with false
  // when the router simply has no cron yet; otherwise the default 04:00 bootstrap
  // will never be applied on first run.
  if (res?.ok) {
    if (res.enabled === true) backupAutoEnabled.value = true
    if (typeof res.schedule === 'string' && res.schedule.trim()) {
      const parts = res.schedule.trim().split(/\s+/)
      if (parts.length >= 2) {
        const mm = Number(parts[0])
        const hh = Number(parts[1])
        if (Number.isFinite(mm) && Number.isFinite(hh)) {
          const H = Math.min(23, Math.max(0, Math.floor(hh)))
          const M = Math.min(59, Math.max(0, Math.floor(mm)))
          backupAutoTime.value = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`
        }
      }
    }
  }
}

const applyCron = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  cronApplying.value = true
  const res = await agentBackupCronSetAPI(!!backupAutoEnabled.value, cronSchedule.value)
  await refreshCron()
  cronApplying.value = false

  if (res?.ok) {
    showNotification({ content: 'agentBackupCronApplyDone', type: 'alert-success', timeout: 1800 })
  } else {
    showNotification({
      content: 'agentBackupCronApplyFail',
      params: { error: String(res?.error || 'failed') },
      type: 'alert-error',
      timeout: 2600,
    })
  }
}

const removeCron = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  cronApplying.value = true
  backupAutoEnabled.value = false
  const res = await agentBackupCronSetAPI(false, cronSchedule.value)
  await refreshCron()
  cronApplying.value = false

  if (res?.ok) {
    showNotification({ content: 'agentBackupCronDeleteDone', type: 'alert-success', timeout: 1800 })
  } else {
    showNotification({
      content: 'agentBackupCronDeleteFail',
      params: { error: String(res?.error || 'failed') },
      type: 'alert-error',
      timeout: 2600,
    })
  }
}

const copyCron = async () => {
  try {
    await navigator.clipboard.writeText(cronLine.value)
    showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 })
  } catch {
    // ignore
  }
}

const onCronToggle = async (e: any) => {
  if (e?.target?.open) {
    await refreshCron()
  }
}

const shouldBootstrapCron = () => {
  if (backupAutoEnabled.value) return true
  if (typeof localStorage === 'undefined') return false

  const stored = localStorage.getItem('config/agent-backup-auto-enabled-v1')
  const defaultTime = String(backupAutoTime.value || '04:00').trim() === '04:00'
  const noHistory = (backupList.value?.length || 0) === 0
    && !String(backup.value?.startedAt || backup.value?.finishedAt || '').trim()

  return stored === 'false' && defaultTime && noHistory
}

const ensureCronBootstrap = async () => {
  const key = agentCronKey.value
  if (!key || !agentEnabled.value || !status.value?.ok) return
  if (!shouldBootstrapCron()) return
  if (!cronStatus.value?.ok) return
  if (cronStatus.value?.enabled) return
  if ((cronBootstrapApplied.value || {})[key]) return

  cronApplying.value = true
  const res = await agentBackupCronSetAPI(true, cronSchedule.value)
  cronApplying.value = false

  if (res?.ok && res?.enabled) {
    cronBootstrapApplied.value = {
      ...(cronBootstrapApplied.value || {}),
      [key]: Date.now(),
    }
    await refreshCron()
  }
}

const refreshBackupList = async () => {
  if (!agentEnabled.value || !status.value?.ok) {
    backupDir.value = ''
    backupList.value = []
    return
  }
  backupListLoading.value = true
  const res = await agentBackupListAPI()
  if (res?.ok && Array.isArray((res as any).items)) {
    backupDir.value = String((res as any).dir || '')
    backupList.value = (res as any).items || []
  } else {
    backupDir.value = String((res as any)?.dir || '')
    backupList.value = []
  }
  syncRestoreSource()
  backupListLoading.value = false
}

const onBackupHistoryToggle = async (e: any) => {
  if (e?.target?.open) {
    await refreshBackupList()
  }
}

const refreshRestore = async () => {
  if (!agentEnabled.value) {
    restore.value = { ok: false }
    return
  }
  if (!status.value?.ok) {
    restore.value = { ok: true, running: false }
    return
  }
  restoreLoading.value = true
  restore.value = await agentRestoreStatusAPI()
  restoreLoading.value = false
  syncRestoreSource()
}

const loadRestoreLog = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  const res = await agentRestoreLogAPI(200)
  if (res?.ok && res?.contentB64) {
    try {
      restoreLog.value = atob(res.contentB64)
    } catch {
      restoreLog.value = ''
    }
  } else {
    restoreLog.value = res?.error ? String(res.error) : ''
  }
}

const onRestoreLogToggle = async (e: any) => {
  if (e?.target?.open) {
    await loadRestoreLog()
  }
}

const onRestoreToggle = async (e: any) => {
  if (e?.target?.open) {
    await refreshBackupList()
    await refreshCloud()
    await refreshCloudHistory()
    await refreshRestore()
  }
}

const runRestore = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  const file = restoreSelected.value || 'latest'
  const scope = restoreScope.value || 'all'
  const includeEnv = !!restoreIncludeEnv.value
  const source = restoreSource.value === 'cloud' ? 'cloud' : 'local'

  const ok = window.confirm(String(t('agentRestoreConfirm')))
  if (!ok) return

  restoreLoading.value = true
  const res = await agentRestoreStartAPI(file, scope, includeEnv, source, source === 'cloud' ? restoreCloudRemote.value : '')
  if (!res?.ok) {
    showNotification({ content: 'agentRestoreFail', type: 'alert-error', timeout: 2200 })
  }
  await refreshRestore()
  if (restore.value?.running) {
    await loadRestoreLog()
  }
  restoreLoading.value = false
}

const refreshBackup = async () => {
  if (!agentEnabled.value) {
    backup.value = { ok: false }
    return
  }
  if (!status.value?.ok) {
    backup.value = { ok: true, running: false }
    return
  }
  backupLoading.value = true
  backup.value = await agentBackupStatusAPI()
  backupLoading.value = false
}

const runBackup = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  backupLoading.value = true
  const selectedRemote = String(backupTargetRemote.value || '').trim()
  const res = await agentBackupStartAPI(selectedRemote || undefined)
  await refreshBackup()
  await refreshBackupList()
  await refreshCloudHistory()
  backupLoading.value = false

  if (res?.ok) {
    showNotification({
      content: 'agentBackupRunStarted',
      params: selectedRemote ? { target: selectedRemote } : undefined,
      type: 'alert-success',
      timeout: 2000,
    })
  } else {
    showNotification({
      content: 'agentBackupRunFail',
      params: { error: String(res?.error || 'failed') },
      type: 'alert-error',
      timeout: 2600,
    })
  }
}

const loadBackupLog = async () => {
  if (!agentEnabled.value || !status.value?.ok) return
  const res = await agentBackupLogAPI(200)
  if (res?.ok && res?.contentB64) {
    try {
      backupLog.value = atob(res.contentB64)
    } catch {
      backupLog.value = ''
    }
  } else {
    backupLog.value = res?.error ? String(res.error) : ''
  }
}

const onBackupLogToggle = async (e: any) => {
  if (e?.target?.open) {
    await loadBackupLog()
  }
}

const refreshStatus = async () => {
  if (!agentEnabled.value) {
    status.value = { ok: false }
    return false
  }
  status.value = await agentStatusAPI()
  return !!status.value?.ok
}

const refresh = async () => {
  const ok = await refreshStatus()
  if (!ok) return
  await refreshCron()
  await refreshBackup()
  await refreshBackupList()
  await ensureCronBootstrap()
  await refreshCloud()
  await refreshRestore()
}

let liveTimer: number | undefined
let statusTimer: number | undefined

onMounted(() => {
  refresh()
  statusTimer = window.setInterval(() => {
    refreshStatus()
  }, 10_000)
  liveTimer = window.setInterval(() => {
    if (restore.value?.running) {
      refreshRestore()
    }
    if (backup.value?.running) {
      refreshBackup()
    }
  }, 2000)
})

watch([agentEnabled, agentUrl, agentToken], () => {
  refresh()
})

onUnmounted(() => {
  if (statusTimer) {
    window.clearInterval(statusTimer)
    statusTimer = undefined
  }
  if (liveTimer) {
    window.clearInterval(liveTimer)
    liveTimer = undefined
  }
})
</script>
