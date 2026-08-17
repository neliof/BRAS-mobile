import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useSessionDetails } from '../../src/hooks/useSession';
import * as Clipboard from 'expo-clipboard';

export default function QRCodeModal() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId;
  const { data: session, isLoading } = useSessionDetails(sessionId || '');

  if (!sessionId) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <Text className="text-red-400 font-semibold">Erro: Sessão inválida</Text>
      </View>
    );
  }

  const handleCopyCode = async () => {
    if (session?.code) {
      await Clipboard.setStringAsync(session.code);
      Alert.alert('Copiado!', `Código "${session.code}" copiado para a área de transferência.`);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <Text className="text-white">A carregar...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <Text className="text-white">Sessão não encontrada</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink px-4 py-6 justify-center items-center">
      {/* Header */}
      <View className="mb-8">
        <Text className="text-white text-2xl font-black text-center mb-2">
          Código da noite
        </Text>
        <Text className="text-white/60 text-center">
          Identifica esta noite. Para entrar na app é preciso o código do grupo.
        </Text>
      </View>

      {/* Fundo branco obrigatório: leitores precisam de contraste alto. */}
      <View className="bg-white rounded-3xl p-6 mb-8 justify-center items-center">
        <QRCode value={session.code} size={256} backgroundColor="#FFFFFF" color="#12161F" />
      </View>

      {/* Code display */}
      <View className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 mb-8 w-full">
        <Text className="text-white/60 text-xs font-semibold mb-2 text-center">
          CÓDIGO
        </Text>
        <Text className="text-brand text-3xl font-black text-center">
          {session.code}
        </Text>
      </View>

      {/* Copy button */}
      <Pressable
        onPress={handleCopyCode}
        className="bg-brand rounded-2xl px-8 py-4 w-full items-center mb-4"
      >
        <Text className="text-black font-black text-center">
          Copiar código
        </Text>
      </Pressable>

      {/* Info */}
      <View className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 w-full">
        <Text className="text-white/60 text-xs text-center">
          Noite: {session.name}
        </Text>
      </View>
    </View>
  );
}
