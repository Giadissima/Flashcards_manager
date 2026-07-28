import { inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

/**
 * Regex per trovare $$block$$ e $inline$.
 * Gruppo 1 per il block math, gruppo 2 per l'inline math.
 * Il negative lookbehind `(?<!\\)` evita di agganciare i dollari escapati.
 */
const MATH_REGEX = /(?<!\\)\$\$(.*?)(?<!\\)\$\$|(?<!\\)\$(.*?)(?<!\\)\$/gs;

/**
 * Delimitatore dei segnaposto. Deve restare in ASCII puro e senza `&`, `<`, `>`:
 * il sanitizer di Angular riscrive in entità numeriche tutto ciò che cade fuori
 * dall'intervallo `#`-`~`, quindi un carattere "esotico" non sopravvivrebbe al
 * round-trip. Solo lettere e trattini: passa inalterato come nodo di testo.
 */
const PLACEHOLDER_MARK = 'katex-placeholder-6f3a1c';

/** Entità che l'editor introduce nell'HTML e che KaTeX deve ricevere decodificate. */
const HTML_ENTITIES: [RegExp, string][] = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#0*39;|&#x0*27;/gi, "'"],
  [/&nbsp;/g, ' '],
  // &amp; per ultimo, altrimenti riespanderebbe le entità decodificate sopra
  [/&amp;/g, '&'],
];

@Pipe({
  name: 'katexRenderer',
  standalone: true,
})
export class KatexRendererPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml | string {
    if (!value) {
      return '';
    }

    // Il sanitizer che Angular applica a [innerHTML] cancella tutti gli attributi
    // `style`, ma l'intero layout di KaTeX (altezze delle vlist, `top` di apici e
    // pedici, margini delle mspace) vive proprio lì: passargli la formula già
    // renderizzata la appiattirebbe. Quindi la si mette da parte dietro un
    // segnaposto, si sanitizza il contenuto salvato — l'unica parte che arriva dal
    // database e va ripulita — e solo dopo si reinnesta l'output di KaTeX, che è
    // generato qui e non contiene HTML dell'utente.
    const formulas: string[] = [];
    const withPlaceholders = value.replace(
      MATH_REGEX,
      (match, blockMathContent, inlineMathContent) => {
        const rendered = this.renderMath(match, blockMathContent, inlineMathContent);
        return `${PLACEHOLDER_MARK}${formulas.push(rendered) - 1}${PLACEHOLDER_MARK}`;
      }
    );

    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, withPlaceholders) ?? '';

    const html = sanitized.replace(
      new RegExp(`${PLACEHOLDER_MARK}(\\d+)${PLACEHOLDER_MARK}`, 'g'),
      (placeholder, index) => formulas[Number(index)] ?? placeholder
    );

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private renderMath(match: string, blockMathContent?: string, inlineMathContent?: string): string {
    const latex = blockMathContent || inlineMathContent || '';
    const displayMode = !!blockMathContent; // true per il block math, false per l'inline

    try {
      return katex.renderToString(this.decodeEntities(latex), {
        throwOnError: false, // Non solleva errori, rende il testo originale
        displayMode,
      });
    } catch (e) {
      console.error('KaTeX rendering error for:', latex, e);
      // Se il rendering fallisce, restituisce l'espressione LaTeX originale
      // con i suoi delimitatori
      return match;
    }
  }

  private decodeEntities(latex: string): string {
    return HTML_ENTITIES.reduce((acc, [entity, char]) => acc.replace(entity, char), latex);
  }
}
