import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useAllSessions } from '../../src/hooks/useSession';
import { usePhotosByGroup } from '../../src/hooks/usePhotos';
import { usePhotoUrls } from '../../src/hooks/usePhotoUrls';
import { PhotoGallery } from '../../src/components/mobile/PhotoGallery';
import type { Photo } from '../../src/types';

/** dd/mm/aaaa à mão: o formato tem de sair igual em qualquer telemóvel. */
function dataCurta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function MemoriasScreen() {
  const router = useRouter();
  const { grant } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: photos = [], isLoading } = usePhotosByGroup(groupId);
  const { data: allSessions = [] } = useAllSessions(groupId);
  const { data: urls } = usePhotoUrls(photos);

  // As fotos pertencem à noite em que foram tiradas: "Aniversário" ou "Sexta-
  // feira" são memórias desse dia, não uma pilha única do grupo. Fotos sem
  // noite (carregadas daqui) ficam numa secção própria no fim.
  const sections = useMemo(() => {
    const bySession = new Map<string, Photo[]>();
    const semNoite: Photo[] = [];

    for (const photo of photos) {
      if (photo.session_id) {
        const list = bySession.get(photo.session_id) ?? [];
        list.push(photo);
        bySession.set(photo.session_id, list);
      } else {
        semNoite.push(photo);
      }
    }

    const noites = allSessions
      .filter((s) => bySession.has(s.id))
      .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
      .map((s) => ({
        key: s.id,
        title: s.name,
        date: dataCurta(s.started_at),
        photos: bySession.get(s.id)!,
      }));

    // Fotos de noites que já não aparecem na lista não podem desaparecer.
    const conhecidas = new Set(allSessions.map((s) => s.id));
    for (const [sessionId, list] of bySession) {
      if (!conhecidas.has(sessionId)) semNoite.push(...list);
    }

    return { noites, semNoite };
  }, [photos, allSessions]);

  const handleUploadPhoto = () => {
    router.push('/modals/carregar-foto');
  };

  const openPhoto = (photo: Photo) =>
    router.push({ pathname: '/modals/foto', params: { photoId: photo.id } });

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
          className="bg-brand rounded-2xl px-6 py-4 items-center"
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
          <>
            {sections.noites.map((section) => (
              <View key={section.key} className="mb-6">
                <View className="flex-row items-baseline justify-between mb-3">
                  <Text className="text-white font-bold text-base">{section.title}</Text>
                  <Text className="text-white/40 text-xs">{section.date}</Text>
                </View>
                <PhotoGallery
                  photos={section.photos}
                  urls={urls}
                  numColumns={3}
                  onPhotoPress={openPhoto}
                />
              </View>
            ))}

            {sections.semNoite.length > 0 && (
              <View className="mb-6">
                <Text className="text-white font-bold text-base mb-3">Do grupo</Text>
                <PhotoGallery
                  photos={sections.semNoite}
                  urls={urls}
                  numColumns={3}
                  onPhotoPress={openPhoto}
                />
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
