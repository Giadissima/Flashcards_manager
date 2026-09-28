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
   * Asks which subjects and topics of the file are already in the account,
   * without importing anything.
   * @param file the archive to inspect.
   */
  preview(file: File): Promise<ImportPreview> {
    const formData = new FormData();
    formData.append('file', file);
    return this.restClient.post(this.baseUrl + '/preview-flashcards', formData);
  }

  /**
   * Imports flashcards from a previously exported json or zip file.
   * @param file the archive to upload.
   * @param resolutions what to do with the subjects/topics whose name is taken;
   *   anything left out is merged into the existing one.
   */
  import(file: File, resolutions?: ImportResolutions): Promise<{ imported: number; skipped: number }> {
    const formData = new FormData();
    formData.append('file', file);
    if (resolutions) formData.append('resolutions', JSON.stringify(resolutions));
    return this.restClient.post(this.baseUrl + '/upload-flashcards', formData);
  }
}

export type ConflictAction = 'merge' | 'rename' | 'skip';

export interface ConflictResolution {
  action: ConflictAction;
  name?: string;
}

export interface ImportResolutions {
  subjects: Record<string, ConflictResolution>;
  topics: Record<string, Record<string, ConflictResolution>>;
}

export interface ImportPreview {
  total: number;
  conflicts: {
    name: string;
    cards: number;
    duplicates: number;
    topics: { name: string; cards: number }[];
  }[];
}
