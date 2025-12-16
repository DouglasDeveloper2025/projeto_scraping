import { ClientProxy } from '@nestjs/microservices';
export declare class RabbitMQProducer {
    private readonly client;
    constructor(client: ClientProxy);
    enviar(dados: unknown): import("rxjs").Observable<any>;
}
