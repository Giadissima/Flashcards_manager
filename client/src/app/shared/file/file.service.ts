import { Injectable } from '@angular/core';
import { RestClientService } from '../../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private baseUrl = 'file';

  constructor(private restClient: RestClientService) {}

  upload(file: File): Promise<{ _id: string }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.restClient.post(this.baseUrl, formData);
  }
}
