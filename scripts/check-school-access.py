import json,os,urllib.request,urllib.error
session=json.loads(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])
config={}
with open('/dev-server/.env') as f:
 for line in f:
  if line.startswith('VITE_SUPABASE_'):
   k,v=line.strip().split('=',1);config[k]=v.strip('"')
base=config['VITE_SUPABASE_URL'];key=config['VITE_SUPABASE_PUBLISHABLE_KEY']
def request(path,body=None,auth=False):
 headers={'apikey':key,'Content-Type':'application/json'}
 if auth:headers['Authorization']='Bearer '+session['access_token']
 req=urllib.request.Request(base+'/rest/v1/'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
before=request('rpc/get_live_site',{},True)
assert request('school_enquiries?select=id')[1]==[], 'Anonymous cannot read school leads'
status,body=request('rpc/submit_school_enquiry',{'_school':'X','_name':'X','_email':'invalid','_students':-1,'_needs':''})
assert status==400,'Invalid public enquiry must be rejected'
status,body=request('rpc/publish_site',{'_config':{'version':2,'home':{'mode':'bogus'}}},True)
assert status==400,'Invalid home mode must be rejected'
assert request('rpc/get_live_site',{},True)==before,'Publishing validation cannot change homepage'
status,body=request('rpc/school_class_progress',{'_school_id':'00000000-0000-0000-0000-000000000000'})
assert status in (400,401,403,404) and (body.get('message')=='not_authorized' or status in (401,403,404)), 'Anonymous cannot read a class'
print('Private enquiry inbox, invalid request rejection, publishing guard, anonymous class denial passed')
