import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { FieldArray, Formik, FormikErrors } from 'formik';
import { FaAngleDown, FaAngleLeft, FaAngleRight, FaAngleUp, FaEuroSign, FaTrashAlt } from 'react-icons/fa';
import { CompactCocktailRecipeInstruction } from '../../../../../components/cocktails/CompactCocktailRecipeInstruction';
import React, { useContext, useEffect, useState } from 'react';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';
import { SearchModal } from '../../../../../components/modals/SearchModal';
import { useRouter } from 'next/router';
import { CocktailCardFull } from '../../../../../models/CocktailCardFull';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { Role } from '@prisma/client';
import { DeleteConfirmationModal } from '../../../../../components/modals/DeleteConfirmationModal';
import _ from 'lodash';

interface CocktailCardGroupError {
  name?: string;
  groupPrice?: string;
}

interface CocktailCardError {
  name?: string;
  groups?: FormikErrors<CocktailCardGroupError[]>;
}

function EditCocktailCard() {
  const modalContext = useContext(ModalContext);
  const router = useRouter();

  const { id, workspaceId } = router.query;

  const [card, setCard] = useState<CocktailCardFull | undefined>(undefined);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);

  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [loadingCocktails, setLoadingCocktails] = useState<boolean>(false);

  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!workspaceId) return;
    setLoadingCard(true);
    fetch(`/api/workspaces/${workspaceId}/cards/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCard(body.data);
        } else {
          console.error('CardId -> fetchCard', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Karte', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CardId -> fetchCard', error);
        alertService.error('Fehler beim Laden der Karte');
      })
      .finally(() => {
        setLoadingCard(false);
      });

    setLoadingCocktails(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktails(body.data);
        } else {
          console.error('CardId -> fetchCocktails', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktails', response.status, response.statusText);
        }
      })
      .catch((err) => {
        console.error('CardId -> fetchCocktails', err);
        alertService.error('Fehler beim Laden der Cocktails');
      })
      .finally(() => {
        setLoadingCocktails(false);
      });
  }, [id, workspaceId]);

  return loadingCard ? (
    <Loading />
  ) : (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/cards`}
      title={'Karte'}
      unsavedChanges={unsavedChanges}
      actions={
        card != undefined ? (
          <button
            type={'button'}
            className={`btn ${deleting ? '' : 'btn-square'} btn-outline btn-error btn-sm`}
            disabled={deleting}
            onClick={() =>
              modalContext.openModal(
                <DeleteConfirmationModal
                  spelling={'DELETE'}
                  entityName={'die Karte'}
                  onApprove={async () => {
                    if (!workspaceId) return;
                    if (deleting) return;
                    setDeleting(true);
                    fetch(`/api/workspaces/${workspaceId}/cards/${card.id}`, {
                      method: 'DELETE',
                    })
                      .then(async (response) => {
                        const body = await response.json();
                        if (response.ok) {
                          router.replace(`/workspaces/${workspaceId}/manage/cards`).then(() => alertService.success('Karte gelöscht'));
                        } else {
                          console.error('CardId -> deleteCard', response);
                          alertService.error(body.message ?? 'Fehler beim Löschen der Karte', response.status, response.statusText);
                        }
                      })
                      .catch((error) => {
                        console.error('CardId -> deleteCard', error);
                        alertService.error('Fehler beim Löschen der Karte');
                      })
                      .finally(() => {
                        setDeleting(false);
                      });
                  }}
                />,
              )
            }
          >
            <FaTrashAlt />
            {deleting ? <span className={'loading loading-spinner'}></span> : <></>}
          </button>
        ) : (
          <></>
        )
      }
    >
      <Formik
        initialValues={{
          groups: card?.groups.sort((a, b) => a.groupNumber - b.groupNumber) ?? [],
          name: card?.name ?? '',
          date: card?.date != undefined ? new Date(card.date).toISOString().split('T')[0] : '',
        }}
        validate={(values) => {
          var reducedCard: any = _.omit(card, ['workspaceId', 'id', 'groups[*].items[*].cocktail']);
          if (reducedCard.date == null) {
            reducedCard.date = '';
          }
          setUnsavedChanges(!_.isEqual(values, reducedCard));

          const errors: CocktailCardError = {};
          if (!values.name || values.name.trim() == '') {
            errors.name = 'Required';
          }

          let groupErrors: CocktailCardGroupError[] = [];
          values.groups.forEach((group, groupIndex) => {
            const groupError: CocktailCardGroupError = {};
            if (!group.name || group.name.trim() == '') {
              groupErrors[groupIndex] = { name: 'Required' };
            }
            let itemErrors: any = [];
            group.items.forEach((item) => {
              const itemError: any = {};
              if (!item.cocktailId || item.cocktailId.trim() == '') {
                itemError.cocktailId = 'Required';
              }
              itemErrors.push(itemError);
            });
            groupErrors.push(groupError);
          });

          if (groupErrors.filter((lineItemErrors: any) => Object.keys(lineItemErrors).length > 0).length > 0) {
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
                router.replace(`/workspaces/${workspaceId}/manage/cards`).then(() => alertService.success('Karte erfolgreich erstellt'));
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
                router.replace(`/workspaces/${workspaceId}/manage/cards`).then(() => alertService.success('Karte erfolgreich gespeichert'));
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
        {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
          <form onSubmit={handleSubmit}>
            <div className={'flex flex-col space-y-2'}>
              <div className={'flex flex-col gap-2 rounded-2xl border border-base-300 p-2 md:flex-row'}>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <div className={'label-text'}>Karte</div>
                    <div className={'label-text-alt text-error'}>
                      <span>{errors.name && touched.name ? errors.name : ''}</span>
                      <span>*</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    className={`input input-bordered ${errors.name && touched.name ? 'input-error' : ''}`}
                    name={`name`}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.name}
                  />
                </div>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <div className={'label-text'}>Datum</div>
                    <div className={'label-text-alt text-error'}>
                      <span>{errors.date && touched.date ? errors.date : ''}</span>
                    </div>
                  </label>
                  <input
                    type={'date'}
                    className={`input input-bordered ${errors.date && touched.date ? 'input-error' : ''}}`}
                    name={`date`}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.date}
                  />
                </div>
              </div>
              <FieldArray name={'groups'}>
                {({ push: pushGroup, remove: removeGroup }) => (
                  <>
                    {values?.groups
                      .sort((a, b) => a.groupNumber - b.groupNumber)
                      .map((group, groupIndex) => (
                        <div key={`card-group-${groupIndex}`} className={'rounded-2xl border border-base-300 p-2'}>
                          <div className={'grid grid-cols-1 items-center gap-2 md:grid-cols-3'}>
                            <div className={'form-control flex-1'}>
                              <label className={'label'}>
                                <div className={'label-text'}>Gruppe</div>
                                <div className={'label-text-alt text-error'}>
                                  <span>
                                    {(errors?.groups?.[groupIndex] as any)?.name && touched?.groups?.[groupIndex]?.name
                                      ? (errors?.groups?.[groupIndex] as any)?.name
                                      : ''}
                                  </span>
                                  <span>*</span>
                                </div>
                              </label>
                              <input
                                type="text"
                                className={`input input-bordered w-full ${
                                  (errors?.groups?.[groupIndex] as any)?.name && touched?.groups?.[groupIndex]?.name ? 'input-error' : ''
                                }`}
                                name={`groups.${groupIndex}.name`}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                value={values.groups[groupIndex].name}
                              />
                            </div>
                            <div className={' form-control flex-1'}>
                              <label className={'label'}>
                                <div className={'label-text'}>Gruppen Preis</div>
                                <div className={'label-text-alt text-error'}>
                                  <span>
                                    {(errors?.groups?.[groupIndex] as any)?.groupPrice && touched?.groups?.[groupIndex]?.groupPrice
                                      ? (errors?.groups?.[groupIndex] as any)?.groupPrice
                                      : ''}
                                  </span>
                                </div>
                              </label>
                              <div className={'join'}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className={`input join-item input-bordered w-full ${
                                    (errors?.groups?.[groupIndex] as any)?.groupPrice && touched?.groups?.[groupIndex]?.groupPrice ? 'input-error' : ''
                                  }`}
                                  name={`groups.${groupIndex}.groupPrice`}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  value={values.groups[groupIndex].groupPrice ?? ''}
                                />
                                <span className={'btn btn-primary join-item'}>
                                  <FaEuroSign />
                                </span>
                              </div>
                            </div>
                            <div className={'space-x-2 justify-self-end'}>
                              <button
                                type={'button'}
                                disabled={groupIndex == 0}
                                className={'btn btn-square btn-outline btn-sm'}
                                onClick={() => {
                                  const value = values.groups[groupIndex];
                                  const reorderedGroups = values.groups.filter((_, i) => i != groupIndex);
                                  reorderedGroups.splice(groupIndex - 1, 0, value);
                                  setFieldValue(
                                    'groups',
                                    reorderedGroups.map((group, groupIndex) => ({
                                      ...group,
                                      groupNumber: groupIndex,
                                    })),
                                  );
                                }}
                              >
                                <FaAngleUp />
                              </button>
                              <button
                                type={'button'}
                                disabled={!(values.groups.length > 1) || groupIndex == values.groups.length - 1}
                                className={'btn btn-square btn-outline btn-sm'}
                                onClick={() => {
                                  const value = values.groups[groupIndex];
                                  const reorderedGroups = values.groups.filter((_, i) => i != groupIndex);
                                  reorderedGroups.splice(groupIndex + 1, 0, value);
                                  setFieldValue(
                                    'groups',
                                    reorderedGroups.map((group, groupIndex) => ({
                                      ...group,
                                      groupNumber: groupIndex,
                                    })),
                                  );
                                }}
                              >
                                <FaAngleDown />
                              </button>
                              <button
                                type="button"
                                className={'btn btn-square btn-outline btn-error btn-sm'}
                                onClick={() =>
                                  modalContext.openModal(
                                    <DeleteConfirmationModal spelling={'REMOVE'} entityName={'die Gruppe'} onApprove={() => removeGroup(groupIndex)} />,
                                  )
                                }
                              >
                                <FaTrashAlt />
                              </button>
                            </div>
                          </div>
                          <div className={'border-b border-base-300 p-1'}></div>
                          <div className={'pt-2'}>
                            <FieldArray name={`groups.${groupIndex}.items`}>
                              {({ push: pushItem, remove: removeItem }) => (
                                <div className={'grid grid-cols-1 gap-2 md:grid-cols-3'}>
                                  {values.groups[groupIndex].items
                                    .sort((a, b) => a.itemNumber - b.itemNumber)
                                    .map((item, itemIndex) => (
                                      <div key={`card-group-${groupIndex}-item-${itemIndex}`} className={'card col-span-1'}>
                                        <div className={'card-body'}>
                                          <div className={'flex justify-end space-x-2'}>
                                            <button
                                              type={'button'}
                                              disabled={itemIndex == 0}
                                              className={'btn btn-square btn-outline btn-sm'}
                                              onClick={() => {
                                                const value = values.groups[groupIndex].items[itemIndex];
                                                const reorderedItems = values.groups[groupIndex].items.filter((_, i) => i != itemIndex);
                                                reorderedItems.splice(itemIndex - 1, 0, value);
                                                setFieldValue(
                                                  `groups.${groupIndex}.items`,
                                                  reorderedItems.map((item, itemIndex) => ({
                                                    ...item,
                                                    itemNumber: itemIndex,
                                                  })),
                                                );
                                              }}
                                            >
                                              <FaAngleLeft />
                                            </button>
                                            <button
                                              type={'button'}
                                              disabled={
                                                !(values.groups[groupIndex].items.length > 1) || itemIndex == values.groups[groupIndex].items.length - 1
                                              }
                                              className={'btn btn-square btn-outline btn-sm'}
                                              onClick={() => {
                                                const value = values.groups[groupIndex].items[itemIndex];
                                                const reorderedItems = values.groups[groupIndex].items.filter((_, i) => i != itemIndex);
                                                reorderedItems.splice(itemIndex + 1, 0, value);
                                                setFieldValue(
                                                  `groups.${groupIndex}.items`,
                                                  reorderedItems.map((item, itemIndex) => ({
                                                    ...item,
                                                    itemNumber: itemIndex,
                                                  })),
                                                );
                                              }}
                                            >
                                              <FaAngleRight />
                                            </button>
                                            <div
                                              className={'btn btn-square btn-outline btn-error btn-sm'}
                                              onClick={() =>
                                                modalContext.openModal(
                                                  <DeleteConfirmationModal
                                                    spelling={'REMOVE'}
                                                    entityName={'den Cocktail von der Gruppe'}
                                                    onApprove={() => removeItem(itemIndex)}
                                                  />,
                                                )
                                              }
                                            >
                                              <FaTrashAlt />
                                            </div>
                                          </div>

                                          {cocktails.find((cocktail) => cocktail.id == item.cocktailId) != undefined ? (
                                            <CompactCocktailRecipeInstruction
                                              showPrice={true}
                                              cocktailRecipe={cocktails.find((cocktail) => cocktail.id == item.cocktailId)!}
                                            />
                                          ) : loadingCocktails ? (
                                            <Loading />
                                          ) : (
                                            <div>Unbekannt</div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  <div className={'col-span-1 flex flex-row justify-end md:col-span-3'}>
                                    <button
                                      type="button"
                                      className={'btn btn-outline btn-secondary btn-sm'}
                                      onClick={() =>
                                        modalContext.openModal(
                                          <SearchModal
                                            selectedCocktails={values.groups[groupIndex].items.map((item) => item.cocktailId)}
                                            onCocktailSelectedObject={(cocktail) => {
                                              pushItem({ cocktailId: cocktail.id });
                                            }}
                                            selectionLabel={'Hinzufügen'}
                                          />,
                                        )
                                      }
                                    >
                                      Cocktail hinzufügen
                                    </button>
                                  </div>
                                </div>
                              )}
                            </FieldArray>
                          </div>
                        </div>
                      ))}
                    <div className={'flex flex-row items-center justify-end space-x-2'}>
                      <button type="button" className={'btn btn-secondary btn-sm'} onClick={() => pushGroup({ name: '', items: [] })}>
                        Gruppe hinzufügen
                      </button>
                      <button type="submit" className={`btn btn-primary btn-sm ${isSubmitting ? 'loading' : ''}`}>
                        Speichern
                      </button>
                    </div>
                  </>
                )}
              </FieldArray>
            </div>
          </form>
        )}
      </Formik>
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailCard, '/workspaces/[workspaceId]/manage');
