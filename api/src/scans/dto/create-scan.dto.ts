import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateScanDto {
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
  @Max(5)
  ux!: number;

  @IsOptional()
  @IsEmpty({ message: 'preNavigationScript is disabled for security reasons' })
  preNavigationScript?: never;
}
