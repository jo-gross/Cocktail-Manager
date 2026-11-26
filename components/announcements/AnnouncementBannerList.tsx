import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { Alert, type AlertVariant } from '@components/ui';
import { pickAnnouncementText, type AnnouncementLevel } from '@lib/announcements/text';
import { withoutDismissed } from '@lib/announcements/dismissal';
import type { AnnouncementDto } from '@lib/schemas/announcements';

const LEVEL_VARIANT: Record<AnnouncementLevel, AlertVariant> = { info: 'info', warning: 'warning', critical: 'error' };
const LEVEL_ICON: Record<AnnouncementLevel, React.ReactNode> = {
  info: <FaInfoCircle />,
  warning: <FaExclamationTriangle />,
  critical: <FaExclamationCircle />,
};

interface AnnouncementBannerListProps {
  announcements: readonly AnnouncementDto[];
  /** Dismissal keys (`dismissalKey`) of this browser. */
  dismissed: readonly string[];
  /** UI language; the text of an announcement is shown in it. */
  locale: string;
  onDismiss: (announcement: AnnouncementDto) => void;
  className?: string;
}

/**
 * Announcements of the hosting provider as banners: the level sets the colour, and only `info` announcements can be
 * dismissed. Renders nothing without announcements (always on self-hosted instances).
 */
export function AnnouncementBannerList({ announcements, dismissed, locale, onDismiss, className = '' }: AnnouncementBannerListProps) {
  const { t } = useTranslation('common');
  const visible = withoutDismissed(announcements, dismissed);
  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 px-2 pt-2 print:hidden ${className}`} data-testid="announcement-banners">
      {visible.map((announcement) => (
        <Alert
          key={announcement.id}
          variant={LEVEL_VARIANT[announcement.level]}
          icon={LEVEL_ICON[announcement.level]}
          // Info is read out politely; warnings and critical announcements interrupt.
          role={announcement.level === 'info' ? 'status' : 'alert'}
          data-level={announcement.level}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 whitespace-pre-line">
              {announcement.title && <div className="font-semibold">{pickAnnouncementText(announcement.title, locale)}</div>}
              <div>{pickAnnouncementText(announcement.body, locale)}</div>
            </div>
            {announcement.dismissible && (
              <button
                type="button"
                className="-m-1 shrink-0 cursor-pointer rounded p-1 opacity-80 hover:opacity-100"
                aria-label={t('announcements.dismiss')}
                title={t('announcements.dismiss')}
                onClick={() => onDismiss(announcement)}
              >
                <FaTimes />
              </button>
            )}
          </div>
        </Alert>
      ))}
    </div>
  );
}

export default AnnouncementBannerList;
