import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Group } from '../../models/group.dto';
import { GroupService } from '../../group/group.service';
import { Router } from '@angular/router';
import { Subject } from '../../models/subject.dto';
import { SubjectService } from '../../subject/subject.service';

export function atLeastOneValidator(controls: string[]): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const hasValue = controls.some(controlName => !!group.get(controlName)?.value);
    return hasValue ? null : { atLeastOneRequired: true };
  };
}

@Component({
  selector: 'app-setup-test',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './setup-test.html',
  styleUrls: ['./setup-test.scss']
})
export class SetupTest implements OnInit {
  testForm: FormGroup;
  subjects: Subject[] = [];
  groups: Group[] = [];
  allGroups: Group[] = [];

  constructor(
    private fb: FormBuilder,
    private subjectService: SubjectService,
    private groupService: GroupService,
    private router: Router
  ) {
    this.testForm = this.fb.group({
      subject_id: [null],
      group_id: [null],
      num: [10, [Validators.required, Validators.min(1)]]
    }, { validators: atLeastOneValidator(['subject_id', 'group_id']) });
  }

  ngOnInit(): void {
    this.subjectService.getAllSubjects({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' })
      .then(response => this.subjects = response.data);

    this.groupService.getAllGroups({ limit: 50, skip: 0, sortDirection: 'asc', sortField: 'name' })
      .then(response => {
        this.allGroups = response.data;
        this.groups = response.data;
      });

    this.testForm.get('subject_id')?.valueChanges.subscribe(subjectId => {
      if (subjectId) {
        this.groups = this.allGroups.filter(g => (g.subject_id as Subject)?._id === subjectId);
      } else {
        this.groups = this.allGroups;
      }
      this.testForm.get('group_id')?.setValue(null);
    });
  }

  startTest(): void {
    if (this.testForm.valid) {
      const { subject_id, group_id, num } = this.testForm.value;
      const queryParams: any = { num };
      if (subject_id) {
        queryParams.subject_id = subject_id;
      }
      if (group_id) {
        queryParams.group_id = group_id;
      }
      this.router.navigate(['/test-runner'], { queryParams });
    }
  }
}