import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ScrapingPayloadDto } from '../rabbitmq/dto/scraping.dto';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  async handleMessage(payload: ScrapingPayloadDto): Promise<any> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Received payload: ${JSON.stringify(payload)}`);
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
          this.logger.error(`Python script exited with code ${code}.`);
          this.logger.error(`Payload: ${JSON.stringify(payload)}`);
          this.logger.error(`Stderr: ${error}`);
          return reject(new Error(`Scraping failed: ${error}`));
        }

        if (error) {
          this.logger.warn(`Python script stderr: ${error}`);
        }

        try {
          // Garante que a saída não esteja vazia antes de fazer o parse
          if (output.trim() === '') {
            this.logger.warn('Python script returned empty output.');
            return resolve({});
          }
          resolve(JSON.parse(output));
        } catch (e) {
          this.logger.error('Failed to parse Python script output as JSON.');
          this.logger.error(`Payload: ${JSON.stringify(payload)}`);
          this.logger.error(`Stdout: ${output}`);
          reject(new Error('Failed to parse scraper output.'));
        }
      });
    });
  }
}
