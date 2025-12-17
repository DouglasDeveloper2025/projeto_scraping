import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ScrapingPayloadDto } from '../rabbitmq/dto/scraping.dto';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  async handleMessage(payload: ScrapingPayloadDto): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('python', [
        'src/scraping/scraper.py',
        JSON.stringify(payload),
      ]);
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });
 
      process.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`O script Python saiu com o código ${code}.`);
          this.logger.error(`Payload: ${JSON.stringify(payload)}`);
          this.logger.error(`Stderr: ${error}`);
          return reject(new Error(`Scraping failed: ${error}`));
        }
 
        if (error) {
          this.logger.warn(`O script Python retornou Vazio..`);
        }

        try {
          if (output.trim() === '') {
            this.logger.warn('O script Python retornou Vazio..');
            return resolve({});
          }
          resolve(JSON.parse(output));
        } catch (e) {
          this.logger.error('Falha ao analisar a saída do script Python como JSON.');
          this.logger.error(`Payload: ${JSON.stringify(payload)}`);
          this.logger.error(`Stdout: ${output}`);
          reject(new Error('Falha ao analisar a saída do script Python como JSON.'));
        }
      });
    });
  }
}
