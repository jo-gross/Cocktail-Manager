import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { $Enums, Role, Signage } from '@generated/prisma/client';
import { alertService } from '@lib/alertService';
import { FaShareAlt, FaTrashAlt } from 'react-icons/fa';
import { UploadDropZone } from '@components/UploadDropZone';
import { compressFile } from '@lib/ImageCompressor';
import { convertToBase64 } from '@lib/Base64Converter';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import Image from 'next/image';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import MonitorFormat = $Enums.MonitorFormat;

function ManageMonitorPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const [signageLoading, setSignageLoading] = useState<boolean>(true);

  const [verticalImage, setVerticalImage] = useState<string>();
  const [verticalImageColor, setVerticalImageColor] = useState<string>();
  const [horizontalImage, setHorizontalImage] = useState<string>();
  const [horizontalImageColor, setHorizontalImageColor] = useState<string>();
  const [updatingSignage, setUpdatingSignage] = useState<boolean>(false);

  const [copyToClipboardLoading, setCopyToClipboardLoading] = useState<boolean>(false);

  const handleUpdateSignage = useCallback(async () => {
    setUpdatingSignage(true);
    fetch(`/api/workspaces/${workspaceId}/admin/signage`, {
      method: 'PUT',
      body: JSON.stringify({
        verticalContent: verticalImage,
        horizontalContent: horizontalImage,
        verticalBgColor: verticalImageColor,
        horizontalBgColor: horizontalImageColor,
      }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          alertService.success(`Update erfolgreich`);
        } else {
          console.error('Admin -> UpdateSignage', response);
          alertService.error(body.message ?? 'Fehler beim Speichern', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('SettingsPage -> handleUpdateSignage', error);
        alertService.error('Es ist ein Fehler Aufgetreten, z.B. zu große Datei');
      })
      .finally(() => {
        setUpdatingSignage(false);
      });
  }, [horizontalImage, horizontalImageColor, verticalImage, verticalImageColor, workspaceId]);

  const fetchSignage = useCallback(() => {
    if (workspaceId == undefined) return;
    setSignageLoading(true);
    fetch(`/api/signage/${workspaceId}`)
      .then(async (response) => {
        return response.json();
      })
      .then((data) => {
        data.content.forEach((signage: Signage) => {
          if (signage.format == MonitorFormat.PORTRAIT) {
            setVerticalImage(signage.content);
            setVerticalImageColor(signage.backgroundColor ?? undefined);
          } else {
            setHorizontalImage(signage.content);
            setHorizontalImageColor(signage.backgroundColor ?? undefined);
          }
        });
      })
      .catch((error) => {
        console.error('SettingsPage -> fetchSignage', error);
        alertService.error('Fehler beim Laden der Monitor-Einstellungen');
      })
      .finally(() => {
        setSignageLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    fetchSignage();
  }, [fetchSignage]);

  return (
    <ManageEntityLayout title={'Monitor'} backLink={`/workspaces/${workspaceId}/manage`}>
      {/*Signage*/}
      {userContext.isUserPermitted(Role.MANAGER) ? (
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title w-full justify-between'}>
              <div>Statische Karte</div>
              <button
                onClick={async () => {
                  setCopyToClipboardLoading(true);
                  await navigator.clipboard.writeText(`${window.location.origin}/signage?id=${workspaceId}`);
                  setCopyToClipboardLoading(false);
                  alertService.info('In Zwischenablage kopiert');
                }}
                disabled={copyToClipboardLoading}
                className={'btn btn-outline btn-sm'}
              >
                {copyToClipboardLoading ? <span className={'loading loading-spinner'} /> : <></>}
                <FaShareAlt /> Link kopieren
              </button>
            </div>
            <div className={'grid grid-cols-2 gap-2'}>
              <div className={'flex flex-col gap-2'}>
                <div>Horizontal</div>
                {signageLoading ? (
                  <div className={'justify-center-center flex w-full flex-col items-center gap-2'}>
                    <div className={'loading loading-spinner'}></div>
                    <div>Lade Einstellungen...</div>
                  </div>
                ) : (
                  <>
                    {horizontalImage == undefined ? (
                      <UploadDropZone
                        maxUploadSize={'1MB'}
                        onSelectedFilesChanged={async (file) => {
                          if (file) {
                            const compressedImageFile = await compressFile(file);
                            const base = await convertToBase64(compressedImageFile);
                            setHorizontalImage(base);
                          } else {
                            alertService.error('Datei konnte nicht ausgewählt werden.');
                          }
                        }}
                      />
                    ) : (
                      <div className={'relative h-full min-h-40'}>
                        <div
                          className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2 z-10'}
                          onClick={() =>
                            modalContext.openModal(
                              <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={async () => setHorizontalImage(undefined)} />,
                            )
                          }
                        >
                          <FaTrashAlt />
                        </div>
                        <Image
                          className={'w-fit rounded-lg'}
                          src={horizontalImage}
                          layout={'fill'}
                          objectFit={'contain'}
                          alt={'Fehler beim darstellen der Karte (horizontal)'}
                        />
                      </div>
                    )}
                    <div className={'form-control'}>
                      <label className={'label'}>
                        <span className={'label-text'}>Hintergrundfarbe</span>
                      </label>
                      <input
                        type={'color'}
                        disabled={horizontalImage == undefined}
                        value={horizontalImageColor}
                        onChange={(event) => {
                          setHorizontalImageColor(event.target.value);
                        }}
                        className={'input w-full'}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className={'flex flex-col gap-2'}>
                <div>Vertikal</div>
                {signageLoading ? (
                  <div className={'justify-center-center flex w-full flex-col items-center gap-2'}>
                    <div className={'loading loading-spinner'}></div>
                    <div>Lade Einstellungen...</div>
                  </div>
                ) : (
                  <>
                    {verticalImage == undefined ? (
                      <UploadDropZone
                        maxUploadSize={'1MB'}
                        onSelectedFilesChanged={async (file) => {
                          if (file) {
                            const compressedImageFile = await compressFile(file);
                            const base = await convertToBase64(compressedImageFile);
                            setVerticalImage(base);
                          } else {
                            alertService.error('Datei konnte nicht ausgewählt werden.');
                          }
                        }}
                      />
                    ) : (
                      <div className={'relative h-full min-h-40'}>
                        <div
                          className={'btn btn-square btn-outline btn-error btn-sm absolute right-2 top-2 z-10'}
                          onClick={() =>
                            modalContext.openModal(
                              <DeleteConfirmationModal spelling={'REMOVE'} entityName={'das Bild'} onApprove={async () => setVerticalImage(undefined)} />,
                            )
                          }
                        >
                          <FaTrashAlt />
                        </div>
                        <Image
                          className={'rounded-lg'}
                          src={verticalImage}
                          layout={'fill'}
                          objectFit={'contain'}
                          alt={'Fehler beim darstellen der Karte (vertikal)'}
                        />
                      </div>
                    )}
                    <div className={'form-control'}>
                      <label className={'label'}>
                        <span className={'label-text'}>Hintergrundfarbe</span>
                      </label>
                      <input
                        type={'color'}
                        disabled={verticalImage == undefined}
                        value={verticalImageColor}
                        onChange={(event) => {
                          setVerticalImageColor(event.target.value);
                        }}
                        className={'input w-full'}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <button className={`btn btn-primary`} disabled={updatingSignage || signageLoading} onClick={handleUpdateSignage}>
              {updatingSignage ? <span className={'loading loading-spinner'} /> : <></>}
              Speichern
            </button>
          </div>
        </div>
      ) : (
        <></>
      )}
    </ManageEntityLayout>
  );
}

export default withPagePermission(['MANAGER'], ManageMonitorPage, '/workspaces/[workspaceId]/manage');
