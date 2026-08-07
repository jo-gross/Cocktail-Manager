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

  const unitFormSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t('settings:validation.invalidIdentifier'))
      .regex(/^[A-Z_]+$/, t('settings:validation.azOnly')),
    labelDe: z.string().trim().min(1, t('settings:validation.invalidLabel')),
    labelEn: z.string(),
  });

  const validateUnit = zodFormikValidate(unitFormSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.unit == undefined ? t('settings:unitModal.create') : t('settings:unitModal.edit')}</div>
      <Formik
        initialValues={{
          name: props.unit?.name || '',
          labelDe: props.unit != undefined ? (userContext.translations?.de?.[props.unit.name] ?? '') : '',
          labelEn: props.unit != undefined ? (userContext.translations?.en?.[props.unit.name] ?? '') : '',
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            const translations = {
              de: values.labelDe.trim(),
              en: values.labelEn.trim(),
            };
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
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:labelDe')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.labelDe && touched.labelDe ? errors.labelDe : ''}</span>
                    <span>{t('common:required')}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'labelDe'} name={'labelDe'} value={values.labelDe} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:labelEn')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.labelEn && touched.labelEn ? errors.labelEn : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'labelEn'} name={'labelEn'} value={values.labelEn} onChange={handleChange} />
                {!values.labelEn.trim() ? <span className="text-xs text-base-content/60">{t('settings:missingEnHint')}</span> : null}
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
                {t('common:cancel')}
              </Button>
              <Button variant="primary" type={'submit'}>
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
