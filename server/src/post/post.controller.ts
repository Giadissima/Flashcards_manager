import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CastVoteDto,
  FeedFilterRequest,
  FeedPost,
  WriteMessageDto,
} from './post.dto';

import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult } from 'src/common.dto';
import { BasicFilterRequest } from 'src/common.dto';
import { Comment } from './comment.schema';
import { FlashcardDocument } from 'src/flashcards/flashcards.schema';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
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
    @CurrentUser() user: JwtPayload,
    @Query() filters: FeedFilterRequest,
  ): Promise<BasePaginatedResult<FeedPost>> {
    return this.postService.findFeed(user.sub, filters);
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

  @ApiOperation({
    description: 'rate a post: 1 up, -1 down, 0 to take the vote back',
  })
  @Patch(':id/vote')
  vote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CastVoteDto,
  ): Promise<void> {
    return this.postService.vote(user.sub, id, dto.value);
  }


  @ApiOperation({
    description: 'copy a public flashcard into your own library',
  })
  @Post('flashcards/:id/import')
  importFlashcard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.postService.importFlashcard(user.sub, id);
  }


  // ---------------------------------------------------------------- comments

  @ApiOperation({ description: 'the public comments under a post' })
  @Get(':id/comments')
  findComments(
    @Param('id') id: string,
    @Query() filters: BasicFilterRequest,
  ): Promise<BasePaginatedResult<Comment>> {
    return this.postService.findComments(id, filters);
  }

  @ApiOperation({ description: 'comment publicly on a post' })
  @Post(':id/comments')
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: WriteMessageDto,
  ): Promise<void> {
    return this.postService.addComment(user.sub, id, dto.text);
  }

  @ApiOperation({ description: 'delete a comment of your own' })
  @Delete('comments/:id')
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.postService.deleteComment(user.sub, id);
  }


}
