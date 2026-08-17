import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useUploadPhoto } from '../../src/hooks/usePhotos';
import { uploadPhotoImage } from '../../src/api/media';

interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

export default function CarregarFotoModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId;
  const { grant, profile } = useSession();
  const uploadMutation = useUploadPhoto();

  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = grant?.groupId ?? '';

  function keep(result: ImagePicker.ImagePickerResult): void {
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      setError('Não foi possível ler a imagem escolhida.');
      return;
    }

    setError(null);
    setPicked({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  }

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Sem acesso à galeria. Autoriza nas definições do telemóvel.');
      return;
    }

    keep(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // A imagem viaja em base64: sem compressão, uma foto de telemóvel são
        // vários megabytes a passar pela rede do bar.
        quality: 0.7,
        base64: true,
      }),
    );
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Sem acesso à câmara. Autoriza nas definições do telemóvel.');
      return;
    }

    keep(
      await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      }),
    );
  };

  const handleUpload = async () => {
    if (!picked || !groupId || !profile) return;

    setIsSending(true);
    setError(null);

    try {
      // Duas escritas: o ficheiro para o bucket, a linha para `photos`. Se a
      // segunda falhar fica um objeto órfão no storage — invisível na app e
      // apagável pelo administrador. Preferível ao contrário, uma linha a
      // apontar para um ficheiro que não existe.
      const path = await uploadPhotoImage({
        groupId,
        sessionId,
        base64: picked.base64,
        mimeType: picked.mimeType,
      });

      await uploadMutation.mutateAsync({
        groupId,
        sessionId,
        uploadedBy: profile.id,
        imageUrl: path,
        caption: caption.trim() || undefined,
      });

      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falhou o carregamento da foto.');
    } finally {
      setIsSending(false);
    }
  };

  if (!groupId || !profile) {
    return (
      <View className="flex-1 bg-ink justify-center items-center px-6">
        <Text className="text-red-400 font-semibold text-center">
          Escolhe um perfil antes de carregar fotos.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-6">Carregar foto</Text>

        {picked ? (
          <Image
            source={{ uri: picked.uri }}
            className="w-full aspect-square rounded-2xl mb-4"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full aspect-square rounded-2xl bg-white/5 border border-white/20 items-center justify-center mb-4">
            <Text className="text-white/40 text-sm">Nenhuma foto escolhida</Text>
          </View>
        )}

        <View className="flex-row gap-3 mb-6">
          <Pressable
            onPress={handleTakePhoto}
            disabled={isSending}
            className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-4 items-center"
          >
            <Text className="text-white font-semibold">Tirar foto</Text>
          </Pressable>
          <Pressable
            onPress={handlePickFromLibrary}
            disabled={isSending}
            className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-4 items-center"
          >
            <Text className="text-white font-semibold">Galeria</Text>
          </Pressable>
        </View>

        <Text className="text-white/80 text-sm font-semibold mb-2">Legenda</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Opcional"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          maxLength={140}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white mb-6"
        />

        <Pressable
          onPress={handleUpload}
          disabled={!picked || isSending}
          className={`rounded-2xl px-6 py-4 items-center ${
            picked && !isSending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {isSending ? (
            <ActivityIndicator color="rgba(255, 255, 255, 0.6)" />
          ) : (
            <Text
              className={`font-black text-center ${picked ? 'text-black' : 'text-white/40'}`}
            >
              Publicar
            </Text>
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
