import { RabbitMQProducer } from './producer.service';
import { ScrapingPayloadDto } from './dto/scraping.dto';
import { ConsumerService } from './consumer.service';
import { RmqContext } from '@nestjs/microservices';
export declare class RabbitMQController {
    private readonly rabbit;
    private readonly consumer;
    constructor(rabbit: RabbitMQProducer, consumer: ConsumerService);
    receber(body: ScrapingPayloadDto): Promise<{
        status: string;
    }>;
    handleQueueMessage(data: ScrapingPayloadDto, context: RmqContext): Promise<void>;
}
