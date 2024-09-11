import { Formik, FormikProps } from 'formik';
import { useRouter } from 'next/router';
import React, { useContext, useState } from 'react';
import { UploadDropZone } from '../UploadDropZone';
import { convertBase64ToFile, convertToBase64 } from '../../lib/Base64Converter';
import { FaTrashAlt } from 'react-icons/fa';
import { alertService } from '../../lib/alertService';
import { DeleteConfirmationModal } from '../modals/DeleteConfirmationModal';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { compressFile } from '../../lib/ImageCompressor';
import { GarnishWithImage } from '../../models/GarnishWithImage';
import Image from 'next/image';
import CropComponent from '../CropComponent';
import { FaCropSimple } from 'react-icons/fa6';
import _ from 'lodash';

interface GarnishFormProps {
  garnish?: GarnishWithImage;
  setUnsavedChanges?: (unsavedChanges: boolean) => void;
  formRef?: React.RefObject<FormikProps<any>>;

  onSaved?: (id: string) => void;
}

export function GarnishForm(props: GarnishFormProps) {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);

  const formRef = props.formRef || React.createRef<FormikProps<any>>();

  const [similarGarnish, setSimilarGarnish] = useState<GarnishWithImage | undefined>();

  return (
    <Formik
      innerRef={formRef}
      initialValues={{
        name: props.garnish?.name ?? '',
        price: props.garnish?.price ?? undefined,
        description: props.garnish?.description ?? '',
        notes: props.garnish?.notes ?? '',
        image: props.garnish?.GarnishImage?.[0]?.image ?? undefined,
        originalImage: (props.garnish?.GarnishImage.length ?? 0) ? convertBase64ToFile(props.garnish!.GarnishImage[0].image) : undefined,
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.garnish == undefined ? undefined : props.garnish.id,
            name: values.name,
            price: values.price == '' ? null : values.price,
            description: values.description?.trim() == '' ? null : values.description?.trim(),
            notes: values.notes?.trim() == '' ? null : values.notes?.trim(),
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
                props.onSaved((await response.json()).data.id);
              } else {
                router.replace(`/workspaces/${workspaceId}/manage/garnishes`).then(() => alertService.success('Garnitur erfolgreich erstellt'));
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
                props.onSaved(props.garnish.id);
              } else {
                router.replace(`/workspaces/${workspaceId}/manage/garnishes`).then(() => alertService.success('Garnitur erfolgreich gespeichert'));
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
        if (props.garnish) {
          const reducedOriginal = _.omit(props.garnish, ['id', 'workspaceId', 'GarnishImage']);
          const reducedValues = _.omit(values, ['image', 'originalImage']);
          const areImageEqual = (props.garnish.GarnishImage.length > 0 ? props.garnish.GarnishImage[0].image.toString() : undefined) == values.image;
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
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, isValid, setFieldValue }) => (
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
              placeholder={'Name'}
              className={`input input-bordered ${errors.name && touched.name && 'input-error'} w-full`}
              onChange={(event) => {
                if (event.target.value.length > 2) {
                  fetch(`/api/workspaces/${workspaceId}/garnishes/check?name=${event.target.value}`)
                    .then((response) => response.json())
                    .then((data) => {
                      console.log(data);
                      if (data.data != null) {
                        setSimilarGarnish(data.data);
                      } else {
                        setSimilarGarnish(undefined);
                      }
                    });
                } else {
                  setSimilarGarnish(undefined);
                }
                handleChange(event);
              }}
              onBlur={handleBlur}
              value={values.name}
              name={'name'}
            />
            {similarGarnish && (
              <div className="label">
                <span className="label-text-alt text-warning">
                  Eine Ähnliche Zutat mit dem namen <strong>{similarGarnish.name}</strong> existiert bereits.
                </span>
              </div>
            )}
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
              placeholder={'Lagerort, Lieferant, etc.'}
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
              placeholder={'Lagerort, Lieferant, etc.'}
              rows={5}
            />
          </div>

          <div className={'form-control'}>
            <label className={'label'} htmlFor={'description'}>
              <span className={'label-text'}>Allgemeine Beschreibung</span>
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
              placeholder={'Das Öl der Zeste hilft, den Geschmack des Cocktails zu intensivieren, ...'}
              rows={5}
            />
          </div>
          <div className={'form-control'}>
            <label className={'label'} htmlFor={'price'}>
              <span className={'label-text'}>Preis</span>
              <span className={'label-text-alt space-x-2 text-error'}>
                <>{errors.price && touched.price && errors.price}</>
              </span>
            </label>
            <div className={'join'}>
              <input
                id={'price'}
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
              <div className={'label'}>
                <span className={'label-text'}>Zutaten Bild</span>
              </div>
            ) : null}
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
                    const compressedImageFile = await compressFile(file);
                    await setFieldValue('image', await convertToBase64(compressedImageFile));
                  }}
                  onCropCancel={async () => {
                    await setFieldValue('image', undefined);
                    await setFieldValue('originalImage', undefined);
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
                    onClick={() => {
                      modalContext.openModal(
                        <DeleteConfirmationModal
                          spelling={'REMOVE'}
                          entityName={'das Bild'}
                          onApprove={async () => {
                            await setFieldValue('originalImage', undefined);
                            await setFieldValue('image', undefined);
                          }}
                        />,
                      );
                    }}
                  >
                    <FaTrashAlt />
                  </div>
                </div>
                <div className={'relative h-32 w-32 rounded-lg bg-white'}>
                  <Image className={'w-fit rounded-lg'} src={values.image} layout={'fill'} objectFit={'contain'} alt={'Garnish image'} />
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
              {isSubmitting ? <span className={'loading loading-spinner'} /> : null}
              Speichern
            </button>
          </div>
          {!isValid && (
            <div className={'font-thin italic text-error'}>
              Nicht alle Felder sind korrekt ausgefüllt. Kontrolliere daher alle Felder. (Name gesetzt, Bild zugeschnitten, ... ?)
            </div>
          )}
        </form>
      )}
    </Formik>
  );
}
