import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export const MEDIA_BUCKET = 'bar-media';

/**
 * O bucket é privado (migração 0003), logo cada leitura precisa de um URL
 * assinado. Uma hora cobre uma noite inteira sem obrigar a reassinar a meio.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? 'jpg';
}

function randomName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Carrega a imagem para o bucket e devolve o **caminho** do objeto, não um URL.
 * É o caminho que fica em `photos.image_url`: o bucket é privado e um URL
 * assinado expira, logo guardá-lo seria guardar lixo daqui a uma hora.
 *
 * A primeira pasta tem de ser o UUID do grupo — é o que as políticas de
 * `storage.objects` verificam.
 */
export async function uploadPhotoImage(input: {
  groupId: string;
  sessionId?: string;
  base64: string;
  mimeType: string;
}): Promise<string> {
  if (!input.groupId) {
    throw new Error('uploadPhotoImage: groupId é obrigatório');
  }

  const path = `${input.groupId}/${input.sessionId ?? 'grupo'}/${randomName()}.${extensionFor(
    input.mimeType,
  )}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, decode(input.base64), {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

interface SignedUrlRow {
  path: string | null;
  signedUrl: string | null;
  error: string | null;
}

/**
 * Assina em lote os caminhos guardados em `photos.image_url` e devolve o mapa
 * caminho → URL. Valores que já são URLs absolutos passam intactos: a app web
 * escrevia URLs públicos antes de a 0003 fechar o bucket.
 *
 * Um caminho que não consiga ser assinado (ficheiro apagado à mão, por exemplo)
 * fica de fora do mapa em vez de rebentar a galeria inteira.
 */
export async function signedPhotoUrls(
  imageUrls: string[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  const paths: string[] = [];

  for (const value of imageUrls) {
    if (!value || urls[value] || paths.includes(value)) continue;

    if (value.startsWith('http://') || value.startsWith('https://')) {
      urls[value] = value;
    } else {
      paths.push(value);
    }
  }

  if (paths.length === 0) return urls;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, ttlSeconds);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as SignedUrlRow[]) {
    if (row.path && row.signedUrl && !row.error) {
      urls[row.path] = row.signedUrl;
    }
  }

  return urls;
}

/**
 * Apaga o objeto do bucket. Só um administrador do grupo passa a política de
 * DELETE; para os restantes o Supabase devolve a linha como não encontrada.
 */
export async function removePhotoImage(path: string): Promise<void> {
  if (!path || path.startsWith('http')) return;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
