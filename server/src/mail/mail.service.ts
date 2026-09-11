import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * The one way the site writes to somebody outside it.
 *
 * Plain SMTP, and nothing said here about who carries it: the host, the port
 * and the two credentials all come from the environment, so moving from one
 * relay to another is a matter of .env and never of this file. That is also
 * why nodemailer rather than a provider's own client - a client would put the
 * choice in the code, where changing it costs a release.
 *
 * The mailbox is not the same thing as the sender. On a relay the login is a
 * key of the provider's own making, something like 9a1b2c001@smtp-brevo.com,
 * which is not an address anybody can write back to: MAIL_FROM is what the
 * reader sees, and it is the address verified with the provider.
 *
 * All of it is optional, as the Telegram bot is. With nothing configured the
 * service says so once and stays quiet - and, so that nobody is left holding
 * an unconfirmable account, whoever registers while it is off is taken at
 * their word (see VerificationService).
 */
/** The two languages the client ships; anything else falls back to Italian. */
export type MailLang = 'it' | 'en';

const verificationCopy: Record<
  MailLang,
  {
    subject: string;
    /** Comes before the username, e.g. "Ciao" for "Ciao Giada,". */
    greeting: string;
    intro: string;
    button: string;
    footer: string;
  }
> = {
  it: {
    subject: 'Conferma il tuo indirizzo — Flashcards Manager',
    greeting: 'Ciao',
    intro: 'per confermare questo indirizzo apri il link qui sotto:',
    button: 'Conferma indirizzo',
    footer:
      'Il link vale 24 ore. Se non hai creato tu questo account, ignora ' +
      'questo messaggio: senza conferma non succede nulla.',
  },
  en: {
    subject: 'Confirm your address — Flashcards Manager',
    greeting: 'Hi',
    intro: 'to confirm this address, open the link below:',
    button: 'Confirm address',
    footer:
      "The link is valid for 24 hours. If you didn't create this account, " +
      'ignore this message: without confirmation nothing happens.',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly user: string;
  private readonly from: string;
  private readonly transport: Transporter | null;

  constructor(private readonly config: ConfigService) {
    // `||` and not `??` throughout: compose passes a variable that is not set
    // through as empty rather than leaving it out, so `??` would never fire.
    const host = this.config.get<string>('MAIL_HOST') || '';
    this.user = this.config.get<string>('MAIL_USER') || '';
    const password = this.config.get<string>('MAIL_PASSWORD') || '';

    // Falling back to the login is right for a mailbox, where the login is the
    // address, and wrong for a relay, where it is a key. Kept as the fallback
    // because it costs one variable less in the common case, and said out loud
    // when it cannot be right.
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      `Flashcards Manager <${this.user}>`;

    if (!host || !this.user || !password) {
      this.logger.log('mail not configured: addresses are taken as confirmed');
      this.transport = null;
      return;
    }

    if (!this.config.get<string>('MAIL_FROM') && !this.user.includes('@')) {
      this.logger.warn(
        `MAIL_USER (${this.user}) is not an address and MAIL_FROM is empty: ` +
          'set MAIL_FROM to the sender verified with your provider, or the ' +
          'mails go out from something nobody can reply to.',
      );
    }

    const port = Number(this.config.get<string>('MAIL_PORT') || 587);
    this.transport = nodemailer.createTransport({
      host,
      port,
      // 465 speaks TLS from the first byte; 587, which is what the relays ask
      // for, starts in the clear and upgrades - which nodemailer does on its
      // own when this is false.
      secure: port === 465,
      auth: { user: this.user, pass: password },
    });
  }

  get enabled(): boolean {
    return !!this.transport;
  }

  /**
   * Asks somebody to confirm the address they registered with.
   *
   * The link is repeated as text under the button: a mail client that refuses
   * to draw the button, or a reader who forwards the message as plain text,
   * still has the one thing the mail exists to carry.
   */
  async sendVerification(
    to: string,
    username: string,
    link: string,
    lang: MailLang = 'it',
  ): Promise<void> {
    if (!this.transport) return;

    const copy = verificationCopy[lang];
    const safeUser = escape(username);
    const safeLink = escape(link);

    await this.transport.sendMail({
      from: this.from,
      to,
      subject: copy.subject,
      text: [
        `${copy.greeting} ${username},`,
        '',
        copy.intro,
        link,
        '',
        copy.footer,
      ].join('\n'),
      html: [
        `<p>${copy.greeting} <strong>${safeUser}</strong>,</p>`,
        `<p>${copy.intro}</p>`,
        `<p><a href="${safeLink}" style="display:inline-block;padding:10px 18px;`,
        'border-radius:8px;background:#a294f9;color:#fff;text-decoration:none">',
        `${copy.button}</a></p>`,
        `<p style="font-size:13px;color:#666">${safeLink}</p>`,
        `<p style="font-size:13px;color:#666">${copy.footer}</p>`,
      ].join(''),
    });
  }
}

/** A username ends up inside the HTML body, so it cannot become markup. */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
