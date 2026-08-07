import { FieldArray, Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64, fetchImageAsBase64 } from '@lib/Base64Converter';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import type { IngredientCreateInput, IngredientDto, IngredientUpdateInput } from '@lib/schemas/ingredients';
import type { UnitDto, UnitConversionDto } from '@lib/schemas/units';
import { UserContext } from '@lib/context/UserContextProvider';
import { fetchUnitConversions, fetchUnits } from '@lib/network/units';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkIngredientLink, checkIngredientName, createIngredient, updateIngredient } from '@lib/network/ingredients';
import Image from 'next/image';
import { TagInput } from '../TagInput';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import '../../lib/ArrayUtils';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { autoCropImage } from '@lib/ImageUtils';
import { FormValidationWarningModal } from '../modals/FormValidationWarningModal';
import {
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  Input,
  Label,
  LabelText,
  LabelTextAlt,
  Loading,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
} from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

function createIngredientFormSchema(requiredMessage: string, imageNotCroppedMessage: string) {
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
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });
}

interface IngredientFormProps {
  ingredient?: IngredientDto;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<FormValue> | null>;
  onSaved?: (id: string) => void;
}

interface FormUnitValue {
  unitId: string;
  volume: number;
}

export interface FormValue {
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

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['ingredient', 'common', 'entity', 'errors']);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef || React.createRef<FormikProps<FormValue>>();

  const [loadingUnits, setUnitsLoading] = useState(false);
  const [allUnits, setAllUnits] = useState<UnitDto[]>([]);

  const [_loadingDefaultConversions, setLoadingDefaultConversions] = useState(false);
  const [defaultConversions, setDefaultConversions] = useState<UnitConversionDto[]>([]);

  const [similarIngredient, setSimilarIngredient] = useState<Pick<IngredientDto, 'id' | 'name'> | undefined>(undefined);

  const [similarLinkIngredient, setSimilarLinkIngredient] = useState<Pick<IngredientDto, 'id' | 'name'> | undefined>(undefined);

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.ingredient?.hasImage);

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
            if (props.onSaved != undefined) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('ingredient:success.created'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/ingredients`);
            }
          } else {
            await updateIngredient(workspaceId, props.ingredient.id, body);
            if (props.onSaved != undefined) {
              props.onSaved(props.ingredient.id);
            } else {
              alertService.success(t('ingredient:success.saved'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/ingredients`);
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.ingredient == undefined ? t('ingredient:error.create') : t('ingredient:error.save'));
        }
      }}
      validate={(values) => {
        if (props.ingredient) {
          const reducedOriginal = {
            name: props.ingredient.name,
            shortName: props.ingredient.shortName ?? '',
            notes: props.ingredient.notes ?? '',
            description: props.ingredient.description ?? '',
            price: props.ingredient.price,
            units: mappedUnits,
            link: props.ingredient.link ?? '',
            tags: props.ingredient.tags,
          };
          const reducedValues = _.omit(values, ['image', 'originalImage', 'fetchingExternalData', 'volume', 'selectedUnit']);

          const areImageEqual = hydratedImage == values.image;
          props.setUnsavedChanges?.(!_.isEqual(reducedOriginal, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }
        return zodFormikValidate(createIngredientFormSchema(t('errors:requiredField'), t('common:imageNotCropped')))(values);
      }}
    >
      {({ values, setFieldValue, errors, setFieldError, handleChange, handleBlur, handleSubmit, isSubmitting, isValid, submitForm }) => {
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
          <form onSubmit={handleFormSubmit} className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
            <FormControl className={'col-span-full'}>
              <Label htmlFor={'link'} className="flex-row items-center justify-between">
                <LabelText>{t('ingredient:importByLink')}</LabelText>
                <LabelTextAlt className={'space-x-2 text-error'}>
                  <span>
                    <>{errors.link && errors.link}</>
                  </span>
                </LabelTextAlt>
              </Label>
              <ButtonGroup>
                <Input
                  id={'link'}
                  type={'text'}
                  placeholder={''}
                  className={errors.link ? fieldErrorClass : undefined}
                  joinItem
                  onChange={async (event) => {
                    checkSimilarLink(event.target.value);
                    handleChange(event);
                  }}
                  onBlur={handleBlur}
                  value={values.link}
                  name={'link'}
                />
                <Button
                  variant="primary"
                  joinItem
                  type={'button'}
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
                                    await setFieldValue('image', await convertToBase64(new File([compressedImageFile], 'image.png', { type: 'image/png' })));
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
                  {values.fetchingExternalData ? <Loading size="sm" /> : null}
                  <FaSyncAlt />
                </Button>
              </ButtonGroup>
              {similarLinkIngredient && (
                <Label className="flex-row">
                  <LabelTextAlt className="text-warning">{t('ingredient:similarUrlExists', { name: similarLinkIngredient.name })}</LabelTextAlt>
                </Label>
              )}
            </FormControl>

            <Divider size="sm" className={'col-span-full'} />

            <div className={'grid grid-cols-1 gap-2 xl:grid-cols-2'}>
              <FormControl className={'col-span-full'}>
                <Label htmlFor={'name'} className="flex-row items-center justify-between">
                  <LabelText>{t('ingredient:name')}</LabelText>
                  <LabelTextAlt className={'space-x-2 text-error'}>
                    <span>
                      <>{errors.name && errors.name}</>
                    </span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <Input
                  id={'name'}
                  type={'text'}
                  autoComplete={'off'}
                  className={errors.name ? fieldErrorClass : undefined}
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
                  name={'name'}
                />
                {similarIngredient && (
                  <Label className="flex-row">
                    <LabelTextAlt className="text-warning">{t('ingredient:similarExists', { name: similarIngredient.name })}</LabelTextAlt>
                  </Label>
                )}
              </FormControl>
              <div className={'flex flex-col gap-2'}>
                <FormControl>
                  <Label htmlFor={'shortName'} className="flex-row items-center justify-between">
                    <LabelText>{t('ingredient:shortName')}</LabelText>
                    <LabelTextAlt className={'space-x-2 text-error'}>
                      <span>
                        <>{errors.shortName && errors.shortName}</>
                      </span>
                    </LabelTextAlt>
                  </Label>
                  <Input
                    id={'shortName'}
                    type={'text'}
                    className={errors.shortName ? fieldErrorClass : undefined}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.shortName}
                    name={'shortName'}
                  />
                </FormControl>
                <FormControl>
                  <Label htmlFor={'price'} className="flex-row items-center justify-between">
                    <LabelText>{t('ingredient:price')}</LabelText>
                    <LabelTextAlt className={'space-x-2 text-error'}>
                      <span>
                        <>{errors.price && errors.price}</>
                      </span>
                    </LabelTextAlt>
                  </Label>
                  <ButtonGroup className="w-full">
                    <Input
                      id={'price'}
                      type={'number'}
                      className={errors.price ? fieldErrorClass : undefined}
                      joinItem
                      value={values.price ?? ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'price'}
                    />
                    <Button type="button" variant="secondary" joinItem>
                      €
                    </Button>
                  </ButtonGroup>
                </FormControl>
              </div>
              <div>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('ingredient:tags')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <>{errors.tags && errors.tags}</>
                  </LabelTextAlt>
                </Label>
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
              </div>

              <FieldArray name={'units'}>
                {({ push: pushUnit, remove: removeUnit }) => (
                  <>
                    <div>
                      <LabelText>{t('ingredient:volumes')}</LabelText>
                      <div className={'overflow-x-auto'}>
                        <Table zebra className="bg-base-300">
                          <TableHead>
                            <TableRow>
                              <TableHeaderCell colSpan={4}>{t('ingredient:availableUnits')}</TableHeaderCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {values.units.length == 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className={'text-center'}>
                                  {t('ingredient:noUnitsAdded')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              (values.units as FormUnitValue[]).map((unit, index) => (
                                <TableRow key={`selected-units-${unit.unitId}`}>
                                  <TableCell>
                                    {unit.volume.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    {userContext.getTranslation(allUnits.find((availableUnit) => availableUnit.id == unit.unitId)?.name ?? 'N/A')}
                                  </TableCell>
                                  <TableCell>
                                    {values.price != undefined && typeof values.price === 'number'
                                      ? (values.price / unit.volume).toFixed(2).replace(/\D00(?=\D*$)/, '')
                                      : '-'}{' '}
                                    {t('common:euroPerUnit', {
                                      unit: userContext.getTranslation(allUnits.find((availableUnit) => availableUnit.id == unit.unitId)?.name ?? 'N/A'),
                                    })}
                                  </TableCell>
                                  <TableCell className={'flex flex-row items-center justify-center'}>
                                    <Button
                                      type="button"
                                      variant="error"
                                      shape="square"
                                      size="sm"
                                      onClick={() => {
                                        removeUnit(index);
                                      }}
                                    >
                                      <FaTrashAlt />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div>
                      <FormControl>
                        <Label htmlFor={'anotherVolume'} className="flex-row items-center justify-between">
                          <LabelText>{t('ingredient:addVolume')}</LabelText>
                          <LabelTextAlt className={'space-x-2 text-error'}>
                            <span>
                              <>{errors.volume && errors.volume}</>
                            </span>
                            <span>*</span>
                          </LabelTextAlt>
                        </Label>
                        <ButtonGroup className="w-full">
                          <Input
                            id={'anotherVolume'}
                            type={'number'}
                            inputSize="sm"
                            className={errors.volume ? fieldErrorClass : undefined}
                            joinItem
                            value={values.volume}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            name={'volume'}
                          />
                          <Select
                            selectSize="sm"
                            className={errors.selectedUnit ? `${fieldErrorClass} flex-1` : 'flex-1'}
                            joinItem
                            onChange={handleChange}
                            onBlur={handleBlur}
                            name={'selectedUnit'}
                            value={values.selectedUnit}
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
                            size="sm"
                            joinItem
                            type={'button'}
                            disabled={
                              loadingUnits || values.volume == 0 || values.selectedUnit == '' || isNaN(values.volume ?? 0) || values.selectedUnit == undefined
                            }
                            onClick={async () => {
                              const volume = values.volume ?? 0;
                              pushUnit({ unitId: values.selectedUnit ?? '', volume } as FormUnitValue);
                              await setFieldValue('selectedUnit', '');
                            }}
                          >
                            {t('common:add')}
                          </Button>
                        </ButtonGroup>
                      </FormControl>
                      <div>
                        <LabelText>{t('ingredient:volumeSuggestions')}</LabelText>
                        <ul className={'list-inside list-disc'}>
                          {_.uniqBy(
                            defaultConversions
                              .filter((conversion) => (formRef?.current?.values.units as FormUnitValue[]).map((u) => u.unitId).includes(conversion.fromUnitId))
                              .filter((conversion) => !(formRef?.current?.values.units as FormUnitValue[]).map((u) => u.unitId).includes(conversion.toUnitId))
                              .map((suggestion) => {
                                const fromUnit = (formRef?.current?.values.units as FormUnitValue[]).find((u) => u.unitId == suggestion.fromUnitId);
                                return {
                                  unitId: suggestion.toUnitId,
                                  volume: suggestion.factor * (fromUnit?.volume ?? 0),
                                };
                              }),
                            function (e) {
                              return e.unitId;
                            },
                          ).mapWithFallback(
                            (suggestion, suggestionIndex) => (
                              <li key={`unit-conversion-suggestion-${suggestionIndex}`} className={'space-x-2 italic'}>
                                <span className={'p-2'}>{suggestion.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')}</span>
                                <span className={'p-2'}>
                                  {userContext.getTranslation(allUnits.find((unit) => unit.id == suggestion.unitId)?.name ?? 'N/A')}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    pushUnit(suggestion);
                                  }}
                                >
                                  {t('common:add')}
                                </Button>
                              </li>
                            ),
                            <div className={'italic'}>{t('ingredient:noMoreSuggestions')}</div>,
                          )}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </FieldArray>

              <div className={'col-span-full'}>
                <div className="flex items-center gap-3 py-2">
                  <Divider className="my-0 flex-1" />
                  <span className="shrink-0 text-sm font-medium text-base-content/70">{t('common:imagePreview')}</span>
                  <Divider className="my-0 flex-1" />
                </div>
                {values.image == undefined && values.originalImage == undefined ? (
                  <UploadDropZone
                    onSelectedFilesChanged={async (file) => {
                      if (file != undefined) {
                        await setFieldValue('image', undefined);
                        await setFieldValue('originalImage', file);
                      } else {
                        alertService.error(t('ingredient:error.fileSelect'));
                      }
                    }}
                  />
                ) : values.image == undefined && values.originalImage != undefined ? (
                  <div className={'w-full'}>
                    <CropComponent
                      isValid={isValid}
                      aspect={1}
                      imageToCrop={values.originalImage}
                      onCroppedImageComplete={async (file) => {
                        resizeImage(file, 400, 400, async (compressedImageFile) => {
                          if (compressedImageFile) {
                            await setFieldValue('image', await convertToBase64(new File([compressedImageFile], 'image.png', { type: 'image/png' })));
                          } else {
                            alertService.error(t('ingredient:error.imageScale'));
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
                  <div className={'w-full'}>
                    <div className={'relative'}>
                      <div className={'absolute top-2 right-2 z-20 flex flex-row gap-2'}>
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
                                entityName={t('entity:theImage')}
                                onApprove={async () => {
                                  await setFieldValue('originalImage', undefined);
                                  await setFieldValue('image', undefined);
                                }}
                              />,
                            )
                          }
                        >
                          <FaTrashAlt />
                        </Button>
                      </div>
                      <div className={'bg-transparent-pattern relative h-32 w-32 rounded-lg'}>
                        <Image
                          className={'w-fit rounded-lg'}
                          src={values.image ?? ''}
                          layout={'fill'}
                          objectFit={'contain'}
                          alt={t('common:ingredientImageAlt')}
                        />
                      </div>
                      <div className={'pt-2 font-thin italic'}>{t('common:imageCropInfoLong')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={'flex h-full flex-col gap-2'}>
              <FormControl className={'col-span-full'}>
                <Label htmlFor={'description'} className="flex-row items-center justify-between">
                  <LabelText>{t('ingredient:description')}</LabelText>
                  <LabelTextAlt className={'space-x-2 text-error'}>
                    <span>
                      <>{errors.description && errors.description}</>
                    </span>
                  </LabelTextAlt>
                </Label>
                <Textarea
                  id={'description'}
                  className={errors.description ? fieldErrorClass : undefined}
                  value={values.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  name={'description'}
                  placeholder={t('ingredient:descriptionPlaceholder')}
                  rows={5}
                />
              </FormControl>

              <FormControl className={'col-span-full'}>
                <Label htmlFor={'notes'} className="flex-row items-center justify-between">
                  <LabelText>{t('ingredient:notes')}</LabelText>
                  <LabelTextAlt className={'space-x-2 text-error'}>
                    <span>
                      <>{errors.notes && errors.notes}</>
                    </span>
                  </LabelTextAlt>
                </Label>
                <Textarea
                  id={'notes'}
                  className={errors.notes ? fieldErrorClass : undefined}
                  value={values.notes}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  name={'notes'}
                  placeholder={t('ingredient:notesPlaceholder')}
                  rows={5}
                />
              </FormControl>
              <div className={'flex-grow'}></div>
              <div className={'col-span-full'}>
                <FormControl>
                  <Button type={'submit'} variant="primary" disabled={isSubmitting || !isValid}>
                    {isSubmitting ? <Loading size="sm" /> : null}
                    {t('common:save')}
                  </Button>
                </FormControl>
                {!isValid && <div className={'font-thin text-error italic'}>{t('common:formIncomplete')}</div>}
              </div>
            </div>
          </form>
        );
      }}
    </Formik>
  );
}
