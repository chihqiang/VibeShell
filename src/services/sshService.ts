import { invoke } from '@/utils/invoke';
import type { SshConnectResult, SshConnectParams, ConnectConfig } from '@/types/host';

/** 建立 SSH 连接（通过已保存主机的 hostId） */
export function sshConnect(params: SshConnectParams): Promise<SshConnectResult> {
  return invoke('ssh_connect', params);
}

/** 测试 SSH 连接（直接传参，用于快速连接/测试） */
export function sshTestConnect(params: ConnectConfig): Promise<string> {
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
