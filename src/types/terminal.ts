/** 终端 Tab 相关类型定义 */

import type { ConnectionStatus } from './common';
import type { HostConfig, ConnectConfig } from './host';

/** 基础 Tab */
export interface BaseTab {
  id: string;
  status: ConnectionStatus;
  title: string;
}

/** 快速连接 Tab */
export interface QuickTab extends BaseTab {
  type: 'quick';
}

/** 终端 Tab */
export interface TerminalTabData extends BaseTab {
  type: 'terminal';
  host?: HostConfig;
  connectConfig: ConnectConfig;
}

/** 终端 Tab 联合类型 */
export type TerminalTab = QuickTab | TerminalTabData;
