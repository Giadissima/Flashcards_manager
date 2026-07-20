import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

import { Type } from "class-transformer";
import { BasicFilterRequest } from "src/common.dto";

export class QuestionDto {
  @IsString()
  flashcard_id: string;

  @IsOptional()
  is_correct?: boolean;
}

export class TestCreateRequest {
  @IsArray()
  @ValidateNested({ each: true }) // valida ogni elemento dell'array
  @Type(() => QuestionDto)        // trasforma ogni elemento in QuestionDto
  questions: QuestionDto[];
}

export class TestFilterDto extends BasicFilterRequest {}

export interface TestStats {
  totalTests: number;
  completedTests: number;
  totalTimeSpentSeconds: number;
  averageScorePercent: number;
}