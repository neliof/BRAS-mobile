import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text,
  TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { redeemCode, AccessError } from '../../src/api/access';

export default function CodigoScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await redeemCode(code);
      router.replace('/(gate)/perfil');
    } catch (err) {
      setError(
        err instanceof AccessError
          ? err.message
          : 'Algo correu mal. Tenta outra vez.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-ink"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-brand text-3xl font-black mb-2">
          Brás Aquele Bar
        </Text>
        <Text className="text-white/60 mb-8">
          Introduz o código do grupo para entrar.
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Código do grupo"
          placeholderTextColor="#ffffff55"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!busy}
          className="bg-white/10 text-white rounded-2xl px-4 py-4 mb-4"
        />

        {error && <Text className="text-red-400 mb-4">{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy || code.trim().length < 8}
          className={`rounded-2xl py-4 items-center ${
            busy || code.trim().length < 8 ? 'bg-white/10' : 'bg-brand'
          }`}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-black font-black">Entrar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
