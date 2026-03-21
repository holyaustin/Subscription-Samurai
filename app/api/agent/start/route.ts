import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

let agentProcess: ChildProcess | null = null;

export async function POST(request: NextRequest) {
  try {
    if (agentProcess) {
      return NextResponse.json({
        success: true,
        message: 'Agent already running'
      });
    }

    const body = await request.json();
    const { subscriptions } = body;

    // Save subscriptions to config file
    const configPath = path.join(process.cwd(), 'data', 'subscriptions.json');
    
    // Ensure data directory exists
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    
    // Save subscriptions
    await fs.writeFile(configPath, JSON.stringify({ subscriptions }, null, 2));

    // Start agent process
    const agentScriptPath = path.join(process.cwd(), 'agent-scripts', 'subscription-agent.js');
    
    agentProcess = spawn('node', [agentScriptPath], {
      detached: true,
      stdio: 'pipe'
    });

    // Type the data parameter properly
    agentProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`Agent stdout: ${data.toString()}`);
    });

    agentProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`Agent stderr: ${data.toString()}`);
    });

    return NextResponse.json({
      success: true,
      message: 'Agent started successfully'
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

export async function DELETE() {
  try {
    if (agentProcess) {
      // Kill the process gracefully
      agentProcess.kill('SIGTERM');
      agentProcess = null;
    }

    return NextResponse.json({
      success: true,
      message: 'Agent stopped'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}