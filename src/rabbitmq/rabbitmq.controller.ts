/* eslint-disable @typescript-eslint/require-await */
// scraping.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { RabbitMQProducer } from './producer.service';

@Controller()
export class RabbitMQController {
  constructor(private readonly rabbit: RabbitMQProducer) {}

  @Post('scraping')
  async receber(@Body() body: any) {
    console.log('Payload', body);

    this.rabbit.enviar(body);

    return { status: 'Recebido e enfileirado' };
  }

  @Post('scrapingVarias')
  async receberVarias(@Body() body: any) {
    console.log('Payload', body);

    this.rabbit.enviar(body);

    return { status: 'Recebido e enfileirado' };
  }
}
