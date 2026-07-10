/** 通用类型定义 */

/** Tauri 命令返回结果 */
export interface CommandResult<T> {
  success: boolean;
  data: T;
  message: string;
}

/** 认证方式 */
export type AuthMethod = 'password' | 'key';

/** 连接状态 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/** 导入模式 */
export type ImportMode = 'file' | 'paste';

/** 传输方向 */
export type TransferDirection = 'upload' | 'download';

/** 传输状态 */
export type TransferStatus = 'pending' | 'uploading' | 'downloading' | 'paused' | 'completed' | 'failed';

/** SFTP 传输进度阶段 */
export type SftpProgressPhase = 'uploading' | 'downloading';

/** 日志级别 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** 主题类型 */
export type Theme = 'dark' | 'light' | 'auto';

/** 语言枚举 */
export enum Language {
  ZH = 'zh',
  EN = 'en',
}
