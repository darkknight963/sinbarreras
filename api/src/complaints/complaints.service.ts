import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from './entities/complaint.entity';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { AdminService } from '../admin/admin.service';

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

  async list() {
    const complaints = await this.complaintRepository.find({
      order: { createdAt: 'DESC' },
    });

    return complaints.map((complaint) => this.serializeComplaint(complaint));
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
