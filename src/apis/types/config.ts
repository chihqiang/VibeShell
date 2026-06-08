export interface AppConfig {
  data_path: string;
  keys_path: string;
  ssh_defaults: SshDefaultsData;
}

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
