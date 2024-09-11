import { Formik, FormikProps } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '../../lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useContext } from 'react';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { GlassWithImage } from '../../models/GlassWithImage';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';

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

  const formRef = props.formRef || React.createRef<FormikProps<any>>();

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
            deposit: values.deposit,
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
                router.replace(`/workspaces/${workspaceId}/manage/glasses`).then(() => alertService.success('Glas erfolgreich erstellt'));
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
                router.replace(`/workspaces/${workspaceId}/manage/glasses`).then(() => alertService.success('Glas erfolgreich gespeichert'));
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
        if (values.deposit.toString() == '' || isNaN(values.deposit)) {
          errors.deposit = 'Required';
        }
        if (values.originalImage != undefined && values.image == undefined) {
          errors.image = 'Bild ausgewählt aber nicht zugeschnitten';
        }
        return errors;
      }}
    >
      {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, isValid }) => (
        <form onSubmit={handleSubmit} className={'flex flex-col gap-2 md:gap-4'}>
          <div className={'form-control'}>
            <label className={'label'} htmlFor={'name'}>
              <span className={'label-text'}>Name</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.name && touched.name && errors.name}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <input
              id={'name'}
              autoComplete={'off'}
              type={'text'}
              placeholder={'Name'}
              className={`input input-bordered w-full ${errors.name && touched.name && 'input-error'}`}
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.name}
              name={'name'}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'deposit'}>
              <span className={'label-text'}>Pfand</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.deposit && touched.deposit && errors.deposit}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <div className={'join'}>
              <input
                id={'deposit'}
                type={'number'}
                placeholder={'Deposit'}
                className={`input join-item input-bordered w-full ${errors.deposit && touched.deposit && 'input-error'}}`}
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
          <div className={'form-control'}>
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
                  aspect={1}
                  imageToCrop={values.originalImage}
                  onCroppedImageComplete={async (file) => {
                    const compressedImageFile = await compressFile(file);
                    await setFieldValue('image', await convertToBase64(compressedImageFile));
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
                <div className={'relative h-32 w-32 rounded-lg bg-white'}>
                  <Image className={'w-fit rounded-lg'} src={values.image} layout={'fill'} objectFit={'contain'} alt={'Glass Image'} />
                </div>
                <div className={'pt-2 font-thin italic'}>
                  Info: Durch speichern des Cocktails wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. (Falls du später also doch
                  andere Bereiche auswählen möchtest, musst du das Bild dann erneut auswählen)
                </div>
              </div>
            )}
          </div>
          <div className={'form-control'}>
            <button disabled={isSubmitting || !isValid} type={'submit'} className={`btn btn-primary`}>
              {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
              Speichern
            </button>
          </div>
        </form>
      )}
    </Formik>
  );
}
