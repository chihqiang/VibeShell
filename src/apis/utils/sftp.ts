import { sftpListLocalFiles, sftpIsDirectory } from '@/apis/api/sftp';
import type { ExpandedFile, ExpandResult } from '@/apis/types/sftp';

export async function expandLocalFiles(
  paths: string[],
  baseRemotePath: string,
  options?: { fallbackName?: string },
): Promise<ExpandResult> {
  const fallbackName = options?.fallbackName ?? 'file';
  const files: ExpandedFile[] = [];
  const failures: ExpandResult['failures'] = [];

  await Promise.all(paths.map(async (p) => {
    const name = p.split('/').pop() || p.split('\\').pop() || fallbackName;
    const baseRc = baseRemotePath.replace(/\/?$/, '/') + name;
    try {
      const filesList = await sftpListLocalFiles({ path: p });
      if (filesList.length === 0) {
        failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.empty' });
      } else if (filesList.length === 1 && filesList[0][1] === p) {
        const isDir = await sftpIsDirectory({ path: p }).catch(() => false);
        if (isDir) {
          failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.cantReadDir' });
        } else {
          const [, , fileSize] = filesList[0];
          files.push({ localPath: p, remotePath: baseRc, name, fileSize });
        }
      } else {
        for (const [relName, fullPath, fileSize] of filesList) {
          files.push({ localPath: fullPath, remotePath: baseRc + '/' + relName, name: relName, fileSize });
        }
      }
    } catch (e) {
      failures.push({ name, localPath: p, remotePath: baseRc, error: String(e) });
    }
  }));

  return { files, failures };
}
