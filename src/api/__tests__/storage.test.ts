import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveGroupCode, readGroupCode, clearGroupCode,
  saveCurrentProfileId, readCurrentProfileId,
} from '../storage';

jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => undefined),
}));

describe('armazenamento do código do grupo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('guarda o código no armazenamento seguro, nunca no comum', () => {
    return saveGroupCode('codigo-secreto-123').then(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'bras.group_code',
        'codigo-secreto-123',
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  it('lê o código guardado', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('abc');
    await expect(readGroupCode()).resolves.toBe('abc');
  });

  it('devolve null quando não há código', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(readGroupCode()).resolves.toBeNull();
  });

  it('apaga o código', async () => {
    await clearGroupCode();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('bras.group_code');
  });
});

describe('perfil escolhido', () => {
  beforeEach(() => jest.clearAllMocks());

  it('guarda no armazenamento comum, por não ser um segredo', async () => {
    await saveCurrentProfileId('prof-joao');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'bras.current_profile_id',
      'prof-joao',
    );
  });

  it('lê o perfil guardado', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('prof-joao');
    await expect(readCurrentProfileId()).resolves.toBe('prof-joao');
  });
});
