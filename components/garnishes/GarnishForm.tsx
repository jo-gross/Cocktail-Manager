import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64, fetchImageAsBase64 } from '@lib/Base64Converter';
import { FaTrashAlt } from 'react-icons/fa';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import type { GarnishCreateInput, GarnishDto, GarnishUpdateInput } from '@lib/schemas/garnishes';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import _ from 'lodash';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { Button, ButtonGroup, Divider, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Textarea } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { alertApiV1Error } from '@lib/network/apiV1';
import { checkGarnishName, createGarnish, updateGarnish } from '@lib/network/garnishes';

export interface GarnishFormValues {
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
    })
    .refine((values) => !(values.originalImage != undefined && values.image == undefined), {
      message: imageNotCroppedMessage,
      path: ['image'],
    });
}

interface GarnishFormProps {
  garnish?: GarnishDto;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<GarnishFormValues> | null>;
  onSaved?: (id: string) => void;
}

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

export function GarnishForm(props: GarnishFormProps) {
  const { t } = useTranslation(['manage', 'common', 'entity', 'errors']);
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef || React.createRef<FormikProps<GarnishFormValues>>();

  const [similarGarnish, setSimilarGarnish] = useState<Pick<GarnishDto, 'id' | 'name'> | undefined>();

  const [hydratedImage, setHydratedImage] = useState<string | undefined>(undefined);
  const [imageHydrationDone, setImageHydrationDone] = useState(!props.garnish?.hasImage);

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
      }}
      onSubmit={async (values) => {
        if (!workspaceId) return;
        try {
          const body: GarnishCreateInput & GarnishUpdateInput = {
            name: values.name,
            price: values.price === '' || values.price === undefined ? null : Number(values.price),
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
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
            if (props.onSaved != undefined) {
              props.onSaved(created.id);
            } else {
              alertService.success(t('manage:garnishForm.success.created'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`);
            }
          } else {
            await updateGarnish(workspaceId, props.garnish.id, body);
            if (props.onSaved != undefined) {
              props.onSaved(props.garnish.id);
            } else {
              alertService.success(t('manage:garnishForm.success.saved'));
              await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`);
            }
          }
        } catch (error) {
          alertApiV1Error(error, props.garnish == undefined ? t('manage:garnishForm.error.create') : t('manage:garnishForm.error.save'));
        }
      }}
      validate={(values) => {
        if (props.garnish) {
          const reducedOriginal = {
            name: props.garnish.name,
            price: props.garnish.price ?? undefined,
            description: props.garnish.description ?? '',
            notes: props.garnish.notes ?? '',
          };
          const reducedValues = _.omit(values, ['image', 'originalImage']);
          const areImageEqual = hydratedImage == values.image;
          props.setUnsavedChanges?.(!_.isEqual(reducedOriginal, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }

        return zodFormikValidate(createGarnishFormSchema(t('errors:requiredField'), t('common:imageNotCropped')))(values);
      }}
    >
      {({ values, errors, handleChange, handleBlur, handleSubmit, isSubmitting, isValid, setFieldValue }) => (
        <form onSubmit={handleSubmit} className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
          <div className={'col-span-full flex flex-row flex-wrap gap-2'}>
            <FormControl className={'flex-1'}>
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
                type={'text'}
                autoComplete={'off'}
                placeholder={t('common:name')}
                className={errors.name ? fieldErrorClass : undefined}
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
                value={values.name}
                name={'name'}
              />
              {similarGarnish && (
                <Label className="flex-row">
                  <LabelTextAlt className="text-warning">{t('manage:garnishForm.similarExists', { name: similarGarnish.name })}</LabelTextAlt>
                </Label>
              )}
            </FormControl>

            <FormControl>
              <Label htmlFor={'price'} className="flex-row items-center justify-between">
                <LabelText>{t('common:price')}</LabelText>
                <LabelTextAlt className={'space-x-2 text-error'}>
                  <>{errors.price && errors.price}</>
                </LabelTextAlt>
              </Label>
              <ButtonGroup className="w-full">
                <Input
                  id={'price'}
                  type={'number'}
                  placeholder={t('common:price')}
                  className={errors.price ? fieldErrorClass : undefined}
                  joinItem
                  value={values.price}
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
          <div className={''}>
            <div className="flex items-center gap-3 py-2">
              <Divider className="my-0 flex-1" />
              <span className="shrink-0 text-sm font-medium text-base-content/70">{t('common:imagePreview')}</span>
              <Divider className="my-0 flex-1" />
            </div>
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
                    await setFieldValue('image', undefined);
                    await setFieldValue('originalImage', undefined);
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
                    onClick={() => {
                      modalContext.openModal(
                        <DeleteConfirmationModal
                          spelling={'REMOVE'}
                          entityName={t('entity:theImage')}
                          onApprove={async () => {
                            await setFieldValue('originalImage', undefined);
                            await setFieldValue('image', undefined);
                          }}
                        />,
                      );
                    }}
                  >
                    <FaTrashAlt />
                  </Button>
                </div>
                <div className={'bg-transparent-pattern relative h-32 w-32 rounded-lg'}>
                  <Image className={'w-fit rounded-lg'} src={values.image ?? ''} layout={'fill'} objectFit={'contain'} alt={t('common:garnishImageAlt')} />
                </div>
                <div className={'pt-2 font-thin italic'}>{t('manage:garnishForm.imageCropInfo')}</div>
              </div>
            )}
          </div>

          <div className={'flex flex-col gap-2'}>
            <FormControl>
              <Label htmlFor={'notes'} className="flex-row items-center justify-between">
                <LabelText>{t('common:notes')}</LabelText>
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
                placeholder={t('manage:garnishForm.notesPlaceholder')}
                rows={5}
              />
            </FormControl>

            <FormControl>
              <Label htmlFor={'description'} className="flex-row items-center justify-between">
                <LabelText>{t('manage:garnishForm.description')}</LabelText>
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
                placeholder={t('manage:garnishForm.descriptionPlaceholder')}
                rows={5}
              />
            </FormControl>
            <div className={'w-full items-center justify-end'}>
              <FormControl>
                <Button disabled={isSubmitting || !isValid} type={'submit'} variant="primary" wide>
                  {isSubmitting ? <Loading size="sm" /> : null}
                  {t('common:save')}
                </Button>
              </FormControl>
              {!isValid && <div className={'font-thin text-error italic'}>{t('common:formIncomplete')}</div>}
            </div>
          </div>
        </form>
      )}
    </Formik>
  );
}
