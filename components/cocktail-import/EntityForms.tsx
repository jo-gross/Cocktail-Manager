import React, { useState, useEffect } from 'react';
import { Formik, useFormikContext } from 'formik';
import { useRouter } from 'next/router';

interface BaseEntityFormProps {
  initialData?: any;
  onDataChange: (data: any) => void;
  entity: any;
}

// Inner component to handle useEffect properly
function UnitFormContent({ onDataChange }: { onDataChange: (data: any) => void }) {
  const { values, handleChange, errors, touched } = useFormikContext<any>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      lableDE: values.lableDE,
    });
  }, [values.identifier, values.lableDE, onDataChange]);

  return (
    <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
      <div className="mb-2 text-sm font-semibold">Neue Einheit erstellen</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Identifier (A-Z,_)</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="identifier" name="identifier" value={values.identifier} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Deutsch</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="lableDE" name="lableDE" value={values.lableDE} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
      </div>
    </div>
  );
}

export function UnitForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  return (
    <Formik
      initialValues={{
        identifier: initialData?.name || entity.name || '',
        lableDE: initialData?.lableDE || '',
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

function IceFormContent({ onDataChange }: { onDataChange: (data: any) => void }) {
  const { values, handleChange, errors, touched } = useFormikContext<any>();

  useEffect(() => {
    onDataChange({
      name: values.identifier,
      lableDE: values.lableDE,
    });
  }, [values.identifier, values.lableDE, onDataChange]);

  return (
    <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
      <div className="mb-2 text-sm font-semibold">Neues Eis erstellen</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Identifier (A-Z,_)</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.identifier && touched.identifier ? String(errors.identifier) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="identifier" name="identifier" value={values.identifier} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Deutsch</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="lableDE" name="lableDE" value={values.lableDE} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
      </div>
    </div>
  );
}

export function IceForm({ initialData, onDataChange, entity }: BaseEntityFormProps) {
  return (
    <Formik
      initialValues={{
        identifier: initialData?.name || entity.name || '',
        lableDE: initialData?.lableDE || '',
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

function StepActionFormContent({
  onDataChange,
  existingGroups = [],
  newGroupMode,
  setNewGroupMode,
}: {
  onDataChange: (data: any) => void;
  existingGroups: string[];
  newGroupMode: boolean;
  setNewGroupMode: (value: boolean) => void;
}) {
  const { values, handleChange, errors, touched, setFieldValue } = useFormikContext<any>();

  useEffect(() => {
    const finalActionGroup = newGroupMode ? values.newActionGroup : values.actionGroup;
    onDataChange({
      name: values.action,
      actionGroup: finalActionGroup,
      lableDE: values.lableDE,
    });
  }, [values.action, values.actionGroup, values.newActionGroup, values.lableDE, newGroupMode, onDataChange]);

  return (
    <div className="ml-6 rounded-lg border border-base-300 bg-base-200 p-3">
      <div className="mb-2 text-sm font-semibold">Neue Aktion erstellen</div>

      {/* Action Group Selection */}
      <div className="form-control mb-2">
        <label className="label">
          <div className="label-text text-xs">Gruppe</div>
          <div className="label-text-alt text-xs text-error">
            <span>{errors.actionGroup && touched.actionGroup ? String(errors.actionGroup) : ''}</span>
            <span>{errors.newActionGroup && touched.newActionGroup ? String(errors.newActionGroup) : ''}</span>
            <span>*</span>
          </div>
        </label>
        {!newGroupMode ? (
          <div className="flex gap-2">
            <select name="actionGroup" value={values.actionGroup} onChange={handleChange} className="select select-bordered select-sm flex-1">
              <option value="">Gruppe auswählen...</option>
              {existingGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setNewGroupMode(true);
                setFieldValue('actionGroup', '');
              }}
            >
              Neue Gruppe
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              name="newActionGroup"
              value={values.newActionGroup}
              onChange={handleChange}
              placeholder="Gruppe-Identifier (A-Z,_)"
              className="input input-sm input-bordered flex-1"
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setNewGroupMode(false);
                setFieldValue('newActionGroup', '');
              }}
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>

      {/* Action and Translation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Identifier (A-Z,_)</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.action && touched.action ? String(errors.action) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="action" name="action" value={values.action} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
        <div className="form-control">
          <label className="label">
            <div className="label-text text-xs">Deutsch</div>
            <div className="label-text-alt text-xs text-error">
              <span>{errors.lableDE && touched.lableDE ? String(errors.lableDE) : ''}</span>
              <span>*</span>
            </div>
          </label>
          <input id="lableDE" name="lableDE" value={values.lableDE} onChange={handleChange} className="input input-sm input-bordered" />
        </div>
      </div>
    </div>
  );
}

export function StepActionForm({ initialData, onDataChange, entity, existingGroups = [] }: StepActionFormProps) {
  const [newGroupMode, setNewGroupMode] = useState(false);

  return (
    <Formik
      initialValues={{
        actionGroup: initialData?.actionGroup || entity.actionGroup || '',
        action: initialData?.name || entity.name || '',
        newActionGroup: '',
        lableDE: initialData?.lableDE || '',
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
