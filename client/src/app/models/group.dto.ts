import { Subject } from "./subject.dto";

export interface Group {
  _id?: string;
  name: string;
  color: string;
  subject_id: string | Subject;
}
