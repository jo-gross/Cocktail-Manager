import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaDesktop, FaGripVertical, FaMobileAlt, FaTabletAlt } from 'react-icons/fa';
import { MdStayCurrentLandscape, MdStayCurrentPortrait } from 'react-icons/md';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { Button, ButtonGroup, Card, CardBody, Divider } from '@components/ui';
import {
  CARD_EDITOR_DENSITIES,
  CARD_EDITOR_ORIENTATIONS,
  CARD_EDITOR_TABLET_SIZES,
  CARD_EDITOR_VIEW_MODES,
  CardEditorDensity,
  CardEditorDevice,
  CardEditorOrientation,
  CardEditorTabletSize,
  CardEditorViewMode,
} from './types';

interface CardEditorToolbarProps {
  viewMode: CardEditorViewMode;
  onViewModeChange: (mode: CardEditorViewMode) => void;
  isArchived?: boolean;
  isSubmitting?: boolean;
  onAddGroup?: () => void;
  onSave?: () => void;
  device?: CardEditorDevice;
  onDeviceChange?: (device: CardEditorDevice) => void;
  density?: CardEditorDensity;
  onDensityChange?: (density: CardEditorDensity) => void;
  orientation?: CardEditorOrientation;
  onOrientationChange?: (orientation: CardEditorOrientation) => void;
  tabletSize?: CardEditorTabletSize;
  onTabletSizeChange?: (tabletSize: CardEditorTabletSize) => void;
  /** Predicate returning true when a device option is wider than the available viewport. */
  isDeviceDisabled?: (device: CardEditorDevice) => boolean;
  /** Predicate returning true when a tablet size is wider than the available viewport. */
  isTabletSizeDisabled?: (tabletSize: CardEditorTabletSize) => boolean;
  /** Predicate returning true when an orientation is wider than the available viewport. */
  isOrientationDisabled?: (orientation: CardEditorOrientation) => boolean;
  /** Extra content (e.g. name/date fields) rendered inside the same card below the controls. */
  children?: React.ReactNode;
}

const ORIENTATION_ICONS: Record<CardEditorOrientation, React.ReactNode> = {
  portrait: <MdStayCurrentPortrait />,
  landscape: <MdStayCurrentLandscape />,
};

export function CardEditorToolbar({
  viewMode,
  onViewModeChange,
  isArchived = false,
  isSubmitting = false,
  onAddGroup,
  onSave,
  device,
  onDeviceChange,
  density,
  onDensityChange,
  orientation,
  onOrientationChange,
  tabletSize,
  onTabletSizeChange,
  isDeviceDisabled,
  isTabletSizeDisabled,
  isOrientationDisabled,
  children,
}: CardEditorToolbarProps) {
  const { t } = useTranslation(['manage', 'common']);
  const showPreviewControls = device != undefined && density != undefined;
  const showOrientationControls = showPreviewControls && orientation != undefined && device !== 'desktop';
  const showTabletControls = showPreviewControls && tabletSize != undefined && device === 'tablet';

  const deviceOptions: { id: CardEditorDevice; label: string; icon: React.ReactNode }[] = [
    { id: 'mobile', label: t('mobile'), icon: <FaMobileAlt /> },
    { id: 'tablet', label: t('tablet'), icon: <FaTabletAlt /> },
    { id: 'desktop', label: t('desktop'), icon: <FaDesktop /> },
  ];

  return (
    <Card variant="surface" className="sticky top-0 z-20">
      <CardBody className="gap-3">
        {children != null ? (
          <>
            {children}
            <Divider size="sm" />
          </>
        ) : null}
        <div className="flex flex-row flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">{t('common:display')}</span>
            <ButtonGroup className="w-fit">
              {CARD_EDITOR_VIEW_MODES.map((mode) => (
                <Button key={mode.id} type="button" size="sm" variant={viewMode === mode.id ? 'primary' : 'outline'} onClick={() => onViewModeChange(mode.id)}>
                  {t(mode.labelKey)}
                </Button>
              ))}
            </ButtonGroup>
          </div>
          {showPreviewControls ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">{t('common:layout')}</span>
                <ButtonGroup className="w-fit">
                  {deviceOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={device === option.id ? 'primary' : 'outline'}
                      disabled={device !== option.id && (isDeviceDisabled?.(option.id) ?? false)}
                      onClick={() => onDeviceChange?.(option.id)}
                      aria-label={option.label}
                      title={option.label}
                    >
                      {option.icon}
                      <span className="hidden md:inline">{option.label}</span>
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">{t('rows')}</span>
                <ButtonGroup className="w-fit">
                  {CARD_EDITOR_DENSITIES.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={density === option.id ? 'primary' : 'outline'}
                      onClick={() => onDensityChange?.(option.id)}
                    >
                      {t(option.labelKey)}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
              {showOrientationControls ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-base-content/70">{t('orientation')}</span>
                  <ButtonGroup className="w-fit">
                    {CARD_EDITOR_ORIENTATIONS.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        size="sm"
                        variant={orientation === option.id ? 'primary' : 'outline'}
                        disabled={orientation !== option.id && (isOrientationDisabled?.(option.id) ?? false)}
                        onClick={() => onOrientationChange?.(option.id)}
                        aria-label={t(option.labelKey)}
                        title={t(option.labelKey)}
                      >
                        {ORIENTATION_ICONS[option.id]}
                        <span className="hidden md:inline">{t(option.labelKey)}</span>
                      </Button>
                    ))}
                  </ButtonGroup>
                </div>
              ) : null}
              {showTabletControls ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-base-content/70">{t('tablet')}</span>
                  <ButtonGroup className="w-fit">
                    {CARD_EDITOR_TABLET_SIZES.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        size="sm"
                        variant={tabletSize === option.id ? 'primary' : 'outline'}
                        disabled={tabletSize !== option.id && (isTabletSizeDisabled?.(option.id) ?? false)}
                        onClick={() => onTabletSizeChange?.(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </ButtonGroup>
                </div>
              ) : null}
            </>
          ) : null}
          {!isArchived ? (
            <div className="ml-auto flex items-end gap-2">
              <Button type="button" variant="secondary" size="sm" className="md:h-10" onClick={onAddGroup}>
                {t('addGroup')}
              </Button>
              <Button type="button" variant="primary" size="sm" className="md:h-10" disabled={isSubmitting} onClick={onSave}>
                {t('common:save')}
              </Button>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function DragHandle({ attributes, listeners }: { attributes?: DraggableAttributes; listeners?: SyntheticListenerMap }) {
  const { t } = useTranslation('common');
  return (
    <button
      type="button"
      className="cursor-grab rounded-md p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content active:cursor-grabbing"
      aria-label={t('dragToSort')}
      {...attributes}
      {...listeners}
    >
      <FaGripVertical />
    </button>
  );
}
