import morgan from 'morgan';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Parse query strings with qs, so bracketed keys such as topic_ids[]=a become
  // arrays. The default 'simple' parser leaves them as literal property names,
  // which the whitelisting ValidationPipe then rejects.
  app.set('query parser', 'extended');

  app.use(morgan('dev'));

  /* configuration and Swagger activation*/
  if (configService.getOrThrow<boolean>('enableSwagger')) {
    const config = new DocumentBuilder()
      .addBearerAuth()
      .setTitle(configService.getOrThrow<string>('appName'));

    const document = SwaggerModule.createDocument(app, config.build());
    SwaggerModule.setup(`/swagger`, app, document, {
      customSiteTitle: 'FlashcardManager-Swagger',
      swaggerOptions: {
        persistAuthorization: true,
      },
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title::before { display: inline-block; width: 226px; height: 65px; margin: -50px 0; position: relative; content: ''; vertical-align: middle; background-size: contain; background-repeat: no-repeat; background-position: left center; }
        `,
    });
  }

  app.useGlobalPipes( // class-validation
    new ValidationPipe({
      whitelist: true, // strips properties not declared in the DTOs
      forbidNonWhitelisted: true, // rejects the request when extra properties are sent
      transform: true, // converte automaticamente i tipi (es. string → number)
    }),
  );

  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
