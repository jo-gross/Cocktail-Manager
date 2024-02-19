import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { FaTrashAlt } from 'react-icons/fa';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { GarnishWithImage } from '../../models/GarnishWithImage';

interface GarnishFormProps {
  garnish?: GarnishWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;

  onSaved?: () => void;
}

export function GarnishForm(props: GarnishFormProps) {
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
        name: props.garnish?.name ?? '',
        price: props.garnish?.price ?? 0,
        description: props.garnish?.description ?? '',
        image: props.garnish?.GarnishImage[0].image ?? undefined,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.garnish == undefined ? undefined : props.garnish.id,
            name: values.name,
            price: values.price,
            description: values.description?.trim() == '' ? null : values.description?.trim(),
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
                props.onSaved();
              } else {
                router.push(`/workspaces/${workspaceId}/manage/garnishes`).then(() => alertService.success('Garnitur erfolgreich erstellt'));
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
                props.onSaved();
              } else {
                router.push(`/workspaces/${workspaceId}/manage/garnishes`).then(() => alertService.success('Garnitur erfolgreich gespeichert'));
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
        props.setUnsavedChanges?.(originalValues && !_.isEqual(originalValues, formRef?.current?.values));
        const errors: any = {};
        if (!values.name) {
          errors.name = 'Required';
        }
        if (values.price.toString() == '' || isNaN(values.price)) {
          errors.price = 'Required';
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
              className={`input input-bordered ${errors.name && touched.name && 'input-error'} w-full`}
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.name}
              name={'name'}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'}>
              <span className={'label-text'}>Zubereitungsbeschreibung</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.description && touched.description && errors.description}</>
                </span>
              </span>
            </label>
            <textarea
              className={`textarea textarea-bordered ${errors.description && touched.description && 'textarea-error'} w-full`}
              value={values.description}
              onChange={handleChange}
              onBlur={handleBlur}
              name={'description'}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'}>
              <span className={'label-text'}>Preis</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.price && touched.price && errors.price}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <div className={'join'}>
              <input
                type={'number'}
                placeholder={'Preis'}
                className={`input join-item input-bordered ${errors.price && touched.price && 'input-error'} w-full`}
                value={values.price}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'price'}
              />
              <span className={'btn btn-secondary join-item'}>€</span>
            </div>
          </div>
          <div className={'col-span-2'}>
            {values.image != undefined ? (
              <label className={'label'}>
                <span className={'label-text'}>Zutaten Bild</span>
              </label>
            ) : (
              <></>
            )}
            {values.image == undefined ? (
              <UploadDropZone
                onSelectedFilesChanged={async (file) => {
                  if (file != undefined) {
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
                  onClick={() => {
                    modalContext.openModal(
                      <DeleteConfirmationModal
                        spelling={'REMOVE'}
                        entityName={'das Bild'}
                        onApprove={async () => {
                          await setFieldValue('image', undefined);
                        }}
                      />,
                    );
                  }}
                >
                  <FaTrashAlt />
                </div>
                <img className={'h-32 rounded-lg'} src={values.image} alt={'Cocktail Image'} />
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
