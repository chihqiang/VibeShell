/** 应用配置类型定义 */

/** 应用配置 */
export interface AppConfig {
  data_path: string;
  keys_path: string;
  ssh_defaults: SshDefaultsData;
}

/** SSH 默认配置 */
export interface SshDefaultsData {
  hostname: string;
  username: string;
  port: number;
  monitorInterval: number;
  heartbeatInterval: number;
  reconnectEnabled: boolean;
  reconnectMaxRetries: number;
  reconnectInitialDelay: number;
  reconnectMaxDelay: number;
}
