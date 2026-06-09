import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import type { ComplaintStatus, ComplaintType } from '../entities/complaint.entity';

export class CreateComplaintDto {
  @IsString()
  @Length(3, 160, { message: 'El nombre completo debe tener entre 3 y 160 caracteres' })
  fullName!: string;

  @IsString()
  @Length(6, 40, { message: 'El documento debe tener entre 6 y 40 caracteres' })
  document!: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(320, { message: 'El correo electrónico no puede superar 320 caracteres' })
  email!: string;

  @IsString()
  @Length(6, 40, { message: 'El teléfono debe tener entre 6 y 40 caracteres' })
  phone!: string;

  @IsIn(['reclamo', 'queja'], { message: 'El tipo debe ser reclamo o queja' })
  type!: ComplaintType;

  @IsString()
  @Length(3, 180, { message: 'El servicio debe tener entre 3 y 180 caracteres' })
  service!: string;

  @IsString()
  @Length(10, 4000, { message: 'El detalle debe tener al menos 10 caracteres' })
  detail!: string;

  @IsString()
  @Length(5, 2500, { message: 'El pedido debe tener al menos 5 caracteres' })
  request!: string;
}

export class UpdateComplaintStatusDto {
  @IsIn(['open', 'in_review', 'resolved', 'closed'], { message: 'El estado debe ser open, in_review, resolved o closed' })
  status!: ComplaintStatus;
}
