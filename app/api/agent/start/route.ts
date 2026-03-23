/**
 * POST /api/agent/start  — saves subscriptions and marks agent active
 * DELETE /api/agent/start — marks agent inactive
 */

import { NextRequest, NextResponse } from 'next/server';
import { startAgent, stopAgent, getAgentState } from '@/app/lib/store';

export async function POST(request: NextRequest) {
  try {
    const { subscriptions } = await request.json();

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscriptions provided' },
        { status: 400 }
      );
    }

    startAgent(subscriptions);

    return NextResponse.json({
      success: true,
      message: `Agent started with ${subscriptions.length} subscription(s)`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    stopAgent();
    return NextResponse.json({ success: true, message: 'Agent stopped' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}