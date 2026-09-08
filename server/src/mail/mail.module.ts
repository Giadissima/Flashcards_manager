import { Module } from '@nestjs/common';

import { MailService } from './mail.service';

/** Imported by whatever has something to say to a user's inbox - which today
    is only the confirmation of a new address. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
