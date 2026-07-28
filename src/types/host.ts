/** 主机相关类型定义 */

import type { AuthMethod } from './common';

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
  tags: string[];
  created_at: number;
  updated_at: number;
  last_connected_at: number | null;
}

/** 快速连接参数（未保存的主机） */
export interface ConnectConfig {
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  privateKeyPath: string | null;
}

/** SSH 连接参数（已保存主机，后端查 DB） */
export interface SshConnectParams {
  tabId: string;
  hostId: string;
  monitorIntervalSecs?: number;
  heartbeatIntervalSecs?: number;
}

/** SSH 连接结果 */
export interface SshConnectResult {
  id: string;
  banner: string;
}

/** 解析后的 SSH 命令 */
export interface ParsedSshCommand {
  username: string;
  hostname: string;
  port: number;
  password: string | null;
  privateKeyPath: string | null;
}
