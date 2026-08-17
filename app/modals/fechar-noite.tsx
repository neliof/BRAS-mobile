import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useSessionDetails } from '../../src/hooks/useSession';
import { useUpdateSessionStatus } from '../../src/hooks/useSession';

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export default function FecharNoiteModal() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const { profile } = useSession();
  const { data: session, isLoading } = useSessionDetails(sessionId as string);
  const updateSessionMutation = useUpdateSessionStatus();

  const [rating, setRating] = useState<number | null>(null);
  const [quoteOfTheNight, setQuoteOfTheNight] = useState('');
  const [memoryNotes, setMemoryNotes] = useState('');

  const handleSubmit = async () => {
    if (!session || rating === null) {
      return;
    }

    try {
      await updateSessionMutation.mutateAsync({
        sessionId: session.id,
        status: 'closed',
        updates: {
          rating,
          quote_of_the_night: quoteOfTheNight || undefined,
          memory_notes: memoryNotes || undefined,
        },
      });

      // Navega para ecrã inicial
      router.push('/(mobile)');
    } catch (error) {
      console.error('Erro ao fechar noite:', error);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <ActivityIndicator color="#F27D26" />
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

  const isValid = rating !== null;

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-white text-2xl font-black mb-2">Fechar noite</Text>
        <Text className="text-white/60 text-sm mb-6">{session.name}</Text>

        {/* Rating */}
        <View className="mb-8">
          <Text className="text-white/80 text-sm font-semibold mb-4">Como correu a noite?</Text>
          <View className="flex-row justify-between gap-2">
            {RATING_OPTIONS.map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                className={`flex-1 rounded-2xl py-4 items-center border ${
                  rating === star ? 'bg-brand border-brand' : 'bg-white/10 border-white/20'
                }`}
              >
                <Text className="text-2xl mb-1">
                  {'⭐'.repeat(star)}
                </Text>
                <Text
                  className={`text-xs font-semibold ${
                    rating === star ? 'text-black' : 'text-white/60'
                  }`}
                >
                  {star}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quote of the night */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-2">
            Frase da noite (opcional)
          </Text>
          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            placeholder='ex: "Aqui se faz, aqui se paga"'
            value={quoteOfTheNight}
            onChangeText={setQuoteOfTheNight}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Memory notes */}
        <View className="mb-8">
          <Text className="text-white/80 text-sm font-semibold mb-2">
            Notas de memória (opcional)
          </Text>
          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            placeholder="ex: Momento mais engraçado da noite, anedota, etc."
            value={memoryNotes}
            onChangeText={setMemoryNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || updateSessionMutation.isPending}
          className={`rounded-2xl px-6 py-4 items-center mb-4 ${
            isValid && !updateSessionMutation.isPending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {updateSessionMutation.isPending ? (
            <ActivityIndicator color="rgba(255, 255, 255, 0.6)" />
          ) : (
            <Text
              className={`font-black text-center ${
                isValid ? 'text-black' : 'text-white/40'
              }`}
            >
              Fechar noite
            </Text>
          )}
        </Pressable>

        {/* Cancel button */}
        <Pressable
          onPress={() => router.back()}
          className="rounded-2xl px-6 py-4 items-center bg-white/10 border border-white/20"
        >
          <Text className="text-white font-semibold text-center">Cancelar</Text>
        </Pressable>

        {/* Error message */}
        {updateSessionMutation.isError && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">
              Erro ao fechar noite. Tenta novamente.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
