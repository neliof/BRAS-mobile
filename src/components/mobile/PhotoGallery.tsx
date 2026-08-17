import { View, Image, FlatList, Pressable } from 'react-native';
import type { Photo } from '../../types';

interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoPress?: (photo: Photo) => void;
  numColumns?: number;
}

interface PhotoItemProps {
  photo: Photo;
  onPress?: (photo: Photo) => void;
}

function PhotoItem({ photo, onPress }: PhotoItemProps): React.ReactElement {
  const handlePress = (): void => {
    if (onPress) {
      onPress(photo);
    }
  };

  return (
    <Pressable onPress={handlePress} className="flex-1 aspect-square m-1 bg-white/10 rounded-lg overflow-hidden">
      <Image
        source={{ uri: photo.image_url }}
        className="w-full h-full"
        resizeMode="cover"
      />
    </Pressable>
  );
}

export function PhotoGallery({
  photos,
  onPhotoPress,
  numColumns = 2,
}: PhotoGalleryProps): React.ReactElement {
  if (photos.length === 0) {
    return (
      <View className="bg-white/10 rounded-2xl p-4 border border-white/20 items-center justify-center py-8">
        {/* Empty state */}
      </View>
    );
  }

  return (
    <View className="flex-1 gap-1">
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={({ item }) => <PhotoItem photo={item} onPress={onPhotoPress} />}
        scrollEnabled={false}
      />
    </View>
  );
}
