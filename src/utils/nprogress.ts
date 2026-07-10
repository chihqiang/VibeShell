import NProgress from 'nprogress';
import { NPROGRESS_CONFIG } from '@/constants/app';

NProgress.configure(NPROGRESS_CONFIG);

/** 启动进度条 */
export function startProgress(): void {
  NProgress.start();
}

/** 完成进度条 */
export function doneProgress(): void {
  NProgress.done();
}

export default NProgress;
