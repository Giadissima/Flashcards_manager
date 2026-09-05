import { Module } from '@nestjs/common';
import { UniversityController } from './university.controller';
import { UniversityService } from './university.service';

@Module({
  controllers: [UniversityController],
  providers: [UniversityService],
  exports: [UniversityService], // AuthService validates the registration payload with it
})
export class UniversityModule {}
