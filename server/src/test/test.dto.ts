import { IsArray, IsBoolean, IsMongoId, IsOptional, IsString, ValidateNested } from "class-validator";

import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { BasicFilterRequest } from "src/common.dto";

export class QuestionDto {
  @IsString()
  flashcard_id: string;

  @IsOptional()
  is_correct?: boolean;
}

export class TestCreateRequest {
  @IsArray()
  @ValidateNested({ each: true }) // validates every element of the array
  @Type(() => QuestionDto) // turns every element into a QuestionDto
  questions: QuestionDto[];
}

// Filters shared between the test list (TestFilterDto) and the aggregate stats
// (getStats), so the stats shown always match the applied filters
export class TestStatsFilterDto {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by subject ID (via the flashcards in the test)',
    required: false,
  })
  subject_id?: string;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by topic ID (via the flashcards in the test)',
    required: false,
  })
  topic_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiProperty({
    description: 'Show only tests with at least one wrong answer',
    required: false,
  })
  onlyWrong?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiProperty({
    description: 'Filter by completion status: true = completed, false = in progress',
    required: false,
  })
  completed?: boolean;
}

export class TestFilterDto extends IntersectionType(
  BasicFilterRequest,
  TestStatsFilterDto,
) {}

export interface TestStats {
  totalTests: number;
  completedTests: number;
  totalTimeSpentSeconds: number;
  averageScorePercent: number;
}