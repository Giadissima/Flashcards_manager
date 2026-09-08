import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from './user.schema';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { FileModule } from 'src/file/file.module';
import { ModerationModule } from 'src/moderation/moderation.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UniversityModule } from 'src/university/university.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UniversityModule,
    FileModule,
    ModerationModule,
    JwtModule.registerAsync({
      global: true, // the guard registered in AppModule needs JwtService too
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        // Cast: the duration is a free-form string here, while the typings
        // expect one of the literal "7d"-shaped values.
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '7d',
        } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
