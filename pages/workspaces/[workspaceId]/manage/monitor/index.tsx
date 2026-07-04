import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { $Enums, Role } from '@generated/prisma/client';
import { alertService } from '@lib/alertService';
import { FaShareAlt } from 'react-icons/fa';
import { UploadDropZone } from '@components/UploadDropZone';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import MonitorFormat = $Enums.MonitorFormat;
import { Button, Card, CardBody, CardTitle, Checkbox, FormControl, Input, Label, LabelText, Loading as UiLoading, Radio } from '@components/ui';
import { SignageSlideList } from '@components/signage/SignageSlideList';
import {
  ExclusiveConflict,
  SignageBackgroundMode,
  SignageFormatView,
  SignageSettingsUpdatePayload,
  SignageSlideFilterState,
  SignageSlideView,
} from '@lib/signage/types';
import { processSignageFiles } from '@lib/signage/processSignageFiles';
import { SignageSlideBulkActions } from '@components/signage/SignageSlideBulkActions';
import { SignageSlideFilter } from '@components/signage/SignageSlideFilter';
import { SignageMonitorPreview } from '@components/signage/SignageMonitorPreview';
import { filterSlidesForAdmin } from '@lib/signage/filterSlidesForAdmin';

interface SignageFormatState {
  slides: SignageSlideView[];
  backgroundColor?: string | null;
  backgroundMode: SignageBackgroundMode;
  slideDurationSeconds: number;
  mirrorSourceFormat?: MonitorFormat | null;
}

const defaultFormatState = (): SignageFormatState => ({
  slides: [],
  backgroundColor: undefined,
  backgroundMode: 'COLOR',
  slideDurationSeconds: 10,
  mirrorSourceFormat: null,
});

const defaultFilterState = (): SignageSlideFilterState => ({
  mode: 'all',
});

function formatLabel(format: MonitorFormat): string {
  return format === MonitorFormat.LANDSCAPE ? 'Horizontal' : 'Vertikal';
}

function otherFormat(format: MonitorFormat): MonitorFormat {
  return format === MonitorFormat.LANDSCAPE ? MonitorFormat.PORTRAIT : MonitorFormat.LANDSCAPE;
}

function formatPayloadKey(format: MonitorFormat): 'landscape' | 'portrait' {
  return format === MonitorFormat.LANDSCAPE ? 'landscape' : 'portrait';
}

class SignagePatchError extends Error {
  conflicts?: ExclusiveConflict[];

  constructor(message: string, conflicts?: ExclusiveConflict[]) {
    super(message);
    this.conflicts = conflicts;
  }
}

async function patchSlides(
  workspaceId: string,
  payload: {
    slideIds: string[];
    enabled?: boolean;
    weekdays?: number[];
    validFrom?: string | null;
    validTo?: string | null;
    dateExclusive?: boolean;
  },
) {
  const response = await fetch(`/api/workspaces/${workspaceId}/admin/signage/slides`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new SignagePatchError(body.message ?? 'Fehler beim Aktualisieren der Slides', body.conflicts);
  }

  return body.slides as SignageSlideView[];
}

async function parseJsonResponseBody(response: Response): Promise<{ message?: string }> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as { message?: string };
  } catch {
    if (!response.ok) {
      throw new Error(`Serverfehler (${response.status})`);
    }
    return {};
  }
}

async function putSignageSettings(workspaceId: string, payload: SignageSettingsUpdatePayload) {
  const response = await fetch(`/api/workspaces/${workspaceId}/admin/signage`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponseBody(response);
  if (!response.ok) {
    throw new Error(body.message ?? 'Fehler beim Speichern');
  }
}

function buildFormatPayload(state: SignageFormatState): SignageSettingsUpdatePayload['landscape'] {
  return {
    slides: state.slides.map((slide, order) => ({ id: slide.id, order })),
    backgroundColor: state.backgroundColor ?? null,
    backgroundMode: state.backgroundMode,
    slideDurationSeconds: state.slideDurationSeconds,
    mirrorSourceFormat: state.mirrorSourceFormat ?? null,
  };
}

function SignageFormatEditor({
  title,
  workspaceId,
  format,
  state,
  sourceSlides,
  uploading,
  selectedIds,
  filter,
  onStateChange,
  onFilesSelected,
  onToggleSelect,
  onToggleSelectAll,
  onFilterChange,
  onClearSelection,
  onMirrorChange,
}: {
  title: string;
  workspaceId: string;
  format: MonitorFormat;
  state: SignageFormatState;
  sourceSlides: SignageSlideView[];
  uploading: boolean;
  selectedIds: Set<string>;
  filter: SignageSlideFilterState;
  onStateChange: (state: SignageFormatState) => void;
  onFilesSelected: (files: File[]) => Promise<void>;
  onToggleSelect: (slideId: string) => void;
  onToggleSelectAll: (slideIds: string[]) => void;
  onFilterChange: (filter: SignageSlideFilterState) => void;
  onClearSelection: () => void;
  onMirrorChange: (mirrorSourceFormat: MonitorFormat | null) => Promise<void>;
}) {
  const isMirroring = Boolean(state.mirrorSourceFormat);
  const filteredSlides = useMemo(() => filterSlidesForAdmin(state.slides, filter), [state.slides, filter]);
  const previewSlides = isMirroring ? sourceSlides : state.slides;
  const formatView: SignageFormatView = {
    workspaceId,
    format,
    backgroundColor: state.backgroundColor ?? null,
    backgroundMode: state.backgroundMode,
    slideDurationSeconds: state.slideDurationSeconds,
    mirrorSourceFormat: state.mirrorSourceFormat ?? null,
    slides: previewSlides,
  };

  const updateSlidesInState = (updatedSlides: SignageSlideView[]) => {
    const byId = new Map(updatedSlides.map((slide) => [slide.id, slide]));
    onStateChange({
      ...state,
      slides: state.slides.map((slide) => byId.get(slide.id) ?? slide),
    });
  };

  const handlePatchError = (error: unknown) => {
    if (error instanceof SignagePatchError) {
      const conflictLabels = error.conflicts?.map((conflict) => conflict.label).join(', ');
      alertService.error(
        conflictLabels ? `Exklusive Zeiträume überschneiden sich: ${conflictLabels}` : (error.message ?? 'Exklusive Zeiträume überschneiden sich'),
      );
      return;
    }
    alertService.error('Fehler beim Aktualisieren der Slides');
  };

  const handleToggleEnabled = async (slideId: string, enabled: boolean) => {
    try {
      const updated = await patchSlides(workspaceId, { slideIds: [slideId], enabled });
      updateSlidesInState(updated);
    } catch (error) {
      handlePatchError(error);
    }
  };

  const handleDelete = async (slideId: string) => {
    const response = await fetch(`/api/workspaces/${workspaceId}/admin/signage/slides/${slideId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = await response.json();
      alertService.error(body.message ?? 'Fehler beim Löschen');
      return;
    }
    onStateChange({
      ...state,
      slides: state.slides.filter((slide) => slide.id !== slideId),
    });
    onClearSelection();
  };

  const handleBulkApply = async (payload: { weekdays: number[]; validFrom: string | null; validTo: string | null; dateExclusive: boolean }) => {
    try {
      const updated = await patchSlides(workspaceId, {
        slideIds: Array.from(selectedIds),
        weekdays: payload.weekdays,
        validFrom: payload.validFrom,
        validTo: payload.validTo,
        dateExclusive: payload.dateExclusive,
      });
      updateSlidesInState(updated);
      alertService.success('Zeitplan aktualisiert');
    } catch (error) {
      handlePatchError(error);
    }
  };

  const handleSlideScheduleApply = async (
    slideId: string,
    payload: { weekdays: number[]; validFrom: string | null; validTo: string | null; dateExclusive: boolean },
  ) => {
    try {
      const updated = await patchSlides(workspaceId, {
        slideIds: [slideId],
        weekdays: payload.weekdays,
        validFrom: payload.validFrom,
        validTo: payload.validTo,
        dateExclusive: payload.dateExclusive,
      });
      updateSlidesInState(updated);
      alertService.success('Zeitplan aktualisiert');
    } catch (error) {
      handlePatchError(error);
      throw error;
    }
  };

  const handleBulkEnable = async (enabled: boolean) => {
    try {
      const updated = await patchSlides(workspaceId, {
        slideIds: Array.from(selectedIds),
        enabled,
      });
      updateSlidesInState(updated);
      alertService.success(enabled ? 'Slides aktiviert' : 'Slides deaktiviert');
    } catch (error) {
      handlePatchError(error);
    }
  };

  const sourceLabel = formatLabel(otherFormat(format));

  return (
    <div className="flex flex-col gap-3">
      <div className="font-medium">{title}</div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={isMirroring} onChange={() => onMirrorChange(isMirroring ? null : otherFormat(format))} />
        <span>Gleiche Inhalte wie {sourceLabel} anzeigen (Bild wird automatisch angepasst)</span>
      </label>

      {isMirroring ? (
        <div className="rounded-lg border border-base-300/60 bg-base-200/40 p-3 text-sm text-base-content/70">
          Inhalte werden von {sourceLabel} übernommen. Eigene Slides bleiben gespeichert, sind aber deaktiviert.
        </div>
      ) : (
        <>
          <UploadDropZone
            multiple
            accept="image/*,application/pdf"
            label="Dateien wählen"
            hint="(z.B. PNG, JPG, GIF oder PDF)"
            maxUploadSize={'1MB pro Bild'}
            onSelectedFilesChanged={() => undefined}
            onFilesSelected={onFilesSelected}
          />
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <UiLoading size="sm" />
              Dateien werden hochgeladen...
            </div>
          ) : null}

          <SignageSlideFilter value={filter} onChange={onFilterChange} />

          <SignageSlideBulkActions
            selectedCount={selectedIds.size}
            onApply={handleBulkApply}
            onDisable={() => handleBulkEnable(false)}
            onEnable={() => handleBulkEnable(true)}
            onClearSelection={onClearSelection}
          />

          <SignageSlideList
            slides={filteredSlides}
            selectedIds={selectedIds}
            onChange={(slides) => {
              const filteredIds = new Set(filteredSlides.map((slide) => slide.id));
              const reorderedVisible = slides;
              const hiddenSlides = state.slides.filter((slide) => !filteredIds.has(slide.id));
              onStateChange({
                ...state,
                slides: [...reorderedVisible, ...hiddenSlides].map((slide, index) => ({ ...slide, order: index })),
              });
            }}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={() => onToggleSelectAll(filteredSlides.map((slide) => slide.id))}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDelete}
            onScheduleApply={handleSlideScheduleApply}
          />
        </>
      )}

      <FormControl>
        <Label>
          <LabelText>Anzeigedauer pro Slide (Sekunden)</LabelText>
        </Label>
        <Input
          type="number"
          min={1}
          max={300}
          disabled={!isMirroring && state.slides.length === 0}
          value={state.slideDurationSeconds}
          onChange={(event) =>
            onStateChange({
              ...state,
              slideDurationSeconds: Math.max(1, Number(event.target.value) || 10),
            })
          }
        />
      </FormControl>
      <FormControl>
        <Label>
          <LabelText>Hintergrund</LabelText>
        </Label>
        <div className="flex flex-col gap-2">
          <Label className="flex-row items-center gap-2">
            <Radio
              name={`background-mode-${format}`}
              value="COLOR"
              checked={state.backgroundMode === 'COLOR'}
              disabled={!isMirroring && state.slides.length === 0}
              onChange={() => onStateChange({ ...state, backgroundMode: 'COLOR' })}
            />
            <LabelText>Farbe</LabelText>
          </Label>
          <Label className="flex-row items-center gap-2">
            <Radio
              name={`background-mode-${format}`}
              value="BLURRED"
              checked={state.backgroundMode === 'BLURRED'}
              disabled={!isMirroring && state.slides.length === 0}
              onChange={() => onStateChange({ ...state, backgroundMode: 'BLURRED' })}
            />
            <LabelText>Unscharfer Hintergrund</LabelText>
          </Label>
        </div>
      </FormControl>
      {state.backgroundMode === 'COLOR' ? (
        <FormControl>
          <Label>
            <LabelText>Hintergrundfarbe</LabelText>
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative h-11 w-full min-w-32 overflow-hidden rounded-lg border border-base-300 sm:w-32">
              <Input
                type="color"
                disabled={!isMirroring && state.slides.length === 0}
                value={state.backgroundColor ?? '#000000'}
                onChange={(event) => onStateChange({ ...state, backgroundColor: event.target.value })}
                bordered={false}
                className="absolute inset-0 h-full min-h-0 w-full cursor-pointer border-0 bg-transparent p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={(!isMirroring && state.slides.length === 0) || state.backgroundColor == null}
              onClick={() => onStateChange({ ...state, backgroundColor: null })}
            >
              Farbe entfernen
            </Button>
          </div>
        </FormControl>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Live-Vorschau</div>
        <SignageMonitorPreview format={formatView} />
      </div>
    </div>
  );
}

const ManageMonitorPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const [signageLoading, setSignageLoading] = useState<boolean>(true);
  const [landscape, setLandscape] = useState<SignageFormatState>(defaultFormatState);
  const [portrait, setPortrait] = useState<SignageFormatState>(defaultFormatState);
  const [updatingSignage, setUpdatingSignage] = useState<boolean>(false);
  const [landscapeUploading, setLandscapeUploading] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [copyToClipboardLoading, setCopyToClipboardLoading] = useState<boolean>(false);
  const [landscapeSelectedIds, setLandscapeSelectedIds] = useState<Set<string>>(new Set());
  const [portraitSelectedIds, setPortraitSelectedIds] = useState<Set<string>>(new Set());
  const [landscapeFilter, setLandscapeFilter] = useState<SignageSlideFilterState>(defaultFilterState);
  const [portraitFilter, setPortraitFilter] = useState<SignageSlideFilterState>(defaultFilterState);

  const handleUpdateSignage = useCallback(async () => {
    if (!workspaceId) return;
    setUpdatingSignage(true);

    const payload: SignageSettingsUpdatePayload = {
      landscape: buildFormatPayload(landscape),
      portrait: buildFormatPayload(portrait),
    };

    try {
      await putSignageSettings(workspaceId as string, payload);
      alertService.success('Reihenfolge und Anzeigedauer gespeichert');
    } catch (error) {
      console.error('SettingsPage -> handleUpdateSignage', error);
      alertService.error(error instanceof Error ? error.message : 'Es ist ein Fehler aufgetreten');
    } finally {
      setUpdatingSignage(false);
    }
  }, [landscape, portrait, workspaceId]);

  const fetchSignage = useCallback(() => {
    if (workspaceId == undefined) return;
    setSignageLoading(true);
    fetch(`/api/signage/${workspaceId}?includeInactive=true`)
      .then(async (response) => response.json())
      .then((data) => {
        const nextLandscape = defaultFormatState();
        const nextPortrait = defaultFormatState();

        data.content.forEach((signage: SignageFormatView) => {
          const formatState: SignageFormatState = {
            slides: signage.slides,
            backgroundColor: signage.backgroundColor ?? null,
            backgroundMode: signage.backgroundMode ?? 'COLOR',
            slideDurationSeconds: signage.slideDurationSeconds,
            mirrorSourceFormat: signage.mirrorSourceFormat ?? null,
          };

          if (signage.format === MonitorFormat.PORTRAIT) {
            Object.assign(nextPortrait, formatState);
          } else {
            Object.assign(nextLandscape, formatState);
          }
        });

        setLandscape(nextLandscape);
        setPortrait(nextPortrait);
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

  ManageMonitorPage.pullToRefresh = () => {
    fetchSignage();
  };

  const uploadSlides = async (
    files: File[],
    format: MonitorFormat,
    setUploading: (value: boolean) => void,
    setState: React.Dispatch<React.SetStateAction<SignageFormatState>>,
  ) => {
    if (!workspaceId) return;
    setUploading(true);
    try {
      const processedSlides = await processSignageFiles(files);
      if (processedSlides.length === 0) {
        return;
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/admin/signage/slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          slides: processedSlides,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        alertService.error(body.message ?? 'Fehler beim Hochladen');
        return;
      }

      setState((current) => ({
        ...current,
        slides: [...current.slides, ...body.slides],
      }));
      alertService.success('Upload erfolgreich');
    } catch (error) {
      console.error('uploadSlides', error);
      alertService.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const handleMirrorChange = async (
    format: MonitorFormat,
    state: SignageFormatState,
    setState: React.Dispatch<React.SetStateAction<SignageFormatState>>,
    mirrorSourceFormat: MonitorFormat | null,
  ) => {
    if (!workspaceId) return;

    const nextState: SignageFormatState = {
      ...state,
      mirrorSourceFormat,
      slides: mirrorSourceFormat
        ? state.slides.map((slide) => ({ ...slide, enabled: false }))
        : state.slides.length === 1 && !state.slides[0].enabled
          ? [{ ...state.slides[0], enabled: true }]
          : state.slides,
    };

    const payload: SignageSettingsUpdatePayload = {
      [formatPayloadKey(format)]: {
        ...buildFormatPayload(nextState),
        mirrorSourceFormat,
      },
    };

    try {
      await putSignageSettings(workspaceId as string, payload);
      setState(nextState);
      alertService.success(mirrorSourceFormat ? `Spiegelung von ${formatLabel(mirrorSourceFormat)} aktiviert` : 'Spiegelung deaktiviert');
    } catch (error) {
      console.error('handleMirrorChange', error);
      alertService.error(error instanceof Error ? error.message : 'Fehler beim Speichern der Spiegelung');
    }
  };

  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, slideId: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  };

  const toggleSelectAll = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, slideIds: string[]) => {
    setter((current) => {
      const allSelected = slideIds.every((id) => current.has(id));
      if (allSelected) {
        const next = new Set(current);
        slideIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...current, ...slideIds]);
    });
  };

  return (
    <ManageEntityLayout title={'Monitor'} backLink={`/workspaces/${workspaceId}/manage`}>
      {userContext.isUserPermitted(Role.MANAGER) ? (
        <Card>
          <CardBody>
            <CardTitle className="w-full justify-between">
              <div>Statische Karte</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  setCopyToClipboardLoading(true);
                  await navigator.clipboard.writeText(`${window.location.origin}/signage?id=${workspaceId}`);
                  setCopyToClipboardLoading(false);
                  alertService.info('In Zwischenablage kopiert');
                }}
                disabled={copyToClipboardLoading}
              >
                {copyToClipboardLoading ? <UiLoading size="sm" /> : null}
                <FaShareAlt /> Link kopieren
              </Button>
            </CardTitle>
            {signageLoading ? (
              <div className="flex w-full flex-col items-center justify-center gap-2">
                <UiLoading />
                <div>Lade Einstellungen...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SignageFormatEditor
                  title="Horizontal"
                  workspaceId={workspaceId as string}
                  format={MonitorFormat.LANDSCAPE}
                  state={landscape}
                  sourceSlides={portrait.slides}
                  uploading={landscapeUploading}
                  selectedIds={landscapeSelectedIds}
                  filter={landscapeFilter}
                  onStateChange={setLandscape}
                  onFilesSelected={(files) => uploadSlides(files, MonitorFormat.LANDSCAPE, setLandscapeUploading, setLandscape)}
                  onToggleSelect={(slideId) => toggleSelection(setLandscapeSelectedIds, slideId)}
                  onToggleSelectAll={(slideIds) => toggleSelectAll(setLandscapeSelectedIds, slideIds)}
                  onFilterChange={setLandscapeFilter}
                  onClearSelection={() => setLandscapeSelectedIds(new Set())}
                  onMirrorChange={(mirrorSourceFormat) => handleMirrorChange(MonitorFormat.LANDSCAPE, landscape, setLandscape, mirrorSourceFormat)}
                />
                <SignageFormatEditor
                  title="Vertikal"
                  workspaceId={workspaceId as string}
                  format={MonitorFormat.PORTRAIT}
                  state={portrait}
                  sourceSlides={landscape.slides}
                  uploading={portraitUploading}
                  selectedIds={portraitSelectedIds}
                  filter={portraitFilter}
                  onStateChange={setPortrait}
                  onFilesSelected={(files) => uploadSlides(files, MonitorFormat.PORTRAIT, setPortraitUploading, setPortrait)}
                  onToggleSelect={(slideId) => toggleSelection(setPortraitSelectedIds, slideId)}
                  onToggleSelectAll={(slideIds) => toggleSelectAll(setPortraitSelectedIds, slideIds)}
                  onFilterChange={setPortraitFilter}
                  onClearSelection={() => setPortraitSelectedIds(new Set())}
                  onMirrorChange={(mirrorSourceFormat) => handleMirrorChange(MonitorFormat.PORTRAIT, portrait, setPortrait, mirrorSourceFormat)}
                />
              </div>
            )}
            <Button type="button" variant="primary" disabled={updatingSignage || signageLoading} onClick={handleUpdateSignage}>
              {updatingSignage ? <UiLoading size="sm" /> : null}
              Reihenfolge und Anzeigedauer speichern
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </ManageEntityLayout>
  );
};

export default withPagePermission(['MANAGER'], ManageMonitorPage, '/workspaces/[workspaceId]/manage');
