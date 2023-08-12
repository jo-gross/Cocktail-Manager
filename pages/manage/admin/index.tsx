import { useCallback, useState } from 'react';
import { alertService } from '../../../lib/alertService';

export default function Admin() {
  const [exporting, setExporting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<File>();

  const exportAll = useCallback(async () => {
    setExporting(true);
    fetch('/api/admin/backups/export')
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
  }, []);

  const importBackup = useCallback(async () => {
    setImporting(true);
    if (selectedFile == undefined) return;
    fetch('/api/admin/backups/import', {
      method: 'POST',
      body: await selectedFile?.text(),
    })
      .then((response) => {
        if (response.ok) {
          alertService.success('Import erfolgreich');
        } else {
          alertService.error('Fehler beim Importieren');
        }
      })
      .finally(() => setImporting(false));
  }, [selectedFile]);

  return (
    <div className={'grid grid-cols-2'}>
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
    </div>
  );
}
