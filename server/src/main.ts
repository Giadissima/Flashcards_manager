import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  /* configuration and Swagger activation*/
  if (configService.getOrThrow<boolean>('enableSwagger')) {
    const config = new DocumentBuilder()
      .addBearerAuth()
      .setTitle(configService.getOrThrow<string>('appName'));

    const document = SwaggerModule.createDocument(app, config.build());
    SwaggerModule.setup(`/swagger`, app, document, {
      customSiteTitle: 'Nest-Middlewares-with-Swagger',
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
      whitelist: true, // rimuove campi non dichiarati nei DTO
      forbidNonWhitelisted: true, // lancia errore se ci sono campi extra
      transform: true, // converte automaticamente i tipi (es. string → number)
    }),
  );

  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
