import type { UnitDto } from '@lib/schemas/units';
import { Formik } from 'formik';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createUnit } from '@lib/network/units';
import { upsertTranslation } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { useLabelLocales } from '@components/settings/EntityTranslationLabels';
import { activeLabelValues, initialLabelValues, LabelTranslationInputs, labelValuesSchema } from '@components/settings/LabelTranslationInputs';

interface UnitModalProps {
  unit?: UnitDto;
  onSaved?: () => void;
}

export default function UnitModal(props: UnitModalProps) {
  const { t } = useTranslation(['settings', 'common', 'entity', 'errors']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;
  const labelLocales = useLabelLocales();

  const unitFormSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t('settings:validation.invalidIdentifier'))
      .regex(/^[A-Z_]+$/, t('settings:validation.azOnly')),
    labels: labelValuesSchema(labelLocales, t('settings:validation.invalidLabel')),
  });

  const validateUnit = zodFormikValidate(unitFormSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.unit == undefined ? t('settings:unitModal.create') : t('settings:unitModal.edit')}</div>
      <Formik
        initialValues={{
          name: props.unit?.name || '',
          labels: initialLabelValues(userContext.translations, props.unit?.name),
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId || labelLocales.length === 0) return;
            const translations = activeLabelValues(values.labels, labelLocales);
            if (props.unit == undefined) {
              await createUnit(workspaceId, {
                name: values.name,
                translations,
              });
              alertService.success(t('entity:unitCreated'));
            } else {
              await upsertTranslation(workspaceId, {
                key: values.name,
                translations,
              });
              alertService.success(t('entity:unitSaved'));
            }
            userContext.patchTranslations(values.name, translations);
            props.onSaved?.();
            modalContext.closeModal();
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, props.unit == undefined ? t('errors:create') : t('errors:save'));
          }
        }}
        validate={(values) => validateUnit(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <FormControl>
              <Label className="flex-row items-center justify-between">
                <LabelText>{t('common:identifierAz')}</LabelText>
                <LabelTextAlt className="text-error">
                  <span>{errors.name && touched.name ? errors.name : ''}</span>
                  <span>{t('common:required')}</span>
                </LabelTextAlt>
              </Label>
              <Input
                id={'name'}
                readOnly={props.unit != undefined}
                name={'name'}
                value={values.name}
                onChange={handleChange}
                disabled={props.unit != undefined}
              />
            </FormControl>
            <LabelTranslationInputs locales={labelLocales} />
            <div className={'flex justify-end gap-2'}>
              <Button
                variant="outline"
                className="border-error text-error hover:bg-error/10"
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                {t('common:cancel')}
              </Button>
              <Button variant="primary" type={'submit'} disabled={isSubmitting || labelLocales.length === 0}>
                {isSubmitting ? <Loading size="sm" /> : null}
                {props.unit == undefined ? t('common:create') : t('common:save')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
