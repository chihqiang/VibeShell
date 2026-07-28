/** 密钥相关类型定义 */

/** 密钥条目 */
export interface KeyEntry {
  id: string;
  name: string;
  key_type: string;
  content: string;
  password?: string | null;
}

/** 通过文件路径导入密钥的参数 */
export interface ImportKeyParams {
  sourcePath: string;
  name: string | null;
  password: string | null;
}

/** 通过内容导入密钥的参数 */
export interface ImportKeyContentParams {
  content: string;
  name: string;
  password: string | null;
}
