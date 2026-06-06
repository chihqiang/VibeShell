export interface SshConnectResult {
  id: string;
  banner: string;
}

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
