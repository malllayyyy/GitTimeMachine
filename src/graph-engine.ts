import * as fs from 'fs';
import * as path from 'path';
import { GitObjectLocator, GitObjectDecompressor, GitObjectParser, CommitParser, GitCommit } from './git-parser';

export interface GraphNode {
    id: string; // Commit SHA-1
    author: string;
    timestamp: number; // Unix timestamp extracted from author field
    message: string;
}

export interface GraphEdge {
    source: string; // Parent commit
    target: string; // Child commit
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export class GitHeadLocator {
    static getHeadSha(repoPath: string): string {
        const headPath = path.join(repoPath, '.git', 'HEAD');
        if (!fs.existsSync(headPath)) {
            throw new Error(`HEAD file not found at ${headPath}`);
        }

        const headContent = fs.readFileSync(headPath, 'utf-8').trim();
        
        if (headContent.startsWith('ref: ')) {
            const refPath = headContent.substring(5);
            const absoluteRefPath = path.join(repoPath, '.git', refPath);
            if (!fs.existsSync(absoluteRefPath)) {
                // If ref doesn't exist, checking packed-refs could be done, but for simple loose objects this will work.
                throw new Error(`Reference file not found at ${absoluteRefPath}`);
            }
            return fs.readFileSync(absoluteRefPath, 'utf-8').trim();
        }

        // Detached HEAD, so HEAD itself contains the SHA-1
        return headContent;
    }
}

export class GraphTraversalEngine {
    static buildGraph(repoPath: string, startSha: string): GraphData {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const visited = new Set<string>();
        const queue: string[] = [startSha];

        while (queue.length > 0) {
            const currentSha = queue.shift()!;
            
            if (visited.has(currentSha)) {
                continue;
            }
            visited.add(currentSha);

            try {
                const objectPath = GitObjectLocator.getObjectPath(repoPath, currentSha);
                const decompressedBuffer = GitObjectDecompressor.decompress(objectPath);
                const { header, payload } = GitObjectParser.parse(decompressedBuffer);

                if (header.type !== 'commit') {
                    console.warn(`Object ${currentSha} is a ${header.type}, skipping...`);
                    continue;
                }

                const commit = CommitParser.parse(payload);
                
                // Extract timestamp from author string (e.g., "Name <email> 1234567890 +0000")
                let timestamp = 0;
                const authorMatch = commit.author.match(/(\d+) \S+$/);
                if (authorMatch) {
                    timestamp = parseInt(authorMatch[1], 10);
                }

                nodes.push({
                    id: currentSha,
                    author: commit.author,
                    timestamp,
                    message: commit.message
                });

                for (const parentSha of commit.parents) {
                    edges.push({
                        source: parentSha,
                        target: currentSha
                    });

                    if (!visited.has(parentSha)) {
                        queue.push(parentSha);
                    }
                }

            } catch (error) {
                console.error(`Failed to process commit ${currentSha}: ${(error as Error).message}`);
            }
        }

        return { nodes, edges };
    }
}

// ==========================================
// Example Execution Block (for direct testing)
// ==========================================
if (require.main === module) {
    const args = process.argv.slice(2);
    const repoPath = args[0] || process.cwd();

    try {
        console.log(`Locating HEAD in repository ${repoPath}...`);
        const startSha = GitHeadLocator.getHeadSha(repoPath);
        console.log(`Starting graph traversal from commit: ${startSha}`);

        const graphData = GraphTraversalEngine.buildGraph(repoPath, startSha);
        
        console.log('\n--- Graph Data Output ---');
        console.log(JSON.stringify(graphData, null, 2));
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
    }
}
