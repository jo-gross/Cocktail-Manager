import { Formik } from 'formik';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { useRouter } from 'next/router';
import { FaTrashAlt } from 'react-icons/fa';
import React, { useEffect, useState } from 'react';
import { SingleFormLayout } from '../layout/SingleFormLayout';
import { alertService } from '../../lib/alertService';
import { Glass } from '@prisma/client';
import { Loading } from '../Loading';

interface GlassFormProps {
  glass?: Glass;
}

export function GlassForm(props: GlassFormProps) {
  const router = useRouter();

  return (
    <Formik
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
          const result = await fetch('/api/glasses', {
            method: props.glass?.id == undefined ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (result.status.toString().startsWith('2')) {
            await router.push('/manage/glasses');
          } else {
            console.error(result.status + ' ' + result.statusText);
          }
        } catch (error) {
          console.error(error);
        }
      }}
      validate={(values) => {
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
                  <span>{errors.name && touched.name && errors.name}</span>
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
                  <span>{errors.deposit && touched.deposit && errors.deposit}</span>
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
                    className={'absolute top-2 right-2 text-error'}
                    onClick={() => setFieldValue('image', undefined)}
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
