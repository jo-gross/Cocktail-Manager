import React, { useState, useEffect } from 'react';
import { Formik, useFormikContext } from 'formik';
import { Button, Card, CardBody, FormControl, Input, Label, LabelText, LabelTextAlt, Select } from '@components/ui';

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
      validate={(values) => {
        const errors: { [key: string]: string } = {};

        if (values.identifier.trim() != '') {
          if (!/^[A-Z_]+$/.test(values.identifier)) {
            errors.identifier = 'Nur A-Z und _ erlaubt';
          }
        } else {
          errors.identifier = 'Ungültiger Identifier';
        }

        if (!values.lableDE || values.lableDE.trim() == '') {
          errors.lableDE = 'Ungültiger Bezeichner';
        }

        return errors;
      }}
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
      validate={(values) => {
        const errors: { [key: string]: string } = {};

        if (!values.identifier || values.identifier.trim() == '') {
          errors.identifier = 'Ungültiger Identifier';
        } else {
          if (!/^[A-Z_]+$/.test(values.identifier)) {
            errors.identifier = 'Nur A-Z und _ erlaubt';
          }
        }

        if (!values.lableDE || values.lableDE.trim() == '') {
          errors.lableDE = 'Ungültiger Bezeichner';
        }

        return errors;
      }}
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
      validate={(values) => {
        const errors: { [key: string]: string } = {};

        if (newGroupMode) {
          if (values.newActionGroup.trim() != '') {
            if (!/^[A-Z_]+$/.test(values.newActionGroup)) {
              errors.newActionGroup = 'Nur A-Z und _ erlaubt';
            }
          } else {
            errors.newActionGroup = 'Ungültiger Identifier';
          }
        } else {
          if (!values.actionGroup || values.actionGroup.trim() == '') {
            errors.actionGroup = 'Gruppe muss ausgewählt werden';
          }
        }

        if (!values.action || values.action.trim() == '') {
          errors.action = 'Ungültiger Identifier';
        } else {
          if (!/^[A-Z_]+$/.test(values.action)) {
            errors.action = 'Nur A-Z und _ erlaubt';
          }
        }

        if (!values.lableDE || values.lableDE.trim() == '') {
          errors.lableDE = 'Ungültiger Bezeichner';
        }

        return errors;
      }}
      onSubmit={() => {}}
      enableReinitialize
    >
      <StepActionFormContent onDataChange={onDataChange} existingGroups={existingGroups} newGroupMode={newGroupMode} setNewGroupMode={setNewGroupMode} />
    </Formik>
  );
}
