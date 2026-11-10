import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaArrowDown, FaArrowUp, FaGripVertical, FaPlus, FaSave, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import ListSearchField from '@components/ListSearchField';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import {
  createDefaultTagCategories,
  createTagCategory,
  deleteTagCategory,
  getTagCategories,
  getTagDefinitions,
  upsertTagCategories,
  upsertTagDefinitions,
} from '@lib/network/tags';
import { getAllContentLocales, getWorkspaceContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { resolveLocalizedText, type LocalizedText } from '@lib/guest-menu/localizedText';
import { getMissingDefaultTagCategories } from '@lib/tags/defaultTagCategories';
import type { TagCategoryDto, TagDefinitionDto, TagDefinitionsBulkUpdateInput } from '@lib/schemas/tags';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  DataTable,
  Input,
  Loading,
  Select,
  SkeletonTableRows,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Toggle,
} from '@components/ui';
import { NextPageWithPullToRefresh } from '../../../../../types/next';

type CategoryDraft = Pick<TagCategoryDto, 'id' | 'name' | 'showAsGuestFilter' | 'tagCount'>;
type DefinitionDraft = Pick<TagDefinitionDto, 'label' | 'categoryId' | 'color' | 'isPublic'>;

const UNCATEGORIZED = '__none__';

function setLocalized(text: LocalizedText | null, locale: string, value: string): LocalizedText {
  return { ...(text ?? {}), [locale]: value };
}

function SortableCategoryRow(props: {
  category: CategoryDraft;
  index: number;
  count: number;
  locales: string[];
  canEdit: boolean;
  onChange: (category: CategoryDraft) => void;
  onMove: (from: number, to: number) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(['translations']);
  const { category, index, count, locales, canEdit } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled: !canEdit });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-wrap items-center gap-2 rounded-lg border border-base-300/60 bg-base-100 p-2">
      {canEdit && (
        <button type="button" className="cursor-grab text-base-content/60" aria-label={t('translations:tags.dragToReorder')} {...attributes} {...listeners}>
          <FaGripVertical />
        </button>
      )}
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {locales.map((locale) => (
          <div key={locale} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-xs text-base-content/60 uppercase">{locale}</span>
            <Input
              inputSize="sm"
              value={category.name[locale] ?? ''}
              lang={locale}
              readOnly={!canEdit}
              placeholder={t('translations:tags.categoryName')}
              onChange={(event) => props.onChange({ ...category, name: setLocalized(category.name, locale, event.target.value) })}
            />
          </div>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Toggle
          toggleSize="sm"
          checked={category.showAsGuestFilter}
          disabled={!canEdit}
          onChange={(event) => props.onChange({ ...category, showAsGuestFilter: event.target.checked })}
        />
        {t('translations:tags.showAsGuestFilter')}
      </label>
      <Badge size="sm" variant="ghost">
        {t('translations:tags.tagCount', { count: category.tagCount })}
      </Badge>
      {canEdit && (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            shape="square"
            size="sm"
            disabled={index === 0}
            onClick={() => props.onMove(index, index - 1)}
            aria-label={t('translations:tags.moveUp')}
          >
            <FaArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            shape="square"
            size="sm"
            disabled={index === count - 1}
            onClick={() => props.onMove(index, index + 1)}
            aria-label={t('translations:tags.moveDown')}
          >
            <FaArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            shape="square"
            size="sm"
            className="text-error"
            onClick={props.onDelete}
            aria-label={t('translations:tags.deleteCategory')}
          >
            <FaTrashAlt />
          </Button>
        </div>
      )}
    </div>
  );
}

const ManageTagsPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const { t } = useTranslation(['translations', 'common', 'manage']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const canEdit = userContext.isUserPermitted(Role.MANAGER);

  const settings = userContext.workspace?.settings;
  const contentLocales = useMemo(() => getWorkspaceContentLocales(settings ?? {}), [settings]);
  const locales = useMemo(() => getAllContentLocales(contentLocales), [contentLocales]);
  const displayLocale = locales.includes(userContext.uiLocale) ? userContext.uiLocale : contentLocales.primary;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [savedCategories, setSavedCategories] = useState<TagCategoryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [definitions, setDefinitions] = useState<TagDefinitionDto[]>([]);
  const [definitionEdits, setDefinitionEdits] = useState<Record<string, DefinitionDraft>>({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const applyCategories = useCallback((list: TagCategoryDto[]) => {
    setSavedCategories(list);
    setCategories(
      list.map((category) => ({ id: category.id, name: category.name, showAsGuestFilter: category.showAsGuestFilter, tagCount: category.tagCount })),
    );
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [categoryList, definitionList] = await Promise.all([getTagCategories(workspaceId), getTagDefinitions(workspaceId)]);
      applyCategories(categoryList);
      setDefinitions(definitionList);
      setDefinitionEdits({});
    } catch (error) {
      alertApiV1Error(error, t('translations:tags.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, applyCategories, t]);

  useEffect(() => {
    void load();
  }, [load]);

  ManageTagsPage.pullToRefresh = () => {
    void load();
  };

  const categoriesDirty = useMemo(() => {
    if (categories.length !== savedCategories.length) return true;
    return categories.some((category, index) => {
      const saved = savedCategories[index];
      return saved.id !== category.id || saved.showAsGuestFilter !== category.showAsGuestFilter || JSON.stringify(saved.name) !== JSON.stringify(category.name);
    });
  }, [categories, savedCategories]);

  const changedDefinitions = useMemo(
    () =>
      Object.entries(definitionEdits).filter(([tag, draft]) => {
        const original = definitions.find((definition) => definition.tag === tag);
        if (!original) return false;
        return (
          JSON.stringify(original.label ?? {}) !== JSON.stringify(draft.label ?? {}) ||
          original.categoryId !== draft.categoryId ||
          original.color !== draft.color ||
          original.isPublic !== draft.isPublic
        );
      }),
    [definitionEdits, definitions],
  );

  const dirty = categoriesDirty || changedDefinitions.length > 0;

  const handleSave = useCallback(async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      if (categoriesDirty) {
        applyCategories(
          await upsertTagCategories(
            workspaceId,
            categories.map((category, index) => ({ id: category.id, name: category.name, order: index, showAsGuestFilter: category.showAsGuestFilter })),
          ),
        );
      }
      if (changedDefinitions.length > 0) {
        const body: TagDefinitionsBulkUpdateInput = changedDefinitions.map(([tag, draft]) => ({
          tag,
          label: draft.label,
          categoryId: draft.categoryId,
          color: draft.color,
          isPublic: draft.isPublic,
        }));
        setDefinitions(await upsertTagDefinitions(workspaceId, body));
        setDefinitionEdits({});
        // Tag counts per category changed.
        applyCategories(await getTagCategories(workspaceId));
      }
      alertService.success(t('translations:tags.saved'));
    } catch (error) {
      alertApiV1Error(error, t('translations:tags.errors.save'));
    } finally {
      setSaving(false);
    }
  }, [workspaceId, categoriesDirty, categories, changedDefinitions, applyCategories, t]);

  const handleAddCategory = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const created = await createTagCategory(workspaceId, {
        name: { [contentLocales.primary]: t('translations:tags.newCategory') },
        order: categories.length,
      });
      setSavedCategories((previous) => [...previous, created]);
      setCategories((previous) => [...previous, { id: created.id, name: created.name, showAsGuestFilter: created.showAsGuestFilter, tagCount: 0 }]);
    } catch (error) {
      alertApiV1Error(error, t('translations:tags.errors.save'));
    }
  }, [workspaceId, contentLocales.primary, categories.length, t]);

  const handleSeedDefaults = useCallback(async () => {
    if (!workspaceId) return;
    setSeeding(true);
    try {
      applyCategories(await createDefaultTagCategories(workspaceId));
      alertService.success(t('translations:tags.defaultsCreated'));
    } catch (error) {
      alertApiV1Error(error, t('translations:tags.errors.save'));
    } finally {
      setSeeding(false);
    }
  }, [workspaceId, applyCategories, t]);

  const handleDeleteCategory = useCallback(
    (category: CategoryDraft) => {
      if (!workspaceId) return;
      modalContext.openModal(
        <DeleteConfirmationModal
          spelling="DELETE"
          entityName={resolveLocalizedText(category.name, displayLocale, contentLocales.primary, t('translations:tags.newCategory'))}
          onApprove={async () => {
            try {
              await deleteTagCategory(workspaceId, category.id);
              setSavedCategories((previous) => previous.filter((c) => c.id !== category.id));
              setCategories((previous) => previous.filter((c) => c.id !== category.id));
              setDefinitions((previous) => previous.map((d) => (d.categoryId === category.id ? { ...d, categoryId: null } : d)));
              setDefinitionEdits((previous) =>
                Object.fromEntries(
                  Object.entries(previous).map(([tag, draft]) => [tag, draft.categoryId === category.id ? { ...draft, categoryId: null } : draft]),
                ),
              );
            } catch (error) {
              alertApiV1Error(error, t('translations:tags.errors.delete'));
            }
          }}
        />,
      );
    },
    [workspaceId, modalContext, displayLocale, contentLocales.primary, t],
  );

  const moveCategory = useCallback((from: number, to: number) => {
    setCategories((previous) => (to < 0 || to >= previous.length ? previous : arrayMove(previous, from, to)));
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((category) => category.id === active.id);
    const to = categories.findIndex((category) => category.id === over.id);
    if (from >= 0 && to >= 0) moveCategory(from, to);
  };

  const draftFor = useCallback(
    (definition: TagDefinitionDto): DefinitionDraft =>
      definitionEdits[definition.tag] ?? { label: definition.label, categoryId: definition.categoryId, color: definition.color, isPublic: definition.isPublic },
    [definitionEdits],
  );
  const updateDraft = (definition: TagDefinitionDto, patch: Partial<DefinitionDraft>) =>
    setDefinitionEdits((previous) => ({ ...previous, [definition.tag]: { ...draftFor(definition), ...patch } }));

  const missingDefaults = getMissingDefaultTagCategories(categories.map((category, index) => ({ name: category.name, order: index }))).length > 0;

  const filteredDefinitions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return definitions.filter((definition) => {
      const draft = draftFor(definition);
      if (categoryFilter === UNCATEGORIZED && draft.categoryId) return false;
      if (categoryFilter && categoryFilter !== UNCATEGORIZED && draft.categoryId !== categoryFilter) return false;
      if (term && ![definition.tag, ...Object.values(draft.label ?? {})].some((text) => text.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [definitions, draftFor, search, categoryFilter]);

  const categoryLabel = (category: CategoryDraft) =>
    resolveLocalizedText(category.name, displayLocale, contentLocales.primary, t('translations:tags.newCategory'));

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={t('translations:tags.title')}
      unsavedChanges={dirty}
      actions={
        canEdit && (
          <Button type="button" variant="primary" size="sm" className="md:h-10 md:min-h-10 md:px-4" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loading size="sm" /> : <FaSave />}
            {t('common:save')}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('translations:tags.categories')}</CardTitle>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {missingDefaults && (
                    <Button type="button" variant="outline" size="sm" disabled={seeding} onClick={handleSeedDefaults}>
                      {seeding ? <Loading size="sm" /> : null}
                      {t('translations:tags.createDefaults')}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCategory}>
                    <FaPlus />
                    {t('translations:tags.addCategory')}
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-base-content/70">{t('translations:tags.categoriesHint')}</p>
            {loading ? (
              <div className="flex justify-center p-4">
                <Loading />
              </div>
            ) : categories.length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/70">{t('translations:tags.noCategories')}</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {categories.map((category, index) => (
                      <SortableCategoryRow
                        key={category.id}
                        category={category}
                        index={index}
                        count={categories.length}
                        locales={locales}
                        canEdit={canEdit}
                        onChange={(next) => setCategories((previous) => previous.map((c) => (c.id === next.id ? next : c)))}
                        onMove={moveCategory}
                        onDelete={() => handleDeleteCategory(category)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle>{t('translations:tags.tags')}</CardTitle>
            <p className="text-sm text-base-content/70">{t('translations:tags.tagsHint')}</p>
            <DataTable
              toolbar={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-48 flex-1">
                    <ListSearchField onFilterChange={(value) => setSearch(value)} />
                  </div>
                  <Select selectSize="sm" className="w-auto" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">{t('translations:tags.allCategories')}</option>
                    <option value={UNCATEGORIZED}>{t('translations:tags.noCategory')}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </Select>
                </div>
              }
            >
              <Table zebra className="w-full">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{t('translations:tags.tag')}</TableHeaderCell>
                    <TableHeaderCell>{t('translations:tags.category')}</TableHeaderCell>
                    <TableHeaderCell>{t('translations:tags.label')}</TableHeaderCell>
                    <TableHeaderCell>{t('translations:tags.color')}</TableHeaderCell>
                    <TableHeaderCell>{t('translations:tags.public')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <SkeletonTableRows columns={5} avatarColumn={-1} />
                  ) : filteredDefinitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        {t('manage:noEntriesFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDefinitions.map((definition) => {
                      const draft = draftFor(definition);
                      return (
                        <TableRow key={definition.tag}>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-2 font-bold">
                              {draft.color && <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: draft.color }} />}
                              {definition.tag}
                            </div>
                            <div className="text-xs text-base-content/60">
                              {t('translations:tags.usage', { cocktails: definition.cocktailCount, ingredients: definition.ingredientCount })}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Select
                              selectSize="sm"
                              value={draft.categoryId ?? ''}
                              disabled={!canEdit}
                              onChange={(event) => updateDraft(definition, { categoryId: event.target.value || null })}
                            >
                              <option value="">{t('translations:tags.noCategory')}</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {categoryLabel(category)}
                                </option>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex min-w-48 flex-col gap-1">
                              {locales.map((locale) => (
                                <div key={locale} className="flex items-center gap-1">
                                  <span className="w-8 shrink-0 text-xs text-base-content/60 uppercase">{locale}</span>
                                  <Input
                                    inputSize="sm"
                                    value={draft.label?.[locale] ?? ''}
                                    placeholder={definition.tag}
                                    lang={locale}
                                    readOnly={!canEdit}
                                    onChange={(event) => updateDraft(definition, { label: setLocalized(draft.label, locale, event.target.value) })}
                                  />
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="color"
                                className="h-8 w-10 cursor-pointer rounded border border-base-300 bg-transparent"
                                value={draft.color ?? '#888888'}
                                disabled={!canEdit}
                                aria-label={t('translations:tags.color')}
                                onChange={(event) => updateDraft(definition, { color: event.target.value })}
                              />
                              {draft.color && canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  shape="square"
                                  size="sm"
                                  aria-label={t('translations:tags.clearColor')}
                                  onClick={() => updateDraft(definition, { color: null })}
                                >
                                  <FaTimes />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Toggle
                              toggleSize="sm"
                              checked={draft.isPublic}
                              disabled={!canEdit}
                              aria-label={t('translations:tags.public')}
                              onChange={(event) => updateDraft(definition, { isPublic: event.target.checked })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </DataTable>
          </CardBody>
        </Card>
      </div>
    </ManageEntityLayout>
  );
};

export default ManageTagsPage;
