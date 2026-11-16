import Image from 'next/image';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown } from 'react-icons/lu';
import { Button } from '@components/ui';
import { NotificationBadge } from './NotificationBadge';

/** Compact account tile: square portrait, readable identity and an explicit menu affordance. */
export function ManageProfileButton({
  name,
  image,
  role,
  pendingCount = 0,
  buttonRef,
}: {
  name: string;
  image?: string | null;
  role?: string;
  pendingCount?: number;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation('nav');
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();

  return (
    // Override the button's fixed height and horizontal padding so every portrait inset matches the text gap.
    <Button
      ref={buttonRef}
      type="button"
      variant="outline"
      aria-label={`${t('profileMenu', { name })}${pendingCount > 0 ? `, ${t('openTodos', { count: pendingCount })}` : ''}`}
      className="relative h-auto! gap-1! p-1! text-left"
    >
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-base-200 text-sm font-semibold">
        {image && image !== failedImage ? (
          <Image src={image} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" onError={() => setFailedImage(image)} />
        ) : (
          initials
        )}
      </span>
      <span className="hidden min-w-0 flex-col items-start gap-0.5 leading-tight md:flex">
        <span className="max-w-40 truncate">{name}</span>
        {role && <span className="text-[11px] font-normal tracking-wide text-base-content/60">{role}</span>}
      </span>
      <LuChevronDown aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-base-content/50 transition-transform group-focus-within:rotate-180 md:block" />
      <NotificationBadge count={pendingCount} className="pointer-events-none absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 ring-2 ring-base-100" />
    </Button>
  );
}
