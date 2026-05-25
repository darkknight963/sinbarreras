import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UrlResult } from './entities/url-result.entity';
import { UrlResultsService } from './url-results.service';
import { UrlResultsController } from './url-results.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UrlResult])],
  providers: [UrlResultsService],
  controllers: [UrlResultsController],
  exports: [UrlResultsService],
})
export class UrlResultsModule {}
