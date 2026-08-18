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

/**
 * Criar e editar partilham o ecrã: os campos são os mesmos e um formulário
 * separado divergia ao primeiro ajuste. Com `profileId` nos parâmetros é
 * edição; sem ele, criação.
 */
export default function NovoMembroModal() {
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
      <View className="flex-1 bg-ink justify-center items-center px-6">
        <Text className="text-red-400 font-semibold text-center">
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
      className="flex-1 bg-ink"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-6">
          {editing ? 'Editar membro' : 'Novo membro'}
        </Text>

        <Text className="text-white/80 text-sm font-semibold mb-2">Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ex: Ana Sousa"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          maxLength={60}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white mb-4"
        />

        <Text className="text-white/80 text-sm font-semibold mb-2">Alcunha (opcional)</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="ex: Aninhas"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          maxLength={40}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white mb-6"
        />

        <Pressable
          onPress={handleSave}
          disabled={!isValid || pending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !pending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {pending ? (
            <ActivityIndicator color="rgba(0, 0, 0, 0.6)" />
          ) : (
            <Text className={`font-black text-center ${isValid ? 'text-black' : 'text-white/40'}`}>
              {editing ? 'Guardar alterações' : 'Criar membro'}
            </Text>
          )}
        </Pressable>

        {error && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
