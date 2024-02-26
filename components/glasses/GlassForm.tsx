import { Formik, FormikProps } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useState } from 'react';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { GlassWithImage } from '../../models/GlassWithImage';

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

  const formRef = props.formRef;
  const [originalValues, setOriginalValues] = useState<any>();

  //Filling original values
  useEffect(() => {
    if (Object.keys(formRef?.current?.touched ?? {}).length == 0) {
      setOriginalValues(formRef?.current?.values);
    }
  }, [formRef, formRef?.current?.values]);

  return (
    <Formik
      innerRef={formRef}
      initialValues={{
        name: props.glass?.name ?? '',
        deposit: props.glass?.deposit ?? 0,
        image: props.glass?.GlassImage[0].image ?? undefined,
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
                router.push(`/workspaces/${workspaceId}/manage/glasses`).then(() => alertService.success('Glas erfolgreich erstellt'));
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
                router.push(`/workspaces/${workspaceId}/manage/glasses`).then(() => alertService.success('Glas erfolgreich gespeichert'));
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
        props.setUnsavedChanges?.(originalValues && !_.isEqual(originalValues, formRef?.current?.values));
        const errors: any = {};
        if (!values.name) {
          errors.name = 'Required';
        }
        if (values.deposit.toString() == '' || isNaN(values.deposit)) {
          errors.deposit = 'Required';
        }
        return errors;
      }}
    >
      {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <form onSubmit={handleSubmit} className={'flex flex-col gap-2 md:gap-4'}>
          <div className={'form-control'}>
            <label className={'label'}>
              <span className={'label-text'}>Name</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.name && touched.name && errors.name}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <input
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
            <label className={'label'}>
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
            <label className={'label'}>
              <span className={'label-text'}>Volumen</span>
            </label>
            <div className={'join'}>
              <input
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
              <label className={'label'}>
                <span className={'label-text'}>Vorschau Bild</span>
              </label>
            ) : (
              <></>
            )}
            {values.image == undefined ? (
              <UploadDropZone
                onSelectedFilesChanged={async (file) => {
                  if (file) {
                    const compressedImageFile = await compressFile(file);
                    await setFieldValue('image', await convertToBase64(compressedImageFile));
                  } else {
                    alertService.error('Datei konnte nicht ausgewählt werden.');
                  }
                }}
              />
            ) : (
              <div className={'relative'}>
                <div
                  className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2'}
                  onClick={() =>
                    modalContext.openModal(
                      <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={() => setFieldValue('image', undefined)} />,
                    )
                  }
                >
                  <FaTrashAlt />
                </div>
                <img className={'max-h-20 rounded-lg'} src={values.image} alt={'Cocktail Image'} />
              </div>
            )}
          </div>
          <div className={'form-control'}>
            <button type={'submit'} className={`btn btn-primary ${isSubmitting ?? 'loading'}`}>
              Speichern
            </button>
          </div>
        </form>
      )}
    </Formik>
  );
}
