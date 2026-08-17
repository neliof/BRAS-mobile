import { supabase } from './supabase';
import type { Photo } from '../types';

export async function fetchPhotos(sessionId?: string, groupId?: string): Promise<Photo[]> {
  let query = supabase.from('photos').select('*');

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else if (groupId) {
    query = query.eq('group_id', groupId);
  } else {
    throw new Error('fetchPhotos: sessionId ou groupId é obrigatório');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPhotosBySession(sessionId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPhotosByGroup(groupId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function uploadPhoto(data: {
  groupId?: string;
  sessionId?: string;
  uploadedBy: string;
  imageUrl: string;
  caption?: string;
  taggedMemberIds?: string[];
}): Promise<Photo> {
  if (!data.groupId && !data.sessionId) {
    throw new Error('uploadPhoto: groupId ou sessionId é obrigatório');
  }

  const { data: photo, error } = await supabase
    .from('photos')
    .insert({
      group_id: data.groupId,
      session_id: data.sessionId,
      uploaded_by: data.uploadedBy,
      image_url: data.imageUrl,
      caption: data.caption,
      tagged_member_ids: data.taggedMemberIds || [],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return photo;
}

export async function tagPhoto(photoId: string, memberIds: string[]): Promise<Photo> {
  const { data: photo, error } = await supabase
    .from('photos')
    .update({
      tagged_member_ids: memberIds,
    })
    .eq('id', photoId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return photo;
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<Photo> {
  const { data: photo, error } = await supabase
    .from('photos')
    .update({
      caption,
    })
    .eq('id', photoId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return photo;
}

export async function deletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('photos').delete().eq('id', photoId);

  if (error) throw new Error(error.message);
}

export async function addTagToPhoto(photoId: string, memberId: string): Promise<Photo> {
  const photo = await supabase
    .from('photos')
    .select('tagged_member_ids')
    .eq('id', photoId)
    .single();

  if (photo.error) throw new Error(photo.error.message);

  const currentTags = photo.data?.tagged_member_ids || [];
  if (!currentTags.includes(memberId)) {
    currentTags.push(memberId);
  }

  const { data: updatedPhoto, error } = await supabase
    .from('photos')
    .update({
      tagged_member_ids: currentTags,
    })
    .eq('id', photoId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updatedPhoto;
}

export async function removeTagFromPhoto(photoId: string, memberId: string): Promise<Photo> {
  const photo = await supabase
    .from('photos')
    .select('tagged_member_ids')
    .eq('id', photoId)
    .single();

  if (photo.error) throw new Error(photo.error.message);

  const currentTags = (photo.data?.tagged_member_ids || []).filter((id: string) => id !== memberId);

  const { data: updatedPhoto, error } = await supabase
    .from('photos')
    .update({
      tagged_member_ids: currentTags,
    })
    .eq('id', photoId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updatedPhoto;
}
