import { NextResponse } from "next/server";
import { getAllUsers, getUserStats, getTopUsersBySpending } from "@/lib/users";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const top = searchParams.get("top");
    const stats = searchParams.get("stats");

    // Return user statistics
    if (stats === "true") {
      const userStats = getUserStats();
      return NextResponse.json({
        success: true,
        stats: userStats,
      });
    }

    // Return top users by spending
    if (top) {
      const limit = parseInt(top) || 10;
      const topUsers = getTopUsersBySpending(limit);
      return NextResponse.json({
        success: true,
        users: topUsers.map((user) => ({
          ...user,
          firstTransactionAt: user.firstTransactionAt.toISOString(),
          lastTransactionAt: user.lastTransactionAt.toISOString(),
        })),
      });
    }

    // Return all users
    const users = getAllUsers();
    
    // Sort by last transaction (newest first)
    users.sort((a, b) => b.lastTransactionAt.getTime() - a.lastTransactionAt.getTime());

    return NextResponse.json({
      success: true,
      users: users.map((user) => ({
        ...user,
        firstTransactionAt: user.firstTransactionAt.toISOString(),
        lastTransactionAt: user.lastTransactionAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

