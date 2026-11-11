import { Role } from '@generated/prisma/client';
import Link from 'next/link';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { bulkUpdateGuestInfo, getGuestInfoOverview } from '@lib/network/guestInfo';
import type { GuestInfoBulkUpdateInput, GuestInfoOverview, GuestInfoOverviewGarnish, GuestInfoOverviewIngredient } from '@lib/schemas/guestInfo';
import { AllergenSelect } from '@components/guest-info/AllergenSelect';
import { AdditiveSelect } from '@components/guest-info/AdditiveSelect';
import { parseOptionalPercent } from '@components/guest-info/GuestInfoFormFields';
import { isFormDirty } from '@lib/forms/formDirty';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Label,
  LabelText,
  Loading,
  SkeletonTableRows,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  Toggle,
} from '@components/ui';

type Kind = 'ingredients' | 'garnishes';
type IngredientRow = GuestInfoOverviewIngredient & { abvInput: number | string };
type IngredientPatch = Partial<Pick<IngredientRow, 'abvInput' | 'allergens' | 'additives' | 'guestInfoComplete'>>;
type GarnishPatch = Partial<Pick<GuestInfoOverviewGarnish, 'allergens' | 'additives' | 'guestInfoComplete'>>;

/** Persisted guest-info fields of a row – a patch only counts when it differs from the loaded row. */
function toComparableGuestInfo(row: { abvInput?: number | string; allergens: string[]; additives: string[]; guestInfoComplete: boolean }) {
  return { abv: row.abvInput, allergens: [...row.allergens].sort(), additives: [...row.additives].sort(), guestInfoComplete: row.guestInfoComplete };
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-base-300" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

const ManageGuestInfoPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const { t } = useTranslation(['guestInfo', 'common', 'nav']);
  const userContext = useContext(UserContext);
  const canEdit = userContext.isUserPermitted(Role.MANAGER);

  const [overview, setOverview] = useState<GuestInfoOverview | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<Kind>('ingredients');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [search, setSearch] = useState('');
  const [ingredientPatches, setIngredientPatches] = useState<Record<string, IngredientPatch>>({});
  const [garnishPatches, setGarnishPatches] = useState<Record<string, GarnishPatch>>({});

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    getGuestInfoOverview(workspaceId)
      .then((result) => {
        setOverview(result);
        setIngredientPatches({});
        setGarnishPatches({});
      })
      .catch((error) => alertApiV1Error(error, t('guestInfo:maintenance.loadError')))
      .finally(() => setLoading(false));
  }, [workspaceId, t]);

  useEffect(() => {
    load();
  }, [load]);

  ManageGuestInfoPage.pullToRefresh = load;

  const ingredients: IngredientRow[] = useMemo(
    () =>
      (overview?.ingredients ?? []).map((ingredient) => {
        const patch = ingredientPatches[ingredient.id] ?? {};
        return { ...ingredient, abvInput: ingredient.abv ?? '', ...patch };
      }),
    [overview, ingredientPatches],
  );
  const garnishes: GuestInfoOverviewGarnish[] = useMemo(
    () => (overview?.garnishes ?? []).map((garnish) => ({ ...garnish, ...garnishPatches[garnish.id] })),
    [overview, garnishPatches],
  );

  const changedIngredientIds = useMemo(
    () =>
      (overview?.ingredients ?? [])
        .filter((original) => {
          const patch = ingredientPatches[original.id];
          if (!patch) return false;
          const originalRow = { ...original, abvInput: original.abv ?? '' };
          return isFormDirty(toComparableGuestInfo({ ...originalRow, ...patch }), toComparableGuestInfo(originalRow));
        })
        .map((ingredient) => ingredient.id),
    [overview, ingredientPatches],
  );
  const changedGarnishIds = useMemo(
    () =>
      (overview?.garnishes ?? [])
        .filter((original) => {
          const patch = garnishPatches[original.id];
          return patch != undefined && isFormDirty(toComparableGuestInfo({ ...original, ...patch }), toComparableGuestInfo(original));
        })
        .map((garnish) => garnish.id),
    [overview, garnishPatches],
  );
  const unsavedCount = changedIngredientIds.length + changedGarnishIds.length;
  const rows = kind === 'ingredients' ? ingredients : garnishes;
  const completeCount = rows.filter((row) => row.guestInfoComplete).length;
  const visibleRows = rows.filter(
    (row) => (!onlyIncomplete || !row.guestInfoComplete) && (search.trim() === '' || row.name.toLowerCase().includes(search.trim().toLowerCase())),
  );

  const patchIngredient = (id: string, patch: IngredientPatch) => setIngredientPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const patchGarnish = (id: string, patch: GarnishPatch) => setGarnishPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const invalidAbv = ingredients.some((row) => {
    if (!(row.id in ingredientPatches) || row.abvInput === '') return false;
    const value = Number(row.abvInput);
    return !Number.isFinite(value) || value < 0 || value > 100;
  });

  const save = async (): Promise<boolean> => {
    if (!workspaceId || unsavedCount === 0 || invalidAbv) return false;
    const body: GuestInfoBulkUpdateInput = {
      ingredients: Object.entries(ingredientPatches)
        .filter(([id]) => changedIngredientIds.includes(id))
        .map(([id, patch]) => ({
          id,
          abv: 'abvInput' in patch ? parseOptionalPercent(patch.abvInput) : undefined,
          allergens: patch.allergens,
          additives: patch.additives,
          guestInfoComplete: patch.guestInfoComplete,
        })),
      garnishes: Object.entries(garnishPatches)
        .filter(([id]) => changedGarnishIds.includes(id))
        .map(([id, patch]) => ({ id, ...patch })),
    };
    setSaving(true);
    try {
      await bulkUpdateGuestInfo(workspaceId, body);
      alertService.success(t('guestInfo:maintenance.saved'));
      load();
      return true;
    } catch (error) {
      alertApiV1Error(error, t('guestInfo:maintenance.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const stats = overview?.stats;

  return (
    <ManageEntityLayout
      title={t('guestInfo:maintenance.title')}
      backLink={`/workspaces/${workspaceId}/manage`}
      unsavedChanges={unsavedCount > 0}
      onSave={canEdit ? save : undefined}
      actions={
        canEdit ? (
          <div className="flex items-center gap-2">
            {unsavedCount > 0 && (
              <Button type="button" variant="outline" size="sm" className="md:h-10 md:min-h-10 md:px-4" onClick={() => load()} disabled={saving}>
                {t('guestInfo:maintenance.discard')}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="md:h-10 md:min-h-10 md:px-4"
              onClick={() => void save()}
              disabled={saving || unsavedCount === 0 || invalidAbv}
            >
              {saving ? <Loading size="sm" /> : null}
              {t('guestInfo:maintenance.save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <Card variant="surface">
        <CardBody className="gap-4">
          <p className="text-sm opacity-80">{t('guestInfo:maintenance.description')}</p>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs>
              <Tab active={kind === 'ingredients'} onClick={() => setKind('ingredients')}>
                {t('guestInfo:maintenance.ingredients')}
              </Tab>
              <Tab active={kind === 'garnishes'} onClick={() => setKind('garnishes')}>
                {t('guestInfo:maintenance.garnishes')}
              </Tab>
            </Tabs>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                className="w-56"
                placeholder={t('guestInfo:maintenance.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Label className="cursor-pointer flex-row items-center gap-2">
                <Toggle checked={onlyIncomplete} onChange={(event) => setOnlyIncomplete(event.target.checked)} toggleSize="sm" />
                <LabelText>{t('guestInfo:maintenance.onlyIncomplete')}</LabelText>
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{t('guestInfo:maintenance.progress', { complete: completeCount, total: rows.length })}</span>
              {kind === 'ingredients' && (
                <span className="opacity-70">
                  {t('guestInfo:maintenance.withAbv', { count: ingredients.filter((row) => parseOptionalPercent(row.abvInput) != null).length })}
                </span>
              )}
            </div>
            <ProgressBar value={completeCount} total={rows.length} />
            {stats && (
              <span className="text-xs opacity-70">
                {t('guestInfo:maintenance.cocktailStats', {
                  complete: stats.cocktails.complete,
                  total: stats.cocktails.total,
                  abvKnown: stats.cocktails.abvKnown,
                })}
              </span>
            )}
            {unsavedCount > 0 && <span className="text-sm text-warning">{t('guestInfo:maintenance.unsaved', { count: unsavedCount })}</span>}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('guestInfo:maintenance.name')}</TableHeaderCell>
                  {kind === 'ingredients' && <TableHeaderCell className="w-28">{t('guestInfo:form.abv')}</TableHeaderCell>}
                  <TableHeaderCell>{t('guestInfo:allergensTitle')}</TableHeaderCell>
                  <TableHeaderCell>{t('guestInfo:additivesTitle')}</TableHeaderCell>
                  <TableHeaderCell className="w-24 text-center">{t('guestInfo:form.complete')}</TableHeaderCell>
                  <TableHeaderCell className="w-20 text-right">{t('guestInfo:maintenance.usedIn')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && !overview ? (
                  <SkeletonTableRows rows={5} columns={kind === 'ingredients' ? 6 : 5} />
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center opacity-70">
                      {t('guestInfo:maintenance.empty')}
                    </TableCell>
                  </TableRow>
                ) : kind === 'ingredients' ? (
                  (visibleRows as IngredientRow[]).map((row) => (
                    <TableRow key={row.id} className={row.id in ingredientPatches ? 'bg-warning/10' : undefined}>
                      <TableCell className="align-top font-medium">
                        <Link className="link-hover" href={`/workspaces/${workspaceId}/manage/ingredients/${row.id}`}>
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={0.1}
                          className="w-24"
                          aria-label={t('guestInfo:form.abv')}
                          disabled={!canEdit}
                          value={row.abvInput}
                          onChange={(event) => patchIngredient(row.id, { abvInput: event.target.value })}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <AllergenSelect size="xs" disabled={!canEdit} value={row.allergens} onChange={(allergens) => patchIngredient(row.id, { allergens })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <AdditiveSelect size="xs" disabled={!canEdit} value={row.additives} onChange={(additives) => patchIngredient(row.id, { additives })} />
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Checkbox
                          aria-label={t('guestInfo:form.complete')}
                          disabled={!canEdit}
                          checked={row.guestInfoComplete}
                          onChange={(event) => patchIngredient(row.id, { guestInfoComplete: event.target.checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right align-top">{row.usedInCocktails}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  (visibleRows as GuestInfoOverviewGarnish[]).map((row) => (
                    <TableRow key={row.id} className={row.id in garnishPatches ? 'bg-warning/10' : undefined}>
                      <TableCell className="align-top font-medium">
                        <Link className="link-hover" href={`/workspaces/${workspaceId}/manage/garnishes/${row.id}`}>
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="align-top">
                        <AllergenSelect size="xs" disabled={!canEdit} value={row.allergens} onChange={(allergens) => patchGarnish(row.id, { allergens })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <AdditiveSelect size="xs" disabled={!canEdit} value={row.additives} onChange={(additives) => patchGarnish(row.id, { additives })} />
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Checkbox
                          aria-label={t('guestInfo:form.complete')}
                          disabled={!canEdit}
                          checked={row.guestInfoComplete}
                          onChange={(event) => patchGarnish(row.id, { guestInfoComplete: event.target.checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right align-top">{row.usedInCocktails}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </ManageEntityLayout>
  );
};

export default ManageGuestInfoPage;
