import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import {
  useCreateGroupProfile,
  useGroupProfiles,
  useUpdateGroupProfile,
} from '../../src/hooks/useProfiles';
import { useTheme } from '../../src/theme/ThemeContext';
import { withAlpha } from '../../src/theme/tokens';

/**
 * Criar e editar partilham o ecrã: os campos são os mesmos e um formulário
 * separado divergia ao primeiro ajuste. Com `profileId` nos parâmetros é
 * edição; sem ele, criação.
 */
export default function NovoMembroModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const { grant, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();

  const { data: profiles = [] } = useGroupProfiles(groupId);
  const editing = profileId ? profiles.find((p) => p.id === profileId) : undefined;

  const createProfile = useCreateGroupProfile();
  const updateProfile = useUpdateGroupProfile();

  const [name, setName] = useState(editing?.name ?? '');
  const [nickname, setNickname] = useState(editing?.nickname ?? '');
  const [error, setError] = useState<string | null>(null);

  // O RLS recusaria na mesma; o ecrã diz porquê em vez de deixar o erro sair da
  // base de dados.
  if (!isAdmin) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center px-6">
        <Text className="text-danger font-semibold text-center">
          Só um administrador do grupo pode gerir membros.
        </Text>
      </View>
    );
  }

  const pending = createProfile.isPending || updateProfile.isPending;

  const handleSave = async () => {
    setError(null);

    try {
      if (editing) {
        await updateProfile.mutateAsync({
          profileId: editing.id,
          groupId,
          name,
          nickname: nickname.trim() || undefined,
        });
      } else {
        await createProfile.mutateAsync({
          groupId,
          name,
          nickname: nickname.trim() || undefined,
        });
      }
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível guardar.');
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View className="px-4 py-6">
        <Text className="text-fg text-2xl font-black mb-6">
          {editing ? 'Editar membro' : 'Novo membro'}
        </Text>

        <Text className="text-fg/80 text-sm font-semibold mb-2">Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ex: Ana Sousa"
          placeholderTextColor={withAlpha(theme.colors.fg, 0.4)}
          maxLength={60}
          className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-4 text-fg mb-4"
        />

        <Text className="text-fg/80 text-sm font-semibold mb-2">Alcunha (opcional)</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="ex: Aninhas"
          placeholderTextColor={withAlpha(theme.colors.fg, 0.4)}
          maxLength={40}
          className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-4 text-fg mb-6"
        />

        <Pressable
          onPress={handleSave}
          disabled={!isValid || pending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !pending ? 'bg-brand' : 'bg-fg/10'
          }`}
        >
          {pending ? (
            <ActivityIndicator color="rgba(0, 0, 0, 0.6)" />
          ) : (
            <Text className={`font-black text-center ${isValid ? 'text-on-brand' : 'text-fg/40'}`}>
              {editing ? 'Guardar alterações' : 'Criar membro'}
            </Text>
          )}
        </Pressable>

        {error && (
          <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
