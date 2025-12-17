import { ScrapingPayloadDto } from '../rabbitmq/dto/scraping.dto';
export declare class ConsumerService {
    private readonly logger;
    handleMessage(payload: ScrapingPayloadDto): Promise<any>;
}
