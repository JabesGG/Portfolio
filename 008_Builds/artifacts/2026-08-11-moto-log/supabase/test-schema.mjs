// Runs schema.sql in an embedded Postgres with a minimal stand-in for
// Supabase's auth and storage schemas, then checks the trigger and the
// row-level security as two different riders.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "  ok   " : "  FAIL ") + label + (ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
};

// --- stand-in for what Supabase provides -------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant usage, select on sequence storage.objects_id_seq to authenticated;
  insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
`);

const sql = fs.readFileSync(process.argv[2], "utf8");
await db.exec(sql);
await db.exec(sql);   // running it twice must be harmless
console.log("  ok   schema runs, and runs again");

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
async function as(user, q, params = []) {
  await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`
                     : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await db.query(q, params); }
  finally { await db.exec(`reset role;`); }
}
async function err(user, q, params = []) {
  try { await as(user, q, params); return "no error"; } catch (e) { return String(e.message).slice(0, 120); }
}

// --- rider A writes -----------------------------------------------------
await as(A, `insert into public.entries (id, bike_id, type, date, amount, data, updated_at)
             values ('e1', 'b1', 'fuel', '2026-11-01', 22.8, '{"x":1}', '2026-11-01T10:00:00Z')`);
let r = await as(A, `select user_id, id, synced_at is not null as stamped from public.entries`);
check("A's insert is filed under A, with a server time", r.rows, [{ user_id: A, id: "e1", stamped: true }]);

// --- B cannot see or touch A's rows --------------------------------------
check("B sees none of A's rows", (await as(B, `select * from public.entries`)).rows.length, 0);
await as(B, `update public.entries set data = '{"hacked":1}' where id = 'e1'`);
await as(B, `delete from public.entries where id = 'e1'`);
check("B's update and delete hit nothing", (await as(A, `select data from public.entries where id='e1'`)).rows[0].data, { x: 1 });
check("B cannot write a row in A's name",
  await err(B, `insert into public.entries (user_id, id, bike_id, data, updated_at) values ($1, 'e9', 'b1', '{}', now())`, [A]),
  "new row violates row-level security policy for table \"entries\"");
check("signed-out visitors cannot read", await err(null, `select * from public.entries`), "permission denied for table entries");
check("signed-out visitors cannot write", await err(null, `insert into public.bikes (id, data, updated_at) values ('x', '{}', now())`), "permission denied for table bikes");

// --- same id, two riders: no clash ---------------------------------------
await as(B, `insert into public.entries (id, bike_id, data, updated_at) values ('e1', 'b9', '{"b":1}', now())`);
check("two riders can use the same record id", (await as(B, `select data from public.entries`)).rows[0].data, { b: 1 });

// --- last write wins, by when the rider made the change -------------------
const s1 = (await as(A, `select synced_at from public.entries where id='e1'`)).rows[0].synced_at;
await as(A, `insert into public.entries (id, bike_id, data, updated_at) values ('e1', 'b1', '{"x":0}', '2026-10-01T00:00:00Z')
             on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at`);
r = (await as(A, `select data, synced_at from public.entries where id='e1'`)).rows[0];
check("an older edit arriving late does not overwrite", r.data, { x: 1 });
check("…and does not count as a change", r.synced_at.getTime(), s1.getTime());
await as(A, `insert into public.entries (id, bike_id, data, updated_at, deleted) values ('e1', 'b1', '{}', '2026-11-02T00:00:00Z', true)
             on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted`);
r = (await as(A, `select deleted, synced_at from public.entries where id='e1'`)).rows[0];
check("a newer edit (here a deletion) goes through", r.deleted, true);
check("…and moves the server time on", r.synced_at > s1, true);

// --- a row cannot be moved to another rider ------------------------------
await as(A, `update public.entries set user_id = $1 where id = 'e1'`, [B]);
check("A cannot hand a row to B (it stays A's)", (await db.query(`select user_id from public.entries where id = 'e1' and bike_id = 'b1'`)).rows[0].user_id, A);

// --- settings and size limits --------------------------------------------
check("settings id must be 'me'", (await err(A, `insert into public.settings (id, data, updated_at) values ('x', '{}', now())`)).startsWith("new row for relation \"settings\" violates check"), true);
check("an oversized entry is refused", (await err(A, `insert into public.entries (id, bike_id, data, updated_at) values ('big', 'b1', jsonb_build_object('p', repeat('x', 60000)), now())`)).startsWith("new row for relation \"entries\" violates check"), true);
check("an unknown entry type is refused", (await err(A, `insert into public.entries (id, bike_id, type, data, updated_at) values ('t', 'b1', 'bribe', '{}', now())`)).startsWith("new row for relation \"entries\" violates check"), true);

// --- receipts --------------------------------------------------------------
check("bucket exists and is private", (await db.query(`select public, file_size_limit from storage.buckets where id='receipts'`)).rows, [{ public: false, file_size_limit: 2097152 }]);
await as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${A}/p1.jpg`]);
check("A can store a photo in A's folder", (await as(A, `select name from storage.objects`)).rows.length, 1);
check("A cannot store a photo in B's folder", await err(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${B}/p2.jpg`]),
  "new row violates row-level security policy for table \"objects\"");
check("B cannot see A's photos", (await as(B, `select name from storage.objects`)).rows.length, 0);

// --- closing an account from the app ---------------------------------------
check("a signed-out visitor can't call delete_me", await err(null, `select public.delete_me()`), "permission denied for function delete_me");
await as(B, `select public.delete_me()`);
check("delete_me removes only the caller", (await db.query(`select id from auth.users order by id`)).rows.map(r => r.id).join(","), A);
check("…and their rows go with them", (await db.query(`select count(*)::int as n from public.entries where user_id = '${B}'`)).rows[0].n, 0);
check("…leaving the other rider's", (await db.query(`select count(*)::int as n from public.entries where user_id = '${A}'`)).rows[0].n > 0, true);

// --- deleting the account takes the rows with it --------------------------
await db.exec(`delete from auth.users where id = '${A}'`);
check("deleting a rider removes their rows", (await db.query(`select count(*)::int as n from public.entries where user_id = '${A}'`)).rows[0].n, 0);

console.log(fails ? `\nFAILED ${fails}` : "\nAll schema checks passed");
process.exit(fails ? 1 : 0);
