import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Flashcard } from '../models/flashcard.dto';
import { FlashcardService } from '../flashcard/flashcard.service';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { Group } from '../models/group.dto';
import { GroupService } from '../group/group.service';
import { Router } from '@angular/router';
import { Subject } from '../models/subject.dto';
import { SubjectService } from '../subject/subject.service';
import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Toast, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit {
  flashcards: Flashcard[] = [];
  subjects: Subject[] = [];
  groups: Group[] = [];
  selectedSubjectId: string | null = null;
  selectedGroupId: string | null = null;
  searchTerm: string = '';
  sortBy: 'title' | 'createdAt' = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  // mappa _id -> boolean (true = mostra risposta)
  showAnswerMap: Record<string, boolean> = {};

  constructor(
    private flashcardsService: FlashcardService,
    private toast: ToastService,
    private router: Router,
    private subjectService: SubjectService,
    private groupService: GroupService
  ) {}
// TODO mettere dei valori di default, non deve essere obbligatorio il filter né mettere tutti i parametri dentro filter
  ngOnInit(): void {
    this.subjectService.getAllSubjects({
      sortField: '_id',
      sortDirection: 'asc',
      skip: 0,
      limit: 50
    }).then((data) => this.subjects = data.data);

    this.groupService.getAllGroups({
      sortField: '_id',
      sortDirection: 'asc',
      skip: 0,
      limit: 50
    }).then((data) => this.groups = data.data);
    this.loadFlashcards();
  }

  loadFlashcards(): void {
    this.flashcardsService.getAll({
      sortField: this.sortBy,
      sortDirection: this.sortDirection,
      skip: 0,
      limit: 50,
      subject_id: this.selectedSubjectId || undefined,
      group_id: this.selectedGroupId || undefined,
      title: this.searchTerm || undefined
    }).then((data) => this.flashcards = data.data);
  }

  onFilterChange(): void {
    if (this.selectedSubjectId == null) {
      this.loadGroupsBySubject(undefined);
    } else if (this.selectedSubjectId) {
      this.loadGroupsBySubject(this.selectedSubjectId);
    } else {
      this.groups = [];
    }
    this.loadFlashcards();
  }

  onSearchTermChange(): void {
    this.loadFlashcards();
  }

  setSortBy(field: 'title' | 'createdAt'): void {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'asc';
    }
    this.loadFlashcards();
  }

  getCardColor(card: Flashcard): string {
    // se group_id è un oggetto Group, usa il suo colore
    if (card.group_id && typeof card.group_id !== 'string' && card.group_id.color) {
      return card.group_id.color;
    }
    // fallback
    return 'blue';
  }

  getCardBody(card: Flashcard): string {
    if (!card._id) return card.question;
    return this.showAnswerMap[card._id] ? card.answer : card.question;
  }

  // cambia da 'Vedi risposta' a 'Vedi domanda'
  getCardButtonText(card: Flashcard): string {
    return this.showAnswerMap[card._id] ? 'Vedi domanda' : 'Vedi risposta';
  }

  seeAnswer(card: Flashcard): void {
    if (!card._id) return;
    this.showAnswerMap[card._id] = !this.showAnswerMap[card._id];
  }

  async deleteCard(card: Flashcard): Promise<void> {
    if (!card._id) return;
    try {
      await this.flashcardsService.delete(card._id);
      this.toast.show("Card succesfully deleted", 'success');
      this.flashcards = this.flashcards.filter(c => c._id !== card._id);
    } catch (error: any) {
      this.toast.show("Error", 'error');
    }
  }

  async loadGroupsBySubject(subjectId: string | undefined) {
    try {
      const response = await this.groupService.getAllGroups({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: subjectId
      });
      this.groups = response.data;
    } catch (err) {
      console.error('Error loading groups for subject ' + subjectId, err);
      this.toast.show('Failed to load groups for the selected subject', 'error');
    }
  }

  modifyCard(card: Flashcard): void {
    if (card._id) {
      this.router.navigate(['/edit-card', card._id]);
    }
  }

  copyCard(card: Flashcard): void {
    // esempio: copi solo il testo
    navigator.clipboard.writeText(`${card.title}\nQuestion: ${card.question}\nAnswer: ${card.answer}`);
    alert('Card copiata negli appunti!');
  }
}