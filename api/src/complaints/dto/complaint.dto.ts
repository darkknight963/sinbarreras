import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import type { ComplaintStatus, ComplaintType } from '../entities/complaint.entity';

export class CreateComplaintDto {
  @IsString()
  @Length(3, 160)
  fullName!: string;

  @IsString()
  @Length(6, 40)
  document!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @Length(6, 40)
  phone!: string;

  @IsIn(['reclamo', 'queja'])
  type!: ComplaintType;

  @IsString()
  @Length(3, 180)
  service!: string;

  @IsString()
  @Length(10, 4000)
  detail!: string;

  @IsString()
  @Length(5, 2500)
  request!: string;
}

export class UpdateComplaintStatusDto {
  @IsIn(['open', 'in_review', 'resolved', 'closed'])
  status!: ComplaintStatus;
}
