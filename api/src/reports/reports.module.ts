import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from '../scans/entities/scan.entity';
import { ReportsController } from './reports.controller';
import { ExcelService } from './excel.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [TypeOrmModule.forFeature([Scan])],
  controllers: [ReportsController],
  providers: [ExcelService, PdfService],
})
export class ReportsModule {}
