import { ConfigModule, ConfigService } from '@nestjs/config';

import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { FriendlyThrottlerGuard } from './common/throttle.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FileModule } from './file/file.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { TopicModule } from './topic/topic.module';
import { ImportExportModule } from './import-export/import-export.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Module } from '@nestjs/common';
import { ModerationModule } from './moderation/moderation.module';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from './notification/notification.module';
import { PostModule } from './post/post.module';
import { SubjectModule } from './subject/subject.module';
import { TestModule } from './test/test.module';
import { UniversityModule } from './university/university.module';
import { rateLimits } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Counted per address, in this process's memory: a restart forgets, which
    // is the right trade for something whose whole job is to blunt a burst.
    ThrottlerModule.forRoot([{ name: 'all', ...rateLimits.all }]),
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
    NotificationModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Closed by default: every endpoint needs a token unless it is marked
    // @Public(), so a new controller cannot forget to protect itself.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // And nothing, token or not, gets to ask as fast as it likes - said in a
    // way somebody who is not a script can act on
    { provide: APP_GUARD, useClass: FriendlyThrottlerGuard },
  ],
})
export class AppModule {}
