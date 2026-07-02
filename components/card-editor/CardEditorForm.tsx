import React, { useContext, useEffect, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldArray, Formik, FormikErrors } from 'formik';
import { FaTrashAlt } from 'react-icons/fa';
import _ from 'lodash';
import { useRouter } from 'next/router';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { CocktailCardFull } from '../../models/CocktailCardFull';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { Button, Divider, FormControl, Input, Label, LabelText, LabelTextAlt } from '@components/ui';
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

interface CocktailCardError {
  name?: string;
  groups?: FormikErrors<CocktailCardGroupError[]>;
}

interface CardEditorFormProps {
  card?: CocktailCardFull;
  cocktails: CocktailRecipeFull[];
  loadingCocktails: boolean;
  workspaceId: string;
  onUnsavedChangesChange: (unsaved: boolean) => void;
}

export function CardEditorForm({ card, cocktails, loadingCocktails, workspaceId, onUnsavedChangesChange }: CardEditorFormProps) {
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <Formik<CardEditorFormValues>
      initialValues={{
        groups: card?.groups.sort((a, b) => a.groupNumber - b.groupNumber) ?? [],
        name: card?.name ?? '',
        date: card?.date != undefined ? new Date(card.date).toISOString().split('T')[0] : '',
      }}
      enableReinitialize
      validate={(values) => {
        const reducedCard = _.omit(card, ['workspaceId', 'id', 'groups[*].items[*].cocktail']) as Record<string, unknown>;
        if (reducedCard.date == null) {
          reducedCard.date = '';
        }
        onUnsavedChangesChange(!_.isEqual(values, reducedCard));

        const errors: CocktailCardError = {};
        if (!values.name || values.name.trim() == '') {
          errors.name = 'Required';
        }

        const groupErrors: CocktailCardGroupError[] = [];
        values.groups.forEach((group, groupIndex) => {
          const groupError: CocktailCardGroupError = {};
          if (!group.name || group.name.trim() == '') {
            groupError.name = 'Required';
          }
          if (Object.keys(groupError).length > 0) {
            groupErrors[groupIndex] = groupError;
          }
        });

        if (groupErrors.filter((lineItemErrors) => Object.keys(lineItemErrors).length > 0).length > 0) {
          errors.groups = groupErrors;
        }

        return errors;
      }}
      onSubmit={async (values) => {
        try {
          const input = {
            id: card?.id,
            name: values.name,
            date: values.date != '' ? new Date(values.date).toISOString() : null,
            groups: values.groups.map((group, index) => ({
              name: group.name,
              groupNumber: index,
              groupPrice: group.groupPrice,
              items: group.items.map((item, itemIndex) => ({
                itemNumber: itemIndex,
                cocktailId: item.cocktailId,
              })),
            })),
          };

          if (card == undefined) {
            const response = await fetch(`/api/workspaces/${workspaceId}/cards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(input),
            });

            if (response.ok) {
              alertService.success('Karte erfolgreich erstellt');
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`);
            } else {
              const body = await response.json();
              console.error('CardId -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Karte', response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/cards/${card.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(input),
            });

            if (response.ok) {
              alertService.success('Karte erfolgreich gespeichert');
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`);
            } else {
              const body = await response.json();
              console.error('CardId -> onSubmit[update]', response);
              alertService.error(body.message ?? 'Fehler beim Speichern der Karte', response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error('CardId -> onSubmit', error);
          alertService.error('Es ist ein Fehler aufgetreten');
        }
      }}
    >
      {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => {
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
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3">
              <CardEditorToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                isArchived={card?.archived}
                isSubmitting={isSubmitting}
                onAddGroup={() => setFieldValue('groups', [...sortedGroups, { name: '', items: [], groupNumber: sortedGroups.length }])}
                onSave={() => handleSubmit()}
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
              >
                {viewMode !== 'preview' ? (
                  <div className="flex flex-col gap-2 md:flex-row">
                    <FormControl>
                      <Label className="flex-row items-center justify-between">
                        <LabelText>Karte</LabelText>
                        <LabelTextAlt className="text-error">
                          <span>{errors.name && touched.name ? errors.name : ''}</span>
                          <span>*</span>
                        </LabelTextAlt>
                      </Label>
                      <Input
                        type="text"
                        disabled={card?.archived}
                        className={errors.name && touched.name ? 'border-error' : undefined}
                        name="name"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.name}
                      />
                    </FormControl>
                    <FormControl>
                      <Label className="flex-row items-center justify-between">
                        <LabelText>Datum</LabelText>
                      </Label>
                      <Input type="date" disabled={card?.archived} name="date" onChange={handleChange} onBlur={handleBlur} value={values.date} />
                    </FormControl>
                  </div>
                ) : null}
              </CardEditorToolbar>

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
                              onMoveGroupUp={() => {
                                if (groupIndex === 0) return;
                                setFieldValue('groups', reorderGroups(sortedGroups, groupIndex, groupIndex - 1));
                              }}
                              onMoveGroupDown={() => {
                                if (groupIndex >= sortedGroups.length - 1) return;
                                setFieldValue('groups', reorderGroups(sortedGroups, groupIndex, groupIndex + 1));
                              }}
                              onRemoveGroup={() =>
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    spelling={'REMOVE'}
                                    entityName={`die Gruppe${group.name ? ` '${group.name}'` : ''}`}
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
            </div>
          </form>
        );
      }}
    </Formik>
  );
}

interface CardEditorArchiveActionsProps {
  card: CocktailCardFull;
  workspaceId: string;
}

export function CardEditorArchiveActions({ card, workspaceId }: CardEditorArchiveActionsProps) {
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);
  const router = useRouter();

  return (
    <>
      <Divider />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            const response = await fetch(`/api/workspaces/${workspaceId}/cards/${card.id}/${card.archived ? 'unarchive' : 'archive'}`, {
              method: 'PUT',
            });

            const body = await response.json();
            if (response.ok) {
              router
                .replace(`/workspaces/${workspaceId}/manage/cards`)
                .then(() => alertService.success(`Karte ${card.archived ? 'entarchiviert' : 'archiviert'}`));
            } else {
              console.error('CardId -> (un)archive', response);
              alertService.error(
                body.message ?? `Fehler beim ${card.archived ? 'Entarchivieren' : 'Archivieren'} der Karte`,
                response.status,
                response.statusText,
              );
            }
          }}
        >
          {card.archived ? 'Karte entarchivieren' : 'Karte archivieren'}
        </Button>
        <Button
          type="button"
          variant="outline-error"
          size="sm"
          onClick={() =>
            modalContext.openModal(
              <DeleteConfirmationModal
                spelling={'DELETE'}
                entityName={`die Karte '${card.name}'`}
                onApprove={async () => {
                  const response = await fetch(`/api/workspaces/${workspaceId}/cards/${card.id}`, {
                    method: 'DELETE',
                  });

                  const body = await response.json();
                  if (response.ok) {
                    alertService.success('Karte gelöscht');
                    await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cards`);
                  } else {
                    console.error('CardId -> deleteCard', response);
                    alertService.error(body.message ?? 'Fehler beim Löschen der Karte', response.status, response.statusText);
                  }
                }}
              />,
            )
          }
        >
          <FaTrashAlt />
          Karte löschen
        </Button>
      </div>
    </>
  );
}
