import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UrlResult } from './entities/url-result.entity';

@Injectable()
export class UrlResultsService {
  constructor(
    @InjectRepository(UrlResult)
    private readonly urlResultRepository: Repository<UrlResult>,
  ) {}

  async findOne(id: string): Promise<UrlResult | null> {
    return this.urlResultRepository.findOne({ where: { id }, relations: { scan: true } });
  }

  async updateManualVerification(
    resultId: string,
    verificationId: string,
    status: string,
  ): Promise<UrlResult> {
    const result = await this.urlResultRepository.findOne({ where: { id: resultId } });
    if (!result) throw new Error('URL result not found');

    const verifications = result.manualVerifications || [];
    const updatedVerifications = verifications.map((v: any) => {
      if (v.id === verificationId) {
        return { ...v, status };
      }
      return v;
    });

    result.manualVerifications = updatedVerifications;

    return this.urlResultRepository.save(result);
  }
}
