/** 所有 localStorage 键名集中管理 */

export const STORAGE_KEYS = {
  /** 主题 */
  THEME: 'vibeshell-theme',
  /** 语言 */
  LANGUAGE: 'vibeshell-language',
  /** 终端主题 */
  TERMINAL_THEME: 'vibeshell-term-theme',
  /** SFTP 面板展开状态 */
  SFTP_OPEN: 'vibeshell-sftp-open',
  /** 监控面板展开状态 */
  MONITOR_OPEN: 'vibeshell-monitor-open',
  /** 侧边栏面板宽度 */
  SIDE_PANEL_WIDTH: 'vibeshell-sidepanel-width',
  /** SFTP 面板高度 */
  SFTP_HEIGHT: 'vibeshell-sftp-height',
  /** SFTP 传输记录 */
  SFTP_TRANSFERS: 'sftp-transfers-latest',
  /** 用户组缓存前缀 */
  USERS_GROUPS_CACHE_PREFIX: 'vibeshell-ug-cache-',
  /** 应用配置缓存 */
  CONFIG_APP: 'config_app',
  /** SSH 默认配置缓存 */
  CONFIG_SSH_DEFAULTS: 'config_ssh_defaults',
} as const;
