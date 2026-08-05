import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { toInteger } from 'lodash';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, StarRatingInput, Textarea } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createCocktailRating } from '@lib/network/cocktailRatings';
import { alertApiV1Error } from '@lib/network/apiV1';

interface CocktailRatingModalProps {
  cocktailId: string;
  cocktailName: string;
  onCreated?: () => void;
}

const cocktailRatingSchema = z.object({
  name: z.string().optional(),
  rating: z.coerce.number().min(1, 'Die Bewertung muss zwischen 1 und 5 liegen').max(5, 'Die Bewertung muss zwischen 1 und 5 liegen'),
  comment: z.string().optional(),
});

const validateCocktailRating = zodFormikValidate(cocktailRatingSchema);

export default function AddCocktailRatingModal(props: CocktailRatingModalProps) {
  const _userContext = useContext(UserContext);
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
            if (!workspaceId) return;
            await createCocktailRating(workspaceId, props.cocktailId, {
              name: values.name,
              rating: toInteger(values.rating),
              comment: values.comment,
            });
            modalContext.closeModal();
            props.onCreated?.();
            alertService.success('Bewertung hinzugefügt');
          } catch (error) {
            alertApiV1Error(error, 'Fehler beim Erstellen der Bewertung');
          }
        }}
        validate={(values) => validateCocktailRating(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue: _setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-col gap-2'}>
              <FormControl>
                <Label htmlFor={'name'} className="flex-row items-center justify-between">
                  <LabelText>
                    Name <span className={'italic'}>(optional)</span>
                  </LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.name && touched.name ? errors.name : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'name'} name={'name'} value={values.name} onChange={handleChange} placeholder={'z.B. Manuel Neuer'} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Bewertung</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.rating && touched.rating ? errors.rating : ''}</span>
                  </LabelTextAlt>
                </Label>
                <StarRatingInput name="rating" value={values.rating} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>
                    Kommentar <span className={'italic'}>(optional)</span>
                  </LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.comment && touched.comment ? errors.comment : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Textarea id={'comment'} name={'comment'} value={values.comment} onChange={handleChange} rows={4} placeholder={'Unfassbar geiler Cocktail!'} />
              </FormControl>
            </div>
            <div className={'flex justify-end gap-2'}>
              <Button
                variant="outline"
                className="border-error text-error hover:bg-error/10"
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" type={'submit'}>
                {isSubmitting ? <Loading size="sm" /> : null}
                Hinzufügen
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
