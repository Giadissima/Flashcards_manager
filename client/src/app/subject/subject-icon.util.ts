import { Subject } from '../models/subject.dto';
import { baseUrlAPI } from '../../config/config';

export const defaultSubjectIconColor = '#bbdefb';

// path ufficiali Google Fonts Material Icons "menu_book" (variante two-tone,
// che include già le 3 righe di testo su una pagina) ed "edit" (viewBox 0 0 24 24),
// condivisi tra il componente Angular della preview live e la data-URI usata negli <img>
const menuBookPath =
  'M21,5c-1.11-0.35-2.33-0.5-3.5-0.5c-1.95,0-4.05,0.4-5.5,1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45,4.9,1,6v14.65 c0,0.25,0.25,0.5,0.5,0.5c0.1,0,0.15-0.05,0.25-0.05C3.1,20.45,5.05,20,6.5,20c1.95,0,4.05,0.4,5.5,1.5c1.35-0.85,3.8-1.5,5.5-1.5 c1.65,0,3.35,0.3,4.75,1.05c0.1,0.05,0.15,0.05,0.25,0.05c0.25,0,0.5-0.25,0.5-0.5V6C22.4,5.55,21.75,5.25,21,5z M3,18.5V7c1.1-0.35,2.3-0.5,3.5-0.5c1.34,0,3.13,0.41,4.5,0.99v11.5C9.63,18.41,7.84,18,6.5,18C5.3,18,4.1,18.15,3,18.5z M21,18.5 c-1.1-0.35-2.3-0.5-3.5-0.5c-1.7,0-4.15,0.65-5.5,1.5V8c1.35-0.85,3.8-1.5,5.5-1.5c1.2,0,2.4,0.15,3.5,0.5V18.5z';
// le due pagine sono già sagomate dentro menuBookPath (che le "buca" nel contorno
// scuro): le ridisegniamo qui sopra, piene di bianco, per avere l'interno del
// libro bianco invece che trasparente (colore del cerchio a vista)
const leftPagePath =
  'M3,18.5V7c1.1-0.35,2.3-0.5,3.5-0.5c1.34,0,3.13,0.41,4.5,0.99v11.5C9.63,18.41,7.84,18,6.5,18C5.3,18,4.1,18.15,3,18.5z';
const rightPagePath =
  'M21,18.5 c-1.1-0.35-2.3-0.5-3.5-0.5c-1.7,0-4.15,0.65-5.5,1.5V8c1.35-0.85,3.8-1.5,5.5-1.5c1.2,0,2.4,0.15,3.5,0.5V18.5z';
const menuBookLinePaths = [
  'M17.5,10.5c0.88,0,1.73,0.09,2.5,0.26V9.24C19.21,9.09,18.36,9,17.5,9c-1.28,0-2.46,0.16-3.5,0.47v1.57 C14.99,10.69,16.18,10.5,17.5,10.5z',
  'M17.5,13.16c0.88,0,1.73,0.09,2.5,0.26V11.9c-0.79-0.15-1.64-0.24-2.5-0.24c-1.28,0-2.46,0.16-3.5,0.47v1.57 C14.99,13.36,16.18,13.16,17.5,13.16z',
  'M17.5,15.83c0.88,0,1.73,0.09,2.5,0.26v-1.52c-0.79-0.15-1.64-0.24-2.5-0.24c-1.28,0-2.46,0.16-3.5,0.47v1.57 C14.99,16.02,16.18,15.83,17.5,15.83z',
];
const editPath =
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';

export function darkenColor(hex: string, percent: number): string {
  const match = hex.trim().replace('#', '');
  const full = match.length === 3
    ? match.split('').map((c) => c + c).join('')
    : match;

  const num = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(num)) {
    return hex;
  }

  const factor = 1 - percent / 100;
  const r = Math.round(((num >> 16) & 0xff) * factor);
  const g = Math.round(((num >> 8) & 0xff) * factor);
  const b = Math.round((num & 0xff) * factor);

  const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function buildDefaultSubjectIconSvgMarkup(fill: string, darkenPercent = 25): string {
  const drawColor = darkenColor(fill, darkenPercent);
  const lines = menuBookLinePaths.map((d) => `<path d="${d}" />`).join('');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="50" cy="50" r="48" fill="${fill}" />` +
    // il libro è specchiato (scale -1 orizzontale): le righe di testo, disegnate
    // sulla pagina destra nel path originale, finiscono così sulla pagina sinistra,
    // lasciando libera la pagina destra per la matita
    `<g transform="translate(50,50) scale(-2.3,2.3) translate(-12,-12)">` +
    `<path fill="${drawColor}" d="${menuBookPath}" />` +
    `<path fill="#ffffff" d="${leftPagePath}" /><path fill="#ffffff" d="${rightPagePath}" />` +
    `<g fill="${drawColor}">${lines}</g>` +
    `</g>` +
    `<g transform="translate(56,21) scale(1.55)" fill="${drawColor}"><path d="${editPath}" /></g>` +
    `</svg>`;
}

export function getDefaultSubjectIconDataUrl(fill: string = defaultSubjectIconColor): string {
  const svg = buildDefaultSubjectIconSvgMarkup(fill);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// subject.icon è l'id del file salvato su Mongo, non una URL: va risolto
// sull'endpoint che serve i byte del file (cacheable, l'id non cambia mai
// per uno stesso contenuto, vedi Cache-Control su FileController). In assenza
// di un'icona caricata, si genera al volo l'SVG di default nel colore scelto.
export function getSubjectIconUrl(subject: Subject | null | undefined): string {
  if (subject?.icon) {
    return `${baseUrlAPI}file/${subject.icon}`;
  }
  return getDefaultSubjectIconDataUrl(subject?.color);
}
