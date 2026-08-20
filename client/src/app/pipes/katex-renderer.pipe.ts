import { inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

/**
 * Matches $$block$$ and $inline$.
 * Group 1 is the block math, group 2 the inline math.
 * The negative lookbehind `(?<!\\)` skips escaped dollar signs.
 */
const MATH_REGEX = /(?<!\\)\$\$(.*?)(?<!\\)\$\$|(?<!\\)\$(.*?)(?<!\\)\$/gs;

/**
 * Placeholder delimiter. It has to stay pure ASCII and avoid `&`, `<`, `>`:
 * Angular's sanitizer rewrites anything outside the `#`-`~` range into numeric
 * entities, so an "exotic" character would not survive the round-trip. Letters
 * and dashes only: it goes through untouched, as a text node.
 */
const PLACEHOLDER_MARK = 'katex-placeholder-6f3a1c';

/** Entities the editor puts in the HTML that KaTeX must receive decoded. */
const HTML_ENTITIES: [RegExp, string][] = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#0*39;|&#x0*27;/gi, "'"],
  [/&nbsp;/g, ' '],
  // &amp; last, otherwise it would re-expand the entities decoded above
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

    // The sanitizer Angular applies to [innerHTML] strips every `style`
    // attribute, but KaTeX's whole layout (vlist heights, `top` of superscripts
    // and subscripts, mspace margins) lives exactly there: handing it the
    // already-rendered formula would flatten it. So the formula is parked behind
    // a placeholder, the stored content is sanitized - that is the only part
    // coming from the database and in need of a clean-up - and only afterwards
    // the KaTeX output is grafted back in, since it is generated here and
    // contains no user HTML.
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
    const displayMode = !!blockMathContent; // true for block math, false for inline

    try {
      return katex.renderToString(this.decodeEntities(latex), {
        throwOnError: false, // never throws: renders the original text instead
        displayMode,
      });
    } catch (e) {
      console.error('KaTeX rendering error for:', latex, e);
      // If rendering fails, give back the original LaTeX with its delimiters
      return match;
    }
  }

  private decodeEntities(latex: string): string {
    return HTML_ENTITIES.reduce((acc, [entity, char]) => acc.replace(entity, char), latex);
  }
}
