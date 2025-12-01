import { NextRequest, NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/transactions";
import { calculateSendAmount } from "@/lib/transactions";

/**
 * Debug endpoint to test transaction calculations
 */
export async function GET(request: NextRequest) {
  try {
    const allTransactions = getAllTransactions();
    
    // Test calculateSendAmount with various inputs
    const testCases = [
      { ngnAmount: 100, exchangeRate: 50 },
      { ngnAmount: 0, exchangeRate: 50 },
      { ngnAmount: 100, exchangeRate: 0 },
      { ngnAmount: 100, exchangeRate: undefined },
      { ngnAmount: NaN, exchangeRate: 50 },
    ];
    
    const testResults = testCases.map((test) => {
      try {
        if (test.exchangeRate === undefined) {
          return { test, result: "skipped (undefined rate)", error: null };
        }
        const result = calculateSendAmount(test.ngnAmount, test.exchangeRate);
        return { test, result, error: null };
      } catch (error: any) {
        return { test, result: null, error: error.message };
      }
    });
    
    return NextResponse.json({
      success: true,
      totalTransactions: allTransactions.length,
      transactions: allTransactions.map((tx) => ({
        transactionId: tx.transactionId,
        ngnAmount: tx.ngnAmount,
        sendAmount: tx.sendAmount,
        exchangeRate: tx.exchangeRate,
        status: tx.status,
      })),
      testResults,
    });
  } catch (error: any) {
    console.error("Debug error test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}


