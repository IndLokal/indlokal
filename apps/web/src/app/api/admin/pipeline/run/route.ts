import { NextResponse } from 'next/server';
import { assertCan } from '@/lib/auth/permissions';
import { runPipeline } from '@/modules/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  try {
    await assertCan('pipeline.run');
    const result = await runPipeline('admin');
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[admin/pipeline/run]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
