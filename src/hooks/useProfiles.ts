import { useQuery } from '@tanstack/react-query';
import { fetchGroupProfiles } from '../api/profiles';

export function useGroupProfiles(groupId: string) {
  return useQuery({
    queryKey: ['profiles', groupId],
    queryFn: () => fetchGroupProfiles(groupId),
    staleTime: 60 * 1000,
    enabled: !!groupId,
  });
}
