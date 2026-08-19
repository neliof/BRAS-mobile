import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVenues } from '../../src/hooks/useCatalog';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import { useCreateSession } from '../../src/hooks/useSession';
import { useSession } from '../../src/state/SessionContext';
import { useTheme } from '../../src/theme/ThemeContext';
import { withAlpha } from '../../src/theme/tokens';

/** Índice de `Date.getDay()`. Manual em vez de `Intl`: o nome tem de sair
    igual em qualquer telemóvel, com ou sem dados de localização. */
const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export default function IniciarNoiteModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const { grant, profile, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';
  const createSessionMutation = useCreateSession();
  const { data: venues = [], isLoading: venuesLoading } = useVenues();
  const { data: members = [], isLoading: membersLoading } = useGroupProfiles(groupId);

  // A maioria das noites chama-se pelo dia. Vem preenchido e edita-se à vontade.
  const [sessionName, setSessionName] = useState(() => WEEKDAYS[new Date().getDay()]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    profile ? new Set([profile.id]) : new Set(),
  );

  if (!grant || !profile) {
    return (
      <View className="flex-1 bg-canvas p-4 justify-center">
        <Text className="text-fg">Acesso não autorizado</Text>
      </View>
    );
  }

  const handleToggleMember = (memberId: string) => {
    const nextSelection = new Set(selectedMembers);
    if (nextSelection.has(memberId)) {
      nextSelection.delete(memberId);
    } else {
      nextSelection.add(memberId);
    }
    setSelectedMembers(nextSelection);
  };

  const handleSubmit = async () => {
    if (!sessionName.trim() || !selectedVenueId || selectedMembers.size === 0) {
      return;
    }

    try {
      const session = await createSessionMutation.mutateAsync({
        groupId: grant.groupId,
        venueId: selectedVenueId,
        name: sessionName.trim(),
        createdBy: profile.id,
        memberIds: Array.from(selectedMembers),
      });

      router.replace({
        pathname: '/(mobile)/noite',
        params: { sessionId: session.id },
      });
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
    }
  };

  const isValid = Boolean(sessionName.trim() && selectedVenueId && selectedMembers.size > 0);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View className="px-4 py-6">
        <Text className="text-fg text-2xl font-black mb-6">Iniciar noite</Text>

        <View className="mb-6">
          <Text className="text-fg/80 text-sm font-semibold mb-2">Nome da noite</Text>
          <TextInput
            className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-3 text-fg"
            placeholderTextColor={withAlpha(theme.colors.fg, 0.4)}
            placeholder="ex: Sexta no Brás"
            value={sessionName}
            onChangeText={setSessionName}
          />
        </View>

        <View className="mb-6">
          <Text className="text-fg/80 text-sm font-semibold mb-2">Bar</Text>
          {venuesLoading ? (
            <ActivityIndicator color={theme.colors.brand} />
          ) : (
            <FlatList
              data={venues}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View>
                  <Text className="text-fg/60 text-sm mb-2">
                    Ainda não há bares configurados.
                  </Text>
                  {isAdmin && (
                    <Pressable
                      onPress={() => router.push('/modals/catalogo')}
                      className="bg-fg/10 rounded-2xl px-4 py-3 border border-fg/20 self-start"
                    >
                      <Text className="text-fg font-semibold text-xs">Criar um bar</Text>
                    </Pressable>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedVenueId(item.id)}
                  className={`rounded-2xl px-4 py-3 mb-2 border ${
                    selectedVenueId === item.id
                      ? 'bg-brand/20 border-brand'
                      : 'bg-fg/10 border-fg/20'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      selectedVenueId === item.id ? 'text-brand' : 'text-fg'
                    }`}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <View className="mb-6">
          <Text className="text-fg/80 text-sm font-semibold mb-2">
            Membros presentes ({selectedMembers.size})
          </Text>
          {membersLoading ? (
            <ActivityIndicator color={theme.colors.brand} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text className="text-fg/60 text-sm">
                  Ainda não há membros neste grupo.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleToggleMember(item.id)}
                  className={`flex-row items-center rounded-2xl px-4 py-3 mb-2 border ${
                    selectedMembers.has(item.id)
                      ? 'bg-brand/20 border-brand'
                      : 'bg-fg/10 border-fg/20'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 ${
                      selectedMembers.has(item.id)
                        ? 'bg-brand border-brand'
                        : 'border-fg/40'
                    }`}
                  />
                  <Text
                    className={`font-semibold ${
                      selectedMembers.has(item.id) ? 'text-brand' : 'text-fg'
                    }`}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || createSessionMutation.isPending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !createSessionMutation.isPending ? 'bg-brand' : 'bg-fg/10'
          }`}
        >
          {createSessionMutation.isPending ? (
            <ActivityIndicator color={withAlpha(theme.colors.onBrand, 0.6)} />
          ) : (
            <Text
              className={`font-black text-center ${
                isValid ? 'text-on-brand' : 'text-fg/40'
              }`}
            >
              Iniciar
            </Text>
          )}
        </Pressable>

        {createSessionMutation.isError && (
          <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-danger text-sm">
              Erro ao criar sessão. Tenta novamente.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
