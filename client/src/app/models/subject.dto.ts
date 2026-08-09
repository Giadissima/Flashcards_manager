export interface Subject {
  _id?: string;
  name: string;
  desc?: string;
  icon?: string; // URL to the icon
  color?: string; // colore di sfondo dell'icona SVG di default, usato quando icon non è impostato
}
