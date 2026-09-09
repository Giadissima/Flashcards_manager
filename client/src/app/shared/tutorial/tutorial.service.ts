import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Whether the tutorial overlay is open, shared by whoever can trigger it: the
 * registration flow, un-asked, and the settings modal's "show tutorial"
 * button, on request. Just visibility - no "has this account seen it"
 * bookkeeping, since nothing else needs to know that.
 */
@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private _isOpen = new BehaviorSubject<boolean>(false);
  isOpen$ = this._isOpen.asObservable();

  open(): void {
    this._isOpen.next(true);
  }

  close(): void {
    this._isOpen.next(false);
  }
}
