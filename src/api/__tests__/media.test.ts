import { encode } from 'base64-arraybuffer';
import { MEDIA_BUCKET, signedPhotoUrls, uploadPhotoImage } from '../media';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const storageFrom = supabase.storage.from as unknown as jest.Mock;

interface StorageChain {
  upload: jest.Mock;
  createSignedUrls: jest.Mock;
}

function mockStorage(overrides: Partial<StorageChain> = {}) {
  const chain: StorageChain = {
    upload: jest.fn(() => Promise.resolve({ data: { path: 'ignorado' }, error: null })),
    createSignedUrls: jest.fn(() => Promise.resolve({ data: [], error: null })),
    ...overrides,
  };
  storageFrom.mockReturnValue(chain);
  return chain;
}

const base64 = encode(new Uint8Array([1, 2, 3]).buffer);

beforeEach(() => jest.clearAllMocks());

describe('uploadPhotoImage', () => {
  it('grava sob a pasta do grupo, que é o que as políticas de storage verificam', async () => {
    const chain = mockStorage();

    const path = await uploadPhotoImage({
      groupId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      base64,
      mimeType: 'image/jpeg',
    });

    expect(path).toMatch(
      /^11111111-1111-1111-1111-111111111111\/22222222-2222-2222-2222-222222222222\/[0-9]+-[a-z0-9]+\.jpg$/,
    );
    expect(storageFrom).toHaveBeenCalledWith(MEDIA_BUCKET);
    expect(chain.upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('usa a pasta "grupo" quando a foto não pertence a nenhuma noite', async () => {
    mockStorage();

    const path = await uploadPhotoImage({
      groupId: '11111111-1111-1111-1111-111111111111',
      base64,
      mimeType: 'image/png',
    });

    expect(path).toMatch(/^11111111-1111-1111-1111-111111111111\/grupo\/[0-9]+-[a-z0-9]+\.png$/);
  });

  it('recusa sem groupId em vez de deixar o RLS rejeitar o upload', async () => {
    const chain = mockStorage();

    await expect(
      uploadPhotoImage({ groupId: '', base64, mimeType: 'image/jpeg' }),
    ).rejects.toThrow(/groupId/);

    expect(chain.upload).not.toHaveBeenCalled();
  });

  it('propaga erros do Supabase', async () => {
    mockStorage({
      upload: jest.fn(() => Promise.resolve({ data: null, error: { message: 'sem espaço' } })),
    });

    await expect(
      uploadPhotoImage({ groupId: 'g1', base64, mimeType: 'image/jpeg' }),
    ).rejects.toThrow('sem espaço');
  });
});

describe('signedPhotoUrls', () => {
  it('assina os caminhos do bucket e devolve um mapa caminho → URL', async () => {
    const chain = mockStorage({
      createSignedUrls: jest.fn(() =>
        Promise.resolve({
          data: [
            { path: 'g1/s1/a.jpg', signedUrl: 'https://cdn/a?token=1', error: null },
            { path: 'g1/s1/b.jpg', signedUrl: 'https://cdn/b?token=2', error: null },
          ],
          error: null,
        }),
      ),
    });

    await expect(signedPhotoUrls(['g1/s1/a.jpg', 'g1/s1/b.jpg'])).resolves.toEqual({
      'g1/s1/a.jpg': 'https://cdn/a?token=1',
      'g1/s1/b.jpg': 'https://cdn/b?token=2',
    });

    expect(chain.createSignedUrls).toHaveBeenCalledWith(
      ['g1/s1/a.jpg', 'g1/s1/b.jpg'],
      expect.any(Number),
    );
  });

  it('deixa passar URLs absolutos sem os assinar', async () => {
    const chain = mockStorage();

    await expect(signedPhotoUrls(['https://exemplo/foto.jpg'])).resolves.toEqual({
      'https://exemplo/foto.jpg': 'https://exemplo/foto.jpg',
    });

    expect(chain.createSignedUrls).not.toHaveBeenCalled();
  });

  it('omite os caminhos que o Supabase não conseguiu assinar', async () => {
    mockStorage({
      createSignedUrls: jest.fn(() =>
        Promise.resolve({
          data: [
            { path: 'g1/s1/a.jpg', signedUrl: 'https://cdn/a?token=1', error: null },
            { path: 'g1/s1/apagada.jpg', signedUrl: null, error: 'Object not found' },
          ],
          error: null,
        }),
      ),
    });

    await expect(signedPhotoUrls(['g1/s1/a.jpg', 'g1/s1/apagada.jpg'])).resolves.toEqual({
      'g1/s1/a.jpg': 'https://cdn/a?token=1',
    });
  });

  it('pede cada caminho uma só vez', async () => {
    const chain = mockStorage({
      createSignedUrls: jest.fn(() =>
        Promise.resolve({
          data: [{ path: 'g1/s1/a.jpg', signedUrl: 'https://cdn/a?token=1', error: null }],
          error: null,
        }),
      ),
    });

    await signedPhotoUrls(['g1/s1/a.jpg', 'g1/s1/a.jpg', '']);

    expect(chain.createSignedUrls).toHaveBeenCalledWith(['g1/s1/a.jpg'], expect.any(Number));
  });
});
