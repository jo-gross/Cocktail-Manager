import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@components/ui';
import { FormField } from '@components/forms/FormField';

export const WORKSPACE_NAME_MIN_LENGTH = 3;
export const WORKSPACE_NAME_MAX_LENGTH = 50;

export function isValidWorkspaceName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= WORKSPACE_NAME_MIN_LENGTH && trimmed.length <= WORKSPACE_NAME_MAX_LENGTH;
}

/** Workspace name input; shared by the general settings and the setup wizard. */
export function WorkspaceNameField({ value, onChange, id = 'workspace-name' }: { value: string; onChange: (value: string) => void; id?: string }) {
  const { t } = useTranslation(['settings', 'common']);
  const invalid = !isValidWorkspaceName(value);

  return (
    <FormField label={t('common:name')} htmlFor={id} required error={invalid ? t('settings:general.nameInvalid') : undefined}>
      <Input id={id} value={value} maxLength={WORKSPACE_NAME_MAX_LENGTH} error={invalid} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}
