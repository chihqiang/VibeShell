import { useNavigate, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HeaderActions() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex items-center gap-1 px-2 h-full">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => navigate('/settings')}
        data-active={location.pathname === '/settings' ? '' : undefined}
        className="data-active:bg-muted data-active:text-foreground"
        title="Settings"
      >
        <Settings size={16} />
      </Button>
    </div>
  );
}
