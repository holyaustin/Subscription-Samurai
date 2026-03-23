/**
 * GET /api/skill
 *
 * Serves the agent skill definition file.
 * AI agents (OpenClaw, etc.) fetch this to learn what this agent can do.
 *
 * Following the AgentSkills specification: https://agentskills.io/specification
 * Inspired by WDK docs: https://docs.wdk.tether.io/ai/agent-skills
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const skillPath = path.join(process.cwd(), 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        // CORS: allow any agent to fetch this
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    // Fallback inline skill if file not found
    return new NextResponse(
      `# Subscription Samurai\nAutonomous USDT subscription payment agent powered by Tether WDK.\nEndpoints: /api/agent/cron, /api/wallet/balance, /api/agent/start`,
      { headers: { 'Content-Type': 'text/markdown' } }
    );
  }
}