/**
 * Journey coverage audit CLI — PRD/TDD-0053 §3.
 *
 * Reports, per city × persona × stage, how many journey-eligible components
 * exist and whether each persona's journey clears the PRD-0052 density gate.
 * It reuses the live composition path (`computeCityCoverage` → `composeJourney`
 * + `meetsDensityGate`), so a "READY" verdict means exactly "promotable".
 *
 * Usage:
 *   pnpm --filter web journey:coverage --city=stuttgart
 *   pnpm --filter web journey:coverage --city=stuttgart --persona=FAMILY
 *   pnpm --filter web journey:coverage --city=stuttgart --json
 */
import { journeys as j } from '@indlokal/shared';
import { db } from '@/lib/db';
import {
  computeCityCoverage,
  STAGE_ORDER,
  type CityCoverageReport,
  type JourneyPersona,
} from '@/modules/journeys';

interface Args {
  city: string;
  persona?: JourneyPersona;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  let city = '';
  let persona: JourneyPersona | undefined;
  let json = false;

  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
    } else if (arg.startsWith('--city=')) {
      city = arg.slice('--city='.length).trim().toLowerCase();
    } else if (arg.startsWith('--persona=')) {
      const raw = arg.slice('--persona='.length).trim().toUpperCase();
      const parsed = j.JourneyPersona.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `unknown persona "${raw}" — expected one of: ${j.JourneyPersona.options.join(', ')}`,
        );
      }
      persona = parsed.data as JourneyPersona;
    }
  }

  if (!city) {
    throw new Error('missing --city=<slug> (e.g. --city=stuttgart)');
  }
  return { city, persona, json };
}

function printTable(report: CityCoverageReport): void {
  const stageHeaders = STAGE_ORDER.map((s) => s.padStart(13)).join(' ');
  console.log(`\n🧭 Journey coverage — ${report.cityName} (${report.citySlug})`);
  console.log(`   generated ${report.generatedAt}\n`);
  console.log(`${'persona'.padEnd(16)} ${stageHeaders}  verdict`);
  console.log('-'.repeat(16 + stageHeaders.length + 12));

  for (const row of report.rows) {
    const cells = row.cells.map((c) => String(c.total).padStart(13)).join(' ');
    const verdict = row.verdict === 'READY' ? '✅ READY' : '⚠  THIN';
    console.log(`${row.label.padEnd(16)} ${cells}  ${verdict}`);
    if (row.gaps.length > 0) {
      for (const gap of row.gaps) console.log(`${' '.repeat(16)}   ↳ ${gap}`);
    }
  }

  console.log(
    `\n${report.readyCount}/${report.personaCount} persona journeys are READY (clear the density gate) in ${report.cityName}.\n`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const city = await db.city.findUnique({
    where: { slug: args.city },
    select: { name: true, isActive: true },
  });
  if (!city) {
    throw new Error(`city "${args.city}" not found`);
  }
  if (!city.isActive) {
    console.warn(`⚠ city "${args.city}" is not active — reporting coverage anyway.`);
  }

  const report = await computeCityCoverage({
    citySlug: args.city,
    cityName: city.name,
    ...(args.persona && { personas: [args.persona] }),
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTable(report);
  }
}

// Only run when invoked directly (not when imported by other scripts/tests).
if (process.argv[1] && process.argv[1].endsWith('journey-coverage.ts')) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
