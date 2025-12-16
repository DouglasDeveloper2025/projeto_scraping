// rabbitmq.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQProducer {
  constructor(
    @Inject('RABBITMQ_SERVICE')
    private readonly client: ClientProxy,
  ) {}

  enviar(dados: unknown) {
    // emit = fire and forget (igual sendToQueue)
    return this.client.emit('scraping', dados);
  }
}
