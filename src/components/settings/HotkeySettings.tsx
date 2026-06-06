import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeyStorage } from '@/hooks/use-hotkey';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getHotkeyDefaults,
  getHotkeyActions,
  formatKeyBinding,
  keyBindingFromEvent,
  keyBindingsMatch,
  type HotkeyAction,
  type HotkeyActionDef,
} from '@/storage/config';

interface HotkeySettingsProps {
  onSaved: () => void;
}

export function HotkeySettings({ onSaved }: HotkeySettingsProps) {
  const { t } = useTranslation();
  const [bindings, setBindings] = useHotkeyStorage();
  const [recording, setRecording] = useState<HotkeyAction | null>(null);
  const [actions, setActions] = useState<HotkeyActionDef[]>([]);
  const [defaults, setDefaults] = useState<Record<string, HotkeyActionDef['defaultBinding']>>({});

  useEffect(() => {
    (async () => {
      setActions(await getHotkeyActions());
      setDefaults(await getHotkeyDefaults());
    })();
  }, []);

  const handleStartRecord = (action: HotkeyAction) => {
    setRecording(action);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const kb = keyBindingFromEvent(e);
      if (!kb) return;

      setBindings({ ...bindings, [action]: kb });
      setRecording(null);
      onSaved();
      document.removeEventListener('keydown', handler, true);
    };

    // Use capture phase so we get it before any other handler
    document.addEventListener('keydown', handler, true);
  };

  const handleReset = (action: HotkeyAction) => {
    const def = defaults[action];
    if (!def) return;
    if (keyBindingsMatch(bindings[action] || def, def)) return;
    setBindings({ ...bindings, [action]: { ...def } });
    onSaved();
  };

  const handleResetAll = () => {
    setBindings({ ...defaults });
    onSaved();
  };

  const allDefault = actions.every((a) => {
    const current = bindings[a.id] || defaults[a.id];
    const def = defaults[a.id];
    return def && keyBindingsMatch(current, def);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.keyboard')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((a) => {
          const current = bindings[a.id] || defaults[a.id];
          const def = defaults[a.id];
          const isDefault = def && keyBindingsMatch(current, def);
          const isRecording = recording === a.id;

          if (!def) return null;

          return (
            <div key={a.id} className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground">{t(a.labelKey)}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleStartRecord(a.id)}
                  className={`
                    h-7 px-3 text-xs rounded-md border font-mono cursor-pointer transition-colors min-w-[100px]
                    ${
                      isRecording
                        ? 'bg-primary/10 border-primary text-primary animate-pulse'
                        : 'bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  {isRecording ? t('settings.hotkeys.recording') : formatKeyBinding(current)}
                </button>
                {!isDefault && (
                  <Button variant="ghost" size="xs" onClick={() => handleReset(a.id)}>
                    {t('settings.hotkeys.reset')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!allDefault && (
          <div className="pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={handleResetAll}>
              {t('settings.hotkeys.resetAll')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
