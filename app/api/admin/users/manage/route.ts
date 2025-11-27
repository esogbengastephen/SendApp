import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId, action, reason } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "User ID and action are required" },
        { status: 400 }
      );
    }

    const validActions = ["block", "unblock", "permanent_reset"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // Get user info first
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("email, is_blocked")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let message = "";
    let deletedData: any = {};

    switch (action) {
      case "block":
        updateData = {
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason || "Blocked by administrator",
        };
        message = `User ${user.email} has been blocked`;
        break;

      case "unblock":
        updateData = {
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
        };
        message = `User ${user.email} has been unblocked`;
        break;

      case "permanent_reset":
        // This is a destructive action - delete all user data except email
        console.log(`[Admin] PERMANENT RESET initiated for ${user.email}`);

        // 1. Delete all user wallets
        const { data: deletedWallets, error: walletsError } = await supabase
          .from("user_wallets")
          .delete()
          .eq("user_id", userId)
          .select("wallet_address");

        if (walletsError) {
          console.error("Error deleting wallets:", walletsError);
          return NextResponse.json(
            { success: false, error: "Failed to delete user wallets" },
            { status: 500 }
          );
        }

        // 2. Dissociate transactions (keep for audit, but remove user_id)
        const { data: updatedTransactions, error: transactionsError } = await supabase
          .from("transactions")
          .update({ user_id: null })
          .eq("user_id", userId)
          .select("transaction_id");

        if (transactionsError) {
          console.error("Error dissociating transactions:", transactionsError);
          return NextResponse.json(
            { success: false, error: "Failed to dissociate transactions" },
            { status: 500 }
          );
        }

        // 3. Reset all user data (keep only id, email, created_at)
        updateData = {
          referral_code: null,
          referral_count: 0,
          referred_by: null,
          sendtag: null,
          default_virtual_account_number: null,
          paystack_customer_code: null,
          virtual_account_assigned_at: null,
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
          requires_reset: false,
          reset_requested_at: null,
        };

        deletedData = {
          walletsDeleted: deletedWallets?.length || 0,
          transactionsDissociated: updatedTransactions?.length || 0,
        };

        message = `Account permanently reset for ${user.email}. Deleted ${deletedData.walletsDeleted} wallets, dissociated ${deletedData.transactionsDissociated} transactions. User can now re-register.`;
        console.log(`[Admin] PERMANENT RESET completed for ${user.email}:`, deletedData);
        break;
    }

    // Update user in database
    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update user" },
        { status: 500 }
      );
    }

    // TODO: Send email notification to user
    // You can implement email notification here using your email service

    console.log(`[Admin] User management action: ${action} on ${user.email}`);

    return NextResponse.json({
      success: true,
      message,
      user: {
        email: user.email,
        ...updateData,
      },
      deletedData: action === "permanent_reset" ? deletedData : undefined,
    });
  } catch (error: any) {
    console.error("Error in user management API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

