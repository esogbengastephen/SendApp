/**
 * Notification utility functions
 * Handles creating and managing user notifications
 */

import { supabaseAdmin } from "./supabase";

export type NotificationType = 'transaction' | 'payment' | 'utility' | 'system' | 'referral' | 'invoice';

export interface NotificationData {
  transaction_id?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  status?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data: NotificationData = {}
): Promise<{ success: boolean; notification?: Notification; error?: string }> {
  try {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, notification: notification as Notification };
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create notification for payment received
 */
export async function notifyPaymentReceived(
  userId: string,
  amount: number,
  reference: string,
  currency: string = 'NGN'
): Promise<void> {
  await createNotification(
    userId,
    'payment',
    'Payment Received',
    `Your payment of ${currency} ${amount.toLocaleString()} has been received. Reference: ${reference}`,
    {
      amount,
      currency,
      reference,
      status: 'received',
    }
  );
}

/**
 * Create notification for tokens distributed
 */
export async function notifyTokensDistributed(
  userId: string,
  amount: string,
  transactionId: string
): Promise<void> {
  await createNotification(
    userId,
    'transaction',
    'Tokens Distributed',
    `You have received ${amount} SEND tokens. Transaction ID: ${transactionId}`,
    {
      transaction_id: transactionId,
      amount: parseFloat(amount),
      currency: 'SEND',
      status: 'completed',
    }
  );
}

/**
 * Create notification for utility purchase
 */
export async function notifyUtilityPurchase(
  userId: string,
  serviceName: string,
  amount: number,
  status: 'completed' | 'failed',
  reference?: string
): Promise<void> {
  await createNotification(
    userId,
    'utility',
    status === 'completed' ? `${serviceName} Purchase Successful` : `${serviceName} Purchase Failed`,
    status === 'completed'
      ? `Your ${serviceName} purchase of ₦${amount.toLocaleString()} was successful.${reference ? ` Reference: ${reference}` : ''}`
      : `Your ${serviceName} purchase of ₦${amount.toLocaleString()} failed. Please try again.`,
    {
      amount,
      currency: 'NGN',
      reference,
      status,
      service_name: serviceName,
    }
  );
}

/**
 * Create notification for referral bonus
 */
export async function notifyReferralBonus(
  userId: string,
  amount: string,
  referredUserEmail?: string
): Promise<void> {
  await createNotification(
    userId,
    'referral',
    'Referral Bonus Earned',
    `You earned ${amount} SEND tokens${referredUserEmail ? ` for referring ${referredUserEmail}` : ' from a referral'}.`,
    {
      amount: parseFloat(amount),
      currency: 'SEND',
      referred_user: referredUserEmail,
      status: 'completed',
    }
  );
}

/**
 * Create notification for invoice payment
 */
export async function notifyInvoicePayment(
  userId: string,
  invoiceNumber: string,
  amount: number,
  status: 'paid' | 'received'
): Promise<void> {
  await createNotification(
    userId,
    'invoice',
    status === 'paid' ? 'Invoice Paid' : 'Invoice Payment Received',
    status === 'paid'
      ? `You marked invoice ${invoiceNumber} as paid (₦${amount.toLocaleString()}).`
      : `You received ₦${amount.toLocaleString()} for invoice ${invoiceNumber}.`,
    {
      invoice_number: invoiceNumber,
      amount,
      currency: 'NGN',
      status,
    }
  );
}

/**
 * Create system notification
 */
export async function notifySystemMessage(
  userId: string,
  title: string,
  message: string,
  data: NotificationData = {}
): Promise<void> {
  await createNotification(userId, 'system', title, message, data);
}
