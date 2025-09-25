import { Subject } from "./subject.dto";

export interface Topic {
  _id?: string;
  name: string;
  color: string;
  subject_id: string | Subject;
}
