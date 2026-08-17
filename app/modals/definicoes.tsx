import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../src/state/SessionContext';

export default function DefinicoesModal() {
  const router = useRouter();
  const { profile, isAdmin, signOut } = useSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = () => {
    Alert.alert(
      'Sair do grupo',
      'O código do grupo é apagado deste telemóvel. Para voltar a entrar tens de o introduzir outra vez.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await signOut();
              // O cache guarda noites, dívidas e fotos do grupo de onde se
              // saiu; sem o limpar, o próximo código a entrar via-os.
              queryClient.clear();
              // `replace` e não `back`: sem vínculo não há ecrã de grupo para
              // onde voltar.
              router.replace('/(gate)/codigo');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Não foi possível sair.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-6">Definições</Text>

        <View className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-6">
          <Text className="text-white/60 text-xs mb-1">Perfil atual</Text>
          <Text className="text-white font-bold text-lg">{profile?.name ?? 'Sem perfil'}</Text>
          <Text className="text-white/60 text-xs mt-2">
            {isAdmin ? 'Administrador do grupo' : 'Membro do grupo'}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/(gate)/perfil')}
          className="bg-white/10 rounded-2xl px-6 py-4 items-center border border-white/20 mb-2"
        >
          <Text className="text-white font-black text-center">Trocar perfil</Text>
        </Pressable>

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/modals/novo-membro')}
            className="bg-white/10 rounded-2xl px-6 py-4 items-center border border-white/20 mb-2"
          >
            <Text className="text-white font-black text-center">Adicionar membro</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleSignOut}
          disabled={busy}
          className="rounded-2xl px-6 py-4 items-center border border-red-500/40 bg-red-500/10 mt-4"
        >
          {busy ? (
            <ActivityIndicator color="#FCA5A5" />
          ) : (
            <Text className="text-red-300 font-black">Sair do grupo</Text>
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
