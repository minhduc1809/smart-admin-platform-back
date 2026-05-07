import { Body, Controller, Put, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserService } from './user.service';
import { AssignRoleDto } from './dto/assign-role.dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller('users')
export class UsersAdminController {
  constructor(private readonly userService: UserService) {}

  @Put(':id/roles')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Gán vai trò cho người dùng (Admin only)' })
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.userService.assignRole(id, dto.role);
  }
}
