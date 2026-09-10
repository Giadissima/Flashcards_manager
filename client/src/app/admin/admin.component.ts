import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminReport, AdminService, ModerationAction, ModerationSubject } from './admin.service';
import { ImageLightboxComponent } from '../shared/image-lightbox/image-lightbox.component';
import { KatexRendererPipe } from '../pipes/katex-renderer.pipe';
import { ZoomableImagesDirective } from '../shared/zoomable-images.directive';

/**
 * Where reports are decided on.
 *
 * Outside the app's own login on purpose: whoever moderates does not need an
 * account here, and an account here must not become a way to moderate. One
 * password, kept by the server, and a token that lasts the evening.
 *
 * Everything is on one page - the list on the left, the post on the right -
 * because the decision is a comparison: this report against the others from
 * the same author, and against what was decided last time.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KatexRendererPipe,
    ImageLightboxComponent,
    ZoomableImagesDirective,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  password = '';
  loggingIn = false;
  loginError = '';

  reports: AdminReport[] = [];
  chosen: AdminReport | null = null;
  loading = false;
  working = false;
  message = '';
  /** Which ban is waiting to be said twice - the author's, the reporter's, or
      neither. */
  confirming: ModerationSubject | null = null;

  constructor(
    private admin: AdminService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  get isIn(): boolean {
    return this.admin.isIn;
  }

  async ngOnInit(): Promise<void> {
    if (this.isIn) await this.load();
  }

  async login(): Promise<void> {
    if (this.loggingIn || this.password.length < 2) return;

    this.loggingIn = true;
    this.loginError = '';
    try {
      await this.admin.login(this.password);
      this.password = '';
      await this.load();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      this.loginError =
        status === 503
          ? 'Su questo server non è impostata nessuna password di moderazione.'
          : status === 429
            ? 'Troppi tentativi. Riprova tra qualche minuto.'
            : 'Password sbagliata.';
    } finally {
      this.loggingIn = false;
    }
  }

  logout(): void {
    this.admin.logout();
    this.reports = [];
    this.chosen = null;
  }

  /** The list, and the one the link in the chat pointed at. */
  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.reports = await this.admin.reports();

      const asked = this.route.snapshot.paramMap.get('id');
      this.chosen =
        this.reports.find((report) => report.reportId === asked) ??
        this.reports[0] ??
        null;
    } catch {
      this.message = 'Non sono riuscito a leggere le segnalazioni.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Reads the reports again without letting them move.
   *
   * The server puts the undecided ones first, which is right when the page is
   * opened and wrong the moment something is decided on it: the row just acted
   * on would drop away under the pointer and the next click would land on
   * somebody else's report. So the order is the one already on screen, and
   * anything new goes on top.
   */
  private async refresh(): Promise<void> {
    const fresh = await this.admin.reports();
    const byId = new Map(fresh.map((report) => [report.reportId, report]));

    const kept = this.reports
      .map((report) => byId.get(report.reportId))
      .filter((report): report is AdminReport => !!report);
    const known = new Set(kept.map((report) => report.reportId));
    const arrived = fresh.filter((report) => !known.has(report.reportId));

    this.reports = [...arrived, ...kept];
    if (this.chosen) {
      this.chosen = byId.get(this.chosen.reportId) ?? null;
    }
  }

  choose(report: AdminReport): void {
    this.chosen = report;
    this.message = '';
    this.confirming = null;
    // The address follows what is being looked at, so the page can be sent to
    // somebody - or reloaded - and come back to the same report.
    void this.router.navigate(['/admin', report.reportId], {
      replaceUrl: true,
    });
  }

  async act(action: ModerationAction, against: ModerationSubject = 'author'): Promise<void> {
    if (!this.chosen || this.working) return;

    this.confirming = null;
    this.working = true;
    try {
      const verdict = await this.admin.act(this.chosen.reportId, action, against);
      this.message = verdict.done;

      // Read back rather than patched here: what a decision changes - the
      // state, whether the post is hidden, how many warnings the author has -
      // is the server's answer, and guessing it would show the wrong thing
      // the one time it matters.
      await this.refresh();
    } catch {
      this.message = 'Non è andata.';
    } finally {
      this.working = false;
    }
  }

  async pardon(who: ModerationSubject = 'author'): Promise<void> {
    if (!this.chosen || this.working) return;

    const username = who === 'reporter' ? this.chosen.reporter : this.chosen.author;
    this.working = true;
    try {
      const verdict = await this.admin.pardon(username);
      this.message = verdict.done;
      await this.refresh();
    } catch {
      this.message = 'Non è andata.';
    } finally {
      this.working = false;
    }
  }

  /**
   * Whether a button still has anything to do.
   *
   * A button that is pressable and changes nothing is worse than one that is
   * greyed out: the first is read as the page being broken, the second says
   * plainly that this has already been dealt with.
   */
  can(action: ModerationAction, against: ModerationSubject = 'author'): boolean {
    const report = this.chosen;
    if (!report || this.working) return false;

    // The reporter is a person, not a piece of content: nothing here to keep,
    // remove or put back, only their own account to warn or ban.
    if (against === 'reporter') {
      // Already serving a ban: a warning would rewrite its restriction rather
      // than add to it, so there is nothing left for this button to do.
      if (action === 'warn') return !report.reporterBanned;
      if (action === 'ban') return !report.reporterBanned;
      return false;
    }

    if (action === 'keep') return report.state === 'open' || report.hidden;
    if (action === 'remove') return !report.hidden;
    // A banned author's posts are down because of the ban, not because of this
    // report: putting one back on its own would say two opposite things at
    // once. The way back for them is "ridagli tutto".
    if (action === 'restore') return report.hidden && !report.banned;
    if (action === 'ban') return !report.banned;
    if (action === 'warn') return !report.banned;
    return true;
  }

  /**
   * Asked before a ban, and only before a ban.
   *
   * Everything else here is undone with the button next to it; this one takes
   * every post of somebody's down at once, and a mis-tap on a phone should not
   * be enough to do it. Asked inside the page rather than with the browser's
   * own box, which on a phone is a grey slab that says the site's address.
   */
  async ban(against: ModerationSubject = 'author'): Promise<void> {
    if (!this.chosen || !this.can('ban', against)) return;

    this.confirming = null;
    await this.act('ban', against);
  }

  reasonOf(report: AdminReport): string {
    return (
      {
        explicit: 'contenuto esplicito o volgare',
        offensive: 'offensivo o discriminatorio',
        spam: 'spam o pubblicità',
        other: 'altro',
      }[report.reason] ?? report.reason
    );
  }

  stateOf(report: AdminReport): string {
    return (
      { open: 'da decidere', kept: 'tenuto', removed: 'tolto' }[report.state] ??
      report.state
    );
  }

  when(value: string): string {
    return new Date(value).toLocaleString();
  }
}
