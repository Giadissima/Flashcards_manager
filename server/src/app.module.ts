import { ConfigModule, ConfigService } from '@nestjs/config';

import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FileModule } from './file/file.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { TopicModule } from './topic/topic.module';
import { ImportExportModule } from './import-export/import-export.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostModule } from './post/post.module';
import { SubjectModule } from './subject/subject.module';
import { TestModule } from './test/test.module';
import { UniversityModule } from './university/university.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
      }),
    }),
    AuthModule,
    FileModule,
    FlashcardsModule,
    TopicModule,
    SubjectModule,
    ImportExportModule,
    TestModule,
    UniversityModule,
    PostModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Closed by default: every endpoint needs a token unless it is marked
    // @Public(), so a new controller cannot forget to protect itself.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
