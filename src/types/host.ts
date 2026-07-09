/** 主机相关类型定义 */

import type { AuthMethod } from './common';

/** 主机配置（后端数据结构） */
export interface HostConfig {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  password?: string | null;
  private_key_path?: string | null;
  tags?: string[];
  created_at: number;
  updated_at: number;
  last_connected_at?: number | null;
}

/**
 * 统一的主机表单数据。
 * 用于：
 * - 主机编辑弹窗（含标签）
 * - 快速连接弹窗（标签默认为 []）
 * - SFTP 连接传递
 */
export interface HostFormState {
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password: string;
  privateKeyPath: string;
  keyPassphrase: string;
  tags: string[];
}

/** SSH 连接配置（运行时参数） */
export interface ConnectConfig {
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  privateKeyPath: string | null;
}

/** SSH 连接结果 */
export interface SshConnectResult {
  id: string;
  banner: string;
}

/** SSH 连接参数 */
export interface SshConnectParams {
  tabId: string;
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  privateKeyPath: string | null;
  monitorIntervalSecs?: number;
  heartbeatIntervalSecs?: number;
}

/** 解析后的 SSH 命令 */
export interface ParsedSshCommand {
  username: string;
  hostname: string;
  port: number;
  password: string | null;
  privateKeyPath: string | null;
}
