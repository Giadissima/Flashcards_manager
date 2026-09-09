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
  FeedFilterRequest,
  FeedPost,
  ImportPostDto,
  ImportResult,
  ImportTargetDto,
  PostContents,
  SetLikeDto,
  WriteMessageDto,
} from './post.dto';

import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { rateLimits } from 'src/config';
import { BasePaginatedResult } from 'src/common.dto';
import { BasicFilterRequest } from 'src/common.dto';
import { Comment } from './comment.schema';
import { Feedback } from './feedback.schema';
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

  @ApiOperation({ description: 'one page of the flashcards of a post, optionally narrowed to a topic' })
  @Get(':id/flashcards')
  findFlashcards(
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('limit') limit: string,
    @Query('topicId') topicId?: string,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.postService.findFlashcards(
      id,
      Number(skip) || 0,
      Number(limit) || 5,
      topicId,
    );
  }

  @ApiOperation({
    description: 'like a post, or take your like back; never your own',
  })
  @Patch(':id/like')
  setLike(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetLikeDto,
  ): Promise<void> {
    return this.postService.setLike(user.sub, id, dto.liked);
  }


  @ApiOperation({
    description: 'the topics of a post, with how many shared cards are in each',
  })
  @Get(':id/contents')
  findContents(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PostContents> {
    return this.postService.findContents(user.sub, id);
  }

  @ApiOperation({
    description: 'copy a whole shared set into your own library',
  })
  @Post(':id/import')
  importPost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ImportPostDto,
  ): Promise<ImportResult> {
    return this.postService.importPost(user.sub, id, dto);
  }

  @ApiOperation({
    description: 'copy a public flashcard into your own library',
  })
  @Post('flashcards/:id/import')
  importFlashcard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ImportTargetDto,
  ): Promise<void> {
    return this.postService.importFlashcard(user.sub, id, dto);
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
  @Throttle({ all: rateLimits.write })
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

  // ---------------------------------------------------------------- feedback

  @ApiOperation({
    description: 'report privately to the author of a flashcard',
  })
  @Throttle({ all: rateLimits.write })
  @Post('flashcards/:id/feedback')
  createFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: WriteMessageDto,
  ): Promise<void> {
    return this.postService.createFeedback(user.sub, id, dto.text);
  }

  // Declared ahead of feedback/:id, which would otherwise match "open" and
  // look for an exchange with that id
  @ApiOperation({
    description: 'the reports on your flashcards that are still open',
  })
  @Get('feedback/open')
  findOpenFeedback(
    @CurrentUser() user: JwtPayload,
    @Query() filters: BasicFilterRequest,
  ): Promise<BasePaginatedResult<Feedback>> {
    return this.postService.findOpenFeedback(user.sub, filters);
  }

  @ApiOperation({
    description: 'read one private exchange; only its two people can',
  })
  @Get('feedback/:id')
  findFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<Feedback> {
    return this.postService.findFeedback(user.sub, id);
  }

  @ApiOperation({
    description: 'mark a report as dealt with; only its author can',
  })
  @Patch('feedback/:id/resolve')
  resolveFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.postService.resolveFeedback(user.sub, id);
  }

  @ApiOperation({
    description: 'add your one reply to an exchange, when it is your turn',
  })
  @Throttle({ all: rateLimits.write })
  @Post('feedback/:id/reply')
  replyToFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: WriteMessageDto,
  ): Promise<void> {
    return this.postService.replyToFeedback(user.sub, id, dto.text);
  }

}
