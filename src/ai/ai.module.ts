import { Module } from '@nestjs/common';
import { OpenAiClientService } from './openai-client.service';

@Module({
  providers: [OpenAiClientService],
  exports: [OpenAiClientService],
})
export class AiModule {}
