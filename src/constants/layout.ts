/** 布局尺寸常量 */

/** Activity Bar 宽度 */
export const ACTIVITY_BAR_WIDTH = 48;

/** 侧边栏面板最小宽度 */
export const SIDE_PANEL_MIN_WIDTH = 200;

/** 侧边栏面板最大宽度 */
export const SIDE_PANEL_MAX_WIDTH = 500;

/** 侧边栏面板默认宽度 */
export const SIDE_PANEL_DEFAULT_WIDTH = 260;

/** SFTP 底部面板最小高度 */
export const BOTTOM_PANEL_MIN_HEIGHT = 80;

/** SFTP 底部面板默认高度 */
export const BOTTOM_PANEL_DEFAULT_HEIGHT = 260;

/** 监控面板宽度 */
export const MONITOR_DRAWER_WIDTH = 300;

/** 终端默认字体大小 */
export const TERM_DEFAULT_FONT_SIZE = 13;

/** 终端最小字体大小 */
export const TERM_MIN_FONT_SIZE = 8;

/** 终端最大字体大小 */
export const TERM_MAX_FONT_SIZE = 32;

/** 终端字体 */
export const TERM_FONT_FAMILY = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/** 终端遮罩背景色 */
export const TERM_OVERLAY_BG = 'rgba(0,0,0,0.55)';

/** 终端遮罩模糊度 */
export const TERM_OVERLAY_BLUR = 'blur(2px)';

/** SFTP 文件列表行高 (px) */
export const SFTP_ROW_HEIGHT = 28;

/** SFTP 文件夹上传时的回退名称 */
export const SFTP_FALLBACK_FOLDER_NAME = 'folder';

/** SFTP 表格列宽模板（CSS grid-template-columns 值） */
export const SFTP_GRID_COLS = '1fr 70px 90px 100px 140px';

/** 监控历史数据最大保留条数 */
export const MONITOR_MAX_HISTORY = 30;

/** 监控进度条阈值 — 警告色 */
export const MONITOR_WARN_THRESHOLD = 50;

/** 监控进度条阈值 — 危险色 */
export const MONITOR_DANGER_THRESHOLD = 80;

/** 磁盘使用率阈值 — 警告色 */
export const MONITOR_DISK_WARN_THRESHOLD = 70;

/** 磁盘使用率阈值 — 危险色 */
export const MONITOR_DISK_DANGER_THRESHOLD = 90;

/** 监控进度条颜色 */
export const MONITOR_COLORS = {
  normal: '#22c55e',
  warn: '#f59e0b',
  danger: '#ef4444',
} as const;

/** 监控 Sparkline 宽度 */
export const SPARKLINE_WIDTH = 100;

/** 监控 Sparkline 高度 */
export const SPARKLINE_HEIGHT = 20;

/** 进程列表最大显示数 */
export const PROCESS_MAX_DISPLAY = 8;
