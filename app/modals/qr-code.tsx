import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
          Código de acesso
        </Text>
        <Text className="text-white/60 text-center">
          Partilha este código com os amigos para entrarem na noite
        </Text>
      </View>

      {/* QR Code mockup (será integrado com react-native-qrcode-svg) */}
      <View className="bg-white rounded-3xl p-4 mb-8 w-80 h-80 justify-center items-center">
        <View className="w-64 h-64 bg-white/10 rounded-2xl justify-center items-center border-4 border-white/20">
          <Text className="text-white/40 text-center text-xl">
            QR Code{'\n'}(implementar com react-native-qrcode-svg)
          </Text>
        </View>
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
