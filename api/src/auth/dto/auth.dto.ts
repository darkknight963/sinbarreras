import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  companyName?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  // Opcional: las cuentas creadas vía OAuth no tienen contraseña propia todavía.
  // El servicio la exige cuando el usuario sí definió una (hasPassword).
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
