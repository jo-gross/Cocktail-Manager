import type { ActionDto } from '@lib/schemas/actions';
import { Field, Formik } from 'formik';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Radio } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createAction, updateAction } from '@lib/network/actions';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getDefaultDilutionPercent } from '@lib/guest-info/constants';
import { useLabelLocales } from '@components/settings/EntityTranslationLabels';
import { activeLabelValues, initialLabelValues, LabelTranslationInputs, labelValuesSchema } from '@components/settings/LabelTranslationInputs';

interface CocktailStepActionModalProps {
  cocktailStepAction?: ActionDto;
  cocktailStepActionGroups?: string[];
  onSaved?: () => void;
}

export default function CocktailStepActionModal(props: CocktailStepActionModalProps) {
  const { t } = useTranslation(['settings', 'common', 'entity', 'errors', 'guestInfo']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;
  const labelLocales = useLabelLocales();

  const cocktailStepActionSchema = z
    .object({
      actionGroup: z.string(),
      action: z.string(),
      labels: labelValuesSchema(labelLocales, t('settings:validation.invalidLabel')),
      dilutionPercent: z.union([z.literal(''), z.coerce.number().min(0, t('guestInfo:form.abvRange')).max(100, t('guestInfo:form.abvRange'))]),
    })
    .superRefine((values, ctx) => {
      // The action-group identifier is edited via the "newActionGroup" field, so
      // its error is reported on that path (mirrors the original inline validation).
      if (values.actionGroup.trim() != '') {
        if (!/^[A-Z_]+$/.test(values.actionGroup)) {
          ctx.addIssue({ code: 'custom', message: t('settings:validation.azOnly'), path: ['newActionGroup'] });
        }
      } else {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.invalidIdentifier'), path: ['newActionGroup'] });
      }

      if (!values.action || values.action.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.invalidIdentifier'), path: ['action'] });
      } else if (!/^[A-Z_]+$/.test(values.action)) {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.azOnly'), path: ['action'] });
      }
    });

  const validateCocktailStepAction = zodFormikValidate(cocktailStepActionSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.cocktailStepAction == undefined ? t('settings:actionModal.create') : t('settings:actionModal.edit')}</div>
      <Formik
        initialValues={{
          actionGroup: props.cocktailStepAction?.actionGroup || '',
          action: props.cocktailStepAction?.name || '',
          description: '',
          newActionGroup: '',
          labels: initialLabelValues(userContext.translations, props.cocktailStepAction?.name),
          dilutionPercent: (props.cocktailStepAction?.dilutionPercent ?? '') as number | '',
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId || labelLocales.length === 0) return;
            const actionGroup = values.actionGroup?.trim();
            if (!actionGroup) {
              alertService.error(t('settings:validation.actionGroupRequired'));
              return;
            }
            const body = {
              name: values.action,
              actionGroup,
              dilutionPercent: values.dilutionPercent === '' ? null : Number(values.dilutionPercent),
              translations: activeLabelValues(values.labels, labelLocales),
            };
            if (props.cocktailStepAction == undefined) {
              await createAction(workspaceId, body);
              alertService.success(t('entity:actionCreated'));
            } else {
              await updateAction(workspaceId, props.cocktailStepAction.id, body);
              alertService.success(t('entity:actionSaved'));
            }
            userContext.patchTranslations(values.action, body.translations);
            props.onSaved?.();
            modalContext.closeModal();
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, props.cocktailStepAction == undefined ? t('errors:create') : t('errors:save'));
          }
        }}
        validate={(values) => validateCocktailStepAction(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div role={'group'}>
              {props.cocktailStepActionGroups?.map((actionGroup) => (
                <FormControl key={`action-group-radio-${actionGroup}`}>
                  <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                    <Field type={'radio'} as={Radio} name={'actionGroup'} value={actionGroup} />
                    <LabelText className="w-full">
                      {userContext.getTranslation(actionGroup)} ({actionGroup})
                    </LabelText>
                  </Label>
                </FormControl>
              ))}
              <FormControl key={`action-group-radio-new-group`}>
                <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                  <Field type={'radio'} as={Radio} name={'actionGroup'} value={values.newActionGroup} />
                  <div className="flex w-full flex-col">
                    <LabelText>{t('settings:newGroupIdentifier')}</LabelText>
                    <LabelTextAlt className="text-end text-error">
                      <span>{errors.newActionGroup && touched.newActionGroup ? errors.newActionGroup : ''}</span>
                    </LabelTextAlt>
                    <Input
                      id={'newActionGroup'}
                      name={'newActionGroup'}
                      value={values.newActionGroup}
                      onChange={async (event) => {
                        handleChange(event);
                        await setFieldValue('actionGroup', event.target.value);
                      }}
                      className="w-full"
                    />
                  </div>
                </Label>
              </FormControl>
            </div>
            <FormControl>
              <Label className="flex-row items-center justify-between">
                <LabelText>{t('common:identifierAz')}</LabelText>
                <LabelTextAlt className="text-error">
                  <span>{errors.action && touched.action ? errors.action : ''}</span>
                  <span>{t('common:required')}</span>
                </LabelTextAlt>
              </Label>
              <Input
                id={'action'}
                readOnly={props.cocktailStepAction != undefined}
                name={'action'}
                value={values.action}
                onChange={handleChange}
                disabled={props.cocktailStepAction != undefined}
              />
            </FormControl>
            <LabelTranslationInputs locales={labelLocales} />
            <FormControl>
              <Label htmlFor={'dilutionPercent'} className="flex-row items-center justify-between">
                <LabelText>{t('guestInfo:form.dilution')}</LabelText>
                <LabelTextAlt className="text-error">
                  <span>{errors.dilutionPercent ?? ''}</span>
                </LabelTextAlt>
              </Label>
              <Input
                id={'dilutionPercent'}
                name={'dilutionPercent'}
                type={'number'}
                inputMode={'decimal'}
                min={0}
                max={100}
                step={1}
                placeholder={String(getDefaultDilutionPercent(values.action))}
                value={values.dilutionPercent}
                onChange={handleChange}
              />
              <span className="text-xs text-base-content/60">{t('guestInfo:form.dilutionHint', { value: getDefaultDilutionPercent(values.action) })}</span>
            </FormControl>
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
                {props.cocktailStepAction == undefined ? t('common:create') : t('common:save')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
