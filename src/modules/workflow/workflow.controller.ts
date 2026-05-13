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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowActionService } from './workflow-action.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { ExecuteActionDto } from './dto/execute-action.dto';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly definitionService: WorkflowDefinitionService,
    private readonly actionService: WorkflowActionService,
  ) {}

  // --- Workflow Definition CRUD ---

  @Post('definitions')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a workflow definition' })
  createDefinition(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    return this.definitionService.create(userId, dto);
  }

  @Get('definitions')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all workflow definitions' })
  findAllDefinitions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.definitionService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('definitions/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get a workflow definition by ID' })
  findOneDefinition(@Param('id') id: string) {
    return this.definitionService.findOne(id);
  }

  @Put('definitions/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update a workflow definition' })
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.definitionService.update(id, dto);
  }

  @Delete('definitions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a workflow definition' })
  removeDefinition(@Param('id') id: string) {
    return this.definitionService.remove(id);
  }

  // --- Workflow Action Execution ---

  @Post('action')
  @ApiOperation({ summary: 'Execute a workflow action on a submission' })
  executeAction(@CurrentUser() user: any, @Body() dto: ExecuteActionDto) {
    return this.actionService.execute(user.id, user.role, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Danh sách submission đang chờ tôi duyệt' })
  getPending(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.actionService.getPendingForUser(
      user.role,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // --- Workflow Query ---

  @Get('submissions/:submissionId/history')
  @ApiOperation({ summary: 'Get workflow history for a submission' })
  getHistory(
    @Param('submissionId') submissionId: string,
    @Query('includeRevisions') includeRevisions?: string,
  ) {
    return this.actionService.getHistory(
      submissionId,
      includeRevisions === 'true',
    );
  }

  @Get('submissions/:submissionId/available-actions')
  @ApiOperation({
    summary: 'Get available actions for current user on a submission',
  })
  getAvailableActions(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: any,
  ) {
    return this.actionService.getAvailableActions(submissionId, user.role);
  }
}
