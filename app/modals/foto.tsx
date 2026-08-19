import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import {
  usePhotosByGroup,
  useAddTagToPhoto,
  useRemoveTagFromPhoto,
  useUpdatePhotoCaption,
  useDeletePhoto,
} from '../../src/hooks/usePhotos';
import { usePhotoUrls } from '../../src/hooks/usePhotoUrls';
import { useTheme } from '../../src/theme/ThemeContext';
import { withAlpha } from '../../src/theme/tokens';

export default function FotoModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ photoId?: string }>();
  const photoId = params?.photoId;
  const { grant, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: photos = [], isLoading } = usePhotosByGroup(groupId);
  const photo = photos.find((item) => item.id === photoId);

  const { data: urls } = usePhotoUrls(photo ? [photo] : []);
  const { data: members = [] } = useGroupProfiles(groupId);

  const addTag = useAddTagToPhoto();
  const removeTag = useRemoveTagFromPhoto();
  const updateCaption = useUpdatePhotoCaption();
  const deletePhoto = useDeletePhoto();

  const [caption, setCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center">
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!photo) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center px-6">
        <Text className="text-danger font-semibold text-center">
          Esta foto já não existe.
        </Text>
      </View>
    );
  }

  const tagged = photo.tagged_member_ids ?? [];
  // `caption` fica a null enquanto ninguém escrever, para o campo seguir a
  // legenda que vier do servidor em vez de a congelar no primeiro render.
  const captionValue = caption ?? photo.caption ?? '';
  const captionChanged = captionValue.trim() !== (photo.caption ?? '').trim();

  const handleToggleTag = async (memberId: string) => {
    setError(null);
    try {
      if (tagged.includes(memberId)) {
        await removeTag.mutateAsync({ photoId: photo.id, memberId });
      } else {
        await addTag.mutateAsync({ photoId: photo.id, memberId });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível marcar a pessoa.');
    }
  };

  const handleSaveCaption = async () => {
    setError(null);
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: captionValue.trim() });
      setCaption(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível guardar a legenda.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Apagar foto', 'A foto e o ficheiro são apagados para sempre.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await deletePhoto.mutateAsync({ photoId: photo.id, imagePath: photo.image_url });
            router.back();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível apagar a foto.');
          }
        },
      },
    ]);
  };

  const uri = urls?.[photo.image_url];

  return (
    <ScrollView className="flex-1 bg-canvas">
      <View className="px-4 py-6">
        <Text className="text-fg text-2xl font-black mb-6">Foto</Text>

        <View className="w-full aspect-square rounded-2xl bg-fg/5 border border-fg/20 overflow-hidden mb-6">
          {uri ? (
            <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={theme.colors.brand} />
            </View>
          )}
        </View>

        <Text className="text-fg/80 text-sm font-semibold mb-2">Legenda</Text>
        <TextInput
          value={captionValue}
          onChangeText={setCaption}
          placeholder="Sem legenda"
          placeholderTextColor={withAlpha(theme.colors.fg, 0.4)}
          maxLength={140}
          className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-4 text-fg mb-3"
        />
        {captionChanged && (
          <Pressable
            onPress={handleSaveCaption}
            disabled={updateCaption.isPending}
            className="bg-brand rounded-2xl px-6 py-3 items-center mb-6"
          >
            {updateCaption.isPending ? (
              <ActivityIndicator color="rgba(0, 0, 0, 0.6)" />
            ) : (
              <Text className="text-on-brand font-black">Guardar legenda</Text>
            )}
          </Pressable>
        )}

        <Text className="text-fg/80 text-sm font-semibold mb-3 mt-3">Quem está na foto</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {members.map((member) => {
            const isTagged = tagged.includes(member.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => handleToggleTag(member.id)}
                disabled={addTag.isPending || removeTag.isPending}
                className={`rounded-full px-4 py-2 border ${
                  isTagged ? 'bg-brand/20 border-brand' : 'bg-fg/10 border-fg/20'
                }`}
              >
                <Text className={`font-semibold ${isTagged ? 'text-brand' : 'text-fg'}`}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
          {members.length === 0 && (
            <Text className="text-fg/60 text-sm">Nenhum membro no grupo.</Text>
          )}
        </View>

        {isAdmin && (
          <Pressable
            onPress={handleDelete}
            disabled={deletePhoto.isPending}
            className="rounded-2xl px-6 py-4 items-center border border-danger/40 bg-danger/10"
          >
            {deletePhoto.isPending ? (
              <ActivityIndicator color={theme.colors.danger} />
            ) : (
              <Text className="text-danger font-black">Apagar foto</Text>
            )}
          </Pressable>
        )}

        {error && (
          <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
