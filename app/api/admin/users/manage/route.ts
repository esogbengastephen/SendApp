import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import axios from "axios";

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
    let paystackCustomerCode: string | null = null; // Declare outside switch for scope

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

        // 3. Generate new referral code (required field - cannot be null)
        const newReferralCode = nanoid(8).toUpperCase();

        // 4. Get Paystack customer code before clearing it
        const { data: userData } = await supabase
          .from("users")
          .select("paystack_customer_code, default_virtual_account_number")
          .eq("id", userId)
          .single();

        paystackCustomerCode = userData?.paystack_customer_code || null;
        const virtualAccountNumber = userData?.default_virtual_account_number;

        // 5. Reset all user data (keep only id, email, created_at)
        updateData = {
          referral_code: newReferralCode,
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
          account_reset_at: new Date().toISOString(), // Track reset time (never cleared)
        };

        deletedData = {
          walletsDeleted: deletedWallets?.length || 0,
          transactionsDissociated: updatedTransactions?.length || 0,
          newReferralCode: newReferralCode,
        };

        message = `Account permanently reset for ${user.email}. Deleted ${deletedData.walletsDeleted} wallets, dissociated ${deletedData.transactionsDissociated} transactions. New referral code: ${newReferralCode}. User can now re-register.`;
        console.log(`[Admin] PERMANENT RESET completed for ${user.email}:`, deletedData);
        break;
    }

    // Update user in database
    const { error: updateError, data: updatedUser } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select();

    if (updateError) {
      console.error("Error updating user:", updateError);
      console.error("Update data attempted:", JSON.stringify(updateData, null, 2));
      console.error("User ID:", userId);
      
      // Check if error is due to missing column
      const isColumnError = updateError.message?.includes("column") || 
                           updateError.message?.includes("does not exist") ||
                           updateError.code === "42703"; // PostgreSQL undefined column error
      
      if (isColumnError && action === "permanent_reset" && updateData.account_reset_at) {
        // Try again without account_reset_at (column might not exist yet)
        console.log("[Admin] Retrying update without account_reset_at column...");
        const { account_reset_at, ...updateDataWithoutReset } = updateData;
        
        const { error: retryError } = await supabase
          .from("users")
          .update(updateDataWithoutReset)
          .eq("id", userId);
        
        if (retryError) {
          console.error("Error on retry:", retryError);
          return NextResponse.json(
            { 
              success: false, 
              error: "Failed to update user",
              details: retryError.message,
              code: retryError.code,
              hint: retryError.hint || "Please ensure all database migrations have been run",
            },
            { status: 500 }
          );
        }
        
        console.log("[Admin] ✅ Update succeeded without account_reset_at column");
      } else {
        // Return actual error message for debugging
        return NextResponse.json(
          { 
            success: false, 
            error: "Failed to update user",
            details: updateError.message,
            code: updateError.code,
            hint: updateError.hint || "Check database schema and migrations",
          },
          { status: 500 }
        );
      }
    }

    // Deactivate Paystack customer (if exists) - only for permanent_reset
    if (action === "permanent_reset" && paystackCustomerCode) {
      try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
        const PAYSTACK_API_BASE = "https://api.paystack.co";

        if (PAYSTACK_SECRET_KEY) {
          // Blacklist customer in Paystack (set risk_action to deny)
          try {
            await axios.put(
              `${PAYSTACK_API_BASE}/customer/${paystackCustomerCode}`,
              {
                first_name: "Deleted",
                last_name: "User",
                email: `deleted_${Date.now()}@deleted.local`, // Anonymize email
                phone: "+2340000000000", // Anonymize phone
                metadata: {
                  deleted: true,
                  deleted_at: new Date().toISOString(),
                  original_user_id: userId,
                },
                risk_action: "deny", // Blacklist customer
              },
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );
            console.log(`[Admin] ✅ Paystack customer ${paystackCustomerCode} deactivated/blacklisted`);
            deletedData.paystackCustomerDeactivated = true;
          } catch (paystackError: any) {
            console.error(`[Admin] ⚠️ Failed to deactivate Paystack customer:`, paystackError.response?.data || paystackError.message);
            // Don't fail the reset if Paystack deactivation fails
            deletedData.paystackCustomerDeactivated = false;
            deletedData.paystackError = paystackError.response?.data?.message || paystackError.message;
          }
        }
      } catch (error: any) {
        console.error(`[Admin] ⚠️ Error in Paystack deactivation process:`, error);
        // Don't fail the reset if Paystack deactivation fails
      }
    }

    // Send email with new referral code (only for permanent_reset)
    if (action === "permanent_reset") {
      try {
        const emailResponse = await fetch(`${request.nextUrl.origin}/api/admin/send-bulk-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            subject: "Your Account Has Been Reset - New Referral Code",
            message: `Hello,\n\nYour account has been reset by an administrator. Your account data has been cleared, and you can now register again as a new user.\n\nYour new referral code is: ${deletedData.newReferralCode}\n\nYou can use this code to refer friends and earn rewards.\n\nIf you have any questions, please contact support.\n\nBest regards,\nFlipPay Team`,
            referralCode: deletedData.newReferralCode,
            referralCount: 0,
          }),
        });

        if (emailResponse.ok) {
          console.log(`[Admin] ✅ Reset email sent to ${user.email} with new referral code: ${deletedData.newReferralCode}`);
        } else {
          const emailData = await emailResponse.json();
          console.error(`[Admin] ⚠️ Failed to send reset email to ${user.email}:`, emailData.error);
        }
      } catch (emailError: any) {
        // Don't fail the reset if email fails - just log it
        console.error(`[Admin] ⚠️ Error sending reset email:`, emailError);
      }
    }

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

