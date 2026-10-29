import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:net";
import assert from "node:assert/strict";
const digest = (s) => createHash("sha256").update(s).digest("hex");
const dir = await mkdtemp(join(tmpdir(), "devflow-pg-"));
const probe = createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const pg = new EmbeddedPostgres({
  databaseDir: join(dir, "data"),
  user: "postgres",
  password: randomBytes(24).toString("hex"),
  port,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
let client;
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${count}: ${name}`);
}
const u1 = randomUUID(),
  u2 = randomUUID();
const capture = {
  pageTitle: "Observed failure",
  url: "https://example.com",
  selectedText: "Error displayed",
  capturedAt: "2026-10-29T10:00:00Z",
};
const report = {
  title: "Review error",
  summary: "Review evidence",
  issueType: "bug",
  priority: "medium",
  actualBehavior: null,
  expectedBehavior: null,
  reproductionSteps: [],
  possibleCause: null,
  suggestedFix: null,
  missingInformation: [],
  evidence: [
    { kind: "selection", content: "Error displayed", source: "observed" },
  ],
  aiFields: [],
};
try {
  await pg.initialise();
  await pg.start();
  client = pg.getPgClient();
  await client.connect();
  await client.query(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  await check("migration applies transactionally", async () =>
    client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202610290001_core.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  await client.query("insert into auth.users(id) values($1),($2)", [u1, u2]);
  await check("profiles are created by auth trigger", async () =>
    assert.equal((await client.query("select * from profiles")).rowCount, 2),
  );
  let issue;
  await check("draft and browser evidence persist atomically", async () => {
    issue = (
      await client.query("select * from create_issue($1,$2,$3,$4,$5)", [
        u1,
        report,
        capture,
        "owner",
        "repo",
      ])
    ).rows[0];
    assert.equal(issue.status, "draft");
    assert.equal(
      (
        await client.query("select * from issue_evidence where issue_id=$1", [
          issue.id,
        ])
      ).rowCount,
      1,
    );
  });
  await check("invalid evidence rolls back its draft", async () => {
    const before = (await client.query("select count(*)::int n from issues"))
      .rows[0].n;
    await assert.rejects(() =>
      client.query("select * from create_issue($1,$2,$3,$4,$5)", [
        u1,
        report,
        {},
        "owner",
        "repo",
      ]),
    );
    assert.equal(
      (await client.query("select count(*)::int n from issues")).rows[0].n,
      before,
    );
  });
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
    u2,
  ]);
  await check("RLS hides another user issues", async () =>
    assert.equal((await client.query("select * from issues")).rowCount, 0),
  );
  await check("RLS hides another user evidence", async () =>
    assert.equal(
      (await client.query("select * from issue_evidence")).rowCount,
      0,
    ),
  );
  await check("RLS hides another user audit events", async () =>
    assert.equal(
      (await client.query("select * from issue_events")).rowCount,
      0,
    ),
  );
  await check("browser cannot read GitHub credentials", async () =>
    assert.rejects(
      () => client.query("select * from github_connections"),
      /permission denied/,
    ),
  );
  await check("browser cannot read pairing hashes", async () =>
    assert.rejects(
      () => client.query("select * from extension_pairings"),
      /permission denied/,
    ),
  );
  await check("browser cannot read scoped token hashes", async () =>
    assert.rejects(
      () => client.query("select * from extension_sessions"),
      /permission denied/,
    ),
  );
  await check("browser cannot call service RPC with forged user", async () =>
    assert.rejects(
      () =>
        client.query("select * from claim_publish($1,$2,$3)", [
          u1,
          issue.id,
          randomUUID(),
        ]),
      /permission denied/,
    ),
  );
  await check("browser cannot change publication status", async () =>
    assert.rejects(
      () =>
        client.query("update issues set status='publishing' where id=$1", [
          issue.id,
        ]),
      /permission denied/,
    ),
  );
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
    u1,
  ]);
  await check("owner can read own draft via RLS", async () =>
    assert.equal(
      (await client.query("select * from issues")).rows[0].id,
      issue.id,
    ),
  );
  await client.query("reset role");
  await check("service edits enforce ownership", async () =>
    assert.rejects(
      () =>
        client.query("select * from edit_issue($1,$2,$3)", [
          u2,
          issue.id,
          report,
        ]),
      /not_found/,
    ),
  );
  await check("draft edit persists and records priority", async () => {
    const r = (
      await client.query("select * from edit_issue($1,$2,$3)", [
        u1,
        issue.id,
        { ...report, priority: "high" },
      ])
    ).rows[0];
    assert.equal(r.priority, "high");
  });
  const key = randomUUID();
  await check(
    "concurrent publish clicks acquire exactly one claim",
    async () => {
      const c2 = pg.getPgClient();
      await c2.connect();
      try {
        const results = await Promise.all([
          client.query("select claim_publish($1,$2,$3) r", [u1, issue.id, key]),
          c2.query("select claim_publish($1,$2,$3) r", [u1, issue.id, key]),
        ]);
        assert.equal(results.filter((r) => r.rows[0].r.claimed).length, 1);
      } finally {
        await c2.end();
      }
    },
  );
  await check("idempotency key conflicts are rejected", async () =>
    assert.rejects(
      () =>
        client.query("select claim_publish($1,$2,$3)", [
          u1,
          issue.id,
          randomUUID(),
        ]),
      /idempotency_conflict/,
    ),
  );
  await check("publishing draft cannot be edited concurrently", async () =>
    assert.rejects(
      () =>
        client.query("select * from edit_issue($1,$2,$3)", [
          u1,
          issue.id,
          report,
        ]),
      /not_editable/,
    ),
  );
  await check("publication outcome can be marked uncertain", async () => {
    assert.equal(
      (
        await client.query(
          "select * from finish_publish($1,$2,$3,'publish_unknown')",
          [u1, issue.id, key],
        )
      ).rows[0].status,
      "publish_unknown",
    );
  });
  await check("unknown outcome never acquires a retry claim", async () =>
    assert.equal(
      (
        await client.query("select claim_publish($1,$2,$3) r", [
          u1,
          issue.id,
          key,
        ])
      ).rows[0].r.claimed,
      false,
    ),
  );
  await check(
    "unknown outcome cannot be cleared to failed for retry",
    async () =>
      assert.rejects(
        () =>
          client.query("select * from finish_publish($1,$2,$3,'failed')", [
            u1,
            issue.id,
            key,
          ]),
        /invalid_transition/,
      ),
  );
  await check("reconciliation persists known remote result", async () => {
    const r = (
      await client.query(
        "select * from finish_publish($1,$2,$3,'published',42,'https://github.com/owner/repo/issues/42')",
        [u1, issue.id, key],
      )
    ).rows[0];
    assert.equal(r.status, "published");
    assert.equal(r.github_issue_number, 42);
  });
  await check("published issue is idempotent", async () =>
    assert.equal(
      (
        await client.query("select claim_publish($1,$2,$3) r", [
          u1,
          issue.id,
          key,
        ])
      ).rows[0].r.claimed,
      false,
    ),
  );
  await check("audit events record safe publication transitions", async () => {
    const events = (
      await client.query(
        "select event_type from issue_events where issue_id=$1",
        [issue.id],
      )
    ).rows.map((r) => r.event_type);
    assert.ok(events.includes("draft_created"));
    assert.ok(events.includes("publish_started"));
    assert.ok(events.includes("publish_published"));
  });
  await check("cross-owner evidence foreign key is enforced", async () =>
    assert.rejects(
      () =>
        client.query(
          "insert into issue_evidence(issue_id,user_id,source_title,source_url,selected_text,provenance) values($1,$2,'x','x','x','{}')",
          [issue.id, u2],
        ),
      /foreign key/,
    ),
  );
  await check("rate limit is shared and bounded", async () => {
    const k = randomUUID();
    for (let i = 0; i < 3; i++)
      assert.equal(
        (await client.query("select take_rate_limit($1,3) ok", [k])).rows[0].ok,
        true,
      );
    assert.equal(
      (await client.query("select take_rate_limit($1,3) ok", [k])).rows[0].ok,
      false,
    );
  });
  const pairingId = randomUUID(),
    polling = randomBytes(32).toString("hex"),
    token = randomBytes(32).toString("hex");
  await client.query(
    "insert into extension_pairings(id,polling_hash,code) values($1,$2,$3)",
    [pairingId, digest(polling), "A1B2C3D4"],
  );
  await check("pairing is pending until explicit approval", async () =>
    assert.equal(
      (
        await client.query("select exchange_pairing($1,$2,$3) r", [
          pairingId,
          digest(polling),
          digest(token),
        ])
      ).rows[0].r.status,
      "pending",
    ),
  );
  await check("incorrect polling secret is denied", async () =>
    assert.rejects(
      () =>
        client.query("select exchange_pairing($1,$2,$3)", [
          pairingId,
          digest("wrong"),
          digest(token),
        ]),
      /pairing_invalid/,
    ),
  );
  await check("authenticated approval binds pairing to user", async () =>
    assert.equal(
      (await client.query("select confirm_pairing($1,$2) id", [u1, "A1B2C3D4"]))
        .rows[0].id,
      pairingId,
    ),
  );
  await check("another account cannot re-approve pairing", async () =>
    assert.rejects(
      () => client.query("select confirm_pairing($1,$2)", [u2, "A1B2C3D4"]),
      /pairing_invalid/,
    ),
  );
  let sessionId;
  await check(
    "approved exchange creates hashed one-hour scoped session",
    async () => {
      const r = (
        await client.query("select exchange_pairing($1,$2,$3) r", [
          pairingId,
          digest(polling),
          digest(token),
        ])
      ).rows[0].r;
      assert.equal(r.status, "approved");
      sessionId = r.sessionId;
      const session = (
        await client.query("select * from extension_sessions where id=$1", [
          sessionId,
        ])
      ).rows[0];
      assert.equal(session.user_id, u1);
      assert.equal(session.token_hash, digest(token));
      assert.ok(session.scopes.includes("analyze"));
      assert.ok(new Date(session.expires_at) > new Date());
    },
  );
  await check("pairing exchange rejects replay", async () =>
    assert.rejects(
      () =>
        client.query("select exchange_pairing($1,$2,$3)", [
          pairingId,
          digest(polling),
          digest(token),
        ]),
      /pairing_invalid/,
    ),
  );
  await check("revocation preserves session ownership", async () => {
    assert.equal(
      (
        await client.query(
          "update extension_sessions set revoked_at=now() where id=$1 and user_id=$2",
          [sessionId, u2],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await client.query(
          "update extension_sessions set revoked_at=now() where id=$1 and user_id=$2",
          [sessionId, u1],
        )
      ).rowCount,
      1,
    );
  });
  const expired = randomUUID();
  await client.query(
    "insert into extension_pairings(id,polling_hash,code,expires_at) values($1,$2,'DEADBEEF',now()-interval '1 second')",
    [expired, digest("expired")],
  );
  await check("expired pairing cannot be approved", async () =>
    assert.rejects(
      () => client.query("select confirm_pairing($1,'DEADBEEF')", [u1]),
      /pairing_invalid/,
    ),
  );
  await check("expired pairing cannot be exchanged", async () =>
    assert.rejects(
      () =>
        client.query("select exchange_pairing($1,$2,$3)", [
          expired,
          digest("expired"),
          digest("new"),
        ]),
      /pairing_invalid/,
    ),
  );
  console.log(
    `Database validation: ${count} checks passed (isolated PostgreSQL, Supabase auth schema stub).`,
  );
} finally {
  await client?.end();
  await pg.stop();
  await rm(dir, { recursive: true, force: true });
}
