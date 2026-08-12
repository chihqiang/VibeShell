import { writeText as tauriWriteText, readText as tauriReadText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * 剪贴板工具 —— 基于 @tauri-apps/plugin-clipboard-manager。
 * 相比 navigator.clipboard，走 Tauri 原生系统剪贴板 API，
 * 不受 WebView 权限/焦点限制，跨平台更稳定。
 */

/** 复制文本到剪贴板 */
export async function copyText(text: string): Promise<void> {
  await tauriWriteText(text);
}

/** 从剪贴板读取文本 */
export async function pasteText(): Promise<string> {
  return tauriReadText();
}
