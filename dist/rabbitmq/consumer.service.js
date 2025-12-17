"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
let ConsumerService = ConsumerService_1 = class ConsumerService {
    logger = new common_1.Logger(ConsumerService_1.name);
    async handleMessage(payload) {
        return new Promise((resolve, reject) => {
            this.logger.log(`Received payload: ${JSON.stringify(payload)}`);
            const process = (0, child_process_1.spawn)('python', [
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
                    if (output.trim() === '') {
                        this.logger.warn('Python script returned empty output.');
                        return resolve({});
                    }
                    resolve(JSON.parse(output));
                }
                catch (e) {
                    this.logger.error('Failed to parse Python script output as JSON.');
                    this.logger.error(`Payload: ${JSON.stringify(payload)}`);
                    this.logger.error(`Stdout: ${output}`);
                    reject(new Error('Failed to parse scraper output.'));
                }
            });
        });
    }
};
exports.ConsumerService = ConsumerService;
exports.ConsumerService = ConsumerService = ConsumerService_1 = __decorate([
    (0, common_1.Injectable)()
], ConsumerService);
//# sourceMappingURL=consumer.service.js.map