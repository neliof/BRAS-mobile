import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GROUP_CODE_KEY = 'bras.group_code';
const PROFILE_KEY = 'bras.current_profile_id';

/**
 * O código do grupo é a única credencial da app. Vai para o armazenamento
 * seguro do sistema (Keychain no iOS, Keystore no Android), nunca para
 * AsyncStorage, que é legível em qualquer dispositivo com acesso root.
 */
export async function saveGroupCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(GROUP_CODE_KEY, code);
}

export async function readGroupCode(): Promise<string | null> {
  return SecureStore.getItemAsync(GROUP_CODE_KEY);
}

export async function clearGroupCode(): Promise<void> {
  await SecureStore.deleteItemAsync(GROUP_CODE_KEY);
}

/** O perfil escolhido não é segredo: é só uma preferência da interface. */
export async function saveCurrentProfileId(id: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, id);
}

export async function readCurrentProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(PROFILE_KEY);
}
