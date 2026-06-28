import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from './entities/complaint.entity';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { AdminService } from '../admin/admin.service';

type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,
    private readonly adminService: AdminService,
  ) {}

  async create(dto: CreateComplaintDto) {
    const complaint = this.complaintRepository.create({
      fullName: dto.fullName.trim(),
      document: dto.document.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone.trim(),
      type: dto.type,
      service: dto.service.trim(),
      detail: dto.detail.trim(),
      request: dto.request.trim(),
      status: 'open',
    });

    const savedComplaint = await this.complaintRepository.save(complaint);
    return this.serializeComplaint(savedComplaint);
  }

  private normalizePagination(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.trunc(pageSize))) : 10;

    return {
      page: safePage,
      pageSize: safePageSize,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    };
  }

  async list(page = 1, pageSize = 10): Promise<PaginatedResult<ReturnType<ComplaintsService['serializeComplaint']>>> {
    const pagination = this.normalizePagination(page, pageSize);
    const [complaints, total] = await this.complaintRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return {
      items: complaints.map((complaint) => this.serializeComplaint(complaint)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
  }

  async updateStatus(actor: { id: string; email: string }, id: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.complaintRepository.findOne({ where: { id } });
    if (!complaint) {
      throw new NotFoundException('Reclamo no encontrado');
    }

    complaint.status = dto.status;
    const saved = await this.complaintRepository.save(complaint);
    await this.adminService.writeAudit(actor, 'complaint.status_update', 'complaint', saved.id, {
      status: saved.status,
    });

    return this.serializeComplaint(saved);
  }

  async delete(actor: { id: string; email: string }, id: string) {
    const complaint = await this.complaintRepository.findOne({ where: { id } });
    if (!complaint) {
      throw new NotFoundException('Reclamo no encontrado');
    }

    await this.complaintRepository.remove(complaint);
    await this.adminService.writeAudit(actor, 'complaint.delete', 'complaint', id, {
      email: complaint.email,
      type: complaint.type,
      status: complaint.status,
    });

    return { ok: true };
  }

  private serializeComplaint(complaint: Complaint) {
    return {
      id: complaint.id,
      fullName: complaint.fullName,
      document: complaint.document,
      email: complaint.email,
      phone: complaint.phone,
      type: complaint.type,
      service: complaint.service,
      detail: complaint.detail,
      request: complaint.request,
      status: complaint.status,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    };
  }
}
