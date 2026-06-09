<template>
  <div class="app">
    <div class="app__top">
      <MiuixTopAppBar title="HyperOS 音乐触感白名单" class="app__bar">
        <template #actions>
          <MiuixIconButton aria-label="刷新" @click="refresh" :disabled="loading">
            <MiuixIcon :icon="Refresh" :size="24" />
          </MiuixIconButton>
        </template>
      </MiuixTopAppBar>
    </div>

    <MiuixScrollArea class="app__body">
      <div class="page">
        <MiuixSmallTitle text="Status" />
        <MiuixCard class="page-card">
          <MiuixBasicComponent title="KernelSU WebUI" :summary="`v${version}`">
            <template #end>
              <MiuixText type="body2" color="var(--m-color-on-surface-variant-actions)">
                {{ connected ? '已连接' : '未连接' }}
              </MiuixText>
            </template>
          </MiuixBasicComponent>
          <MiuixBasicComponent
            v-if="!connected"
            title="未检测到 KernelSU"
            summary="请在 KernelSU 管理器内打开 WebUI。当前显示的是内置示例列表。"
          />
          <MiuixBasicComponent v-if="lastError" title="错误" :summary="lastError">
            <template #end>
              <MiuixButton @click="lastError = ''">知道了</MiuixButton>
            </template>
          </MiuixBasicComponent>
          <MiuixBasicComponent title="配置文件" :summary="statusLine" />
          <MiuixBasicComponent title="备份" :summary="`${backupCount} 份`">
            <template #end>
              <MiuixText type="body2" color="var(--m-color-on-surface-variant-actions)">
                {{ fileSize }} bytes
              </MiuixText>
            </template>
          </MiuixBasicComponent>
        </MiuixCard>

        <MiuixSmallTitle text="Edit" />
        <MiuixSearchBar
          v-model="filter"
          v-model:expanded="searchExpanded"
          label="筛选包名"
          cancel-text="取消"
          class="section-search"
        />
        <div class="field-stack">
          <MiuixInput
            v-model="newPackage"
            label="添加包名"
            use-label-as-placeholder
            single-line
            @keyup.enter="addPackage"
            :class="{ invalid: newPackage && !canAddPackage }"
          />
        </div>

        <MiuixSmallTitle text="Actions" />
        <div class="action-block">
          <div class="button-row">
            <MiuixButton class="grow" type="primary" @click="addPackage" :disabled="!canAddPackage">
              添加
            </MiuixButton>
            <MiuixButton class="grow" @click="openBulkPaste">批量粘贴</MiuixButton>
          </div>
          <div class="button-row">
            <MiuixButton class="grow" @click="dedupeSort" :disabled="packages.length === 0">
              去重排序
            </MiuixButton>
            <MiuixButton
              class="grow"
              @click="openRestoreDialog"
              :disabled="loading || !connected || backupCount === 0"
            >
              恢复最近备份
            </MiuixButton>
          </div>
          <div class="button-row">
            <MiuixButton
              class="grow"
              type="primary"
              @click="save"
              :disabled="loading || !dirty || !connected"
            >
              保存到设备
            </MiuixButton>
            <MiuixButton class="grow" @click="copyAll">复制全部</MiuixButton>
          </div>
        </div>

        <MiuixSmallTitle text="Whitelist" />
        <MiuixCard class="page-card">
          <MiuixBasicComponent
            title="包名"
            :summary="summaryLine"
          />
          <MiuixBasicComponent
            v-if="dirty"
            title="有未保存修改"
            summary="保存后会先自动备份，再写回配置文件并触发模块热更新。"
          >
            <template #end>
              <MiuixButton @click="discard" :disabled="loading">丢弃</MiuixButton>
            </template>
          </MiuixBasicComponent>
          <MiuixBasicComponent v-if="filteredPackages.length === 0" title="没有匹配的包名" />
          <MiuixBasicComponent
            v-for="pkg in filteredPackages"
            :key="pkg"
            class="package-row"
            :title="pkg"
          >
            <template #end>
              <MiuixButton @click="removePackage(pkg)">移除</MiuixButton>
            </template>
          </MiuixBasicComponent>
        </MiuixCard>
      </div>
    </MiuixScrollArea>

    <MiuixDialog v-model="bulkDialogOpen" title="批量粘贴" summary="支持空格、逗号、分号或换行分隔">
      <div class="dialog-stack">
        <MiuixInput
          v-model="bulkText"
          class="dialog-textarea"
          label="包名列表"
          :single-line="false"
        />
        <div class="dialog-actions">
          <MiuixButton @click="closeBulkPaste">取消</MiuixButton>
          <MiuixButton type="primary" @click="applyBulkPaste">导入</MiuixButton>
        </div>
      </div>
    </MiuixDialog>

    <MiuixDialog
      v-model="restoreDialogOpen"
      title="恢复最近备份"
      summary="当前未保存修改会被覆盖。"
    >
      <div class="dialog-actions">
        <MiuixButton @click="restoreDialogOpen = false">取消</MiuixButton>
        <MiuixButton type="primary" @click="restoreLatest">恢复</MiuixButton>
      </div>
    </MiuixDialog>

    <MiuixDialog v-model="copyDialogOpen" title="手动复制" summary="当前 WebView 不支持直接写入剪贴板。">
      <div class="dialog-stack">
        <MiuixInput
          v-model="copyFallbackText"
          class="dialog-textarea copy-textarea"
          label="全部包名"
          readonly
          :single-line="false"
        />
        <div class="dialog-actions">
          <MiuixButton type="primary" @click="copyDialogOpen = false">完成</MiuixButton>
        </div>
      </div>
    </MiuixDialog>

    <MiuixSnackbarHost />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  MiuixBasicComponent,
  MiuixButton,
  MiuixCard,
  MiuixDialog,
  MiuixIcon,
  MiuixIconButton,
  MiuixInput,
  MiuixScrollArea,
  MiuixSearchBar,
  MiuixSmallTitle,
  MiuixSnackbarHost,
  MiuixText,
  MiuixTopAppBar,
  showSnackbar,
} from 'miuix-vue';
import { Refresh } from 'miuix-vue/icons';
import {
  getStat,
  isKsuAvailable,
  isLegalPackageName,
  listBackups,
  loadWhitelist,
  normalizePackages,
  restoreLatestBackup,
  saveWhitelist,
} from '@/root/bridge';

const DEFAULT_PACKAGES = [
  'com.apple.android.music',
  'com.netease.cloudmusic',
  'com.tencent.qqmusic',
  'com.kugou.android',
  'cn.kuwo.player',
  'com.miui.player',
  'com.luna.music',
];

const version = __APP_VERSION__;
const connected = ref(false);
const loading = ref(false);
const lastError = ref('');
const filter = ref('');
const newPackage = ref('');
const searchExpanded = ref(false);
const packages = ref<string[]>([...DEFAULT_PACKAGES].sort());
const savedSnapshot = ref<string[]>([...packages.value]);
const backupCount = ref(0);
const configPath = ref('/data/adb/hyperos_music_haptic_whitelist.txt');
const fileMtime = ref(0);
const fileSize = ref(0);
const bulkDialogOpen = ref(false);
const bulkText = ref('');
const restoreDialogOpen = ref(false);
const copyDialogOpen = ref(false);
const copyFallbackText = ref('');

const dirty = computed(() => packages.value.join('\n') !== savedSnapshot.value.join('\n'));

const filteredPackages = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return packages.value;
  return packages.value.filter((pkg) => pkg.toLowerCase().includes(needle));
});

const canAddPackage = computed(() => {
  const pkg = newPackage.value.trim();
  return isLegalPackageName(pkg) && !packages.value.includes(pkg);
});

const statusLine = computed(() => {
  if (!connected.value) return '当前未连接 root bridge';
  if (fileMtime.value <= 0) return `${configPath.value} · ${fileSize.value} bytes`;
  const time = new Date(fileMtime.value * 1000).toLocaleString();
  return `${configPath.value} · ${fileSize.value} bytes · ${time}`;
});

const summaryLine = computed(() => {
  const parts = [`${packages.value.length} 个包名`];
  if (filteredPackages.value.length !== packages.value.length) {
    parts.push(`筛选后 ${filteredPackages.value.length} 个`);
  }
  parts.push(loading.value ? '处理中...' : '一行一个包名，保存后实时生效。');
  return parts.join(' · ');
});

onMounted(refresh);

async function refresh(): Promise<void> {
  loading.value = true;
  lastError.value = '';
  connected.value = isKsuAvailable();
  if (!connected.value) {
    loading.value = false;
    return;
  }

  try {
    const [stat, list] = await Promise.all([getStat(), loadWhitelist()]);
    packages.value = list;
    savedSnapshot.value = [...list];
    configPath.value = stat.configPath;
    fileMtime.value = stat.mtime;
    fileSize.value = stat.size;
    backupCount.value = stat.backupCount;
  } catch (err) {
    showError(err);
  } finally {
    loading.value = false;
  }
}

function addPackage(): void {
  const pkg = newPackage.value.trim();
  if (!isLegalPackageName(pkg) || packages.value.includes(pkg)) return;
  packages.value = normalizePackages([...packages.value, pkg]);
  newPackage.value = '';
  void showSnackbar({ message: '已添加包名' });
}

function removePackage(pkg: string): void {
  packages.value = packages.value.filter((item) => item !== pkg);
}

function dedupeSort(): void {
  packages.value = normalizePackages(packages.value);
  void showSnackbar({ message: '已去重排序' });
}

function openBulkPaste(): void {
  bulkText.value = '';
  bulkDialogOpen.value = true;
}

function closeBulkPaste(): void {
  bulkDialogOpen.value = false;
  bulkText.value = '';
}

function applyBulkPaste(): void {
  const text = bulkText.value.trim();
  if (!text) {
    closeBulkPaste();
    return;
  }
  const before = packages.value.length;
  const fresh = text.split(/[\s,;]+/);
  packages.value = normalizePackages([...packages.value, ...fresh]);
  closeBulkPaste();
  void showSnackbar({ message: `已导入 ${packages.value.length - before} 个新包名` });
}

async function save(): Promise<void> {
  loading.value = true;
  lastError.value = '';
  try {
    const result = await saveWhitelist(packages.value);
    savedSnapshot.value = normalizePackages(packages.value);
    configPath.value = result.path;
    await refreshStatOnly();
    void showSnackbar({ message: '已保存到设备' });
  } catch (err) {
    showError(err);
  } finally {
    loading.value = false;
  }
}

function discard(): void {
  packages.value = [...savedSnapshot.value];
  void showSnackbar({ message: '已丢弃未保存修改' });
}

function openRestoreDialog(): void {
  restoreDialogOpen.value = true;
}

async function restoreLatest(): Promise<void> {
  restoreDialogOpen.value = false;
  loading.value = true;
  lastError.value = '';
  try {
    await restoreLatestBackup();
    const list = await loadWhitelist();
    packages.value = list;
    savedSnapshot.value = [...list];
    await refreshStatOnly();
    void showSnackbar({ message: '已恢复最近备份' });
  } catch (err) {
    showError(err);
  } finally {
    loading.value = false;
  }
}

async function copyAll(): Promise<void> {
  const text = packages.value.join('\n') + '\n';
  try {
    await navigator.clipboard.writeText(text);
    void showSnackbar({ message: '已复制全部包名' });
  } catch {
    copyFallbackText.value = text;
    copyDialogOpen.value = true;
  }
}

async function refreshStatOnly(): Promise<void> {
  const [stat, backups] = await Promise.all([getStat(), listBackups()]);
  configPath.value = stat.configPath;
  fileMtime.value = stat.mtime;
  fileSize.value = stat.size;
  backupCount.value = backups.length || stat.backupCount;
}

function showError(err: unknown): void {
  lastError.value = (err as Error)?.message ?? String(err);
  void showSnackbar({ message: lastError.value, withDismissAction: true, duration: 'long' });
}
</script>
