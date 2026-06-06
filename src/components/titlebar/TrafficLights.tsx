import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Square } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import ConfirmDialog from '@/components/sftp/dialogs/ConfirmDialog';

const appWindow = getCurrentWindow();

export default function WindowControls() {
  const { t } = useTranslation();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 pl-3 pr-2">
      <button
        className="flex items-center justify-center w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none group"
        onClick={() => setCloseConfirmOpen(true)}
        title="Close"
      >
        <X size={8} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        className="flex items-center justify-center w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none group"
        onClick={() => appWindow.minimize()}
        title="Minimize"
      >
        <Minus size={8} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        className="flex items-center justify-center w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none group"
        onClick={() => appWindow.toggleMaximize()}
        title="Maximize"
      >
        <Square size={7} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title={t('common.quit')}
        message={t('common.quitConfirm')}
        onConfirm={() => appWindow.close()}
        variant="destructive"
      />
    </div>
  );
}
