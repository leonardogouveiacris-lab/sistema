import { supabase } from '../lib/supabase';

export interface AppSetting {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export const DEFAULT_UPLOAD_LIMIT_MB = 500;

export async function getUploadLimitMb(): Promise<number> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'upload_limit_mb')
    .maybeSingle();

  if (error || !data) return DEFAULT_UPLOAD_LIMIT_MB;
  const parsed = parseInt(data.value, 10);
  return isNaN(parsed) ? DEFAULT_UPLOAD_LIMIT_MB : parsed;
}

export async function updateUploadLimitMb(limitMb: number): Promise<void> {
  const { error } = await supabase.rpc('update_upload_limit_setting', {
    limit_mb: limitMb,
  });

  if (error) throw error;
}
