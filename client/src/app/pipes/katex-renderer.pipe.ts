import { Pipe, PipeTransform } from '@angular/core';
import katex from 'katex';

@Pipe({
  name: 'katexRenderer',
  standalone: true,
})
export class KatexRendererPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) {
      return '';
    }

    // Regex to find $$block$$ and $inline$ math.
    // It captures the content inside the delimiters.
    // Group 1 for block math, Group 2 for inline math.
    // Use a negative lookbehind `(?<!\\)` to prevent matching escaped dollar signs.
    const regex = /(?<!\\)\$\$(.*?)(?<!\\)\$\$|(?<!\\)\$(.*?)(?<!\\)\$/gs;

    return value.replace(regex, (match, blockMathContent, inlineMathContent) => {
      const latex = blockMathContent || inlineMathContent;
      const displayMode = !!blockMathContent; // true for block math, false for inline

      try {
        return katex.renderToString(latex, {
          throwOnError: false, // Don't throw errors, just render the original text
          displayMode: displayMode,
        });
      } catch (e) {
        console.error('KaTeX rendering error for:', latex, e);
        // If rendering fails, return the original LaTeX expression wrapped in its delimiters
        return match;
      }
    });
  }
}
