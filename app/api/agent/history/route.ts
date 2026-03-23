/**
 * GET /api/agent/history
 */

import { NextResponse } from 'next/server';
import { getTransactions } from '@/app/lib/store';

export async function GET() {
  try {
    const transactions = getTransactions();
    return NextResponse.json({
      success: true,
      history: { transactions },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}