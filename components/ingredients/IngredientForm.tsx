import { FieldArray, Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { convertBase64ToFile, convertToBase64, fetchImageAsBase64 } from '@lib/Base64Converter';
import { FaPlus, FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { alertService } from '@lib/alertService';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import type { IngredientCreateInput, IngredientDto, IngredientUpdateInput } from '@lib/schemas/ingredients';
import type { UnitDto, UnitConversionDto } from '@lib/schemas/units';
import { UserContext } from '@lib/context/UserContextProvider';
import { fetchUnitConversions, fetchUnits } from '@lib/network/units';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkIngredientLink, checkIngredientName, createIngredient, updateIngredient } from '@lib/network/ingredients';
import { TranslatedFieldTabs } from '@components/translations/TranslatedFieldTabs';
import { useEntityContentTranslations } from '@components/translations/useEntityContentTranslations';
import { TagInput } from '../TagInput';
import '../../lib/ArrayUtils';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { autoCropImage } from '@lib/ImageUtils';
import { FormValidationWarningModal } from '../modals/FormValidationWarningModal';
import { FormikDirtyReporter } from '@lib/forms/FormikDirtyReporter';
import { trimmed } from '@lib/forms/formDirty';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import { Button, ButtonGroup, Input, InputAddon, Loading, Select, Textarea } from '@components/ui';
import { EntityFormLayout } from '@components/forms/EntityFormLayout';
import { FormSection } from '@components/forms/FormSection';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { FormSaveButton } from '@components/forms/FormSaveButton';
import { FormikImageTile } from '@components/forms/FormikImageTile';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { IngredientGuestInfoFields, parseOptionalPercent, type IngredientGuestInfoFormValues } from '@components/guest-info/GuestInfoFormFields';
import { ADDITIVES, ALLERGEN_SOURCES, ALLERGENS } from '@lib/guest-info/constants';

function createIngredientFormSchema(requiredMessage: string, imageNotCroppedMessage: string, abvRangeMessage: string) {
  return z
    .object({
      name: z.string().min(1, requiredMessage),
      shortName: z.string().optional(),
      notes: z.string().optional(),
      description: z.string().optional(),
      price: z.coerce.number().nullish(),
      units: z
        .array(
          z.object({
            unitId: z.string(),
            volume: z.coerce.number(),
          }),
        )
        .optional(),
      link: z.string().optional(),
      tags: z.array(z.string()).optional(),
      image: z.string().optional(),
      originalImage: z.any().optional(),
      abv: z.union([z.literal(''), z.coerce.number().min(0, abvRangeMessage).max(100, abvRangeMessage)]),
      allergens: z.array(z.enum(ALLERGENS)),
      allergenSources: z.array(z.enum(ALLERGEN_SOURCES)),
      additives: z.array(z.enum(ADDITIVES)),
      guestInfoComplete: z.boolean(),
      hideOnGuestMenu: z.boolean(),
      guestName: z.string(),
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });
}

interface IngredientFormProps {
  ingredient?: IngredientDto;
  formRef?: React.RefObject<FormikProps<FormValue> | null>;
  /** Embedded use (e.g. "create ingredient" from the cocktail form): called instead of redirecting. */
  onSaved?: (id: string) => void;
}

interface FormUnitValue {
  unitId: string;
  volume: number;
}

export interface FormValue extends IngredientGuestInfoFormValues {
  name: string;
  shortName: string;
  notes: string;
  description: string;
  price: number | null;
  units: FormUnitValue[];
  link: string;
  tags: string[];
  image: string | undefined;
  originalImage?: File | undefined;
  fetchingExternalData?: boolean;
  volume?: number;
  selectedUnit?: string;
}

/** Persisted part of the values (mirrors `onSubmit`); the link import / volume inputs are UI-only state. */
function toComparableIngredient(values: FormValue) {
  return {
    name: trimmed(values.name),
    shortName: trimmed(values.shortName),
    notes: trimmed(values.notes),
    description: trimmed(values.description),
    price: values.price,
    units: values.units.map((unit) => ({ unitId: unit.unitId, volume: unit.volume })),
    link: trimmed(values.link),
    tags: values.tags,
    image: trimmed(values.image),
    abv: values.abv,
    allergens: [...values.allergens].sort(),
    allergenSources: [...values.allergenSources].sort(),
    additives: [...values.additives].sort(),
    guestInfoComplete: values.guestInfoComplete,
    hideOnGuestMenu: values.hideOnGuestMenu,
    guestName: trimmed(values.guestName),
  };
}

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['ingredient', 'common', 'entity', 'errors', 'guestInfo', 'cocktail']);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();

  const formRef = props.formRef || React.createRef<FormikProps<FormValue>>();
  const embedded = props.onSaved != undefined;

  const [loadingUnits, setUnitsLoading] = useState(false);
  const [allUnits, setAllUnits] = useState<UnitDto[]>([]);

  const [_loadingDefaultConversions, setLoadingDefaultConversions] = useState(false);
  const [defaultConversions, setDefaultConversions] = useState<UnitConversionDto[]>([]);

  const [similarIngredient, setSimilarIngredient] = useState<Pick<IngredientDto, 'id' | 'name'> | undefined>(undefined);

  const [similarLinkIngredient, setSimilarLinkIngredient] = useState<Pick<IngredientDto, 'id' | 'name'> | undefined>(undefined);

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.ingredient?.hasImage);
  const contentTranslations = useEntityContentTranslations('ingredient', props.ingredient?.id);

  useEffect(() => {
    fetchUnits(workspaceId, setAllUnits, setUnitsLoading);
    fetchUnitConversions(workspaceId, setLoadingDefaultConversions, setDefaultConversions);
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const hydrateImage = async () => {
      if (props.ingredient?.hasImage && props.ingredient.imageUrl) {
        setImageHydrationDone(false);
        const base64 = await fetchImageAsBase64(props.ingredient.imageUrl);
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
  }, [props.ingredient?.id, props.ingredient?.hasImage, props.ingredient?.imageUrl]);

  const mappedUnits: FormUnitValue[] = (props.ingredient?.volumes ?? []).map((volume) => ({
    unitId: volume.unit.id,
    volume: volume.volume,
  }));

  const initialValues: FormValue = {
    name: props.ingredient?.name ?? '',
    shortName: props.ingredient?.shortName ?? '',
    notes: props.ingredient?.notes ?? '',
    description: props.ingredient?.description ?? '',
    price: props.ingredient?.price ?? null,
    units: mappedUnits,
    link: props.ingredient?.link ?? '',
    tags: props.ingredient?.tags ?? [],
    image: hydratedImage,
    originalImage: hydratedImage ? convertBase64ToFile(hydratedImage) : undefined,
    abv: props.ingredient?.abv ?? '',
    allergens: props.ingredient?.allergens ?? [],
    allergenSources: props.ingredient?.allergenSources ?? [],
    additives: props.ingredient?.additives ?? [],
    guestInfoComplete: props.ingredient?.guestInfoComplete ?? false,
    hideOnGuestMenu: props.ingredient?.hideOnGuestMenu ?? false,
    guestName: props.ingredient?.guestName ?? '',
  };

  const ingredientId = props.ingredient?.id;

  const checkSimilarName = useCallback(
    async (name: string) => {
      if (!workspaceId) return;
      try {
        const match = await checkIngredientName(workspaceId, name);
        if (match != null && match.id != ingredientId) {
          setSimilarIngredient(match);
        } else {
          setSimilarIngredient(undefined);
        }
      } catch {
        setSimilarIngredient(undefined);
      }
    },
    [ingredientId, workspaceId],
  );

  const checkSimilarLink = useCallback(
    async (url: string) => {
      if (!workspaceId) return;
      try {
        const match = await checkIngredientLink(workspaceId, url);
        if (match != null && match.id != ingredientId) {
          setSimilarLinkIngredient(match);
        } else {
          setSimilarLinkIngredient(undefined);
        }
      } catch {
        setSimilarLinkIngredient(undefined);
      }
    },
    [ingredientId, workspaceId],
  );

  if (props.ingredient && !imageHydrationDone) {
    return (
      <div className="flex justify-center py-8">
        <Loading />
      </div>
    );
  }

  return (
    <Formik
      innerRef={formRef}
      initialValues={initialValues}
      onSubmit={async (values) => {
        if (!workspaceId) return;
        try {
          const body: IngredientCreateInput & IngredientUpdateInput = {
            name: values.name.trim(),
            shortName: values.shortName?.trim() == '' ? null : values.shortName?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            price: values.price === null || values.price === undefined || Number.isNaN(values.price) ? null : Number(values.price),
            // Always send volumes on update so an empty hydration cannot wipe IngredientVolume rows.
            units: (values.units || []).map((unit) => ({ unitId: unit.unitId, volume: Number(unit.volume) })),
            link: values.link?.trim() == '' ? null : values.link?.trim(),
            tags: values.tags,
            abv: parseOptionalPercent(values.abv),
            allergens: values.allergens,
            allergenSources: values.allergenSources,
            additives: values.additives,
            guestInfoComplete: values.guestInfoComplete,
            hideOnGuestMenu: values.hideOnGuestMenu,
            guestName: values.guestName.trim() == '' ? null : values.guestName.trim(),
          };
          if (props.ingredient?.id) {
            body.id = props.ingredient.id;
          }
          // Omitting `image` on update removes it; re-send hydrated/kept base64.
          if (values.image != undefined && values.image.trim() !== '') {
            body.image = values.image.trim();
          }
          if (props.ingredient == undefined) {
            const created = await createIngredient(workspaceId, body);
            await contentTranslations.save(created.id);
            if (props.onSaved != undefined) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('ingredient:success.created'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/ingredients`));
            }
          } else {
            await updateIngredient(workspaceId, props.ingredient.id, body);
            await contentTranslations.save(props.ingredient.id);
            if (props.onSaved != undefined) {
              props.onSaved(props.ingredient.id);
            } else {
              alertService.success(t('ingredient:success.saved'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/ingredients`));
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.ingredient == undefined ? t('ingredient:error.create') : t('ingredient:error.save'));
        }
      }}
      validate={(values) => {
        return zodFormikValidate(createIngredientFormSchema(t('errors:requiredField'), t('common:imageNotCropped'), t('guestInfo:form.abvRange')))(values);
      }}
    >
      {(formik) => {
        const { values, setFieldValue, setFieldError, handleChange, handleBlur, handleSubmit, submitForm } = formik;
        const nameError = visibleFieldError(formik, 'name');
        const priceError = visibleFieldError(formik, 'price');
        const tagsError = typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined;
        const unitName = (unitId: string) => userContext.getTranslation(allUnits.find((unit) => unit.id == unitId)?.name ?? 'N/A');
        const formatVolume = (volume: number) => volume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const volumeSuggestions = _.uniqBy(
          defaultConversions
            .filter((conversion) => values.units.map((u) => u.unitId).includes(conversion.fromUnitId))
            .filter((conversion) => !values.units.map((u) => u.unitId).includes(conversion.toUnitId))
            .map((suggestion) => {
              const fromUnit = values.units.find((u) => u.unitId == suggestion.fromUnitId);
              return {
                unitId: suggestion.toUnitId,
                volume: suggestion.factor * (fromUnit?.volume ?? 0),
              };
            }),
          (suggestion) => suggestion.unitId,
        );

        const checkValidationWarnings = (): string[] => {
          const warnings: string[] = [];
          if (!values.units || values.units.length === 0) {
            warnings.push(t('ingredient:warning.noVolumes'));
          }
          return warnings;
        };

        const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const warnings = checkValidationWarnings();
          if (warnings.length > 0) {
            modalContext.openModal(
              <FormValidationWarningModal
                warnings={warnings}
                onContinue={async () => {
                  await submitForm();
                }}
                onCancel={() => {
                  // Do nothing, just close modal
                }}
              />,
            );
          } else {
            await handleSubmit(e);
          }
        };

        return (
          <form onSubmit={handleFormSubmit} noValidate>
            <FormikDirtyReporter toComparable={toComparableIngredient} />
            <FormSaveButton label={props.ingredient ? t('common:save') : t('common:create')} />
            <EntityFormLayout embedded={embedded}>
              <FormSection title={t('common:form.section.general')}>
                <FormField
                  label={t('ingredient:importByLink')}
                  htmlFor="link"
                  warning={similarLinkIngredient ? t('ingredient:similarUrlExists', { name: similarLinkIngredient.name }) : undefined}
                >
                  <ButtonGroup className="w-full">
                    <Input
                      id={'link'}
                      name={'link'}
                      type={'url'}
                      inputMode={'url'}
                      autoComplete={'off'}
                      placeholder={'https://'}
                      joinItem
                      onChange={async (event) => {
                        checkSimilarLink(event.target.value);
                        handleChange(event);
                      }}
                      onBlur={handleBlur}
                      value={values.link}
                    />
                    <Button
                      variant="primary"
                      joinItem
                      type={'button'}
                      aria-label={t('ingredient:importByLink')}
                      title={t('ingredient:importByLink')}
                      disabled={
                        !(
                          values.link.includes('expert24.com') ||
                          values.link.includes('conalco.de') ||
                          values.link.includes('rumundco.de') ||
                          values.link.includes('delicando.com')
                        ) || values.fetchingExternalData
                      }
                      onClick={async () => {
                        await setFieldValue('fetchingExternalData', true);
                        fetch(`/api/scraper/ingredient?url=${values.link}`)
                          .then((response) => {
                            if (response.ok) {
                              response.json().then(async (data) => {
                                await setFieldValue('name', data.name);
                                if (data.price != 0) {
                                  await setFieldValue('price', data.price);
                                }

                                if (data.image) {
                                  try {
                                    const imageFile = convertBase64ToFile(data.image);
                                    // Automatisch das Bild zuschneiden (aspect 1:1 für quadratisch)
                                    const croppedImage = await autoCropImage(imageFile, 1, 'transparent');
                                    // Bild auf 400x400 skalieren
                                    resizeImage(croppedImage, 400, 400, async (compressedImageFile) => {
                                      if (compressedImageFile) {
                                        await setFieldValue(
                                          'image',
                                          await convertToBase64(new File([compressedImageFile], 'image.png', { type: 'image/png' })),
                                        );
                                        await setFieldValue('originalImage', imageFile);
                                      } else {
                                        alertService.error(t('ingredient:error.imageScale'));
                                      }
                                    });
                                  } catch (error) {
                                    console.error('Failed to auto-crop image:', error);
                                    alertService.error(t('ingredient:error.imageAutoCrop'));
                                  }
                                }
                                const selectedUnitId = allUnits.find((unit) => unit.name == 'CL')?.id ?? '';
                                checkSimilarName(data.name);

                                if (data.volume != 0 && selectedUnitId != '') {
                                  await setFieldValue('units', [{ unitId: selectedUnitId, volume: data.volume }]);
                                } else {
                                  if (data.volume != 0) {
                                    await setFieldValue('volume', data.volume);
                                  }
                                  await setFieldValue('selectedUnit', selectedUnitId);
                                }

                                alertService.info(t('ingredient:info.dataLoaded'));
                              });
                            } else {
                              alertService.warn(t('ingredient:warn.noUrlData'));
                            }
                          })
                          .finally(async () => {
                            await setFieldValue('fetchingExternalData', false);
                          });
                      }}
                    >
                      {values.fetchingExternalData ? <Loading size="sm" /> : <FaSyncAlt aria-hidden />}
                    </Button>
                  </ButtonGroup>
                </FormField>

                <div className="flex flex-col gap-4 @lg:flex-row @lg:items-start">
                  <FormikImageTile aspect={1} width={400} height={400} alt={t('common:ingredientImageAlt')} cropInfo={t('common:imageCropInfoLong')} />
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <FormField
                      label={t('ingredient:name')}
                      htmlFor="name"
                      required
                      error={nameError}
                      warning={similarIngredient ? t('ingredient:similarExists', { name: similarIngredient.name }) : undefined}
                    >
                      <TranslatedFieldTabs translations={contentTranslations} field="name" sourceValue={values.name}>
                        <Input
                          id={'name'}
                          name={'name'}
                          autoComplete={'off'}
                          enterKeyHint={'next'}
                          error={!!nameError}
                          onChange={(event) => {
                            if (event.target.value.length > 2) {
                              checkSimilarName(event.target.value);
                            } else {
                              setSimilarIngredient(undefined);
                            }
                            handleChange(event);
                          }}
                          onBlur={handleBlur}
                          value={values.name}
                        />
                      </TranslatedFieldTabs>
                    </FormField>

                    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                      <FormField label={t('ingredient:shortName')} htmlFor="shortName">
                        <Input id={'shortName'} name={'shortName'} autoComplete={'off'} onChange={handleChange} onBlur={handleBlur} value={values.shortName} />
                      </FormField>
                      <FormField label={t('ingredient:price')} htmlFor="price" error={priceError}>
                        <ButtonGroup className="w-full">
                          <Input
                            id={'price'}
                            name={'price'}
                            type={'number'}
                            inputMode={'decimal'}
                            step={'any'}
                            joinItem
                            error={!!priceError}
                            value={values.price ?? ''}
                            onChange={handleChange}
                            onBlur={handleBlur}
                          />
                          <InputAddon>€</InputAddon>
                        </ButtonGroup>
                      </FormField>
                    </div>
                  </div>
                </div>

                <FormField label={t('ingredient:tags')} error={tagsError}>
                  <TagInput
                    value={values.tags}
                    onChange={(tags) =>
                      setFieldValue(
                        'tags',
                        updateTags(tags, (text) => setFieldError('tags', text ?? t('common:tagInvalid'))),
                      )
                    }
                    validate={(tag) => validateTag(tag, (text) => setFieldError('tags', text ?? t('common:tagInvalid')))}
                  />
                </FormField>
              </FormSection>

              <FieldArray name={'units'}>
                {({ push: pushUnit, remove: removeUnit }) => (
                  <FormSection title={t('ingredient:volumes')} description={t('ingredient:volumesHint')}>
                    <ul className="divide-y divide-base-300 overflow-hidden rounded-lg border border-base-300 bg-base-100">
                      {values.units.length == 0 ? (
                        <li className="px-3 py-3 text-sm text-base-content/60">{t('ingredient:noUnitsAdded')}</li>
                      ) : (
                        (values.units as FormUnitValue[]).map((unit, index) => (
                          <li key={`selected-units-${unit.unitId}`} className="flex min-h-12 items-center gap-3 py-1 pr-1 pl-3">
                            <span className="min-w-0 flex-1 font-medium">
                              {formatVolume(unit.volume)} {unitName(unit.unitId)}
                            </span>
                            <span className="text-sm text-base-content/70 tabular-nums">
                              {values.price != undefined && typeof values.price === 'number'
                                ? (values.price / unit.volume).toFixed(2).replace(/\D00(?=\D*$)/, '')
                                : '-'}{' '}
                              {t('common:euroPerUnit', { unit: unitName(unit.unitId) })}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              shape="square"
                              className="text-error hover:bg-error/10"
                              aria-label={`${t('common:remove')}: ${formatVolume(unit.volume)} ${unitName(unit.unitId)}`}
                              onClick={() => removeUnit(index)}
                            >
                              <FaTrashAlt aria-hidden />
                            </Button>
                          </li>
                        ))
                      )}
                    </ul>

                    <FormField label={t('ingredient:addVolume')} htmlFor="anotherVolume">
                      <ButtonGroup className="w-full">
                        <Input
                          id={'anotherVolume'}
                          name={'volume'}
                          type={'number'}
                          inputMode={'decimal'}
                          step={'any'}
                          className="flex-[2]"
                          joinItem
                          value={values.volume ?? ''}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                        <Select
                          aria-label={t('cocktail:unit')}
                          className="flex-[3]"
                          joinItem
                          onChange={handleChange}
                          onBlur={handleBlur}
                          name={'selectedUnit'}
                          value={values.selectedUnit ?? ''}
                        >
                          {loadingUnits ? (
                            <option value={''} disabled={true}>
                              {t('common:loadingShort')}
                            </option>
                          ) : allUnits.length == 0 ? (
                            <option value={''}>{t('ingredient:noUnitsAvailable')}</option>
                          ) : (
                            <>
                              <option value={''} disabled>
                                {t('common:selectEllipsis')}
                              </option>
                              {allUnits
                                .sort((a, b) => userContext.getTranslation(a.name).localeCompare(userContext.getTranslation(b.name)))
                                .map((unit) => (
                                  <option
                                    key={`unit-option-${unit.id}`}
                                    value={unit.id}
                                    disabled={(values.units as FormUnitValue[]).find((u) => u.unitId == unit.id) != undefined}
                                  >
                                    {userContext.getTranslation(unit.name)}
                                  </option>
                                ))}
                            </>
                          )}
                        </Select>
                        <Button
                          variant="primary"
                          joinItem
                          type={'button'}
                          disabled={
                            loadingUnits || !values.volume || values.selectedUnit == '' || isNaN(values.volume ?? 0) || values.selectedUnit == undefined
                          }
                          onClick={async () => {
                            const volume = values.volume ?? 0;
                            pushUnit({ unitId: values.selectedUnit ?? '', volume } as FormUnitValue);
                            await setFieldValue('selectedUnit', '');
                          }}
                        >
                          <FaPlus aria-hidden />
                          {t('common:add')}
                        </Button>
                      </ButtonGroup>
                    </FormField>

                    {volumeSuggestions.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t('ingredient:volumeSuggestions')}</span>
                        <div className="flex flex-wrap gap-2">
                          {volumeSuggestions.map((suggestion) => (
                            <Button
                              key={`unit-conversion-suggestion-${suggestion.unitId}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => pushUnit(suggestion)}
                            >
                              <FaPlus aria-hidden />
                              {suggestion.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')} {unitName(suggestion.unitId)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </FormSection>
                )}
              </FieldArray>

              <FormSection title={t('common:form.section.texts')}>
                <FormField label={t('ingredient:description')} htmlFor="description">
                  <TranslatedFieldTabs translations={contentTranslations} field="description" sourceValue={values.description} multiline>
                    <Textarea
                      id={'description'}
                      name={'description'}
                      value={values.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder={t('ingredient:descriptionPlaceholder')}
                      rows={4}
                    />
                  </TranslatedFieldTabs>
                </FormField>
                <FormField label={t('ingredient:notes')} htmlFor="notes">
                  <Textarea
                    id={'notes'}
                    name={'notes'}
                    value={values.notes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t('ingredient:notesPlaceholder')}
                    rows={3}
                  />
                </FormField>
              </FormSection>

              <FormSection title={t('guestInfo:form.sectionTitle')} description={t('guestInfo:form.sectionHint')}>
                <IngredientGuestInfoFields
                  wrapGuestName={(input) => (
                    <TranslatedFieldTabs translations={contentTranslations} field="guestName" sourceValue={values.guestName}>
                      {input}
                    </TranslatedFieldTabs>
                  )}
                />
              </FormSection>
            </EntityFormLayout>
          </form>
        );
      }}
    </Formik>
  );
}
