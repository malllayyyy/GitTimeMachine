import * as http from 'http';
import * as url from 'url';
import { GitHeadLocator, GraphTraversalEngine } from './graph-engine';

const PORT = 3001;

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    
    if (parsedUrl.pathname === '/api/graph' && req.method === 'GET') {
        const repoPath = parsedUrl.query.repoPath as string;
        
        if (!repoPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing repoPath parameter' }));
            return;
        }

        try {
            console.log(`[Server] Generating graph for: ${repoPath}`);
            const startSha = GitHeadLocator.getHeadSha(repoPath);
            const graphData = GraphTraversalEngine.buildGraph(repoPath, startSha);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(graphData));
        } catch (error) {
            console.error(`[Server] Error processing request:`, error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: (error as Error).message }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`[Server] Git Time Machine API listening on http://localhost:${PORT}`);
});
