import { invoke } from '@/utils/invoke';
import type { SshConnectResult, ConnectConfig } from '@/types/host';

/** 建立 SSH 连接（前端组装完整连接参数传入，后端不再查询任何存储） */
export function sshQuickConnect(params: ConnectConfig): Promise<SshConnectResult> {
  return invoke('ssh_quick_connect', params);
}

/** 测试 SSH 连接（直接传参，用于快速连接/测试） */
export function sshTestConnect(params: ConnectConfig): Promise<string> {
  return invoke('ssh_test_connect', params);
}

/** 测试代理配置连通性（通过代理建立 SOCKS5 隧道并连接公共目标） */
export function proxyTestConnect(params: {
  hostname: string;
  port: number;
  username: string;
  password: string;
}): Promise<string> {
  return invoke('proxy_test_connect', params);
}

/** 断开 SSH 连接 */
export function sshDisconnect(params: { tabId: string }): Promise<void> {
  return invoke('ssh_disconnect', params);
}

/** 向终端写入数据 */
export function sshWrite(params: { tabId: string; data: string }): Promise<void> {
  return invoke('ssh_write', params);
}
