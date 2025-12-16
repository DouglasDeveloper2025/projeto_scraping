/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

@Controller()
export class Scraping {
  @MessagePattern('processar_scraping')
  handle(@Payload() data: unknown, @Ctx() context: RmqContext): void {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    if (!channel || !message) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (channel as Channel).ack(message as ConsumeMessage);

    console.log('📩 Mensagem recebida (stub):', data);
  }
}
