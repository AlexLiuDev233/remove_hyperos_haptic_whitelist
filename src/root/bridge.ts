import { exec } from 'kernelsu';

type ExecResults = Awaited<ReturnType<typeof exec>>;

const HELPER = '/data/adb/modules/remove_hyperos_haptic_whitelist/bin/remove-hyperos-haptic-whitelist.sh';
const KSU_TIMEOUT_MS = 30000;
const STAGE_CHUNK_BYTES = 48 * 1024;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export interface StatResult {
  ok: true;
  configPath: string;
  exists: boolean;
  size: number;
  mtime: number;
  backupCount: number;
}

export interface SaveResult {
  ok: true;
  path: string;
  backup: string | null;
}

export interface RestoreResult {
  ok: true;
  restoredFrom: string;
  path: string;
}

export class RootBridgeUnavailable extends Error {
  constructor() {
    super('ksu.exec 不可用，请在 KernelSU 管理器内打开本模块的 WebUI。');
    this.name = 'RootBridgeUnavailable';
  }
}

export class RootBridgeError extends Error {
  constructor(
    message: string,
    public readonly errno: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'RootBridgeError';
  }
}

export function isKsuAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).ksu?.exec === 'function'
  );
}

async function runKsu(cmd: string): Promise<string> {
  if (!isKsuAvailable()) throw new RootBridgeUnavailable();

  let result: ExecResults;
  try {
    result = await Promise.race([
      exec(cmd),
      new Promise<ExecResults>((_, reject) =>
        setTimeout(() => reject(new Error(`ksu.exec 超时（${KSU_TIMEOUT_MS}ms）`)), KSU_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    throw new RootBridgeError(
      `ksu.exec thrown: ${(err as Error)?.message ?? String(err)}`,
      -1,
      '',
    );
  }

  if (result.errno !== 0) {
    throw new RootBridgeError(
      `shell exit ${result.errno}: ${result.stderr || result.stdout}`,
      result.errno,
      result.stderr ?? '',
    );
  }
  return result.stdout ?? '';
}

export async function getStat(): Promise<StatResult> {
  return JSON.parse(await runKsu(`sh ${HELPER} stat`));
}

export async function loadWhitelist(): Promise<string[]> {
  const out = await runKsu(`sh ${HELPER} pull`);
  return parseWhitelist(bytesToUtf8(base64ToBytes(out.trim())));
}

export async function saveWhitelist(packages: string[]): Promise<SaveResult> {
  const body = normalizePackages(packages).join('\n') + '\n';
  const stage = `whitelist-${Date.now().toString(36)}`;
  await stageUpload(stage, utf8ToBase64(body));
  return JSON.parse(await runKsu(`sh ${HELPER} save-from-stage ${stage}`));
}

export async function restoreLatestBackup(): Promise<RestoreResult> {
  return JSON.parse(await runKsu(`sh ${HELPER} restore-latest`));
}

export async function listBackups(): Promise<string[]> {
  const out = await runKsu(`sh ${HELPER} backup-list`);
  return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function stageUpload(stage: string, b64: string): Promise<void> {
  if (!SAFE_NAME.test(stage)) throw new Error('invalid stage name');
  await runKsu(`sh ${HELPER} stage-clear ${stage}`);
  for (let offset = 0; offset < b64.length; offset += STAGE_CHUNK_BYTES) {
    const chunk = b64.slice(offset, offset + STAGE_CHUNK_BYTES);
    await runKsu(`sh ${HELPER} stage-append ${stage} ${chunk}`);
  }
}

export function isLegalPackageName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.]+$/.test(value.trim());
}

export function parseWhitelist(text: string): string[] {
  return normalizePackages(text.split(/\r?\n/));
}

export function normalizePackages(packages: string[]): string[] {
  return Array.from(
    new Set(
      packages
        .map((pkg) => pkg.trim())
        .filter((pkg) => pkg.length > 0)
        .filter(isLegalPackageName),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
