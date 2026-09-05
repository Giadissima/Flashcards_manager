import { Subject } from "./subject.dto";
import { Visibility } from './visibility.dto';

export interface Topic {
  _id?: string;
  name: string;
  color: string;
  subject_id: string | Subject;

  /** Who may see it; absent on payloads that leave it unchanged. */
  visibility?: Visibility;
}
