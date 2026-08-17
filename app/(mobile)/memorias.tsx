import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSession } from '../../src/state/SessionContext';
import { usePhotosByGroup } from '../../src/hooks/usePhotos';
import { PhotoGallery } from '../../src/components/mobile/PhotoGallery';

export default function MemoriasScreen() {
  const { grant } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: photos = [], isLoading } = usePhotosByGroup(groupId);

  const handleUploadPhoto = () => {
    // Task 15: Implementar upload de fotos
    // router.push('/(mobile)/modais/upload-foto');
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-1">Memórias</Text>
        <Text className="text-white/60 text-sm">
          {photos.length} fotos no grupo
        </Text>
      </View>

      <View className="px-4 mb-6">
        <Pressable
          onPress={handleUploadPhoto}
          className="bg-brand rounded-2xl px-6 py-4 items-center mb-4"
        >
          <Text className="text-black font-black text-center">Carregar foto</Text>
        </Pressable>
      </View>

      <View className="px-4 pb-8">
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <Text className="text-white/60">A carregar fotos...</Text>
          </View>
        ) : photos.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-white/60 text-center">
              Nenhuma foto no grupo ainda
            </Text>
          </View>
        ) : (
          <PhotoGallery photos={photos} numColumns={2} />
        )}
      </View>
    </ScrollView>
  );
}
