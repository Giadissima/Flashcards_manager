import { InlineMathNode } from '@aarkue/tiptap-math-extension';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import katex from 'katex';

/** Node name registered by the math extension, used to recognise a formula. */
export const mathNodeName = 'inlineMath';

/**
 * The formula node of @aarkue/tiptap-math-extension, with its node view
 * replaced. The original one only draws the KaTeX output, so a formula with no
 * LaTeX in it yet - the state every formula starts in, since the toolbar
 * inserts an empty one and the formula bar fills it in - renders to nothing at
 * all: there would be no box on the page to see, to click, or to know where the
 * formula is going to end up. This one adds the two classes the stylesheet
 * needs to draw that box (see .tiptap-math in styles.scss) and is otherwise the
 * same rendering.
 */
export const InlineMath = InlineMathNode.extend({
  /**
   * Puts an empty inline formula where the cursor is and selects it, which is
   * what opens the formula bar (the toolbar's LaTeX button does the same two
   * steps; the editor's `selectionUpdate` listener reacts to the selection
   * either way, so there is nothing else to wire up here).
   */
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-f': () => {
        this.editor
          .chain()
          .focus()
          .insertContent({ type: mathNodeName, attrs: { latex: '', display: 'no', evaluate: 'no' } })
          .run();

        const pos = this.editor.state.selection.from - 1;
        const node = this.editor.state.doc.nodeAt(pos);
        if (node?.type.name !== mathNodeName) return true;

        this.editor.view.dispatch(
          this.editor.state.tr.setSelection(NodeSelection.create(this.editor.state.doc, pos))
        );
        return true;
      },
    };
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.classList.add('tiptap-math', 'latex');

      const render = (mathNode: ProseMirrorNode): void => {
        const latex = typeof mathNode.attrs['latex'] === 'string' ? mathNode.attrs['latex'] : '';
        const displayMode = mathNode.attrs['display'] === 'yes';

        dom.classList.toggle('is-empty', latex.trim().length === 0);
        dom.classList.toggle('is-block', displayMode);

        if (latex.trim().length === 0) {
          // KaTeX renders an empty formula as an empty box of its own, which
          // would sit inside the dashed one the class above draws.
          dom.textContent = '';
          return;
        }

        katex.render(latex, dom, {
          displayMode,
          throwOnError: false,
          ...(this.options.katexOptions ?? {}),
        });
      };

      render(node);

      return {
        dom,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type.name !== node.type.name) return false;
          render(updatedNode);
          return true;
        },
        // The content of the span is written here, by KaTeX: without this every
        // redraw would reach ProseMirror as an edit made to the document.
        ignoreMutation: () => true,
      };
    };
  },
}).configure({ evaluation: false });
