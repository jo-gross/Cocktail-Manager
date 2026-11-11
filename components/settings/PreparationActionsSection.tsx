import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import _ from 'lodash';
import { Button, Loading, SkeletonTableRows, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';
import CocktailStepActionModal from '@components/modals/CocktailStepActionModal';
import EditTranslationModal from '@components/modals/EditTranslationModal';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { EntityNameLink } from '@components/manage/EntityNameLink';
import { getDefaultDilutionPercent } from '@lib/guest-info/constants';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { deleteAction, fetchActions } from '@lib/network/actions';
import type { ActionDto } from '@lib/schemas/actions';
import { EntityTranslationCells, EntityTranslationHeaderCells, useLabelLocales } from './EntityTranslationLabels';
import { SettingsSection } from './SettingsSection';

/** Preparation methods (incl. dilution) and their display groups. */
export function PreparationActionsSection({ workspaceId }: { workspaceId: string }) {
  const labelLocales = useLabelLocales();
  const { t } = useTranslation(['settings', 'common', 'errors', 'guestInfo']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const reload = useCallback(() => fetchActions(workspaceId, setActions, setLoading), [workspaceId]);
  useEffect(() => reload(), [reload]);

  const groups = useMemo(() => Object.keys(_.groupBy(actions, 'actionGroup')), [actions]);

  const handleDelete = async (actionId: string) => {
    if (deleting[actionId]) return;
    setDeleting((previous) => ({ ...previous, [actionId]: true }));
    try {
      await deleteAction(workspaceId, actionId);
      reload();
      alertService.success(t('common:success.deleted'));
    } catch (error) {
      alertApiV1Error(error, t('errors:delete'));
    } finally {
      setDeleting((previous) => ({ ...previous, [actionId]: false }));
    }
  };

  const openActionModal = (action: ActionDto | undefined) =>
    modalContext.openModal(<CocktailStepActionModal cocktailStepAction={action} cocktailStepActionGroups={groups} onSaved={reload} />);

  return (
    <>
      <SettingsSection
        title={t('settings:methods')}
        description={t('settings:preparationHelp')}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={() => openActionModal(undefined)}>
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
                <TableHeaderCell>{t('settings:groupIdentifier')}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t('guestInfo:form.dilution')}</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">{t('common:actions')}</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <SkeletonTableRows columns={4 + labelLocales.length} rows={4} avatarColumn={-1} />
              ) : actions.length == 0 ? (
                <TableRow>
                  <TableCell colSpan={4 + labelLocales.length} className="text-center">
                    {t('common:emptyEntriesPresent')}
                  </TableCell>
                </TableRow>
              ) : (
                actions.map((action) => (
                  <TableRow key={`action-${action.id}`}>
                    <TableCell>
                      <EntityNameLink onClick={() => openActionModal(action)}>{action.name}</EntityNameLink>
                    </TableCell>
                    <EntityTranslationCells translationKey={action.name} locales={labelLocales} />
                    <TableCell>{userContext.getTranslation(action.actionGroup)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {action.dilutionPercent != null ? (
                        `${action.dilutionPercent} %`
                      ) : (
                        <span className="text-base-content/60">{`${getDefaultDilutionPercent(action.name)} % (${t('settings:recipes.dilutionDefault')})`}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openActionModal(action)}>
                          {t('common:edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline-error"
                          size="sm"
                          aria-label={`${t('common:delete')}: ${userContext.getTranslation(action.name)}`}
                          disabled={deleting[action.id] ?? false}
                          onClick={() =>
                            modalContext.openModal(
                              <DeleteConfirmationModal
                                spelling={'DELETE'}
                                entityName={userContext.getTranslation(action.name)}
                                onApprove={() => handleDelete(action.id)}
                              />,
                            )
                          }
                        >
                          {deleting[action.id] ? <Loading size="sm" /> : <FaTrashAlt aria-hidden />}
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

      <SettingsSection title={t('settings:groups')} description={t('settings:groupsHelp')}>
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
                <SkeletonTableRows columns={2 + labelLocales.length} rows={2} avatarColumn={-1} />
              ) : groups.length == 0 ? (
                <TableRow>
                  <TableCell colSpan={2 + labelLocales.length} className="text-center">
                    {t('common:emptyEntriesPresent')}
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={`action-group-${group}`}>
                    <TableCell>
                      <EntityNameLink
                        onClick={() => modalContext.openModal(<EditTranslationModal identifier={group} slang={t('settings:slang.actionGroup')} />)}
                      >
                        {group}
                      </EntityNameLink>
                    </TableCell>
                    <EntityTranslationCells translationKey={group} locales={labelLocales} />
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => modalContext.openModal(<EditTranslationModal identifier={group} slang={t('settings:slang.actionGroup')} />)}
                        >
                          {t('common:edit')}
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
    </>
  );
}
