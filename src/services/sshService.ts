import { invoke } from '@/utils/invoke';
import type { SshConnectResult, SshConnectParams } from '@/types/host';

/** 建立 SSH 连接 */
export function sshConnect(params: SshConnectParams): Promise<SshConnectResult> {
  return invoke('ssh_connect', params);
}

/** 测试 SSH 连接 */
export function sshTestConnect(params: Omit<SshConnectParams, 'tabId'>): Promise<string> {
  return invoke('ssh_test_connect', params);
}

/** 断开 SSH 连接 */
export function sshDisconnect(params: { tabId: string }): Promise<void> {
  return invoke('ssh_disconnect', params);
}

/** 向终端写入数据 */
export function sshWrite(params: { tabId: string; data: string }): Promise<void> {
  return invoke('ssh_write', params);
}
