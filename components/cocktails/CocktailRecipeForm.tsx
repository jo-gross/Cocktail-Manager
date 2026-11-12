import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import { FieldArray, Formik, FormikProps } from 'formik';
import { arrayMove } from '@dnd-kit/sortable';
import React, { createRef, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import type { ActionDto } from '@lib/schemas/actions';
import { convertBase64ToFile, fetchImageAsBase64 } from '@lib/Base64Converter';
import { CocktailRecipeStepFull } from '../../models/CocktailRecipeStepFull';
import CocktailRecipeCardItem from './CocktailRecipeCardItem';
import { alertService } from '@lib/alertService';
import { CocktailRecipeGarnishFull } from '../../models/CocktailRecipeGarnishFull';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _, { orderBy } from 'lodash';
import { SelectModal } from '../modals/SelectModal';
import FormModal from '../modals/FormModal';
import { GarnishForm, GarnishFormValues } from '../garnishes/GarnishForm';
import { IngredientForm, FormValue as IngredientFormValues } from '../ingredients/IngredientForm';
import { GlassForm } from '../glasses/GlassForm';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import type { CocktailDto, CocktailSummaryDto } from '@lib/schemas/cocktails';
import type { GlassDto } from '@lib/schemas/glasses';
import type { GarnishDto } from '@lib/schemas/garnishes';
import type { IngredientDto } from '@lib/schemas/ingredients';
import { UserContext } from '@lib/context/UserContextProvider';
import { GlassModel } from '../../models/GlassModel';
import { GarnishModel } from '../../models/GarnishModel';
import type { UnitDto } from '@lib/schemas/units';
import type { IceDto } from '@lib/schemas/ices';
import { IngredientModel } from '../../models/IngredientModel';
import { fetchGlasses } from '@lib/network/glasses';
import { fetchGarnishes } from '@lib/network/garnishes';
import { fetchIngredients } from '@lib/network/ingredients';
import { fetchActions } from '@lib/network/actions';
import { fetchUnits } from '@lib/network/units';
import { calcCocktailTotalPrice } from '@lib/CocktailRecipeCalculation';
import { fetchIce } from '@lib/network/ices';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { TagInput } from '../TagInput';
import { alertApiV1Error, apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';
import { TranslatedFieldTabs } from '@components/translations/TranslatedFieldTabs';
import { useEntityContentTranslations } from '@components/translations/useEntityContentTranslations';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { FormikDirtyReporter } from '@lib/forms/FormikDirtyReporter';
import { trimmed } from '@lib/forms/formDirty';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import '../../lib/NumberUtils';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { Badge, Button, ButtonGroup, Input, InputAddon, Loading, Select, Textarea } from '@components/ui';
import { EntityFormLayout, type FormNavSection } from '@components/forms/EntityFormLayout';
import { FormSection } from '@components/forms/FormSection';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { FormSaveButton } from '@components/forms/FormSaveButton';
import { FormikImageTile } from '@components/forms/FormikImageTile';
import { TabbedCard } from '@components/forms/TabbedCard';
import { CocktailGuestInfoPreview } from '@components/guest-info/CocktailGuestInfoPreview';
import { PickerField } from '@components/forms/PickerField';
import { SortableList } from '@components/forms/SortableList';
import { ToggleField } from '@components/forms/ToggleField';
import { CocktailCostSummary } from './CocktailCostSummary';
import { CocktailGuestInfoFields, parseOptionalPercent, type CocktailGuestInfoFormValues } from '@components/guest-info/GuestInfoFormFields';
import { ADDITIVES, ALLERGENS } from '@lib/guest-info/constants';

export interface CocktailRecipeFormValues extends CocktailGuestInfoFormValues {
  id: string;
  name: string;
  description: string;
  notes: string;
  history: string;
  price: number | null;
  tags: string[];
  iceId: string | null;
  image: string | undefined;
  originalImage: File | undefined;
  glassId: string | undefined;
  ice: IceDto | null;
  glass: GlassModel | null;
  garnishes: CocktailRecipeGarnishFull[];
  steps: CocktailRecipeStepFull[];
  workspaceId: string;
  isArchived: boolean;
}

interface CocktailRecipeFormProps {
  cocktailRecipe?: CocktailDto;
  formRef: React.RefObject<FormikProps<CocktailRecipeFormValues> | null>;
  /** Extra sections from the page (e.g. export / history / archive), shown after the form sections. */
  additionalSections?: React.ReactNode;
}

/**
 * Repeated rows (steps, ingredient lines, garnishes) carry a client-side `_key`, so drag & drop and React
 * keep track of a row across reorders and edits. Saved rows use their database id; `_key` is never sent.
 */
type Keyed<T> = T & { _key?: string };
type KeyedStepIngredient = Keyed<CocktailRecipeStepFull['ingredients'][number]>;
type KeyedStep = Keyed<CocktailRecipeStepFull> & { ingredients: KeyedStepIngredient[] };
type KeyedGarnish = Keyed<CocktailRecipeGarnishFull> & { isAlternative?: boolean };

let rowKeyCounter = 0;
function newRowKey() {
  rowKeyCounter += 1;
  return `new-${rowKeyCounter}`;
}

/** Map v1 CocktailDto nested refs into the flat FK shape the form fields expect (ordered like they are displayed). */
function mapCocktailDtoToFormSteps(cocktail: CocktailDto): KeyedStep[] {
  return orderBy(cocktail.steps, ['stepNumber'], ['asc']).map(
    (step) =>
      ({
        _key: step.id,
        id: step.id,
        cocktailRecipeId: cocktail.id,
        stepNumber: step.stepNumber,
        optional: step.optional,
        actionId: step.action?.id ?? '',
        action: step.action ?? { id: '', name: '' },
        ingredients: orderBy(step.ingredients, ['ingredientNumber'], ['asc']).map((line) => ({
          _key: line.id,
          id: line.id,
          amount: line.amount,
          optional: line.optional,
          ingredientNumber: line.ingredientNumber,
          unitId: line.unit?.id ?? null,
          ingredientId: line.ingredient?.id ?? null,
          unit: line.unit ?? null,
          ingredient: line.ingredient ?? null,
          cocktailRecipeStepId: step.id,
        })),
      }) as unknown as KeyedStep,
  );
}

function mapCocktailDtoToFormGarnishes(cocktail: CocktailDto): CocktailRecipeGarnishFull[] {
  return cocktail.garnishes.map(
    (g, index) =>
      ({
        _key: `garnish-${index}`,
        cocktailRecipeId: cocktail.id,
        garnishId: g.garnishId ?? g.garnish?.id ?? '',
        garnishNumber: g.garnishNumber,
        description: g.description,
        optional: g.optional,
        isAlternative: g.isAlternative,
        garnish: g.garnish,
      }) as unknown as CocktailRecipeGarnishFull,
  );
}

/**
 * The persisted part of the form values (mirrors `onSubmit`) for the unsaved-changes check.
 * Display objects (`ingredient`, `unit`, `action`, `garnish`, `ice`, `glass`) are replaced with the
 * richer list DTOs after the lists loaded and must not count as a change; numbering follows the array order.
 */
function toComparableCocktail(values: CocktailRecipeFormValues) {
  return {
    name: values.name,
    description: trimmed(values.description),
    notes: trimmed(values.notes),
    history: trimmed(values.history),
    price: values.price,
    tags: values.tags,
    iceId: values.iceId,
    glassId: values.glassId,
    image: values.image,
    abvOverride: values.abvOverride,
    extraAllergens: [...values.extraAllergens].sort(),
    extraAdditives: [...values.extraAdditives].sort(),
    steps: values.steps.map((step) => ({
      id: step.id,
      optional: step.optional ?? false,
      actionId: step.actionId,
      ingredients: step.ingredients.map((ingredient) => ({
        id: ingredient.id,
        amount: ingredient.amount,
        optional: ingredient.optional ?? false,
        unitId: ingredient.unitId,
        ingredientId: ingredient.ingredientId,
      })),
    })),
    garnishes: values.garnishes.map((garnish) => ({
      garnishId: garnish.garnishId,
      description: garnish.description,
      optional: garnish.optional ?? false,
      isAlternative: (garnish as CocktailRecipeGarnishFull & { isAlternative?: boolean }).isAlternative ?? false,
    })),
  };
}

/**
 * Mirrors the former inline `validate` logic:
 *  - name / glassId / iceId are required (non-empty),
 *  - an image that was selected but not yet cropped is rejected,
 *  - every step needs an action and, per ingredient line, a unit and an ingredient
 *    (amount only errors when it is a present-but-not-a-number value),
 *  - every garnish needs a garnishId.
 * The adapter maps issue paths (e.g. `steps[0].ingredients[1].unit`) onto Formik's
 * nested error object, so the field-level messages line up with the JSX exactly as before.
 */
const cocktailFormSchema = (requiredMessage: string, imageNotCroppedMessage: string, abvRangeMessage: string) =>
  z
    .object({
      name: z.string().refine((v) => v.trim() != '', { message: requiredMessage }),
      glassId: z
        .string()
        .nullish()
        .refine((v) => v != null && v != '', { message: requiredMessage }),
      iceId: z
        .string()
        .nullish()
        .refine((v) => v != null && v != '', { message: requiredMessage }),
      image: z.string().optional(),
      originalImage: z.any().optional(),
      abvOverride: z.union([z.literal(''), z.null(), z.coerce.number().min(0, abvRangeMessage).max(100, abvRangeMessage)]),
      extraAllergens: z.array(z.enum(ALLERGENS)),
      extraAdditives: z.array(z.enum(ADDITIVES)),
      steps: z.array(
        z.object({
          actionId: z
            .string()
            .nullish()
            .refine((v) => v != null && v != '', { message: requiredMessage }),
          ingredients: z.array(
            z
              .object({
                // The number input feeds `handleChange` raw strings, so accept string | number | null.
                amount: z.union([z.number(), z.string(), z.null()]).optional(),
                unitId: z.string().nullish(),
                ingredientId: z.string().nullish(),
              })
              // Object-level so we control the exact error sub-paths the JSX reads
              // (`amount` / `unit` / `ingredientId`), mirroring the old inline logic.
              .superRefine((ingredient, ctx) => {
                // Old rule: `if (ingredient.amount && isNaN(ingredient.amount))` — only a
                // truthy amount that is NaN when coerced errors; null / '' / 0 / valid numbers pass.
                if (ingredient.amount != null && ingredient.amount !== '' && Number(ingredient.amount) != 0 && isNaN(Number(ingredient.amount))) {
                  ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMessage, path: ['amount'] });
                }
                if (ingredient.unitId == null || ingredient.unitId == '') {
                  ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMessage, path: ['unit'] });
                }
                if (ingredient.ingredientId == null || ingredient.ingredientId == '') {
                  ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMessage, path: ['ingredientId'] });
                }
              }),
          ),
        }),
      ),
      garnishes: z.array(
        z.object({
          garnishId: z
            .string()
            .nullish()
            .refine((v) => v != null && v != '', { message: requiredMessage }),
        }),
      ),
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });

export function CocktailRecipeForm(props: CocktailRecipeFormProps) {
  const formRef = props.formRef;

  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();
  const { t } = useTranslation(['cocktail', 'common', 'entity', 'errors', 'guestInfo']);

  const [iceOptions, setIceOptions] = useState<IceDto[]>([]);
  const [_iceOptionsLoading, setIceOptionsLoading] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const [glasses, setGlasses] = useState<GlassModel[]>([]);
  const [glassesLoading, setGlassesLoading] = useState(false);

  const [garnishes, setGarnishes] = useState<GarnishModel[]>([]);
  const [garnishesLoading, setGarnishesLoading] = useState(false);

  const [actions, setActions] = useState<ActionDto[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [units, setUnits] = useState<UnitDto[]>([]);
  const [_unitsLoading, setUnitsLoading] = useState(false);

  const [similarCocktailRecipe, setSimilarCocktailRecipe] = useState<Pick<CocktailSummaryDto, 'id' | 'name'> | undefined>(undefined);

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.cocktailRecipe?.hasImage);
  const contentTranslations = useEntityContentTranslations('cocktail', props.cocktailRecipe?.id);

  useEffect(() => {
    let cancelled = false;
    const hydrateImage = async () => {
      if (props.cocktailRecipe?.hasImage && props.cocktailRecipe.imageUrl) {
        setImageHydrationDone(false);
        const base64 = await fetchImageAsBase64(props.cocktailRecipe.imageUrl);
        if (!cancelled) {
          setHydratedImage(base64);
          setImageHydrationDone(true);
        }
      } else {
        setHydratedImage(undefined);
        setImageHydrationDone(true);
      }
    };
    void hydrateImage();
    return () => {
      cancelled = true;
    };
  }, [props.cocktailRecipe?.id, props.cocktailRecipe?.hasImage, props.cocktailRecipe?.imageUrl]);

  const openIngredientSelectModal = useCallback(
    (setFieldValue: FormikProps<CocktailRecipeFormValues>['setFieldValue'], indexStep: number, indexIngredient: number) => {
      modalContext.openModal(
        <SelectModal<IngredientModel>
          title={t('cocktail:selectIngredient')}
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

            if (ingredient.volumes.length > 0) {
              const clUnit = units.find((unit) => unit.name.toLocaleLowerCase() == 'cl');
              let unitClOrFirst = ingredient.volumes.find((ingredientUnit) => ingredientUnit.unit.id == clUnit?.id)?.unit;
              if (unitClOrFirst == undefined) {
                unitClOrFirst = ingredient.volumes[0].unit;
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
    [ingredients, modalContext, t, units],
  );

  const openGarnishSelectModal = useCallback(
    (setFieldValue: FormikProps<CocktailRecipeFormValues>['setFieldValue'], indexGarnish: number) => {
      modalContext.openModal(
        <SelectModal<GarnishModel>
          title={t('cocktail:selectGarnish')}
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
    [garnishes, modalContext, t],
  );

  const cocktailGlassId = props.cocktailRecipe?.glass?.id;

  useEffect(() => {
    if (cocktailGlassId && glasses.length > 0) {
      formRef.current?.setFieldValue('glass', glasses.find((g) => g.id == cocktailGlassId) ?? undefined);
    }
  }, [formRef, glasses, cocktailGlassId]);

  useEffect(() => {
    // Otherwise not saved changes will be overwritten
    if (formRef.current?.values.garnishes == undefined) {
      if (props.cocktailRecipe != undefined && props.cocktailRecipe.garnishes?.length > 0 && garnishes.length > 0) {
        formRef.current?.setFieldValue(
          'garnishes',
          mapCocktailDtoToFormGarnishes(props.cocktailRecipe).map((garnish) => ({
            ...garnish,
            garnish: garnishes.find((g) => g.id == garnish.garnishId) ?? garnish.garnish,
          })),
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
      if (props.cocktailRecipe?.steps.some((step) => step.ingredients.length > 0) && ingredients.length > 0 && props.cocktailRecipe) {
        formRef.current?.setFieldValue(
          'steps',
          mapCocktailDtoToFormSteps(props.cocktailRecipe).map((step) => ({
            ...step,
            ingredients: step.ingredients.map((ingredient) => ({
              ...ingredient,
              ingredient: ingredients.find((i) => i.id == ingredient.ingredientId) ?? ingredient.ingredient,
            })),
          })),
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
    fetchActions(workspaceId, setActions, setActionsLoading, t('errors:loadActions'));
    fetchIce(workspaceId, setIceOptions, setIceOptionsLoading);
    fetchIngredients(workspaceId, setIngredients, setIngredientsLoading);
    fetchGarnishes(workspaceId, setGarnishes, setGarnishesLoading);
    fetchGlasses(workspaceId, setGlasses, setGlassesLoading, t('errors:loadGlasses'));
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
  }, [workspaceId, t]);

  const initSteps: CocktailRecipeStepFull[] = props.cocktailRecipe ? mapCocktailDtoToFormSteps(props.cocktailRecipe) : [];
  const initGarnishes: CocktailRecipeGarnishFull[] = props.cocktailRecipe ? mapCocktailDtoToFormGarnishes(props.cocktailRecipe) : [];
  const iceId = props.cocktailRecipe?.ice?.id ?? null;
  const glassId = props.cocktailRecipe?.glass?.id ?? undefined;

  const initValue = {
    id: props.cocktailRecipe?.id ?? '',
    name: props.cocktailRecipe?.name ?? '',
    description: props.cocktailRecipe?.description ?? '',
    notes: props.cocktailRecipe?.notes ?? '',
    history: props.cocktailRecipe?.history ?? '',
    price: props.cocktailRecipe?.price ?? null,
    tags: props.cocktailRecipe?.tags ?? [],
    iceId,
    image: hydratedImage,
    originalImage: hydratedImage ? convertBase64ToFile(hydratedImage) : undefined,
    glassId,
    ice: iceOptions.find((i) => i.id == iceId) ?? null,
    glass: glasses.find((g) => g.id == glassId) ?? null,
    garnishes: initGarnishes,
    steps: initSteps,
    workspaceId: workspaceId!,
    isArchived: props.cocktailRecipe?.isArchived ?? false,
    abvOverride: props.cocktailRecipe?.abvOverride ?? '',
    extraAllergens: props.cocktailRecipe?.extraAllergens ?? [],
    extraAdditives: props.cocktailRecipe?.extraAdditives ?? [],
  };

  const inheritTagsFromIngredients = useCallback((steps: CocktailRecipeStepFull[], tags: string[]) => {
    return (steps as CocktailRecipeStepFull[])
      .flatMap((step) => step.ingredients.map((stepIngredient) => stepIngredient.ingredient))
      .flatMap((ingredient) => ingredient?.tags ?? [])
      .filter((tag) => tag != undefined && tag.trim() != '' && !tags.includes(tag))
      .filterUnique();
  }, []);

  if (props.cocktailRecipe && !imageHydrationDone) {
    return (
      <div className="flex justify-center py-8">
        <Loading />
      </div>
    );
  }

  return (
    <Formik
      innerRef={formRef}
      initialValues={initValue}
      validate={(values) => {
        const errors = zodFormikValidate(cocktailFormSchema(t('errors:requiredField'), t('common:imageNotCropped'), t('guestInfo:form.abvRange')))(values) as
          Record<string, unknown> | undefined;
        return errors;
      }}
      onSubmit={async (values) => {
        try {
          const body: Record<string, unknown> = {
            id: props.cocktailRecipe?.id,
            name: values.name,
            description: values.description.trim() === '' ? null : values.description.trim(),
            notes: values.notes.trim() === '' ? null : values.notes.trim(),
            history: values.history.trim() === '' ? null : values.history.trim(),
            price: values.price ?? null,
            iceId: values.iceId,
            glassId: values.glassId,
            tags: values.tags,
            abvOverride: parseOptionalPercent(values.abvOverride),
            extraAllergens: values.extraAllergens,
            extraAdditives: values.extraAdditives,
            // Shaped to the v1 CocktailStepInputSchema. Optional `id` is sent through so the
            // differential PUT can match existing rows (empty/missing id = new).
            steps: (values.steps as CocktailRecipeStepFull[]).map((step, index) => {
              return {
                id: step.id == '' ? undefined : step.id,
                stepNumber: index,
                optional: step.optional ?? false,
                actionId: step.actionId,
                ingredients: step.ingredients.map((ingredient, ingredientIndex) => {
                  return {
                    id: ingredient.id == '' ? undefined : ingredient.id,
                    amount: ingredient.amount,
                    optional: ingredient.optional ?? false,
                    ingredientNumber: ingredientIndex,
                    unitId: ingredient.unitId,
                    ingredientId: ingredient.ingredientId,
                  };
                }),
              };
            }),
            // Shaped to the v1 CocktailGarnishInputSchema.
            garnishes: (values.garnishes as CocktailRecipeGarnishFull[]).map((garnish, index) => {
              return {
                garnishId: garnish.garnishId,
                garnishNumber: index,
                description: garnish.description,
                optional: garnish.optional ?? false,
                isAlternative: (garnish as CocktailRecipeGarnishFull & { isAlternative?: boolean }).isAlternative ?? false,
              };
            }),
          };
          // Update always deleteMany's the image row; re-send base64 to keep, omit to clear.
          if (values.image != undefined && values.image !== '') {
            body.image = values.image;
          }
          if (!workspaceId) return;
          if (props.cocktailRecipe == undefined) {
            const created = await apiV1Mutate<CocktailDto>(`/api/v1/workspaces/${workspaceId}/cocktails`, 'POST', body);
            await contentTranslations.save(created.id);
            alertService.success(t('cocktail:success.created'));
            await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cocktails`));
          } else {
            const cocktailId = props.cocktailRecipe.id;
            await apiV1Mutate<CocktailDto>(`/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}`, 'PUT', body);
            await contentTranslations.save(cocktailId);
            alertService.success(t('cocktail:success.updated'));
            await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/cocktails#${cocktailId}`));
          }
        } catch (error) {
          alertApiV1Error(error, props.cocktailRecipe == undefined ? t('cocktail:error.create') : t('cocktail:error.save'));
        }
      }}
    >
      {(formik) => {
        const { values, setFieldValue, setFieldError, handleChange, handleBlur, handleSubmit } = formik;
        const steps = values.steps as KeyedStep[];
        const formGarnishes = values.garnishes as KeyedGarnish[];
        const nameError = visibleFieldError(formik, 'name');
        const glassError = visibleFieldError(formik, 'glassId');
        const iceError = visibleFieldError(formik, 'iceId');
        const priceError = visibleFieldError(formik, 'price');
        const tagsError = typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined;
        const suggestedTags = inheritTagsFromIngredients(steps, values.tags);
        const guestInfoOverridden =
          (values.abvOverride !== '' && values.abvOverride != null) || values.extraAllergens.length > 0 || values.extraAdditives.length > 0;

        const sections: FormNavSection[] = [
          { id: 'cocktail-general', label: t('common:form.section.general') },
          { id: 'cocktail-preparation', label: t('cocktail:preparation') },
          { id: 'cocktail-garnish', label: t('cocktail:garnish') },
          { id: 'cocktail-texts', label: t('common:form.section.texts') },
          { id: 'cocktail-guest-info', label: t('guestInfo:form.sectionTitle') },
          { id: 'cocktail-preview', label: t('common:preview'), hideWhenWide: true },
        ];

        const moveGarnish = (from: number, to: number) => {
          const reordered = arrayMove(formGarnishes, from, to).map((garnish, index) => ({ ...garnish, garnishNumber: index }));
          // The first garnish can't be an alternative to a previous one.
          if (reordered[0]?.isAlternative) reordered[0] = { ...reordered[0], isAlternative: false };
          setFieldValue('garnishes', reordered);
        };

        return (
          <form onSubmit={handleSubmit} noValidate>
            <FormikDirtyReporter toComparable={toComparableCocktail} />
            <FormSaveButton label={props.cocktailRecipe == undefined ? t('common:create') : t('common:save')} />
            <EntityFormLayout
              sections={sections}
              stickyAside
              trailing={props.additionalSections}
              aside={
                <TabbedCard
                  id="cocktail-preview"
                  tabs={[
                    {
                      id: 'preview',
                      label: t('common:preview'),
                      content: (
                        <CocktailRecipeCardItem
                          image={values.image}
                          imageSlot={
                            <FormikImageTile
                              aspect={9 / 16}
                              width={504}
                              height={896}
                              size="fill"
                              alt={t('common:cocktailImageAlt')}
                              cropInfo={t('common:imageCropInfoLong')}
                            />
                          }
                          cocktailRecipe={
                            {
                              hasImage: values.image != undefined,
                              imageUrl: null,
                              id: values.id,
                              name: values.name,
                              description: values.description.trim() == '' ? null : values.description.trim(),
                              notes: values.notes.trim() == '' ? null : values.notes.trim(),
                              history: values.history.trim() == '' ? null : values.history.trim(),
                              tags: values.tags,
                              price: values.price,
                              ice: iceOptions.find((ice) => ice.id === values.iceId) ?? null,
                              isArchived: false,
                              glass: glasses.find((glass) => glass.id === values.glassId) ?? null,
                              garnishes: values.garnishes,
                              steps: values.steps,
                              averageRating: null,
                              ratingCount: 0,
                            } as unknown as CocktailDto
                          }
                          showInfo={false}
                          showTags={true}
                          showDescription={true}
                          showNotes={true}
                          showHistory={true}
                        />
                      ),
                    },
                    {
                      id: 'guests',
                      label: t('cocktail:guestsTab'),
                      content: workspaceId ? <CocktailGuestInfoPreview workspaceId={workspaceId} cocktailId={props.cocktailRecipe?.id} /> : null,
                    },
                    {
                      id: 'finances',
                      label: t('cocktail:finances'),
                      content: (
                        <CocktailCostSummary
                          steps={steps}
                          garnishes={formGarnishes}
                          ingredients={ingredients}
                          total={calcCocktailTotalPrice(values as unknown as CocktailRecipeFull, ingredients)}
                        />
                      ),
                    },
                  ]}
                />
              }
            >
              <FormSection id="cocktail-general" title={t('common:form.section.general')}>
                <FormField
                  label={t('cocktail:name')}
                  htmlFor="name"
                  required
                  error={nameError}
                  warning={similarCocktailRecipe ? t('cocktail:similarExists', { name: similarCocktailRecipe.name }) : undefined}
                >
                  <TranslatedFieldTabs translations={contentTranslations} field="name" sourceValue={values.name}>
                    <Input
                      id={'name'}
                      name="name"
                      autoComplete={'off'}
                      enterKeyHint={'next'}
                      error={!!nameError}
                      onChange={(event) => {
                        if (event.target.value.length > 2 && workspaceId) {
                          apiV1Fetch<CocktailSummaryDto | null>(
                            `/api/v1/workspaces/${workspaceId}/cocktails/check?name=${encodeURIComponent(event.target.value)}`,
                          )
                            .then((match) => {
                              if (match != null && match.id != props.cocktailRecipe?.id) {
                                setSimilarCocktailRecipe(match);
                              } else {
                                setSimilarCocktailRecipe(undefined);
                              }
                            })
                            .catch(() => setSimilarCocktailRecipe(undefined));
                        } else {
                          setSimilarCocktailRecipe(undefined);
                        }
                        handleChange(event);
                      }}
                      onBlur={handleBlur}
                      value={values.name}
                    />
                  </TranslatedFieldTabs>
                </FormField>

                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <FormField label={t('cocktail:glass')} htmlFor="glassId" required error={glassError}>
                    <ButtonGroup className="w-full">
                      <Select
                        id={'glassId'}
                        name="glassId"
                        joinItem
                        error={!!glassError}
                        onChange={(event) => {
                          handleChange(event);
                          setFieldValue(
                            'glass',
                            glasses.find((glass) => glass.id == event.target.value),
                          );
                        }}
                        onBlur={handleBlur}
                        value={values.glassId ?? ''}
                      >
                        {glassesLoading ? (
                          <option disabled={true} value={values.glassId ?? ''}>
                            {t('common:loading')}
                          </option>
                        ) : (
                          <>
                            <option value={''}>{t('common:select')}</option>
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
                        aria-label={t('cocktail:selectGlass')}
                        title={t('cocktail:selectGlass')}
                        onClick={() =>
                          modalContext.openModal(
                            <FormModal<GlassDto>
                              form={
                                <GlassForm
                                  onSaved={async (id) => {
                                    modalContext.closeAllModals();
                                    await setFieldValue('glassId', id);
                                    fetchGlasses(workspaceId, setGlasses, setGlassesLoading, t('errors:loadGlasses'));
                                  }}
                                />
                              }
                              title={t('cocktail:selectGlass')}
                            />,
                          )
                        }
                      >
                        <FaPlus aria-hidden />
                      </Button>
                    </ButtonGroup>
                  </FormField>
                  <FormField label={t('cocktail:ice')} htmlFor="iceId" required error={iceError}>
                    <Select
                      id={'iceId'}
                      name="iceId"
                      error={!!iceError}
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
                      <option value={''}>{t('common:select')}</option>
                      {Object.values(iceOptions)
                        .sort((a, b) => userContext.getTranslation(a.name).localeCompare(userContext.getTranslation(b.name)))
                        .map((iceType) => (
                          <option key={`form-recipe-ice-types-${iceType.id}`} value={iceType.id}>
                            {userContext.getTranslation(iceType.name)}
                          </option>
                        ))}
                    </Select>
                  </FormField>
                  <FormField label={t('cocktail:price')} htmlFor="price" error={priceError}>
                    <ButtonGroup className="w-full">
                      <Input
                        id={'price'}
                        name="price"
                        type="number"
                        inputMode={'decimal'}
                        step={'any'}
                        joinItem
                        error={!!priceError}
                        // Formik's handleChange turns a cleared number input into '' (rendered by the preview, coerced to 0 by the API).
                        onChange={(event) => setFieldValue('price', event.target.value === '' ? null : parseFloat(event.target.value))}
                        onBlur={handleBlur}
                        value={values.price ?? ''}
                      />
                      <InputAddon>€</InputAddon>
                    </ButtonGroup>
                  </FormField>
                  <FormField label={t('cocktail:tags')} error={tagsError}>
                    <TagInput
                      value={values.tags}
                      onChange={(tags: string[]) =>
                        setFieldValue(
                          'tags',
                          updateTags(tags, (text) => setFieldError('tags', text ?? t('common:tagInvalid'))),
                        )
                      }
                      validate={(tag) => validateTag(tag, (text) => setFieldError('tags', text ?? t('common:tagInvalid')))}
                    />
                    {suggestedTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2" title={t('cocktail:tagsFromIngredientsTip')}>
                        <span className="text-xs text-base-content/60">{t('cocktail:tagsFromIngredients')}</span>
                        {suggestedTags.map((tag) => (
                          <Badge key={`tag-suggestion-${tag}`} outline className="gap-1 pointer-coarse:gap-1.5">
                            {tag}
                            <button
                              type="button"
                              aria-label={`${t('common:add')}: ${tag}`}
                              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm hover:bg-base-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none pointer-coarse:h-6 pointer-coarse:w-6"
                              onClick={() => setFieldValue('tags', [...values.tags, tag])}
                            >
                              <FaPlus aria-hidden className="text-[0.6rem]" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </FormField>
                </div>
              </FormSection>

              <FormSection id="cocktail-preparation" title={t('cocktail:preparation')}>
                <FieldArray name={'steps'}>
                  {({ push: pushStep, remove: removeStep }) => (
                    <div className="flex flex-col gap-3">
                      {steps.length == 0 && <p className="text-sm text-base-content/60">{t('cocktail:noSteps')}</p>}
                      <SortableList
                        items={steps}
                        getId={(step, index) => step._key ?? `step-${index}`}
                        onMove={(from, to) =>
                          setFieldValue(
                            'steps',
                            arrayMove(steps, from, to).map((step, index) => ({ ...step, stepNumber: index })),
                          )
                        }
                        className="flex flex-col gap-3"
                        renderItem={(step, indexStep, stepHandle) => (
                          <div className="rounded-xl border border-base-300 bg-base-100">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-base-300 py-1.5 pr-1.5 pl-1">
                              {stepHandle}
                              <span className="font-semibold whitespace-nowrap">{t('cocktail:step', { n: indexStep + 1 })}</span>
                              <div className="min-w-40 flex-1">
                                <Select
                                  aria-label={t('cocktail:stepAction')}
                                  name={`steps.${indexStep}.actionId`}
                                  value={step.actionId}
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
                                    <option disabled={true}>{t('common:loadingShort')}</option>
                                  ) : (
                                    Object.entries(_.groupBy(actions, 'actionGroup')).map(([group, groupActions]) => (
                                      <optgroup key={`form-recipe-step-${indexStep}-action-group-${group}`} label={userContext.getTranslation(group)}>
                                        {groupActions
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map((action, indexAction) => (
                                            <option key={`form-recipe-step-${indexStep}-action-${indexAction}`} value={action.id}>
                                              {userContext.getTranslation(action.name)}
                                            </option>
                                          ))}
                                      </optgroup>
                                    ))
                                  )}
                                </Select>
                              </div>
                              <ToggleField
                                label={t('common:optional')}
                                toggleSize="sm"
                                className="px-1"
                                checked={step.optional ?? false}
                                onCheckedChange={(checked) => setFieldValue(`steps.${indexStep}.optional`, checked)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                shape="square"
                                className="text-error hover:bg-error/10"
                                aria-label={`${t('common:remove')}: ${t('cocktail:step', { n: indexStep + 1 })}`}
                                onClick={() => {
                                  if (step.ingredients.length == 0) {
                                    removeStep(indexStep);
                                    return;
                                  }
                                  modalContext.openModal(
                                    <DeleteConfirmationModal
                                      spelling={'REMOVE'}
                                      entityName={t('cocktail:step', { n: indexStep + 1 }) + ' - ' + userContext.getTranslation(step.action?.name ?? '')}
                                      onApprove={async () => {
                                        removeStep(indexStep);
                                      }}
                                    />,
                                  );
                                }}
                              >
                                <FaTrashAlt aria-hidden />
                              </Button>
                            </div>
                            <FieldArray name={`steps.${indexStep}.ingredients`}>
                              {({ push: pushIngredient, remove: removeIngredient }) => (
                                <div className="flex flex-col py-1 pr-1.5 pl-1">
                                  {step.ingredients.length == 0 && <p className="px-3 py-2 text-sm text-base-content/60">{t('cocktail:noStepIngredients')}</p>}
                                  <SortableList
                                    items={step.ingredients as KeyedStepIngredient[]}
                                    getId={(line, index) => line._key ?? `step-${indexStep}-ingredient-${index}`}
                                    onMove={(from, to) =>
                                      setFieldValue(
                                        `steps.${indexStep}.ingredients`,
                                        arrayMove(step.ingredients, from, to).map((line, index) => ({ ...line, ingredientNumber: index })),
                                      )
                                    }
                                    className="flex flex-col divide-y divide-base-300"
                                    renderItem={(line, indexIngredient, lineHandle) => {
                                      const path = `steps.${indexStep}.ingredients.${indexIngredient}`;
                                      const ingredientError = visibleFieldError(formik, `${path}.ingredientId`);
                                      const unitError = visibleFieldError(formik, `${path}.unit`);
                                      const amountError = visibleFieldError(formik, `${path}.amount`);
                                      const lineIngredient = ingredients.find((ingredient) => ingredient.id == line.ingredientId);
                                      return (
                                        <div className="flex items-start gap-1 bg-base-100 py-1.5">
                                          {lineHandle}
                                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                            <ButtonGroup className="min-w-0 flex-[1_1_16rem]">
                                              <PickerField
                                                joinItem
                                                error={!!ingredientError}
                                                value={ingredientsLoading ? t('common:loadingShort') : line.ingredient?.name}
                                                placeholder={t('cocktail:chooseIngredient')}
                                                onClick={() => openIngredientSelectModal(setFieldValue, indexStep, indexIngredient)}
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                shape="square"
                                                joinItem
                                                className="shrink-0"
                                                aria-label={t('cocktail:createIngredient')}
                                                title={t('cocktail:createIngredient')}
                                                onClick={() => {
                                                  modalContext.openModal(
                                                    <FormModal<IngredientDto>
                                                      form={
                                                        <IngredientForm
                                                          formRef={createRef<FormikProps<IngredientFormValues>>()}
                                                          onSaved={async (id) => {
                                                            modalContext.closeAllModals();
                                                            await setFieldValue(`${path}.ingredientId`, id);
                                                            fetchIngredients(workspaceId, setIngredients, setIngredientsLoading);
                                                          }}
                                                        />
                                                      }
                                                      title={t('cocktail:createIngredient')}
                                                    />,
                                                  );
                                                }}
                                              >
                                                <FaPlus aria-hidden />
                                              </Button>
                                            </ButtonGroup>
                                            <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-2">
                                              <ButtonGroup className="min-w-0 flex-1">
                                                <Input
                                                  type="number"
                                                  inputMode={'decimal'}
                                                  step={'any'}
                                                  aria-label={t('common:quantity')}
                                                  name={`${path}.amount`}
                                                  joinItem
                                                  error={!!amountError}
                                                  className="flex-[0_0_4.5rem]"
                                                  onChange={handleChange}
                                                  onBlur={handleBlur}
                                                  value={line.amount ?? ''}
                                                />
                                                <Select
                                                  aria-label={t('cocktail:unit')}
                                                  name={`${path}.unitId`}
                                                  joinItem
                                                  error={!!unitError}
                                                  className="min-w-0 flex-1"
                                                  onChange={async (e) => {
                                                    handleChange(e);
                                                    await setFieldValue(
                                                      `${path}.unit`,
                                                      units.find((u) => u.id == e.target.value),
                                                    );
                                                  }}
                                                  onBlur={handleBlur}
                                                  value={line.unitId ?? ''}
                                                >
                                                  <option value={''} disabled>
                                                    {t('common:select')}
                                                  </option>
                                                  {line.unitId && lineIngredient?.volumes.find((unit) => unit.unit.id == line.unitId) == undefined ? (
                                                    <option value={line.unitId} disabled={true} title={t('cocktail:unitUnavailable')}>
                                                      {userContext.getTranslation(units.find((unit) => unit.id == line.unitId)?.name ?? '')} (
                                                      {t('cocktail:unitUnavailableShort')})
                                                    </option>
                                                  ) : null}
                                                  {lineIngredient?.volumes
                                                    ?.sort((a, b) =>
                                                      userContext.getTranslation(a.unit.name).localeCompare(userContext.getTranslation(b.unit.name)),
                                                    )
                                                    ?.map((value) => (
                                                      <option key={`${path}.units-${value.unit.id}`} value={value.unit.id}>
                                                        {userContext.getTranslation(value.unit.name)}
                                                      </option>
                                                    ))}
                                                </Select>
                                              </ButtonGroup>
                                              <ToggleField
                                                label={t('common:optional')}
                                                toggleSize="sm"
                                                checked={line.optional ?? false}
                                                onCheckedChange={(checked) => setFieldValue(`${path}.optional`, checked)}
                                              />
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                shape="square"
                                                className="text-error hover:bg-error/10"
                                                aria-label={`${t('common:remove')}: ${line.ingredient?.name ?? t('common:ingredientLabel')}`}
                                                onClick={() => {
                                                  if (line.ingredient == undefined) {
                                                    removeIngredient(indexIngredient);
                                                    return;
                                                  }
                                                  modalContext.openModal(
                                                    <DeleteConfirmationModal
                                                      spelling={'REMOVE'}
                                                      entityName={t('entity:theIngredient', { name: line.ingredient?.name ?? '' })}
                                                      onApprove={async () => removeIngredient(indexIngredient)}
                                                    />,
                                                  );
                                                }}
                                              >
                                                <FaTrashAlt aria-hidden />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="self-start text-primary"
                                    onClick={() =>
                                      pushIngredient({
                                        _key: newRowKey(),
                                        amount: 0,
                                        unitId: '',
                                        unit: undefined,
                                        ingredient: undefined,
                                        optional: false,
                                      })
                                    }
                                  >
                                    <FaPlus aria-hidden />
                                    {t('cocktail:addIngredient')}
                                  </Button>
                                </div>
                              )}
                            </FieldArray>
                          </div>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        block
                        className="border-dashed"
                        disabled={actions.length == 0}
                        onClick={() => {
                          pushStep({
                            _key: newRowKey(),
                            id: '',
                            cocktailRecipeId: '',
                            actionId: actions[0].id,
                            action: actions[0],
                            stepNumber: values.steps.length,
                            ingredients: [],
                            optional: false,
                          });
                        }}
                      >
                        <FaPlus aria-hidden />
                        {t('cocktail:addStep')}
                      </Button>
                    </div>
                  )}
                </FieldArray>
                <FormField label={t('cocktail:prepNotes')} htmlFor="notes">
                  <Textarea
                    id={'notes'}
                    name="notes"
                    placeholder={t('cocktail:prepNotesPlaceholder')}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.notes}
                    rows={3}
                  />
                </FormField>
              </FormSection>

              <FormSection id="cocktail-garnish" title={t('cocktail:garnish')}>
                <FieldArray name={'garnishes'}>
                  {({ push: pushGarnish, remove: removeGarnish }) => (
                    <div className="flex flex-col gap-3">
                      {formGarnishes.length == 0 && <p className="text-sm text-base-content/60">{t('cocktail:noGarnishesYet')}</p>}
                      <SortableList
                        items={formGarnishes}
                        getId={(garnish, index) => garnish._key ?? `garnish-${index}`}
                        onMove={moveGarnish}
                        className="flex flex-col gap-3"
                        renderItem={(garnish, indexGarnish, garnishHandle) => {
                          const garnishError = visibleFieldError(formik, `garnishes.${indexGarnish}.garnishId`);
                          return (
                            <div className="flex items-start gap-1 rounded-xl border border-base-300 bg-base-100 py-1.5 pr-1.5 pl-1">
                              {garnishHandle}
                              <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <ButtonGroup className="min-w-0 flex-[1_1_16rem]">
                                    <PickerField
                                      joinItem
                                      error={!!garnishError}
                                      value={garnishesLoading ? t('common:loadingShort') : garnish.garnish?.name}
                                      placeholder={t('cocktail:chooseGarnish')}
                                      onClick={() => openGarnishSelectModal(setFieldValue, indexGarnish)}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      shape="square"
                                      joinItem
                                      className="shrink-0"
                                      aria-label={t('cocktail:createGarnish')}
                                      title={t('cocktail:createGarnish')}
                                      onClick={() => {
                                        modalContext.openModal(
                                          <FormModal<GarnishDto>
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
                                            title={t('cocktail:createGarnish')}
                                          />,
                                        );
                                      }}
                                    >
                                      <FaPlus aria-hidden />
                                    </Button>
                                  </ButtonGroup>
                                  <div className="flex items-center gap-2">
                                    <ToggleField
                                      label={t('common:optional')}
                                      toggleSize="sm"
                                      checked={garnish.optional ?? false}
                                      onCheckedChange={(checked) => setFieldValue(`garnishes.${indexGarnish}.optional`, checked)}
                                    />
                                    {indexGarnish > 0 && (
                                      <ToggleField
                                        label={t('cocktail:alternative')}
                                        toggleSize="sm"
                                        variant="secondary"
                                        checked={garnish.isAlternative ?? false}
                                        onCheckedChange={(checked) => setFieldValue(`garnishes.${indexGarnish}.isAlternative`, checked)}
                                      />
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      shape="square"
                                      className="text-error hover:bg-error/10"
                                      aria-label={`${t('common:remove')}: ${garnish.garnish?.name ?? t('cocktail:garnish')}`}
                                      onClick={() => {
                                        if (garnish.garnish == undefined) {
                                          removeGarnish(indexGarnish);
                                          return;
                                        }
                                        modalContext.openModal(
                                          <DeleteConfirmationModal
                                            spelling={'REMOVE'}
                                            entityName={t('entity:theGarnish', { name: garnish.garnish?.name ?? '' })}
                                            onApprove={async () => removeGarnish(indexGarnish)}
                                          />,
                                        );
                                      }}
                                    >
                                      <FaTrashAlt aria-hidden />
                                    </Button>
                                  </div>
                                </div>
                                <Textarea
                                  aria-label={t('cocktail:garnishDescription')}
                                  placeholder={t('cocktail:garnishDescription')}
                                  value={garnish.description ?? ''}
                                  name={`garnishes.${indexGarnish}.description`}
                                  rows={2}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                />
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        block
                        className="border-dashed"
                        onClick={() => {
                          pushGarnish({
                            _key: newRowKey(),
                            cocktailRecipeId: '',
                            garnishId: '',
                            garnish: undefined,
                            optional: false,
                            garnishNumber: values.garnishes.length,
                            description: '',
                          });
                        }}
                      >
                        <FaPlus aria-hidden />
                        {t('cocktail:addGarnish')}
                      </Button>
                    </div>
                  )}
                </FieldArray>
              </FormSection>

              <FormSection id="cocktail-texts" title={t('common:form.section.texts')}>
                <FormField label={t('cocktail:description')} htmlFor="description">
                  <TranslatedFieldTabs translations={contentTranslations} field="description" sourceValue={values.description} multiline>
                    <Textarea
                      id={'description'}
                      name="description"
                      placeholder={t('cocktail:descriptionPlaceholder')}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.description}
                      rows={4}
                    />
                  </TranslatedFieldTabs>
                </FormField>
                <FormField label={t('cocktail:history')} htmlFor="history">
                  <TranslatedFieldTabs translations={contentTranslations} field="history" sourceValue={values.history} multiline>
                    <Textarea
                      id={'history'}
                      name="history"
                      placeholder={t('cocktail:historyPlaceholder')}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.history}
                      rows={4}
                    />
                  </TranslatedFieldTabs>
                </FormField>
              </FormSection>

              {/* Collapsed by default: these fields override what is derived from the ingredients. */}
              <FormSection
                id="cocktail-guest-info"
                collapsible
                forceOpen={visibleFieldError(formik, 'abvOverride') != undefined}
                title={t('guestInfo:form.overrideTitle')}
                description={t('guestInfo:form.overrideHint')}
                badge={
                  guestInfoOverridden ? (
                    <Badge variant="warning" size="sm">
                      {t('guestInfo:form.overridesActive')}
                    </Badge>
                  ) : undefined
                }
              >
                <CocktailGuestInfoFields />
              </FormSection>
            </EntityFormLayout>
          </form>
        );
      }}
    </Formik>
  );
}
