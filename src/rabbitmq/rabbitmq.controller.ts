// scraping.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { RabbitMQProducer } from './producer.service';
import { ScrapingPayloadDto } from './dto/scraping.dto';
import { ConsumerService } from './consumer.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

@Controller()
export class RabbitMQController {
  constructor(
    private readonly rabbit: RabbitMQProducer,
    private readonly consumer: ConsumerService,
  ) {}

  @Post('scraping')
  async receber(@Body() body: ScrapingPayloadDto) {
    this.rabbit.enviar(body);

    return { status: 'Recebido e enfileirado' };
  }

  @Post('scraping/mais')
  async receberVarios(@Body() body: ScrapingPayloadDto[]) {
    this.rabbit.enviar(body);

    return { status: 'Recebido e enfileirado' };
  }

  @EventPattern('scraping')
  async handleQueueMessage(@Payload() data: ScrapingPayloadDto, @Ctx() context: RmqContext) {
    console.log('Payload recebido da fila:', data);
    const result = await this.consumer.handleMessage(data);
    console.log('Resultado do scraping:', JSON.stringify(result, null, 2));

    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}
