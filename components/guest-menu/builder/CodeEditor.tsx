/**
 * CodeMirror 6 editor for Liquid/HTML slots and CSS with error line markers
 * (gutter + line highlight). Client-only (import via next/dynamic or inside effects).
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, Decoration, GutterMarker, gutter, keymap, type DecorationSet } from '@codemirror/view';
import { Compartment, EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

export interface CodeEditorError {
  line: number;
  message: string;
}

export interface CodeEditorHandle {
  insert: (text: string) => void;
  goToLine: (line: number) => void;
  focus: () => void;
}

const setErrors = StateEffect.define<CodeEditorError[]>();

class ErrorMarker extends GutterMarker {
  constructor(private readonly message: string) {
    super();
  }
  toDOM() {
    const element = document.createElement('span');
    element.textContent = '●';
    element.title = this.message;
    element.className = 'cm-gm-error-marker';
    return element;
  }
}

function buildDecorations(state: EditorState, errors: CodeEditorError[]): { lines: DecorationSet; markers: RangeSet<GutterMarker> } {
  const lineDecorations = [];
  const markers = [];
  const seen = new Set<number>();
  for (const error of [...errors].sort((a, b) => a.line - b.line)) {
    if (error.line < 1 || error.line > state.doc.lines || seen.has(error.line)) continue;
    seen.add(error.line);
    const line = state.doc.line(error.line);
    lineDecorations.push(Decoration.line({ class: 'cm-gm-error-line', attributes: { title: error.message } }).range(line.from));
    markers.push(new ErrorMarker(error.message).range(line.from));
  }
  return { lines: Decoration.set(lineDecorations), markers: RangeSet.of(markers) };
}

const errorField = StateField.define<{ errors: CodeEditorError[]; lines: DecorationSet; markers: RangeSet<GutterMarker> }>({
  create: () => ({ errors: [], lines: Decoration.none, markers: RangeSet.empty }),
  update(value, transaction) {
    let errors = value.errors;
    for (const effect of transaction.effects) if (effect.is(setErrors)) errors = effect.value;
    if (errors === value.errors && !transaction.docChanged) return value;
    return { errors, ...buildDecorations(transaction.state, errors) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.lines),
});

const errorGutter = gutter({
  class: 'cm-gm-error-gutter',
  markers: (view) => view.state.field(errorField).markers,
});

const theme = EditorView.theme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  '.cm-gm-error-line': { backgroundColor: 'rgb(239 68 68 / 0.15)' },
  '.cm-gm-error-gutter': { width: '12px' },
  '.cm-gm-error-marker': { color: 'rgb(220 38 38)', cursor: 'help', paddingLeft: '2px' },
});

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: 'html' | 'css';
  errors?: CodeEditorError[];
  readOnly?: boolean;
  ariaLabel?: string;
  editorRef?: Ref<CodeEditorHandle>;
}

export default function CodeEditor({ value, onChange, language, errors = [], readOnly = false, ariaLabel, editorRef }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const readOnlyCompartment = useRef(new Compartment());
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          language === 'css' ? css() : html({ matchClosingTags: false, autoCloseTags: false }),
          errorField,
          errorGutter,
          theme,
          EditorView.lineWrapping,
          readOnlyCompartment.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? '' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate only when the language changes; value/readOnly/errors are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // External value changes (undo/redo, tab switch, reset).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrors.of(errors) });
  }, [errors]);

  useImperativeHandle(
    editorRef,
    () => ({
      insert: (text: string) => {
        const view = viewRef.current;
        if (!view || readOnly) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
        view.focus();
      },
      goToLine: (line: number) => {
        const view = viewRef.current;
        if (!view) return;
        const target = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
        view.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
    }),
    [readOnly],
  );

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden rounded-md border border-base-300 bg-base-100 [&_.cm-editor]:h-full" />;
}
