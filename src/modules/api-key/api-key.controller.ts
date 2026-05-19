import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyDto } from './dto/api-key.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  create(@Body() dto: ApiKeyDto) {
    return this.apiKeyService.createApiKey(dto);
  }

  @Get()
  findAll() {
    return this.apiKeyService.listApiKeys();
  }

  @Patch(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.apiKeyService.revokeApiKey(id);
  }
}
