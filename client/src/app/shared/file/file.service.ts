import { Injectable } from '@angular/core';
import { RestClientService } from '../../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private baseUrl = 'file';

  constructor(private restClient: RestClientService) {}

  /** Uploads one or more image files at once; ids come back in the same order. */
  upload(files: File[]): Promise<{ ids: string[] }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.restClient.post(this.baseUrl, formData);
  }
}
