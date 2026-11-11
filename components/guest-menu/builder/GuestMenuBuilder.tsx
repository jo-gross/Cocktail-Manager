/**
 * Guest menu builder (docs/GUEST-MENU-CONCEPT.md → Builder).
 *
 * Desktop: left tabs (Struktur, Design, Informationen, Ausgaben, Zeitplan &
 * Quelle, Code) · center live preview · right inspector/hints.
 * Mobile: one column with tabs (edit / preview / properties / hints).
 *
 * The document lives in an undo/redo history; changes are autosaved
 * (debounced `PUT /draft`) and the server preview is refetched after each save.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { Alert, cn } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { ConfirmActionModal } from '@components/modals/ConfirmActionModal';
import { alertService } from '@lib/alertService';
import { useUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { ApiV1RequestError, alertApiV1Error } from '@lib/network/apiV1';
import {
  getGuestMenu,
  previewGuestMenu,
  publishGuestMenu,
  saveGuestMenuDraft,
  unpublishGuestMenu,
  type GuestMenuPublishIssue,
  type GuestMenuRenderResult,
} from '@lib/network/guestMenus';
import { createHistory, pushHistory, redoHistory, toSavableDocument, undoHistory, type History } from '@lib/guest-menu/builder';
import { safeParseGuestMenuDocument, type Block, type GuestMenuDocument } from '@lib/guest-menu/schema';
import { getAllContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import type { GuestMenuDto } from '@lib/schemas/guestMenus';
import {
  BuilderContext,
  previewModeToOutput,
  useBuilder,
  type BuilderContextValue,
  type BuilderSelection,
  type PreviewDevice,
  type PreviewMode,
} from './BuilderContext';
import { BuilderTopBar, type SaveStatus } from './BuilderTopBar';
import { CodePanel } from './CodePanel';
import { DesignPanel } from './DesignPanel';
import { FieldsPanel } from './FieldsPanel';
import { GuestMenuBuilderSkeleton } from './GuestMenuBuilderSkeleton';
import { Inspector } from './Inspector';
import { OutputsPanel } from './OutputsPanel';
import { PreviewPane } from './PreviewPane';
import { SchedulePanel } from './SchedulePanel';
import { StructurePanel } from './StructurePanel';
import { useBuilderData } from './useBuilderData';
import { useBuilderWarnings, ValidationPanel } from './ValidationPanel';

type LeftTab = 'structure' | 'design' | 'fields' | 'outputs' | 'schedule' | 'code';
const LEFT_TABS: LeftTab[] = ['structure', 'design', 'fields', 'outputs', 'schedule', 'code'];
type RightTab = 'inspector' | 'hints';
type MobileTab = 'edit' | 'preview' | 'inspector' | 'hints';

const AUTOSAVE_DELAY_MS = 900;
const PREVIEW_DELAY_MS = 150;

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || !!element.closest('.cm-editor'));
}

function TabButton({ active, onClick, children, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1 border-b-2 px-2.5 py-2 text-sm font-medium whitespace-nowrap',
        active ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content',
      )}
    >
      {children}
      {badge != null && badge > 0 && <span className="rounded-full bg-warning px-1.5 text-[0.65rem] text-warning-content">{badge}</span>}
    </button>
  );
}

export function GuestMenuBuilder({ workspaceId, menuId }: { workspaceId: string; menuId: string }) {
  const { t } = useTranslation('guestMenu');
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const canEdit = userContext.isUserPermitted(Role.MANAGER);
  const data = useBuilderData(workspaceId);

  const [menu, setMenu] = useState<GuestMenuDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<History<GuestMenuDocument> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [locale, setLocale] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('web');
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [preview, setPreview] = useState<GuestMenuRenderResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishIssues, setPublishIssues] = useState<GuestMenuPublishIssue[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>('structure');
  const [rightTab, setRightTab] = useState<RightTab>('inspector');
  const [mobileTab, setMobileTab] = useState<MobileTab>('edit');

  const lastSavedJson = useRef<string>('');
  const savingRef = useRef<Promise<void> | null>(null);
  const documentRef = useRef<GuestMenuDocument | null>(null);
  const document = history?.present ?? null;
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  // Load menu --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    getGuestMenu(workspaceId, menuId)
      .then((loaded) => {
        if (cancelled) return;
        setMenu(loaded);
        setHistory(createHistory(loaded.draft));
        lastSavedJson.current = JSON.stringify(toSavableDocument(loaded.draft));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiV1RequestError && error.status === 404 ? t('builder.notFound') : t('errors.load'));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, menuId, t]);

  // Locales ------------------------------------------------------------------
  const primaryLocale = data.localeSettings?.contentLocales.primary ?? preview?.dto.primaryLocale ?? 'de';
  const locales = useMemo(() => {
    const base =
      menu && menu.locales.length > 0 ? menu.locales : data.localeSettings ? getAllContentLocales(data.localeSettings.contentLocales) : [primaryLocale];
    return [primaryLocale, ...base.filter((entry) => entry !== primaryLocale)];
  }, [menu, data.localeSettings, primaryLocale]);
  const currentLocale = locale && locales.includes(locale) ? locale : primaryLocale;
  const output = previewModeToOutput(previewMode);

  // History ------------------------------------------------------------------
  const update = useCallback((recipe: (doc: GuestMenuDocument) => GuestMenuDocument, mergeKey?: string) => {
    setHistory((current) => (current ? pushHistory(current, recipe(current.present), mergeKey ?? null) : current));
  }, []);
  const updateBlock = useCallback(
    (blockId: string, recipe: (block: Block) => Block, mergeKey?: string) =>
      update((doc) => ({ ...doc, blocks: doc.blocks.map((block) => (block.id === blockId ? recipe(block) : block)) }), mergeKey),
    [update],
  );
  const undo = useCallback(() => setHistory((current) => (current ? undoHistory(current) : current)), []);
  const redo = useCallback(() => setHistory((current) => (current ? redoHistory(current) : current)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Autosave -----------------------------------------------------------------
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) await savingRef.current;
    const current = documentRef.current;
    if (!current || !canEdit) return true;
    const savable = toSavableDocument(current);
    const json = JSON.stringify(savable);
    if (json === lastSavedJson.current) {
      setSaveStatus('saved');
      return true;
    }
    const parsed = safeParseGuestMenuDocument(savable);
    if (!parsed.success) {
      setSaveStatus('invalid');
      setSaveError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
      return false;
    }
    setSaveStatus('saving');
    let ok = true;
    const promise = saveGuestMenuDraft(workspaceId, menuId, parsed.data)
      .then((saved) => {
        lastSavedJson.current = json;
        setMenu(saved);
        setSaveError(null);
        setSaveStatus(JSON.stringify(toSavableDocument(documentRef.current ?? saved.draft)) === json ? 'saved' : 'dirty');
        setSavedVersion((version) => version + 1);
      })
      .catch((error) => {
        ok = false;
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        savingRef.current = null;
      });
    savingRef.current = promise;
    await promise;
    return ok;
  }, [workspaceId, menuId, canEdit]);

  useEffect(() => {
    if (!document || !canEdit) return;
    if (JSON.stringify(toSavableDocument(document)) === lastSavedJson.current) return;
    setSaveStatus((status) => (status === 'saving' ? status : 'dirty'));
    const timer = window.setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [document, canEdit, saveNow]);

  // Autosave usually wins the race – the prompt only shows when leaving before it ran or after it failed.
  useUnsavedChanges({ dirty: canEdit && saveStatus !== 'saved', onSave: saveNow });

  // Preview ------------------------------------------------------------------
  const metaVersion = menu ? `${menu.sourceMode}|${menu.sourceCardId}|${menu.locales.join(',')}|${menu.name}|${menu.slug}` : '';
  useEffect(() => {
    if (!menu) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      previewGuestMenu(workspaceId, menuId, { locale: currentLocale, output, source: 'draft' })
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error) => {
          if (!cancelled) setPreviewError(error instanceof Error ? error.message : t('builder.preview.failed'));
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, menuId, currentLocale, output, savedVersion, metaVersion, menu != null]);

  // Publish ------------------------------------------------------------------
  const publish = useCallback(async () => {
    setPublishing(true);
    try {
      if (!(await saveNow())) {
        alertService.error(t('errors.invalidDocument'));
        return;
      }
      const published = await publishGuestMenu(workspaceId, menuId);
      setMenu(published);
      setPublishIssues([]);
      alertService.success(t('publishSuccess'));
    } catch (error) {
      if (error instanceof ApiV1RequestError && error.status === 422) {
        setPublishIssues(Array.isArray(error.issues) ? (error.issues as GuestMenuPublishIssue[]) : []);
        setRightTab('hints');
        setMobileTab('hints');
        alertService.error(t('errors.templateError'));
      } else {
        alertApiV1Error(error, t('errors.save'));
      }
    } finally {
      setPublishing(false);
    }
  }, [saveNow, workspaceId, menuId, t]);

  const unpublish = useCallback(() => {
    modalContext.openModal(
      <ConfirmActionModal
        title={t('unpublish')}
        message={t('builder.unpublishConfirm')}
        confirmLabel={t('unpublish')}
        confirmVariant="error"
        onConfirm={async () => {
          try {
            setMenu(await unpublishGuestMenu(workspaceId, menuId));
            alertService.success(t('unpublishSuccess'));
          } catch (error) {
            alertApiV1Error(error, t('errors.save'));
          }
        }}
      />,
    );
  }, [modalContext, workspaceId, menuId, t]);

  const select = useCallback((next: BuilderSelection | null) => {
    setSelection(next);
    if (next) {
      setRightTab('inspector');
      setMobileTab((tab) => (tab === 'preview' || tab === 'hints' ? 'inspector' : tab));
    }
  }, []);

  const contextValue: BuilderContextValue | null = useMemo(
    () =>
      menu && document
        ? {
            workspaceId,
            menu,
            setMenu,
            document,
            update,
            updateBlock,
            locale: currentLocale,
            primaryLocale,
            locales,
            output,
            previewMode,
            selection,
            select,
            data,
            preview,
            canEdit,
          }
        : null,
    [workspaceId, menu, document, update, updateBlock, currentLocale, primaryLocale, locales, output, previewMode, selection, select, data, preview, canEdit],
  );

  if (loadError) {
    return (
      <div className="p-6">
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!contextValue || !history) return <GuestMenuBuilderSkeleton />;

  return (
    <BuilderContext.Provider value={contextValue}>
      <BuilderLayout
        backLink={`/workspaces/${workspaceId}/manage/guest-menus`}
        history={history}
        saveStatus={saveStatus}
        saveError={saveError}
        undo={undo}
        redo={redo}
        setLocale={setLocale}
        setPreviewMode={setPreviewMode}
        device={device}
        setDevice={setDevice}
        publishing={publishing}
        publish={publish}
        unpublish={unpublish}
        publishIssues={publishIssues}
        previewLoading={previewLoading}
        previewError={previewError}
        leftTab={leftTab}
        setLeftTab={setLeftTab}
        rightTab={rightTab}
        setRightTab={setRightTab}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
      />
    </BuilderContext.Provider>
  );
}

interface BuilderLayoutProps {
  backLink: string;
  history: History<GuestMenuDocument>;
  saveStatus: SaveStatus;
  saveError: string | null;
  undo: () => void;
  redo: () => void;
  setLocale: (locale: string) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  device: PreviewDevice;
  setDevice: (device: PreviewDevice) => void;
  publishing: boolean;
  publish: () => void;
  unpublish: () => void;
  publishIssues: GuestMenuPublishIssue[];
  previewLoading: boolean;
  previewError: string | null;
  leftTab: LeftTab;
  setLeftTab: (tab: LeftTab) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
}

function BuilderLayout(props: BuilderLayoutProps) {
  const { t } = useTranslation('guestMenu');
  const { menu } = useBuilder();
  const warnings = useBuilderWarnings(props.publishIssues);
  const warningCount = warnings.filter((warning) => warning.severity !== 'info').length;

  const leftContent = (
    <>
      {props.leftTab === 'structure' && <StructurePanel />}
      {props.leftTab === 'design' && <DesignPanel />}
      {props.leftTab === 'fields' && <FieldsPanel />}
      {props.leftTab === 'outputs' && <OutputsPanel />}
      {props.leftTab === 'schedule' && <SchedulePanel />}
      {props.leftTab === 'code' && <CodePanel publishIssues={props.publishIssues} />}
    </>
  );
  const leftTabs = (
    <div role="tablist" aria-label={t('builder.tabs.label')} className="flex shrink-0 overflow-x-auto border-b border-base-300 px-1">
      {LEFT_TABS.map((tab) => (
        <TabButton key={tab} active={props.leftTab === tab} onClick={() => props.setLeftTab(tab)}>
          {t(`builder.tabs.${tab}`)}
        </TabButton>
      ))}
    </div>
  );
  const preview = <PreviewPane device={props.device} loading={props.previewLoading} error={props.previewError} />;

  return (
    <>
      <Head>
        <title>{`${t('title')} • ${menu.name}`}</title>
      </Head>
      <div className="flex h-dvh flex-col bg-base-200">
        <BuilderTopBar
          backLink={props.backLink}
          saveStatus={props.saveStatus}
          saveError={props.saveError}
          canUndo={props.history.past.length > 0}
          canRedo={props.history.future.length > 0}
          onUndo={props.undo}
          onRedo={props.redo}
          setLocale={props.setLocale}
          setPreviewMode={props.setPreviewMode}
          device={props.device}
          setDevice={props.setDevice}
          publishing={props.publishing}
          onPublish={props.publish}
          onUnpublish={props.unpublish}
        />

        {/* Desktop: three panes */}
        <div className="hidden min-h-0 flex-1 lg:flex">
          <aside
            className={cn(
              'flex min-h-0 shrink-0 flex-col border-r border-base-300 bg-base-100',
              props.leftTab === 'code' ? 'w-[44rem] max-w-[55vw]' : 'w-[23rem]',
            )}
          >
            {leftTabs}
            <div className="min-h-0 flex-1 overflow-y-auto">{leftContent}</div>
          </aside>
          <main className="min-w-0 flex-1">{preview}</main>
          <aside className="flex min-h-0 w-[22rem] shrink-0 flex-col border-l border-base-300 bg-base-100">
            <div role="tablist" className="flex shrink-0 border-b border-base-300 px-1">
              <TabButton active={props.rightTab === 'inspector'} onClick={() => props.setRightTab('inspector')}>
                {t('builder.tabs.inspector')}
              </TabButton>
              <TabButton active={props.rightTab === 'hints'} onClick={() => props.setRightTab('hints')} badge={warningCount}>
                {t('builder.tabs.hints')}
              </TabButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{props.rightTab === 'inspector' ? <Inspector /> : <ValidationPanel warnings={warnings} />}</div>
          </aside>
        </div>

        {/* Mobile: single column with tabs */}
        <div className="flex min-h-0 flex-1 flex-col lg:hidden">
          <div role="tablist" className="flex shrink-0 overflow-x-auto border-b border-base-300 bg-base-100 px-1">
            {(['edit', 'preview', 'inspector', 'hints'] as MobileTab[]).map((tab) => (
              <TabButton key={tab} active={props.mobileTab === tab} onClick={() => props.setMobileTab(tab)} badge={tab === 'hints' ? warningCount : undefined}>
                {t(`builder.mobileTabs.${tab}`)}
              </TabButton>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-base-100">
            {props.mobileTab === 'edit' && (
              <div className="flex min-h-full flex-col">
                {leftTabs}
                {leftContent}
              </div>
            )}
            {props.mobileTab === 'preview' && <div className="h-full bg-base-200">{preview}</div>}
            {props.mobileTab === 'inspector' && <Inspector />}
            {props.mobileTab === 'hints' && <ValidationPanel warnings={warnings} />}
          </div>
        </div>
      </div>
    </>
  );
}
