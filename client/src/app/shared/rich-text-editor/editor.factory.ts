import { Editor, Extensions } from '@tiptap/core';

import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { InlineMath } from './math.extension';
import Placeholder from '@tiptap/extension-placeholder';
import { Strike } from '@tiptap/extension-strike';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { UndoRedo } from '@tiptap/extensions';

/**
 * StarterKit's own binding pairs redo with Ctrl+Shift+Z (and Ctrl+Y as an
 * alias); here Ctrl+Y is the only one, so undo/redo read as a matched pair on
 * the keyboard the way they already do on the toolbar.
 */
const UndoRedoWithCtrlY = UndoRedo.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
    };
  },
});

/** Ctrl+S is free for this: the browser's save dialog never has a role inside the editor. */
const StrikeWithCtrlS = Strike.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => this.editor.commands.toggleStrike(),
    };
  },
});

export interface RichTextEditorOptions {
  /** Resolved lazily, so the placeholder follows the active language. */
  placeholder?: () => string;
  /**
   * Registers the Image node. It is not only about the toolbar button: TipTap
   * parses stored HTML against the registered schema, so an editor without it
   * silently drops the <img> tags of the content it loads.
   */
  withImage?: boolean;
  onUpdate?: (editor: Editor) => void;
  onBlur?: () => void;
}

/**
 * Every TipTap editor in the app is built from the same extension set; only the
 * placeholder and whether images are allowed change between call sites.
 */
export function createRichTextEditor(
  options: RichTextEditorOptions = {},
): Editor {
  const { placeholder, withImage = true, onUpdate, onBlur } = options;

  const extensions: Extensions = [
    StarterKit.configure({ undoRedo: false, strike: false, codeBlock: false }),
    UndoRedoWithCtrlY,
    StrikeWithCtrlS,
    Highlight,
    TableKit.configure({ table: { resizable: false } }),
    InlineMath,
  ];

  if (withImage) {
    extensions.push(Image.configure({ inline: false }));
  }

  if (placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: ({ editor }) => (editor.isEmpty ? placeholder() : ''),
      }),
    );
  }

  return new Editor({
    extensions,
    ...(onUpdate ? { onUpdate: ({ editor }) => onUpdate(editor) } : {}),
    ...(onBlur ? { onBlur } : {}),
  });
}
