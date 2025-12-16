import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/conn';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RabbitMQProducer } from './rabbitmq/producer.service';
import { RabbitMQController } from './rabbitmq/rabbitmq.controller';

@Module({
  imports: [RabbitMQModule, DatabaseModule],
  controllers: [AppController, RabbitMQController],
  providers: [AppService, RabbitMQProducer],
})
export class AppModule {}
