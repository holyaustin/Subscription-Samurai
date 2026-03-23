/**
 * GET /api/agent/history
 * Returns all transaction history
 */

import { NextResponse } from 'next/server';
import { getTransactions, getTransactionStats } from '@/app/lib/agentStore';

export async function GET() {
  try {
    const transactions = getTransactions();
    const stats = getTransactionStats();
    
    return NextResponse.json({
      success: true,
      history: { 
        transactions,
        stats: {
          total: stats.total,
          success: stats.success,
          failed: stats.failed,
          error: stats.error,
          totalAmount: stats.totalAmount
        }
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('History fetch error:', msg);
    return NextResponse.json(
      { success: false, error: msg }, 
      { status: 500 }
    );
  }
}