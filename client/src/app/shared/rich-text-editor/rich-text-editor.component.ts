import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { FileService } from '../file/file.service';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { ToastService } from '../toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { getFileUrl } from '../file/file-url.util';

const maxImageSize = 5 * 1024 * 1024;

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, TiptapEditorDirective, TranslocoModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.scss']
})
export class RichTextEditorComponent {
  private static nextId = 0;
  readonly imageInputId = `rich-text-editor-image-${RichTextEditorComponent.nextId++}`;

  @Input({ required: true }) editor!: Editor;

  /**
   * Phone layout: the toolbar only has room for one row, so everything past
   * undo/redo, bold/italic, the bullet list, the link and the image is folded
   * away and this opens it. The wide layout shows the lot and ignores it.
   */
  showExtraTools = false;

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {}

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

}
