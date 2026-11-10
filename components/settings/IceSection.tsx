import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import { Button, Loading, SkeletonTableRows, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';
import CreateIceModal from '@components/modals/CreateIceModal';
import EditTranslationModal from '@components/modals/EditTranslationModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { deleteIce, fetchIce } from '@lib/network/ices';
import type { IceDto } from '@lib/schemas/ices';
import { EntityTranslationCells, EntityTranslationHeaderCells, useLabelLocales } from './EntityTranslationLabels';
import { SettingsSection } from './SettingsSection';

export function IceSection({ workspaceId }: { workspaceId: string }) {
  const labelLocales = useLabelLocales();
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [iceOptions, setIceOptions] = useState<IceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const reload = useCallback(() => fetchIce(workspaceId, setIceOptions, setLoading), [workspaceId]);
  useEffect(() => reload(), [reload]);

  const handleDelete = async (iceId: string) => {
    if (deleting[iceId]) return;
    setDeleting((previous) => ({ ...previous, [iceId]: true }));
    try {
      await deleteIce(workspaceId, iceId);
      reload();
      alertService.success(t('common:success.deleted'));
    } catch (error) {
      alertApiV1Error(error, t('errors:delete'));
    } finally {
      setDeleting((previous) => ({ ...previous, [iceId]: false }));
    }
  };

  return (
    <SettingsSection
      title={t('settings:ice')}
      description={t('settings:iceHelp')}
      actions={
        <Button type="button" variant="primary" size="sm" onClick={() => modalContext.openModal(<CreateIceModal onSaved={reload} />)}>
          <FaPlus aria-hidden />
          {t('common:add')}
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-base-300/60">
        <Table zebra className="w-full table-auto">
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('settings:key')}</TableHeaderCell>
              <EntityTranslationHeaderCells locales={labelLocales} />
              <TableHeaderCell>
                <span className="sr-only">{t('common:actions')}</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonTableRows columns={2 + labelLocales.length} rows={3} avatarColumn={-1} />
            ) : iceOptions.length == 0 ? (
              <TableRow>
                <TableCell colSpan={2 + labelLocales.length} className="text-center">
                  {t('common:emptyEntriesPresent')}
                </TableCell>
              </TableRow>
            ) : (
              iceOptions.map((iceOption) => (
                <TableRow key={`ice-option-${iceOption.id}`}>
                  <TableCell>{iceOption.name}</TableCell>
                  <EntityTranslationCells translationKey={iceOption.name} locales={labelLocales} />
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => modalContext.openModal(<EditTranslationModal identifier={iceOption.name} slang={t('settings:slang.ice')} />)}
                      >
                        {t('common:edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-error"
                        size="sm"
                        aria-label={`${t('common:delete')}: ${userContext.getTranslation(iceOption.name)}`}
                        disabled={deleting[iceOption.id] ?? false}
                        onClick={() =>
                          modalContext.openModal(
                            <DeleteConfirmationModal
                              spelling={'DELETE'}
                              entityName={userContext.getTranslation(iceOption.name)}
                              onApprove={() => handleDelete(iceOption.id)}
                            />,
                          )
                        }
                      >
                        {deleting[iceOption.id] ? <Loading size="sm" /> : <FaTrashAlt aria-hidden />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SettingsSection>
  );
}
