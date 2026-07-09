/** 路由路径常量 */

export const ROUTE_PATHS = {
  /** 首页（终端） */
  HOME: '/',
  /** 主机管理 */
  HOSTS: '/hosts',
  /** 密钥管理 */
  KEYS: '/keys',
  /** 设置 */
  SETTINGS: '/settings',
  /** SFTP 文件管理 */
  SFTP: '/sftp',
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

/** 路由标题映射 */
export const ROUTE_TITLES: Record<string, string> = {
  [ROUTE_PATHS.HOME]: 'Terminal',
  [ROUTE_PATHS.HOSTS]: 'Hosts',
  [ROUTE_PATHS.KEYS]: 'Keys',
  [ROUTE_PATHS.SETTINGS]: 'Settings',
  [ROUTE_PATHS.SFTP]: 'SFTP',
};
