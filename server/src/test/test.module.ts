import { Test, TestSchema } from './test.schema';

import { FlashcardsModule } from 'src/flashcards/flashcards.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestController } from './test.controller';
import { TestService } from './test.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Test.name, schema: TestSchema }]),
    FlashcardsModule,
  ],
  providers: [TestService],
  controllers: [TestController],
})
export class TestModule {}
