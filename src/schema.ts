import { z } from 'zod';
import { ToolError, type RawContent, type Tools } from './tools.js';

/** Tool descriptions and input schemas, shared by the Agent SDK server and the stdio MCP server. */
export const toolDefs = {
  list_pending: {
    description: 'List physiotherapist applications waiting for admin review (uid, date, resubmission count). No personal data.',
    shape: {}
  },
  get_application: {
    description:
      'Get one pending application: name, masked contact details, province/district, specializations, about text, and the ' +
      'results of the automated checks (province/district, specializations, phone/email format, consent, duplicates). ' +
      'Findings with severity "block" mean the application cannot be approved as it is.',
    shape: { uid: z.string() }
  },
  view_diploma: {
    description:
      'Look at the uploaded graduation document (diploma) as an image. Read the name, university, department and graduation year, ' +
      'and judge whether it is legible. Required before save_recommendation.',
    shape: { uid: z.string() }
  },
  save_recommendation: {
    description:
      'Save your recommendation for the admin: approve, request_info (fixable: missing/unclear info or document) or reject ' +
      '(not a physiotherapist, identity mismatch, duplicate). This never changes the application; the admin decides in the admin app. ' +
      'Approve is refused by code unless every automated check passes and the diploma name, department and university check out. ' +
      'For request_info/reject choose the admin app preset and write a short, polite Turkish message to the applicant that says exactly what to fix.',
    shape: {
      uid: z.string(),
      decision: z.enum(['approve', 'request_info', 'reject']),
      preset: z
        .enum(['doc', 'identity', 'quality', 'duplicate', 'other'])
        .nullable()
        .optional()
        .describe('doc = document unreadable/missing/invalid; identity = document does not match account; quality = does not meet professional requirements; duplicate = repeated or previously rejected; other = anything else'),
      reasons: z.array(z.string()).min(1).max(8).describe('Short reasons for the admin, in Turkish'),
      diploma: z.object({
        readable: z.boolean(),
        name_on_document: z.string(),
        university: z.string(),
        department: z.string(),
        graduation_year: z.number().int().nullable().optional()
      }),
      message_to_applicant: z.string().nullable().optional().describe('Turkish, 20-500 chars; required unless approve')
    }
  },
  write_report: {
    description: 'Write the run summary for the admin as Markdown (Turkish): one line per application with the recommendation and why, plus anything suspicious.',
    shape: { markdown: z.string().min(20) }
  }
} as const;

export type ToolName = keyof typeof toolDefs;

export async function callTool(tools: Tools, name: ToolName, args: unknown) {
  try {
    const out = await (tools[name] as (a: unknown) => Promise<unknown>)(args ?? {});
    if (out && typeof out === 'object' && '__content' in out) return { content: (out as RawContent).__content };
    return { content: [{ type: 'text' as const, text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    const msg = e instanceof ToolError ? e.message : `Unexpected error: ${(e as Error).message}`;
    return { content: [{ type: 'text' as const, text: msg }], isError: true };
  }
}
