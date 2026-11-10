import React, { useContext, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaFileDownload, FaFileUpload } from 'react-icons/fa';
import { Alert, Button, FileInput, FormControl, Label, LabelText, Loading } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { formatDate } from '@lib/DateUtils';
import type { BackupStructure } from '../../pages/api/workspaces/[workspaceId]/admin/backups/backupStructure';
import type { BackupImportReport, BackupImportSkippedItem } from '@lib/backup/backupSecurity';
import { SettingsSection } from './SettingsSection';

/** Full workspace backup: export as JSON and import a previous export. */
export function DataTransferSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors', 'entity']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File>();
  const [skippedItems, setSkippedItems] = useState<BackupImportSkippedItem[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  const exportAll = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/admin/backups/export`);
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`);
      const content = await response.text();
      const element = document.createElement('a');
      element.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      element.download = `The Cocktail-Manager ${userContext.workspace?.name} Backup ${formatDate(new Date())}.json`;
      document.body.appendChild(element); // Required for this to work in FireFox
      element.click();
      element.remove();
    } catch (error) {
      console.error('DataTransferSection -> exportAll', error);
      alertService.error(t('errors:export'));
    } finally {
      setExporting(false);
    }
  };

  const importBackup = async () => {
    if (importFile == undefined || importing) return;
    setImporting(true);
    setSkippedItems([]);
    try {
      const data: BackupStructure = JSON.parse(await importFile.text());
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/admin/backups/import`, { method: 'POST', body: JSON.stringify(data) });
      if (response.ok) {
        const body: { report?: BackupImportReport } = await response.json();
        alertService.success(t('entity:importSuccess'));
        setImportFile(undefined);
        if (importFileRef.current) importFileRef.current.value = '';
        // Keep the page (no reload) so the list of skipped items stays visible.
        const skipped = body.report?.skipped ?? [];
        if (skipped.length > 0) setSkippedItems(skipped);
        else router.reload();
      } else {
        const body = await response.json();
        console.error('DataTransferSection -> importBackup', response);
        alertService.error(body.error?.message ?? body.message ?? t('errors:import'), response.status, response.statusText);
      }
    } catch (error) {
      console.error('DataTransferSection -> importBackup', error);
      alertService.error(t('errors:import'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <SettingsSection
        title={t('settings:data.exportTitle')}
        description={t('settings:data.exportHelp')}
        footer={
          <Button type="button" variant="primary" onClick={exportAll} disabled={exporting}>
            {exporting ? <Loading size="sm" /> : <FaFileDownload aria-hidden />}
            {t('settings:exportAll')}
          </Button>
        }
      />

      <SettingsSection
        title={t('settings:data.importTitle')}
        description={t('settings:data.importHelp')}
        footer={
          <Button type="button" variant="primary" disabled={importFile == undefined || importing} onClick={importBackup}>
            {importing ? <Loading size="sm" /> : <FaFileUpload aria-hidden />}
            {t('settings:import')}
          </Button>
        }
      >
        <Alert variant="warning" className="text-sm">
          {t('settings:data.importWarning')} {t('settings:data.importGuestMenus')}
        </Alert>
        {skippedItems.length > 0 && (
          <Alert variant="warning" className="text-sm">
            <div>
              <div className="font-semibold">{t('settings:data.importSkipped')}</div>
              <ul className="mt-1 list-disc pl-5">
                {skippedItems.map((item, index) => (
                  <li key={index}>
                    {t('settings:data.skippedItem', { type: t(`settings:data.skippedType.${item.type}`), name: item.name })}{' '}
                    <span className="text-base-content/70">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
        <FormControl>
          <Label htmlFor="backup-import-file">
            <LabelText className="font-semibold">{t('settings:data.importFile')}</LabelText>
          </Label>
          <FileInput
            id="backup-import-file"
            accept=".json,application/json"
            disabled={importing}
            ref={importFileRef}
            onChange={(event) => setImportFile(event.target.files?.[0])}
          />
        </FormControl>
      </SettingsSection>
    </>
  );
}
