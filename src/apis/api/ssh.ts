import { invoke } from '@/lib/api';
import type { SshConnectResult, SshConnectParams } from '@/apis/types/ssh';

export function sshConnect(params: SshConnectParams): Promise<SshConnectResult> {
  return invoke('ssh_connect', params);
}

export function sshTestConnect(params: Omit<SshConnectParams, 'tabId'>): Promise<string> {
  return invoke('ssh_test_connect', params);
}

export function sshDisconnect(params: { tabId: string }): Promise<void> {
  return invoke('ssh_disconnect', params);
}

export function sshRead(params: { tabId: string }): Promise<string> {
  return invoke('ssh_read', params);
}

export function sshWrite(params: { tabId: string; data: string }): Promise<void> {
  return invoke('ssh_write', params);
}
