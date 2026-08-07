import React, { useState, useEffect } from 'react';
import { Formik, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody, FormControl, Input, Label, LabelText, LabelTextAlt, Select } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';

interface EntityFormEntity {
  id: string;
  name: string;
  actionGroup?: string;
  [key: string]: unknown;
}

interface BaseEntityFormProps {
  initialData?: Record<string, unknown>;
  onDataChange: (data: Record<string, unknown>) => void;
  entity: EntityFormEntity;
}

function readLabelDe(data?: Record<string, unknown>): string {
  return String(data?.labelDe ?? data?.lableDE ?? '');
}

function readLabelEn(data?: Record<string, unknown>): string {
  return String(data?.labelEn ?? '');
}

interface UnitFormValues {
  identifier: string;
  labelDe: string;
  labelEn: string;
}

function UnitFormContent({ onDataChange }: { onDataChange: (data: Record<string, unknown>) => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const { values, handleChange, errors, touched } = useFormikContext<UnitFormValues>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      labelDe: values.labelDe,
      labelEn: values.labelEn,
    });
  }, [values.identifier, values.labelDe, values.labelEn, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">{t('settings:unitModal.create')}</div>
        <FormControl className="mb-2">
          <Label htmlFor="identifier" className="flex-row items-center justify-between">
            <LabelText className="text-xs">{t('common:identifierAz')}</LabelText>
            <LabelTextAlt className="text-xs text-error">
              <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
              <span>{t('common:required')}</span>
            </LabelTextAlt>
          </Label>
          <Input id="identifier" name="identifier" inputSize="sm" value={values.identifier} onChange={handleChange} />
        </FormControl>
        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="labelDe" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelDe')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelDe && touched.labelDe ? String(errors.labelDe) : ''}</span>
                <span>{t('common:required')}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelDe" name="labelDe" inputSize="sm" value={values.labelDe} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="labelEn" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelEn')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelEn && touched.labelEn ? String(errors.labelEn) : ''}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelEn" name="labelEn" inputSize="sm" value={values.labelEn} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function UnitForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  const { t } = useTranslation('settings');

  const unitFormSchema = z.object({
    identifier: z.string().superRefine((value, ctx) => {
      if (value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('validation.invalidIdentifier') });
      } else if (!/^[A-Z_]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: t('validation.azOnly') });
      }
    }),
    labelDe: z.string().refine((value) => value.trim() != '', { message: t('validation.invalidLabel') }),
    labelEn: z.string(),
  });

  return (
    <Formik<UnitFormValues>
      initialValues={{
        identifier: String(initialData?.name ?? entity.name ?? ''),
        labelDe: readLabelDe(initialData),
        labelEn: readLabelEn(initialData),
      }}
      validate={(values) => zodFormikValidate(unitFormSchema)(values)}
      onSubmit={() => {}}
      enableReinitialize
    >
      <UnitFormContent onDataChange={onDataChange} />
    </Formik>
  );
}

interface IceFormValues {
  identifier: string;
  labelDe: string;
  labelEn: string;
}

export type { IceFormValues };

function IceFormContent({ onDataChange }: { onDataChange: (data: Record<string, unknown>) => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const { values, handleChange, errors, touched } = useFormikContext<IceFormValues>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      labelDe: values.labelDe,
      labelEn: values.labelEn,
    });
  }, [values.identifier, values.labelDe, values.labelEn, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">{t('settings:createIce')}</div>
        <FormControl className="mb-2">
          <Label htmlFor="identifier" className="flex-row items-center justify-between">
            <LabelText className="text-xs">{t('common:identifierAz')}</LabelText>
            <LabelTextAlt className="text-xs text-error">
              <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
              <span>{t('common:required')}</span>
            </LabelTextAlt>
          </Label>
          <Input id="identifier" name="identifier" inputSize="sm" value={values.identifier} onChange={handleChange} />
        </FormControl>
        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="labelDe" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelDe')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelDe && touched.labelDe ? String(errors.labelDe) : ''}</span>
                <span>{t('common:required')}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelDe" name="labelDe" inputSize="sm" value={values.labelDe} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="labelEn" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelEn')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelEn && touched.labelEn ? String(errors.labelEn) : ''}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelEn" name="labelEn" inputSize="sm" value={values.labelEn} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function IceForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  const { t } = useTranslation('settings');

  const iceFormSchema = z.object({
    identifier: z.string().superRefine((value, ctx) => {
      if (value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('validation.invalidIdentifier') });
      } else if (!/^[A-Z_]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: t('validation.azOnly') });
      }
    }),
    labelDe: z.string().refine((value) => value.trim() != '', { message: t('validation.invalidLabel') }),
    labelEn: z.string(),
  });

  return (
    <Formik<IceFormValues>
      initialValues={{
        identifier: String(initialData?.name ?? entity.name ?? ''),
        labelDe: readLabelDe(initialData),
        labelEn: readLabelEn(initialData),
      }}
      validate={(values) => zodFormikValidate(iceFormSchema)(values)}
      onSubmit={() => {}}
      enableReinitialize
    >
      <IceFormContent onDataChange={onDataChange} />
    </Formik>
  );
}

interface StepActionFormProps extends BaseEntityFormProps {
  existingGroups?: string[];
}

interface StepActionFormValues {
  action: string;
  actionGroup: string;
  newActionGroup: string;
  labelDe: string;
  labelEn: string;
}

function StepActionFormContent({
  onDataChange,
  existingGroups = [],
  newGroupMode,
  setNewGroupMode,
}: {
  onDataChange: (data: Record<string, unknown>) => void;
  existingGroups: string[];
  newGroupMode: boolean;
  setNewGroupMode: (value: boolean) => void;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const { values, handleChange, errors, touched, setFieldValue } = useFormikContext<StepActionFormValues>();

  useEffect(() => {
    const finalActionGroup = newGroupMode ? values.newActionGroup : values.actionGroup;
    onDataChange({
      name: values.action,
      actionGroup: finalActionGroup,
      labelDe: values.labelDe,
      labelEn: values.labelEn,
    });
  }, [values.action, values.actionGroup, values.newActionGroup, values.labelDe, values.labelEn, newGroupMode, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">{t('settings:actionModal.create')}</div>

        <FormControl className="mb-2">
          <Label className="flex-row items-center justify-between">
            <LabelText className="text-xs">{t('settings:groups')}</LabelText>
            <LabelTextAlt className="text-xs text-error">
              <span>{errors.actionGroup && touched.actionGroup ? String(errors.actionGroup) : ''}</span>
              <span>{errors.newActionGroup && touched.newActionGroup ? String(errors.newActionGroup) : ''}</span>
              <span>{t('common:required')}</span>
            </LabelTextAlt>
          </Label>
          {!newGroupMode ? (
            <div className="flex gap-2">
              <Select name="actionGroup" selectSize="sm" value={values.actionGroup} onChange={handleChange} className="flex-1">
                <option value="">{t('settings:groups')}...</option>
                {existingGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewGroupMode(true);
                  setFieldValue('actionGroup', '');
                }}
              >
                {t('settings:newGroupIdentifier')}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                name="newActionGroup"
                inputSize="sm"
                value={values.newActionGroup}
                onChange={handleChange}
                placeholder={t('settings:newGroupIdentifier')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewGroupMode(false);
                  setFieldValue('newActionGroup', '');
                }}
              >
                {t('common:cancel')}
              </Button>
            </div>
          )}
        </FormControl>

        <FormControl className="mb-2">
          <Label htmlFor="action" className="flex-row items-center justify-between">
            <LabelText className="text-xs">{t('common:identifierAz')}</LabelText>
            <LabelTextAlt className="text-xs text-error">
              <span>{errors.action && touched.action ? String(errors.action) : ''}</span>
              <span>{t('common:required')}</span>
            </LabelTextAlt>
          </Label>
          <Input id="action" name="action" inputSize="sm" value={values.action} onChange={handleChange} />
        </FormControl>
        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="labelDe" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelDe')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelDe && touched.labelDe ? String(errors.labelDe) : ''}</span>
                <span>{t('common:required')}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelDe" name="labelDe" inputSize="sm" value={values.labelDe} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="labelEn" className="flex-row items-center justify-between">
              <LabelText className="text-xs">{t('settings:labelEn')}</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.labelEn && touched.labelEn ? String(errors.labelEn) : ''}</span>
              </LabelTextAlt>
            </Label>
            <Input id="labelEn" name="labelEn" inputSize="sm" value={values.labelEn} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function StepActionForm({ initialData, onDataChange, entity, existingGroups = [] }: StepActionFormProps) {
  const { t } = useTranslation('settings');
  const [newGroupMode, setNewGroupMode] = useState(false);

  const stepActionFormSchema = z.object({
    action: z.string().superRefine((value, ctx) => {
      if (value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('validation.invalidIdentifier') });
      } else if (!/^[A-Z_]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: t('validation.azOnly') });
      }
    }),
    labelDe: z.string().refine((value) => value.trim() != '', { message: t('validation.invalidLabel') }),
    labelEn: z.string(),
    actionGroup: z.string().superRefine((value, ctx) => {
      if (!newGroupMode && value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('validation.actionGroupRequired') });
      }
    }),
    newActionGroup: z.string().superRefine((value, ctx) => {
      if (!newGroupMode) return;
      if (value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('validation.invalidIdentifier') });
      } else if (!/^[A-Z_]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: t('validation.azOnly') });
      }
    }),
  });

  return (
    <Formik<StepActionFormValues>
      initialValues={{
        actionGroup: String(initialData?.actionGroup ?? entity.actionGroup ?? ''),
        action: String(initialData?.name ?? entity.name ?? ''),
        newActionGroup: '',
        labelDe: readLabelDe(initialData),
        labelEn: readLabelEn(initialData),
      }}
      validate={(values) => zodFormikValidate(stepActionFormSchema)(values)}
      onSubmit={() => {}}
      enableReinitialize
    >
      <StepActionFormContent onDataChange={onDataChange} existingGroups={existingGroups} newGroupMode={newGroupMode} setNewGroupMode={setNewGroupMode} />
    </Formik>
  );
}
