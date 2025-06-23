import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { GroupModule } from './group/group.module';
import { ImportExportModule } from './import-export/import-export.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { SubjectModule } from './subject/subject.module';
import { join } from 'path';
import { TestModule } from './test/test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'client'), // cartella client esterna a src/
      exclude: ['/api*'], // tutte le route API continuano a funzionare normalmente
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // importa ConfigModule se non globale
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
      }),
    }),
    FlashcardsModule,
    GroupModule,
    SubjectModule,
    ImportExportModule,
    TestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
