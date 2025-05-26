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

interface GlassFormProps {
  glass?: GlassWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;
  onSaved?: (id: string) => void;
}

export function GlassForm(props: GlassFormProps) {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  const formRef = props.formRef;

  const [similarGlass, setSimilarGlass] = useState<Glass | undefined>(undefined);

  return (
    <Formik
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

        const errors: any = {};
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
          <div className={'form-control col-span-2'}>
            <label className={'label'} htmlFor={'name'}>
              <span className={'label-text'}>Name</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.name && errors.name}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <input
              id={'name'}
              name={'name'}
              value={values.name}
              autoComplete={'off'}
              type={'text'}
              placeholder={'Name'}
              className={`input input-bordered w-full ${errors.name && 'input-error'}`}
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
              <div className="label">
                <span className="label-text-alt text-warning">
                  Ein ähnliches Glas mit dem Namen <strong>{similarGlass.name}</strong> existiert bereits.
                </span>
              </div>
            )}
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'deposit'}>
              <span className={'label-text'}>Pfand</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.deposit && errors.deposit}</>
                </span>
              </span>
            </label>
            <div className={'join'}>
              <input
                id={'deposit'}
                type={'number'}
                placeholder={'Deposit'}
                className={`input join-item input-bordered w-full ${errors.deposit && 'input-error'}}`}
                value={values.deposit}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'deposit'}
              />
              <span className={'btn btn-secondary join-item'}>€</span>
            </div>
          </div>
          <div className={'form-control'}>
            <label className={'label'} htmlFor={'volume'}>
              <span className={'label-text'}>Volumen</span>
            </label>
            <div className={'join'}>
              <input
                id={'volume'}
                type={'number'}
                placeholder={'38cl'}
                className={'input join-item input-bordered w-full'}
                value={values.volume}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'volume'}
              />
              <span className={'btn btn-secondary join-item'}>cl</span>
            </div>
          </div>
          <div className={'form-control col-span-2'}>
            {values.image != undefined ? (
              <div className={'label'}>
                <span className={'label-text'}>Vorschau Bild</span>
              </div>
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
                <div className={'absolute right-2 top-2 flex flex-row gap-2'}>
                  <div
                    className={'btn btn-square btn-outline btn-sm'}
                    onClick={async () => {
                      await setFieldValue('image', undefined);
                    }}
                  >
                    <FaCropSimple />
                  </div>
                  <div
                    className={'btn btn-square btn-outline btn-error btn-sm'}
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
                  </div>
                </div>
                <div className={'bg-transparent-pattern relative h-32 w-32 rounded-lg'}>
                  <Image className={'w-fit rounded-lg'} src={values.image} layout={'fill'} objectFit={'contain'} alt={'Glass Image'} />
                </div>
                <div className={'pt-2 font-thin italic'}>
                  Info: Durch Speichern des Cocktails wird das Bild dauerhaft zugeschnitten. <br />
                  Das Original wird nicht gespeichert. <br />
                  Falls du später also doch andere Bereiche auswählen möchtest, musst du das Bild dann erneut auswählen.
                </div>
              </div>
            )}
          </div>
          <div className={'col-span-2'}>
            <div className={'form-control'}>
              <button disabled={isSubmitting || !isValid} type={'submit'} className={`btn btn-primary`}>
                {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
                Speichern
              </button>
            </div>
            {!isValid && (
              <div className={'font-thin italic text-error'}>
                Nicht alle Felder sind korrekt ausgefüllt. Kontrolliere daher alle Felder. (Name gesetzt, Bild zugeschnitten, ... ?)
              </div>
            )}
          </div>
        </form>
      )}
    </Formik>
  );
}
