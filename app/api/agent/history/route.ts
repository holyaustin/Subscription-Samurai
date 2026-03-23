/**
 * GET /api/agent/history
 */

import { NextResponse } from 'next/server';
import { getTransactions } from '@/app/lib/agentStore';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      history: { transactions: getTransactions() },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}