import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { FileService } from './file/file.service';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { TopicModule } from './topic/topic.module';
import { ImportExportModule } from './import-export/import-export.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubjectModule } from './subject/subject.module';
import { TestModule } from './test/test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // importa ConfigModule se non globale
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
      }),
    }),
    FileModule,
    FlashcardsModule,
    TopicModule,
    SubjectModule,
    ImportExportModule,
    TestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
