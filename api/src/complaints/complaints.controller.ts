import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AdminGuard } from '../auth/admin.guard';
import { RateLimit } from '../security/rate-limit.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Public()
  @RateLimit({ scope: 'complaint', limit: 4, windowMs: 60 * 60 * 1000 })
  @Post()
  create(@Body() dto: CreateComplaintDto) {
    return this.complaintsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return this.complaintsService.list(page, pageSize);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/status')
  updateStatus(@CurrentUser() user: { id: string; email: string }, @Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.complaintsService.updateStatus(user, id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  delete(@CurrentUser() user: { id: string; email: string }, @Param('id') id: string) {
    return this.complaintsService.delete(user, id);
  }
}
