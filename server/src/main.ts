import morgan from 'morgan';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Parse query strings with qs, so bracketed keys such as topic_ids[]=a become
  // arrays. The default 'simple' parser leaves them as literal property names,
  // which the whitelisting ValidationPipe then rejects.
  app.set('query parser', 'extended');

  app.use(morgan('dev'));

  /**
   * How many proxies sit in front of us, so req.ip is the reader's address and
   * not the proxy's - everything that counts per address depends on it.
   *
   * Left at nothing by default, and that is the safe side: trusting a header
   * nobody is setting would let anybody claim any address they like and walk
   * through every limit here. Set TRUSTED_PROXIES to the number of hops
   * (1 for a single reverse proxy, 2 with Cloudflare in front of it) only when
   * those hops really exist.
   */
  const hops = Number(configService.get<string>('TRUSTED_PROXIES') ?? 0);
  if (hops > 0) {
    app.set('trust proxy', hops);
  } else {
    Logger.warn(
      'TRUSTED_PROXIES is 0: if anything sits in front of this server, every ' +
        'reader looks like it and the rate limits count them as one person.',
      'Bootstrap',
    );
  }

  /* configuration and Swagger activation*/
  if (configService.getOrThrow<boolean>('enableSwagger')) {
    const config = new DocumentBuilder()
      .addBearerAuth()
      // Applied to every operation: all of them are behind the global
      // JwtAuthGuard but a handful of @Public() ones, so declaring it per
      // controller would only be a list to keep in sync.
      .addSecurityRequirements('bearer')
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
