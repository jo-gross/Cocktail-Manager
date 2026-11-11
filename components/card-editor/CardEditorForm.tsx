import React, { useContext, useEffect, useState } from 'react';
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldArray, Formik, FormikErrors, FormikProps } from 'formik';
import { z } from 'zod';
import { FaArchive, FaBoxOpen, FaTrashAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { alertService } from '@lib/alertService';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { FormikDirtyReporter } from '@lib/forms/FormikDirtyReporter';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import type { CardDto } from '@lib/schemas/cards';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { alertApiV1Error, apiV1Mutate } from '@lib/network/apiV1';
import { Button, Input } from '@components/ui';
import { EntityFormLayout } from '@components/forms/EntityFormLayout';
import { FormSection } from '@components/forms/FormSection';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { FormSaveButton } from '@components/forms/FormSaveButton';
import { useTranslation } from 'react-i18next';
import { CardEditorToolbar } from './CardEditorToolbar';
import { CardGroupSection } from './CardGroupSection';
import {
  CardEditorDensity,
  CardEditorDevice,
  CardEditorFormValues,
  CardEditorOrientation,
  CardEditorTabletSize,
  CardEditorViewMode,
  DEFAULT_VIEWPORT_WIDTH,
  getColumnsForWidth,
  getEffectiveWidth,
  getNearestFittingConfig,
  PREVIEW_VIEWPORT_MARGIN,
} from './types';
import { groupDragId, parseGroupDragId, parseItemDragId, reorderGroupItems, reorderGroups } from './useCardEditorDnD';

interface CocktailCardGroupError {
  name?: string;
  groupPrice?: string;
}

/**
 * Mirrors the former inline `validate` logic:
 *  - the card `name` is required (non-empty after trim),
 *  - every group `name` is required (non-empty after trim).
 * The adapter maps issue paths (e.g. `groups[0].name`) onto Formik's nested error
 * object, so the field-level messages line up with the JSX exactly as before.
 */
function createCardFormSchema(requiredMessage: string) {
  return z.object({
    name: z.string().refine((v) => v.trim() != '', { message: requiredMessage }),
    date: z.string().optional(),
    groups: z.array(
      z.object({
        name: z.string().refine((v) => v.trim() != '', { message: requiredMessage }),
      }),
    ),
  });
}

/** Formik number inputs yield '' when cleared – submit that as null instead of coercing it to 0. */
function toPriceInput(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapCardToFormValues(card?: CardDto): CardEditorFormValues {
  return {
    name: card?.name ?? '',
    date: card?.date != undefined ? new Date(card.date).toISOString().split('T')[0] : '',
    groups:
      card?.groups
        .slice()
        .sort((a, b) => a.groupNumber - b.groupNumber)
        .map((group) => ({
          id: group.id,
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice,
          items: group.items.map((item) => ({
            cocktailId: item.cocktail.id,
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice,
          })),
        })) ?? [],
  };
}

/** Persisted part of the values in display order (mirrors `onSubmit`). */
function toComparableCard(values: CardEditorFormValues) {
  return {
    name: values.name,
    date: values.date,
    groups: [...values.groups]
      .sort((a, b) => a.groupNumber - b.groupNumber)
      .map((group) => ({
        id: group.id,
        name: group.name,
        groupPrice: toPriceInput(group.groupPrice),
        items: [...group.items]
          .sort((a, b) => a.itemNumber - b.itemNumber)
          .map((item) => ({ cocktailId: item.cocktailId, specialPrice: toPriceInput(item.specialPrice) })),
      })),
  };
}

interface CardEditorFormProps {
  card?: CardDto;
  cocktails: CocktailSummaryDto[];
  loadingCocktails: boolean;
  workspaceId: string;
  formRef?: React.RefObject<FormikProps<CardEditorFormValues> | null>;
}

export function CardEditorForm({ card, cocktails, loadingCocktails, workspaceId, formRef }: CardEditorFormProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors']);
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();
  const [viewMode, setViewMode] = useState<CardEditorViewMode>('names');
  const [device, setDevice] = useState<CardEditorDevice>('desktop');
  const [density, setDensity] = useState<CardEditorDensity>('wide');
  const [orientation, setOrientation] = useState<CardEditorOrientation>('portrait');
  const [tabletSize, setTabletSize] = useState<CardEditorTabletSize>('mini');
  const [viewportWidth, setViewportWidth] = useState<number>(DEFAULT_VIEWPORT_WIDTH);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // Width available for the preview frame once container padding is accounted for.
  const availableWidth = viewportWidth - PREVIEW_VIEWPORT_MARGIN;

  const currentEffectiveWidth = getEffectiveWidth(device, tabletSize, orientation);

  // When the selected preview no longer fits, fall back to the nearest configuration that does.
  useEffect(() => {
    if (currentEffectiveWidth <= availableWidth) return;
    const next = getNearestFittingConfig(availableWidth);
    if (next.device !== device) setDevice(next.device);
    if (next.tabletSize !== tabletSize) setTabletSize(next.tabletSize);
    if (next.orientation !== orientation) setOrientation(next.orientation);
  }, [availableWidth, currentEffectiveWidth, device, tabletSize, orientation]);

  // A preview option is disabled when its effective width exceeds the available viewport width.
  const isDeviceDisabled = (option: CardEditorDevice) => getEffectiveWidth(option, tabletSize, orientation) > availableWidth;
  const isTabletSizeDisabled = (option: CardEditorTabletSize) => getEffectiveWidth('tablet', option, orientation) > availableWidth;
  const isOrientationDisabled = (option: CardEditorOrientation) => getEffectiveWidth(device, tabletSize, option) > availableWidth;

  const effectiveWidth = currentEffectiveWidth;
  const columns = getColumnsForWidth(effectiveWidth, density);
  const stackHeader = effectiveWidth < 640;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Keyboard alternative to dragging (focus a handle, Space, arrows, Space) – replaces the up/down buttons.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <Formik<CardEditorFormValues>
      innerRef={formRef}
      initialValues={mapCardToFormValues(card)}
      enableReinitialize
      validate={(values) => {
        return zodFormikValidate(createCardFormSchema(t('errors:requiredField')))(values);
      }}
      onSubmit={async (values) => {
        try {
          const input = {
            id: card?.id,
            name: values.name,
            date: values.date != '' ? new Date(values.date).toISOString() : null,
            groups: values.groups.map((group, index) => ({
              id: group.id,
              name: group.name,
              groupNumber: index,
              groupPrice: toPriceInput(group.groupPrice),
              items: [...group.items]
                .sort((a, b) => a.itemNumber - b.itemNumber)
                .map((item, itemIndex) => ({
                  itemNumber: itemIndex,
                  cocktailId: item.cocktailId,
                  specialPrice: toPriceInput(item.specialPrice),
                })),
            })),
          };

          if (card == undefined) {
            await apiV1Mutate<CardDto>(`/api/v1/workspaces/${workspaceId}/cards`, 'POST', input);
            alertService.success(t('entity:cardCreated'));
            await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`));
          } else {
            await apiV1Mutate<CardDto>(`/api/v1/workspaces/${workspaceId}/cards/${card.id}`, 'PUT', input);
            alertService.success(t('entity:cardSaved'));
            await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`));
          }
        } catch (error) {
          alertApiV1Error(error, card == undefined ? t('errors:createCard') : t('errors:saveCard'));
        }
      }}
    >
      {(formik) => {
        const { values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit } = formik;
        const nameError = visibleFieldError(formik, 'name');
        const sortedGroups = [...values.groups].sort((a, b) => a.groupNumber - b.groupNumber);
        const groupIds = sortedGroups.map((_, index) => groupDragId(index));

        const handleDragEnd = (event: DragEndEvent) => {
          const { active, over } = event;
          if (!over || active.id === over.id || card?.archived) return;

          const activeGroupIndex = parseGroupDragId(String(active.id));
          const overGroupIndex = parseGroupDragId(String(over.id));
          if (activeGroupIndex != null && overGroupIndex != null) {
            setFieldValue('groups', reorderGroups(sortedGroups, activeGroupIndex, overGroupIndex));
            return;
          }

          const activeItem = parseItemDragId(String(active.id));
          const overItem = parseItemDragId(String(over.id));
          if (activeItem && overItem && activeItem.groupIndex === overItem.groupIndex) {
            const groups = [...sortedGroups];
            const group = groups[activeItem.groupIndex];
            const items = [...group.items].sort((a, b) => a.itemNumber - b.itemNumber);
            groups[activeItem.groupIndex] = {
              ...group,
              items: reorderGroupItems(items, activeItem.itemIndex, overItem.itemIndex),
            };
            setFieldValue('groups', groups);
          }
        };

        return (
          <form onSubmit={handleSubmit} noValidate>
            <FormikDirtyReporter toComparable={toComparableCard} />
            {!card?.archived ? <FormSaveButton label={card == undefined ? t('common:create') : t('common:save')} /> : null}
            <EntityFormLayout fullWidth>
              {viewMode !== 'preview' ? (
                <FormSection title={t('common:form.section.general')}>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <FormField label={t('manage:card')} htmlFor="card-name" required error={nameError}>
                      <Input
                        id="card-name"
                        name="name"
                        autoComplete="off"
                        disabled={card?.archived}
                        error={!!nameError}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.name}
                      />
                    </FormField>
                    <FormField label={t('common:date')} htmlFor="card-date">
                      <Input id="card-date" type="date" disabled={card?.archived} name="date" onChange={handleChange} onBlur={handleBlur} value={values.date} />
                    </FormField>
                  </div>
                </FormSection>
              ) : null}
              <CardEditorToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                isArchived={card?.archived}
                onAddGroup={() => setFieldValue('groups', [...sortedGroups, { name: '', items: [], groupNumber: sortedGroups.length }])}
                device={device}
                onDeviceChange={setDevice}
                density={density}
                onDensityChange={setDensity}
                orientation={orientation}
                onOrientationChange={setOrientation}
                tabletSize={tabletSize}
                onTabletSizeChange={setTabletSize}
                isDeviceDisabled={isDeviceDisabled}
                isTabletSizeDisabled={isTabletSizeDisabled}
                isOrientationDisabled={isOrientationDisabled}
              />

              <FieldArray name="groups">
                {({ remove: removeGroup }) => (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                      <div
                        className={`mx-auto w-full ${
                          device !== 'desktop' ? 'rounded-[2.5rem] border-4 border-base-400 bg-base-300/40 p-3 shadow-lg md:p-4' : ''
                        }`}
                        style={device !== 'desktop' ? { width: `min(${effectiveWidth}px, 100%)`, maxWidth: `${effectiveWidth}px` } : undefined}
                      >
                        <div className="flex w-full flex-col gap-3">
                          {sortedGroups.map((group, groupIndex) => (
                            <CardGroupSection
                              key={`card-group-${groupIndex}`}
                              group={group}
                              groupIndex={groupIndex}
                              viewMode={viewMode}
                              columns={columns}
                              stackHeader={stackHeader}
                              cocktails={cocktails}
                              loadingCocktails={loadingCocktails}
                              isArchived={card?.archived}
                              errors={errors?.groups?.[groupIndex] as FormikErrors<CocktailCardGroupError>}
                              touched={touched?.groups?.[groupIndex]}
                              values={values}
                              onFieldChange={handleChange}
                              onFieldBlur={handleBlur}
                              onRemoveGroup={() =>
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    spelling={'REMOVE'}
                                    entityName={group.name ? t('entity:theGroupNamed', { name: group.name }) : t('entity:theGroup')}
                                    onApprove={async () => removeGroup(groupIndex)}
                                  />,
                                )
                              }
                              onReorderItems={(items) => setFieldValue(`groups.${groupIndex}.items`, items)}
                              openModal={(modal) => modalContext.openModal(modal)}
                            />
                          ))}
                        </div>
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </FieldArray>
            </EntityFormLayout>
          </form>
        );
      }}
    </Formik>
  );
}

interface CardEditorArchiveActionsProps {
  card: CardDto;
  workspaceId: string;
}

export function CardEditorArchiveActions({ card, workspaceId }: CardEditorArchiveActionsProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors']);
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();
  const router = useRouter();

  return (
    <div className="mt-4 md:mt-6">
      <FormSection title={t('common:form.moreActions')}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await apiV1Mutate<CardDto>(`/api/v1/workspaces/${workspaceId}/cards/${card.id}/${card.archived ? 'unarchive' : 'archive'}`, 'PUT');
                await unsavedChanges.completeSave(() => router.replace(`/workspaces/${workspaceId}/manage/cards`));
                alertService.success(card.archived ? t('entity:cardUnarchiveSuccess') : t('entity:cardArchiveSuccess'));
              } catch (error) {
                alertApiV1Error(error, card.archived ? t('errors:unarchiveCard') : t('errors:archiveCard'));
              }
            }}
          >
            {card.archived ? <FaBoxOpen aria-hidden /> : <FaArchive aria-hidden />}
            {card.archived ? t('unarchiveCard') : t('archiveCard')}
          </Button>
          <Button
            type="button"
            variant="outline-error"
            onClick={() =>
              modalContext.openModal(
                <DeleteConfirmationModal
                  spelling={'DELETE'}
                  entityName={t('entity:theCard', { name: card.name })}
                  onApprove={async () => {
                    try {
                      await apiV1Mutate(`/api/v1/workspaces/${workspaceId}/cards/${card.id}`, 'DELETE');
                      alertService.success(t('entity:cardDeleted'));
                      await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`));
                    } catch (error) {
                      alertApiV1Error(error, t('errors:deleteCard'));
                    }
                  }}
                />,
              )
            }
          >
            <FaTrashAlt aria-hidden />
            {t('deleteCard')}
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
