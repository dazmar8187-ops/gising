// GoHighLevel API v2 client for the Gising Sining House tools.
// Endpoints and payloads are taken from GHL's published OpenAPI files
// (github.com/GoHighLevel/highlevel-api-docs, apps/contacts.json, locations.json, objects.json, medias.json).
// Lines marked ASSUMPTION are shapes the OpenAPI files leave empty; they follow GHL's written docs and
// should be checked against a real sub-account the first time it's connected.
//
// Environment (Netlify → Site settings → Environment variables):
//   GHL_API_KEY       Private Integration token for the Gising Sining House sub-account
//   GHL_LOCATION_ID   the sub-account (location) id
// Zero dependencies: uses Node's global fetch.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export const RECORDS_OBJECT = process.env.GHL_RECORDS_OBJECT || "custom_objects.house_records";

export function configured() {
  return !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}
const loc = () => process.env.GHL_LOCATION_ID;

export class GhlError extends Error {
  constructor(status, body, path) { super(`GHL ${status} on ${path}`); this.status = status; this.body = body; }
}

async function call(method, path, { query, body, form } = {}) {
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  const headers = { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: VERSION, Accept: "application/json" };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new GhlError(res.status, data, path);
  return data;
}

// ---------- contacts ----------

// GET /contacts/search/duplicate?locationId&email : the documented way to find one contact by email.
// ASSUMPTION: response is { contact: {...} } or { contact: null } (the OpenAPI file leaves the 200 body undescribed).
export async function findContactByEmail(email) {
  const d = await call("GET", "/contacts/search/duplicate", { query: { locationId: loc(), email } });
  return (d && d.contact) || null;
}

export async function getContact(id) {
  const d = await call("GET", `/contacts/${encodeURIComponent(id)}`);
  return d.contact;
}

// PUT /contacts/{id}. customFields accepts [{ key, field_value }] ("Pass either id or key of custom field").
export async function updateContact(id, patch) {
  const d = await call("PUT", `/contacts/${encodeURIComponent(id)}`, { body: patch });
  return d.contact;
}

export async function setFields(id, fields) {
  const customFields = Object.entries(fields).map(([key, field_value]) => ({ key, field_value: field_value == null ? "" : String(field_value) }));
  return updateContact(id, { customFields });
}

export async function addTags(id, tags) { return call("POST", `/contacts/${encodeURIComponent(id)}/tags`, { body: { tags } }); }
export async function removeTags(id, tags) { return call("DELETE", `/contacts/${encodeURIComponent(id)}/tags`, { body: { tags } }); }
export async function addNote(id, body, title) { return call("POST", `/contacts/${encodeURIComponent(id)}/notes`, { body: { body, title } }); }

// POST /contacts/search (advanced filters).
// ASSUMPTION: body { locationId, page, pageLimit, filters: [{ field: "tags", operator: "contains", value }] } and
// response { contacts: [...], total } — the OpenAPI file leaves SearchBodyV2DTO empty; this follows GHL's search docs.
export async function searchContactsByTag(tag, { max = 1000 } = {}) {
  const out = [];
  for (let page = 1; out.length < max; page++) {
    const d = await call("POST", "/contacts/search", { body: { locationId: loc(), page, pageLimit: 100, filters: [{ field: "tags", operator: "contains", value: tag }] } });
    const list = (d && d.contacts) || [];
    out.push(...list);
    if (list.length < 100) break;
  }
  return out;
}

// Contacts return custom fields as [{ id, value }]. Map ids back to keys with the location's field list
// (GET /locations/{id}/customFields?model=contact → fieldKey "contact.city"). Cached per function instance.
let fieldMap = null;
export async function contactFieldMap(refresh) {
  if (fieldMap && !refresh) return fieldMap;
  const d = await call("GET", `/locations/${loc()}/customFields`, { query: { model: "contact" } });
  fieldMap = {};
  for (const f of (d && d.customFields) || []) fieldMap[f.id] = String(f.fieldKey || f.name).replace(/^contact\./, "");
  return fieldMap;
}
export async function fieldsOf(contact) {
  let map = await contactFieldMap();
  // A field added in GHL after this instance started isn't in the cached list yet: reload once.
  if ((contact.customFields || []).some((f) => !(f.id in map))) map = await contactFieldMap(true);
  const out = {};
  for (const f of contact.customFields || contact.customField || []) {
    const key = map[f.id] || f.key || f.id;
    out[key] = Array.isArray(f.value) ? f.value.join(", ") : (f.value ?? f.field_value ?? "");
  }
  return out;
}

// ---------- location custom values (feature flags, call links, digest text) ----------

export async function getCustomValue(name) {
  const d = await call("GET", `/locations/${loc()}/customValues`);
  return ((d && d.customValues) || []).find((v) => v.name === name) || null;
}
export async function setCustomValue(name, value) {
  const existing = await getCustomValue(name);
  if (existing) return (await call("PUT", `/locations/${loc()}/customValues/${existing.id}`, { body: { name, value } })).customValue;
  return (await call("POST", `/locations/${loc()}/customValues`, { body: { name, value } })).customValue;
}
export async function getJsonValue(name, fallback) {
  const v = await getCustomValue(name);
  if (!v || !v.value) return fallback;
  try { return JSON.parse(v.value); } catch { return fallback; }
}

// ---------- custom object records (writing rooms, Pro Desk, member data, feature stores) ----------
// Object "House records" (key custom_objects.house_records) with fields: ns, key, owner, json (see ghl/SETUP.md).
// ASSUMPTION: create/update body is { locationId, properties: { ns, key, owner, json } } with unprefixed field keys,
// matching the IRecordSchema example in objects.json.

export async function searchRecords(ns, { max = 2000 } = {}) {
  const out = [];
  let searchAfter = [];
  for (let page = 1; out.length < max; page++) {
    const d = await call("POST", `/objects/${RECORDS_OBJECT}/records/search`, { body: { locationId: loc(), page, pageLimit: 100, query: `ns:${ns}`, searchAfter } });
    const list = (d && d.records) || [];
    // "ns:room" can also match "ns:rooms"; keep exact matches only.
    out.push(...list.filter((r) => r.properties && r.properties.ns === ns));
    if (list.length < 100) break;
    searchAfter = list[list.length - 1].searchAfter || [];
  }
  return out;
}
export async function createRecord(props) {
  const d = await call("POST", `/objects/${RECORDS_OBJECT}/records`, { body: { locationId: loc(), properties: props } });
  return d.record;
}
export async function updateRecord(id, props) {
  const d = await call("PUT", `/objects/${RECORDS_OBJECT}/records/${encodeURIComponent(id)}`, { query: { locationId: loc() }, body: { properties: props } });
  return d.record;
}
export async function deleteRecord(id) {
  return call("DELETE", `/objects/${RECORDS_OBJECT}/records/${encodeURIComponent(id)}`);
}

// ---------- media (profile photos) ----------
// POST /medias/upload-file, multipart: file (binary) + name. Returns { fileId, url }. Max 25 MB.
export async function uploadDataUrl(dataUrl, name) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), name);
  form.append("name", name);
  const d = await call("POST", "/medias/upload-file", { form });
  return d && d.url;
}
