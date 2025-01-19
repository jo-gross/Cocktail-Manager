import { FaAngleDown, FaAngleUp, FaEuroSign, FaPlus, FaSearch, FaTrashAlt } from 'react-icons/fa';
import { Field, FieldArray, Formik, FormikProps } from 'formik';
import React, { createRef, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipe, Garnish, Glass, Ice, Ingredient, Unit, WorkspaceCocktailRecipeStepAction } from '@prisma/client';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '../../lib/Base64Converter';
import { CocktailRecipeStepFull } from '../../models/CocktailRecipeStepFull';
import CocktailRecipeCardItem from './CocktailRecipeCardItem';
import { alertService } from '../../lib/alertService';
import { CocktailRecipeGarnishFull } from '../../models/CocktailRecipeGarnishFull';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _, { orderBy } from 'lodash';
import { resizeImage } from '../../lib/ImageCompressor';
import { SelectModal } from '../modals/SelectModal';
import FormModal from '../modals/FormModal';
import { GarnishForm } from '../garnishes/GarnishForm';
import { IngredientForm } from '../ingredients/IngredientForm';
import { GlassForm } from '../glasses/GlassForm';
import { CocktailRecipeFullWithImage } from '../../models/CocktailRecipeFullWithImage';
import { UserContext } from '../../lib/context/UserContextProvider';
import { GlassModel } from '../../models/GlassModel';
import { IngredientModel } from '../../models/IngredientModel';
import { fetchGlasses } from '../../lib/network/glasses';
import { fetchGarnishes } from '../../lib/network/garnishes';
import { fetchIngredients } from '../../lib/network/ingredients';
import { fetchActions } from '../../lib/network/actions';
import { fetchUnits } from '../../lib/network/units';
import { calcCocktailTotalPrice } from '../../lib/CocktailRecipeCalculation';
import Image from 'next/image';
import { fetchIce } from '../../lib/network/ices';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { DaisyUITagInput } from '../DaisyUITagInput';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import DeepDiff from 'deep-diff';
import { RoutingContext } from '../../lib/context/RoutingContextProvider';

interface CocktailRecipeFormProps {
  cocktailRecipe?: CocktailRecipeFullWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef: React.RefObject<FormikProps<any>>;
}

interface IngredientError {
  amount?: string;
  unit?: string;
  ingredientId?: string;
}

interface StepError {
  action?: string;
  ingredients?: IngredientError[];
}

interface GarnishError {
  garnishId?: string;
  optional?: string;
}

export function CocktailRecipeForm(props: CocktailRecipeFormProps) {
  const formRef = props.formRef;

  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);

  const [iceOptions, setIceOptions] = useState<Ice[]>([]);
  const [iceOptionsLoading, setIceOptionsLoading] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const [glasses, setGlasses] = useState<GlassModel[]>([]);
  const [glassesLoading, setGlassesLoading] = useState(false);

  const [garnishes, setGarnishes] = useState<Garnish[]>([]);
  const [garnishesLoading, setGarnishesLoading] = useState(false);

  const [actions, setActions] = useState<WorkspaceCocktailRecipeStepAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [similarCocktailRecipe, setSimilarCocktailRecipe] = useState<CocktailRecipe | undefined>(undefined);

  const openIngredientSelectModal = useCallback(
    (setFieldValue: any, indexStep: number, indexIngredient: number) => {
      modalContext.openModal(
        <SelectModal<Ingredient>
          title={'Zutat auswählen'}
          compareFunction={(a, b) => a.name.localeCompare(b.name)}
          fetchElements={async (search) => {
            if (search == undefined || search == '') {
              return ingredients;
            } else {
              return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(search.toLowerCase()));
            }
          }}
          elementComponent={(ingredient) => {
            return <div>{ingredient.name}</div>;
          }}
          onElementSelected={async (ingredient) => {
            await setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.ingredientId`, ingredient.id);
            await setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.ingredient`, ingredient);
          }}
        />,
      );
    },
    [ingredients, modalContext],
  );

  const openGarnishSelectModal = useCallback(
    (setFieldValue: any, indexGarnish: number) => {
      modalContext.openModal(
        <SelectModal<Garnish>
          title={'Garnitur auswählen'}
          compareFunction={(a, b) => a.name.localeCompare(b.name)}
          fetchElements={async (search) => {
            if (search == undefined || search == '') {
              return garnishes;
            } else {
              return garnishes.filter((garnish) => garnish.name.toLowerCase().includes(search.toLowerCase()));
            }
          }}
          elementComponent={(garnish) => {
            return <div>{garnish.name}</div>;
          }}
          onElementSelected={async (garnish) => {
            await setFieldValue(`garnishes.${indexGarnish}.garnishId`, garnish.id);
            await setFieldValue(`garnishes.${indexGarnish}.garnish`, garnish);
          }}
        />,
      );
    },
    [garnishes, modalContext],
  );

  useEffect(() => {
    if (props.cocktailRecipe?.glassId && glasses.length > 0) {
      formRef.current?.setFieldValue('glass', glasses.find((g) => g.id == props.cocktailRecipe?.glassId) ?? undefined);
    }
  }, [formRef, glasses, props.cocktailRecipe?.glassId]);

  useEffect(() => {
    // Otherwise not saved changes will be overwritten
    if (formRef.current?.values.garnishes == undefined) {
      if (props.cocktailRecipe != undefined && props.cocktailRecipe.garnishes?.length > 0 && garnishes.length > 0) {
        formRef.current?.setFieldValue(
          'garnishes',
          props.cocktailRecipe?.garnishes.map((garnish) => {
            return {
              ...garnish,
              garnishId: garnish.garnishId ?? '',
              garnish: garnishes.find((g) => g.id == garnish.garnishId) ?? undefined,
            };
          }),
        );
      }
    } else {
      formRef.current?.setFieldValue(
        'garnishes',
        formRef.current?.values.garnishes.map((garnish: any) => {
          return {
            ...garnish,
            garnish: garnishes.find((g) => g.id == garnish.garnishId) ?? undefined,
          };
        }),
      );
    }
  }, [formRef, garnishes, props.cocktailRecipe, props.cocktailRecipe?.garnishes]);

  useEffect(() => {
    // Otherwise not saved changes will be overwritten
    if (formRef.current?.values.steps == undefined) {
      if (props.cocktailRecipe?.steps.some((step) => step.ingredients.map((ingredient) => ingredient).length > 0) && ingredients.length > 0) {
        formRef.current?.setFieldValue(
          'steps',
          props.cocktailRecipe?.steps.map((step) => {
            return {
              ...step,
              ingredients: step.ingredients.map((ingredient) => {
                return {
                  ...ingredient,
                  ingredient: ingredients.find((i) => i.id == ingredient.ingredientId) ?? undefined,
                };
              }),
            };
          }),
        );
      }
    } else {
      formRef.current?.setFieldValue(
        'steps',
        formRef.current?.values.steps.map((step: any) => {
          return {
            ...step,
            ingredients: step.ingredients.map((ingredient: any) => {
              return {
                ...ingredient,
                ingredient: ingredients.find((i) => i.id == ingredient.ingredientId) ?? undefined,
              };
            }),
          };
        }),
      );
    }
  }, [formRef, ingredients, props.cocktailRecipe?.steps]);

  useEffect(() => {
    fetchActions(workspaceId, setActions, setActionsLoading);
    fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
    fetchIngredients(workspaceId, setIngredients, setIngredientsLoading);
    fetchGarnishes(workspaceId, setGarnishes, setGarnishesLoading);
    fetchGlasses(workspaceId, setGlasses, setGlassesLoading);
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
  }, [workspaceId]);

  const initSteps: CocktailRecipeStepFull[] = props.cocktailRecipe?.steps ?? [];

  const initValue = {
    id: props.cocktailRecipe?.id ?? '',
    name: props.cocktailRecipe?.name ?? '',
    description: props.cocktailRecipe?.description ?? '',
    notes: props.cocktailRecipe?.notes ?? '',
    history: props.cocktailRecipe?.history ?? '',
    price: props.cocktailRecipe?.price ?? undefined,
    tags: props.cocktailRecipe?.tags ?? [],
    iceId: props.cocktailRecipe?.iceId ?? null,
    image: props.cocktailRecipe?.CocktailRecipeImage[0]?.image ?? undefined,
    originalImage:
      (props.cocktailRecipe?.CocktailRecipeImage?.length ?? 0) > 0 ? convertBase64ToFile(props.cocktailRecipe!.CocktailRecipeImage[0].image!) : undefined,
    glassId: props.cocktailRecipe?.glassId ?? undefined,
    ice: iceOptions.find((i) => i.id == props.cocktailRecipe?.iceId) ?? null,
    glass: glasses.find((g) => g.id == props.cocktailRecipe?.glassId) ?? null,
    garnishes: props.cocktailRecipe?.garnishes ?? [],
    steps: initSteps,
    workspaceId: workspaceId!,
    isArchived: props.cocktailRecipe?.isArchived ?? false,
  };

  return (
    <Formik
      innerRef={formRef}
      initialValues={initValue}
      validate={(values) => {
        const errors: any = {};

        if (props.cocktailRecipe) {
          const reducedCocktailRecipe = _.omit(props.cocktailRecipe, ['CocktailRecipeImage', 'ice', 'isArchived', '_count', 'ratings']);
          const reducedValues = _.omit(values, ['image', 'ice', 'isArchived', 'originalImage']);

          if (reducedCocktailRecipe.description == null) {
            reducedCocktailRecipe.description = '';
          }
          if (reducedCocktailRecipe.notes == null) {
            reducedCocktailRecipe.notes = '';
          }
          if (reducedCocktailRecipe.price == null) {
            reducedCocktailRecipe.price = undefined;
          }
          if (reducedValues.price == '') {
            reducedValues.price = undefined;
          }

          if (reducedCocktailRecipe.steps != undefined) {
            reducedCocktailRecipe.steps = orderBy(reducedCocktailRecipe.steps, ['stepNumber'], ['asc']);
            reducedCocktailRecipe.steps.forEach((step) => {
              step.ingredients = orderBy(step.ingredients, ['ingredientNumber'], ['asc']);
            });
          }
          if (values.steps != undefined) {
            values.steps = orderBy(values.steps, ['stepNumber'], ['asc']);
            (values.steps as any[]).forEach((step) => {
              step.ingredients = orderBy(step.ingredients, ['ingredientNumber'], ['asc']);

              step.ingredients = _.map(step.ingredients, (obj) => {
                return _.assign({}, obj, { ingredient: _.omit(obj.ingredient, 'IngredientVolume') });
              });
            });
          }
          // console.debug('CocktailRecipe', reducedCocktailRecipe);
          // console.debug('Values', values);
          console.debug('Difference', DeepDiff.diff(reducedCocktailRecipe, reducedValues));
          // console.debug('Differs', !_.isEqual(reducedCocktailRecipe, values));

          const areImageEqual =
            (props.cocktailRecipe.CocktailRecipeImage.length > 0 ? props.cocktailRecipe.CocktailRecipeImage[0].image.toString() : undefined) == values.image;

          props.setUnsavedChanges?.(!_.isEqual(reducedCocktailRecipe, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }

        if (!values.name || values.name.trim() == '') {
          errors.name = 'Required';
        }
        if (!values.glassId || values.glassId == '') {
          errors.glassId = 'Required';
        }
        if (!values.iceId || values.ice == '') {
          errors.iceId = 'Required';
        }
        if (values.originalImage != undefined && values.image == undefined) {
          errors.image = 'Bild ausgewählt aber nicht zugeschnitten';
        }

        const stepsErrors: StepError[] = [];
        (values.steps as CocktailRecipeStepFull[]).map((step) => {
          const stepErrors: StepError = {};
          if (step.action == undefined) {
            stepErrors.action = 'Required';
          }

          const ingredientsErrors: IngredientError[] = [];

          step.ingredients.map((ingredient) => {
            const ingredientErrors: IngredientError = {};
            if (ingredient.amount && isNaN(ingredient.amount)) {
              ingredientErrors.amount = 'Required';
            }
            if (!ingredient.unitId || ingredient.unitId == '') {
              ingredientErrors.unit = 'Required';
            }
            if (!ingredient.ingredientId || ingredient.ingredientId == '') {
              ingredientErrors.ingredientId = 'Required';
            }
            ingredientsErrors.push(ingredientErrors);
          });
          stepErrors.ingredients = ingredientsErrors;

          stepsErrors.push(stepErrors);
        });

        let hasErrors = false;
        stepsErrors.map((stepErrors) => {
          stepErrors.ingredients?.map((ingredientErrors) => {
            if (Object.keys(ingredientErrors).length > 0) {
              hasErrors = true;
            }
          });
        });
        if (hasErrors) {
          errors.steps = stepsErrors;
        }

        hasErrors = false;
        const garnishErrors: GarnishError[] = [];
        (values.garnishes as CocktailRecipeGarnishFull[]).map((garnish) => {
          const garnishError: GarnishError = {};
          if (!garnish.garnishId || garnish.garnishId == '') {
            garnishError.garnishId = 'Required';
          }

          garnishErrors.push(garnishError);
        });

        garnishErrors.map((garnishError) => {
          if (Object.keys(garnishError).length > 0) {
            hasErrors = true;
          }
        });
        if (hasErrors) {
          errors.garnishes = garnishErrors;
        }

        console.log('cocktail form errors', errors);
        return errors;
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.cocktailRecipe?.id,
            name: values.name,
            description: values.description.trim() === '' ? null : values.description.trim(),
            notes: values.notes.trim() === '' ? null : values.notes.trim(),
            history: values.history.trim() === '' ? null : values.history.trim(),
            price: values.price == '' ? null : values.price,
            iceId: values.iceId,
            glassId: values.glassId,
            garnishId: values.garnishId,
            image: values.image == '' ? null : values.image,
            tags: values.tags,
            steps: (values.steps as CocktailRecipeStepFull[]).map((step, index) => {
              return {
                ...step,
                stepNumber: index,
                ingredients: step.ingredients.map((ingredient, index) => {
                  return {
                    ...ingredient,
                    ingredientNumber: index,
                  };
                }),
              };
            }),
            garnishes: (values.garnishes as CocktailRecipeGarnishFull[]).map((garnish, index) => {
              return {
                ...garnish,
                garnishNumber: index,
              };
            }),
          };
          if (props.cocktailRecipe == undefined) {
            const response = await fetch(`/api/workspaces/${workspaceId}/cocktails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              alertService.success('Erfolgreich erstellt');
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cocktails`);
            } else {
              const body = await response.json();
              console.error('CocktailRecipeForm -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen des Cocktails', response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailRecipe.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              alertService.success('Erfolgreich aktualisiert');
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cocktails#${props.cocktailRecipe.id}`);
            } else {
              const body = await response.json();
              console.error('CocktailRecipeForm -> onSubmit[update]', response);
              alertService.error(body.message ?? 'Fehler beim Speichern des Cocktails', response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error('CocktailRecipeForm -> onSubmit', error);
          alertService.error('Es ist ein Fehler aufgetreten');
        }
      }}
    >
      {({ values, setFieldValue, setFieldError, errors, handleChange, handleBlur, handleSubmit, isSubmitting, isValid }) => (
        <form onSubmit={handleSubmit}>
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-3'}>
            <div className={'card grid-cols-1 md:col-span-2'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold'}>Cocktail erfassen</div>
                <div className={'divider'}></div>
                <div className={'grid grid-cols-2 gap-4'}>
                  <div className={'col-span-2'}>
                    <label className={'label'} htmlFor={'name'}>
                      <span className={'label-text'}>Name</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.name && errors.name}</> *
                      </span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      autoComplete={'off'}
                      id={'name'}
                      className={`input input-bordered w-full ${errors.name && 'input-error'}`}
                      onChange={(event) => {
                        if (event.target.value.length > 2) {
                          fetch(`/api/workspaces/${workspaceId}/cocktails/check?name=${event.target.value}`)
                            .then((response) => response.json())
                            .then((data) => {
                              console.log(data);
                              if (data.data != null) {
                                if (data.data.id != props.cocktailRecipe?.id) {
                                  setSimilarCocktailRecipe(data.data);
                                } else {
                                  setSimilarCocktailRecipe(undefined);
                                }
                              } else {
                                setSimilarCocktailRecipe(undefined);
                              }
                            });
                        } else {
                          setSimilarCocktailRecipe(undefined);
                        }
                        handleChange(event);
                      }}
                      onBlur={handleBlur}
                      value={values.name}
                    />
                    {similarCocktailRecipe && (
                      <div className="label">
                        <span className="label-text-alt text-warning">
                          Eine ähnlicher Cocktail mit dem Namen <strong>{similarCocktailRecipe.name}</strong> existiert bereits.
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={'col-span-2'}>
                    <label className={'label'} htmlFor={'notes'}>
                      <span className={'label-text'}>Zubereitungsnotizen</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.notes && errors.notes}</>
                      </span>
                    </label>
                    <textarea
                      id={'notes'}
                      name="notes"
                      className={`textarea textarea-bordered w-full ${errors.notes && 'textarea-error'}`}
                      placeholder={'Zubereitungshinweise, Tipps, etc.'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.notes}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2'}>
                    <label className={'label'} htmlFor={'description'}>
                      <span className={'label-text'}>Allgemeine Beschreibung</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.description && errors.description}</>
                      </span>
                    </label>
                    <textarea
                      id={'description'}
                      name="description"
                      className={`textarea textarea-bordered w-full ${errors.description && 'textarea-error'}`}
                      placeholder={'Was zeichnet diesen Cocktail aus? Wie schmeckt er? Was macht ihn besonders? Was sollte man wissen?'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.description}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2'}>
                    <label className={'label'} htmlFor={'history'}>
                      <span className={'label-text'}>Geschichte und Entstehung</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.history && errors.history}</>
                      </span>
                    </label>
                    <textarea
                      id={'history'}
                      name="history"
                      className={`textarea textarea-bordered w-full ${errors.history && 'textarea-error'}`}
                      placeholder={'Geschichte, Herkunft, etc.'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.history}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <label className={'label'} htmlFor={'price'}>
                      <span className={'label-text'}>Preis</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.price && errors.price}</>
                      </span>
                    </label>
                    <div className={'join w-full'}>
                      <input
                        id={'price'}
                        type="number"
                        className={`input join-item input-bordered w-full ${errors.price && 'input-error'}`}
                        name="price"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.price}
                      />
                      <span className={'btn btn-secondary join-item'}>
                        <FaEuroSign />
                      </span>
                    </div>
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <div className={'label'}>
                      <span className={'label-text'}>Tags</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.tags && errors.tags}</>
                      </span>
                    </div>
                    <div id={'tags'}>
                      <DaisyUITagInput
                        value={values.tags}
                        onChange={(tags: string[]) =>
                          setFieldValue(
                            'tags',
                            updateTags(tags, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft!')),
                          )
                        }
                        validate={(tag) => validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft!!!'))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={'label'} htmlFor={'glassId'}>
                      <span className={'label-text'}>Glas</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.glassId && errors.glassId}</> *
                      </span>
                    </label>
                    <div className={'join w-full'}>
                      <select
                        id={'glassId'}
                        name="glassId"
                        className={`join-item select select-bordered w-full ${errors.glassId && 'select-error'}`}
                        onChange={(event) => {
                          handleChange(event);
                          setFieldValue(
                            'glass',
                            glasses.find((glass) => glass.id == event.target.value),
                          );
                        }}
                        onBlur={handleBlur}
                        value={values.glassId}
                      >
                        {glassesLoading ? (
                          <option disabled={true} defaultChecked={true}>
                            Laden...
                          </option>
                        ) : (
                          <>
                            <option value={undefined}>Auswählen</option>
                            {glasses
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((glass) => (
                                <option key={`form-recipe-glasses${glass.id}`} value={glass.id}>
                                  {glass.name}
                                </option>
                              ))}
                          </>
                        )}
                      </select>
                      <button
                        type={'button'}
                        className={'btn btn-square btn-outline btn-secondary join-item'}
                        onClick={() =>
                          modalContext.openModal(
                            <FormModal<Glass>
                              form={
                                <GlassForm
                                  onSaved={async (id) => {
                                    modalContext.closeAllModals();
                                    await setFieldValue('glassId', id);
                                    fetchGlasses(workspaceId, setGlasses, setGlassesLoading);
                                  }}
                                />
                              }
                              title={'Glas erfassen'}
                            />,
                          )
                        }
                      >
                        <FaPlus />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={'label'} htmlFor={'iceId'}>
                      <span className={'label-text'}>Eis</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.iceId && errors.iceId}</> *
                      </span>
                    </label>
                    <select
                      id={'iceId'}
                      name="iceId"
                      className={`select select-bordered w-full ${errors.iceId && 'select-error'}`}
                      onChange={(event) => {
                        handleChange(event);
                        setFieldValue(
                          'ice',
                          iceOptions.find((ice) => ice.id == event.target.value),
                        );
                      }}
                      onBlur={handleBlur}
                      value={values.iceId}
                    >
                      <option value={''}>Auswählen</option>
                      {Object.values(iceOptions)
                        .sort((a, b) => userContext.getTranslation(a.name, 'de').localeCompare(userContext.getTranslation(b.name, 'de')))
                        .map((iceType) => (
                          <option key={`form-recipe-ice-types-${iceType.id}`} value={iceType.id}>
                            {userContext.getTranslation(iceType.name, 'de')}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className={'divider col-span-2'}>Darstellung</div>
                  <div className={'col-span-2'}>
                    {values.image != undefined ? (
                      <label className={'label'}>
                        <span className={'label-text'}>Vorschau Bild</span>
                      </label>
                    ) : (
                      <></>
                    )}
                    {values.image == undefined && values.originalImage == undefined ? (
                      <UploadDropZone
                        onSelectedFilesChanged={async (file) => {
                          if (file != undefined) {
                            await setFieldValue('originalImage', file);
                            await setFieldValue('image', undefined);
                          } else {
                            alertService.error('Datei konnte nicht ausgewählt werden.');
                          }
                        }}
                      />
                    ) : values.image == undefined && values.originalImage != undefined ? (
                      <div className={'w-full'}>
                        <CropComponent
                          isValid={isValid}
                          aspect={9 / 16}
                          imageToCrop={values.originalImage}
                          onCroppedImageComplete={async (file) => {
                            resizeImage(file, 504, 896, async (compressedImageFile) => {
                              if (compressedImageFile) {
                                await setFieldValue('image', await convertToBase64(new File([compressedImageFile], 'image.png', { type: 'image/png' })));
                              } else {
                                alertService.error('Bild konnte nicht skaliert werden.');
                              }
                            });
                          }}
                          onCropCancel={async () => {
                            await setFieldValue('originalImage', undefined);
                            await setFieldValue('image', undefined);
                          }}
                        />
                      </div>
                    ) : (
                      <div className={'relative'}>
                        <div className={'absolute right-2 top-2 flex flex-row gap-2'}>
                          <div
                            className={'btn btn-square btn-outline btn-sm'}
                            onClick={async () => {
                              await setFieldValue('image', undefined);
                            }}
                          >
                            <FaCropSimple />
                          </div>
                          <div
                            className={'btn btn-square btn-outline btn-error btn-sm'}
                            onClick={() =>
                              modalContext.openModal(
                                <DeleteConfirmationModal
                                  spelling={'REMOVE'}
                                  entityName={'das Bild'}
                                  onApprove={async () => {
                                    await setFieldValue('image', undefined);
                                    await setFieldValue('originalImage', undefined);
                                  }}
                                />,
                              )
                            }
                          >
                            <FaTrashAlt />
                          </div>
                        </div>
                        <div className={'bg-transparent-pattern relative h-32 w-[4.5rem] rounded-lg'}>
                          <Image className={'w-fit rounded-lg'} src={values.image} layout={'fill'} objectFit={'contain'} alt={'Cocktail image'} />
                        </div>
                        <div className={'pt-2 font-thin italic'}>
                          Info: Durch Speichern des Cocktails wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. Falls du später also
                          doch andere Bereiche auswählen möchtest, musst du das Bild dann erneut auswählen.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className={'flex flex-col gap-4'}>
              <div className={'card'}>
                <div className={'card-body'}>
                  <div className={'text-center text-2xl font-bold'}>Vorschau</div>
                  <div className={'divider'}></div>

                  <CocktailRecipeCardItem
                    image={values.image}
                    cocktailRecipe={{
                      _count: { CocktailRecipeImage: values.image != undefined ? 1 : 0 },
                      id: values.id,
                      name: values.name,
                      description: values.description.trim() == '' ? null : values.description.trim(),
                      notes: values.notes.trim() == '' ? null : values.notes.trim(),
                      history: values.history.trim() == '' ? null : values.history.trim(),
                      tags: values.tags,
                      price: !values.price && values.price == '' ? null : values.price,
                      iceId: values.iceId,
                      ice: iceOptions.find((ice) => ice.id === values.iceId) ?? null,
                      glassId: values.glassID ?? null,
                      isArchived: false,
                      glass: glasses.find((glass) => glass.id === values.glassId) ?? null,
                      garnishes: values.garnishes,
                      steps: values.steps,
                      workspaceId: workspaceId!,
                      ratings: [],
                    }}
                    showInfo={false}
                    showTags={true}
                    showImage={true}
                    showDescription={true}
                    showNotes={true}
                    showHistory={true}
                  />
                </div>
              </div>
              <div className={'hidden md:flex md:flex-col'}>
                <button type="submit" className={`btn btn-primary w-full`} disabled={isSubmitting || !isValid}>
                  {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
                  {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
                </button>
                {!isValid && (
                  <div className={'font-thin italic text-error'}>
                    Nicht alle Felder sind korrekt ausgefüllt. Kontrolliere daher alle Felder. (Name gesetzt, Bild zugeschnitten, ... ?)
                  </div>
                )}
              </div>

              <div className={'card'}>
                <div className={'card-body'}>
                  <div className={'text-center text-2xl font-bold'}>Finanzen</div>
                  <div className={'divider'}></div>
                  <div className={'grid grid-cols-2 gap-1'}>
                    <>
                      <div className={'divider-sm col-span-2'}>Zutaten</div>
                      {(values.steps as CocktailRecipeStepFull[]).filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined))
                        .length > 0 ? (
                        <>
                          {(values.steps as CocktailRecipeStepFull[])
                            .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
                            .flat()
                            ?.map((stepIngredient, indexIngredient) => (
                              <>
                                <div key={`price-calculation-step-${indexIngredient}-name`}>
                                  {stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name}
                                </div>
                                <div key={`price-calculation-step-${indexIngredient}-price`} className={'grid grid-cols-2'}>
                                  {ingredients
                                    .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                                    ?.IngredientVolume.find((volumeUnits) => volumeUnits.unitId == stepIngredient.unitId) != undefined ? (
                                    <>
                                      <div>
                                        {stepIngredient.amount?.toLocaleString(undefined, {
                                          minimumFractionDigits: 0,
                                          maximumFractionDigits: 2,
                                        }) ?? 0}{' '}
                                        {userContext.getTranslation(stepIngredient?.unit?.name ?? '', 'de')} x{' '}
                                        {(
                                          (stepIngredient.ingredient?.price ?? 0) /
                                          (ingredients
                                            .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                                            ?.IngredientVolume.find((volumeUnits) => volumeUnits.unitId == stepIngredient.unitId)?.volume ?? 1)
                                        ).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{' '}
                                        €/{userContext.getTranslation(stepIngredient?.unit?.name ?? '', 'de')}
                                      </div>
                                      <div className={'text-end'}>
                                        {indexIngredient > 0 ? '+ ' : ''}
                                        {(
                                          ((stepIngredient.ingredient?.price ?? 0) /
                                            (ingredients
                                              .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                                              ?.IngredientVolume.find((volumeUnits) => volumeUnits.unitId == stepIngredient.unitId)?.volume ?? 1)) *
                                          (stepIngredient.amount ?? 0)
                                        ).toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                        €
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>-</div>
                                      <div>-</div>
                                    </>
                                  )}
                                </div>
                              </>
                            ))}
                        </>
                      ) : (
                        <div className={'col-span-2 text-center font-thin italic'}>Keine Zutaten</div>
                      )}

                      <div className={'divider-sm col-span-2'}>Garnituren</div>
                      {(values.garnishes as CocktailRecipeGarnishFull[]).length > 0 ? (
                        <></>
                      ) : (
                        <div className={'col-span-2 text-center font-thin italic'}>Keine Garnituren</div>
                      )}
                      {(values.garnishes as CocktailRecipeGarnishFull[]).map((garnish) => (
                        <>
                          <div key={`price-calculation-step-garnish-name`}>{garnish?.garnish?.name}</div>
                          <div key={`price-calculation-step-garnish-price`} className={'grid grid-cols-2'}>
                            <div>
                              1 x{' '}
                              {(garnish?.garnish?.price ?? 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className={'text-end'}>
                              {(values.steps as CocktailRecipeStepFull[]).some((step) => step.ingredients.length > 0) ? '+ ' : ''}
                              {(garnish?.garnish?.price ?? 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              €
                            </div>
                          </div>
                        </>
                      ))}
                    </>
                    <div className={'divider-sm col-span-2'}></div>
                    <div>Summe</div>
                    <div className={'grid grid-cols-3'}>
                      <div></div>
                      <div></div>
                      <div className={'text-end font-bold'}>
                        {calcCocktailTotalPrice(values, ingredients).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }) + ' €'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={'card col-span-full'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold'}>Zubereitung</div>

                <FieldArray name={'steps'}>
                  {({ push: pushStep, remove: removeStep }) => (
                    <div className={'col-span-2 space-y-2'}>
                      {(values.steps as CocktailRecipeStepFull[]).map((step, indexStep) => (
                        <div
                          key={`form-recipe-step-${indexStep}`}
                          className={'flex w-full flex-col justify-between space-y-2 rounded-xl border border-neutral p-4'}
                        >
                          <div className={'grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4'}>
                            <div className={'flex flex-row items-center gap-2'}>
                              <div className={'font-bold'}>Schritt {indexStep + 1}</div>
                              <div className={'form-control'}>
                                <label className={'label w-fit justify-start gap-1'}>
                                  <span className={'label-text'}>Optional</span>
                                  <Field
                                    type={'checkbox'}
                                    name={`steps.${indexStep}.optional`}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={'toggle toggle-primary'}
                                  />
                                </label>
                              </div>
                            </div>
                            <div className={'form-control'}>
                              <select
                                name={`steps.${indexStep}.actionId`}
                                value={values.steps[indexStep].actionId}
                                className={'select select-bordered select-sm w-full'}
                                onChange={(event) => {
                                  handleChange(event);
                                  setFieldValue(
                                    `steps.${indexStep}.action`,
                                    actions.find((action) => action.id == event.target.value),
                                  );
                                }}
                                onBlur={handleBlur}
                              >
                                {actionsLoading ? (
                                  <option disabled={true}>Lade...</option>
                                ) : (
                                  Object.entries(_.groupBy(actions, 'actionGroup')).map(([group, groupActions]) => (
                                    <optgroup key={`form-recipe-step-${indexStep}-action-group-${group}`} label={userContext.getTranslation(group, 'de')}>
                                      {groupActions
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((action, indexAction) => (
                                          <option key={`form-recipe-step-${indexStep}-action-${indexAction}`} value={action.id}>
                                            {userContext.getTranslation(action.name, 'de')}
                                          </option>
                                        ))}
                                      )
                                    </optgroup>
                                  ))
                                )}
                              </select>
                            </div>
                            <div className={'space-x-2 md:justify-self-end'}>
                              <button
                                type={'button'}
                                disabled={indexStep == 0}
                                className={'btn btn-square btn-outline btn-sm'}
                                onClick={() => {
                                  const value = values.steps[indexStep];
                                  const reorderedSteps = (values.steps as CocktailRecipeStepFull[]).filter((_, i) => i != indexStep);
                                  reorderedSteps.splice(indexStep - 1, 0, value);
                                  setFieldValue(
                                    'steps',
                                    reorderedSteps.map((step, index) => ({ ...step, stepNumber: index })),
                                  );
                                }}
                              >
                                <FaAngleUp />
                              </button>
                              <button
                                type={'button'}
                                disabled={!(values.steps.length > 1) || indexStep == values.steps.length - 1}
                                className={'btn btn-square btn-outline btn-sm'}
                                onClick={() => {
                                  const value = values.steps[indexStep];
                                  const reorderedSteps = (values.steps as CocktailRecipeStepFull[]).filter((_, i) => i != indexStep);
                                  reorderedSteps.splice(indexStep + 1, 0, value);
                                  setFieldValue(
                                    'steps',
                                    reorderedSteps.map((step, index) => ({ ...step, stepNumber: index })),
                                  );
                                }}
                              >
                                <FaAngleDown />
                              </button>
                              <button
                                type={'button'}
                                className={'btn btn-square btn-error btn-sm'}
                                onClick={() =>
                                  modalContext.openModal(
                                    <DeleteConfirmationModal
                                      spelling={'REMOVE'}
                                      entityName={`Schritt ${indexStep + 1} - ${userContext.getTranslation(values.steps[indexStep].action.name, 'de')}`}
                                      onApprove={async () => {
                                        removeStep(indexStep);
                                      }}
                                    />,
                                  )
                                }
                              >
                                <FaTrashAlt />
                              </button>
                            </div>
                          </div>
                          <FieldArray name={`steps.${indexStep}.ingredients`}>
                            {({ push: pushIngredient, remove: removeIngredient }) => (
                              <>
                                {step.ingredients
                                  .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                                  .map((ingredient, indexIngredient) => (
                                    <div
                                      key={`form-recipe-step-${indexStep}-ingredient-${indexIngredient}`}
                                      className={'flex flex-row items-center gap-2 pt-2'}
                                    >
                                      <div className={'join join-vertical w-min items-center justify-center'}>
                                        <button
                                          type={'button'}
                                          disabled={indexIngredient == 0}
                                          className={'btn btn-square btn-outline join-item btn-xs'}
                                          onClick={() => {
                                            const value = values.steps[indexStep].ingredients[indexIngredient];
                                            const reorderedGroups = (values.steps as CocktailRecipeStepFull[])[indexStep].ingredients.filter(
                                              (_, i) => i != indexIngredient,
                                            );
                                            reorderedGroups.splice(indexIngredient - 1, 0, value);
                                            setFieldValue(
                                              `steps.${indexStep}.ingredients`,
                                              reorderedGroups.map((group, groupIndex) => ({
                                                ...group,
                                                ingredientNumber: groupIndex,
                                              })),
                                            );
                                          }}
                                        >
                                          <FaAngleUp />
                                        </button>
                                        <button
                                          type={'button'}
                                          disabled={
                                            !(values.steps[indexStep].ingredients.length > 1) ||
                                            indexIngredient == values.steps[indexStep].ingredients.length - 1
                                          }
                                          className={'btn btn-square btn-outline join-item btn-xs'}
                                          onClick={() => {
                                            const value = values.steps[indexStep].ingredients[indexIngredient];
                                            const reorderedGroups = (values.steps as CocktailRecipeStepFull[])[indexStep].ingredients.filter(
                                              (_, i) => i != indexIngredient,
                                            );
                                            reorderedGroups.splice(indexIngredient + 1, 0, value);
                                            setFieldValue(
                                              `steps.${indexStep}.ingredients`,
                                              reorderedGroups.map((group, groupIndex) => ({
                                                ...group,
                                                ingredientNumber: groupIndex,
                                              })),
                                            );
                                          }}
                                        >
                                          <FaAngleDown />
                                        </button>
                                      </div>
                                      <div className={'form-control'}>
                                        <label className={'label w-fit flex-col justify-start gap-1'}>
                                          <span className={'label-text'}>Optional</span>
                                          <span className={'label-text-alt text-error'}>
                                            {((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.optional &&
                                              ((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.optional}
                                          </span>
                                          <Field
                                            type={'checkbox'}
                                            name={`steps.${indexStep}.ingredients.${indexIngredient}.optional`}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            className={'toggle toggle-primary'}
                                          />
                                        </label>
                                      </div>
                                      <div className={'grid w-full grid-cols-2 gap-1 md:grid-cols-3'}>
                                        <div key={`form-recipe-step${step.id}-ingredient-${ingredient.id}`} className={'join col-span-2 flex w-full flex-row'}>
                                          <input
                                            id={`ingredient-${indexIngredient}-name`}
                                            className={`input join-item input-bordered w-full cursor-pointer ${
                                              ((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.ingredientId && 'input-error'
                                            }`}
                                            value={
                                              ingredientsLoading
                                                ? 'Lade...'
                                                : (values.steps[indexStep].ingredients?.[indexIngredient].ingredient?.name ?? 'Wähle eine Zutat aus...')
                                            }
                                            readOnly={true}
                                            onClick={() => {
                                              openIngredientSelectModal(setFieldValue, indexStep, indexIngredient);
                                            }}
                                          />
                                          <button
                                            type={'button'}
                                            className={'btn btn-outline btn-primary join-item'}
                                            onClick={() => {
                                              openIngredientSelectModal(setFieldValue, indexStep, indexIngredient);
                                            }}
                                          >
                                            <FaSearch />
                                          </button>
                                          <button
                                            type={'button'}
                                            className={'btn btn-outline btn-secondary join-item'}
                                            onClick={() => {
                                              modalContext.openModal(
                                                <FormModal<Ingredient>
                                                  form={
                                                    <IngredientForm
                                                      formRef={createRef<FormikProps<any>>()}
                                                      onSaved={async (id) => {
                                                        modalContext.closeAllModals();
                                                        await setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.ingredientId`, id);
                                                        fetchIngredients(workspaceId, setIngredients, setIngredientsLoading);
                                                      }}
                                                    />
                                                  }
                                                  title={'Zutat erfassen'}
                                                />,
                                              );
                                            }}
                                          >
                                            <FaPlus />
                                          </button>
                                        </div>
                                        <div className={'join col-span-2 flex w-full md:col-span-1'}>
                                          <input
                                            type="number"
                                            name={`steps.${indexStep}.ingredients.${indexIngredient}.amount`}
                                            className={'input join-item input-bordered w-20 md:w-40'}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            value={values.steps[indexStep].ingredients[indexIngredient].amount}
                                          />
                                          <div className={'tooltip'}></div>
                                          <select
                                            name={`steps.${indexStep}.ingredients.${indexIngredient}.unitId`}
                                            className={`join-item select select-bordered w-full ${
                                              ((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.unit ? 'select-error' : ''
                                            }`}
                                            onChange={async (e) => {
                                              handleChange(e);
                                              await setFieldValue(
                                                `steps.${indexStep}.ingredients.${indexIngredient}.unit`,
                                                units.find((u) => u.id == e.target.value),
                                              );
                                            }}
                                            onBlur={handleBlur}
                                            value={values.steps[indexStep].ingredients[indexIngredient].unitId}
                                          >
                                            <option value={''} disabled>
                                              Auswählen
                                            </option>

                                            {values.steps[indexStep].ingredients[indexIngredient].unitId &&
                                            ingredients
                                              .find((ingredient) => ingredient.id == values.steps[indexStep].ingredients[indexIngredient]?.ingredientId)
                                              ?.IngredientVolume.find((unit) => unit.unitId == values.steps[indexStep].ingredients[indexIngredient].unitId) ==
                                              undefined ? (
                                              <option
                                                className="tooltip"
                                                data-tip="hello"
                                                value={values.steps[indexStep].ingredients[indexIngredient]?.unitId}
                                                disabled={true}
                                              >
                                                !!!
                                                {userContext.getTranslation(
                                                  units.find((unit) => unit.id == values.steps[indexStep].ingredients[indexIngredient]?.unitId)?.name ?? '',
                                                  'de',
                                                )}
                                                !!!
                                              </option>
                                            ) : (
                                              <></>
                                            )}
                                            {ingredients
                                              .find((ingredient) => ingredient.id == values.steps[indexStep].ingredients[indexIngredient]?.ingredientId)
                                              ?.IngredientVolume?.sort((a, b) =>
                                                userContext.getTranslation(a.unit.name, 'de').localeCompare(userContext.getTranslation(b.unit.name, 'de')),
                                              )
                                              ?.map((value) => (
                                                <option key={`steps.${indexStep}.ingredients.${indexIngredient}.units-${value.unitId}`} value={value.unitId}>
                                                  {userContext.getTranslation(value.unit.name, 'de')}
                                                </option>
                                              ))}
                                          </select>
                                          <button
                                            type={'button'}
                                            className={'btn btn-square btn-error join-item'}
                                            onClick={() =>
                                              modalContext.openModal(
                                                <DeleteConfirmationModal
                                                  spelling={'REMOVE'}
                                                  entityName={`die Zutat '${values.steps[indexStep].ingredients[indexIngredient].ingredient.name}'`}
                                                  onApprove={async () => removeIngredient(indexIngredient)}
                                                />,
                                              )
                                            }
                                          >
                                            <FaTrashAlt />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                <div className={'flex w-full justify-end'}>
                                  <button
                                    type={'button'}
                                    className={'btn btn-outline btn-secondary btn-sm space-x-2'}
                                    onClick={() =>
                                      pushIngredient({
                                        amount: 0,
                                        unitId: '',
                                        unit: undefined,
                                        ingredient: undefined,
                                        optional: false,
                                      })
                                    }
                                  >
                                    <FaPlus />
                                    <span>Zutat hinzufügen</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </FieldArray>
                        </div>
                      ))}
                      <div className={'flex justify-center'}>
                        <div
                          className={'btn btn-primary btn-sm space-x-2'}
                          onClick={() => {
                            const step = {
                              id: '',
                              cocktailRecipeId: '',
                              actionId: actions[0].id,
                              action: actions[0],
                              stepNumber: values.steps.length,
                              ingredients: [],
                              optional: false,
                            };
                            pushStep(step);
                          }}
                        >
                          <FaPlus /> <span>Schritt hinzufügen</span>
                        </div>
                      </div>
                    </div>
                  )}
                </FieldArray>
                <div className={'divider col-span-2'}>Garnitur</div>
                <FieldArray name={'garnishes'}>
                  {({ push: pushGarnish, remove: removeGarnish }) => (
                    <div className={'col-span-2 space-y-2'}>
                      {values.garnishes.map((garnish: CocktailRecipeGarnishFull, indexGarnish: number) => (
                        <div key={`form-recipe-garnish-${indexGarnish}`} className={'flex flex-row space-x-2 rounded-xl border border-neutral p-4'}>
                          <div className={'flex flex-none items-center'}>
                            <div className={'join join-vertical'}>
                              <button
                                type={'button'}
                                disabled={indexGarnish == 0}
                                className={'btn btn-square btn-outline join-item btn-xs'}
                                onClick={() => {
                                  const value = values.garnishes[indexGarnish];
                                  const reorderedGroups = (values.garnishes as CocktailRecipeGarnishFull[]).filter((_, i) => i != indexGarnish);
                                  reorderedGroups.splice(indexGarnish - 1, 0, value);
                                  setFieldValue(
                                    `garnishes`,
                                    reorderedGroups.map((garnish, garnishIndex) => ({
                                      ...garnish,
                                      garnishNumber: garnishIndex,
                                    })),
                                  );
                                }}
                              >
                                <FaAngleUp />
                              </button>
                              <button
                                type={'button'}
                                disabled={!(values.garnishes.length > 1) || indexGarnish == values.garnishes.length - 1}
                                className={'btn btn-square btn-outline join-item btn-xs'}
                                onClick={() => {
                                  const value = values.garnishes[indexGarnish];
                                  const reorderedGroups = (values.garnishes as CocktailRecipeGarnishFull[]).filter((_, i) => i != indexGarnish);
                                  reorderedGroups.splice(indexGarnish + 1, 0, value);
                                  setFieldValue(
                                    `garnishes`,
                                    reorderedGroups.map((garnishes, garnishIndex) => ({
                                      ...garnishes,
                                      garnishNumber: garnishIndex,
                                    })),
                                  );
                                }}
                              >
                                <FaAngleDown />
                              </button>
                            </div>
                          </div>
                          <div className={'flex-2 grid w-full grid-cols-1 gap-3 md:grid-cols-2'}>
                            <div className={''}>
                              <label className={'label'}>
                                <span className={'label-text'}>Garnitur</span>
                                <span className={'label-text-alt text-error'}>
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId &&
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId}
                                </span>
                              </label>
                              <div className={'join w-full'}>
                                <input
                                  className={`input join-item input-bordered w-full cursor-pointer ${
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId && 'input-error'
                                  }`}
                                  value={garnishesLoading ? 'Lade...' : (values.garnishes[indexGarnish].garnish?.name ?? 'Wähle eine Garnitur aus...')}
                                  readOnly={true}
                                  onClick={() => {
                                    openGarnishSelectModal(setFieldValue, indexGarnish);
                                  }}
                                />
                                <button
                                  type={'button'}
                                  className={'btn btn-outline btn-primary join-item'}
                                  onClick={() => {
                                    openGarnishSelectModal(setFieldValue, indexGarnish);
                                  }}
                                >
                                  <FaSearch />
                                </button>
                                <button
                                  type={'button'}
                                  className={'btn btn-outline btn-secondary join-item'}
                                  onClick={() => {
                                    modalContext.openModal(
                                      <FormModal<Garnish>
                                        form={
                                          <GarnishForm
                                            formRef={createRef<FormikProps<any>>()}
                                            onSaved={async (id) => {
                                              modalContext.closeAllModals();
                                              await setFieldValue(`garnishes.${indexGarnish}.garnishId`, id);
                                              fetchGarnishes(workspaceId, setGarnishes, setGarnishesLoading);
                                            }}
                                          />
                                        }
                                        title={'Garnitur erfassen'}
                                      />,
                                    );
                                  }}
                                >
                                  <FaPlus />
                                </button>
                              </div>
                            </div>
                            <div className={'row-span-2'}>
                              <label className={'label'}>
                                <span className={'label-text'}>Zusätzliche Beschreibung</span>
                                <span className={'label-text-alt text-error'}>{/*{errors.garnishDescription  && errors.garnishDescription}*/}</span>
                              </label>
                              <textarea
                                value={values.garnishes[indexGarnish].description}
                                name={`garnishes.${indexGarnish}.description`}
                                className={
                                  'textarea textarea-bordered h-24 w-full'
                                  // ${
                                  // errors.garnishDescription  && 'textarea-error'
                                  // }`
                                }
                                onChange={handleChange}
                                onBlur={handleBlur}
                              />
                            </div>
                            <div className={'form-control'}>
                              <label className={'label w-fit flex-col justify-start gap-1'}>
                                <span className={'label-text'}>Optional</span>
                                <span className={'label-text-alt text-error'}>
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.optional &&
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.optional}
                                </span>
                                <Field
                                  type={'checkbox'}
                                  name={`garnishes.${indexGarnish}.optional`}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  className={'toggle toggle-primary'}
                                />
                              </label>
                            </div>
                          </div>
                          <div className={'flex-1'}>
                            <div
                              className={'btn btn-square btn-error btn-sm'}
                              onClick={() =>
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    spelling={'REMOVE'}
                                    entityName={`die Garnitur '${values.garnishes[indexGarnish].garnish.name}'`}
                                    onApprove={async () => removeGarnish(indexGarnish)}
                                  />,
                                )
                              }
                            >
                              <FaTrashAlt />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className={'flex justify-center'}>
                        <div
                          className={'btn btn-primary btn-sm space-x-2'}
                          onClick={() => {
                            const cocktailRecipeGarnish = {
                              cocktailRecipeId: '',
                              garnishId: '',
                              garnish: undefined,
                              optional: false,
                              garnishNumber: values.garnishes.length - 1,
                              description: '',
                            };
                            pushGarnish(cocktailRecipeGarnish);
                          }}
                        >
                          <FaPlus /> <span>Garnitur hinzufügen</span>
                        </div>
                      </div>
                    </div>
                  )}
                </FieldArray>
              </div>
            </div>

            <div className={'md:hidden'}>
              <button type="submit" className={`btn btn-primary w-full`} disabled={isSubmitting}>
                {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
                {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
              </button>
              {!isValid && (
                <div className={'font-thin italic text-error'}>
                  Nicht alle Felder sind korrekt ausgefüllt. Kontrolliere daher alle Felder. (Name gesetzt, Bild zugeschnitten, ... ?)
                </div>
              )}
            </div>
          </div>
        </form>
      )}
    </Formik>
  );
}
