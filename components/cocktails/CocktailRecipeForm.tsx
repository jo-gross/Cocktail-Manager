import { FaAngleDown, FaAngleUp, FaEuroSign, FaPlus, FaSearch, FaTrashAlt } from 'react-icons/fa';
import { Field, FieldArray, Formik, FormikProps } from 'formik';
import React, { createRef, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipe, Garnish, Glass, Ice, Ingredient, Unit, WorkspaceCocktailRecipeStepAction } from '@generated/prisma/client';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '@lib/Base64Converter';
import { CocktailRecipeStepFull } from '../../models/CocktailRecipeStepFull';
import CocktailRecipeCardItem from './CocktailRecipeCardItem';
import { alertService } from '@lib/alertService';
import { CocktailRecipeGarnishFull } from '../../models/CocktailRecipeGarnishFull';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _, { orderBy } from 'lodash';
import { resizeImage } from '@lib/ImageCompressor';
import { SelectModal } from '../modals/SelectModal';
import FormModal from '../modals/FormModal';
import { GarnishForm, GarnishFormValues } from '../garnishes/GarnishForm';
import { IngredientForm, FormValue as IngredientFormValues } from '../ingredients/IngredientForm';
import { GlassForm } from '../glasses/GlassForm';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailRecipeFullWithImage } from '../../models/CocktailRecipeFullWithImage';
import { UserContext } from '@lib/context/UserContextProvider';
import { GlassModel } from '../../models/GlassModel';
import { IngredientModel } from '../../models/IngredientModel';
import { fetchGlasses } from '@lib/network/glasses';
import { fetchGarnishes } from '@lib/network/garnishes';
import { fetchIngredients } from '@lib/network/ingredients';
import { fetchActions } from '@lib/network/actions';
import { fetchUnits } from '@lib/network/units';
import { calcCocktailTotalPrice } from '@lib/CocktailRecipeCalculation';
import Image from 'next/image';
import { fetchIce } from '@lib/network/ices';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { TagInput } from '../TagInput';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import DeepDiff from 'deep-diff';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import '../../lib/NumberUtils';
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  cn,
  Divider,
  FormControl,
  Input,
  Label,
  LabelText,
  LabelTextAlt,
  Loading,
  Select,
  stackGap,
  Textarea,
  Toggle,
  Tooltip,
} from '@components/ui';

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

export interface CocktailRecipeFormValues {
  id: string;
  name: string;
  description: string;
  notes: string;
  history: string;
  price: number | undefined | string;
  tags: string[];
  iceId: string | null;
  image: string | undefined;
  originalImage: File | undefined;
  glassId: string | undefined;
  ice: Ice | null;
  glass: GlassModel | null;
  garnishes: CocktailRecipeGarnishFull[];
  steps: CocktailRecipeStepFull[];
  workspaceId: string;
  isArchived: boolean;
}

interface CocktailRecipeFormProps {
  cocktailRecipe?: CocktailRecipeFullWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef: React.RefObject<FormikProps<CocktailRecipeFormValues> | null>;
}

interface IngredientError {
  amount?: string;
  unit?: string;
  ingredientId?: string;
  optional?: string;
}

interface StepError {
  action?: string;
  ingredients?: IngredientError[];
}

interface GarnishError {
  garnishId?: string;
  optional?: string;
  isAlternative?: string;
}

interface CocktailRecipeFormErrors {
  name?: string;
  glassId?: string;
  iceId?: string;
  image?: string;
  tags?: string;
  steps?: StepError[];
  garnishes?: GarnishError[];
}

export function CocktailRecipeForm(props: CocktailRecipeFormProps) {
  const formRef = props.formRef;

  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);

  const [iceOptions, setIceOptions] = useState<Ice[]>([]);
  const [_iceOptionsLoading, setIceOptionsLoading] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const [glasses, setGlasses] = useState<GlassModel[]>([]);
  const [glassesLoading, setGlassesLoading] = useState(false);

  const [garnishes, setGarnishes] = useState<Garnish[]>([]);
  const [garnishesLoading, setGarnishesLoading] = useState(false);

  const [actions, setActions] = useState<WorkspaceCocktailRecipeStepAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [_unitsLoading, setUnitsLoading] = useState(false);

  const [similarCocktailRecipe, setSimilarCocktailRecipe] = useState<CocktailRecipe | undefined>(undefined);

  const openIngredientSelectModal = useCallback(
    (setFieldValue: FormikProps<CocktailRecipeFormValues>['setFieldValue'], indexStep: number, indexIngredient: number) => {
      modalContext.openModal(
        <SelectModal<IngredientModel>
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

            if (ingredient.IngredientVolume.length > 0) {
              const clUnit = units.find((unit) => unit.name.toLocaleLowerCase() == 'cl');
              let unitClOrFirst = ingredient.IngredientVolume.find((ingredientUnit) => ingredientUnit.unitId == clUnit?.id)?.unit;
              if (unitClOrFirst == undefined) {
                unitClOrFirst = ingredient.IngredientVolume[0].unit;
              }
              if (unitClOrFirst) {
                await setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.unit`, unitClOrFirst);
                await setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.unitId`, unitClOrFirst.id);
              }
            }
          }}
        />,
      );
    },
    [ingredients, modalContext],
  );

  const openGarnishSelectModal = useCallback(
    (setFieldValue: FormikProps<CocktailRecipeFormValues>['setFieldValue'], indexGarnish: number) => {
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
        formRef.current?.values.garnishes.map((garnish: CocktailRecipeGarnishFull) => {
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
        formRef.current?.values.steps.map((step: CocktailRecipeStepFull) => {
          return {
            ...step,
            ingredients: step.ingredients.map((ingredient: CocktailRecipeStepFull['ingredients'][number]) => {
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

  const inheritTagsFromIngredients = useCallback((steps: CocktailRecipeStepFull[], tags: string[]) => {
    return (steps as CocktailRecipeStepFull[])
      .flatMap((step) => step.ingredients.map((stepIngredient) => stepIngredient.ingredient))
      .flatMap((ingredient) => ingredient?.tags ?? [])
      .filter((tag) => tag != undefined && tag.trim() != '' && !tags.includes(tag))
      .filterUnique();
  }, []);

  return (
    <Formik
      innerRef={formRef}
      initialValues={initValue}
      validate={(values) => {
        const errors: CocktailRecipeFormErrors = {};

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
            (values.steps as CocktailRecipeStepFull[]).forEach((step) => {
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
        if (!values.iceId || values.iceId === '') {
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
          <div className={cn('grid grid-cols-1 md:grid-cols-3', stackGap)}>
            <Card variant="surface" className="grid-cols-1 md:col-span-2">
              <CardBody>
                <div className={'text-center text-2xl font-bold'}>Cocktail erfassen</div>
                <Divider />
                <div className={'grid grid-cols-2 gap-4'}>
                  <div className={'col-span-2'}>
                    <Label htmlFor={'name'} className="flex-row items-center justify-between">
                      <LabelText>Name</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.name && errors.name}</> *
                      </LabelTextAlt>
                    </Label>
                    <Input
                      type="text"
                      name="name"
                      autoComplete={'off'}
                      id={'name'}
                      className={errors.name ? fieldErrorClass : undefined}
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
                      <Label className="flex-row">
                        <LabelTextAlt className="text-warning">
                          Eine ähnlicher Cocktail mit dem Namen <strong>{similarCocktailRecipe.name}</strong> existiert bereits.
                        </LabelTextAlt>
                      </Label>
                    )}
                  </div>
                  <div className={'col-span-2'}>
                    <Label htmlFor={'notes'} className="flex-row items-center justify-between">
                      <LabelText>Zubereitungsnotizen</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.notes && errors.notes}</>
                      </LabelTextAlt>
                    </Label>
                    <Textarea
                      id={'notes'}
                      name="notes"
                      className={errors.notes ? fieldErrorClass : undefined}
                      placeholder={'Zubereitungshinweise, Tipps, etc.'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.notes}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2'}>
                    <Label htmlFor={'description'} className="flex-row items-center justify-between">
                      <LabelText>Allgemeine Beschreibung</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.description && errors.description}</>
                      </LabelTextAlt>
                    </Label>
                    <Textarea
                      id={'description'}
                      name="description"
                      className={errors.description ? fieldErrorClass : undefined}
                      placeholder={'Was zeichnet diesen Cocktail aus? Wie schmeckt er? Was macht ihn besonders? Was sollte man wissen?'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.description}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2'}>
                    <Label htmlFor={'history'} className="flex-row items-center justify-between">
                      <LabelText>Geschichte und Entstehung</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.history && errors.history}</>
                      </LabelTextAlt>
                    </Label>
                    <Textarea
                      id={'history'}
                      name="history"
                      className={errors.history ? fieldErrorClass : undefined}
                      placeholder={'Geschichte, Herkunft, etc.'}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.history}
                      rows={5}
                    />
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <Label htmlFor={'price'} className="flex-row items-center justify-between">
                      <LabelText>Preis</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.price && errors.price}</>
                      </LabelTextAlt>
                    </Label>
                    <ButtonGroup className="w-full">
                      <Input
                        id={'price'}
                        type="number"
                        className={errors.price ? fieldErrorClass : undefined}
                        joinItem
                        name="price"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.price}
                      />
                      <Button type="button" variant="secondary" joinItem>
                        <FaEuroSign />
                      </Button>
                    </ButtonGroup>
                  </div>
                  <div className={'col-span-2 md:col-span-1'}>
                    <Label className="flex-row items-center justify-between">
                      <LabelText>Tags</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.tags && errors.tags}</>
                      </LabelTextAlt>
                    </Label>
                    <div id={'tags'}>
                      <TagInput
                        value={values.tags}
                        onChange={(tags: string[]) =>
                          setFieldValue(
                            'tags',
                            updateTags(tags, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft!')),
                          )
                        }
                        validate={(tag) => validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft!!!'))}
                      />
                      {inheritTagsFromIngredients(values.steps, values.tags).length > 0 && (
                        <>
                          <Tooltip tip="Basierend auf den Tags der Zutaten">
                            <Label className="flex-row">
                              <LabelText>Tags aus Zutaten</LabelText>
                            </Label>
                          </Tooltip>
                          <div className={'flex flex-row flex-wrap gap-2'}>
                            {inheritTagsFromIngredients(values.steps, values.tags).map((tag) => {
                              return (
                                <Badge key={`tag-suggestion-${tag}`} outline className="gap-1">
                                  {tag}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    shape="square"
                                    size="xs"
                                    className="h-4 min-h-4 w-4"
                                    onClick={() => {
                                      setFieldValue('tags', [...values.tags, tag]);
                                    }}
                                  >
                                    <FaPlus />
                                  </Button>
                                </Badge>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={'glassId'} className="flex-row items-center justify-between">
                      <LabelText>Glas</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.glassId && errors.glassId}</> *
                      </LabelTextAlt>
                    </Label>
                    <ButtonGroup className="w-full">
                      <Select
                        id={'glassId'}
                        name="glassId"
                        className={errors.glassId ? fieldErrorClass : undefined}
                        joinItem
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
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        shape="square"
                        joinItem
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
                      </Button>
                    </ButtonGroup>
                  </div>
                  <div>
                    <Label htmlFor={'iceId'} className="flex-row items-center justify-between">
                      <LabelText>Eis</LabelText>
                      <LabelTextAlt className="text-error">
                        <>{errors.iceId && errors.iceId}</> *
                      </LabelTextAlt>
                    </Label>
                    <Select
                      id={'iceId'}
                      name="iceId"
                      className={errors.iceId ? fieldErrorClass : undefined}
                      onChange={(event) => {
                        handleChange(event);
                        setFieldValue(
                          'ice',
                          iceOptions.find((ice) => ice.id == event.target.value),
                        );
                      }}
                      onBlur={handleBlur}
                      value={values.iceId ?? ''}
                    >
                      <option value={''}>Auswählen</option>
                      {Object.values(iceOptions)
                        .sort((a, b) => userContext.getTranslation(a.name, 'de').localeCompare(userContext.getTranslation(b.name, 'de')))
                        .map((iceType) => (
                          <option key={`form-recipe-ice-types-${iceType.id}`} value={iceType.id}>
                            {userContext.getTranslation(iceType.name, 'de')}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-3 py-2">
                    <Divider className="my-0 flex-1" />
                    <span className="shrink-0 text-sm font-medium text-base-content/70">Darstellung</span>
                    <Divider className="my-0 flex-1" />
                  </div>
                  <div className={'col-span-2'}>
                    {values.image != undefined ? (
                      <Label className="flex-row items-center justify-between">
                        <LabelText>Vorschau Bild</LabelText>
                      </Label>
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
                        <div className={'absolute top-2 right-2 flex flex-row gap-2'}>
                          <Button
                            type="button"
                            variant="outline"
                            shape="square"
                            size="sm"
                            onClick={async () => {
                              await setFieldValue('image', undefined);
                            }}
                          >
                            <FaCropSimple />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            shape="square"
                            size="sm"
                            className="border-error text-error hover:bg-error/10"
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
                          </Button>
                        </div>
                        <div className={'bg-transparent-pattern relative h-32 w-[4.5rem] rounded-lg'}>
                          <Image className={'w-fit rounded-lg'} src={values.image ?? ''} layout={'fill'} objectFit={'contain'} alt={'Cocktail image'} />
                        </div>
                        <div className={'pt-2 font-thin italic'}>
                          Info: Durch Speichern des Cocktails wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. Falls du später einen
                          anderen Bereich des Bildes auswählen möchtest, musst du das Bild erneut hochladen.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
            <div className={cn('flex flex-col', stackGap)}>
              <Card variant="surface">
                <CardBody>
                  <div className={'text-center text-2xl font-bold'}>Vorschau</div>
                  <Divider />

                  <CocktailRecipeCardItem
                    image={values.image}
                    cocktailRecipe={
                      {
                        _count: { CocktailRecipeImage: values.image != undefined ? 1 : 0 },
                        id: values.id,
                        name: values.name,
                        description: values.description.trim() == '' ? null : values.description.trim(),
                        notes: values.notes.trim() == '' ? null : values.notes.trim(),
                        history: values.history.trim() == '' ? null : values.history.trim(),
                        tags: values.tags,
                        price: !values.price && values.price == '' ? null : (values.price as number | null),
                        iceId: values.iceId,
                        ice: iceOptions.find((ice) => ice.id === values.iceId) ?? null,
                        glassId: values.glassId ?? null,
                        isArchived: false,
                        glass: glasses.find((glass) => glass.id === values.glassId) ?? null,
                        garnishes: values.garnishes,
                        steps: values.steps,
                        workspaceId: workspaceId!,
                        ratings: [],
                      } as unknown as CocktailRecipeFull
                    }
                    showInfo={false}
                    showTags={true}
                    showImage={true}
                    showDescription={true}
                    showNotes={true}
                    showHistory={true}
                  />
                </CardBody>
              </Card>
              <div className={'hidden md:flex md:flex-col'}>
                <Button type="submit" variant="primary" wide disabled={isSubmitting || !isValid}>
                  {isSubmitting ? <Loading size="sm" /> : <></>}
                  {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
                </Button>
                {!isValid && (
                  <div className={'font-thin text-error italic'}>
                    Nicht alle Felder sind korrekt ausgefüllt. Kontrolliere daher alle Felder. (Name gesetzt, Bild zugeschnitten, ... ?)
                  </div>
                )}
              </div>

              <Card variant="surface">
                <CardBody>
                  <div className={'text-center text-2xl font-bold'}>Finanzen</div>
                  <Divider />
                  <div className={'grid grid-cols-2 gap-1'}>
                    <>
                      <Divider size="sm" className="col-span-2">
                        Zutaten
                      </Divider>
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
                                        ).formatPrice()}{' '}
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
                                        ).formatPrice()}
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

                      <Divider size="sm" className="col-span-2">
                        Garnituren
                      </Divider>
                      {(values.garnishes as CocktailRecipeGarnishFull[]).length > 0 ? (
                        <></>
                      ) : (
                        <div className={'col-span-2 text-center font-thin italic'}>Keine Garnituren</div>
                      )}
                      {(values.garnishes as CocktailRecipeGarnishFull[]).map((garnish) => {
                        const isAlternative = (garnish as CocktailRecipeGarnishFull & { isAlternative?: boolean }).isAlternative;
                        return (
                          <React.Fragment key={`price-calculation-step-garnish-${garnish.garnishId}`}>
                            <div className={`${isAlternative ? 'line-through opacity-50' : ''}`}>{garnish?.garnish?.name}</div>
                            <div className={`grid grid-cols-2 ${isAlternative ? 'line-through opacity-50' : ''}`}>
                              <div>1 x {(garnish?.garnish?.price ?? 0).formatPrice()}</div>
                              <div className={'text-end'}>
                                {(values.steps as CocktailRecipeStepFull[]).some((step) => step.ingredients.length > 0) ? '+ ' : ''}
                                {(garnish?.garnish?.price ?? 0).formatPrice()}€
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {(values.garnishes as CocktailRecipeGarnishFull[]).some(
                        (g) => (g as CocktailRecipeGarnishFull & { isAlternative?: boolean }).isAlternative,
                      ) && (
                        <div className={'col-span-2 mt-1 text-xs font-thin italic'}>* Alternative Garnituren werden nicht in die Berechnung einbezogen.</div>
                      )}
                    </>
                    <Divider size="sm" className="col-span-2"></Divider>
                    <div>Summe</div>
                    <div className={'grid grid-cols-3'}>
                      <div></div>
                      <div></div>
                      <div className={'text-end font-bold'}>
                        {calcCocktailTotalPrice(values as unknown as CocktailRecipeFull, ingredients).formatPrice() + ' €'}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card variant="surface" className="col-span-full">
              <CardBody>
                <div className={'text-center text-2xl font-bold'}>Zubereitung</div>

                <FieldArray name={'steps'}>
                  {({ push: pushStep, remove: removeStep }) => (
                    <div className={'col-span-2 space-y-4'}>
                      {(values.steps as CocktailRecipeStepFull[]).map((step, indexStep) => (
                        <Card key={`form-recipe-step-${indexStep}`} variant="inset" className={'flex w-full flex-col justify-between p-4'}>
                          <div className={'grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4'}>
                            <div className={'col-span-2 flex flex-row items-center justify-between gap-2 md:col-span-1 md:justify-start'}>
                              <div className={'font-bold'}>Schritt {indexStep + 1}</div>
                              <FormControl>
                                <Label className="w-fit flex-row items-center justify-start gap-1">
                                  <LabelText>Optional</LabelText>
                                  <Field
                                    type={'checkbox'}
                                    name={`steps.${indexStep}.optional`}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    as={Toggle}
                                    variant="primary"
                                  />
                                </Label>
                              </FormControl>
                            </div>
                            <FormControl>
                              <Select
                                name={`steps.${indexStep}.actionId`}
                                value={values.steps[indexStep].actionId}
                                selectSize="sm"
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
                              </Select>
                            </FormControl>
                            <div className={'space-x-2 justify-self-end'}>
                              <Button
                                disabled={indexStep == 0}
                                type="button"
                                variant="outline"
                                shape="square"
                                size="sm"
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
                              </Button>
                              <Button
                                disabled={!(values.steps.length > 1) || indexStep == values.steps.length - 1}
                                type="button"
                                variant="outline"
                                shape="square"
                                size="sm"
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
                              </Button>
                              <Button
                                type="button"
                                variant="error"
                                shape="square"
                                size="sm"
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
                              </Button>
                            </div>
                          </div>
                          <Divider className="col-span-full font-thin">Zutaten</Divider>
                          <FieldArray name={`steps.${indexStep}.ingredients`}>
                            {({ push: pushIngredient, remove: removeIngredient }) => (
                              <>
                                {step.ingredients
                                  .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                                  .map((ingredient, indexIngredient) => (
                                    <>
                                      {indexIngredient > 0 && <Divider size="sm" className="col-span-full" />}
                                      <div key={`form-recipe-step-${indexStep}-ingredient-${indexIngredient}`} className="flex flex-row items-center gap-3">
                                        <ButtonGroup vertical className="w-min items-center justify-center">
                                          <Button
                                            disabled={indexIngredient == 0}
                                            type="button"
                                            variant="outline"
                                            shape="square"
                                            size="xs"
                                            joinItem
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
                                          </Button>
                                          <Button
                                            disabled={
                                              !(values.steps[indexStep].ingredients.length > 1) ||
                                              indexIngredient == values.steps[indexStep].ingredients.length - 1
                                            }
                                            type="button"
                                            variant="outline"
                                            shape="square"
                                            size="xs"
                                            joinItem
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
                                          </Button>
                                        </ButtonGroup>
                                        <div className={'grid w-full grid-cols-2 gap-1 md:grid-cols-4'}>
                                          <FormControl className="col-span-2 md:col-span-1">
                                            <Label className="w-fit flex-row items-center justify-start gap-1 md:flex-col">
                                              <LabelText>Optional</LabelText>
                                              <LabelTextAlt className="text-error">
                                                {(errors.steps as StepError[])?.[indexStep]?.ingredients?.[indexIngredient]?.optional &&
                                                  (errors.steps as StepError[])?.[indexStep]?.ingredients?.[indexIngredient]?.optional}
                                              </LabelTextAlt>
                                              <Field
                                                type={'checkbox'}
                                                name={`steps.${indexStep}.ingredients.${indexIngredient}.optional`}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                as={Toggle}
                                                variant="primary"
                                              />
                                            </Label>
                                          </FormControl>
                                          <ButtonGroup
                                            key={`form-recipe-step${step.id}-ingredient-${ingredient.id}`}
                                            className="col-span-2 flex w-full flex-row items-center"
                                          >
                                            <Input
                                              id={`ingredient-${indexIngredient}-name`}
                                              joinItem
                                              className={`w-full cursor-pointer ${(errors.steps as StepError[])?.[indexStep]?.ingredients?.[indexIngredient]?.ingredientId ? fieldErrorClass : undefined}`}
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
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="border-primary text-primary hover:bg-primary/10"
                                              joinItem
                                              onClick={() => {
                                                openIngredientSelectModal(setFieldValue, indexStep, indexIngredient);
                                              }}
                                            >
                                              <FaSearch />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              joinItem
                                              onClick={() => {
                                                modalContext.openModal(
                                                  <FormModal<Ingredient>
                                                    form={
                                                      <IngredientForm
                                                        formRef={createRef<FormikProps<IngredientFormValues>>()}
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
                                            </Button>
                                          </ButtonGroup>
                                          <ButtonGroup className="col-span-2 flex w-full items-center md:col-span-1">
                                            <Input
                                              type="number"
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.amount`}
                                              joinItem
                                              className="min-w-20"
                                              onChange={handleChange}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].amount ?? ''}
                                            />
                                            <div className={'tooltip'}></div>
                                            <Select
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.unitId`}
                                              joinItem
                                              className={
                                                (errors.steps as StepError[])?.[indexStep]?.ingredients?.[indexIngredient]?.unit ? fieldErrorClass : undefined
                                              }
                                              onChange={async (e) => {
                                                handleChange(e);
                                                await setFieldValue(
                                                  `steps.${indexStep}.ingredients.${indexIngredient}.unit`,
                                                  units.find((u) => u.id == e.target.value),
                                                );
                                              }}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].unitId ?? ''}
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
                                            </Select>
                                            <Button
                                              type="button"
                                              variant="error"
                                              shape="square"
                                              joinItem
                                              onClick={() =>
                                                modalContext.openModal(
                                                  <DeleteConfirmationModal
                                                    spelling={'REMOVE'}
                                                    entityName={`die Zutat '${values.steps[indexStep].ingredients[indexIngredient].ingredient?.name ?? ''}'`}
                                                    onApprove={async () => removeIngredient(indexIngredient)}
                                                  />,
                                                )
                                              }
                                            >
                                              <FaTrashAlt />
                                            </Button>
                                          </ButtonGroup>
                                        </div>
                                      </div>
                                    </>
                                  ))}

                                <div className={'flex w-full justify-end pt-2'}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
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
                                  </Button>
                                </div>
                              </>
                            )}
                          </FieldArray>
                        </Card>
                      ))}
                      <div className={'flex justify-center'}>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="gap-2"
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
                        </Button>
                      </div>
                    </div>
                  )}
                </FieldArray>
                <Divider className="col-span-2">Garnitur</Divider>
                <FieldArray name={'garnishes'}>
                  {({ push: pushGarnish, remove: removeGarnish }) => (
                    <div className={'col-span-2 space-y-4'}>
                      {values.garnishes.map((garnish: CocktailRecipeGarnishFull, indexGarnish: number) => (
                        <Card key={`form-recipe-garnish-${indexGarnish}`} variant="inset" className="flex flex-row gap-3 p-4">
                          <div className={'flex flex-none items-center'}>
                            <ButtonGroup vertical className="w-min items-center justify-center">
                              <Button
                                disabled={indexGarnish == 0}
                                type="button"
                                variant="outline"
                                shape="square"
                                size="xs"
                                joinItem
                                onClick={() => {
                                  const value = values.garnishes[indexGarnish];
                                  const reorderedGroups = (values.garnishes as CocktailRecipeGarnishFull[]).filter((_, i) => i != indexGarnish);
                                  reorderedGroups.splice(indexGarnish - 1, 0, value);

                                  // Ensure the item at index 0 has isAlternative = false
                                  const firstGarnish = reorderedGroups[0] as CocktailRecipeGarnishFull & { isAlternative?: boolean };
                                  if (firstGarnish.isAlternative) {
                                    firstGarnish.isAlternative = false;
                                  }

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
                              </Button>
                              <Button
                                disabled={!(values.garnishes.length > 1) || indexGarnish == values.garnishes.length - 1}
                                type="button"
                                variant="outline"
                                shape="square"
                                size="xs"
                                joinItem
                                onClick={() => {
                                  const value = values.garnishes[indexGarnish];
                                  const reorderedGroups = (values.garnishes as CocktailRecipeGarnishFull[]).filter((_, i) => i != indexGarnish);
                                  reorderedGroups.splice(indexGarnish + 1, 0, value);

                                  // Ensure the item at index 0 has isAlternative = false
                                  const firstGarnish = reorderedGroups[0] as CocktailRecipeGarnishFull & { isAlternative?: boolean };
                                  if (firstGarnish.isAlternative) {
                                    firstGarnish.isAlternative = false;
                                  }

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
                              </Button>
                            </ButtonGroup>
                          </div>
                          <div className={'grid w-full flex-2 grid-cols-1 gap-3 md:grid-cols-2'}>
                            <div className={''}>
                              <Label className="flex-row items-center justify-between">
                                <LabelText>Garnitur</LabelText>
                                <LabelTextAlt className="text-error">
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId &&
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId}
                                </LabelTextAlt>
                              </Label>
                              <ButtonGroup className="w-full">
                                <Input
                                  joinItem
                                  className={`w-full cursor-pointer ${(errors.garnishes as GarnishError[])?.[indexGarnish]?.garnishId ? fieldErrorClass : undefined}`}
                                  value={garnishesLoading ? 'Lade...' : (values.garnishes[indexGarnish].garnish?.name ?? 'Wähle eine Garnitur aus...')}
                                  readOnly={true}
                                  onClick={() => {
                                    openGarnishSelectModal(setFieldValue, indexGarnish);
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="border-primary text-primary hover:bg-primary/10"
                                  joinItem
                                  onClick={() => {
                                    openGarnishSelectModal(setFieldValue, indexGarnish);
                                  }}
                                >
                                  <FaSearch />
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  joinItem
                                  onClick={() => {
                                    modalContext.openModal(
                                      <FormModal<Garnish>
                                        form={
                                          <GarnishForm
                                            formRef={createRef<FormikProps<GarnishFormValues>>()}
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
                                </Button>
                              </ButtonGroup>
                            </div>
                            <div className={'row-span-2'}>
                              <Label className="flex-row items-center justify-between">
                                <LabelText>Zusätzliche Beschreibung</LabelText>
                                <LabelTextAlt className="text-error">{/*{errors.garnishDescription  && errors.garnishDescription}*/}</LabelTextAlt>
                              </Label>
                              <Textarea
                                value={values.garnishes[indexGarnish].description ?? ''}
                                name={`garnishes.${indexGarnish}.description`}
                                className="h-24 w-full"
                                onChange={handleChange}
                                onBlur={handleBlur}
                              />
                            </div>
                            <FormControl>
                              <Label className="w-fit flex-col items-start justify-start gap-1">
                                <LabelText>Optional</LabelText>
                                <LabelTextAlt className="text-error">
                                  {(errors.garnishes as GarnishError[])?.[indexGarnish]?.optional &&
                                    (errors.garnishes as GarnishError[])?.[indexGarnish]?.optional}
                                </LabelTextAlt>
                                <Field
                                  type={'checkbox'}
                                  name={`garnishes.${indexGarnish}.optional`}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  as={Toggle}
                                  variant="primary"
                                />
                              </Label>
                            </FormControl>
                            {indexGarnish > 0 && (
                              <FormControl>
                                <Label className="w-fit flex-col items-start justify-start gap-1">
                                  <LabelText>Alternativ</LabelText>
                                  <LabelTextAlt className="text-error">
                                    {(errors.garnishes as GarnishError[])?.[indexGarnish]?.isAlternative &&
                                      (errors.garnishes as GarnishError[])?.[indexGarnish]?.isAlternative}
                                  </LabelTextAlt>
                                  <Field
                                    type={'checkbox'}
                                    name={`garnishes.${indexGarnish}.isAlternative`}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    as={Toggle}
                                    variant="secondary"
                                  />
                                </Label>
                              </FormControl>
                            )}
                          </div>
                          <div className={'flex-1'}>
                            <Button
                              type="button"
                              variant="error"
                              shape="square"
                              size="sm"
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
                            </Button>
                          </div>
                        </Card>
                      ))}

                      <div className={'flex justify-center'}>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="gap-2"
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
                        </Button>
                      </div>
                    </div>
                  )}
                </FieldArray>
              </CardBody>
            </Card>

            <div className={'md:hidden'}>
              <Button type="submit" variant="primary" wide disabled={isSubmitting}>
                {isSubmitting ? <Loading size="sm" /> : <></>}
                {props.cocktailRecipe == undefined ? 'Erstellen' : 'Aktualisieren'}
              </Button>
              {!isValid && (
                <div className={'font-thin text-error italic'}>
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
