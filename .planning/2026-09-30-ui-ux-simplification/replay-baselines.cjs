const { chromium } = require(process.env.PTW_UX_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const out=__dirname;
const report={method:'UI replay; all business writes intercepted in browser memory. One button/link=1 activation; native select open+choose=2. Text focus, keystrokes, scrolling and login excluded. Save receipts are simulated, not backend verification.',journeys:[],writes:[],errors:[]};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for (const persona of ['issuer','orgadmin']) {
   const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
   const page=await context.newPage();
   await page.goto('http://localhost:3000/login',{waitUntil:'networkidle'});
   const key=persona==='issuer'?'ISSUER':'ORGADMIN';
   const email=process.env['PTW_UX_'+key+'_EMAIL'], password=process.env['PTW_UX_'+key+'_PASSWORD'];
   if(!email||!password)throw new Error('Set PTW_UX_'+key+'_EMAIL and PTW_UX_'+key+'_PASSWORD for a documented local demo account');
   await page.locator('#email').fill(email);
   await page.locator('#password').fill(password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await page.waitForURL('**/dashboard');
   await page.waitForLoadState('networkidle');
   const memory={};let serial=700;
   await page.route('**/api/v1/**',async route=>{
    const req=route.request(),method=req.method(),url=new URL(req.url()),key=url.pathname.replace('/api/v1','');
    if(method==='GET') {
     if(memory[key]) {
      const response=await route.fetch();const body=await response.json();
      if(Array.isArray(body.data))body.data.push(...memory[key]);
      return route.fulfill({response,json:body});
     }
     return route.continue();
    }
    if(method==='OPTIONS')return route.continue();
    const payload=req.postDataJSON()||{};
    report.writes.push({method,path:key,keys:Object.keys(payload),simulated:true});
    const id='00000000-0000-4000-8000-'+String(serial++).padStart(12,'0');
    let data={id,status:'active',...payload};
    if(key==='/permits'||key.startsWith('/permits/'))data={permit:{id,status:'draft',...payload}};
    if(method==='POST'&&['/plants','/departments','/locations','/workstations','/employees'].includes(key)){
     (memory[key]??=[]).push(data);
    }
    await route.fulfill({status:200,json:{success:true,data}});
   });
   let journey;
   const begin=(name,start)=>{journey={name,start,steps:[],screens:[],typedFields:[],clicks:0};report.journeys.push(journey);};
   const screen=name=>journey.screens.push(name);
   const click=async(locator,label)=>{await locator.click();journey.steps.push({action:label,clicks:1});journey.clicks++;};
   const fill=async(locator,value,label)=>{await locator.fill(value);journey.typedFields.push(label);journey.steps.push({action:'Type '+label,clicks:0});};
   const select=async(locator,label,value)=>{
    await locator.locator('option').nth(1).waitFor({state:'attached'});
    const selected=value||await locator.locator('option').nth(1).getAttribute('value');
    await locator.selectOption(selected);journey.steps.push({action:'Select '+label,clicks:2});journey.clicks+=2;
   };
   if(persona==='issuer'){
    begin('P1 New permit issuer preparation','/permits');
    await page.goto('http://localhost:3000/permits',{waitUntil:'networkidle'});screen('Permit list');
    await click(page.getByRole('link',{name:/New permit|Create permit/i}).first(),'New permit');
    await page.waitForLoadState('networkidle');screen('Basic information');
    await click(page.getByRole('radio',{name:'General Work',exact:true}),'General Work type');
    await fill(page.locator('#title'),'Review benchmark task','Title');
    await fill(page.locator('#workScope'),'Inspect the marked walkway before routine work.','Work scope');
    await click(page.getByRole('button',{name:'Next',exact:true}),'Next');
    await page.locator('#plantId').waitFor();screen('Location and schedule');
    await select(page.locator('#plantId'),'Plant');
    await select(page.locator('#departmentId'),'Department');
    await select(page.locator('#locationId'),'Location');
    await select(page.locator('#primary-executor'),'Primary executor');
    await click(page.getByRole('button',{name:'Tomorrow, 08:00 to 16:00',exact:true}),'Tomorrow schedule');
    await click(page.getByRole('button',{name:'Save draft',exact:true}),'Save draft');
    await page.waitForLoadState('networkidle');
   } else {
    begin('H1 Four-record site hierarchy','/organisation/setup?step=profile');
    await page.goto('http://localhost:3000/organisation/setup?step=profile',{waitUntil:'networkidle'});screen('Setup profile');
    await click(page.getByRole('navigation',{name:'Setup steps'}).getByRole('button',{name:/^Plants\b/}),'Plants step');
    const records=[['Plant','plants','UX Bench Plant',null],['Department','departments','UX Bench Department','Plant'],['Location','locations','UX Bench Location','Plant'],['Workstation','workstations','UX Bench Workstation','Location']];
    for(let i=0;i<records.length;i++){
     const [label,key,name,parent]=records[i];screen(label+' form step');
     await click(page.getByRole('button',{name:'Add '+label.toLowerCase(),exact:true}).first(),'Open '+label);
     await fill(page.getByLabel(label+' name',{exact:true}),name,label+' name');
     if(parent){
      const value=memory[parent==='Plant'?'/plants':'/locations'][0].id;
      await select(page.locator('form select'),parent,value);
     }
     await click(page.locator('form').getByRole('button',{name:'Add '+label.toLowerCase(),exact:true}),'Save '+label);
     await page.waitForLoadState('networkidle');
     if(i<records.length-1)await click(page.getByRole('button',{name:'Next: '+records[i+1][0]+'s',exact:true}),'Next '+records[i+1][0]);
    }
    begin('E1 New employee with department','/workforce/directory');
    await page.goto('http://localhost:3000/workforce/directory',{waitUntil:'networkidle'});screen('Directory');
    await click(page.getByRole('link',{name:'Workforce',exact:true}).last(),'Back to workforce');screen('Workforce hub');
    await click(page.getByRole('link',{name:/Employees Your own staff/}),'Employees');
    await page.waitForLoadState('networkidle');screen('Employees');
    await click(page.getByRole('button',{name:/^Add /}).first(),'Add employee');
    await fill(page.getByLabel('Full name',{exact:false}),'Review Benchmark Person','Full name');
    await fill(page.locator('form input[type=email]'),'ux-benchmark@example.invalid','Email');
    await select(page.locator('form').getByLabel('Department',{exact:false}),'Department');
    await click(page.locator('form').getByRole('button',{name:/^Add /}),'Save employee');
    await page.waitForLoadState('networkidle');
   }
   await context.close();
  }
 }catch(e){report.errors.push(e.stack);process.exitCode=1;}
 finally{
  await browser.close();
  fs.writeFileSync(out+'/journey-baseline-replay.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({journeys:report.journeys.map(j=>({name:j.name,typed:j.typedFields.length,clicks:j.clicks,screens:j.screens.length})),simulatedWrites:report.writes.length,errors:report.errors},null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
