import { Injectable, Logger } from '@nestjs/common';
import { ScrapingPayloadDto } from '../rabbitmq/dto/scraping.dto';
import { run as runScraper } from '../scraping/scraper';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  async handleMessage(payload: ScrapingPayloadDto): Promise<any> {
    try {
      this.logger.log(`Iniciando scraping: ${payload?.payload?.termos}`);
      const result = await runScraper(payload);
      return result ?? {};
    } catch (error) {
      this.logger.error('Erro ao executar scraper');
      this.logger.error(error);
      throw error;
    }
  }
}
