import { UrlResultsService } from './url-results.service';

describe('UrlResultsService', () => {
  const queryChain = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const urlResultRepository = {
    createQueryBuilder: jest.fn(() => queryChain),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
  } as any;

  const scanRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restricts lookups to the current owner when provided', async () => {
    queryChain.getOne.mockResolvedValue({
      id: 'result-1',
      scan: { id: 'scan-1', project: { owner: { id: 'user-1' } } },
    });

    const service = new UrlResultsService(urlResultRepository, scanRepository);

    await expect(service.findOne('result-1', 'user-1')).resolves.toMatchObject({
      id: 'result-1',
    });

    expect(urlResultRepository.createQueryBuilder).toHaveBeenCalledWith('urlResult');
    expect(queryChain.andWhere).toHaveBeenCalledWith('owner.id = :ownerId', { ownerId: 'user-1' });
  });

  it('returns not found when the url result belongs to another owner', async () => {
    queryChain.getOne.mockResolvedValue(null);

    const service = new UrlResultsService(urlResultRepository, scanRepository);

    await expect(service.findOne('result-1', 'user-1')).resolves.toBeNull();
  });

  it('allows global lookup for superadmin scope without owner filter', async () => {
    queryChain.getOne.mockResolvedValue({
      id: 'result-1',
      scan: { id: 'scan-1', project: { owner: { id: 'user-2' } } },
    });

    const service = new UrlResultsService(urlResultRepository, scanRepository);

    await expect(service.findOne('result-1', null, true)).resolves.toMatchObject({
      id: 'result-1',
    });

    expect(queryChain.andWhere).not.toHaveBeenCalledWith('owner.id = :ownerId', expect.anything());
  });
});
