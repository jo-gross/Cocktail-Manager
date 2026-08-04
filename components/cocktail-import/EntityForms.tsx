import React, { useState, useEffect } from 'react';
import { Formik, useFormikContext } from 'formik';
import { Button, Card, CardBody, FormControl, Input, Label, LabelText, LabelTextAlt, Select } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';

// Mirrors the original if/else: empty -> "Ungültiger Identifier", otherwise must match [A-Z_].
const identifierSchema = z.string().superRefine((value, ctx) => {
  if (value.trim() == '') {
    ctx.addIssue({ code: 'custom', message: 'Ungültiger Identifier' });
  } else if (!/^[A-Z_]+$/.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'Nur A-Z und _ erlaubt' });
  }
});

const lableDESchema = z.string().refine((value) => value.trim() != '', { message: 'Ungültiger Bezeichner' });

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

interface UnitFormValues {
  identifier: string;
  lableDE: string;
}

const unitFormSchema = z.object({
  identifier: identifierSchema,
  lableDE: lableDESchema,
});

const validateUnit = zodFormikValidate(unitFormSchema);

function UnitFormContent({ onDataChange }: { onDataChange: (data: Record<string, unknown>) => void }) {
  const { values, handleChange, errors, touched } = useFormikContext<UnitFormValues>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      lableDE: values.lableDE,
    });
  }, [values.identifier, values.lableDE, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">Neue Einheit erstellen</div>
        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="identifier" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Identifier (A-Z,_)</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="identifier" name="identifier" inputSize="sm" value={values.identifier} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="lableDE" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Deutsch</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="lableDE" name="lableDE" inputSize="sm" value={values.lableDE} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function UnitForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  return (
    <Formik<UnitFormValues>
      initialValues={{
        identifier: String(initialData?.name ?? entity.name ?? ''),
        lableDE: String(initialData?.lableDE ?? ''),
      }}
      validate={(values) => validateUnit(values)}
      onSubmit={() => {}}
      enableReinitialize
    >
      <UnitFormContent onDataChange={onDataChange} />
    </Formik>
  );
}

interface IceFormValues {
  identifier: string;
  lableDE: string;
}

export type { IceFormValues };

const iceFormSchema = z.object({
  identifier: identifierSchema,
  lableDE: lableDESchema,
});

const validateIce = zodFormikValidate(iceFormSchema);

function IceFormContent({ onDataChange }: { onDataChange: (data: Record<string, unknown>) => void }) {
  const { values, handleChange, errors, touched } = useFormikContext<IceFormValues>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      lableDE: values.lableDE,
    });
  }, [values.identifier, values.lableDE, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">Neues Eis erstellen</div>
        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="identifier" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Identifier (A-Z,_)</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="identifier" name="identifier" inputSize="sm" value={values.identifier} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="lableDE" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Deutsch</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="lableDE" name="lableDE" inputSize="sm" value={values.lableDE} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function IceForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  return (
    <Formik<IceFormValues>
      initialValues={{
        identifier: String(initialData?.name ?? entity.name ?? ''),
        lableDE: String(initialData?.lableDE ?? ''),
      }}
      validate={(values) => validateIce(values)}
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
  lableDE: string;
}

// Validation depends on the `newGroupMode` UI state, so the schema is built per render.
const buildStepActionFormSchema = (newGroupMode: boolean) =>
  z.object({
    action: identifierSchema,
    lableDE: lableDESchema,
    actionGroup: z.string().superRefine((value, ctx) => {
      if (!newGroupMode && value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: 'Gruppe muss ausgewählt werden' });
      }
    }),
    newActionGroup: z.string().superRefine((value, ctx) => {
      if (!newGroupMode) return;
      if (value.trim() == '') {
        ctx.addIssue({ code: 'custom', message: 'Ungültiger Identifier' });
      } else if (!/^[A-Z_]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: 'Nur A-Z und _ erlaubt' });
      }
    }),
  });

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
  const { values, handleChange, errors, touched, setFieldValue } = useFormikContext<StepActionFormValues>();

  useEffect(() => {
    const finalActionGroup = newGroupMode ? values.newActionGroup : values.actionGroup;
    onDataChange({
      name: values.action,
      actionGroup: finalActionGroup,
      lableDE: values.lableDE,
    });
  }, [values.action, values.actionGroup, values.newActionGroup, values.lableDE, newGroupMode, onDataChange]);

  return (
    <Card variant="elevated" className="ml-6 rounded-lg">
      <CardBody compact>
        <div className="mb-2 text-sm font-semibold">Neue Aktion erstellen</div>

        <FormControl className="mb-2">
          <Label className="flex-row items-center justify-between">
            <LabelText className="text-xs">Gruppe</LabelText>
            <LabelTextAlt className="text-xs text-error">
              <span>{errors.actionGroup && touched.actionGroup ? String(errors.actionGroup) : ''}</span>
              <span>{errors.newActionGroup && touched.newActionGroup ? String(errors.newActionGroup) : ''}</span>
              <span>*</span>
            </LabelTextAlt>
          </Label>
          {!newGroupMode ? (
            <div className="flex gap-2">
              <Select name="actionGroup" selectSize="sm" value={values.actionGroup} onChange={handleChange} className="flex-1">
                <option value="">Gruppe auswählen...</option>
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
                Neue Gruppe
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                name="newActionGroup"
                inputSize="sm"
                value={values.newActionGroup}
                onChange={handleChange}
                placeholder="Gruppe-Identifier (A-Z,_)"
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
                Abbrechen
              </Button>
            </div>
          )}
        </FormControl>

        <div className="grid grid-cols-2 gap-2">
          <FormControl>
            <Label htmlFor="action" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Identifier (A-Z,_)</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.action && touched.action ? String(errors.action) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="action" name="action" inputSize="sm" value={values.action} onChange={handleChange} />
          </FormControl>
          <FormControl>
            <Label htmlFor="lableDE" className="flex-row items-center justify-between">
              <LabelText className="text-xs">Deutsch</LabelText>
              <LabelTextAlt className="text-xs text-error">
                <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
                <span>*</span>
              </LabelTextAlt>
            </Label>
            <Input id="lableDE" name="lableDE" inputSize="sm" value={values.lableDE} onChange={handleChange} />
          </FormControl>
        </div>
      </CardBody>
    </Card>
  );
}

export function StepActionForm({ initialData, onDataChange, entity, existingGroups = [] }: StepActionFormProps) {
  const [newGroupMode, setNewGroupMode] = useState(false);

  return (
    <Formik<StepActionFormValues>
      initialValues={{
        actionGroup: String(initialData?.actionGroup ?? entity.actionGroup ?? ''),
        action: String(initialData?.name ?? entity.name ?? ''),
        newActionGroup: '',
        lableDE: String(initialData?.lableDE ?? ''),
      }}
      validate={(values) => zodFormikValidate(buildStepActionFormSchema(newGroupMode))(values)}
      onSubmit={() => {}}
      enableReinitialize
    >
      <StepActionFormContent onDataChange={onDataChange} existingGroups={existingGroups} newGroupMode={newGroupMode} setNewGroupMode={setNewGroupMode} />
    </Formik>
  );
}
