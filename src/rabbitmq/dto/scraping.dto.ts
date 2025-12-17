import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ScrapingPayloadDto {
  @IsString()
  @IsNotEmpty()
  termos: string;

  @IsString()
  @IsOptional()
  proxy?: string;
}