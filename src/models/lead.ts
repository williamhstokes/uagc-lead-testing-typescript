import type { YesNo } from '../config/environment';

export interface LeadTestData {
  runId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  stateLabel: string;
  interestLabel: string | undefined;
  degreeLabel: string | undefined;
  rnAnswer: YesNo;
  militaryAnswer: YesNo;
  consent: boolean;
}

export interface ParsedRequestBody {
  contentType: string;
  raw: string;
  values: Record<string, string[]>;
}

export interface CapturedNetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  body: ParsedRequestBody;
  matchedBy: 'test-identity' | 'endpoint-pattern';
  capturedAt: string;
}

export interface BlockedNetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  reason: string;
  blockedAt: string;
}
