import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaDownload, FaEllipsisV, FaLink, FaLock, FaPen, FaPlus, FaStar, FaRegStar, FaTrash } from 'react-icons/fa';
import { Role } from '@generated/prisma/client';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { EntityNameLink } from '@components/manage/EntityNameLink';
import { Alert, Badge, Button, Card, CardBody, cn, Divider, Dropdown, DropdownContent, Menu, MenuItem, Skeleton, Toggle } from '@components/ui';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { CreateGuestMenuModal } from '@components/guest-menu/manage/CreateGuestMenuModal';
import { AccessCodeModal } from '@components/guest-menu/manage/AccessCodeSettings';
import { MENU_COLORS, ScheduleTimeline } from '@components/guest-menu/manage/ScheduleTimeline';
import { DragHandle, SortableList } from '@components/guest-menu/builder/SortableList';
import { useWeekdayNames } from '@components/guest-menu/builder/SchedulePanel';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { deleteGuestMenu, duplicateGuestMenu, getGuestMenuQrUrl, getGuestMenus, reorderGuestMenus, updateGuestMenu } from '@lib/network/guestMenus';
import { fetchWorkspaceSettingsSafe } from '@lib/network/workspaces';
import { getWorkspaceTimezone } from '@lib/workspace/workspaceLocaleSettings';
import type { GuestMenuSummaryDto, GuestMenuUpdateInput } from '@lib/schemas/guestMenus';

function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    alertService.success(message);
  } catch {
    alertService.info(text);
  }
}

function GuestMenusPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['guestMenu', 'nav']);
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const weekdayNames = useWeekdayNames();

  const [menus, setMenus] = useState<GuestMenuSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [dayStartTime, setDayStartTime] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    getGuestMenus(workspaceId)
      .then(setMenus)
      .catch((error) => alertApiV1Error(error, t('guestMenu:errors.load')))
      .finally(() => setLoading(false));
  }, [workspaceId, t]);

  useEffect(load, [load]);
  useEffect(() => {
    fetchWorkspaceSettingsSafe(workspaceId, (settings) => {
      setTimezone(getWorkspaceTimezone(settings));
      setDayStartTime(settings.statisticDayStartTime ?? null);
    });
  }, [workspaceId]);

  const publicSlug = userContext.workspace?.publicSlug ?? null;
  const barPath = `/m/${encodeURIComponent(publicSlug ?? workspaceId ?? '')}`;
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language || 'de', { dateStyle: 'medium', timeZone: 'UTC' }), [i18n.language]);
  const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T00:00:00.000Z`));

  const patch = async (menu: GuestMenuSummaryDto, body: GuestMenuUpdateInput) => {
    try {
      await updateGuestMenu(workspaceId!, menu.id, body);
      load();
    } catch (error) {
      alertApiV1Error(error, t('guestMenu:errors.save'));
    }
  };

  const reorder = async (next: GuestMenuSummaryDto[]) => {
    setMenus(next);
    try {
      setMenus(
        await reorderGuestMenus(
          workspaceId!,
          next.map((menu) => menu.id),
        ),
      );
    } catch (error) {
      alertApiV1Error(error, t('guestMenu:errors.save'));
      load();
    }
  };

  const openCreate = () =>
    modalContext.openModal(
      <CreateGuestMenuModal workspaceId={workspaceId!} onCreated={(menu) => router.push(`/workspaces/${workspaceId}/manage/guest-menus/${menu.id}`)} />,
    );

  const duplicate = async (menu: GuestMenuSummaryDto) => {
    try {
      const copyMenu = await duplicateGuestMenu(workspaceId!, menu.id, { name: t('guestMenu:list.copyName', { name: menu.name }) });
      alertService.success(t('guestMenu:list.duplicated'));
      router.push(`/workspaces/${workspaceId}/manage/guest-menus/${copyMenu.id}`);
    } catch (error) {
      alertApiV1Error(error, t('guestMenu:errors.save'));
    }
  };

  const remove = (menu: GuestMenuSummaryDto) =>
    modalContext.openModal(
      <DeleteConfirmationModal
        spelling="DELETE"
        entityName={menu.name}
        onApprove={async () => {
          await deleteGuestMenu(workspaceId!, menu.id);
          load();
        }}
      />,
    );

  const canEdit = userContext.isUserPermitted(Role.MANAGER);
  const openAccess = (menu: GuestMenuSummaryDto) =>
    modalContext.openModal(<AccessCodeModal workspaceId={workspaceId!} menu={menu} name={menu.name} canEdit={canEdit} onUpdated={load} />);

  const scheduleSummary = (menu: GuestMenuSummaryDto): string[] => {
    const parts: string[] = [];
    if (menu.validFrom && menu.validTo) parts.push(t('guestMenu:list.validRange', { from: formatDate(menu.validFrom), to: formatDate(menu.validTo) }));
    else if (menu.validFrom) parts.push(t('guestMenu:list.validFrom', { date: formatDate(menu.validFrom) }));
    else if (menu.validTo) parts.push(t('guestMenu:list.validTo', { date: formatDate(menu.validTo) }));
    if (menu.weekdays.length > 0 && menu.weekdays.length < 7) {
      parts.push(
        weekdayNames
          .filter((entry) => menu.weekdays.includes(entry.day))
          .map((entry) => entry.label)
          .join(', '),
      );
    }
    if (menu.timeFrom || menu.timeTo) parts.push(t('guestMenu:list.timeRange', { from: menu.timeFrom ?? '00:00', to: menu.timeTo ?? '24:00' }));
    return parts;
  };

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={t('guestMenu:title')}
      actions={
        canEdit ? (
          <Button
            variant="primary"
            shape="square"
            size="sm"
            className="md:h-10 md:min-h-10 md:w-10"
            onClick={openCreate}
            aria-label={t('guestMenu:newMenu')}
            title={t('guestMenu:newMenu')}
          >
            <FaPlus />
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('guestMenu:description')}</p>

        {!publicSlug && (
          <Alert variant="info" className="text-sm">
            <div className="flex flex-col gap-1">
              <span>{t('guestMenu:list.noPublicSlug')}</span>
              {userContext.isUserPermitted(Role.ADMIN) && (
                <Link href={`/workspaces/${workspaceId}/manage/settings/public`} className="link font-semibold">
                  {t('guestMenu:list.openSettings')}
                </Link>
              )}
            </div>
          </Alert>
        )}

        <Card>
          <CardBody className="flex flex-row flex-wrap items-center gap-2">
            <FaLink className="text-base-content/60" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{t('guestMenu:list.barLink')}</span>
              <span className="truncate font-mono text-xs text-base-content/70">{`${origin()}${barPath}`}</span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(`${origin()}${barPath}`, t('guestMenu:linkCopied'))}>
              <FaCopy /> {t('guestMenu:copyLink')}
            </Button>
            {menus[0] && (
              <a
                href={getGuestMenuQrUrl(workspaceId!, menus[0].id, 'bar')}
                download={`${publicSlug ?? 'menu'}-qr.svg`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-base-300 px-3 text-sm hover:bg-base-200"
              >
                <FaDownload /> {t('guestMenu:downloadQr')}
              </a>
            )}
          </CardBody>
        </Card>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-base-content/70">{t('guestMenu:list.empty')}</p>
            {canEdit && (
              <Button variant="primary" onClick={openCreate}>
                <FaPlus /> {t('guestMenu:newMenu')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-base-content/60">{t('guestMenu:priorityHelp')}</p>
            <SortableList
              items={menus}
              getId={(menu) => menu.id}
              disabled={!canEdit}
              onReorder={reorder}
              className="gap-2"
              renderItem={(menu, handle) => {
                const index = menus.findIndex((entry) => entry.id === menu.id);
                const schedule = scheduleSummary(menu);
                const menuUrl = `${origin()}${menu.publicPath}`;
                return (
                  <div className={cn('flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-2 md:p-3', !menu.enabled && 'opacity-70')}>
                    <DragHandle {...handle} label={t('guestMenu:reorder')} />
                    <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: MENU_COLORS[index % MENU_COLORS.length] }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EntityNameLink href={`/workspaces/${workspaceId}/manage/guest-menus/${menu.id}`} className="min-w-0 truncate font-semibold">
                          {menu.name}
                        </EntityNameLink>
                        {menu.isActive && (
                          <Badge size="sm" variant="primary">
                            {t('guestMenu:status.active')}
                          </Badge>
                        )}
                        {menu.isPublished ? (
                          <Badge size="sm" variant={menu.hasUnpublishedChanges ? 'warning' : 'success'}>
                            {menu.hasUnpublishedChanges ? t('guestMenu:unpublishedChanges') : t('guestMenu:published')}
                          </Badge>
                        ) : (
                          <Badge size="sm" variant="ghost">
                            {t('guestMenu:builder.status.draft')}
                          </Badge>
                        )}
                        {!menu.validity.valid && menu.validity.reason && menu.validity.reason !== 'unpublished' && (
                          <Badge size="sm" variant="neutral">
                            {t(`guestMenu:status.${menu.validity.reason}`)}
                          </Badge>
                        )}
                        {menu.hasAccessCode && (
                          <button type="button" onClick={() => openAccess(menu)} title={t('guestMenu:access.badgeHint')} className="inline-flex">
                            <Badge size="sm" variant="warning">
                              <FaLock /> {t('guestMenu:access.badge')}
                            </Badge>
                          </button>
                        )}
                        {menu.validity.valid && !menu.isActive && (
                          <Badge size="sm" variant="ghost">
                            {t('guestMenu:status.valid')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-base-content/60">
                        <span className="font-mono">{menu.publicPath}</span>
                        {schedule.length > 0 ? schedule.map((part) => <span key={part}>{part}</span>) : <span>{t('guestMenu:list.always')}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patch(menu, { isDefault: !menu.isDefault })}
                      title={menu.isDefault ? t('guestMenu:isDefault') : t('guestMenu:list.makeDefault')}
                      aria-label={menu.isDefault ? t('guestMenu:isDefault') : t('guestMenu:list.makeDefault')}
                      aria-pressed={menu.isDefault}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md hover:bg-base-200',
                        menu.isDefault ? 'text-warning' : 'text-base-content/40',
                      )}
                    >
                      {menu.isDefault ? <FaStar /> : <FaRegStar />}
                    </button>
                    <Toggle
                      toggleSize="sm"
                      checked={menu.enabled}
                      disabled={!canEdit}
                      aria-label={t('guestMenu:enabled')}
                      title={t('guestMenu:enabled')}
                      onChange={(event) => patch(menu, { enabled: event.target.checked })}
                    />
                    <Link href={`/workspaces/${workspaceId}/manage/guest-menus/${menu.id}`} aria-label={t('guestMenu:edit')} title={t('guestMenu:edit')}>
                      <Button type="button" size="sm" variant="outline" shape="square">
                        <FaPen />
                      </Button>
                    </Link>
                    <Dropdown align="end">
                      <Button type="button" size="sm" variant="ghost" shape="square" aria-label={t('guestMenu:list.more')}>
                        <FaEllipsisV />
                      </Button>
                      <DropdownContent className="w-60">
                        <Menu size="sm">
                          <MenuItem>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"
                              onClick={() => copy(menuUrl, t('guestMenu:linkCopied'))}
                            >
                              <FaLink /> {t('guestMenu:list.copyMenuLink')}
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <a
                              href={getGuestMenuQrUrl(workspaceId!, menu.id, 'menu')}
                              download={`${menu.slug}-qr.svg`}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"
                            >
                              <FaDownload /> {t('guestMenu:list.qrMenu')}
                            </a>
                          </MenuItem>
                          <MenuItem>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"
                              onClick={() => openAccess(menu)}
                            >
                              <FaLock /> {menu.hasAccessCode ? t('guestMenu:access.menuItemProtected') : t('guestMenu:access.menuItem')}
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <a
                              href={menuUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"
                            >
                              <FaLink /> {t('guestMenu:open')}
                            </a>
                          </MenuItem>
                          {canEdit && (
                            <>
                              <MenuItem>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"
                                  onClick={() => duplicate(menu)}
                                >
                                  <FaCopy /> {t('guestMenu:duplicate')}
                                </button>
                              </MenuItem>
                              <MenuItem>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-error hover:bg-error/10"
                                  onClick={() => remove(menu)}
                                >
                                  <FaTrash /> {t('guestMenu:delete')}
                                </button>
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </DropdownContent>
                    </Dropdown>
                  </div>
                );
              }}
            />

            <Divider>{t('guestMenu:list.timeline.title')}</Divider>
            <ScheduleTimeline menus={menus} timezone={timezone} dayStartTime={dayStartTime} />
          </>
        )}
      </div>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], GuestMenusPage, '/workspaces/[workspaceId]/manage');
