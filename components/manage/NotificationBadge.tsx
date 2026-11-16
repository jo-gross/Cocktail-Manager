import { useTranslation } from 'react-i18next';
import { cn } from '@components/ui/cn';

export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation('nav');
  if (count <= 0) return null;
  return (
    <span
      aria-label={t('openTodos', { count })}
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-primary px-1 text-[11px] font-semibold text-primary-content',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
