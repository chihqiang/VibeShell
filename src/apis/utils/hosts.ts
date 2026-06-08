import { listHosts, listTags } from '@/apis/api/hosts';
import { listKeys } from '@/apis/api/keys';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import type { HostFormState, AuthMethod } from '@/lib/types';

export async function fetchAllHostData(): Promise<{
  hosts: HostConfig[];
  tags: string[];
  keys: KeyEntry[];
}> {
  const [hosts, tags, keys] = await Promise.all([listHosts(), listTags(), listKeys()]);
  return { hosts, tags, keys };
}

export async function fetchHostsAndKeys(): Promise<{
  hosts: HostConfig[];
  keys: KeyEntry[];
}> {
  const [hosts, keys] = await Promise.all([listHosts(), listKeys()]);
  return { hosts, keys };
}

export function hostConfigToFormState(host: HostConfig): HostFormState {
  return {
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: (host.auth_method as AuthMethod) || 'password',
    password: host.auth_method === 'password' ? host.password || '' : '',
    privateKeyPath: host.private_key_path || '',
    keyPassphrase: host.auth_method === 'key' ? host.password || '' : '',
    tags: host.tags || [],
  };
}

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
