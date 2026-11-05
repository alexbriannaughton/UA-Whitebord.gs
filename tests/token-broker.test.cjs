const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture(){
 const values=new Map();let requests=0;let sent;
 const credential={token:'Bearer shared',expiresAt:new Date(Date.now()+3600000).toISOString()};
 const cache={get:k=>values.get(k)||null,put:(k,v)=>values.set(k,v)};
 const context=vm.createContext({Date,JSON,Math,Error,
 CacheService:{getScriptCache:()=>cache},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='ezyvet_token_broker_url'?'https://example.supabase.co/functions/v1/ezyvet-token-broker':'secret'})},
 observeExternalCall:(_,fn)=>fn(),
 UrlFetchApp:{fetch:(_,options)=>{requests++;sent=JSON.parse(options.payload);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(credential)};}}});
 vm.runInContext("const TOKEN_NAME='broker';let token;let tokenCredential;"+fs.readFileSync(path.join(__dirname,'../src/Config.js'),'utf8'),context);
 return {context,values,credential,get requests(){return requests;},get sent(){return sent;}};
}
test('valid cache hit and runtime hit require no broker request',()=>{
 const f=fixture();f.values.set('broker',JSON.stringify(f.credential));
 assert.equal(vm.runInContext('getToken()',f.context),'Bearer shared');
 assert.equal(vm.runInContext('getToken()',f.context),'Bearer shared');assert.equal(f.requests,0);
});
test('cache eviction retrieves existing token without rejected token',()=>{
 const f=fixture();vm.runInContext('getToken()',f.context);assert.equal(f.requests,1);assert.deepEqual(f.sent,{});
});
test('401 forwards exact rejected token; newer cached token avoids broker',()=>{
 const f=fixture();vm.runInContext("token='Bearer old';updateToken()",f.context);
 assert.deepEqual(f.sent,{rejectedToken:'Bearer old'});
 f.values.set('broker',JSON.stringify({...f.credential,token:'Bearer newer'}));
 assert.equal(vm.runInContext('updateToken()',f.context),'Bearer newer');assert.equal(f.requests,1);
});
test('expired runtime and cache token cannot bypass broker',()=>{
 const f=fixture();f.values.set('broker',JSON.stringify({...f.credential,expiresAt:new Date(0).toISOString()}));
 vm.runInContext("tokenCredential={token:'Bearer expired',expiresAt:new Date(0).toISOString()};getToken()",f.context);assert.equal(f.requests,1);
});
test('cache write failure preserves the successfully retrieved token',()=>{
 const f=fixture();vm.runInContext("CacheService.getScriptCache().put=()=>{throw Error('cache unavailable')}",f.context);
 assert.equal(vm.runInContext('getToken()',f.context),'Bearer shared');assert.equal(f.requests,1);
});

// Local room replay: actual ezyVet read/retry and room-population functions;
// spreadsheet, speaker and remote services are synthetic and cannot reach Google.
function roomFixture({brokerDown=false,stale=false}={}) {
 const f=fixture();let calls=0,writes=0;const auth=[];
 f.values.set('broker',JSON.stringify({...f.credential,token:stale?'Bearer old':f.credential.token}));
 f.context.syntheticFetch=(url,options)=>{
   calls++;auth.push(options.headers.authorization);
   if(stale && options.headers.authorization==='Bearer old')return {getResponseCode:()=>401,getContentText:()=>'{"error":"expired"}'};
   const item=url.includes('/animal/')?{animal:{name:'Synthetic Pet',species_id:'1',is_hostile:'0'}}:{contact:{last_name:'Fixture'}};
   return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({items:[item]})};
 };
 f.context.recordRoomWrite=()=>{writes++;};
 vm.runInContext(`
   const EV_PROXY='https://synthetic.invalid';const SPECIES_MAP={'1':'Canine'};
   observedApiLabel=()=> 'synthetic';logObservedEvent=()=>{};const SITE_PREFIX='https://synthetic.invalid';
   UrlFetchApp.fetchAll=(requests)=>requests.map(r=>syntheticFetch(r.url,r));
   ${brokerDown?"UrlFetchApp.fetch=()=>{throw Error('synthetic broker outage')};":''}
 `+fs.readFileSync(path.join(__dirname,'../src/Helpers/Fetch.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../src/Webhook-Actions/MoveToRoom.js'),'utf8')+`
   getRoomColor=()=> 'synthetic';convertEpochToUserTimezone=()=> 'test time';
   simpleTextToRichText=x=>x;makeLink=x=>x;techText=()=>'';
   deleteFromWaitlist=()=>{};playRoomPopulatedSound=()=>{};
   function replayRoom(){
     const [name,species,last]=getAnimalInfoAndLastName(7,8);
     const range={offset(){return this;},setBackground(){},setRichTextValues(rows){
       if(!rows[1][0].includes('Synthetic Pet'))throw Error('wrong animal');recordRoomWrite();
     }};
     populateEmptyRoom({modified_at:1,consult_id:9,description:'Fixture',type_id:1,status_id:18},
       range,name+' '+last,name,'CH',Array(8).fill(''),false);
   }
 `,f.context);
 return {...f,get ezyvetCalls(){return calls;},get writes(){return writes;},auth};
}
test('room replay: valid cache preserves room write during complete broker outage',()=>{
 const f=roomFixture({brokerDown:true});vm.runInContext('replayRoom()',f.context);
 assert.equal(f.writes,1);assert.equal(f.ezyvetCalls,2);
});
test('room replay: rejected cache retrieves shared token and retries before write',()=>{
 const f=roomFixture({stale:true});vm.runInContext('replayRoom()',f.context);
 assert.equal(f.writes,1);assert.equal(f.ezyvetCalls,4);
 assert.deepEqual(f.auth,['Bearer old','Bearer old','Bearer shared','Bearer shared']);
});
test('room replay: broker outage with no valid token leaves sheet untouched',()=>{
 const f=roomFixture({brokerDown:true});f.values.clear();
 assert.throws(()=>vm.runInContext('replayRoom()',f.context),/synthetic broker outage/);
 assert.equal(f.writes,0);assert.equal(f.ezyvetCalls,0);
});
