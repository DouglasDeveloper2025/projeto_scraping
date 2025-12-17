import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/conn';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RabbitMQController } from './rabbitmq/rabbitmq.controller';

@Module({
  imports: [RabbitMQModule, DatabaseModule],
  controllers: [AppController, RabbitMQController],
  providers: [AppService],
})
export class AppModule {}
