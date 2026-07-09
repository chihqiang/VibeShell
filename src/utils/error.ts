/** 将未知错误转为字符串消息 */
export function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
