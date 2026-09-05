/**
 * Regenerates the Italian university reference data from the MUR open data
 * portal (https://dati-ustat.mur.gov.it, IODL 2.0).
 *
 * Run it by hand when the ministry publishes a new academic year:
 *
 *   npm run update:university-data
 *
 * It is deliberately NOT part of the build: the generated files are committed,
 * so a build never depends on an external service and every change to the list
 * shows up in a diff that can be reviewed.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RESOURCES = {
  // "Atenei": the registry of Italian university institutions.
  // UTF-8 with a BOM.
  universities: {
    url: 'https://dati-ustat.mur.gov.it/dataset/bed0c71e-9f86-4a0f-a266-963b6f7bbbd2/resource/820aefe6-0662-4656-84ec-d8859a2a3b7e/download/01_atenei.csv',
    cp1252: false,
  },
  // "Offerta formativa": every degree course, one row per site and language.
  // Windows-1252, unlike the file above - same portal, different encoding.
  courses: {
    url: 'https://dati-ustat.mur.gov.it/dataset/bed0c71e-9f86-4a0f-a266-963b6f7bbbd2/resource/c0e63906-7190-4568-892b-0cf399f56071/download/03_offertaformativa-corsidilaurea_2010-2025.csv',
    cp1252: true,
  },
};

/** Only institutions the ministry still marks as operating. */
const ACTIVE_STATUS = 'A';

const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'university');

/**
 * Code points cp1252 puts in 0x80-0x9F, where Latin-1 keeps control characters:
 * the curly quotes and dashes the ministry's file is full of.
 *
 * Spelled out because Node's TextDecoder('windows-1252') does NOT apply this
 * mapping - it leaves 0x96 as U+0096 instead of an en dash. Decoding as latin1
 * and remapping this range by hand is what gets those characters out intact.
 */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

const decodeCp1252 = (buffer) =>
  new TextDecoder('latin1')
    .decode(buffer)
    .replace(/[\u0080-\u009f]/g, (char) =>
      String.fromCodePoint(CP1252_HIGH[char.charCodeAt(0) - 0x80]),
    );

async function download({ url, cp1252 }) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const text = cp1252
    ? decodeCp1252(buffer)
    : new TextDecoder('utf-8').decode(buffer);
  return text.replace(/^\uFEFF/, '');
}

/**
 * Minimal RFC 4180 reader for the semicolon-separated files the portal serves.
 * Written out rather than pulled from a package: one quoting rule is the whole
 * of it, and the names carry doubled quotes ("" inside a quoted field) that a
 * naive split on ";" would tear apart.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ';') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
}

/**
 * Collapses runs of whitespace. The two files disagree on spacing for at least
 * one institution ("Roma  Mercatorum" against "RomaMercatorum"), which would
 * otherwise drop that university's whole course list on the floor.
 */
const normalise = (value) => value.trim().replace(/\s+/g, ' ');

/**
 * The join key: the courses file names universities by their short name, but
 * the two files punctuate it differently. Everything that is not a letter or a
 * digit is dropped, so a stray dash or double space cannot cost a university
 * its whole course list.
 */
const joinKey = (value) =>
  normalise(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

function buildUniversities(rows) {
  return rows
    .filter((row) => row.Status === ACTIVE_STATUS)
    .map((row) => ({
      code: row.COD_Ateneo,
      name: normalise(row.NomeEsteso),
      shortName: normalise(row.NomeOperativo),
      kind: normalise(row.Descrizione),
      city: normalise(row.CITTA),
      province: normalise(row.PROVINCIA),
      region: normalise(row.REGIONE),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

function buildCourses(rows, universities) {
  const codeByKey = new Map(universities.map((u) => [joinKey(u.shortName), u.code]));

  // The file holds one row per year, site and language: the same degree shows
  // up many times over, and only the latest year is of any use here.
  const latestYear = rows.reduce((max, row) => (row.ANNO > max ? row.ANNO : max), '');
  const seen = new Set();
  const courses = [];
  const unmatched = new Set();

  for (const row of rows) {
    if (row.ANNO !== latestYear) continue;

    const universityCode = codeByKey.get(joinKey(row.Ateneo));
    if (!universityCode) {
      unmatched.add(row.Ateneo);
      continue;
    }

    const name = normalise(row.Corso);
    const key = `${universityCode}|${row.TipoCorso}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    courses.push({
      universityCode,
      name,
      kind: normalise(row.TipoCorso),
      disciplinaryGroup: normalise(row.GruppoDisciplinare),
    });
  }

  courses.sort((a, b) =>
    a.universityCode.localeCompare(b.universityCode) || a.name.localeCompare(b.name, 'it'),
  );
  return { courses, latestYear, unmatched: [...unmatched] };
}

function renderModule({ latestYear, universities, courses }) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `/**
 * GENERATED FILE - do not edit by hand.
 *
 * Italian university reference data from the MUR open data portal
 * (https://dati-ustat.mur.gov.it), released under the IODL 2.0 licence.
 * Academic year ${latestYear}, generated on ${stamp}.
 *
 * Regenerate with: npm run update:university-data
 */

export interface UniversityRecord {
  /** Ministry code, e.g. "00101". The stable identifier - names get reworded. */
  code: string;
  name: string;
  shortName: string;
  kind: string;
  city: string;
  province: string;
  region: string;
}

export interface CourseRecord {
  universityCode: string;
  name: string;
  kind: string;
  disciplinaryGroup: string;
}

export const universities: UniversityRecord[] = ${JSON.stringify(universities, null, 2)};

export const courses: CourseRecord[] = ${JSON.stringify(courses, null, 2)};
`;
}

async function main() {
  console.log('Downloading the MUR datasets...');
  const [universitiesCsv, coursesCsv] = await Promise.all([
    download(RESOURCES.universities),
    download(RESOURCES.courses),
  ]);

  const universities = buildUniversities(parseCsv(universitiesCsv));
  const { courses, latestYear, unmatched } = buildCourses(parseCsv(coursesCsv), universities);

  const withCourses = new Set(courses.map((c) => c.universityCode));
  console.log(`Academic year:        ${latestYear}`);
  console.log(`Active universities:  ${universities.length}`);
  console.log(`Degree courses:       ${courses.length}`);
  console.log(`Universities without a course (post-graduate institutions): ${universities.length - withCourses.size}`);
  if (unmatched.length) {
    console.warn(`\nWARNING - courses whose university is not in the registry, dropped:`);
    for (const name of unmatched) console.warn(`  - ${name}`);
  }

  const target = join(outputDir, 'university.data.ts');
  await writeFile(target, renderModule({ latestYear, universities, courses }), 'utf-8');
  console.log(`\nWritten ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
