/** 自定义 DOM 事件名（window.dispatchEvent / addEventListener） */
export const DOM_EVENTS = {
  /** 主机列表变更（增删改） */
  HOSTS_CHANGED: 'vibeshell:hosts-changed',
  /** 终端写入（外部向特定 tab 写入文本） */
  TERM_WRITE: 'vibeshell:term-write',
  /** 终端主题变更 */
  TERM_THEME_CHANGE: 'vibeshell:term-theme-change',
  /** 终端重新适配（面板开合导致容器尺寸变化时触发） */
  TERM_REFIT: 'vibeshell:term-refit',
} as const;

/** Tauri 后端事件名（listen / emit） */
export const TAURI_EVENTS = {
  /** SSH 终端输出 */
  SSH_OUTPUT: 'ssh://output',
  /** SSH 心跳保活检测 */
  SSH_HEARTBEAT: 'ssh://heartbeat',
  /** SSH 服务器监控数据 */
  SSH_MONITOR: 'ssh://monitor',
  /** SFTP 传输进度 */
  SFTP_TRANSFER_PROGRESS: 'sftp://transfer-progress',
} as const;
