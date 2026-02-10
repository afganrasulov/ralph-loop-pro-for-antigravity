import * as http2 from 'http2';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Probe Antigravity API to discover valid model IDs.
 * Sends a minimal message with each candidate ID and checks the response.
 */

function ldField(tag: number, data: string | Buffer): Buffer {
    const tagByte = (tag << 3) | 2;
    const body = typeof data === 'string' ? Buffer.from(data) : data;
    let l = body.length;
    let lenBytes: number[] = [];
    if (l < 128) { lenBytes = [l]; } else { lenBytes = [(l & 0x7F) | 0x80, l >> 7]; }
    return Buffer.concat([Buffer.from([tagByte]), Buffer.from(lenBytes), body]);
}

function encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80);
        value >>= 7;
    }
    bytes.push(value & 0x7f);
    return Buffer.from(bytes);
}

function buildSafetyConfig(modelId: number): Buffer {
    const modelIdVarint = encodeVarint(modelId);
    const modelField = Buffer.concat([
        Buffer.from([0x08]),
        modelIdVarint,
    ]);
    const field15 = Buffer.concat([
        Buffer.from([0x7a]),
        Buffer.from([modelField.length]),
        modelField,
    ]);

    const beforeModel = Buffer.from(
        '0a631204200170006a4c42451a43120275761a07676974206164641a096769742073746173681a096769742072657365741a0c67697420636865636b6f75741a09707974686f6e202d631a0370697030038a02020801',
        'hex',
    );
    const afterModel = Buffer.from('aa0102080182020208013a0208015801', 'hex');
    const innerContent = Buffer.concat([beforeModel, field15, afterModel]);

    return Buffer.concat([
        Buffer.from([0x2a]),
        encodeVarint(innerContent.length),
        innerContent,
    ]);
}

async function probeGrpcPort(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        try {
            const client = http2.connect(`https://127.0.0.1:${port}`, { rejectUnauthorized: false });
            client.on('error', () => { clearTimeout(timeout); client.close(); resolve(false); });
            client.on('connect', () => {
                const metadata = Buffer.concat([ldField(1, 'antigravity'), ldField(4, 'en')]);
                const payload = ldField(1, metadata);
                const req = client.request({
                    ':method': 'POST',
                    ':path': '/exa.language_server_pb.LanguageServerService/GetUnleashData',
                    'content-type': 'application/proto',
                    'connect-protocol-version': '1',
                    'x-codeium-csrf-token': csrfToken,
                    'content-length': payload.length.toString(),
                });
                req.on('response', (headers) => { clearTimeout(timeout); client.close(); resolve(headers[':status'] === 200); });
                req.on('error', () => { clearTimeout(timeout); client.close(); resolve(false); });
                req.write(payload);
                req.end();
            });
        } catch { clearTimeout(timeout); resolve(false); }
    });
}

async function extractCredentials(): Promise<{ port: number; csrfToken: string; oauthToken: string } | null> {
    try {
        let pid: number | null = null;
        let csrfToken: string | null = null;

        const psOutput = execSync('ps -ax -o pid=,command=', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        for (const line of psOutput.split('\n')) {
            const isLS = line.includes('language_server_macos') || line.includes('language_server');
            const isAG = line.includes('--app_data_dir antigravity') || line.toLowerCase().includes('/antigravity/');
            if (isLS && isAG) {
                const pidMatch = line.trim().match(/^(\d+)/);
                const csrfMatch = line.match(/--csrf_token\s+([a-f0-9-]+)/i);
                if (pidMatch) pid = parseInt(pidMatch[1], 10);
                if (csrfMatch) csrfToken = csrfMatch[1];
            }
        }

        if (!pid || !csrfToken) { console.error('Could not extract credentials'); return null; }
        console.log(`PID=${pid}, CSRF=${csrfToken.substring(0, 8)}...`);

        // Discover gRPC port
        const lsofOutput = execSync(`lsof -nP -iTCP -sTCP:LISTEN -p ${pid}`, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
        const ports: number[] = [];
        for (const line of lsofOutput.split('\n')) {
            if (line.includes('TCP') && line.includes('LISTEN')) {
                const m = line.match(/:(\d+)\s*\(LISTEN\)/);
                if (m && !ports.includes(parseInt(m[1]))) ports.push(parseInt(m[1]));
            }
        }

        let grpcPort: number | null = null;
        for (const port of ports) {
            if (await probeGrpcPort(port, csrfToken)) { grpcPort = port; break; }
        }
        if (!grpcPort) { console.error('No gRPC port found'); return null; }
        console.log(`gRPC port: ${grpcPort}`);

        // OAuth token
        const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
        let oauthToken: string | null = null;
        if (fs.existsSync(dbPath)) {
            const content = fs.readFileSync(dbPath).toString('utf8');
            const m = content.match(/ya29\.[A-Za-z0-9_-]{50,}/);
            if (m) oauthToken = m[0];
        }
        if (!oauthToken) { console.error('No OAuth token'); return null; }

        return { port: grpcPort, csrfToken, oauthToken };
    } catch (e) {
        console.error('Error:', e);
        return null;
    }
}

async function probeModelId(
    client: http2.ClientHttp2Session,
    cascadeId: string,
    modelId: number,
    csrfToken: string,
    oauthToken: string
): Promise<{ id: number; status: number; response: string }> {
    const buildMetadata = () => Buffer.concat([
        ldField(1, 'antigravity'),
        ldField(3, oauthToken),
        ldField(4, 'en'),
        ldField(7, '1.16.5'),
        ldField(12, 'antigravity'),
    ]);

    const messageBody = ldField(1, 'hi');
    const safetyConfig = buildSafetyConfig(modelId);
    const modeField = Buffer.from([0x70, 0x00]);

    const outer = Buffer.concat([
        ldField(1, cascadeId),
        ldField(2, messageBody),
        ldField(3, buildMetadata()),
        safetyConfig,
        modeField,
    ]);

    return new Promise((resolve) => {
        const req = client.request({
            ':method': 'POST',
            ':path': '/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage',
            'content-type': 'application/proto',
            'connect-protocol-version': '1',
            'origin': 'vscode-file://vscode-app',
            'x-codeium-csrf-token': csrfToken,
            'content-length': outer.length.toString()
        });

        let responseData = Buffer.alloc(0);
        req.on('data', (chunk: Buffer) => { responseData = Buffer.concat([responseData, chunk]); });
        req.on('response', (headers) => {
            const status = headers[':status'] as number;
            req.on('end', () => {
                const text = responseData.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
                resolve({ id: modelId, status, response: text.substring(0, 200) });
            });
        });
        req.on('error', (err) => {
            resolve({ id: modelId, status: -1, response: err.message });
        });

        req.write(outer);
        req.end();
    });
}

async function startCascade(
    client: http2.ClientHttp2Session,
    csrfToken: string,
    oauthToken: string
): Promise<string> {
    const buildMetadata = () => Buffer.concat([
        ldField(1, 'antigravity'),
        ldField(3, oauthToken),
        ldField(4, 'en'),
        ldField(7, '1.16.5'),
        ldField(12, 'antigravity'),
    ]);

    const inner = buildMetadata();
    const outer = Buffer.concat([
        ldField(1, inner),
        Buffer.from([0x20, 0x01])
    ]);

    return new Promise((resolve, reject) => {
        const req = client.request({
            ':method': 'POST',
            ':path': '/exa.language_server_pb.LanguageServerService/StartCascade',
            'content-type': 'application/proto',
            'connect-protocol-version': '1',
            'origin': 'vscode-file://vscode-app',
            'x-codeium-csrf-token': csrfToken,
            'content-length': outer.length.toString()
        });

        let responseData = Buffer.alloc(0);
        req.on('data', (chunk: Buffer) => { responseData = Buffer.concat([responseData, chunk as Uint8Array]); });
        req.on('end', () => {
            if (responseData.length > 0) {
                const len = responseData[1];
                const id = responseData.slice(2, 2 + len).toString();
                resolve(id);
            } else { reject(new Error('Empty response')); }
        });
        req.on('error', reject);
        req.write(outer);
        req.end();
    });
}

async function deleteCascade(client: http2.ClientHttp2Session, cascadeId: string, csrfToken: string): Promise<void> {
    const outer = ldField(1, cascadeId);
    return new Promise((resolve) => {
        const req = client.request({
            ':method': 'POST',
            ':path': '/exa.language_server_pb.LanguageServerService/DeleteCascadeTrajectory',
            'content-type': 'application/proto',
            'connect-protocol-version': '1',
            'origin': 'vscode-file://vscode-app',
            'x-codeium-csrf-token': csrfToken,
            'content-length': outer.length.toString()
        });
        req.on('response', () => resolve());
        req.on('error', () => resolve());
        req.write(outer);
        req.end();
    });
}

async function main() {
    const creds = await extractCredentials();
    if (!creds) { process.exit(1); }

    const client = http2.connect(`https://127.0.0.1:${creds.port}`, { rejectUnauthorized: false });

    // Candidate IDs to probe - range around known IDs and higher numbers
    const candidateIds = [
        // Known working IDs
        333, 334, 342, 1007, 1008, 1012, 1018,
        // Candidates for new Claude Opus 4.6
        1013, 1014, 1015, 1016, 1017, 1019, 1020, 1021, 1022, 1023, 1024, 1025,
        1026, 1027, 1028, 1029, 1030,
        // Higher ranges
        1050, 1100, 1150, 1200,
        // Lower range gaps
        335, 336, 337, 338, 339, 340, 341, 343, 344, 345,
    ];

    console.log(`\n=== Model ID Probe ===`);
    console.log(`Testing ${candidateIds.length} candidate IDs...\n`);

    for (const modelId of candidateIds) {
        try {
            const cascadeId = await startCascade(client, creds.csrfToken, creds.oauthToken);
            const result = await probeModelId(client, cascadeId, modelId, creds.csrfToken, creds.oauthToken);

            const statusIcon = result.status === 200 ? '✅' : '❌';
            const brief = result.response.substring(0, 100);
            console.log(`${statusIcon} ID ${modelId.toString().padStart(4)}: status=${result.status} | ${brief}`);

            // Clean up
            await deleteCascade(client, cascadeId, creds.csrfToken);

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        } catch (err: any) {
            console.log(`⚠️  ID ${modelId.toString().padStart(4)}: ERROR - ${err.message}`);
        }
    }

    client.close();
    console.log('\n=== Probe Complete ===');
}

main();
