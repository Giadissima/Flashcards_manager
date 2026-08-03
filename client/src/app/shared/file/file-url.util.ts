import { baseUrlAPI } from '../../../config/config';

// id di un documento FileMongo -> URL da cui i suoi byte vengono serviti
// (vedi FileController.findOne, cache-control immutabile)
export function getFileUrl(id: string): string {
  return `${baseUrlAPI}file/${id}`;
}
