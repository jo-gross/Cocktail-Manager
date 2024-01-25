import { CocktailRecipeFull, CocktailRecipeFullSchema } from '../../models/CocktailRecipeFull';
import { IceType } from '../../models/IceType';
import { FaAngleDown, FaAngleUp, FaEuroSign, FaPlus, FaSearch, FaTrashAlt } from 'react-icons/fa';
import { TagsInput } from 'react-tag-input-component';
import { Field, FieldArray, Formik, FormikProps } from 'formik';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Garnish, Glass, Ingredient } from '@prisma/client';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { CocktailMixingTechnique } from '../../models/CocktailMixingTechnique';
import { CocktailPouringTechnique } from '../../models/CocktailPouringTechnique';
import { CocktailIngredientUnit } from '../../models/CocktailIngredientUnit';
import { CocktailRecipeStepFull } from '../../models/CocktailRecipeStepFull';
import CocktailRecipeOverviewItem from './CocktailRecipeOverviewItem';
import { alertService } from '../../lib/alertService';
import { CocktailRecipeGarnishFull } from '../../models/CocktailRecipeGarnishFull';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { SelectModal } from '../modals/SelectModal';
import FormModal from '../modals/FormModal';
import { GarnishForm } from '../garnishes/GarnishForm';
import { IngredientForm } from '../ingredients/IngredientForm';
import { GlassForm } from '../glasses/GlassForm';

interface CocktailRecipeFormProps {
  cocktailRecipe?: CocktailRecipeFull;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef: React.RefObject<FormikProps<any>>;
}

interface IngredientError {
  amount?: string;
  unit?: string;
  ingredientId?: string;
}

interface StepError {
  mixing?: string;
  tool?: string;
  ingredients?: IngredientError[];
}

interface GarnishError {
  garnishId?: string;
  optional?: string;
}

export function CocktailRecipeForm(props: CocktailRecipeFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const formRef = props.formRef;
  const [originalValues, setOriginalValues] = useState<any>();

  //Filling original values
  useEffect(() => {
    if (Object.keys(formRef?.current?.touched ?? {}).length == 0) {
      setOriginalValues(formRef?.current?.values);
    }
  }, [formRef, formRef?.current?.values]);

  const fetchIngredients = useCallback(async () => {
    if (!workspaceId) return;

    setIngredientsLoading(true);
    fetch(`/api/workspaces/${workspaceId}/ingredients`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setIngredients(body.data);
        } else {
          console.log('CocktailRecipeForm -> fetchIngredients', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => {
        setIngredientsLoading(false);
      });
  }, [workspaceId]);

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
              return ingredients.filter((ingredient) => ingredient.name.includes(search));
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

  const [glasses, setGlasses] = useState<Glass[]>([]);
  const [glassesLoading, setGlassesLoading] = useState(false);

  const fetchGlasses = useCallback(async () => {
    if (!workspaceId) return;
    setGlassesLoading(true);
    fetch(`/api/workspaces/${workspaceId}/glasses`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGlasses(body.data);
        } else {
          console.log('CocktailRecipeForm -> fetchGlasses', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => {
        setGlassesLoading(false);
      });
  }, [workspaceId]);

  const [garnishes, setGarnishes] = useState<Garnish[]>([]);
  const [garnishesLoading, setGarnishesLoading] = useState(false);

  const fetchGarnishes = useCallback(async () => {
    if (!workspaceId) return;
    setGarnishesLoading(true);
    fetch(`/api/workspaces/${workspaceId}/garnishes`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setGarnishes(body.data);
        } else {
          console.log('CocktailRecipeForm -> fetchGarnishes', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => {
        setGarnishesLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    fetchGarnishes();
    fetchIngredients();
    fetchGlasses();
  }, [fetchGarnishes, fetchGlasses, fetchIngredients]);

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
              return garnishes.filter((garnish) => garnish.name.includes(search));
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
  }, [glasses, props.cocktailRecipe?.glassId]);

  useEffect(() => {
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
  }, [garnishes, props.cocktailRecipe, props.cocktailRecipe?.garnishes]);

  useEffect(() => {
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
  }, [ingredients, props.cocktailRecipe?.steps]);

  const initSteps: CocktailRecipeStepFull[] = props.cocktailRecipe?.steps ?? [];

  const initValue: CocktailRecipeFullSchema = {
    id: props.cocktailRecipe?.id ?? '',
    name: props.cocktailRecipe?.name ?? '',
    description: props.cocktailRecipe?.description ?? '',
    price: props.cocktailRecipe?.price ?? 0,
    tags: props.cocktailRecipe?.tags ?? [],
    glassWithIce: props.cocktailRecipe?.glassWithIce ?? IceType.Without,
    image: props.cocktailRecipe?.image ?? null,
    glassId: props.cocktailRecipe?.glassId ?? null,
    glass: glasses.find((g) => g.id == props.cocktailRecipe?.glassId) ?? null,
    garnishes: props.cocktailRecipe?.garnishes ?? [],
    steps: initSteps,
    workspaceId: workspaceId!,
  };

  return (
    <Formik
      innerRef={formRef}
      initialValues={{
        ...initValue,
        showImage: false,
        showTags: false,
      }}
      validate={(values) => {
        props.setUnsavedChanges?.(originalValues && !_.isEqual(originalValues, formRef?.current?.values));
        const errors: any = {};
        if (!values.name || values.name.trim() == '') {
          errors.name = 'Required';
        }
        if (!values.price) {
          errors.price = 'Required';
        }
        if (!values.glassId || values.glassId == '') {
          errors.glassId = 'Required';
        }
        if (!values.glassWithIce || values.glass == '') {
          errors.glassWithIce = 'Required';
        }

        const stepsErrors: StepError[] = [];
        (values.steps as CocktailRecipeStepFull[]).map((step) => {
          const stepErrors: StepError = {};
          if (step.mixing == undefined) {
            stepErrors.mixing = 'Required';
          }
          if (!step.tool) {
            stepErrors.tool = 'Required';
          }

          const ingredientsErrors: IngredientError[] = [];

          if (step.mixing) {
            step.ingredients.map((ingredient) => {
              const ingredientErrors: IngredientError = {};
              if (ingredient.amount && isNaN(ingredient.amount)) {
                ingredientErrors.amount = 'Required';
              }
              if (!ingredient.unit || ingredient.unit == '') {
                ingredientErrors.unit = 'Required';
              }
              if (!ingredient.ingredientId || ingredient.ingredientId == '') {
                ingredientErrors.ingredientId = 'Required';
              }
              ingredientsErrors.push(ingredientErrors);
            });
            stepErrors.ingredients = ingredientsErrors;
          }
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

        console.log('Cocktail Form Errors: ', errors);
        return errors;
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.cocktailRecipe?.id,
            name: values.name,
            description: values.description.trim() === '' ? undefined : values.description,
            price: values.price,
            glassId: values.glassId,
            garnishId: values.garnishId,
            image: values.image == '' ? null : values.image,
            tags: values.tags,
            glassWithIce: values.glassWithIce,
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
              router.replace(`/workspaces/${workspaceId}/manage/cocktails`).then(() => alertService.success('Erfolgreich erstellt'));
            } else {
              const body = await response.json();
              console.log('CocktailRecipeForm -> createRecipe', response, body);
              alertService.error(body.message, response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailRecipe.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              router.replace(`/workspaces/${workspaceId}/manage/cocktails`).then(() => alertService.success('Erfolgreich gespeichert'));
            } else {
              const body = await response.json();
              console.log('CocktailRecipeForm -> updateRecipe', response, body);
              alertService.error(body.message, response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error(error);
        }
      }}
    >
      {({ values, setFieldValue, setFieldError, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <form onSubmit={handleSubmit}>
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-3'}>
            <div className={'card grid-cols-1 md:col-span-2'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold'}>Cocktail erfassen</div>
                <div className={'divider'}></div>
                <div className={'grid grid-cols-2 gap-4'}>
                  <div className={'col-span-2'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Name</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.name && touched.name && errors.name}</> *
                      </span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      className={`input input-bordered w-full ${errors.name && touched.name && 'input-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.name}
                    />
                  </div>
                  <div className={'col-span-2'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Beschreibung</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.description && touched.description && errors.description}</>
                      </span>
                    </label>
                    <textarea
                      name="description"
                      className={`textarea textarea-bordered w-full ${errors.description && touched.description && 'textarea-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.description}
                    />
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Preis</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.price && touched.price && errors.price}</> *
                      </span>
                    </label>
                    <div className={'join w-full'}>
                      <input
                        type="number"
                        className={`input join-item input-bordered w-full ${errors.price && touched.price && 'input-error'}`}
                        name="price"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.price ?? undefined}
                      />
                      <span className={'btn btn-secondary join-item'}>
                        <FaEuroSign />
                      </span>
                    </div>
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Tags</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.tags && touched.tags && errors.tags}</>
                      </span>
                    </label>
                    <TagsInput
                      value={values.tags}
                      onChange={(tags) =>
                        setFieldValue(
                          'tags',
                          updateTags(tags, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft')),
                        )
                      }
                      name="tags"
                      beforeAddValidate={(tag, _) => validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft'))}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label className={'label'}>
                      <span className={'label-text'}>Glas</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.glassId && touched.glassId && errors.glassId}</> *
                      </span>
                    </label>
                    <div className={'join w-full'}>
                      <select
                        name="glassId"
                        className={`join-item select select-bordered w-full ${errors.glassId && touched.glassId && 'select-error'}`}
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
                            {glasses.map((glass) => (
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
                                  onSaved={async () => {
                                    modalContext.closeModal();
                                    await fetchGlasses();
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
                    <label className={'label'}>
                      <span className={'label-text'}>Glas mit Eis</span>
                      <span className={'label-text-alt text-error'}>
                        <>{errors.glassWithIce && touched.glassWithIce && errors.glassWithIce}</>
                      </span>
                    </label>
                    <select
                      name="glassWithIce"
                      className={`select select-bordered w-full ${errors.glassWithIce && touched.glassWithIce && 'select-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.glassWithIce}
                    >
                      <option value={''}>Auswählen</option>
                      {Object.values(IceType).map((iceType) => (
                        <option key={`form-recipe-ice-types-${iceType}`} value={iceType}>
                          {iceType}
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
                    {values.image == undefined ? (
                      <UploadDropZone
                        onSelectedFilesChanged={async (file) => {
                          if (file != undefined) {
                            const compressedImageFile = await compressFile(file);
                            await setFieldValue('image', await convertToBase64(compressedImageFile));
                          } else {
                            alertService.error('Datei konnte nicht ausgewählt werden.');
                          }
                        }}
                      />
                    ) : (
                      <div className={'relative'}>
                        <div
                          className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2'}
                          onClick={() =>
                            modalContext.openModal(
                              <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={() => setFieldValue('image', undefined)} />,
                            )
                          }
                        >
                          <FaTrashAlt />
                        </div>
                        <img className={'h-32 rounded-lg'} src={values.image} alt={'Cocktail Image'} />
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
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Zeige Bilder</span>
                      <span className={'label-text-alt text-error'}></span>
                      <input
                        type={'checkbox'}
                        className={'toggle toggle-primary'}
                        name={'showImage'}
                        onChange={handleChange}
                        defaultChecked={false}
                        checked={values.showImage}
                        onBlur={handleBlur}
                      />
                    </label>
                  </div>
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Zeige Tags</span>
                      <span className={'label-text-alt text-error'}></span>
                      <input
                        type={'checkbox'}
                        className={'toggle toggle-primary'}
                        name={'showTags'}
                        onChange={handleChange}
                        defaultChecked={false}
                        checked={values.showTags}
                        onBlur={handleBlur}
                      />
                    </label>
                  </div>
                  <CocktailRecipeOverviewItem
                    cocktailRecipe={{
                      id: values.id,
                      image: values.image ?? null,
                      name: values.name,
                      description: values.description,
                      tags: values.tags,
                      price: values.price,
                      glassWithIce: values.glassWithIce,
                      glassId: values.glassID ?? null,
                      glass: glasses.find((glass) => glass.id === values.glassId) ?? null,
                      // garnishId: values.garnishId ?? null,
                      // garnish: garnishes.find((garnish) => garnish.id === values.garnishId) ?? null,
                      garnishes: values.garnishes,
                      //@ts-ignore
                      steps: values.steps,
                      workspaceId: workspaceId!,
                    }}
                    showInfo={true}
                    showTags={values.showTags}
                    showImage={values.showImage}
                  />
                </div>
              </div>
              <div className={'hidden md:flex'}>
                <button type="submit" className={`btn btn-primary w-full ${isSubmitting ?? 'loading'}`}>
                  {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
                </button>
              </div>

              <div className={'card'}>
                <div className={'card-body'}>
                  <div className={'text-center text-2xl font-bold'}>Finanzen</div>
                  <div className={'divider'}></div>
                  <div className={'grid grid-cols-2 gap-1'}>
                    <>
                      {(values.steps as CocktailRecipeStepFull[]).filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined))
                        .length > 0 ? (
                        (values.steps as CocktailRecipeStepFull[])
                          .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
                          .flat()
                          ?.map((ingredient, indexIngredient) => (
                            <>
                              <div key={`price-calculation-step-${indexIngredient}-name`}>
                                {ingredient.ingredient?.shortName ?? ingredient.ingredient?.name}
                              </div>
                              <div key={`price-calculation-step-${indexIngredient}-price`} className={'grid grid-cols-2'}>
                                <div>
                                  {ingredient.amount} x {((ingredient.ingredient?.price ?? 0) / (ingredient.ingredient?.volume ?? 1)).toFixed(2)}
                                </div>
                                <div className={'text-end'}>
                                  {indexIngredient > 0 ? '+ ' : ''}
                                  {(((ingredient.ingredient?.price ?? 0) / (ingredient.ingredient?.volume ?? 1)) * (ingredient.amount ?? 0)).toFixed(2)}€
                                </div>
                              </div>
                            </>
                          ))
                      ) : (
                        <></>
                      )}
                      {values.garnish != null ? (
                        <>
                          <div key={`price-calculation-step-garnish-name`}>Garnitur: {values.garnish.name}</div>
                          <div key={`price-calculation-step-garnish-price`} className={'grid grid-cols-2'}>
                            <div>1 x {values.garnish.price.toFixed(2)}</div>
                            <div className={'text-end'}>
                              {(values.steps as CocktailRecipeStepFull[]).some((step) => step.ingredients.length > 0) ? '+ ' : ''}
                              {(values.garnish?.price ?? 0).toFixed(2)}€
                            </div>
                          </div>
                        </>
                      ) : (
                        <></>
                      )}
                    </>
                    <div className={'col-span-2 border-b border-base-200'}></div>
                    <div>Summe</div>
                    <div className={'grid grid-cols-3'}>
                      <div></div>
                      <div></div>
                      <div className={'text-end font-bold'}>
                        {(values.steps as CocktailRecipeStepFull[]).filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined))
                          .length > 0
                          ? (
                              (values.steps as CocktailRecipeStepFull[])
                                .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
                                .flat()
                                .map((ingredient) => ((ingredient.ingredient?.price ?? 0) / (ingredient.ingredient?.volume ?? 1)) * (ingredient.amount ?? 0))
                                .reduce((summ, sum) => summ + sum) + (values.garnish?.price ?? 0)
                            ).toFixed(2) + ' €'
                          : '0.00 €'}
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
                          key={`form-recipe-step-${step.id}`}
                          className={'flex w-full flex-col justify-between space-y-2 rounded-xl border border-neutral p-4'}
                        >
                          <div className={'grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 '}>
                            <div className={'font-bold'}>Schritt {indexStep + 1}</div>
                            <div className={'form-control order-3 col-span-2 md:order-2 md:col-span-1'}>
                              <label className={'label'}>
                                <span className={'label-text'}>Andere</span>
                                <input
                                  type="checkbox"
                                  checked={values.steps[indexStep].mixing}
                                  onChange={(e) => {
                                    handleChange(e);
                                    if (values.steps[indexStep].mixing) {
                                      setFieldValue(`steps.${indexStep}.tool`, 'SINGLE_STRAIN');
                                    } else {
                                      setFieldValue(`steps.${indexStep}.tool`, 'SHAKE');
                                    }
                                  }}
                                  onBlur={handleBlur}
                                  className={'toggle toggle-primary'}
                                  name={`steps.${indexStep}.mixing`}
                                />
                                <span className={'label-text'}>Mixen</span>
                              </label>
                            </div>
                            <div className={'space-x-2 justify-self-end'}>
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
                                    <DeleteConfirmationModal spelling={'REMOVE'} entityName={'den Schritt'} onApprove={() => removeStep(indexStep)} />,
                                  )
                                }
                              >
                                <FaTrashAlt />
                              </button>
                            </div>
                          </div>
                          {step.mixing ? (
                            <>
                              <div className={'flex w-full flex-row items-center justify-center space-x-2'}>
                                {Object.entries(CocktailMixingTechnique).map(([key, value]) => (
                                  <div key={`form-recipe-step-${step.id}-tool-${key}`} className={'flex flex-col items-center justify-end space-y-2'}>
                                    {/*<img className={"h-20"}*/}
                                    {/*     src={"https://res.cloudinary.com/lusini/w_1500,h_1500,q_80,c_pad,f_auto/pim/7f30f8/bf7939/ff5def/23f663/419537/65/7f30f8bf7939ff5def23f66341953765.jpeg"} />*/}
                                    <div>{value}</div>
                                    <Field type="radio" name={`steps.${indexStep}.tool`} value={key} className={'radio-primary radio'} onBlur={handleBlur} />
                                  </div>
                                ))}
                              </div>
                              <FieldArray name={`steps.${indexStep}.ingredients`}>
                                {({ push: pushIngredient, remove: removeIngredient }) => (
                                  <>
                                    {step.ingredients
                                      .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                                      .map((ingredient, indexIngredient) => (
                                        <div key={`form-recipe-step-${step.id}-ingredient-${ingredient.id}`} className={'flex flex-row space-x-2'}>
                                          <div className={'join join-vertical w-min'}>
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
                                          <div key={`form-recipe-step${step.id}-ingredient-${ingredient.id}`} className={'join flex w-full flex-row'}>
                                            <input
                                              className={`input join-item input-bordered w-full cursor-pointer 
                                                ${
                                                  ((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.ingredientId &&
                                                  ' input-error'
                                                }`}
                                              value={
                                                ingredientsLoading
                                                  ? 'Lade...'
                                                  : values.steps[indexStep].ingredients?.[indexIngredient].ingredient?.name ?? 'Wähle eine Zutat aus...'
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
                                                        onSaved={async () => {
                                                          modalContext.closeModal();
                                                          await fetchIngredients();
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
                                          <div className={'join'}>
                                            <input
                                              type="number"
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.amount`}
                                              className={'input join-item input-bordered w-20 flex-auto md:w-40'}
                                              onChange={handleChange}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].amount}
                                            />
                                            <select
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.unit`}
                                              className={`join-item select select-bordered max-w-[20%] md:max-w-none ${
                                                ((errors.steps as StepError[])?.[indexStep] as any)?.ingredients?.[indexIngredient]?.unit ? 'select-error' : ''
                                              }`}
                                              onChange={handleChange}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].unit}
                                            >
                                              <option value={''}>Auswählen</option>
                                              {Object.values(CocktailIngredientUnit).map((value) => (
                                                <option key={`steps.${indexStep}.ingredients.${indexIngredient}.units-${value}`} value={value}>
                                                  {value}
                                                </option>
                                              ))}
                                            </select>
                                            {values.steps[indexStep].ingredients.length != 1 ? (
                                              <button
                                                type={'button'}
                                                className={'btn btn-square btn-error join-item w-8'}
                                                disabled={values.steps[indexStep].ingredients.length == 1}
                                                onClick={() =>
                                                  modalContext.openModal(
                                                    <DeleteConfirmationModal
                                                      spelling={'REMOVE'}
                                                      entityName={'die Zutat'}
                                                      onApprove={() => removeIngredient(indexIngredient)}
                                                    />,
                                                  )
                                                }
                                              >
                                                <FaTrashAlt />
                                              </button>
                                            ) : (
                                              <></>
                                            )}
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
                                            unit: CocktailIngredientUnit.CL,
                                            ingredient: undefined,
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
                            </>
                          ) : (
                            <div className={'flex flex-row items-center justify-center space-x-2'}>
                              {Object.entries(CocktailPouringTechnique).map(([key, value]) => (
                                <div key={`form-recipe-step${step.id}-no-mixing-${key}`} className={'flex flex-col items-center justify-center space-y-2'}>
                                  {/*<img className={"h-20"}*/}
                                  {/*     src={"https://res.cloudinary.com/lusini/w_1500,h_1500,q_80,c_pad,f_auto/pim/7f30f8/bf7939/ff5def/23f663/419537/65/7f30f8bf7939ff5def23f66341953765.jpeg"} />*/}
                                  <div>{value}</div>
                                  <Field type="radio" name={`steps.${indexStep}.tool`} value={key} className="radio-primary radio" onBlur={handleBlur} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div className={'flex justify-center'}>
                        <div
                          className={'btn btn-primary btn-sm space-x-2'}
                          onClick={() => {
                            const step: CocktailRecipeStepFull = {
                              id: '',
                              cocktailRecipeId: '',
                              tool: 'SHAKE',
                              mixing: true,
                              stepNumber: values.steps.length,
                              ingredients: [
                                {
                                  id: '',
                                  amount: 0,
                                  ingredientId: '',
                                  cocktailRecipeStepId: '',
                                  unit: CocktailIngredientUnit.CL,
                                  ingredient: null,
                                  ingredientNumber: 0,
                                },
                              ],
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
                          <div className={'flex-2 grid w-full grid-cols-1 md:grid-cols-2'}>
                            <div className={''}>
                              <label className={'label'}>
                                <span className={'label-text'}>Garnitur</span>
                                <span className={'label-text-alt text-error'}>
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId &&
                                    (touched.garnishes as any)?.[indexGarnish]?.garnishId &&
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId}
                                </span>
                              </label>
                              <div className={'join w-full'}>
                                <input
                                  className={`input join-item input-bordered w-full cursor-pointer ${
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId &&
                                    (touched.garnishes as any)?.[indexGarnish]?.garnishId &&
                                    'input-error'
                                  }`}
                                  value={garnishesLoading ? 'Lade...' : values.garnishes[indexGarnish].garnish?.name ?? 'Wähle eine Garnitur aus...'}
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
                                            onSaved={async () => {
                                              modalContext.closeModal();
                                              await fetchGarnishes();
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
                            <div className={'form-control'}>
                              <label className={'label'}>
                                <span className={'label-text'}>Optional</span>
                                <span className={'label-text-alt text-error'}>
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.optional &&
                                    (touched.garnishes as any)?.[indexGarnish]?.optional &&
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
                            <div className={''}>
                              <label className={'label'}>
                                <span className={'label-text'}>Zusätzliche Beschreibung</span>
                                <span className={'label-text-alt text-error'}>
                                  {/*{errors.garnishDescription && touched.garnishDescription && errors.garnishDescription}*/}
                                </span>
                              </label>
                              <textarea
                                value={values.garnishes[indexGarnish].description}
                                name={`garnishes.${indexGarnish}.description`}
                                className={
                                  'textarea textarea-bordered h-24 w-full'
                                  // ${
                                  // errors.garnishDescription && touched.garnishDescription && 'textarea-error'
                                  // }`
                                }
                                onChange={handleChange}
                                onBlur={handleBlur}
                              />
                            </div>
                          </div>
                          <div className={'flex-1'}>
                            <div
                              className={'btn btn-square btn-error btn-sm'}
                              onClick={() =>
                                modalContext.openModal(
                                  <DeleteConfirmationModal spelling={'REMOVE'} entityName={'die Garnitur'} onApprove={() => removeGarnish(indexGarnish)} />,
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
                            const cocktailRecipeGarnish: CocktailRecipeGarnishFull = {
                              cocktailRecipeId: '',
                              garnishId: '',
                              garnish: garnishes[0],
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
              <button type="submit" className={`btn btn-primary w-full ${isSubmitting ?? 'loading'}`}>
                {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Formik>
  );
}
