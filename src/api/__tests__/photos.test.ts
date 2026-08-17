import { deletePhoto, uploadPhoto } from '../photos';
import { removePhotoImage } from '../media';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../media', () => ({ removePhotoImage: jest.fn(() => Promise.resolve()) }));

const from = supabase.from as unknown as jest.Mock;
const removeImage = removePhotoImage as jest.Mock;

interface InsertChain {
  insert: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
}

function mockInsert(result: { data: unknown; error: unknown }) {
  const chain: InsertChain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
  };
  from.mockReturnValue(chain);
  return chain;
}

interface DeleteChain {
  delete: jest.Mock;
  eq: jest.Mock;
}

function mockDelete(result: { error: unknown }) {
  const chain: DeleteChain = {
    delete: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve(result)),
  };
  from.mockReturnValue(chain);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

describe('uploadPhoto', () => {
  it('recusa sem groupId, que é o que as políticas de photos leem', async () => {
    const chain = mockInsert({ data: null, error: null });

    await expect(
      uploadPhoto({ groupId: '', uploadedBy: 'p1', imageUrl: 'g1/grupo/a.jpg' }),
    ).rejects.toThrow(/groupId/);

    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('guarda o caminho do objeto e a lista de marcados', async () => {
    const photo = { id: 'f1', group_id: 'g1', image_url: 'g1/grupo/a.jpg' };
    const chain = mockInsert({ data: photo, error: null });

    await expect(
      uploadPhoto({
        groupId: 'g1',
        sessionId: 's1',
        uploadedBy: 'p1',
        imageUrl: 'g1/s1/a.jpg',
        caption: 'A ronda das três',
      }),
    ).resolves.toEqual(photo);

    expect(from).toHaveBeenCalledWith('photos');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'g1',
        session_id: 's1',
        image_url: 'g1/s1/a.jpg',
        caption: 'A ronda das três',
        tagged_member_ids: [],
      }),
    );
  });
});

describe('deletePhoto', () => {
  it('apaga o ficheiro antes da linha', async () => {
    const chain = mockDelete({ error: null });
    const order: string[] = [];
    removeImage.mockImplementation(() => {
      order.push('ficheiro');
      return Promise.resolve();
    });
    chain.delete.mockImplementation(() => {
      order.push('linha');
      return chain;
    });

    await deletePhoto('f1', 'g1/s1/a.jpg');

    expect(removeImage).toHaveBeenCalledWith('g1/s1/a.jpg');
    expect(order).toEqual(['ficheiro', 'linha']);
  });

  it('não apaga a linha se o ficheiro não sair do bucket', async () => {
    const chain = mockDelete({ error: null });
    removeImage.mockRejectedValueOnce(new Error('sem permissão'));

    await expect(deletePhoto('f1', 'g1/s1/a.jpg')).rejects.toThrow('sem permissão');
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it('apaga só a linha quando não há caminho conhecido', async () => {
    const chain = mockDelete({ error: null });

    await deletePhoto('f1');

    expect(removeImage).not.toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'f1');
  });
});
