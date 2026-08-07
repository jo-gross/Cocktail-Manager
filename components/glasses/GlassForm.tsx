import { Formik, FormikProps } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64, fetchImageAsBase64 } from '@lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import type { GlassDto } from '@lib/schemas/glasses';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { Button, ButtonGroup, Divider, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkGlassName, createGlass, updateGlass } from '@lib/network/glasses';
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
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<GlassFormValues> | null>;
  onSaved?: (id: string) => void;
}

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

export function GlassForm(props: GlassFormProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef;

  const [similarGlass, setSimilarGlass] = useState<Pick<GlassDto, 'id' | 'name'> | undefined>(undefined);

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.glass?.hasImage);

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
            if (props.onSaved) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('manage:glassForm.success.created'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`);
            }
          } else {
            await updateGlass(workspaceId, props.glass.id, body);
            if (props.onSaved) {
              props.onSaved(props.glass.id);
            } else {
              alertService.success(t('manage:glassForm.success.saved'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`);
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.glass == undefined ? t('manage:glassForm.error.create') : t('manage:glassForm.error.save'));
        }
      }}
      validate={(values) => {
        if (props.glass) {
          const reducedOriginal = {
            name: props.glass.name,
            deposit: props.glass.deposit,
            volume: props.glass.volume ?? 0,
          };
          const reducedValues = _.omit(values, ['image', 'originalImage']);
          const areImageEqual = hydratedImage == values.image;

          props.setUnsavedChanges?.(!_.isEqual(reducedOriginal, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }

        return zodFormikValidate(createGlassFormSchema(t('errors:requiredField'), t('common:imageNotCropped')))(values);
      }}
    >
      {({ values, setFieldValue, errors, handleChange, handleBlur, handleSubmit, isSubmitting, isValid }) => (
        <form onSubmit={handleSubmit} className={'grid w-full grid-cols-1 gap-2 md:max-w-4xl md:grid-cols-2'}>
          <FormControl className={'col-span-full'}>
            <Label htmlFor={'name'} className="flex-row items-center justify-between">
              <LabelText>{t('common:name')}</LabelText>
              <LabelTextAlt className={'space-x-2 text-error'}>
                <span>
                  <>{errors.name && errors.name}</>
                </span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input
              id={'name'}
              name={'name'}
              value={values.name}
              autoComplete={'off'}
              type={'text'}
              placeholder={t('common:name')}
              className={errors.name ? fieldErrorClass : undefined}
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
            {similarGlass && (
              <Label className="flex-row">
                <LabelTextAlt className="text-warning">{t('manage:glassForm.similarExists', { name: similarGlass.name })}</LabelTextAlt>
              </Label>
            )}
          </FormControl>

          <FormControl>
            <Label htmlFor={'deposit'} className="flex-row items-center justify-between">
              <LabelText>{t('common:deposit')}</LabelText>
              <LabelTextAlt className={'space-x-2 text-error'}>
                <span>
                  <>{errors.deposit && errors.deposit}</>
                </span>
              </LabelTextAlt>
            </Label>
            <ButtonGroup className="w-full">
              <Input
                id={'deposit'}
                type={'number'}
                placeholder={t('common:deposit')}
                className={errors.deposit ? fieldErrorClass : undefined}
                joinItem
                value={values.deposit}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'deposit'}
              />
              <Button type="button" variant="secondary" joinItem>
                €
              </Button>
            </ButtonGroup>
          </FormControl>
          <FormControl>
            <Label htmlFor={'volume'} className="flex-row items-center justify-between">
              <LabelText>{t('common:volume')}</LabelText>
            </Label>
            <ButtonGroup className="w-full">
              <Input
                id={'volume'}
                type={'number'}
                placeholder={'38cl'}
                joinItem
                value={values.volume}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'volume'}
              />
              <Button type="button" variant="secondary" joinItem>
                {t('common:cl')}
              </Button>
            </ButtonGroup>
          </FormControl>
          <div className="col-span-full flex items-center gap-3 py-2">
            <Divider className="my-0 flex-1" />
            <span className="shrink-0 text-sm font-medium text-base-content/70">{t('common:display')}</span>
            <Divider className="my-0 flex-1" />
          </div>
          <FormControl className={'col-span-full'}>
            {values.image != undefined ? (
              <Label className="flex-row">
                <LabelText>{t('common:imagePreview')}</LabelText>
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
                    alertService.error(t('common:fileSelectError'));
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
                        alertService.error(t('common:imageScaleError'));
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
                          entityName={t('entity:theImage')}
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
                <div className={'bg-transparent-pattern relative h-32 w-32 rounded-lg'}>
                  <Image className={'w-fit rounded-lg'} src={values.image ?? ''} layout={'fill'} objectFit={'contain'} alt={t('common:glassImageAlt')} />
                </div>
                <div className={'pt-2 font-thin italic'}>{t('manage:glassForm.imageCropInfo')}</div>
              </div>
            )}
          </FormControl>
          <Divider className="col-span-full" />
          <div className={'col-span-full'}>
            <FormControl>
              <Button disabled={isSubmitting || !isValid} type={'submit'} variant="primary">
                {isSubmitting ? <Loading size="sm" /> : null}
                {t('common:save')}
              </Button>
            </FormControl>
            {!isValid && <div className={'font-thin text-error italic'}>{t('common:formIncomplete')}</div>}
          </div>
        </form>
      )}
    </Formik>
  );
}
