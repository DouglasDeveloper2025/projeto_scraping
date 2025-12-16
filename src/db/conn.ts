import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User, SuccessLog } from '../entity'

@Module({
  imports: [
    // vai Carrega os dados da .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // aqui e onde vai fazer a Conexão ao banco de dados postgres
    TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(<string>process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [User, SuccessLog],
    synchronize: true,
  }),
]
})
export class DatabaseModule {}