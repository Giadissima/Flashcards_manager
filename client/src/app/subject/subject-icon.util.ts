import { Subject } from '../models/subject.dto';
import { baseUrlAPI } from '../../config/config';

// subject.icon è l'id del file salvato su Mongo, non una URL: va risolto
// sull'endpoint che serve i byte del file (cacheable, l'id non cambia mai
// per uno stesso contenuto, vedi Cache-Control su FileController)
export function getSubjectIconUrl(subject: Subject | null | undefined): string {
  return subject?.icon ? `${baseUrlAPI}file/${subject.icon}` : 'assets/logo3.png';
}
