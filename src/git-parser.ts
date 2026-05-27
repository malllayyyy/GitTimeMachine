import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface GitObjectHeader {
    type: 'commit' | 'tree' | 'blob' | 'tag';
    size: number;
}

export interface GitCommit {
    tree: string;
    parents: string[];
    author: string;
    committer: string;
    message: string;
}

/**
 * 1. Locator: Resolves the physical path of a loose object in the repository.
 * The SHA-1 hash (40 chars) is split into a 2-char directory and a 38-char filename.
 */
export class GitObjectLocator {
    static getObjectPath(repoPath: string, sha1: string): string {
        if (sha1.length !== 40) {
            throw new Error(`Invalid SHA-1 hash length: ${sha1.length}. Expected 40 characters.`);
        }
        const dir = sha1.slice(0, 2);
        const file = sha1.slice(2);
        return path.join(repoPath, '.git', 'objects', dir, file);
    }
}

/**
 * 2. Decompressor: Reads the binary file and decompresses it using zlib.
 */
export class GitObjectDecompressor {
    static decompress(filePath: string): Buffer {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Git object file not found: ${filePath}`);
        }
        const compressedBuffer = fs.readFileSync(filePath);
        return zlib.inflateSync(compressedBuffer);
    }
}

/**
 * 3. Base Parser: Parses the Git object header (type and size) which is separated from the payload by a null byte.
 */
export class GitObjectParser {
    static parse(buffer: Buffer): { header: GitObjectHeader; payload: Buffer } {
        // The header is structured as: "<type> <size>\0"
        const nullByteIndex = buffer.indexOf(0x00);
        if (nullByteIndex === -1) {
            throw new Error("Invalid Git object: Null byte not found in buffer.");
        }

        const headerString = buffer.subarray(0, nullByteIndex).toString('utf-8');
        const [type, sizeStr] = headerString.split(' ');
        
        const size = parseInt(sizeStr, 10);
        if (isNaN(size)) {
            throw new Error(`Invalid Git object size: ${sizeStr}`);
        }

        const payload = buffer.subarray(nullByteIndex + 1);
        if (payload.length !== size) {
            console.warn(`Warning: Payload size mismatch. Expected ${size}, got ${payload.length}`);
        }

        return {
            header: {
                type: type as GitObjectHeader['type'],
                size: size
            },
            payload
        };
    }
}

/**
 * 4. Specific Parser: Parses a Commit object's payload into structured data.
 */
export class CommitParser {
    static parse(payload: Buffer): GitCommit {
        const payloadString = payload.toString('utf-8');
        
        // A commit object payload is separated into header lines and the commit message
        // by a double newline sequence (\n\n).
        const separatorIndex = payloadString.indexOf('\n\n');
        
        const headerLinesString = separatorIndex !== -1 ? payloadString.slice(0, separatorIndex) : payloadString;
        const message = separatorIndex !== -1 ? payloadString.slice(separatorIndex + 2) : '';

        const lines = headerLinesString.split('\n');
        
        const commit: GitCommit = {
            tree: '',
            parents: [],
            author: '',
            committer: '',
            message: message.trim()
        };

        for (const line of lines) {
            if (line.startsWith('tree ')) {
                commit.tree = line.substring(5);
            } else if (line.startsWith('parent ')) {
                commit.parents.push(line.substring(7));
            } else if (line.startsWith('author ')) {
                commit.author = line.substring(7);
            } else if (line.startsWith('committer ')) {
                commit.committer = line.substring(10);
            }
        }

        return commit;
    }
}

// ==========================================
// Example Execution Block (for direct testing)
// ==========================================
if (require.main === module) {
    const args = process.argv.slice(2);
    const repoPath = args[0] || process.cwd();
    const sha1 = args[1];

    if (!sha1) {
        console.error("Usage: ts-node src/git-parser.ts <path-to-repo> <commit-sha1>");
        process.exit(1);
    }

    try {
        console.log(`Locating object ${sha1} in repository ${repoPath}...`);
        const objectPath = GitObjectLocator.getObjectPath(repoPath, sha1);
        console.log(`Path: ${objectPath}`);

        console.log(`Decompressing object...`);
        const decompressedBuffer = GitObjectDecompressor.decompress(objectPath);

        console.log(`Parsing Git object header...`);
        const { header, payload } = GitObjectParser.parse(decompressedBuffer);
        console.log(`Header: Type = ${header.type}, Size = ${header.size} bytes`);

        if (header.type === 'commit') {
            console.log(`Parsing Commit object payload...`);
            const commitData = CommitParser.parse(payload);
            console.log(JSON.stringify(commitData, null, 2));
        } else {
            console.log(`Object is a '${header.type}', not parsing specific payload for this type in this script.`);
        }
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
    }
}
