import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import { FileService } from '../file/file.service';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { ToastService } from '../../toast/toast.service';
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

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private transloco: TranslocoService
  ) {}

  toggleLink(): void {
    if (this.editor.isActive('link')) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt(this.transloco.translate('editor.linkPrompt'));
    if (!url) return;

    // With nothing selected there is no text to turn into a link, and setLink
    // would only arm the mark: everything typed next would silently become part
    // of the link. In that case the URL itself is inserted as the link text.
    if (this.editor.state.selection.empty) {
      this.editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs: { href: url } }],
        })
        .run();
      return;
    }

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
