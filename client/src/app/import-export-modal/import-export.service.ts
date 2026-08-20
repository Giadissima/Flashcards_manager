import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private baseUrl = 'import-export';

  constructor(private restClient: RestClientService) {}

  /**
   * Esporta le flashcard. Se subject_id è fornito, esporta solo quelle di quella materia.
   * Ritorna un Promise che si risolve in un Blob (il file JSON).
   */
  export(subject_id?: string): Promise<Blob> {
    return this.restClient.get<Blob>(
      this.baseUrl + '/export-flashcards',
      subject_id ? { subject_id } : {},
      { responseType: 'blob' }
    );
  }

  /**
   * Importa flashcard da un file JSON.
   * @param file Il file da caricare.
   */
  import(file: File): Promise<{ imported: number; skipped: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.restClient.post(this.baseUrl + '/upload-flashcards', formData);
  }
}
