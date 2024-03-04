import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext } from 'react';
import { CocktailIngredientUnit } from '../../models/CocktailIngredientUnit';
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
import { IngredientWithImage } from '../../models/IngredientWithImage';

interface IngredientFormProps {
  ingredient?: IngredientWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;
  onSaved?: (id: string) => void;
}

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);

  const formRef = props.formRef;

  return (
    <Formik
      innerRef={formRef}
      initialValues={{
        name: props.ingredient?.name ?? '',
        shortName: props.ingredient?.shortName ?? '',
        notes: props.ingredient?.notes ?? '',
        description: props.ingredient?.description ?? '',
        price: props.ingredient?.price ?? undefined,
        volume: props.ingredient?.volume ?? 0,
        unit: props.ingredient?.unit ?? CocktailIngredientUnit.CL,
        link: props.ingredient?.link ?? '',
        tags: props.ingredient?.tags ?? [],
        image: props.ingredient?.IngredientImage?.[0]?.image ?? undefined,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.ingredient == undefined ? undefined : props.ingredient.id,
            name: values.name.trim(),
            shortName: values.shortName?.trim() == '' ? null : values.shortName?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            price: values.price == '' ? null : values.price,
            unit: values.unit,
            volume: values.volume,
            link: values.link?.trim() == '' ? null : values.link?.trim(),
            tags: values.tags,
            image: values.image?.trim() == '' ? null : values.image?.trim(),
          };
          if (props.ingredient == undefined) {
            const response = await fetch(`/api/workspaces/${workspaceId}/ingredients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved != undefined) {
                props.onSaved((await response.json()).data.id);
              } else {
                router.replace(`/workspaces/${workspaceId}/manage/ingredients`).then(() => alertService.success('Zutat erfolgreich erstellt'));
              }
            } else {
              const body = await response.json();
              console.error('IngredientForm -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Zutat', response.status, response.statusText);
            }
          } else {
            const response = await fetch(`/api/workspaces/${workspaceId}/ingredients/${props.ingredient.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              if (props.onSaved != undefined) {
                props.onSaved(props.ingredient.id);
              } else {
                router.replace(`/workspaces/${workspaceId}/manage/ingredients`).then(() => alertService.success('Zutat erfolgreich gespeichert'));
              }
            } else {
              const body = await response.json();
              console.error('IngredientForm -> onSubmit[update]', response);
              alertService.error(body.message ?? 'Fehler beim Speichern der Zutat', response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error('IngredientForm -> onSubmit', error);
          alertService.error('Es ist ein Fehler aufgetreten');
        }
      }}
      validate={(values) => {
        if (props.ingredient == undefined) {
          props.setUnsavedChanges?.(true);
        } else {
          const tempIngredient = _.omit(props.ingredient, ['IngredientImage', 'id', 'workspaceId']);
          if (tempIngredient.link == null) {
            tempIngredient.link = '';
          }
          if (tempIngredient.description == null) {
            tempIngredient.description = '';
          }
          if (tempIngredient.notes == null) {
            tempIngredient.notes = '';
          }
          if (tempIngredient.shortName == null) {
            tempIngredient.shortName = '';
          }
          const tempValues = _.omit(values, ['image']);
          props.setUnsavedChanges?.(!_.isEqual(tempIngredient, tempValues));
        }
        const errors: any = {};
        if (!values.name) {
          errors.name = 'Required';
        }
        if (values.volume.toString() == '' || isNaN(values.volume)) {
          errors.volume = 'Required';
        }
        if (values.volume <= 0) {
          errors.volume = 'Muss größer 0 sein';
        }
        if (!values.unit) {
          errors.unit = 'Required';
        }
        console.debug('Form errors', errors);
        return errors;
      }}
    >
      {({ values, setFieldValue, errors, setFieldError, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
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
              <span className={'label-text'}>Allg. Beschreibung</span>
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
              <span className={'label-text'}>Notizen</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.notes && touched.notes && errors.notes}</>
                </span>
              </span>
            </label>
            <textarea
              className={`textarea textarea-bordered ${errors.notes && touched.notes && 'textarea-error'} w-full`}
              value={values.notes}
              onChange={handleChange}
              onBlur={handleBlur}
              name={'notes'}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'}>
              <span className={'label-text'}>Preis</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.price && touched.price && errors.price}</>
                </span>
              </span>
            </label>
            <div className={'join'}>
              <input
                type={'number'}
                className={`input join-item input-bordered w-full ${errors.price && touched.price && 'input-error'}`}
                value={values.price}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'price'}
              />
              <span className={'btn btn-secondary join-item'}>€</span>
            </div>
          </div>
          <div className={'form-control'}>
            <label className={'label'}>
              <span className={'label-text'}>Menge</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.volume && touched.volume && errors.volume}</>
                </span>
                <span>*</span>
              </span>
            </label>
            <div className={'join'}>
              <input
                type={'number'}
                className={`input join-item input-bordered w-full ${errors.volume && touched.volume && 'input-error'}`}
                value={values.volume}
                onChange={handleChange}
                onBlur={handleBlur}
                name={'volume'}
              />
              <select
                className={`join-item select select-bordered ${errors.unit && 'select-error'}`}
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
            Preis/{values.unit}: {((values.price ?? 0) / (values.volume ?? 1)).toFixed(2)} €
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
              beforeAddValidate={(tag, _) => validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft'))}
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
                        onApprove={async () => {
                          await setFieldValue('image', undefined);
                        }}
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
                className={`input join-item input-bordered w-full ${errors.link && touched.link && 'input-error'}`}
                onChange={handleChange}
                onBlur={handleBlur}
                value={values.link}
                name={'link'}
              />
              <button
                className={`btn btn-primary join-item`}
                type={'button'}
                disabled={
                  !(
                    values.link.includes('expert24.com') ||
                    values.link.includes('conalco.de') ||
                    // values.link.includes('metro.de') ||
                    values.link.includes('rumundco.de') ||
                    values.link.includes('delicando.com')
                  ) || values.fetchingExternalData
                }
                onClick={async () => {
                  await setFieldValue('fetchingExternalData', true);
                  fetch(`/api/scraper/ingredient?url=${values.link}`)
                    .then((response) => {
                      if (response.ok) {
                        response.json().then((data) => {
                          setFieldValue('name', data.name);
                          if (data.price != 0) {
                            setFieldValue('price', data.price);
                          }
                          setFieldValue('image', data.image);
                          if (data.volume != 0) {
                            setFieldValue('volume', data.volume);
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
                {values.fetchingExternalData ? <span className={'loading loading-spinner'}></span> : <></>}
                <FaSyncAlt />
              </button>
            </div>
          </div>
          <div className={'form-control'}>
            <button type={'submit'} className={`btn btn-primary`} disabled={isSubmitting}>
              {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
              Speichern
            </button>
          </div>
        </form>
      )}
    </Formik>
  );
}
