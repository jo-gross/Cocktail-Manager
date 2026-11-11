import { Formik, FormikProps } from 'formik';
import { convertBase64ToFile, fetchImageAsBase64 } from '@lib/Base64Converter';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '@lib/alertService';
import type { GlassDto } from '@lib/schemas/glasses';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { FormikDirtyReporter } from '@lib/forms/FormikDirtyReporter';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import { ButtonGroup, Input, InputAddon, Loading } from '@components/ui';
import { EntityFormLayout } from '@components/forms/EntityFormLayout';
import { FormSection } from '@components/forms/FormSection';
import { FormField, visibleFieldError } from '@components/forms/FormField';
import { FormSaveButton } from '@components/forms/FormSaveButton';
import { FormikImageTile } from '@components/forms/FormikImageTile';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkGlassName, createGlass, updateGlass } from '@lib/network/glasses';
import { TranslatedFieldTabs } from '@components/translations/TranslatedFieldTabs';
import { useEntityContentTranslations } from '@components/translations/useEntityContentTranslations';
import type { GlassCreateInput, GlassUpdateInput } from '@lib/schemas/glasses';

export interface GlassFormValues {
  name: string;
  deposit: number;
  image: string | undefined;
  originalImage: File | undefined;
  volume: number;
}

function createGlassFormSchema(requiredMessage: string, imageNotCroppedMessage: string) {
  return z
    .object({
      name: z.string().min(1, requiredMessage),
      deposit: z.number(),
      volume: z.number(),
      image: z.string().optional(),
      originalImage: z.any().optional(),
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });
}

interface GlassFormProps {
  glass?: GlassDto;
  formRef?: React.RefObject<FormikProps<GlassFormValues> | null>;
  /** Embedded use (e.g. "create glass" from the cocktail form): called instead of redirecting. */
  onSaved?: (id: string) => void;
}

/** Persisted part of the values (mirrors `onSubmit`, where volume 0 means "no volume"). */
function toComparableGlass(values: GlassFormValues) {
  return {
    name: values.name,
    deposit: values.deposit,
    volume: values.volume == 0 ? undefined : values.volume,
    image: values.image,
  };
}

export function GlassForm(props: GlassFormProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;
  const routingContext = useContext(RoutingContext);
  const unsavedChanges = useUnsavedChangesContext();

  const formRef = props.formRef;
  const embedded = props.onSaved != undefined;

  const [similarGlass, setSimilarGlass] = useState<Pick<GlassDto, 'id' | 'name'> | undefined>(undefined);

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.glass?.hasImage);
  const contentTranslations = useEntityContentTranslations('glass', props.glass?.id);

  useEffect(() => {
    let cancelled = false;
    const hydrateImage = async () => {
      if (props.glass?.hasImage && props.glass.imageUrl) {
        setImageHydrationDone(false);
        const base64 = await fetchImageAsBase64(props.glass.imageUrl);
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
  }, [props.glass?.id, props.glass?.hasImage, props.glass?.imageUrl]);

  if (props.glass && !imageHydrationDone) {
    return (
      <div className="flex justify-center py-8">
        <Loading />
      </div>
    );
  }

  return (
    <Formik<GlassFormValues>
      innerRef={formRef}
      initialValues={{
        name: props.glass?.name ?? '',
        deposit: props.glass?.deposit ?? 0,
        image: hydratedImage,
        originalImage: hydratedImage ? convertBase64ToFile(hydratedImage) : undefined,
        volume: props.glass?.volume ?? 0,
      }}
      onSubmit={async (values) => {
        if (!workspaceId) return;
        try {
          const body: GlassCreateInput & GlassUpdateInput = {
            name: values.name,
            deposit: values.deposit ?? 0,
            volume: values.volume == 0 ? undefined : values.volume,
          };
          if (props.glass?.id) {
            body.id = props.glass.id;
          }
          // Omitting `image` on update removes it; re-send hydrated/kept base64.
          if (values.image != undefined && values.image !== '') {
            body.image = values.image;
          }
          if (props.glass == undefined) {
            const created = await createGlass(workspaceId, body);
            await contentTranslations.save(created.id);
            if (props.onSaved) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('manage:glassForm.success.created'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`));
            }
          } else {
            await updateGlass(workspaceId, props.glass.id, body);
            await contentTranslations.save(props.glass.id);
            if (props.onSaved) {
              props.onSaved(props.glass.id);
            } else {
              alertService.success(t('manage:glassForm.success.saved'));
              await unsavedChanges.completeSave(() => routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`));
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.glass == undefined ? t('manage:glassForm.error.create') : t('manage:glassForm.error.save'));
        }
      }}
      validate={(values) => {
        return zodFormikValidate(createGlassFormSchema(t('errors:requiredField'), t('common:imageNotCropped')))(values);
      }}
    >
      {(formik) => {
        const { values, handleChange, handleBlur, handleSubmit } = formik;
        const nameError = visibleFieldError(formik, 'name');
        const depositError = visibleFieldError(formik, 'deposit');
        const volumeError = visibleFieldError(formik, 'volume');
        return (
          <form onSubmit={handleSubmit} noValidate>
            <FormikDirtyReporter toComparable={toComparableGlass} />
            <FormSaveButton label={props.glass ? t('common:save') : t('common:create')} />
            <EntityFormLayout embedded={embedded}>
              <FormSection title={t('common:form.section.general')}>
                <div className="flex flex-col gap-4 @lg:flex-row @lg:items-start">
                  <FormikImageTile aspect={1} width={400} height={400} alt={t('common:glassImageAlt')} cropInfo={t('manage:glassForm.imageCropInfo')} />
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <FormField
                      label={t('common:name')}
                      htmlFor="name"
                      required
                      error={nameError}
                      warning={similarGlass ? t('manage:glassForm.similarExists', { name: similarGlass.name }) : undefined}
                    >
                      <TranslatedFieldTabs translations={contentTranslations} field="name" sourceValue={values.name}>
                        <Input
                          id={'name'}
                          name={'name'}
                          value={values.name}
                          autoComplete={'off'}
                          enterKeyHint={'next'}
                          error={!!nameError}
                          onChange={(event) => {
                            if (event.target.value.length > 2 && workspaceId) {
                              checkGlassName(workspaceId, event.target.value)
                                .then((match) => {
                                  if (match != null && match.id != props.glass?.id) {
                                    setSimilarGlass(match);
                                  } else {
                                    setSimilarGlass(undefined);
                                  }
                                })
                                .catch(() => setSimilarGlass(undefined));
                            } else {
                              setSimilarGlass(undefined);
                            }
                            handleChange(event);
                          }}
                          onBlur={handleBlur}
                        />
                      </TranslatedFieldTabs>
                    </FormField>
                    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                      <FormField label={t('common:deposit')} htmlFor="deposit" error={depositError}>
                        <ButtonGroup className="w-full">
                          <Input
                            id={'deposit'}
                            name={'deposit'}
                            type={'number'}
                            inputMode={'decimal'}
                            step={'any'}
                            joinItem
                            error={!!depositError}
                            value={values.deposit}
                            onChange={handleChange}
                            onBlur={handleBlur}
                          />
                          <InputAddon>€</InputAddon>
                        </ButtonGroup>
                      </FormField>
                      <FormField label={t('common:volume')} htmlFor="volume" error={volumeError}>
                        <ButtonGroup className="w-full">
                          <Input
                            id={'volume'}
                            name={'volume'}
                            type={'number'}
                            inputMode={'decimal'}
                            step={'any'}
                            placeholder={'38'}
                            joinItem
                            error={!!volumeError}
                            value={values.volume}
                            onChange={handleChange}
                            onBlur={handleBlur}
                          />
                          <InputAddon>{t('common:cl')}</InputAddon>
                        </ButtonGroup>
                      </FormField>
                    </div>
                  </div>
                </div>
              </FormSection>
            </EntityFormLayout>
          </form>
        );
      }}
    </Formik>
  );
}
