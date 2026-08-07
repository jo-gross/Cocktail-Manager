import type { UnitDto, UnitConversionDto } from '@lib/schemas/units';
import { Formik } from 'formik';
import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { FaArrowsLeftRight } from 'react-icons/fa6';
import { alertService } from '@lib/alertService';
import { Button, ButtonGroup, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Select } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createUnitConversion, updateUnitConversion } from '@lib/network/units';
import { alertApiV1Error } from '@lib/network/apiV1';

interface UnitConversionModalProps {
  unitConversion?: UnitConversionDto;
  units: UnitDto[];
  existingConversions?: UnitConversionDto[];
  onSaved?: () => void;
}

export default function UnitConversionModal(props: UnitConversionModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['settings', 'common', 'errors']);

  const router = useRouter();

  const { workspaceId } = router.query;

  const validateUnitConversion = useMemo(() => {
    const schema = z
      .object({
        fromUnitId: z.string().trim().min(1, t('errors:requiredField')),
        toUnitId: z.string().trim().min(1, t('errors:requiredField')),
        factor: z.coerce.number(),
      })
      .refine((values) => Number.isNaN(values.factor) || values.factor > 0, {
        message: t('settings:validation.factorGtZero'),
        path: ['factor'],
      });
    return zodFormikValidate(schema);
  }, [t]);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{t('settings:unitConversionTitle')}</div>
      <Formik
        initialValues={{
          fromUnitId: props.unitConversion?.fromUnitId || '',
          toUnitId: props.unitConversion?.toUnitId || '',
          factor: props.unitConversion?.factor || 1,
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            if (props.unitConversion == undefined) {
              await createUnitConversion(workspaceId, {
                fromUnitId: values.fromUnitId,
                toUnitId: values.toUnitId,
                factor: Number(values.factor),
              });
              props.onSaved?.();
              modalContext.closeModal();
              alertService.success(t('settings:conversionCreated'));
            } else {
              await updateUnitConversion(workspaceId, props.unitConversion.id, {
                factor: Number(values.factor),
              });
              props.onSaved?.();
              modalContext.closeModal();
              alertService.success(t('settings:conversionSaved'));
            }
          } catch (error) {
            alertApiV1Error(error, props.unitConversion == undefined ? t('errors:createConversion') : t('errors:saveConversion'));
          }
        }}
        validate={(values) => validateUnitConversion(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-row items-center justify-center gap-4'}>
              <FormControl className="w-full">
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:fromUnit')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.fromUnitId && touched.fromUnitId ? errors.fromUnitId : ''}</span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <ButtonGroup className="w-full">
                  <Button joinItem variant="secondary" type="button" tabIndex={-1}>
                    1
                  </Button>
                  <Select
                    joinItem
                    className="w-full"
                    name={'fromUnitId'}
                    disabled={props.unitConversion != undefined}
                    onChange={async (e) => {
                      handleChange(e);
                      await setFieldValue('toUnitId', '');
                    }}
                    value={values.fromUnitId}
                  >
                    <option value={''} disabled>
                      {t('common:selectEllipsis')}
                    </option>
                    {props.units.map((unit) => {
                      return (
                        <option key={unit.id} value={unit.id}>
                          {userContext.getTranslation(unit.name)}
                        </option>
                      );
                    })}
                  </Select>
                </ButtonGroup>
              </FormControl>

              <div className={'flex flex-row items-center justify-center pt-8 text-2xl'}>
                <FaArrowsLeftRight />
              </div>

              <FormControl className="w-full">
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:toUnit')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.toUnitId && touched.toUnitId ? errors.toUnitId : errors.factor && touched.factor ? errors.factor : ''}</span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <ButtonGroup className="w-full">
                  <Input joinItem type={'number'} name={'factor'} onChange={handleChange} value={values.factor} placeholder={'x'} className="w-20" />
                  <Select
                    joinItem
                    disabled={props.unitConversion != undefined}
                    className="w-full"
                    name={'toUnitId'}
                    onChange={handleChange}
                    value={values.toUnitId}
                  >
                    <option value={''} disabled>
                      {t('common:selectEllipsis')}
                    </option>
                    {props.units.map((unit) => {
                      return (
                        <option
                          key={unit.id}
                          value={unit.id}
                          disabled={
                            values.fromUnitId == unit.id ||
                            props.existingConversions?.find(
                              (item) =>
                                (item.fromUnitId == values.fromUnitId && item.toUnitId == unit.id) ||
                                (item.toUnitId == values.fromUnitId && item.fromUnitId == unit.id),
                            ) != undefined
                          }
                        >
                          {userContext.getTranslation(unit.name)}
                        </option>
                      );
                    })}
                  </Select>
                </ButtonGroup>
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
                {t('common:save')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
