import { useCallback, useEffect, useState } from 'react';
import { alertService } from '../../../../../lib/alertService';
import { useRouter } from 'next/router';
import { BackupStructure } from '../../../../api/workspaces/[workspaceId]/admin/backups/backupStructure';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useSession } from 'next-auth/react';

export default function Admin() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');

  useEffect(() => {
    if (workspaceId == undefined) {
      router.replace('/').then();
    }
  }, [router, workspaceId]);

  const { data: session } = useSession();

  const [exporting, setExporting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<File>();

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch(`/api/workspaces/${workspaceId}/admin/backups/export`)
      .then((response) => response.text())
      .then((content) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = 'backup.json';
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
      })
      .catch((e) => {
        console.log(e);
        alertService.error('Fehler beim Exportieren');
      })
      .finally(() => setExporting(false));
  }, [workspaceId]);

  const importBackup = useCallback(async () => {
    try {
      if (selectedFile == undefined) return;
      setImporting(true);

      const data: BackupStructure = JSON.parse(await selectedFile.text());

      const response = await fetch(`/api/workspaces/${workspaceId}/admin/backups/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.ok) {
        alertService.success(`Import erfolgreich`);
      } else {
        throw new Error();
      }
      setImporting(false);
    } catch (e) {
      alertService.error(`Fehler beim importieren`);
    } finally {
      setImporting(false);
    }
  }, [selectedFile, workspaceId]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!confirm('Workspcae inkl. aller Zutaten und Rezepte wirklich löschen?')) return;

    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      router.replace('/').then();
    } else {
      alertService.error(`Fehler beim löschen`);
    }
  }, [router, workspaceId]);

  const handleRenameWorkspace = useCallback(async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newWorkspaceName }),
    });
    if (response.ok) {
      setNewWorkspaceName('');
      alertService.success(`Umbenennen erfolgreich`);
    } else {
      alertService.error(`Fehler beim umbenennen`);
    }
  }, [newWorkspaceName, workspaceId]);

  return (
    <ManageEntityLayout backLink={`/workspaces/${workspaceId}/manage`} title={'Admin'}>
      <div className={'grid grid-cols-2 gap-2'}>
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title'}>Daten Transfer</div>
            <div className={'grid grid-cols-2 gap-2'}>
              <div></div>
              <button className={`btn btn-primary`} onClick={exportAll} disabled={exporting}>
                <>{exporting ? <span className="loading loading-spinner"></span> : <></>}</>
                Export All
              </button>
              <div className={'form-control'}>
                <input
                  type={'file'}
                  disabled={importing}
                  className={'file-input file-input-bordered'}
                  onChange={(e) => setSelectedFile(e.target.files?.[0])}
                />
              </div>
              <button
                className={`btn btn-primary`}
                disabled={selectedFile == undefined || importing}
                type={'button'}
                onClick={importBackup}
              >
                <>{importing ? <span className="loading loading-spinner"></span> : <></>}</>
                Import
              </button>
            </div>
          </div>
        </div>
        <div className={'card'}>
          <div className={'card-body flex flex-col justify-between'}>
            <div className={'card-title'}>Gefahrenbereich</div>
            <label className={'cursor-pointer label'}>
              <span className={'label-text'}>Gefahrenbereich verlassen</span>
            </label>
            <div className={'input-group'}>
              <input
                type={'text'}
                className={'input input-bordered in'}
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
              />
              <button className={'btn btn-outline btn-error'} onClick={handleRenameWorkspace}>
                Umbenennen
              </button>
            </div>
            <div className={'divider'}></div>
            <button className={'btn btn-outline btn-error'} onClick={handleDeleteWorkspace}>
              Workspace löschen
            </button>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}
