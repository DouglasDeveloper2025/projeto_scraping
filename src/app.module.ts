import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RabbitMQProducer } from './rabbitmq/producer.service';

@Module({
  imports: [RabbitMQModule],
  controllers: [AppController],
  providers: [AppService, RabbitMQProducer],
})
export class AppModule {}
