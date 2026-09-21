import { Types } from 'mongoose';
import { IsArray, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, ValidateNested } from "class-validator";

import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { BasicFilterRequest, DateRangeRequest } from "src/common.dto";

export class QuestionDto {
  @IsString()
  flashcard_id: string;

  @IsOptional()
  is_correct?: boolean;

  @IsOptional()
  @IsMongoId()
  topic_id?: string;
}

export class TestCreateRequest {
  @IsArray()
  @ValidateNested({ each: true }) // validates every element of the array
  @Type(() => QuestionDto) // turns every element into a QuestionDto
  questions: QuestionDto[];

  @IsOptional()
  @IsMongoId()
  parent_test_id?: string;

  @IsOptional()
  @IsBoolean()
  only_wrong?: boolean;

  @IsOptional()
  @IsMongoId()
  source_post_id?: string;
}

// Filters shared between the test list (TestFilterDto) and the aggregate stats
// (getStats), so the stats shown always match the applied filters - the two
// dates included: a range that narrowed the list but not the numbers above it
// would leave them describing a different set of tests.
export class TestStatsFilterDto extends DateRangeRequest {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by subject ID, matching any test that touches it',
    required: false,
  })
  subject_id?: string;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by topic ID, matching only tests whose questions all share it',
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

  @IsOptional()
  @IsIn(['own', 'community'])
  @ApiProperty({
    description:
      "Filter by where the test's flashcards came from: 'own' for the tester's own library, 'community' for a community post",
    required: false,
    enum: ['own', 'community'],
  })
  source?: 'own' | 'community';
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

/** One of the topics the questions of a test are on, with the subject it belongs to. */
export interface TestTopic {
  _id: Types.ObjectId;
  name: string;
  color?: string;
  subject_id?: Types.ObjectId;
  subject_name?: string;
}
