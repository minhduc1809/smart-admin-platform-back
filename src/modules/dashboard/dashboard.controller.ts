import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Tổng quan nhanh - toàn hệ thống' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('my-summary')
  @ApiOperation({ summary: 'Tổng quan nhanh - của tôi' })
  getMySummary(@CurrentUser('id') userId: string) {
    return this.dashboardService.getMySummary(userId);
  }

  @Get('submissions-by-status')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Phân bổ submissions theo trạng thái' })
  getSubmissionsByStatus() {
    return this.dashboardService.getSubmissionsByStatus();
  }

  @Get('submissions-by-day')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Số submissions theo ngày' })
  getSubmissionsByDay(@Query('days') days?: string) {
    return this.dashboardService.getSubmissionsByDay(
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('top-forms')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Top forms được dùng nhiều nhất' })
  getTopForms(@Query('limit') limit?: string) {
    return this.dashboardService.getTopForms(
      limit ? parseInt(limit, 10) : 5,
    );
  }
}

