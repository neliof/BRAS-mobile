import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useCreateSession } from '../../src/hooks/useSession';
import type { Venue, Profile } from '../../src/types';

// TODO: Substituir MOCK_VENUES e MOCK_MEMBERS por queries reais com hooks (Tasks 1-2)
// const MOCK_VENUES: Venue[] = [
//   { id: '1', name: 'Cervejaria Central', logo_url: '', created_at: new Date().toISOString() },
//   { id: '2', name: 'Pastel Bar', logo_url: '', created_at: new Date().toISOString() },
//   { id: '3', name: 'Taberna do Brás', logo_url: '', created_at: new Date().toISOString() },
// ];

// const MOCK_MEMBERS: Profile[] = [
//   {
//     id: '1',
//     name: 'João Silva',
//     avatar_url: '',
//     role: 'member',
//     active: true,
//     created_at: new Date().toISOString(),
//   },
//   {
//     id: '2',
//     name: 'Maria Santos',
//     avatar_url: '',
//     role: 'member',
//     active: true,
//     created_at: new Date().toISOString(),
//   },
//   {
//     id: '3',
//     name: 'Pedro Costa',
//     avatar_url: '',
//     role: 'member',
//     active: true,
//     created_at: new Date().toISOString(),
//   },
// ];

// Placeholders vazias até integração dos hooks reais
const MOCK_VENUES: Venue[] = [];
const MOCK_MEMBERS: Profile[] = [];

export default function IniciarNoiteModal() {
  const router = useRouter();
  const { grant, profile } = useSession();
  const createSessionMutation = useCreateSession();

  const [sessionName, setSessionName] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    profile ? new Set([profile.id]) : new Set()
  );

  const handleToggleMember = (memberId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const handleSubmit = async () => {
    if (!sessionName.trim() || !selectedVenueId || selectedMembers.size === 0 || !grant) {
      return;
    }

    try {
      await createSessionMutation.mutateAsync({
        groupId: grant.group_id,
        venueId: selectedVenueId,
        name: sessionName,
        memberIds: Array.from(selectedMembers),
      });

      // Navega para ecrã de noite ativa
      router.push('/(mobile)/noite');
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
    }
  };

  const isValid = sessionName.trim() && selectedVenueId && selectedMembers.size > 0;

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-white text-2xl font-black mb-6">Iniciar noite</Text>

        {/* Nome da noite */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-2">Nome da noite</Text>
          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            placeholder="ex: Sexta no Brás"
            value={sessionName}
            onChangeText={setSessionName}
          />
        </View>

        {/* Seleção de bar/venue */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-2">Bar/Venue</Text>
          <FlatList
            data={MOCK_VENUES}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedVenueId(item.id)}
                className={`rounded-2xl px-4 py-3 mb-2 border ${
                  selectedVenueId === item.id
                    ? 'bg-brand/20 border-brand'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    selectedVenueId === item.id ? 'text-brand' : 'text-white'
                  }`}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
            scrollEnabled={false}
          />
        </View>

        {/* Seleção de membros */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-2">
            Membros presentes ({selectedMembers.size})
          </Text>
          <FlatList
            data={MOCK_MEMBERS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleToggleMember(item.id)}
                className={`flex-row items-center rounded-2xl px-4 py-3 mb-2 border ${
                  selectedMembers.has(item.id)
                    ? 'bg-brand/20 border-brand'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 ${
                    selectedMembers.has(item.id)
                      ? 'bg-brand border-brand'
                      : 'border-white/40'
                  }`}
                />
                <Text
                  className={`font-semibold ${
                    selectedMembers.has(item.id) ? 'text-brand' : 'text-white'
                  }`}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
            scrollEnabled={false}
          />
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || createSessionMutation.isPending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !createSessionMutation.isPending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {createSessionMutation.isPending ? (
            <ActivityIndicator color="rgba(255, 255, 255, 0.6)" />
          ) : (
            <Text
              className={`font-black text-center ${
                isValid ? 'text-black' : 'text-white/40'
              }`}
            >
              Iniciar
            </Text>
          )}
        </Pressable>

        {/* Error message */}
        {createSessionMutation.isError && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">
              Erro ao criar sessão. Tenta novamente.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
