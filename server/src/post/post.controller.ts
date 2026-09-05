import { Controller, Get, Param, Query } from '@nestjs/common';
import { FeedFilterRequest, FeedPost } from './post.dto';

import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult } from 'src/common.dto';
import { FlashcardDocument } from 'src/flashcards/flashcards.schema';
import { PostService } from './post.service';

/**
 * The Community feed. Behind the login like everything else, but not scoped to
 * the caller: it is the one place that shows other people's work, and what
 * keeps that safe is that a post exists only for something marked public.
 */
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiOperation({
    description:
      'the community feed, newest first by publication or by last change',
  })
  @Get()
  findFeed(
    @Query() filters: FeedFilterRequest,
  ): Promise<BasePaginatedResult<FeedPost>> {
    return this.postService.findFeed(filters);
  }

  @ApiOperation({ description: 'one page of the flashcards of a post' })
  @Get(':id/flashcards')
  findFlashcards(
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('limit') limit: string,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.postService.findFlashcards(
      id,
      Number(skip) || 0,
      Number(limit) || 5,
    );
  }
}
