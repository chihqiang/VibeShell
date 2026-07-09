/** 应用级常量 */

export const APP_NAME = 'VibeShell';

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

/** 传输并发数 */
export const TRANSFER_CONCURRENCY = 4;

/** Toast 默认显示时长 (ms) */
export const TOAST_DEFAULT_DURATION = 3000;

/** Toast 退出动画延迟 (ms) */
export const TOAST_DISMISS_DELAY = 200;
