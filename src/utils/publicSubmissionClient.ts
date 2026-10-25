export type PublicSubmissionResult =
  | { success: true; body: Record<string, unknown> }
  | { success: false; message: string };

const FAILURE_MESSAGE = 'The submission could not be accepted. Please try again later.';

/** Treat only a successful HTTP response with a valid success payload as acceptance. */
export async function postPublicSubmission(
  url: string,
  payload: Record<string, unknown>,
  request: typeof fetch = fetch,
): Promise<PublicSubmissionResult> {
  try {
    const response = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { success: false, message: FAILURE_MESSAGE };

    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || (body as Record<string, unknown>).success !== true) {
      return { success: false, message: FAILURE_MESSAGE };
    }
    const record = body as Record<string, unknown>;
    const hasAcknowledgment = (typeof record.message === 'string' && record.message.trim().length > 0) ||
      (record.data !== null && typeof record.data === 'object' && !Array.isArray(record.data));
    if (!hasAcknowledgment) return { success: false, message: FAILURE_MESSAGE };
    return { success: true, body: record };
  } catch {
    return { success: false, message: FAILURE_MESSAGE };
  }
}
