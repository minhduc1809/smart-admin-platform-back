import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FormService } from './form.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormPageDto } from './dto/form-page.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Forms')
@Controller('forms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a new form' })
  create(@CurrentUser('userId') userId: string, @Body() createFormDto: CreateFormDto) {
    return this.formService.create(userId, createFormDto);
  }

  @Post('page')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated list of forms' })
  findPage(@Body() formPageDto: FormPageDto) {
    return this.formService.findPage(formPageDto);
  }

  @Get('many')
  @ApiOperation({ summary: 'Get all active forms' })
  findAll() {
    return this.formService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get form details by id' })
  findOne(@Param('id') id: string) {
    return this.formService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update form details' })
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.formService.update(id, updateFormDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft delete a form' })
  remove(@Param('id') id: string) {
    return this.formService.remove(id);
  }
}
