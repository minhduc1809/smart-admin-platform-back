import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Role')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Danh sách vai trò (Admin only)' })
  listRoles() {
    return Object.values(Role);
  }
}
