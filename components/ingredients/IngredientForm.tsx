import { FieldArray, Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { updateTags, validateTag } from '../../models/tags/TagUtils';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '../../lib/Base64Converter';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import _ from 'lodash';
import { compressFile } from '../../lib/ImageCompressor';
import { IngredientWithImage } from '../../models/IngredientWithImage';
import { Unit, UnitConversion } from '@prisma/client';
import { UserContext } from '../../lib/context/UserContextProvider';
import { fetchUnitConversions, fetchUnits } from '../../lib/network/units';
import Image from 'next/image';
import { DaisyUITagInput } from '../DaisyUITagInput';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';

interface IngredientFormProps {
  ingredient?: IngredientWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;
  onSaved?: (id: string) => void;
}

interface FormUnitValue {
  unitId: string;
  volume: number;
}

interface FormValue {
  name: string;
  shortName: string;
  notes: string;
  description: string;
  price: number | undefined;
  units: FormUnitValue[];
  link: string;
  tags: string[];
  image: string | undefined;
  originalImage?: File | undefined;
}

export function IngredientForm(props: IngredientFormProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const formRef = props.formRef || React.createRef<FormikProps<any>>();

  const [loadingUnits, setUnitsLoading] = useState(false);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);

  const [loadingDefaultConversions, setLoadingDefaultConversions] = useState(false);
  const [defaultConversions, setDefaultConversions] = useState<UnitConversion[]>([]);

  useEffect(() => {
    fetchUnits(workspaceId, setAllUnits, setUnitsLoading);
    fetchUnitConversions(workspaceId, setLoadingDefaultConversions, setDefaultConversions);
  }, [workspaceId]);

  const initialValues: FormValue = {
    name: props.ingredient?.name ?? '',
    shortName: props.ingredient?.shortName ?? '',
    notes: props.ingredient?.notes ?? '',
    description: props.ingredient?.description ?? '',
    price: props.ingredient?.price ?? undefined,
    units: props.ingredient?.IngredientVolume ?? [],
    link: props.ingredient?.link ?? '',
    tags: props.ingredient?.tags ?? [],
    image: props.ingredient?.IngredientImage?.[0]?.image ?? undefined,
    originalImage: (props.ingredient?.IngredientImage.length ?? 0) > 0 ? convertBase64ToFile(props.ingredient!.IngredientImage?.[0]?.image) : undefined,
  };

  return (
    <Formik
      innerRef={formRef}
      initialValues={initialValues}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.ingredient == undefined ? undefined : props.ingredient.id,
            name: values.name.trim(),
            shortName: values.shortName?.trim() == '' ? null : values.shortName?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            price: values.price == '' ? null : values.price,
            units: values.units || [],
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
        if (props.ingredient) {
          const reducedOriginal = _.omit(props.ingredient, ['IngredientImage', 'id', 'workspaceId']);
          if (reducedOriginal.link == null) {
            reducedOriginal.link = '';
          }
          if (reducedOriginal.description == null) {
            reducedOriginal.description = '';
          }
          if (reducedOriginal.notes == null) {
            reducedOriginal.notes = '';
          }
          if (reducedOriginal.shortName == null) {
            reducedOriginal.shortName = '';
          }
          const reducedValues = _.omit(values, ['image', 'originalImage']);

          const areImageEqual =
            (props.ingredient.IngredientImage.length > 0 ? props.ingredient.IngredientImage[0].image.toString() : undefined) == values.image;
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
      {({ values, setFieldValue, errors, setFieldError, touched, handleChange, handleBlur, handleSubmit, isSubmitting, isValid }) => (
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
              type={'text'}
              autoComplete={'off'}
              className={`input input-bordered ${errors.name && touched.name && 'input-error'}`}
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.name}
              name={'name'}
            />
          </div>
          <div className={'form-control'}>
            <label className={'label'} htmlFor={'shortName'}>
              <span className={'label-text'}>Abkürzung</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.shortName && touched.shortName && errors.shortName}</>
                </span>
              </span>
            </label>
            <input
              id={'shortName'}
              type={'text'}
              className={`input input-bordered ${errors.shortName && touched.shortName && 'input-error'}`}
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.shortName}
              name={'shortName'}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'description'}>
              <span className={'label-text'}>Allgemeine Produktbeschreibung</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.description && touched.description && errors.description}</>
                </span>
              </span>
            </label>
            <textarea
              id={'description'}
              className={`textarea textarea-bordered ${errors.description && touched.description && 'textarea-error'} w-full`}
              value={values.description}
              onChange={handleChange}
              onBlur={handleBlur}
              name={'description'}
              placeholder={'Herkunft, Geschichte, etc.'}
              rows={5}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'notes'}>
              <span className={'label-text'}>Notizen</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.notes && touched.notes && errors.notes}</>
                </span>
              </span>
            </label>
            <textarea
              id={'notes'}
              className={`textarea textarea-bordered ${errors.notes && touched.notes && 'textarea-error'} w-full`}
              value={values.notes}
              onChange={handleChange}
              onBlur={handleBlur}
              name={'notes'}
              placeholder={'Lagerort, Zubereitung, etc.'}
              rows={5}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'price'}>
              <span className={'label-text'}>Preis</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.price && touched.price && errors.price}</>
                </span>
              </span>
            </label>
            <div className={'join'}>
              <input
                id={'price'}
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
          <FieldArray name={'units'}>
            {({ push: pushUnit, remove: removeUnit }) => (
              <>
                <div className={'label-text'}>Mengen</div>
                <table className={'table table-zebra'}>
                  <thead>
                    <tr>
                      <td colSpan={4}>Verfügbare Einheiten</td>
                    </tr>
                  </thead>
                  <tbody>
                    {values.units.length == 0 ? (
                      <tr>
                        <td colSpan={4} className={'text-center'}>
                          Keine Einheiten hinzugefügt
                        </td>
                      </tr>
                    ) : (
                      (values.units as FormUnitValue[]).map((unit, index) => (
                        <tr key={`selected-units-${unit.unitId}`}>
                          <td>{unit.volume}</td>
                          <td>{userContext.getTranslation(allUnits.find((availableUnit) => availableUnit.id == unit.unitId)?.name ?? 'N/A', 'de')}</td>
                          <td>
                            {values.price != undefined ? (values.price / unit.volume).toFixed(2).replace(/\D00(?=\D*$)/, '') : '-'} €/
                            {userContext.getTranslation(allUnits.find((availableUnit) => availableUnit.id == unit.unitId)?.name ?? 'N/A', 'de')}
                          </td>
                          <td className={'flex flex-row items-center justify-center'}>
                            <div
                              className={'btn btn-square btn-error btn-sm'}
                              // type={'button'}
                              onClick={() => {
                                removeUnit(index);
                              }}
                            >
                              <FaTrashAlt />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className={'form-control'}>
                  <label className={'label'} htmlFor={'anotherVolume'}>
                    <span className={'label-text'}>Weitere Menge hinzufügen</span>
                    <span className={'label-text-alt space-x-2 text-error'}>
                      <span>
                        <>{errors.volume && touched.volume && errors.volume}</>
                      </span>
                      <span>*</span>
                    </span>
                  </label>
                  <div className={'join'}>
                    <input
                      id={'anotherVolume'}
                      type={'number'}
                      className={`input input-sm join-item input-bordered w-full ${errors.volume && touched.volume && 'input-error'}`}
                      value={values.volume}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'volume'}
                    />
                    <select
                      className={`join-item select select-bordered select-sm ${errors.selectedUnit && 'select-error'}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name={'selectedUnit'}
                      value={values.selectedUnit}
                    >
                      {loadingUnits ? (
                        <option value={''} disabled={true}>
                          Lade...
                        </option>
                      ) : allUnits.length == 0 ? (
                        <option value={''}>Keine Einheiten verfügbar</option>
                      ) : (
                        <>
                          <option value={''} disabled>
                            Auswählen...
                          </option>
                          {allUnits
                            .sort((a, b) => userContext.getTranslation(a.name, 'de').localeCompare(userContext.getTranslation(b.name, 'de')))
                            .map((unit) => (
                              <option
                                key={`unit-option-${unit.id}`}
                                value={unit.id}
                                disabled={(values.units as FormUnitValue[]).find((u) => u.unitId == unit.id) != undefined}
                              >
                                {userContext.getTranslation(unit.name, 'de')}
                              </option>
                            ))}
                        </>
                      )}
                    </select>
                    <button
                      className={'btn btn-primary join-item btn-sm'}
                      type={'button'}
                      disabled={loadingUnits || values.volume == 0 || values.selectedUnit == '' || isNaN(values.volume) || values.selectedUnit == undefined}
                      onClick={async () => {
                        pushUnit({ unitId: values.selectedUnit, volume: values.volume });
                        await setFieldValue('selectedUnit', '');
                      }}
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
                <div>
                  <div className={'label-text'}>Mengen vorschläge</div>
                  <ul className={'list-inside list-disc'}>
                    {_.uniqBy(
                      defaultConversions
                        .filter((conversion) => (formRef?.current?.values.units as FormUnitValue[]).map((u) => u.unitId).includes(conversion.fromUnitId))
                        .filter((conversion) => !(formRef?.current?.values.units as FormUnitValue[]).map((u) => u.unitId).includes(conversion.toUnitId))
                        .map((suggestion) => ({
                          unitId: suggestion.toUnitId,
                          volume:
                            suggestion.factor * (formRef?.current?.values.units as FormUnitValue[]).find((u) => u.unitId == suggestion.fromUnitId)!.volume,
                        })),
                      function (e) {
                        return e.unitId;
                      },
                    ).map((suggestion, suggestionIndex) => (
                      <li key={`unit-conversion-suggestion-${suggestionIndex}`} className={'space-x-2 italic'}>
                        <span className={'p-2'}>{suggestion.volume.toFixed(2).replace(/\D00(?=\D*$)/, '')}</span>
                        <span className={'p-2'}>{userContext.getTranslation(allUnits.find((unit) => unit.id == suggestion.unitId)?.name ?? 'N/A', 'de')}</span>
                        <span
                          className={'btn btn-ghost btn-sm'}
                          onClick={async () => {
                            pushUnit(suggestion);
                          }}
                        >
                          Hinzufügen
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </FieldArray>

          <div>
            <div className={'label'}>
              <span className={'label-text'}>Tags</span>
              <span className={'label-text-alt text-error'}>
                <>{errors.tags && errors.tags}</>
              </span>
            </div>
            <DaisyUITagInput
              value={values.tags}
              onChange={(tags) =>
                setFieldValue(
                  'tags',
                  updateTags(tags, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft')),
                )
              }
              validate={(tag) => validateTag(tag, (text) => setFieldError('tags', text ?? 'Tag fehlerhaft'))}
            />
          </div>
          <div className={'col-span-2'}>
            {values.image != undefined ? (
              <div className={'label'}>
                <span className={'label-text'}>Zutaten Bild</span>
              </div>
            ) : (
              <></>
            )}
            {values.image == undefined && values.originalImage == undefined ? (
              <UploadDropZone
                onSelectedFilesChanged={async (file) => {
                  if (file != undefined) {
                    await setFieldValue('image', undefined);
                    await setFieldValue('originalImage', file);
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
                    const value = await convertToBase64(compressedImageFile);
                    await setFieldValue('image', value);
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
                            await setFieldValue('originalImage', undefined);
                            await setFieldValue('image', undefined);
                          }}
                        />,
                      )
                    }
                  >
                    <FaTrashAlt />
                  </div>
                </div>
                <div className={'relative h-32 w-32 rounded-lg bg-white'}>
                  <Image className={'w-fit rounded-lg'} src={values.image} layout={'fill'} objectFit={'contain'} alt={'Ingredient Image'} />
                </div>
                <div className={'pt-2 font-thin italic'}>
                  Info: Durch speichern des Cocktails wird das Bild dauerhaft zugeschnitten. Das Original wird nicht gespeichert. (Falls du später also doch
                  andere Bereiche auswählen möchtest, musst du das Bild dann erneut auswählen)
                </div>
              </div>
            )}
          </div>
          <div className={'form-control'}>
            <label className={'label'} htmlFor={'link'}>
              <span className={'label-text'}>Link</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <span>
                  <>{errors.link && touched.link && errors.link}</>
                </span>
              </span>
            </label>
            <div className={'join'}>
              <input
                id={'link'}
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
                        response.json().then(async (data) => {
                          await setFieldValue('name', data.name);
                          if (data.price != 0) {
                            await setFieldValue('price', data.price);
                          }

                          if (data.image) {
                            await setFieldValue('image', undefined);
                            await setFieldValue('originalImage', convertBase64ToFile(data.image));
                          }
                          if (data.volume != 0) {
                            await setFieldValue('volume', data.volume);
                          }
                          await setFieldValue('selectedUnit', allUnits.find((unit) => unit.name == 'CL')?.id ?? '');
                        });
                      } else {
                        alertService.warn('Es konnten keine Daten über die URL geladen werden.');
                      }
                    })
                    .finally(async () => {
                      await setFieldValue('fetchingExternalData', false);
                      await setFieldValue('image', undefined);
                    });
                }}
              >
                {values.fetchingExternalData ? <span className={'loading loading-spinner'}></span> : <></>}
                <FaSyncAlt />
              </button>
            </div>
          </div>
          <div className={'form-control'}>
            <button type={'submit'} className={`btn btn-primary`} disabled={isSubmitting || !isValid}>
              {isSubmitting ? <span className={'loading loading-spinner'} /> : <></>}
              Speichern
            </button>
          </div>
        </form>
      )}
    </Formik>
  );
}
