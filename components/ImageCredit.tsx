import React from 'react';
import { useTranslation } from 'react-i18next';
import { imageCreditUrl, shortImageCredit } from '@lib/images/imageCredit';
import { cn } from '@components/ui/cn';

interface ImageCreditProps {
  credit: string | null | undefined;
  /** `overlay`: on the bottom edge of a large image (parent needs `relative`); `caption`: below an image. */
  variant?: 'overlay' | 'caption';
  className?: string;
}

/**
 * Unobtrusive attribution of an image ("Foto: Author · License"); the full credit (with the
 * source link) opens on click, the hover title shows it too. Renders nothing without a credit.
 */
export function ImageCredit({ credit, variant = 'caption', className }: ImageCreditProps) {
  const { t } = useTranslation('common');
  if (!credit) return null;
  const url = imageCreditUrl(credit);
  return (
    <details
      className={cn(
        'text-[10px] leading-tight',
        variant === 'overlay' ? 'absolute right-0 bottom-0 left-0 rounded-b-xl bg-black/55 px-2 py-0.5 text-white open:pb-1.5' : 'mt-1 text-base-content/70',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <summary className={'cursor-pointer list-none truncate [&::-webkit-details-marker]:hidden'} title={credit}>
        {t('imageCredit.photo', { credit: shortImageCredit(credit) })}
      </summary>
      <div className={'mt-0.5 break-words whitespace-normal'}>
        {credit}
        {url && (
          <>
            {' '}
            <a className={'underline'} href={url} target={'_blank'} rel={'noopener noreferrer nofollow'}>
              {t('imageCredit.source')}
            </a>
          </>
        )}
      </div>
    </details>
  );
}
