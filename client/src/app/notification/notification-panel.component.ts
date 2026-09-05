import { AppNotification, Feedback } from '../models/social.dto';
import { Component, OnInit } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../auth/auth.service';
import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../community/community.service';
import { FormsModule } from '@angular/forms';
import { NotificationService } from './notification.service';
import { ToastService } from '../shared/toast/toast.service';

/** How many messages an exchange holds before it is closed. */
const maxFeedbackMessages = 3;

/**
 * The bell and its panel: everything somebody else did that the user should
 * hear about - an upvote, a comment, a private report on one of their cards.
 *
 * A report opens its exchange right here rather than on a page of its own.
 * It is at most three messages long, so a page would be a lot of navigation
 * around two lines of text.
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, ClickOutsideDirective],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent implements OnInit {
  isOpen = false;
  loading = false;
  notifications: AppNotification[] = [];
  unread = 0;

  /** The exchange opened inside the panel, if any. */
  openThread: Feedback | null = null;
  replyDraft = '';
  sendingReply = false;

  constructor(
    private notificationService: NotificationService,
    private communityService: CommunityService,
    private authService: AuthService,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    void this.refreshBadge();
  }

  async toggle(): Promise<void> {
    this.isOpen = !this.isOpen;
    this.openThread = null;
    // Fetched when the panel is opened, not on every page: the badge alone is
    // what the bar needs to show, and that is one number
    if (this.isOpen) await this.load();
  }

  close(): void {
    this.isOpen = false;
    this.openThread = null;
  }

  iconOf(notification: AppNotification): string {
    if (notification.kind === 'upvote') return 'arrow_upward';
    return notification.kind === 'comment' ? 'chat_bubble' : 'flag';
  }

  async onNotificationClick(notification: AppNotification): Promise<void> {
    if (!notification.read) {
      notification.read = true;
      this.unread = Math.max(0, this.unread - 1);
      void this.notificationService.markRead(notification._id);
    }
    if (notification.feedback_id) await this.openFeedback(notification.feedback_id);
  }

  async markAllRead(): Promise<void> {
    await this.notificationService.markAllRead();
    this.notifications.forEach((n) => (n.read = true));
    this.unread = 0;
  }

  /** True while it is this user's turn and the exchange still has room. */
  get canReply(): boolean {
    const thread = this.openThread;
    if (!thread || thread.messages.length >= maxFeedbackMessages) return false;

    const me = this.authService.user?._id;
    // The second message is the author's, the third the reporter's answer
    const expected =
      thread.messages.length === 1 ? thread.author_id : thread.reporter_id;
    return me === expected;
  }

  async sendReply(): Promise<void> {
    const text = this.replyDraft.trim();
    if (!this.openThread || text.length < 2 || this.sendingReply) return;

    this.sendingReply = true;
    try {
      await this.communityService.replyToFeedback(this.openThread._id, text);
      this.replyDraft = '';
      this.openThread = await this.communityService.getFeedback(this.openThread._id);
    } catch {
      this.toast.show(this.transloco.translate('notifications.replyError'), 'error');
    } finally {
      this.sendingReply = false;
    }
  }

  private async openFeedback(feedbackId: string): Promise<void> {
    try {
      this.openThread = await this.communityService.getFeedback(feedbackId);
      this.replyDraft = '';
    } catch {
      this.toast.show(this.transloco.translate('notifications.threadError'), 'error');
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const page = await this.notificationService.getMine(0, 20);
      this.notifications = page.data;
      this.unread = this.notifications.filter((n) => !n.read).length;
    } finally {
      this.loading = false;
    }
  }

  private async refreshBadge(): Promise<void> {
    try {
      this.unread = Number(await this.notificationService.countUnread()) || 0;
    } catch {
      this.unread = 0;
    }
  }
}
