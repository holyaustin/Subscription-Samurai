import { NextRequest, NextResponse } from 'next/server';
import { sendPayment, estimateFee } from '@/app/lib/wdk/client';

export async function POST(request: NextRequest) {
  try {
    const { toAddress, amount, action } = await request.json();

    if (action === 'estimate') {
      const estimate = await estimateFee(toAddress, amount);
      return NextResponse.json({
        success: true,
        estimate
      });
    }

    if (action === 'send') {
      const result = await sendPayment(toAddress, amount);
      return NextResponse.json({
        success: true,
        transaction: result
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}