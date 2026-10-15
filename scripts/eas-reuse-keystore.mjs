// Points EAS build credentials for one Android application id at a keystore
// that already exists for another id (same Expo project). Used when the
// package name's capitalisation changed (uk.co.linguascript.app →
// uk.co.LinguaScript.app): EAS treated that as a new app and generated a new
// keystore, but Google Play expects the original upload key.
//
// The keystore is chosen ONLY by an exact SHA-1 match with the key Google
// Play expects; if no keystore matches, nothing is changed.
//
// Env: EXPO_TOKEN, PROJECT (owner/slug), FROM_ID, TO_ID, WANT_SHA1, APPLY=1 to change.
const { EXPO_TOKEN, PROJECT, FROM_ID, TO_ID, WANT_SHA1, APPLY } = process.env;
const norm = (s) => String(s || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

async function gql(query, variables = {}) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${EXPO_TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors, null, 2));
  return body.data;
}

const CREDS = `query($fullName: String!, $id: String!) {
  app { byFullName(fullName: $fullName) {
    id
    androidAppCredentials(filter: { applicationIdentifier: $id }) {
      id applicationIdentifier
      androidAppBuildCredentialsList {
        id name isDefault
        androidKeystore { id keyAlias sha1CertificateFingerprint }
      }
    }
  } }
}`;

const fullName = `@${PROJECT}`;
const show = (label, data) => {
  const creds = data.app.byFullName.androidAppCredentials;
  console.log(`\n${label}:`);
  if (!creds.length) console.log('  (no credentials)');
  for (const c of creds) for (const b of c.androidAppBuildCredentialsList)
    console.log(`  ${c.applicationIdentifier} | ${b.name} | default=${b.isDefault} | keystore ${b.androidKeystore?.id} | SHA1 ${b.androidKeystore?.sha1CertificateFingerprint}`);
  return creds;
};

const from = show(`Credentials for ${FROM_ID}`, await gql(CREDS, { fullName, id: FROM_ID }));
const to = show(`Credentials for ${TO_ID}`, await gql(CREDS, { fullName, id: TO_ID }));

const keystore = from.flatMap((c) => c.androidAppBuildCredentialsList)
  .map((b) => b.androidKeystore)
  .find((k) => k && norm(k.sha1CertificateFingerprint) === norm(WANT_SHA1));
if (!keystore) {
  console.log(`\nNo keystore with SHA1 ${WANT_SHA1} under ${FROM_ID}. Nothing changed.`);
  process.exit(1);
}
console.log(`\nFound the Play upload key (exact SHA1 match): keystore ${keystore.id}`);

const target = to[0]?.androidAppBuildCredentialsList.find((b) => b.isDefault)
  || to[0]?.androidAppBuildCredentialsList[0];
if (!target) throw new Error(`${TO_ID} has no build credentials to update. Nothing changed.`);
if (norm(target.androidKeystore?.sha1CertificateFingerprint) === norm(WANT_SHA1)) {
  console.log(`${TO_ID} already uses the Play upload key. Nothing to do.`);
  process.exit(0);
}
if (!APPLY) { console.log('Dry run (APPLY not set). Nothing changed.'); process.exit(0); }

await gql(`mutation($id: ID!, $keystoreId: ID!) {
  androidAppBuildCredentials { setKeystore(id: $id, keystoreId: $keystoreId) { id } }
}`, { id: target.id, keystoreId: keystore.id });
console.log(`Set ${TO_ID} build credentials "${target.name}" → keystore ${keystore.id}`);
console.log(`(The previous keystore ${target.androidKeystore?.id} still exists on EAS.)`);
show(`Credentials for ${TO_ID} (after)`, await gql(CREDS, { fullName, id: TO_ID }));
