import { Formik, FormikProps } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useState } from 'react';
import { SingleFormLayout } from '../layout/SingleFormLayout';
import { alertService } from '../../lib/alertService';
import { Glass } from '@prisma/client';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';

interface GlassFormProps {
  glass?: Glass;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;
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
        image: props.glass?.image ?? undefined,
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
            const result = await fetch(`/api/workspaces/${workspaceId}/glasses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (result.status.toString().startsWith('2')) {
              router
                .push(`/workspaces/${workspaceId}/manage/glasses`)
                .then(() => alertService.success('Glas erfolgreich erstellt'));
            } else {
              const body = await result.json();
              alertService.error(body.message, result.status, result.statusText);
            }
          } else {
            const result = await fetch(`/api/workspaces/${workspaceId}/glasses/${props.glass.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (result.status.toString().startsWith('2')) {
              router
                .push(`/workspaces/${workspaceId}/manage/glasses`)
                .then(() => alertService.success('Glas erfolgreich gespeichert'));
            } else {
              const body = await result.json();
              alertService.error(body.message, result.status, result.statusText);
            }
          }
        } catch (error) {
          console.error(error);
          alertService.error('Es ist ein fehler aufgetreten.');
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
        <form onSubmit={handleSubmit}>
          <SingleFormLayout title={'Glas erfassen'}>
            <div className={'form-control'}>
              <label className={'label'}>
                <span className={'label-text'}>Name</span>
                <span className={'label-text-alt text-error space-x-2'}>
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
                <span className={'label-text-alt text-error space-x-2'}>
                  <span>
                    <>{errors.deposit && touched.deposit && errors.deposit}</>
                  </span>
                  <span>*</span>
                </span>
              </label>
              <div className={'input-group'}>
                <input
                  type={'number'}
                  placeholder={'Deposit'}
                  className={`input input-bordered w-full ${errors.deposit && touched.deposit && 'input-error'}}`}
                  value={values.deposit}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  name={'deposit'}
                />
                <span className={'btn-secondary'}>€</span>
              </div>
            </div>
            <div className={'form-control'}>
              <label className={'label'}>
                <span className={'label-text'}>Volumen</span>
              </label>
              <div className={'input-group'}>
                <input
                  type={'number'}
                  placeholder={'38cl'}
                  className={'input input-bordered w-full'}
                  value={values.volume}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  name={'volume'}
                />
                <span className={'btn-secondary'}>cl</span>
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
                      setFieldValue('image', await convertToBase64(file));
                    } else {
                      alertService.error('Datei konnte nicht ausgewählt werden.');
                    }
                  }}
                />
              ) : (
                <div className={'relative'}>
                  <div
                    className={'absolute top-2 right-2 btn-error btn btn-outline btn-sm btn-square'}
                    onClick={() =>
                      modalContext.openModal(
                        <DeleteConfirmationModal
                          spelling={'REMOVE'}
                          entityName={'das Bild'}
                          onApprove={() => setFieldValue('image', undefined)}
                        />,
                      )
                    }
                  >
                    <FaTrashAlt />
                  </div>
                  <img className={'rounded-lg max-h-20'} src={values.image} alt={'Cocktail Image'} />
                </div>
              )}
            </div>
            <div className={'form-control'}>
              <button type={'submit'} className={`btn btn-primary ${isSubmitting ?? 'loading'}`}>
                Speichern
              </button>
            </div>
          </SingleFormLayout>
        </form>
      )}
    </Formik>
  );
}
