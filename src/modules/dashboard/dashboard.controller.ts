import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tổng quan nhanh (4 số)' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('submissions-by-status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Phân bổ submissions theo trạng thái' })
  getSubmissionsByStatus() {
    return this.dashboardService.getSubmissionsByStatus();
  }

  @Get('submissions-by-day')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Số submissions theo ngày' })
  getSubmissionsByDay(@Query('days') days?: string) {
    return this.dashboardService.getSubmissionsByDay(
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('top-forms')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Top forms được dùng nhiều nhất' })
  getTopForms(@Query('limit') limit?: string) {
    return this.dashboardService.getTopForms(
      limit ? parseInt(limit, 10) : 5,
    );
  }
}

