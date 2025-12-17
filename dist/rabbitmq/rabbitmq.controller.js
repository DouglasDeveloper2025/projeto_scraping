"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQController = void 0;
const common_1 = require("@nestjs/common");
const producer_service_1 = require("./producer.service");
const scraping_dto_1 = require("./dto/scraping.dto");
const consumer_service_1 = require("./consumer.service");
const microservices_1 = require("@nestjs/microservices");
let RabbitMQController = class RabbitMQController {
    rabbit;
    consumer;
    constructor(rabbit, consumer) {
        this.rabbit = rabbit;
        this.consumer = consumer;
    }
    async receber(body) {
        this.rabbit.enviar(body);
        return { status: 'Recebido e enfileirado' };
    }
    async receberVarios(body) {
        this.rabbit.enviar(body);
        return { status: 'Recebido e enfileirado' };
    }
    async handleQueueMessage(data, context) {
        console.log('Payload recebido da fila:', data);
        const result = await this.consumer.handleMessage(data);
        console.log('Resultado do scraping:', JSON.stringify(result, null, 2));
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        channel.ack(originalMsg);
    }
};
exports.RabbitMQController = RabbitMQController;
__decorate([
    (0, common_1.Post)('scraping'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [scraping_dto_1.ScrapingPayloadDto]),
    __metadata("design:returntype", Promise)
], RabbitMQController.prototype, "receber", null);
__decorate([
    (0, common_1.Post)('scraping/mais'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], RabbitMQController.prototype, "receberVarios", null);
__decorate([
    (0, microservices_1.EventPattern)('scraping'),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [scraping_dto_1.ScrapingPayloadDto, microservices_1.RmqContext]),
    __metadata("design:returntype", Promise)
], RabbitMQController.prototype, "handleQueueMessage", null);
exports.RabbitMQController = RabbitMQController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [producer_service_1.RabbitMQProducer,
        consumer_service_1.ConsumerService])
], RabbitMQController);
//# sourceMappingURL=rabbitmq.controller.js.map