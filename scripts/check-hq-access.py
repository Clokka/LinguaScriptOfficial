"""Non-destructive hosted HQ regression: team access, version guard, public denial."""
import json, os, urllib.request, urllib.error

def run():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        minted = json.load(f)
    session = minted['session']
    # Resolve the public client configuration without printing any session credentials.
    with open('.env') as f:
        config = dict(line.strip().split('=', 1) for line in f if line.startswith('VITE_SUPABASE_'))
    base = config['VITE_SUPABASE_URL'].strip('"')
    key = config['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')
    def rpc(name, body, authenticated=True):
        headers = {'apikey': key, 'Content-Type': 'application/json'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + session['access_token']
        request = urllib.request.Request(base + '/rest/v1/rpc/' + name, data=json.dumps(body).encode(), headers=headers)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
    status, before = rpc('get_live_site', {})
    assert status == 200, 'Live config must be readable'
    status, result = rpc('is_site_team', {'_uid': session['user']['id']})
    assert status == 200 and result is True, 'Requesting team account must have HQ access'
    status, result = rpc('publish_site', {'_config': {'version': 1}, '_note': None})
    assert status == 400 and result.get('message') == 'Unknown config version', 'Version 1 must be rejected before any publish'
    status, result = rpc('publish_site', {'_config': {'version': 2, 'home': {'mode': 'builtin'}}, '_note': None}, False)
    assert status in (401, 403), 'Anonymous visitors must not publish'
    status, result = rpc('get_live_site', {})
    assert status == 200 and result == before, 'Verification must leave live site unchanged'
    print('HQ access, version validation, anonymous denial and unchanged live site: passed')

if __name__ == '__main__':
    run()
