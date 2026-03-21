import { NextRequest, NextResponse } from 'next/server';
import { initializeWallet, getWalletBalance } from '@/app/lib/wdk/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      // Get default wallet info - FIXED: use correct return values
      const { account, address: defaultAddress } = await initializeWallet();
      const balance = await getWalletBalance(defaultAddress);
      
      return NextResponse.json({
        success: true,
        address: defaultAddress,
        balance
      });
    }

    const balance = await getWalletBalance(address);
    return NextResponse.json({
      success: true,
      address,
      balance
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}