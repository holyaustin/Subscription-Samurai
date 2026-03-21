import { NextResponse } from 'next/server';
import { initializeWallet } from '@/app/lib/wdk/client';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST() {
  try {
    // Initialize wallet (this will generate a new wallet)
    const { address, seedPhrase } = await initializeWallet();

    // Save mnemonic to .env.local for persistence
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // File doesn't exist, will create new
      console.log('Creating new .env.local file');
    }

    // Save mnemonic if not already present
    if (!envContent.includes('WALLET_MNEMONIC=')) {
      envContent += `\nWALLET_MNEMONIC=${seedPhrase}`;
      await fs.writeFile(envPath, envContent);
    }

    return NextResponse.json({
      success: true,
      address,
      message: 'Wallet created successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Wallet creation error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}