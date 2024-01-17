import { Formik, FormikProps } from 'formik';
import { IngredientUnit } from '@prisma/client';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { TagsInput } from 'react-tag-input-component';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { UploadDropZone } from '../UploadDropZone';
import { convertToBase64 } from '../../lib/Base64Converter';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { convertUnitToDisplayString, unitFromClConversion } from '../../lib/UnitConverter';
import { IngredientFull } from '../../models/IngredientFull';

interface IngredientFormProps {
  ingredient?: IngredientFull;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;
}

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const formRef = props.formRef;
  const [originalValues, setOriginalValues] = useState<any>();

  //Filling original values
  useEffect(() => {
    if (props.ingredient != null && Object.keys(formRef?.current?.touched ?? {}).length == 0) {
      setOriginalValues(formRef?.current?.values);
    }
  }, [formRef, formRef?.current?.values, props.ingredient]);

  return (
    <Formik
      innerRef={formRef}
      initialValues={
        props.ingredient != null
          ? props.ingredient?.CustomIngredientUnitConversion?.reduce(
              (acc, unit) => {
                // @ts-ignore
                acc[`volume_${unit.unit}`] = unit.value;
                return acc;
              },
              {
                name: props.ingredient?.name ?? '',
                shortName: props.ingredient?.shortName ?? '',
                price: props.ingredient?.price ?? 0,
                volume_CL: props.ingredient?.volume ?? 0,
                unit: props.ingredient?.unit ?? IngredientUnit.CL,
                link: props.ingredient?.link ?? '',
                tags: props.ingredient?.tags ?? [],
                image: props.ingredient?.image ?? undefined,
                advanced_units: (props.ingredient?.CustomIngredientUnitConversion ?? []).length != 0,
              },
            )
          : {
              name: '',
              shortName: '',
              price: 0,
              volume_CL: 0,
              unit: IngredientUnit.CL,
              link: '',
              tags: [],
              image: undefined,
              advanced_units: false,
            }
      }
      onSubmit={async (values) => {
        try {
          const customConversions = [];
          for (const unit of Object.values(IngredientUnit)) {
            if (unit != IngredientUnit.CL) {
              if (values[`volume_${unit}`] != undefined) {
                customConversions.push({
                  unit: unit,
                  value: values[`volume_${unit}`],
                });
              }
            }
          }

          const body = {
            id: props.ingredient == undefined ? undefined : props.ingredient.id,
            name: values.name.trim(),
            shortName: values.shortName?.trim() == '' ? undefined : values.shortName?.trim(),
            price: values.price,
            unit: values.unit,
            volume: values.volume == 0 ? undefined : values.volume_CL ?? unitFromClConversion(values.unit),
            link: values.link?.trim() == '' ? undefined : values.link?.trim(),
            tags: values.tags,
            image: values.image?.trim() == '' ? undefined : values.image?.trim(),
            customUnitConversions: customConversions,
          };

          if (props.ingredient == undefined) {
            const result = await fetch(`/api/workspaces/${workspaceId}/ingredients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (result.status.toString().startsWith('2')) {
              router
                .replace(`/workspaces/${workspaceId}/manage/ingredients`)
                .then(() => alertService.success('Zutat erfolgreich erstellt'));
            } else {
              const body = await result.json();
              alertService.error(body.message, result.status, result.statusText);
            }
          } else {
            const result = await fetch(`/api/workspaces/${workspaceId}/ingredients/${props.ingredient.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (result.status.toString().startsWith('2')) {
              router
                .replace(`/workspaces/${workspaceId}/manage/ingredients`)
                .then(() => alertService.success('Zutat erfolgreich gespeichert'));
            } else {
              const body = await result.json();
              alertService.error(body.message, result.status, result.statusText);
            }
          }
        } catch (error) {
          console.error(error);
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
        if (values.advanced_units) {
          let anyUnitFilled = false;
          for (const unit of Object.values(IngredientUnit)) {
            if (!isNaN(values[`volume_${unit}`]) && values[`volume_${unit}`] != '') {
              anyUnitFilled = true;
            }
          }
          if (!anyUnitFilled) {
            errors.volume = 'Required';
          }
        } else {
          if (values.volume_CL.toString() == '' || isNaN(values.volume_CL)) {
            errors.volume_CL = 'Required';
          }
        }
        if (!values.unit) {
          errors.unit = 'Required';
        }
        console.log('Form errors', errors);
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
          <div className={'grid grid-cols-1 gap-2 p-1 md:grid-cols-3 md:gap-4 md:p-12'}>
            <div></div>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold'}>Zutat erfassen</div>
                <div className={'divider'}></div>
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
                    <span className={'label-text-alt space-x-2 text-error'}>
                      <span>
                        <>{errors.shortName && touched.shortName && errors.shortName}</>
                      </span>
                    </span>
                  </label>
                  <input
                    type={'text'}
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
                      className={`input join-item input-bordered w-full ${
                        errors.price && touched.price && 'input-error'
                      }`}
                      value={values.price}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'price'}
                    />
                    <span className={'btn btn-secondary join-item'}>€</span>
                  </div>
                </div>
                <div role="tablist" className="tabs tabs-bordered w-full grid-cols-2">
                  <input
                    type="radio"
                    name="my_tabs_1"
                    role="tab"
                    className="tab"
                    aria-label="Einfache Einheit"
                    defaultChecked={!values.advanced_units}
                    onClick={() => setFieldValue('advanced_units', false)}
                  />
                  <div role="tabpanel" className="tab-content">
                    <div className={'form-control'}>
                      <label className={'label'}>
                        <span className={'label-text'}>Menge</span>
                        <span className={'label-text-alt space-x-2 text-error'}>
                          <span>
                            <>{errors.volume_CL && touched.volume_CL && errors.volume_CL}</>
                          </span>
                          <span>*</span>
                        </span>
                      </label>
                      <div className={'join'}>
                        <input
                          type={'number'}
                          className={`input join-item input-bordered w-full ${
                            errors.volume_CL && touched.volume_CL && 'input-error'
                          }`}
                          value={values[`volume_${values.unit}`]}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          name={`volume_${values.unit}`}
                        />
                        <select
                          className={`join-item select select-bordered ${errors.unit && 'select-error'}`}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          name={'unit'}
                          value={values.unit}
                        >
                          {Object.values(IngredientUnit).map((unit) => (
                            <option key={unit} value={unit}>
                              {convertUnitToDisplayString(unit)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      Preis/{convertUnitToDisplayString(values.unit)}:{' '}
                      {((values.price ?? 0) / (values.volume_CL ?? 0)).toFixed(2)}€
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="my_tabs_1"
                    role="tab"
                    className="tab"
                    aria-label="Einheiten anpassen"
                    defaultChecked={values.advanced_units}
                    onClick={() => setFieldValue('advanced_units', true)}
                  />
                  <div role="tabpanel" className="tab-content">
                    {Object.values(IngredientUnit).map((unit) => (
                      <div key={unit} className={'form-control'}>
                        <label className={'label'}>
                          <span className={'label-text'}>Menge</span>
                        </label>
                        <div className={'join'}>
                          <input
                            type={'number'}
                            className={`input join-item input-bordered w-full`}
                            placeholder={`${unitFromClConversion(unit) * values.volume_CL}`}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            value={values[`volume_${unit}`]}
                            name={`volume_${unit}`}
                          />
                          <span className={'btn btn-secondary join-item'}>{convertUnitToDisplayString(unit)}</span>
                        </div>
                      </div>
                    ))}
                    {errors.volume ? (
                      <div className={'text-center text-error'}>Mindestens 1 Einheit muss angegeben werden</div>
                    ) : (
                      <></>
                    )}
                  </div>
                </div>

                <div>
                  <label className={'label'}>
                    <span className={'label-text'}>Tags</span>
                    <span className={'label-text-alt text-error'}>
                      <>{errors.tags && touched.tags && errors.tags}</>
                    </span>
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
                      <img className={'h-32 rounded-lg'} src={values.image} alt={'Cocktail Image'} />
                    </div>
                  )}
                </div>
                <div className={'form-control'}>
                  <label className={'label'}>
                    <span className={'label-text'}>Link</span>
                    <span className={'label-text-alt space-x-2 text-error'}>
                      <span>
                        <>{errors.link && touched.link && errors.link}</>
                      </span>
                    </span>
                  </label>
                  <div className={'join'}>
                    <input
                      type={'text'}
                      placeholder={''}
                      className={`input join-item input-bordered w-full ${
                        errors.link && touched.link && 'input-error'
                      }`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.link}
                      name={'link'}
                    />
                    <button
                      className={`btn btn-primary join-item ${values.fetchingExternalData ? 'loading' : ''}`}
                      type={'button'}
                      disabled={
                        !(
                          values.link.includes('expert24.com') ||
                          values.link.includes('conalco.de') ||
                          values.link.includes('metro.de')
                        )
                      }
                      onClick={async () => {
                        await setFieldValue('fetchingExternalData', true);
                        fetch(`/api/scraper/ingredient?url=${values.link}`)
                          .then((response) => {
                            if (response.ok) {
                              return response.json().then((data) => {
                                setFieldValue('name', data.name);
                                if (data.price != 0) {
                                  setFieldValue('price', data.price);
                                }
                                setFieldValue('image', data.image);
                                if (data.volume != 0) {
                                  setFieldValue('volume_CL', data.volume);
                                }
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
