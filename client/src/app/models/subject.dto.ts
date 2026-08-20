export interface Subject {
  _id?: string;
  name: string;
  desc?: string;
  icon?: string; // id of the uploaded icon file, resolved by getSubjectIconUrl()
  color?: string; // background color of the default SVG icon, used when icon is unset
}
