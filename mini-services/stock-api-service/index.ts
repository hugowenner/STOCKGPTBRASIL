/**
 * Stock API Service - A process manager that starts and monitors the Python FastAPI server.
 * This ensures the FastAPI backend stays running and restarts it if it crashes.
 */
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'http';

const PORT = 3030;
const PYTHON_DIR = '/home/z/my-project/stock-api';
let pythonProcess: ChildProcess | null = null;
let isShuttingDown = false;

function startPythonServer(): void {
  if (pythonProcess && !pythonProcess.killed) {
    return;
  }

  console.log('[StockAPI] Starting Python FastAPI server...');
  
  pythonProcess = spawn('python3', [
    '-m', 'uvicorn', 'main:app',
    '--host', '0.0.0.0',
    '--port', String(PORT),
  ], {
    cwd: PYTHON_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[FastAPI] ${data.toString().trim()}`);
  });

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[FastAPI] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[StockAPI] Python process exited with code ${code}`);
    pythonProcess = null;
    
    if (!isShuttingDown) {
      console.log('[StockAPI] Restarting in 3 seconds...');
      setTimeout(startPythonServer, 3000);
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('[StockAPI] Failed to start Python process:', err);
    pythonProcess = null;
    
    if (!isShuttingDown) {
      setTimeout(startPythonServer, 5000);
    }
  });
}

// Health check endpoint on the management port
const healthServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'stock-api-manager',
    pythonRunning: pythonProcess !== null && !pythonProcess.killed,
    port: PORT,
  }));
});

healthServer.listen(3031, () => {
  console.log('[StockAPI] Health check server running on port 3031');
});

// Start the Python server
startPythonServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[StockAPI] Shutting down...');
  isShuttingDown = true;
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
  }
  healthServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
  }
  healthServer.close();
  process.exit(0);
});
