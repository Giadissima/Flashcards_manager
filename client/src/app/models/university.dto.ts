/** Mirrors the reference data the server generates from the MUR open data. */
export interface University {
  /** Ministry code, e.g. "00101": the stable identifier, names get reworded. */
  code: string;
  name: string;
  shortName: string;
  kind: string;
  city: string;
  province: string;
  region: string;
}

export interface Course {
  universityCode: string;
  name: string;
  /** "Laurea", "Laurea Magistrale" or "Laurea Magistrale Ciclo Unico". */
  kind: string;
  disciplinaryGroup: string;
}
