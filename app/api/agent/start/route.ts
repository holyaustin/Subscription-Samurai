/**
 * app/api/agent/start/route.ts
 *
 * POST  — saves subscriptions + marks agent as active
 * DELETE — marks agent as inactive
 *
 * On Vercel: the actual payments run via /api/agent/cron (Vercel Cron Job).
 *            This route just saves the subscription config and active flag.
 *
 * Locally:   same behaviour. Use `npm run dev:all` to also run the
 *            standalone agent process, OR just use the cron route manually
 *            at http://localhost:3000/api/agent/cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR    = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE  = path.join(DATA_DIR, 'agent-state.json');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// POST — start agent (save subscriptions + set active)
export async function POST(request: NextRequest) {
  try {
    await ensureDataDir();

    const { subscriptions } = await request.json();

    // Save subscriptions config
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ subscriptions }, null, 2));

    // Save agent active state
    await fs.writeFile(STATE_FILE, JSON.stringify({ active: true, startedAt: new Date().toISOString() }, null, 2));

    return NextResponse.json({ success: true, message: 'Agent started — subscriptions saved' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE — stop agent
export async function DELETE() {
  try {
    await ensureDataDir();
    await fs.writeFile(STATE_FILE, JSON.stringify({ active: false, stoppedAt: new Date().toISOString() }, null, 2));
    return NextResponse.json({ success: true, message: 'Agent stopped' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}