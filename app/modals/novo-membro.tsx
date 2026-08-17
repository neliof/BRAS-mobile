import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useCreateGroupProfile } from '../../src/hooks/useProfiles';

export default function NovoMembroModal() {
  const router = useRouter();
  const { grant, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';
  const createProfile = useCreateGroupProfile();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  // O RLS recusaria na mesma; o ecrã diz porquê em vez de deixar o erro sair da
  // base de dados.
  if (!isAdmin) {
    return (
      <View className="flex-1 bg-ink justify-center items-center px-6">
        <Text className="text-red-400 font-semibold text-center">
          Só um administrador do grupo pode adicionar membros.
        </Text>
      </View>
    );
  }

  const handleCreate = async () => {
    setError(null);

    try {
      await createProfile.mutateAsync({
        groupId,
        name,
        nickname: nickname.trim() || undefined,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o membro.');
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-6">Novo membro</Text>

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
          onPress={handleCreate}
          disabled={!isValid || createProfile.isPending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !createProfile.isPending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {createProfile.isPending ? (
            <ActivityIndicator color="rgba(0, 0, 0, 0.6)" />
          ) : (
            <Text className={`font-black text-center ${isValid ? 'text-black' : 'text-white/40'}`}>
              Criar membro
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
