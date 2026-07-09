import { invoke } from '@/utils/invoke';
import type { HostConfig } from '@/types/host';
import type { HostFormState } from '@/types/host';
import type { KeyEntry } from '@/types/key';

// ── API 调用 ──

/** 获取所有主机列表 */
export function listHosts(): Promise<HostConfig[]> {
  return invoke('list_hosts');
}

/** 保存主机 */
export function saveHost(params: { host: HostConfig }): Promise<void> {
  return invoke('save_host', params);
}

/** 删除主机 */
export function deleteHost(params: { id: string }): Promise<void> {
  return invoke('delete_host', params);
}

/** 获取所有标签 */
export function listTags(): Promise<string[]> {
  return invoke('list_tags');
}

// ── 组合查询 ──

/** 一次性获取主机、标签和密钥数据 */
export async function fetchAllHostData(): Promise<{
  hosts: HostConfig[];
  tags: string[];
  keys: KeyEntry[];
}> {
  const [hosts, tags, keys] = await Promise.all([listHosts(), listTags(), listKeys()]);
  return { hosts, tags, keys };
}

/** 一次性获取主机和密钥数据 */
export async function fetchHostsAndKeys(): Promise<{
  hosts: HostConfig[];
  keys: KeyEntry[];
}> {
  const [hosts, keys] = await Promise.all([listHosts(), listKeys()]);
  return { hosts, keys };
}

// ── 类型转换 ──

/** HostConfig 转换为 HostFormState */
export function hostConfigToFormState(host: HostConfig): HostFormState {
  return {
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: host.auth_method,
    password: host.auth_method === 'password' ? host.password || '' : '',
    privateKeyPath: host.private_key_path || '',
    keyPassphrase: host.auth_method === 'key' ? host.password || '' : '',
    tags: host.tags || [],
  };
}

/** HostFormState 转换为 HostConfig */
export function formStateToHostPayload(form: HostFormState, existing?: HostConfig | null): HostConfig {
  return {
    id: existing?.id || '',
    name: form.name,
    hostname: form.hostname,
    port: form.port || 22,
    username: form.username,
    auth_method: form.authMethod,
    password: form.authMethod === 'password' ? form.password : form.keyPassphrase || null,
    private_key_path: form.authMethod === 'key' ? form.privateKeyPath || null : null,
    tags: form.tags,
    created_at: existing?.created_at || 0,
    updated_at: Date.now(),
  };
}

// 延迟导入避免循环依赖
async function listKeys(): Promise<KeyEntry[]> {
  const { listKeys: fn } = await import('./keyService');
  return fn();
}
