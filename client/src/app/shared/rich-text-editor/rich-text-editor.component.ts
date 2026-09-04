import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { FileService } from '../file/file.service';
import { NodeSelection } from '@tiptap/pm/state';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { ToastService } from '../toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getFileUrl } from '../file/file-url.util';
import { mathNodeName } from './math.extension';

const maxImageSize = 5 * 1024 * 1024;

/** One button of the palette the formula bar shows under its field. */
export interface MathSymbol {
  /** Drawn on the button: the symbol itself, or a sample of the shape. */
  label: string;
  /** Written into the field, at the caret. */
  latex: string;
}

/**
 * Enough to write most of what a flashcard asks for without knowing LaTeX, and
 * short enough to stay on a couple of rows. The order goes from the shapes that
 * hold something else - a fraction, a root, an exponent - to the symbols that
 * stand on their own.
 */
const mathSymbols: MathSymbol[] = [
  { label: 'a/b', latex: '\\frac{}{}' },
  { label: '√', latex: '\\sqrt{}' },
  { label: 'xⁿ', latex: '^{}' },
  { label: 'xₙ', latex: '_{}' },
  { label: '∑', latex: '\\sum_{}^{}' },
  { label: '∫', latex: '\\int_{}^{}' },
  { label: 'lim', latex: '\\lim_{}' },
  { label: '×', latex: '\\times' },
  { label: '÷', latex: '\\div' },
  { label: '⋅', latex: '\\cdot' },
  { label: '±', latex: '\\pm' },
  { label: '≤', latex: '\\leq' },
  { label: '≥', latex: '\\geq' },
  { label: '≠', latex: '\\neq' },
  { label: '≈', latex: '\\approx' },
  { label: 'π', latex: '\\pi' },
  { label: 'α', latex: '\\alpha' },
  { label: 'β', latex: '\\beta' },
  { label: 'θ', latex: '\\theta' },
  { label: 'Δ', latex: '\\Delta' },
  { label: '∞', latex: '\\infty' },
  { label: '→', latex: '\\to' },
];

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, TiptapEditorDirective, TranslocoModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.scss']
})
export class RichTextEditorComponent implements OnInit, OnDestroy {
  private static nextId = 0;
  readonly imageInputId = `rich-text-editor-image-${RichTextEditorComponent.nextId++}`;

  readonly mathSymbols = mathSymbols;

  @Input({ required: true }) editor!: Editor;

  /**
   * Phone layout: the toolbar only has room for one row, so everything past
   * undo/redo, bold/italic, the bullet list, the link and the image is folded
   * away and this opens it. The wide layout shows the lot and ignores it.
   */
  showExtraTools = false;

  /**
   * The formula bar is open on the formula the cursor is on. A formula is a
   * single atom of the document - KaTeX draws it and there is nothing inside it
   * to type into - so its LaTeX is written in the bar, while the text keeps
   * showing the result of what is being written.
   */
  editingMath = false;
  /** The open formula is rendered on a line of its own rather than in line. */
  mathIsBlock = false;

  /** Where in the document the formula the bar is editing sits. */
  private mathPos: number | null = null;
  /** What that formula held when the bar opened, for Escape to put back. */
  private mathLatexBeforeEdit = '';
  /** The LaTeX in the field, kept here so a reopened bar can show it again. */
  private mathLatex = '';
  /** Closing drops an empty formula, which would reopen the bar unguarded. */
  private closingMath = false;
  private mathInputEl?: HTMLInputElement;

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {}

  /** The field is only in the view while the bar is open, hence the setter. */
  @ViewChild('mathInput')
  set mathInput(ref: ElementRef<HTMLInputElement> | undefined) {
    this.mathInputEl = ref?.nativeElement;
    this.fillMathInput();
  }

  ngOnInit(): void {
    this.editor.on('selectionUpdate', this.onSelectionUpdate);
  }

  ngOnDestroy(): void {
    this.editor.off('selectionUpdate', this.onSelectionUpdate);
  }

  /**
   * Material Symbols name for the block the cursor sits in, shown on the button
   * that opens the paragraph/heading menu. With an icon font the glyph is the
   * element's text, so it is computed here instead of toggled through classes.
   */
  get currentBlockIcon(): string {
    for (const level of [1, 2, 3] as const) {
      if (this.editor.isActive('heading', { level })) return `format_h${level}`;
    }
    return 'format_paragraph';
  }

  toggleExtraTools(): void {
    this.showExtraTools = !this.showExtraTools;
  }

  toggleLink(): void {
    // Already writing inside a link: stop it here, so what follows is plain
    // text. Only the pending mark is dropped - unsetLink() would have used
    // extendEmptyMarkRange and stripped the link off the whole word already
    // typed, which left the button with no way to end a link.
    if (this.editor.isActive('link')) {
      this.editor.chain().focus().unsetMark('link').run();
      return;
    }

    const url = window.prompt(this.transloco.translate('editor.linkPrompt'));
    if (!url) return;

    // With a selection the link wraps it. With none, the mark is armed instead:
    // whatever is typed next comes out linked, until the button is pressed
    // again to end it.
    this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  /** Puts an empty formula where the cursor is and opens the bar on it. */
  insertMath(isBlock: boolean): void {
    this.editor
      .chain()
      .focus()
      .insertContent({
        type: mathNodeName,
        attrs: { latex: '', display: isBlock ? 'yes' : 'no', evaluate: 'no' },
      })
      .run();

    // insertContent leaves the cursor right after the formula, and a formula
    // takes up a single position. Selecting it is what opens the bar.
    this.selectMath(this.editor.state.selection.from - 1);
  }

  /** Every keystroke in the field, so the text follows what is being written. */
  onMathInput(latex: string): void {
    this.mathLatex = latex;
    this.writeMathLatex(latex);
  }

  /** A palette button: writes its LaTeX where the caret is in the field. */
  insertMathSymbol(symbol: MathSymbol): void {
    const input = this.mathInputEl;
    if (!input) return;

    // A command spelled out in letters would run into whatever is typed after
    // it (\timesx is not \times), so it keeps the space that ends it.
    const snippet = /[a-zA-Z]$/.test(symbol.latex) ? `${symbol.latex} ` : symbol.latex;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const latex = input.value.slice(0, start) + snippet + input.value.slice(end);
    // Inside the first pair of braces, which is where the rest of the formula
    // goes; a symbol with no braces takes the caret to the end of what it wrote.
    const brace = snippet.indexOf('{');
    const caret = start + (brace === -1 ? snippet.length : brace + 1);

    this.onMathInput(latex);
    input.value = latex;
    input.setSelectionRange(caret, caret);
    input.focus();
  }

  /** Switches the open formula between in line and on a line of its own. */
  toggleMathDisplay(): void {
    const pos = this.mathPos;
    if (pos === null || !this.mathNodeAt(pos)) return;

    this.mathIsBlock = !this.mathIsBlock;
    this.editor.view.dispatch(
      this.editor.state.tr.setNodeAttribute(pos, 'display', this.mathIsBlock ? 'yes' : 'no')
    );
    this.mathInputEl?.focus();
  }

  /** Enter, or the tick: closes the bar and goes back to writing the text. */
  finishMath(event?: Event): void {
    // The field sits inside the form of the page around it, which Enter would
    // otherwise submit.
    event?.preventDefault();

    const pos = this.mathPos;
    const dropped = pos !== null && this.isMathEmptyAt(pos);
    this.closeMathBar();
    if (pos === null) return;

    // Right after the formula, or where it stood if it has just been dropped.
    this.editor.chain().focus().setTextSelection(dropped ? pos : pos + 1).run();
  }

  /** Escape: puts back the LaTeX the formula held when the bar opened. */
  cancelMath(event?: Event): void {
    event?.preventDefault();
    // A formula inserted a moment ago held none, so it is left empty and
    // closing the bar drops it, which is what Escape is expected to do.
    this.mathLatex = this.mathLatexBeforeEdit;
    this.writeMathLatex(this.mathLatex);
    this.finishMath();
  }

  /**
   * Left arrow with the caret already at the start of the field: the cursor
   * comes out on the left of the formula and the bar closes. The field is not
   * part of the document, so without this there would be no way of walking back
   * into the text before a formula - the arrow would stay stuck at the start of
   * the LaTeX with nowhere left to go.
   */
  leaveMathLeft(event: Event): void {
    const input = this.mathInputEl;
    if (!input || input.selectionStart !== 0 || input.selectionEnd !== 0) return;

    event.preventDefault();
    const pos = this.mathPos;
    this.closeMathBar();
    if (pos === null) return;

    // Right before the formula, which is where it stood whether closing has
    // just dropped it or not.
    this.editor.chain().focus().setTextSelection(pos).run();
  }

  /** The other way round: past the end of the field is past the formula. */
  leaveMathRight(event: Event): void {
    const input = this.mathInputEl;
    if (!input) return;

    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) return;

    this.finishMath(event);
  }

  /** The bin: removes the formula the bar is on, written or not. */
  deleteMath(): void {
    const pos = this.mathPos;
    if (pos === null) return;

    // An empty one is dropped by closing the bar; asking twice would take the
    // formula that has moved into its place with it.
    const dropped = this.isMathEmptyAt(pos);
    this.closeMathBar();
    if (!dropped && this.mathNodeAt(pos)) {
      this.editor.view.dispatch(this.editor.state.tr.delete(pos, pos + 1));
    }
    this.editor.chain().focus().setTextSelection(pos).run();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toastService.show(this.transloco.translate('flashcard.toast.invalidImageType'), 'error');
      input.value = '';
      return;
    }
    if (file.size > maxImageSize) {
      this.toastService.show(this.transloco.translate('flashcard.toast.imageTooLarge'), 'error');
      input.value = '';
      return;
    }

    try {
      const { _id } = await this.fileService.upload(file);
      this.editor.chain().focus().setImage({ src: getFileUrl(_id) }).run();
    } catch (err) {
      console.error('Error uploading image', err);
      this.toastService.show(this.transloco.translate('flashcard.toast.imageUploadError'), 'error');
    } finally {
      input.value = '';
    }
  }

  /**
   * A formula is selected whole - by the toolbar that just inserted it, or by
   * clicking it - and that selection is the one thing the bar listens to, so
   * every way of landing on a formula opens it through the same path.
   */
  private readonly onSelectionUpdate = (): void => {
    // Closing the bar can drop a formula, which is a change of its own: the
    // state it leaves behind is read once it is done, just below.
    if (!this.closingMath) this.syncMathBar();
  };

  /** Opens, moves or closes the bar to match the formula under the cursor. */
  private syncMathBar(): void {
    const { selection } = this.editor.state;
    const onMath = selection instanceof NodeSelection && selection.node.type.name === mathNodeName;

    if (this.editingMath && (!onMath || this.mathPos !== selection.from)) {
      this.closeMathBar();
      // Dropping a formula left empty moves back everything after it, so where
      // the cursor is now is read again rather than taken from above.
      this.syncMathBar();
      return;
    }
    if (!onMath || this.editingMath) return;

    const latex = selection.node.attrs['latex'];
    this.mathPos = selection.from;
    this.mathLatex = typeof latex === 'string' ? latex : '';
    this.mathLatexBeforeEdit = this.mathLatex;
    this.mathIsBlock = selection.node.attrs['display'] === 'yes';
    this.editingMath = true;
    this.fillMathInput();
  }

  private selectMath(pos: number): void {
    const { state, view } = this.editor;
    if (!this.mathNodeAt(pos)) return;

    view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
  }

  private closeMathBar(): void {
    if (this.closingMath) return;
    this.closingMath = true;

    const pos = this.mathPos;
    this.editingMath = false;
    this.mathPos = null;

    // A formula left with nothing in it is not a formula: it is the box the
    // toolbar put down and the bar never filled. It is dropped without reaching
    // the history, so undo walks straight past the whole abandoned insertion
    // instead of bringing the empty box back first.
    if (pos !== null && this.isMathEmptyAt(pos)) {
      this.editor.view.dispatch(
        this.editor.state.tr.delete(pos, pos + 1).setMeta('addToHistory', false)
      );
    }

    this.closingMath = false;
  }

  private writeMathLatex(latex: string): void {
    const pos = this.mathPos;
    if (pos === null || !this.mathNodeAt(pos)) return;

    this.editor.view.dispatch(this.editor.state.tr.setNodeAttribute(pos, 'latex', latex));
  }

  private mathNodeAt(pos: number) {
    const node = this.editor.state.doc.nodeAt(pos);
    return node?.type.name === mathNodeName ? node : null;
  }

  private isMathEmptyAt(pos: number): boolean {
    const latex = this.mathNodeAt(pos)?.attrs['latex'];
    return typeof latex !== 'string' || latex.trim().length === 0;
  }

  private fillMathInput(): void {
    const input = this.mathInputEl;
    if (!input || !this.editingMath) return;

    input.value = this.mathLatex;
    // The click that opened the bar is still being handled: the browser puts
    // the focus back into the editor when it runs the default action of that
    // mousedown, so the field can only take it once the event is over.
    setTimeout(() => {
      if (!this.editingMath || this.mathInputEl !== input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
}
