import { Formik, FormikProps } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '@lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useContext, useState } from 'react';
import { alertService } from '@lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import _ from 'lodash';
import { GlassWithImage } from '../../models/GlassWithImage';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import { Glass } from '@generated/prisma/client';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { resizeImage } from '@lib/ImageCompressor';
import { Button, ButtonGroup, Divider, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';

export interface GlassFormValues {
  name: string;
  deposit: number;
  image: string | undefined;
  originalImage: File | undefined;
  volume: number;
}

interface GlassFormProps {
  glass?: GlassWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<GlassFormValues> | null>;
  onSaved?: (id: string) => void;
}

const fieldErrorClass = 'border-error focus:border-error focus:ring-error/25';

export function GlassForm(props: GlassFormProps) {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef;

  const [similarGlass, setSimilarGlass] = useState<Glass | undefined>(undefined);

  return (
    <Formik<GlassFormValues>
      innerRef={formRef}
      initialValues={{
        name: props.glass?.name ?? '',
        deposit: props.glass?.deposit ?? 0,
        image: props.glass?.GlassImage?.[0]?.image ?? undefined,
        originalImage: (props.glass?.GlassImage.length ?? 0) ? convertBase64ToFile(props.glass!.GlassImage[0].image) : undefined,
        volume: props.glass?.volume ?? 0,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.glass?.id,
            name: values.name,
            deposit: values.deposit ?? 0,
            image: values.image,
            volume: values.volume == 0 ? undefined : values.volume,
          };
          if (props.glass == undefined) {
            const response = await fetch(`/api/workspaces/${workspaceId}/glasses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved) {
                props.onSaved((await response.json()).data.id);
              } else {
                alertService.success('Glas erfolgreich erstellt');
                await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`);
              }
            } else {
              const body = await response.json();
              console.error('GlassForm -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen des Glases', response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/glasses/${props.glass.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved) {
                props.onSaved(props.glass.id);
              } else {
                alertService.success('Glas erfolgreich gespeichert');
                await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/glasses`);
              }
            } else {
              const body = await response.json();
              console.error('GlassForm -> onSubmit[update]', response);
              alertService.error(body.message ?? 'Fehler beim Speichern des Glases', response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error('GarnishForm -> onSubmit', error);
          alertService.error('Es ist ein Fehler aufgetreten');
        }
      }}
      validate={(values) => {
        if (props.glass) {
          const reducedOriginal = _.omit(props.glass, ['id', 'workspaceId', 'GlassImage']);
          const reducedValues = _.omit(values, ['image', 'originalImage']);
          const areImageEqual = (props.glass.GlassImage.length > 0 ? props.glass.GlassImage[0].image.toString() : undefined) == values.image;

          props.setUnsavedChanges?.(!_.isEqual(reducedOriginal, reducedValues) || !areImageEqual);
        } else {
          props.setUnsavedChanges?.(true);
        }

        const errors: Partial<Record<keyof GlassFormValues, string>> = {};
        if (!values.name) {
          errors.name = 'Required';
        }
        if (values.originalImage != undefined && values.image == undefined) {
          errors.image = 'Bild ausgewählt aber nicht zugeschnitten';
        }
        return errors;
      }}
    >
      {({ values, setFieldValue, errors, handleChange, handleBlur, handleSubmit, isSubmitting, isValid }) => (
        <form onSubmit={handleSubmit} className={'grid w-full grid-cols-1 gap-2 md:max-w-4xl md:grid-cols-2'}>
          <FormControl className={'col-span-full'}>
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
              name={'name'}
              value={values.name}
              autoComplete={'off'}
              type={'text'}
              placeholder={'Name'}
              className={errors.name ? fieldErrorClass : undefined}
              onChange={(event) => {
                if (event.target.value.length > 2) {
                  fetch(`/api/workspaces/${workspaceId}/glasses/check?name=${event.target.value}`)
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.data != null) {
                        if (data.data.id != props.glass?.id) {
                          setSimilarGlass(data.data);
                        } else {
                          setSimilarGlass(undefined);
                        }
                      } else {
                        setSimilarGlass(undefined);
                      }
                    });
                } else {
                  setSimilarGlass(undefined);
                }
                handleChange(event);
              }}
              onBlur={handleBlur}
            />
            {similarGlass && (
              <Label className="flex-row">
                <LabelTextAlt className="text-warning">
                  Ein ähnliches Glas mit dem Namen <strong>{similarGlass.name}</strong> existiert bereits.
                </LabelTextAlt>
              </Label>
            )}
          </FormControl>

          <FormControl>
            <Label htmlFor={'deposit'} className="flex-row items-center justify-between">
              <LabelText>Pfand</LabelText>
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
                placeholder={'Deposit'}
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
              <LabelText>Volumen</LabelText>
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
                cl
              </Button>
            </ButtonGroup>
          </FormControl>
          <div className="col-span-full flex items-center gap-3 py-2">
            <Divider className="my-0 flex-1" />
            <span className="shrink-0 text-sm font-medium text-base-content/70">Darstellung</span>
            <Divider className="my-0 flex-1" />
          </div>
          <FormControl className={'col-span-full'}>
            {values.image != undefined ? (
              <Label className="flex-row">
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
                <div className={'bg-transparent-pattern relative h-32 w-32 rounded-lg'}>
                  <Image className={'w-fit rounded-lg'} src={values.image ?? ''} layout={'fill'} objectFit={'contain'} alt={'Glass Image'} />
                </div>
                <div className={'pt-2 font-thin italic'}>
                  Info: Durch Speichern des Glases wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. Falls du später einen anderen
                  Bereich des Bildes auswählen möchtest, musst du das Bild erneut hochladen.
                </div>
              </div>
            )}
          </FormControl>
          <Divider className="col-span-full" />
          <div className={'col-span-full'}>
            <FormControl>
              <Button disabled={isSubmitting || !isValid} type={'submit'} variant="primary">
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
        </form>
      )}
    </Formik>
  );
}
