import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateScanDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  projectId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  urls!: string[];

  @IsString()
  scanMode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  ux!: number;

  @IsOptional()
  @IsIn(['none', 'manual_assisted'])
  loginMode?: 'none' | 'manual_assisted';

  @IsOptional()
  @IsEmpty({ message: 'preNavigationScript is disabled for security reasons' })
  preNavigationScript?: never;
}
