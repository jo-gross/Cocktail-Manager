import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertBase64ToFile, fetchImageAsBase64 } from '@lib/Base64Converter';
import { alertService } from '@lib/alertService';
import type { GarnishCreateInput, GarnishDto, GarnishUpdateInput } from '@lib/schemas/garnishes';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { FormikDirtyReporter } from '@lib/forms/FormikDirtyReporter';
import { trimmed } from '@lib/forms/formDirty';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import { ButtonGroup, Input, InputAddon, Loading, Textarea } from '@components/ui';
import { EntityFormLayout } from '@components/forms/EntityFormLayout';
import { FormSection } from '@components/forms/FormSection';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { FormSaveButton } from '@components/forms/FormSaveButton';
import { FormikImageTile } from '@components/forms/FormikImageTile';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkGarnishName, createGarnish, updateGarnish } from '@lib/network/garnishes';
import { TranslatedFieldTabs } from '@components/translations/TranslatedFieldTabs';
import { useEntityContentTranslations } from '@components/translations/useEntityContentTranslations';
import { GarnishGuestInfoFields, type GarnishGuestInfoFormValues } from '@components/guest-info/GuestInfoFormFields';
import { ADDITIVES, ALLERGEN_SOURCES, ALLERGENS } from '@lib/guest-info/constants';

export interface GarnishFormValues extends GarnishGuestInfoFormValues {
  name: string;
  price: number | undefined | string;
  description: string;
  notes: string;
  image: string | undefined;
  originalImage: File | undefined;
}

function createGarnishFormSchema(requiredMessage: string, imageNotCroppedMessage: string) {
  return z
    .object({
      name: z.string().min(1, requiredMessage),
      price: z.union([z.coerce.number(), z.literal(''), z.undefined()]).optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
      image: z.string().optional(),
      originalImage: z.instanceof(File).optional(),
      allergens: z.array(z.enum(ALLERGENS)),
      allergenSources: z.array(z.enum(ALLERGEN_SOURCES)),
      additives: z.array(z.enum(ADDITIVES)),
      guestInfoComplete: z.boolean(),
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });
}

interface GarnishFormProps {
  garnish?: GarnishDto;
  formRef?: React.RefObject<FormikProps<GarnishFormValues> | null>;
  /** Embedded use (e.g. "create garnish" from the cocktail form): called instead of redirecting. */
  onSaved?: (id: string) => void;
}

/** Persisted part of the values (mirrors `onSubmit`). */
function toComparableGarnish(values: GarnishFormValues) {
  return {
    name: values.name,
    price: values.price,
    description: trimmed(values.description),
    notes: trimmed(values.notes),
    image: values.image,
    allergens: [...values.allergens].sort(),
    allergenSources: [...values.allergenSources].sort(),
    additives: [...values.additives].sort(),
    guestInfoComplete: values.guestInfoComplete,
  };
}

export function GarnishForm(props: GarnishFormProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors', 'guestInfo']);
  const router = useRouter();
  const { workspaceId } = router.query;
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();

  const formRef = props.formRef || React.createRef<FormikProps<GarnishFormValues>>();
  const embedded = props.onSaved != undefined;

  const [similarGarnish, setSimilarGarnish] = useState<Pick<GarnishDto, 'id' | 'name'> | undefined>();

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.garnish?.hasImage);
  const contentTranslations = useEntityContentTranslations('garnish', props.garnish?.id);

  useEffect(() => {
    let cancelled = false;
    const hydrateImage = async () => {
      if (props.garnish?.hasImage && props.garnish.imageUrl) {
        setImageHydrationDone(false);
        const base64 = await fetchImageAsBase64(props.garnish.imageUrl);
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
  }, [props.garnish?.id, props.garnish?.hasImage, props.garnish?.imageUrl]);

  if (props.garnish && !imageHydrationDone) {
    return (
      <div className="flex justify-center py-8">
        <Loading />
      </div>
    );
  }

  return (
    <Formik<GarnishFormValues>
      innerRef={formRef}
      initialValues={{
        name: props.garnish?.name ?? '',
        price: props.garnish?.price ?? undefined,
        description: props.garnish?.description ?? '',
        notes: props.garnish?.notes ?? '',
        image: hydratedImage,
        originalImage: hydratedImage ? convertBase64ToFile(hydratedImage) : undefined,
        allergens: props.garnish?.allergens ?? [],
        allergenSources: props.garnish?.allergenSources ?? [],
        additives: props.garnish?.additives ?? [],
        guestInfoComplete: props.garnish?.guestInfoComplete ?? false,
      }}
      onSubmit={async (values) => {
        if (!workspaceId) return;
        try {
          const body: GarnishCreateInput & GarnishUpdateInput = {
            name: values.name,
            price: values.price === '' || values.price === undefined ? null : Number(values.price),
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
            allergens: values.allergens,
            allergenSources: values.allergenSources,
            additives: values.additives,
            guestInfoComplete: values.guestInfoComplete,
          };
          if (props.garnish?.id) {
            body.id = props.garnish.id;
          }
          // Omitting `image` on update removes it; re-send hydrated/kept base64.
          if (values.image != undefined && values.image !== '') {
            body.image = values.image;
          }
          if (props.garnish == undefined) {
            const created = await createGarnish(workspaceId, body);
            await contentTranslations.save(created.id);
            if (props.onSaved != undefined) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('manage:garnishForm.success.created'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`));
            }
          } else {
            await updateGarnish(workspaceId, props.garnish.id, body);
            await contentTranslations.save(props.garnish.id);
            if (props.onSaved != undefined) {
              props.onSaved(props.garnish.id);
            } else {
              alertService.success(t('manage:garnishForm.success.saved'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`));
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.garnish == undefined ? t('manage:garnishForm.error.create') : t('manage:garnishForm.error.save'));
        }
      }}
      validate={(values) => {
        return zodFormikValidate(createGarnishFormSchema(t('errors:requiredField'), t('common:imageNotCropped')))(values);
      }}
    >
      {(formik) => {
        const { values, handleChange, handleBlur, handleSubmit } = formik;
        const nameError = visibleFieldError(formik, 'name');
        const priceError = visibleFieldError(formik, 'price');
        return (
          <form onSubmit={handleSubmit} noValidate>
            <FormikDirtyReporter toComparable={toComparableGarnish} />
            <FormSaveButton label={props.garnish ? t('common:save') : t('common:create')} />
            <EntityFormLayout embedded={embedded}>
              <FormSection title={t('common:form.section.general')}>
                <div className="flex flex-col gap-4 @lg:flex-row @lg:items-start">
                  <FormikImageTile aspect={1} width={400} height={400} alt={t('common:garnishImageAlt')} cropInfo={t('manage:garnishForm.imageCropInfo')} />
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_12rem]">
                      <FormField
                        label={t('common:name')}
                        htmlFor="name"
                        required
                        error={nameError}
                        warning={similarGarnish ? t('manage:garnishForm.similarExists', { name: similarGarnish.name }) : undefined}
                      >
                        <TranslatedFieldTabs translations={contentTranslations} field="name" sourceValue={values.name}>
                          <Input
                            id={'name'}
                            name={'name'}
                            autoComplete={'off'}
                            enterKeyHint={'next'}
                            error={!!nameError}
                            value={values.name}
                            onChange={(event) => {
                              if (event.target.value.length > 2 && workspaceId) {
                                checkGarnishName(workspaceId, event.target.value)
                                  .then((match) => {
                                    if (match != null && match.id != props.garnish?.id) {
                                      setSimilarGarnish(match);
                                    } else {
                                      setSimilarGarnish(undefined);
                                    }
                                  })
                                  .catch(() => setSimilarGarnish(undefined));
                              } else {
                                setSimilarGarnish(undefined);
                              }
                              handleChange(event);
                            }}
                            onBlur={handleBlur}
                          />
                        </TranslatedFieldTabs>
                      </FormField>
                      <FormField label={t('common:price')} htmlFor="price" error={priceError}>
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
              </FormSection>

              <FormSection title={t('common:form.section.texts')}>
                <FormField label={t('manage:garnishForm.description')} htmlFor="description">
                  <TranslatedFieldTabs translations={contentTranslations} field="description" sourceValue={values.description} multiline>
                    <Textarea
                      id={'description'}
                      name={'description'}
                      value={values.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder={t('manage:garnishForm.descriptionPlaceholder')}
                      rows={4}
                    />
                  </TranslatedFieldTabs>
                </FormField>
                <FormField label={t('common:notes')} htmlFor="notes">
                  <Textarea
                    id={'notes'}
                    name={'notes'}
                    value={values.notes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t('manage:garnishForm.notesPlaceholder')}
                    rows={3}
                  />
                </FormField>
              </FormSection>

              <FormSection title={t('guestInfo:form.sectionTitle')} description={t('guestInfo:form.sectionHint')}>
                <GarnishGuestInfoFields />
              </FormSection>
            </EntityFormLayout>
          </form>
        );
      }}
    </Formik>
  );
}
