import { baseUrlAPI } from '../../../config/config';

// Id of a FileMongo document -> URL its bytes are served from
// (see FileController.findOne, immutable cache-control)
export function getFileUrl(id: string): string {
  return `${baseUrlAPI}file/${id}`;
}
