import { supabase } from './supabase';

export async function requestCreditInvitation(storeId: string, phone: string, email: string) {
  const { data, error } = await supabase.functions.invoke('credit-invitations', {
    body: { action: 'request', store_id: storeId, phone, email },
  });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error || 'خدمة تأكيد الهاتف غير متاحة حالياً؛ لا يمكن فتح الدفتر قبل التأكيد.');
  }
  if (data?.status !== 'sent') throw new Error('لم يتم تأكيد إرسال رسالة الهاتف');
  return data;
}
