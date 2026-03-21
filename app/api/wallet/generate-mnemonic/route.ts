import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';

export async function GET() {
  try {
    // Generate a random 12-word seed phrase
    const seedPhrase = WDK.getRandomSeedPhrase();
    
    return NextResponse.json({
      success: true,
      mnemonic: seedPhrase
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate mnemonic' },
      { status: 500 }
    );
  }
}