import { Editor, Extensions } from '@tiptap/core';

import Image from '@tiptap/extension-image';
import { InlineMath } from './math.extension';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';

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

  const extensions: Extensions = [StarterKit, InlineMath];

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
