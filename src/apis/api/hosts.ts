import { invoke } from '@/lib/api';
import type { HostConfig } from '@/apis/types/hosts';

export function listHosts(): Promise<HostConfig[]> {
  return invoke('list_hosts');
}

export function saveHost(params: { host: HostConfig }): Promise<void> {
  return invoke('save_host', params);
}

export function deleteHost(params: { id: string }): Promise<void> {
  return invoke('delete_host', params);
}

export function listGroups(): Promise<string[]> {
  return invoke('list_groups');
}

export function saveGroup(params: { group: string }): Promise<void> {
  return invoke('save_group', params);
}

export function deleteGroup(params: { group: string }): Promise<void> {
  return invoke('delete_group', params);
}
