import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createGroupProfile,
  deactivateProfile,
  fetchGroupProfiles,
} from '../api/profiles';

export function useGroupProfiles(groupId: string) {
  return useQuery({
    queryKey: ['profiles', groupId],
    queryFn: () => fetchGroupProfiles(groupId),
    staleTime: 60 * 1000,
    enabled: !!groupId,
  });
}

export function useCreateGroupProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { groupId: string; name: string; nickname?: string }) =>
      createGroupProfile(input),
    onSuccess: (_profile, input) => {
      queryClient.invalidateQueries({ queryKey: ['profiles', input.groupId] });
    },
  });
}

export function useDeactivateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId }: { profileId: string; groupId: string }) =>
      deactivateProfile(profileId),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['profiles', input.groupId] });
    },
  });
}
