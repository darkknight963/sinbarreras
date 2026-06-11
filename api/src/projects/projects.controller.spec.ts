import { ForbiddenException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';

describe('ProjectsController', () => {
  const projectsService = {
    create: jest.fn(async () => ({ id: 'project-1' })),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects project creation for a free user', async () => {
    const controller = new ProjectsController(projectsService);

    expect(() =>
      controller.create(
        'Proyecto',
        '',
        4,
        'Sector privado',
        { id: 'user-1', role: 'free', billingStatus: 'inactive', billingPlan: null },
        { authMode: 'session' },
      ),
    ).toThrow(ForbiddenException);
    expect(projectsService.create).not.toHaveBeenCalled();
  });

  it('allows project creation after the subscription becomes active', async () => {
    const controller = new ProjectsController(projectsService);

    await expect(
      controller.create(
        'Proyecto',
        '',
        4,
        'Sector privado',
        { id: 'user-1', role: 'free', billingStatus: 'active', billingPlan: 'monthly' },
        { authMode: 'session' },
      ),
    ).resolves.toEqual({ id: 'project-1' });
  });

  it.each([
    ['pending', 'monthly'],
    ['past_due', 'monthly'],
    ['canceled', 'monthly'],
    ['active', null],
  ])('rejects project creation when billing is %s with plan %s', (billingStatus, billingPlan) => {
    const controller = new ProjectsController(projectsService);

    expect(() =>
      controller.create(
        'Proyecto',
        '',
        4,
        'Sector privado',
        { id: 'user-1', role: 'free', billingStatus, billingPlan },
        { authMode: 'session' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows administrators regardless of billing state', async () => {
    const controller = new ProjectsController(projectsService);

    await expect(
      controller.create(
        'Proyecto',
        '',
        4,
        'Sector privado',
        { id: 'admin-1', role: 'admin', billingStatus: 'inactive', billingPlan: null },
        { authMode: 'session' },
      ),
    ).resolves.toEqual({ id: 'project-1' });
  });
});
