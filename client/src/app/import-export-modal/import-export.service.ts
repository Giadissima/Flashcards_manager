import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private baseUrl = 'import-export';

  constructor(private restClient: RestClientService) {}

  /**
   * Exports the flashcards as a zip. When subject_id is given, only the
   * flashcards of that subject are exported.
   */
  export(subject_id?: string): Promise<Blob> {
    return this.restClient.get<Blob>(
      this.baseUrl + '/export-flashcards',
      subject_id ? { subject_id } : {},
      { responseType: 'blob' }
    );
  }

  /**
   * Imports flashcards from a previously exported json or zip file.
   * @param file the archive to upload.
   */
  import(file: File): Promise<{ imported: number; skipped: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.restClient.post(this.baseUrl + '/upload-flashcards', formData);
  }
}
