/** 应用级常量 */

export const APP_NAME = 'VibeShell';

/** SFTP 协议标签 */
export const SFTP_LABEL = 'SFTP';

/** 文件大小计算基数 */
export const FILE_SIZE_BASE = 1024;

/** 文件大小单位 */
export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** NProgress 配置 */
export const NPROGRESS_CONFIG = {
  minimum: 0.1,
  easing: 'ease',
  speed: 400,
  showSpinner: false,
  trickle: true,
  trickleSpeed: 200,
} as const;

/** 默认 SSH 端口 */
export const DEFAULT_SSH_PORT = 22;

/** 默认监控刷新间隔（秒） */
export const DEFAULT_MONITOR_INTERVAL = 4;

/** 默认心跳间隔（秒） */
export const DEFAULT_HEARTBEAT_INTERVAL = 10;

/** 默认重连最大次数 */
export const DEFAULT_RECONNECT_MAX_RETRIES = 10;

/** 默认重连初始延迟（秒） */
export const DEFAULT_RECONNECT_INITIAL_DELAY = 1;

/** 默认重连最大延迟（秒） */
export const DEFAULT_RECONNECT_MAX_DELAY = 30;

/** 传输并发数 */
export const TRANSFER_CONCURRENCY = 4;

/** Toast 默认显示时长 (ms) */
export const TOAST_DEFAULT_DURATION = 3000;

/** Toast 退出动画延迟 (ms) */
export const TOAST_DISMISS_DELAY = 200;

/** GitHub 仓库地址 */
export const GITHUB_URL = 'https://github.com/chihqiang/VibeShell';

/** 更新检查超时 (ms) */
export const UPDATE_CHECK_TIMEOUT_MS = 30_000;

/** 更新下载超时 (ms) */
export const UPDATE_DOWNLOAD_TIMEOUT_MS = 300_000;

/** 更新检查最大重试次数 */
export const UPDATE_MAX_RETRIES = 3;

/** 更新检查重试延迟 (ms) */
export const UPDATE_RETRY_DELAY_MS = 2000;

/** 设置表单防抖延迟 (ms) */
export const SETTINGS_DEBOUNCE_MS = 600;

/** 复制按钮反馈显示时长 (ms) */
export const COPY_FEEDBACK_DELAY = 1500;
