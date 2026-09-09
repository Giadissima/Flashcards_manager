import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ReportSummary } from './moderation.service';

/** The reasons as the reader was offered them, not as they are stored. */
const reasons: Record<string, string> = {
  explicit: 'contenuto esplicito o volgare',
  offensive: 'offensivo o discriminatorio',
  spam: 'spam o pubblicità',
  other: 'altro',
};

/**
 * The doorbell.
 *
 * It says a report has arrived and offers the one button that opens the
 * moderation page; nothing is decided here. Deciding needs the post in front
 * of you - every card, every picture - and a chat that could also warn and ban
 * would be a second set of controls to keep in step with the first, with no
 * password in front of it and every tap final.
 *
 * So this only ever talks outwards: no updates are read, nothing is listened
 * for, and a bot token that leaks cannot be used to moderate anything.
 *
 * All of it is optional. With no token configured the service says so once and
 * stays quiet, and the site works exactly the same without it.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private readonly token: string;
  private readonly chatId: string;
  private readonly apiUrl: string;
  private readonly site: string;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.chatId = this.config.get<string>('TELEGRAM_CHAT_ID') ?? '';
    this.apiUrl =
      this.config.get<string>('TELEGRAM_API_URL') ?? 'https://api.telegram.org';
    this.site = (this.config.get<string>('PUBLIC_URL') ?? '').replace(
      /\/+$/,
      '',
    );

    if (!this.token) {
      this.logger.log('no bot token: reports are not announced anywhere');
    }
  }

  get enabled(): boolean {
    return !!this.token && !!this.chatId;
  }

  /** Says a post, or a comment under one, was reported - and where to go and look at it. */
  async announce(summary: ReportSummary): Promise<void> {
    if (!this.enabled) return;

    const lines = [
      `<b>${escape(summary.author)}</b> — ${escape(summary.subject)}` +
        (summary.target === 'comment' ? ' (commento)' : ''),
      `segnalato da: ${escape(summary.reporter)}`,
      `motivo: ${reasons[summary.reason] ?? summary.reason}`,
    ];

    if (summary.target === 'comment' && summary.commentText) {
      lines.push(`commento: ${escape(summary.commentText)}`);
    }

    if (summary.note) {
      lines.push(`messaggio utente: ${escape(summary.note)}`);
    }

    lines.push(
      `segnalazioni aperte: ${summary.reports}` +
        `${summary.hidden ? ' — già nascosto' : ''}` +
        `${summary.strikes ? ` — ammonizioni: ${summary.strikes}` : ''}`,
    );

    const text = lines.join('\n');
    const button = this.button();

    try {
      await this.send(text, button);
    } catch (error) {
      // Telegram turns down a button pointing at an address it does not
      // consider public - which is every address while this runs on a laptop.
      // The message still has to arrive, so it goes again with the link in it.
      if (!button) throw error;

      this.logger.warn(`button refused (${String(error)}), sending the link`);
      await this.send(`${text}\n\n${this.link()}`);
    }
  }

  /** The one thing the message can do: open the moderation page. */
  private button(): unknown {
    const link = this.link();
    if (!link) return undefined;

    return {
      inline_keyboard: [[{ text: 'Apri la moderazione', url: link }]],
    };
  }

  private link(): string {
    return this.site ? `${this.site}/admin/` : '';
  }

  private async send(text: string, replyMarkup?: unknown): Promise<void> {
    const response = await fetch(
      `${this.apiUrl}/bot${this.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          // The page asks for a password, so its preview would be a grey box
          link_preview_options: { is_disabled: true },
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      },
    );

    const payload = (await response.json()) as {
      ok: boolean;
      description?: string;
    };
    if (!payload.ok) throw new Error(payload.description ?? 'sendMessage failed');
  }
}

/** Telegram's HTML mode reads these three, so a username cannot become markup. */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
