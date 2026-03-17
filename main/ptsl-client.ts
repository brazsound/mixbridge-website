import * as grpc from '@grpc/grpc-js';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import {
  CommandId,
  PTSL_VERSION,
  PTSL_VERSION_MINOR,
  PTSL_VERSION_REVISION,
  TaskStatus,
} from './ptsl-commands';

const PROTO_PATH = path.join(__dirname, '..', 'ptsl-proto', 'ptsl_minimal.proto');
const PTSL_ADDRESS = 'localhost:31416';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: Number,
  defaults: true,
  oneofs: true,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ptslProto = (grpc.loadPackageDefinition(packageDefinition) as any).ptsl;
const PTSLClient = ptslProto.PTSL;

export interface SendRequestOptions {
  command: number;
  body: Record<string, unknown> | null;
  sessionId?: string | null;
}

export interface SendRequestResult {
  success: boolean;
  status: number;
  bodyJson: string | null;
  errorJson: string | null;
}

function generateTaskId(): string {
  return `stem-app-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class PTSLClientWrapper {
  private client: InstanceType<typeof PTSLClient> | null = null;
  private sessionId: string | null = null;

  connect(): Promise<void> {
    return new Promise((resolve) => {
      this.client = new PTSLClient(PTSL_ADDRESS, grpc.credentials.createInsecure());
      // Connection is lazy; we'll detect failure on first request
      resolve();
    });
  }

  disconnect(): void {
    if (this.client) {
      try {
        this.client.close();
      } catch (_) {}
      this.client = null;
    }
    this.sessionId = null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(id: string | null): void {
    this.sessionId = id;
  }

  sendRequest(options: SendRequestOptions): Promise<SendRequestResult> {
    const { command, body, sessionId } = options;
    const sid = sessionId !== undefined ? sessionId : this.sessionId;

    return new Promise((resolve) => {
      if (!this.client) {
        resolve({
          success: false,
          status: TaskStatus.Failed,
          bodyJson: null,
          errorJson: JSON.stringify({ error: 'Not connected' }),
        });
        return;
      }

      const request = {
        header: {
          task_id: generateTaskId(),
          command,
          version: PTSL_VERSION,
          session_id: sid || '',
          version_minor: PTSL_VERSION_MINOR,
          version_revision: PTSL_VERSION_REVISION,
          versioned_request_header_json: '',
        },
        request_body_json: body ? JSON.stringify(body) : '{}',
      };

      // JS-level timeout: resolves with a timeout error if the gRPC callback
      // never fires (e.g. Pro Tools stopped responding mid-session).
      // ExportMix/BounceTrack can take 30+ seconds for long sessions or MP3 encoding.
      const TIMEOUT_MS = 90_000; // 90s for bounces, imports, and other long operations
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({
            success: false,
            status: TaskStatus.Failed,
            bodyJson: null,
            errorJson: `Request timed out after ${TIMEOUT_MS / 1000}s — Pro Tools may not be responding`,
          });
        }
      }, TIMEOUT_MS);

      this.client.SendGrpcRequest(request, (err: Error | null, response: { header: { status: number }; response_body_json?: string; response_error_json?: string }) => {
        if (settled) return; // already timed out
        settled = true;
        clearTimeout(timer);
        if (err) {
          resolve({
            success: false,
            status: TaskStatus.Failed,
            bodyJson: null,
            errorJson: err.message || JSON.stringify(err),
          });
          return;
        }
        const status = response?.header?.status ?? TaskStatus.Failed;
        const success = status === TaskStatus.Completed;
        resolve({
          success,
          status,
          bodyJson: response?.response_body_json ?? null,
          errorJson: response?.response_error_json ?? null,
        });
      });
    });
  }

  async registerConnection(companyName: string, applicationName: string): Promise<{ sessionId: string } | { error: string }> {
    const result = await this.sendRequest({
      command: CommandId.RegisterConnection,
      body: { company_name: companyName, application_name: applicationName },
      sessionId: null,
    });
    if (!result.success) {
      return { error: result.errorJson || 'RegisterConnection failed' };
    }
    let body: { session_id?: string };
    try {
      body = result.bodyJson ? JSON.parse(result.bodyJson) : {};
    } catch {
      return { error: 'Invalid RegisterConnection response' };
    }
    const sessionId = body.session_id;
    if (!sessionId) return { error: 'No session_id in response' };
    this.sessionId = sessionId;
    return { sessionId };
  }
}

export { CommandId, TaskStatus };
