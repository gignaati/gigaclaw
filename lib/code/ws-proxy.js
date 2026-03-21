import { WebSocketServer, WebSocket } from 'ws';
import { decode } from 'next-auth/jwt';
import { getCodeWorkspaceById } from '../db/code-workspaces.js';

async function getAuthenticatedUserId(req) {
  const cookies = req.headers.cookie || '';
  const secureName = '__Secure-authjs.session-token';
  const plainName = 'authjs.session-token';
  const isSecure = cookies.includes(secureName);
  const name = isSecure ? secureName : plainName;
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}=([^;]+)`));
  if (!match) return null;

  try {
    const token = await decode({
      token: match[1],
      secret: process.env.AUTH_SECRET,
      salt: name,
    });
    return token?.sub || null;
  } catch {
    return null;
  }
}

export function attachCodeProxy(server) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on('upgrade', async (req, socket, head) => {
    const match = req.url.match(/^\/code\/([^/]+)\/ws$/);
    if (!match) return;

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      console.log('[ws-proxy] rejected: unauthenticated upgrade');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const codeWorkspaceId = match[1];
    const codeWorkspace = getCodeWorkspaceById(codeWorkspaceId);
    if (!codeWorkspace) {
      console.log(`[ws-proxy] rejected: unknown workspace ${codeWorkspaceId}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    if (codeWorkspace.userId !== userId) {
      console.log(`[ws-proxy] rejected: workspace ${codeWorkspaceId} not owned by user`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const container = codeWorkspace.containerName;

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const backendWs = new WebSocket(`ws://${container}:7681/ws`, 'tty');

      backendWs.on('open', () => {
        console.log(`[ws-proxy] connected: ${container}`);
      });

      backendWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data, { binary: isBinary });
        }
      });

      clientWs.on('message', (data, isBinary) => {
        if (backendWs.readyState === WebSocket.OPEN) {
          backendWs.send(data, { binary: isBinary });
        }
      });

      backendWs.on('error', (err) => {
        console.error(`[ws-proxy] backend error: ${err.message}`);
        clientWs.close();
      });

      backendWs.on('close', () => clientWs.close());
      clientWs.on('error', () => backendWs.close());
      clientWs.on('close', () => backendWs.close());
    });
  });
}
