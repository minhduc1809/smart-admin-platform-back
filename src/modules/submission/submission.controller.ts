import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionFilterDto } from './dto/submission-filter.dto';
import { ResubmitDto } from './dto/resubmit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new form' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my submissions' })
  findMySubmissions(
    @CurrentUser('id') userId: string,
    @Query() query: SubmissionFilterDto,
  ) {
    return this.submissionService.findMySubmissions(userId, query);
  }

  @Get('admin')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get all submissions (Admin/Manager)' })
  findAll(@Query() query: SubmissionFilterDto) {
    return this.submissionService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission details' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.submissionService.findOne(id, user.id, user.role);
  }

  @Patch(':id/recall')
  @ApiOperation({ summary: 'Recall a submission to DRAFT status' })
  recall(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.submissionService.recall(id, userId);
  }

  @Post(':id/resubmit')
  @ApiOperation({ summary: 'Resubmit a rejected/cancelled/returned submission as a new revision' })
  resubmit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ResubmitDto,
  ) {
    return this.submissionService.resubmit(userId, id, dto.data);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Get all revisions of a submission' })
  getRevisions(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.submissionService.getRevisions(id, user.id, user.role);
  }
}
