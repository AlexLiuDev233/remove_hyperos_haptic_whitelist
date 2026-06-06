<template>
  <main class="app">
    <header class="topbar">
      <div>
        <p class="eyebrow">KernelSU WebUI · v{{ version }}</p>
        <h1>HyperOS 音乐触感白名单</h1>
        <p class="subtle">{{ statusLine }}</p>
      </div>
      <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
    </header>

    <section v-if="lastError" class="banner error">
      <strong>错误</strong>
      <span>{{ lastError }}</span>
      <button class="ghost" @click="lastError = ''">知道了</button>
    </section>

    <section v-if="!connected" class="banner warn">
      <strong>未检测到 KernelSU</strong>
      <span>请在 KernelSU 管理器内打开 WebUI。当前显示的是内置示例列表。</span>
    </section>

    <section v-if="dirty" class="banner warn">
      <strong>有未保存修改</strong>
      <span>保存后会先自动备份，再写回配置文件并触发模块热更新。</span>
      <button class="primary" @click="save" :disabled="loading || !connected">保存</button>
      <button class="ghost" @click="discard" :disabled="loading">丢弃</button>
    </section>

    <section class="toolbar">
      <input v-model="filter" placeholder="筛选包名" />
      <input
        v-model="newPackage"
        placeholder="com.example.music"
        @keyup.enter="addPackage"
        :class="{ invalid: newPackage && !canAddPackage }"
      />
      <button class="primary" @click="addPackage" :disabled="!canAddPackage">添加</button>
      <button @click="bulkPaste">批量粘贴</button>
      <button @click="dedupeSort" :disabled="packages.length === 0">去重排序</button>
      <button @click="restoreLatest" :disabled="loading || !connected || backupCount === 0">
        恢复最近备份
      </button>
    </section>

    <section class="meta">
      <span>{{ packages.length }} 个包名</span>
      <span v-if="filteredPackages.length !== packages.length">筛选后 {{ filteredPackages.length }} 个</span>
      <span>备份 {{ backupCount }} 份</span>
      <span class="path">{{ configPath }}</span>
    </section>

    <section class="list">
      <div v-if="filteredPackages.length === 0" class="empty">
        没有匹配的包名
      </div>
      <div v-for="pkg in filteredPackages" :key="pkg" class="row">
        <span class="mono">{{ pkg }}</span>
        <button class="danger" @click="removePackage(pkg)">移除</button>
      </div>
    </section>

    <footer class="footer">
      <button class="primary" @click="save" :disabled="loading || !dirty || !connected">保存到设备</button>
      <button class="ghost" @click="copyAll">复制全部</button>
      <span class="subtle">{{ loading ? '处理中...' : '一行一个包名，保存后实时生效。' }}</span>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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
const packages = ref<string[]>([...DEFAULT_PACKAGES].sort());
const savedSnapshot = ref<string[]>([...packages.value]);
const backupCount = ref(0);
const configPath = ref('/data/adb/hyperos_music_haptic_whitelist.txt');
const fileMtime = ref(0);
const fileSize = ref(0);

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
}

function removePackage(pkg: string): void {
  packages.value = packages.value.filter((item) => item !== pkg);
}

function dedupeSort(): void {
  packages.value = normalizePackages(packages.value);
}

async function bulkPaste(): Promise<void> {
  const text = window.prompt('粘贴包名，支持空格、逗号、分号或换行分隔');
  if (!text) return;
  const fresh = text.split(/[\s,;]+/);
  packages.value = normalizePackages([...packages.value, ...fresh]);
}

async function save(): Promise<void> {
  loading.value = true;
  lastError.value = '';
  try {
    const result = await saveWhitelist(packages.value);
    savedSnapshot.value = normalizePackages(packages.value);
    configPath.value = result.path;
    await refreshStatOnly();
  } catch (err) {
    showError(err);
  } finally {
    loading.value = false;
  }
}

function discard(): void {
  packages.value = [...savedSnapshot.value];
}

async function restoreLatest(): Promise<void> {
  if (!window.confirm('恢复最近一次自动备份？当前未保存修改会被覆盖。')) return;
  loading.value = true;
  lastError.value = '';
  try {
    await restoreLatestBackup();
    const list = await loadWhitelist();
    packages.value = list;
    savedSnapshot.value = [...list];
    await refreshStatOnly();
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
  } catch {
    window.prompt('复制以下内容', text);
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
}
</script>
