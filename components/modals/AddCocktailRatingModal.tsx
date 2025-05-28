import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { toInteger } from 'lodash';

interface CocktailRatingModalProps {
  cocktailId: string;
  cocktailName: string;
  onCreated?: () => void;
}

export default function AddCocktailRatingModal(props: CocktailRatingModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.cocktailName} - Bewertung hinzufügen</div>
      <Formik
        initialValues={{
          name: undefined,
          rating: 3,
          comment: undefined,
        }}
        onSubmit={async (values) => {
          try {
            const body = {
              name: values.name,
              rating: toInteger(values.rating),
              comment: values.comment,
            };

            const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${props.cocktailId}/ratings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              modalContext.closeModal();
              props.onCreated?.();
              alertService.success('Bewertung hinzugefügt');
            } else {
              const body = await response.json();
              console.error('CocktailRatingModal -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Zubereitungsmethode', response.status, response.statusText);
            }
          } catch (error) {
            console.error('CocktailRatingModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};
          if (values.rating < 1 || values.rating > 5) {
            errors.rating = 'Die Bewertung muss zwischen 1 und 5 liegen';
          }
          return errors;
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-col gap-2'}>
              <div className={'form-control'}>
                <label className={'label'} htmlFor={'name'}>
                  <div className={'label-text'}>
                    Name <span className={'italic'}>(optional)</span>
                  </div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.name && touched.name ? errors.name : ''}</span>
                  </div>
                </label>
                <input id={'name'} name={'name'} value={values.name} onChange={handleChange} className={`input`} placeholder={'z.B. Manuel Neuer'} />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Bewertung</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.rating && touched.rating ? errors.rating : ''}</span>
                  </div>
                </label>
                <div className="rating">
                  <input type="radio" value={1} name="rating" onChange={handleChange} checked={values.rating == 1} className="mask mask-star-2 bg-orange-400" />
                  <input type="radio" value={2} name="rating" onChange={handleChange} checked={values.rating == 2} className="mask mask-star-2 bg-orange-400" />
                  <input type="radio" value={3} name="rating" onChange={handleChange} checked={values.rating == 3} className="mask mask-star-2 bg-orange-400" />
                  <input type="radio" value={4} name="rating" onChange={handleChange} checked={values.rating == 4} className="mask mask-star-2 bg-orange-400" />
                  <input type="radio" value={5} name="rating" onChange={handleChange} checked={values.rating == 5} className="mask mask-star-2 bg-orange-400" />
                </div>
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>
                    Kommentar <span className={'italic'}>(optional)</span>
                  </div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.comment && touched.comment ? errors.comment : ''}</span>
                  </div>
                </label>
                <textarea
                  id={'comment'}
                  name={'comment'}
                  value={values.comment}
                  onChange={handleChange}
                  className={'textarea'}
                  rows={4}
                  placeholder={'Unfassbar geiler Cocktail!'}
                />
              </div>
            </div>
            <div className={'flex justify-end gap-2'}>
              <button
                className={'btn btn-outline btn-error'}
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                Abbrechen
              </button>
              <button className={'btn btn-primary'} type={'submit'}>
                {isSubmitting ? <span className={'spinner loading-spinner'} /> : <></>}
                Hinzufügen
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
