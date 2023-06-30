import { Formik, FormikProps } from 'formik';
import { Ingredient } from '@prisma/client';
import { useRouter } from 'next/router';
import React, { useRef } from 'react';
import { CocktailIngredientUnit } from '../../models/CocktailIngredientUnit';
import { TagsInput } from 'react-tag-input-component';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { alertService } from '../../lib/alertService';

interface IngredientFormProps {
  ingredient?: Ingredient;
}

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();

  const formRef = useRef<FormikProps<any>>(null);

  return (
    <Formik
      innerRef={formRef}
      initialValues={{
        name: props.ingredient?.name ?? '',
        shortName: props.ingredient?.shortName ?? '',
        price: props.ingredient?.price ?? 0,
        volume: props.ingredient?.volume ?? 0,
        unit: props.ingredient?.unit ?? CocktailIngredientUnit.CL,
        link: props.ingredient?.link ?? '',
        tags: props.ingredient?.tags ?? [],
        image: props.ingredient?.image ?? undefined,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.ingredient == undefined ? undefined : props.ingredient.id,
            name: values.name.trim(),
            shortName: values.shortName?.trim() == '' ? undefined : values.shortName?.trim(),
            price: values.price,
            unit: values.unit,
            volume: values.volume == 0 ? undefined : values.volume,
            link: values.link?.trim() == '' ? undefined : values.link?.trim(),
            tags: values.tags,
            image: values.image?.trim() == '' ? undefined : values.image?.trim(),
          };
          const result = await fetch('/api/ingredients', {
            method: props.ingredient == undefined ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (result.status.toString().startsWith('2')) {
            await router.replace('/manage/ingredients');
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
        if (values.price.toString() == '' || isNaN(values.price)) {
          errors.price = 'Required';
        }
        if (values.volume.toString() == '' || isNaN(values.volume)) {
          errors.volume = 'Required';
        }
        if (!values.unit) {
          errors.unit = 'Required';
        }
        console.log(errors);
        return errors;
      }}
    >
      {({
        values,
        setFieldValue,
        errors,
        setFieldError,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
        <form onSubmit={handleSubmit}>
          <div className={'grid md:grid-cols-3 grid-cols-1 p-12 gap-4'}>
            <div></div>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-2xl font-bold text-center'}>Zutat erfassen</div>
                <div className={'divider'}></div>
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
                    placeholder={'Buffalo Trace 80 Proof Kentucky Straight Bourbon'}
                    className={`input input-bordered ${errors.name && touched.name && 'input-error'}`}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.name}
                    name={'name'}
                  />
                </div>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <span className={'label-text'}>Abkürzung</span>
                    <span className={'label-text-alt text-error space-x-2'}>
                      <span>{errors.shortName && touched.shortName && errors.shortName}</span>
                    </span>
                  </label>
                  <input
                    type={'text'}
                    placeholder={'Buffalo Trace'}
                    className={`input input-bordered ${errors.shortName && touched.shortName && 'input-error'}`}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.shortName}
                    name={'shortName'}
                  />
                </div>

                <div className={'form-control'}>
                  <label className={'label'}>
                    <span className={'label-text'}>Preis</span>
                    <span className={'label-text-alt text-error space-x-2'}>
                      <span>{errors.price && touched.price && errors.price}</span>
                      <span>*</span>
                    </span>
                  </label>
                  <div className={'input-group'}>
                    <input
                      type={'number'}
                      placeholder={'price'}
                      className={`input input-bordered w-full ${errors.price && touched.price && 'input-error'}`}
                      value={values.price}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'price'}
                    />
                    <span className={'btn-secondary'}>€</span>
                  </div>
                </div>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <span className={'label-text'}>Menge</span>
                    <span className={'label-text-alt text-error space-x-2'}>
                      <span>{errors.volume && touched.volume && errors.volume}</span>
                      <span>*</span>
                    </span>
                  </label>
                  <div className={'input-group'}>
                    <input
                      type={'number'}
                      placeholder={'38cl'}
                      className={`input input-bordered w-full ${errors.volume && touched.volume && 'input-error'}`}
                      value={values.volume}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'volume'}
                    />
                    <select
                      className={`select select-bordered ${errors.unit && 'select-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'unit'}
                      value={values.unit}
                    >
                      {Object.values(CocktailIngredientUnit).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  Preis/{values.unit}: {(values.price / values.volume).toFixed(2)}€
                </div>
                <div>
                  <label className={'label'}>
                    <span className={'label-text'}>Tags</span>
                    <span className={'text-error label-text-alt'}>{errors.tags && touched.tags && errors.tags}</span>
                  </label>
                  <TagsInput
                    value={values.tags}
                    onChange={(tags) =>
                      setFieldValue(
                        'tags',
                        updateTags(tags, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft')),
                      )
                    }
                    name="tags"
                    beforeAddValidate={(tag, _) =>
                      validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft'))
                    }
                    onBlur={handleBlur}
                  />
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
                        onClick={() => setFieldValue('image', undefined)}
                      >
                        <FaTrashAlt />
                      </div>
                      <img className={'rounded-lg h-32'} src={values.image} alt={'Cocktail Image'} />
                    </div>
                  )}
                </div>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <span className={'label-text'}>Link</span>
                    <span className={'label-text-alt text-error space-x-2'}>
                      <span>{errors.link && touched.link && errors.link}</span>
                    </span>
                  </label>
                  <div className={'input-group'}>
                    <input
                      type={'text'}
                      placeholder={''}
                      className={`input input-bordered w-full ${errors.link && touched.link && 'input-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.link}
                      name={'link'}
                    />
                    <button
                      className={`btn btn-primary ${values.fetchingExternalData ? 'loading' : ''}`}
                      type={'button'}
                      disabled={!(values.link.includes('expert24.com') || values.link.includes('conalco.de'))}
                      onClick={() => {
                        setFieldValue('fetchingExternalData', true);
                        fetch(`/api/scraper/ingredient?url=${values.link}`)
                          .then((response) => {
                            if (response.ok) {
                              response.json().then((data) => {
                                setFieldValue('name', data.name);
                                setFieldValue('price', data.price);
                                setFieldValue('image', data.image);
                                setFieldValue('volume', data.volume);
                              });
                            } else {
                              alertService.warn('Es konnten keine Daten über die URL geladen werden.');
                            }
                          })
                          .finally(() => {
                            setFieldValue('fetchingExternalData', false);
                          });
                      }}
                    >
                      <FaSyncAlt />
                    </button>
                  </div>
                </div>
                <div className={'form-control'}>
                  <button type={'submit'} className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}>
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </Formik>
  );
}
