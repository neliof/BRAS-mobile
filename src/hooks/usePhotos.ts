import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPhotos,
  fetchPhotosBySession,
  fetchPhotosByGroup,
  uploadPhoto,
  tagPhoto,
  updatePhotoCaption,
  deletePhoto,
  addTagToPhoto,
  removeTagFromPhoto,
} from '../api/photos';
import type { Photo } from '../types';

/**
 * Hook para obter fotos de uma sessão ou grupo.
 * Cache: 60 segundos (fotos não mudam frequentemente)
 */
export function usePhotos(sessionId?: string, groupId?: string) {
  return useQuery({
    queryKey: sessionId ? ['photos', 'session', sessionId] : ['photos', 'group', groupId],
    queryFn: () => fetchPhotos(sessionId, groupId),
    staleTime: 60 * 1000, // 60s
    enabled: !!(sessionId || groupId),
  });
}

/**
 * Hook para obter fotos de uma sessão específica.
 * Cache: 60 segundos
 */
export function usePhotosBySession(sessionId: string) {
  return useQuery({
    queryKey: ['photos', 'session', sessionId],
    queryFn: () => fetchPhotosBySession(sessionId),
    staleTime: 60 * 1000, // 60s
    enabled: !!sessionId,
  });
}

/**
 * Hook para obter fotos de um grupo.
 * Cache: 60 segundos
 */
export function usePhotosByGroup(groupId: string) {
  return useQuery({
    queryKey: ['photos', 'group', groupId],
    queryFn: () => fetchPhotosByGroup(groupId),
    staleTime: 60 * 1000, // 60s
    enabled: !!groupId,
  });
}

/**
 * Hook para upload de fotos.
 * Atualiza cache após fazer upload.
 */
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      groupId?: string;
      sessionId?: string;
      uploadedBy: string;
      imageUrl: string;
      caption?: string;
      taggedMemberIds?: string[];
    }) => uploadPhoto(data),

    onSuccess: (newPhoto) => {
      // Adiciona a nova foto à lista de fotos da sessão
      if (newPhoto.session_id) {
        queryClient.setQueryData(['photos', 'session', newPhoto.session_id], (old: Photo[] | undefined) => [
          newPhoto,
          ...(old || []),
        ]);
      }

      // Adiciona a nova foto à lista de fotos do grupo
      if (newPhoto.group_id) {
        queryClient.setQueryData(['photos', 'group', newPhoto.group_id], (old: Photo[] | undefined) => [
          newPhoto,
          ...(old || []),
        ]);
      }
    },
  });
}

/**
 * Hook para tagear uma foto com membros.
 * Atualiza cache após fazer tagging.
 */
export function useTagPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, memberIds }: { photoId: string; memberIds: string[] }) =>
      tagPhoto(photoId, memberIds),

    onSuccess: (taggedPhoto) => {
      // Invalida todos os queries de fotos para refetch
      queryClient.invalidateQueries({
        queryKey: ['photos'],
      });
    },
  });
}

/**
 * Hook para adicionar uma tag individual a uma foto.
 * Atualiza cache após adicionar tag.
 */
export function useAddTagToPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, memberId }: { photoId: string; memberId: string }) =>
      addTagToPhoto(photoId, memberId),

    onSuccess: () => {
      // Invalida todos os queries de fotos
      queryClient.invalidateQueries({
        queryKey: ['photos'],
      });
    },
  });
}

/**
 * Hook para remover uma tag de uma foto.
 * Atualiza cache após remover tag.
 */
export function useRemoveTagFromPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, memberId }: { photoId: string; memberId: string }) =>
      removeTagFromPhoto(photoId, memberId),

    onSuccess: () => {
      // Invalida todos os queries de fotos
      queryClient.invalidateQueries({
        queryKey: ['photos'],
      });
    },
  });
}

/**
 * Hook para atualizar legenda de uma foto.
 * Atualiza cache após atualizar legenda.
 */
export function useUpdatePhotoCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      updatePhotoCaption(photoId, caption),

    onSuccess: () => {
      // Invalida todos os queries de fotos
      queryClient.invalidateQueries({
        queryKey: ['photos'],
      });
    },
  });
}

/**
 * Hook para deletar uma foto.
 * Invalida cache após deletar.
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),

    onSuccess: () => {
      // Invalida todos os queries de fotos
      queryClient.invalidateQueries({
        queryKey: ['photos'],
      });
    },
  });
}
