// create-card.component.ts

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { answerMaxLength, charMinLength, idLength, questionMaxLength, titleMaxLength } from '../../../config/config';

import { CommonModule } from '@angular/common';
import { FlashcardService } from '../flashcard.service';
import { Group } from '../../models/group.dto';
import { GroupService } from '../../group/group.service';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';
import { Toast } from "../../toast/toast";
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-create-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast],
  templateUrl: './create-flashcard.html',
  styleUrls: ['./create-flashcard.scss']
})
export class CreateFlashcard implements OnInit {
  cardForm!: FormGroup;
  groups: Group[] = [];
  subjects: Subject[] = [];

  constructor(
    private fb: FormBuilder,
    private flashcardService: FlashcardService,
    private toastService: ToastService,
    private groupService: GroupService,
    private subjectService: SubjectService
  ) {}

  ngOnInit(): void {
    this.cardForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(titleMaxLength)]],
      question: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(questionMaxLength)]],
      answer: ['', [Validators.required, Validators.minLength(charMinLength), Validators.maxLength(answerMaxLength)]],
      group_id: [{ value: '', disabled: true }],
      subject_id: ['']
    });

    this.loadSubjects();

    this.cardForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      this.groups = [];
      this.cardForm.get('group_id')?.reset({ value: '', disabled: !subjectId });
      
      if (subjectId) {
        this.loadGroupsBySubject(subjectId);
      }
    });
  }

  async loadGroupsBySubject(subjectId: string) {
    try {
      const response = await this.groupService.getAllGroups({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc',
        subject_id: subjectId
      });
      this.groups = response.data;
      this.cardForm.get('group_id')?.enable();
    } catch (err) {
      console.error('Error loading groups for subject ' + subjectId, err);
      this.toastService.show('Failed to load groups for the selected subject', 'error');
    }
  }

  async loadSubjects() {
    try {
      const response = await this.subjectService.getAllSubjects({
        skip: 0,
        limit: 50,
        sortField: 'name',
        sortDirection: 'asc'
      });
      this.subjects = response.data;
    } catch (err) {
      console.error('Error loading subjects', err);
      this.toastService.show('Failed to load subjects', 'error');
    }
  }

  textAreaAutoResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async addCard() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    const newCard = this.cardForm.value;

    try {
      await this.flashcardService.create(newCard);
      this.toastService.show("Card successfully added", 'success')
      this.cardForm.reset();
    } catch (err: any) {
      console.error(err);
      this.toastService.show("Error", 'error')
    }
  }
}
