import { useQuery } from '@tanstack/react-query';
import { SIGNED_URL_TTL_SECONDS, signedPhotoUrls } from '../api/media';
import type { Photo } from '../types';

/**
 * Resolve os caminhos guardados em `photos.image_url` para URLs assinados.
 *
 * Os URLs expiram, logo a query tem de refrescar antes disso: cinco minutos de
 * margem chegam para uma galeria aberta há muito tempo não mostrar quadrados
 * vazios.
 */
export function usePhotoUrls(photos: Photo[]) {
  const paths = Array.from(
    new Set(photos.map((photo) => photo.image_url).filter(Boolean)),
  ).sort();

  return useQuery({
    queryKey: ['photo-urls', paths],
    queryFn: () => signedPhotoUrls(paths),
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    gcTime: SIGNED_URL_TTL_SECONDS * 1000,
  });
}
