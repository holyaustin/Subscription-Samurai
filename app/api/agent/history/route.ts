import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const historyPath = path.join(process.cwd(), 'data', 'history.json');
    
    let history = { transactions: [] };
    try {
      const data = await fs.readFile(historyPath, 'utf8');
      history = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return empty history
      console.log('History file not found, starting fresh');
    }

    return NextResponse.json({
      success: true,
      history
    });
  } catch (error) {
    // Properly handle unknown error type
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}