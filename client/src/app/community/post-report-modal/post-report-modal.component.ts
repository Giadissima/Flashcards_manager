import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CommunityService } from '../community.service';
import { FeedPost, ReportReason, reportReasons } from '../../models/post.dto';
import { ModalComponent } from '../../shared/modal/modal.component';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * What is wrong with a post, in the reporter's words.
 *
 * A reason has to be picked and the note is optional, which is the way round
 * that makes a report worth reading: whoever looks at these does it on a phone
 * between two other things, and a list of six words sorts them in a glance
 * where six paragraphs would not.
 */
@Component({
  selector: 'app-post-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, ModalComponent],
  templateUrl: './post-report-modal.component.html',
  styleUrl: './post-report-modal.component.scss',
})
export class PostReportModalComponent implements OnChanges {
  @Input({ required: true }) post!: FeedPost;
  @Input() isOpen = false;

  @Output() closed = new EventEmitter<void>();
  /** Sent once it is filed, so the button can say it has been. */
  @Output() done = new EventEmitter<void>();

  readonly reasons = reportReasons;

  reason: ReportReason | null = null;
  note = '';
  sending = false;

  constructor(
    private communityService: CommunityService,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Opened again means another post, or another mind: nothing is carried over
    if (changes['isOpen'] && this.isOpen) {
      this.reason = null;
      this.note = '';
    }
  }

  get canSend(): boolean {
    return !!this.reason && !this.sending;
  }

  async confirm(): Promise<void> {
    if (!this.canSend || !this.reason) return;

    this.sending = true;
    try {
      await this.communityService.reportPost(this.post._id, {
        reason: this.reason,
        note: this.note.trim() || undefined,
      });
      this.toast.show(this.transloco.translate('community.report.done'), 'success');
      this.done.emit();
      this.close();
    } catch (error) {
      // Already reported is not a failure: it is the answer, and the post is
      // in the pile either way.
      const already = (error as { status?: number })?.status === 409;
      this.toast.show(
        this.transloco.translate(
          already ? 'community.report.already' : 'community.report.error',
        ),
        already ? 'info' : 'error',
      );
      if (already) {
        this.done.emit();
        this.close();
      }
    } finally {
      this.sending = false;
    }
  }

  close(): void {
    this.closed.emit();
  }
}
