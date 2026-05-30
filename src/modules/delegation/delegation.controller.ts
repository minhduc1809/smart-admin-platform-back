import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DelegationService } from './delegation.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';

@ApiTags('Delegations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('delegations')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new delegation' })
  create(@CurrentUser() user: any, @Body() dto: CreateDelegationDto) {
    return this.delegationService.create(user.id, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all delegations' })
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.delegationService.findAll(
      user.id,
      user.role,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a delegation by ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.delegationService.findOne(id, user.id, user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a delegation' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDelegationDto,
  ) {
    return this.delegationService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a delegation' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.delegationService.remove(id, user.id, user.role);
  }
}
