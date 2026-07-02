import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useState } from 'react';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '@lib/Base64Converter';
import { FaTrashAlt } from 'react-icons/fa';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { GarnishWithImage } from '../../models/GarnishWithImage';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import _ from 'lodash';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { Button, ButtonGroup, Divider, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Textarea } from '@components/ui';

export interface GarnishFormValues {
  name: string;
  price: number | undefined | string;
  description: string;
  notes: string;
  image: string | undefined;
  originalImage: File | undefined;
}

interface GarnishFormProps {
  garnish?: GarnishWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<GarnishFormValues> | null>;
  onSaved?: (id: string) => void;
}

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

export function GarnishForm(props: GarnishFormProps) {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef || React.createRef<FormikProps<GarnishFormValues>>();

  const [similarGarnish, setSimilarGarnish] = useState<GarnishWithImage | undefined>();

  return (
    <Formik<GarnishFormValues>
      innerRef={formRef}
      initialValues={{
        name: props.garnish?.name ?? '',
        price: props.garnish?.price ?? undefined,
        description: props.garnish?.description ?? '',
        notes: props.garnish?.notes ?? '',
        image: props.garnish?.GarnishImage?.[0]?.image ?? undefined,
        originalImage: (props.garnish?.GarnishImage.length ?? 0) ? convertBase64ToFile(props.garnish!.GarnishImage[0].image) : undefined,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.garnish == undefined ? undefined : props.garnish.id,
            name: values.name,
            price: values.price === '' || values.price === undefined ? null : values.price,
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
            image: values.image == '' ? null : values.image,
          };
          if (props.garnish == undefined) {
            const response = await fetch(`/api/workspaces/${workspaceId}/garnishes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved != undefined) {
                props.onSaved((await response.json()).data.id);
              } else {
                alertService.success('Garnitur erfolgreich erstellt');
                await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`);
              }
            } else {
              const body = await response.json();
              console.error('GarnishForm -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Garnitur', response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/garnishes/${props.garnish.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved != undefined) {
                props.onSaved(props.garnish.id);
              } else {
                alertService.success('Garnitur erfolgreich gespeichert');
                await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/garnishes`);
              }
            } else {
              const body = await response.json();
              console.error('GarnishForm -> onSubmit[update]', response);
              alertService.error(body.message ?? 'Fehler beim Speichern der Garnitur', response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error('GarnishForm -> onSubmit', error);
          alertService.error('Es ist ein Fehler aufgetreten');
        }
      }}
      validate={(values) => {
        if (props.garnish) {
          const reducedOriginal = _.omit(props.garnish, ['id', 'workspaceId', 'GarnishImage']);
          const reducedValues = _.omit(values, ['image', 'originalImage']);
          const areImageEqual = (props.garnish.GarnishImage.length > 0 ? props.garnish.GarnishImage[0].image.toString() : undefined) == values.image;
          props.setUnsavedChanges?.(!_.isEqual(reducedOriginal, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }

        const errors: Partial<Record<keyof GarnishFormValues, string>> = {};
        if (!values.name) {
          errors.name = 'Required';
        }
        if (values.originalImage != undefined && values.image == undefined) {
          errors.image = 'Bild ausgewählt aber nicht zugeschnitten';
        }
        return errors;
      }}
    >
      {({ values, errors, handleChange, handleBlur, handleSubmit, isSubmitting, isValid, setFieldValue }) => (
        <form onSubmit={handleSubmit} className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
          <div className={'col-span-full flex flex-row flex-wrap gap-2'}>
            <FormControl className={'flex-1'}>
              <Label htmlFor={'name'} className="flex-row items-center justify-between">
                <LabelText>Name</LabelText>
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
                placeholder={'Name'}
                className={errors.name ? fieldErrorClass : undefined}
                onChange={(event) => {
                  if (event.target.value.length > 2) {
                    fetch(`/api/workspaces/${workspaceId}/garnishes/check?name=${event.target.value}`)
                      .then((response) => response.json())
                      .then((data) => {
                        console.log(data);
                        if (data.data != null) {
                          if (data.data.id != props.garnish?.id) {
                            setSimilarGarnish(data.data);
                          } else {
                            setSimilarGarnish(undefined);
                          }
                        } else {
                          setSimilarGarnish(undefined);
                        }
                      });
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
                  <LabelTextAlt className="text-warning">
                    Eine ähnliche Garnitur mit dem Namen <strong>{similarGarnish.name}</strong> existiert bereits.
                  </LabelTextAlt>
                </Label>
              )}
            </FormControl>

            <FormControl>
              <Label htmlFor={'price'} className="flex-row items-center justify-between">
                <LabelText>Preis</LabelText>
                <LabelTextAlt className={'space-x-2 text-error'}>
                  <>{errors.price && errors.price}</>
                </LabelTextAlt>
              </Label>
              <ButtonGroup className="w-full">
                <Input
                  id={'price'}
                  type={'number'}
                  placeholder={'Preis'}
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
              <span className="shrink-0 text-sm font-medium text-base-content/70">Vorschau Bild</span>
              <Divider className="my-0 flex-1" />
            </div>
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
                  aspect={1}
                  imageToCrop={values.originalImage}
                  onCroppedImageComplete={async (file) => {
                    resizeImage(file, 400, 400, async (compressedImageFile) => {
                      if (compressedImageFile) {
                        await setFieldValue('image', await convertToBase64(new File([compressedImageFile], 'image.png', { type: 'image/png' })));
                      } else {
                        alertService.error('Bild konnte nicht skaliert werden.');
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
                          entityName={'das Bild'}
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
                  <Image className={'w-fit rounded-lg'} src={values.image ?? ''} layout={'fill'} objectFit={'contain'} alt={'Garnish image'} />
                </div>
                <div className={'pt-2 font-thin italic'}>
                  Info: Durch Speichern der Garnitur wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. Falls du später einen anderen
                  Bereich des Bildes auswählen möchtest, musst du das Bild erneut hochladen.
                </div>
              </div>
            )}
          </div>

          <div className={'flex flex-col gap-2'}>
            <FormControl>
              <Label htmlFor={'notes'} className="flex-row items-center justify-between">
                <LabelText>Notizen</LabelText>
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
                placeholder={'Lagerort, Lieferant, etc.'}
                rows={5}
              />
            </FormControl>

            <FormControl>
              <Label htmlFor={'description'} className="flex-row items-center justify-between">
                <LabelText>Allgemeine Beschreibung</LabelText>
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
                placeholder={'Das Öl der Zeste hilft, den Geschmack des Cocktails zu intensivieren, ...'}
                rows={5}
              />
            </FormControl>
            <div className={'w-full items-center justify-end'}>
              <FormControl>
                <Button disabled={isSubmitting || !isValid} type={'submit'} variant="primary" wide>
                  {isSubmitting ? <Loading size="sm" /> : null}
                  Speichern
                </Button>
              </FormControl>
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
