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
const scraper_1 = require("../scraping/scraper");
let ConsumerService = ConsumerService_1 = class ConsumerService {
    logger = new common_1.Logger(ConsumerService_1.name);
    async handleMessage(payload) {
        try {
            this.logger.log(`Iniciando scraping: ${payload?.payload?.termos}`);
            const result = await (0, scraper_1.run)(payload);
            return result ?? {};
        }
        catch (error) {
            this.logger.error('Erro ao executar scraper');
            this.logger.error(error);
            throw error;
        }
    }
};
exports.ConsumerService = ConsumerService;
exports.ConsumerService = ConsumerService = ConsumerService_1 = __decorate([
    (0, common_1.Injectable)()
], ConsumerService);
//# sourceMappingURL=consumer.service.js.map