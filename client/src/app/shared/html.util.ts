/**
 * What counts as "content" in a rich-text field, on the client side.
 *
 * This deliberately mirrors server/src/common/html.util.ts: client and server
 * are two separate builds with no shared package, so the rule cannot literally
 * be imported. The two have to stay in step - a description the server agrees
 * to store is one the client has to agree to show, and they disagreed before:
 * a description made only of an image was stored, then reported as absent.
 */
export function hasHtmlContent(html: string): boolean {
  const visibleText = html.replace(/<[^>]*>/g, '').trim();
  return visibleText.length > 0 || /<img\b/i.test(html);
}
