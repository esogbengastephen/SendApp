import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * API Endpoint: Cleanup Pending Transactions Older Than 1 Hour
 * 
 * Can be called by:
 * - Vercel Cron Jobs
 * - External cron services
 * - Manual admin trigger
 * 
 * Removes pending transactions that are older than 1 hour.
 */
export async function POST(request: NextRequest) {
  try {
    // Calculate 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Get all pending transactions older than 1 hour
    const { data: oldPending, error: fetchError } = await supabase
      .from('transactions')
      .select('transaction_id, ngn_amount, wallet_address, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo);

    if (fetchError) {
      console.error('[Cleanup Pending] Error fetching transactions:', fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!oldPending || oldPending.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending transactions older than 1 hour found",
        deleted: 0,
      });
    }

    // Delete all old pending transactions
    let successCount = 0;
    let errorCount = 0;

    for (const tx of oldPending) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('transaction_id', tx.transaction_id);

        if (error) {
          console.error(`[Cleanup Pending] Failed to delete ${tx.transaction_id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`[Cleanup Pending] Error deleting ${tx.transaction_id}:`, err);
        errorCount++;
      }
    }

    console.log(`[Cleanup Pending] ✅ Deleted ${successCount} pending transactions older than 1 hour`);

    // Get updated stats
    const { data: remaining } = await supabase
      .from('transactions')
      .select('status');

    const stats = {
      total: remaining?.length || 0,
      pending: remaining?.filter(t => t.status === 'pending').length || 0,
      completed: remaining?.filter(t => t.status === 'completed').length || 0,
      failed: remaining?.filter(t => t.status === 'failed').length || 0,
    };

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${successCount} pending transactions older than 1 hour`,
      deleted: successCount,
      errors: errorCount,
      stats,
    });
  } catch (error: any) {
    console.error('[Cleanup Pending] Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  try {
    // Calculate 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Get count of pending transactions older than 1 hour
    const { data: oldPending, error: fetchError } = await supabase
      .from('transactions')
      .select('transaction_id, ngn_amount, wallet_address, created_at', { count: 'exact' })
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo)
      .limit(10);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: oldPending?.length || 0,
      sample: oldPending || [],
      message: oldPending && oldPending.length > 0
        ? `Found ${oldPending.length} pending transactions older than 1 hour. Use POST to delete them.`
        : "No pending transactions older than 1 hour found.",
    });
  } catch (error: any) {
    console.error('[Cleanup Pending] Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

