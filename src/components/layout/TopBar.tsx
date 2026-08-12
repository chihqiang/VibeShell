import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Square } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const appWindow = getCurrentWindow();

/** 窗口控制按钮（红黄绿三色圆点） */
function WindowControls() {
  const { t } = useTranslation();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5 pl-3 pr-2">
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none group"
          onClick={() => setCloseConfirmOpen(true)}
          title={t('topbar.close')}
        >
          <X size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none group"
          onClick={() => appWindow.minimize()}
          title={t('topbar.minimize')}
        >
          <Minus size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none group"
          onClick={() => appWindow.toggleMaximize()}
          title={t('topbar.maximize')}
        >
          <Square size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title={t('common.quit')}
        message={t('common.quitConfirm')}
        onConfirm={() => appWindow.close()}
        variant="destructive"
      />
    </>
  );
}

/** 顶部导航栏 — 窗口控制 */
export function TopBar() {
  return (
    <div className="flex items-center w-full h-full">
      <WindowControls />
      <div className="flex-1 h-full flex items-center px-3 gap-2" data-tauri-drag-region>
        <div className="flex-1 flex items-center" data-tauri-drag-region />
      </div>
    </div>
  );
}
