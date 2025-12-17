import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQProducer } from './producer.service';
import { ConsumerService } from './consumer.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'scraping',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [RabbitMQProducer, ConsumerService],
  exports: [ClientsModule, RabbitMQProducer, ConsumerService],
})
export class RabbitMQModule {}
