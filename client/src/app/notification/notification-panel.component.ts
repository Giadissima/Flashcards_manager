import { AppNotification, Feedback, FeedbackMessage, NotificationKind, notificationKinds } from '../models/social.dto';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../auth/auth.service';
import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../community/community.service';
import { FormsModule } from '@angular/forms';
import { NotificationService } from './notification.service';
import { PaginatedList } from '../shared/paginated-list';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { PendingButtonDirective } from '../shared/pending-button.directive';
import { PostReportModalComponent, ReportKind } from '../community/post-report-modal/post-report-modal.component';
import { restrictionMessage } from '../shared/restriction';
import { SearchableSelectComponent, SelectOption } from '../shared/searchable-select/searchable-select.component';
import { Subscription } from 'rxjs';
import { ToastService } from '../shared/toast/toast.service';

/** How many messages an exchange holds before it is closed. */
const maxFeedbackMessages = 3;

/**
 * The bell and its panel: everything somebody else did that the user should
 * hear about - a like, a comment, a private report on one of their cards.
 *
 * A report opens its exchange right here rather than on a page of its own.
 * It is at most three messages long, so a page would be a lot of navigation
 * around two lines of text.
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    ClickOutsideDirective,
    SearchableSelectComponent,
    PaginationComponent,
    PostReportModalComponent,
    PendingButtonDirective,
  ],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent extends PaginatedList implements OnInit, OnDestroy {
  // Rendered as a labelled row (icon + "Notifiche") instead of the plain
  // round bell button, for the drawer's profile card where it sits alongside
  // "Profilo" and "Esci" as one of a list rather than a standalone control.
  @Input() listStyle = false;

  // Small: this list lives in a dropdown, not a page.
  override pageSize = 8;

  isOpen = false;
  loading = false;
  notifications: AppNotification[] = [];
  unread = 0;

  /** Which of the two lists the panel is showing. */
  tab: 'all' | 'open' = 'all';

  /** Narrows the list; empty means everything, which is what it opens on. */
  kindFilter: NotificationKind | '' = '';
  unreadOnly = false;
  reloading = false;
  openReports: Feedback[] = [];
  openCount = 0;

  /** The exchange opened inside the panel, if any. */
  openThread: Feedback | null = null;
  replyDraft = '';
  sendingReply = false;
  resolving = false;

  // ----------------------------------------------- reporting one message

  reportOpen = false;
  reportKind: ReportKind = 'feedback';
  reportMessageId = '';
  reportAuthorUsername = '';
  /** Guards the flag button against the request openMessageReport() makes before it can reveal the modal. */
  openingMessageReport = false;

  private unreadSub: Subscription | null = null;

  constructor(
    private notificationService: NotificationService,
    private communityService: CommunityService,
    private authService: AuthService,
    private toast: ToastService,
    private transloco: TranslocoService,
  ) {
    super();
  }

  ngOnInit(): void {
    // The service owns the count - kept live by its own SSE connection - and
    // this just mirrors it into the field the template already binds to.
    this.unreadSub = this.notificationService.unread$.subscribe((count) => {
      this.unread = count;
    });
  }

  ngOnDestroy(): void {
    this.unreadSub?.unsubscribe();
  }

  async toggle(): Promise<void> {
    this.isOpen = !this.isOpen;
    this.openThread = null;
    // Fetched when the panel is opened, not on every page: the badge alone is
    // what the bar needs to show, and that is one number
    if (this.isOpen) {
      this.currentPage = 1;
      await this.load();
    }
  }

  async showTab(tab: 'all' | 'open'): Promise<void> {
    this.tab = tab;
    this.openThread = null;
    if (tab === 'open') await this.loadOpenReports();
  }

  /** The first line of a report, which is what it is about. */
  firstLine(report: Feedback): string {
    return report.messages[0]?.text ?? '';
  }

  async openReport(report: Feedback): Promise<void> {
    this.openThread = report;
    this.replyDraft = '';
  }

  private async loadOpenReports(): Promise<void> {
    this.loading = true;
    try {
      const page = await this.communityService.getOpenFeedback(0, 20);
      this.openReports = page.data;
      this.openCount = page.count;
    } finally {
      this.loading = false;
    }
  }

  close(): void {
    this.isOpen = false;
    this.openThread = null;
  }

  readonly kinds = notificationKinds;

  get kindOptions(): SelectOption[] {
    return this.kinds.map((kind) => ({
      value: kind,
      label: this.transloco.translate('notifications.kindName.' + kind),
    }));
  }

  async onFilterChange(): Promise<void> {
    // A new filter starts back at the top of its own result set.
    this.currentPage = 1;
    await this.load();
  }

  protected async onPageChange(): Promise<void> {
    await this.load();
  }

  async onKindFilterChange(value: string | null | undefined): Promise<void> {
    this.kindFilter = (value as NotificationKind) || '';
    await this.onFilterChange();
  }

  /** Fetches again on demand: the panel has no way of hearing about new ones. */
  async reload(): Promise<void> {
    if (this.reloading) return;

    this.reloading = true;
    try {
      await this.load();
    } finally {
      this.reloading = false;
    }
  }

  iconOf(notification: AppNotification): string {
    // The same glyphs the Community shows: a notification is read next to the
    // thing it is about, and two symbols for one thing read as two things.
    if (notification.kind === 'upvote') return 'thumb_up';
    if (notification.kind === 'comment') return 'chat_bubble';
    if (notification.kind === 'moderation') return 'gavel';
    return notification.kind === 'resolved' ? 'task_alt' : 'feedback';
  }

  /**
   * What a moderation notice says, in one line.
   *
   * Built here rather than sent ready-made by the server: the date belongs in
   * the reader's own format, and the sentence in the language they picked.
   */
  moderationText(notification: AppNotification): string {
    const notice = notification.moderation;
    if (!notice) return '';

    const until = notice.until
      ? new Date(notice.until).toLocaleDateString(undefined, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

    const key =
      notice.event === 'blocked' && !notice.until
        ? 'notifications.moderation.blockedForever'
        : `notifications.moderation.${notice.event}`;

    return this.transloco.translate(key, { until });
  }

  /** Only the author closes a report, and only once. */
  get canResolve(): boolean {
    const thread = this.openThread;
    return (
      !!thread && !thread.resolved && this.authService.user?._id === thread.author_id
    );
  }

  async resolve(): Promise<void> {
    if (!this.openThread || this.resolving) return;

    this.resolving = true;
    try {
      await this.communityService.resolveFeedback(this.openThread._id);
      this.openThread = { ...this.openThread, resolved: true };
      // It has left the list of things to do, so the list has to lose it too
      this.openReports = this.openReports.filter((r) => r._id !== this.openThread?._id);
      this.openCount = Math.max(0, this.openCount - 1);
      this.toast.show(this.transloco.translate('notifications.resolved'), 'success');
    } catch {
      this.toast.show(this.transloco.translate('notifications.resolveError'), 'error');
    } finally {
      this.resolving = false;
    }
  }

  async onNotificationClick(notification: AppNotification): Promise<void> {
    if (!notification.read) {
      notification.read = true;
      void this.notificationService.markRead(notification._id);
    }
    if (notification.feedback_id) await this.openFeedback(notification.feedback_id);
  }

  async markAllRead(): Promise<void> {
    await this.notificationService.markAllRead();
    this.notifications.forEach((n) => (n.read = true));
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

  /**
   * Only the other side of the exchange can report a message, never its own
   * author - and never one written before messages carried an id of their
   * own, since there would be nothing for the report to point at.
   */
  mayReportMessage(message: FeedbackMessage): boolean {
    return !!message._id && message.user_id._id !== this.authService.user?._id;
  }

  /**
   * Asked of the server fresh each time rather than read off the cached
   * profile: a restriction lifted by moderation only reaches that cache on
   * the next login, so trusting it would keep telling a pardoned account it
   * is still blocked until it happens to log in again.
   */
  async openMessageReport(message: FeedbackMessage): Promise<void> {
    if (this.openingMessageReport) return;

    this.openingMessageReport = true;
    try {
      const fresh = await this.authService.fetchMe().catch(() => this.authService.user);
      const blocked = fresh?.reportBlocked;
      if (blocked) {
        const notice = restrictionMessage('report', blocked.until);
        this.toast.show(this.transloco.translate(notice.key, notice.params), 'error');
        return;
      }

      this.reportMessageId = message._id;
      this.reportAuthorUsername = message.user_id.username;
      this.reportOpen = true;
    } finally {
      this.openingMessageReport = false;
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
      const [page, open] = await Promise.all([
        this.notificationService.getMine(this.pageSkip, this.pageSize, {
          kind: this.kindFilter || undefined,
          unread: this.unreadOnly,
        }),
        this.communityService.getOpenFeedback(0, 20),
      ]);
      this.notifications = page.data;
      this.totalCount = page.count;
      // Counted from the server, not from the page on screen: a filtered list
      // says nothing about how many are unread in total
      await this.notificationService.refreshUnread();
      this.openReports = open.data;
      this.openCount = open.count;
    } finally {
      this.loading = false;
    }
  }
}
