import { RabbitMQProducer } from './producer.service';
export declare class RabbitMQController {
    private readonly rabbit;
    constructor(rabbit: RabbitMQProducer);
    receber(body: any): Promise<{
        status: string;
    }>;
    receberVarias(body: any): Promise<{
        status: string;
    }>;
}
