/** 主机相关类型定义 */

import type { AuthMethod } from './common';
import type { ProxyConfig } from './config';

/** 主机配置（创建/编辑/表单共用，映射后端数据结构） */
export interface HostConfig {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  password: string;
  key_id: string;
  key_passphrase: string;
  created_at: number;
  updated_at: number;
  last_connected_at: number | null;
}

/** 连接参数（运行时 SSH 参数，测试连接/建连共用） */
export interface ConnectConfig {
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  privateKeyPath: string | null;
  /** 仅建连时使用（ssh_quick_connect），测试连接可不传 */
  tabId?: string;
  monitorIntervalSecs?: number;
  heartbeatIntervalSecs?: number;
  idleTimeoutSecs?: number;
  /** 代理配置（可选，未传则直连） */
  proxy?: ProxyConfig | null;
}

/** SSH 连接结果 */
export interface SshConnectResult {
  id: string;
  banner: string;
  /** 实际连接通道：走代理时为 "host:port"，直连为 null/undefined */
  via_proxy?: string | null;
}

/** 解析后的 SSH 命令 */
export interface ParsedSshCommand {
  username: string;
  hostname: string;
  port: number;
  password: string | null;
  privateKeyPath: string | null;
}
