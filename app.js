const NHOST_AUTH = "https://vcrmffssoguqroqdnxos.auth.eu-central-1.nhost.run/v1";
const AUTH_SESSION_KEY = "Leeuwke_NhostAuthSession_v1";

function getStoredSession(){try{return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)||"null")}catch{return null}}
function setSession(s){s?localStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(AUTH_SESSION_KEY);updateAuthUI()}
async function authPost(path,body){
  const r=await fetch(NHOST_AUTH+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.message||d.error||("Auth fout "+r.status));
  return d;
}
function showAuthMessage(t,ok=false){const e=document.getElementById("authMessage");if(!e)return;e.textContent=t;e.className="auth-message "+(ok?"ok":"err")}
function updateAuthUI(){
  const e=document.getElementById("authStatus"),b=document.getElementById("logoutBtn");if(!e||!b)return;
  const s=getStoredSession();
  if(s?.accessToken&&s?.user){e.className="auth-status logged-in";e.textContent="✓ Ingelogd als "+(s.user.email||s.user.displayName||"gebruiker")+" · rol: "+(s.user.defaultRole||"user");b.disabled=false}
  else{e.className="auth-status muted";e.textContent="Niet ingelogd";b.disabled=true}
}

async function centralWrite(query,variables={}){
 const s=getStoredSession();if(!s?.accessToken)throw new Error("Je bent niet ingelogd.");
 const r=await fetch(NHOST_GRAPHQL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.accessToken},body:JSON.stringify({query,variables})});
 const d=await r.json();if(!r.ok||d.errors)throw new Error(d?.errors?.map(e=>e.message).join(", ")||("GraphQL fout "+r.status));return d.data
}

async function saveCentralMatch(game){
  const session=getStoredSession();
  if(!session?.accessToken) throw new Error("Log eerst in via 'Beheerder' om een uitslag op te slaan.");

  const dateEl=document.querySelector(`.date[data-id="${game.id}"]`);
  const s1El=document.querySelector(`.score[data-id="${game.id}"][data-side="s1"]`);
  const s2El=document.querySelector(`.score[data-id="${game.id}"][data-side="s2"]`);

  const date=dateEl?.value || null;
  const raw1=s1El?.value ?? "";
  const raw2=s2El?.value ?? "";
  const score1=raw1==="" ? null : Number(raw1);
  const score2=raw2==="" ? null : Number(raw2);

  if((score1===null)!==(score2===null)) throw new Error("Vul beide scores in, of laat beide leeg.");
  if(score1!==null){
    if(!Number.isInteger(score1)||!Number.isInteger(score2)||score1<0||score2<0) throw new Error("Scores moeten hele getallen zijn.");
    if(score1+score2!==7) throw new Error("Een wedstrijd bestaat uit 7 legs; de uitslag moet samen 7 zijn.");
    if(score1===score2) throw new Error("Een wedstrijd kan niet gelijk eindigen.");
  }

  const q=`mutation UpdateMatch($id: uuid!, $date: date, $s1: Int, $s2: Int){
    update_matches_by_pk(pk_columns:{id:$id},_set:{speeldatum:$date,score1:$s1,score2:$s2}){
      id speeldatum score1 score2
    }
  }`;
  const d=await centralWrite(q,{id:game.id,date,s1:score1,s2:score2});
  if(!d.update_matches_by_pk) throw new Error("Wedstrijd kon niet centraal worden opgeslagen.");
  game.date=d.update_matches_by_pk.speeldatum||"";
  game.s1=d.update_matches_by_pk.score1===null?"":String(d.update_matches_by_pk.score1);
  game.s2=d.update_matches_by_pk.score2===null?"":String(d.update_matches_by_pk.score2);
  return d.update_matches_by_pk;
}

function setupAuth(){
  const rf=document.getElementById("registerForm"),lf=document.getElementById("loginForm"),lo=document.getElementById("logoutBtn");if(!lf||!lo)return;
  
  lf.addEventListener("submit",async e=>{e.preventDefault();showAuthMessage("Bezig met inloggen...",true);try{
    const email=document.getElementById("loginEmail").value.trim(),password=document.getElementById("loginPassword").value;
    const d=await authPost("/signin/email-password",{email,password});if(!d.session)throw new Error("Geen sessie ontvangen; mogelijk eerst e-mail bevestigen.");
    setSession(d.session);lf.reset();showAuthMessage("Inloggen gelukt.",true)
  }catch(err){showAuthMessage(err.message)}});
  lo.addEventListener("click",()=>{setSession(null);showAuthMessage("Uitgelogd.",true)});
  updateAuthUI();
}

const NHOST_GRAPHQL = "https://vcrmffssoguqroqdnxos.graphql.eu-central-1.nhost.run/v1";

async function loadCentralPlayers() {
  const query = `query {
    Players {
      id
      name
      active
    }
  }`;

  const response = await fetch(NHOST_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-role": "public"
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error("Nhost antwoordde met " + response.status);
  const result = await response.json();
  if (result.errors) throw new Error(result.errors.map(e => e.message).join(", "));
  return result.data.Players || [];
}

async function loadCentralSeasons() {
  const query = `query {
    seasons {
      id
      name
      active
    }
  }`;

  const response = await fetch(NHOST_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-role": "public"
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error("Nhost antwoordde met " + response.status);
  const result = await response.json();
  if (result.errors) throw new Error(result.errors.map(e => e.message).join(", "));
  return result.data.seasons || [];
}

async function loadCentralMatches() {
  const query = `query {
    matches {
      id
      season_id
      player1_id
      player2_id
      speeldatum
      score1
      score2
    }
  }`;

  const response = await fetch(NHOST_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-role": "public"
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error("Nhost antwoordde met " + response.status);
  const result = await response.json();
  if (result.errors) throw new Error(result.errors.map(e => e.message).join(", "));
  return result.data.matches || [];
}

const DEFAULTS=["Eric van Lijssel", "Peter Heesakkers", "Rob van Bakel", "Willy Verstegen", "Daan van Breugel", "André Fransen", "Jan van Lee", "Pascal Boeijen", "Mari Bijveld", "Bart van der Meijden", "André van Lijssel", "Arjan van Creij", "Marisa Verbrugge", "Rick Pennings"], PKEY="Leeuwke_Spelers_v2", SKEY="Leeuwke_Seizoenen_v1", OLDPLAYERS="Leeuwke_Spelers_v1", OLDSCORES="Leeuwke_Dartcompetitie_v1";
function initPlayers(){let p=JSON.parse(localStorage.getItem(PKEY)||"null");if(p)return p;let old=JSON.parse(localStorage.getItem(OLDPLAYERS)||"null");p=Array.isArray(old)?old.map((x,i)=>({id:x.id||i+1,name:x.name,active:x.active!==false})):DEFAULTS.map((name,i)=>({id:i+1,name,active:true}));localStorage.setItem(PKEY,JSON.stringify(p));return p}
let players=initPlayers();
function initSeasons(){let s=JSON.parse(localStorage.getItem(SKEY)||"null");if(s&&s.list?.length)return s;let ids=DEFAULTS.map(n=>players.find(p=>p.name===n)?.id).filter(Boolean), old=JSON.parse(localStorage.getItem(OLDSCORES)||"{}");let games=makeGames(ids);games.forEach(g=>{let o=old[g.legacy];if(o)Object.assign(g,{s1:o.s1??"",s2:o.s2??"",date:o.date??""})});s={current:"s1",list:[{id:"s1",name:"Huidige competitie",playerIds:ids,games}]};localStorage.setItem(SKEY,JSON.stringify(s));return s}
function makeGames(ids){let a=[],n=1;for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)a.push({id:n,legacy:n++,p1:ids[i],p2:ids[j],s1:"",s2:"",date:""});return a}
let data=initSeasons(); const season=()=>data.list.find(s=>s.id===data.current), pname=id=>players.find(p=>p.id===id)?.name||"Onbekend";
function saveAll(){localStorage.setItem(PKEY,JSON.stringify(players));localStorage.setItem(SKEY,JSON.stringify(data))} const valid=g=>g.s1!==""&&g.s2!==""&&+g.s1 + +g.s2===7&&+g.s1!==+g.s2;
function stats(){let s=season(),a=s.playerIds.map(id=>({id,name:pname(id),g:0,w:0,v:0,lf:0,lt:0})),m=Object.fromEntries(a.map(x=>[x.id,x]));s.games.filter(valid).forEach(x=>{let a=+x.s1,b=+x.s2,p=m[x.p1],q=m[x.p2];p.g++;q.g++;p.lf+=a;p.lt+=b;q.lf+=b;q.lt+=a;a>b?(p.w++,q.v++):(q.w++,p.v++)});a.forEach(x=>x.sal=x.lf-x.lt);return a.sort((a,b)=>b.lf-a.lf||b.sal-a.sal||b.w-a.w||a.name.localeCompare(b.name,"nl"))}
function renderStand(){standing.innerHTML=stats().map((x,i)=>`<tr><td>${i+1}</td><td>${x.name}</td><td>${x.g}</td><td>${x.w}</td><td>${x.v}</td><td>${x.lf}</td><td>${x.lt}</td><td>${x.sal>0?"+":""}${x.sal}</td></tr>`).join("")}
function score(a,b){let g=season().games.find(x=>(x.p1===a&&x.p2===b)||(x.p1===b&&x.p2===a));if(!g||!valid(g))return"";return g.p1===a?g.s1+"-"+g.s2:g.s2+"-"+g.s1}
function renderCross(){let ids=season().playerIds,st=Object.fromEntries(stats().map(x=>[x.id,x])),h='<thead><tr><th>Speler</th>'+ids.map((_,i)=>`<th>${i+1}</th>`).join("")+'<th>Legs +</th><th>Saldo</th></tr></thead><tbody>';ids.forEach((p,i)=>{h+=`<tr><td>${i+1}. ${pname(p)}</td>`;ids.forEach((q,j)=>h+=i===j?'<td class="diag">X</td>':`<td>${score(p,q)}</td>`);h+=`<td>${st[p].lf}</td><td>${st[p].sal}</td></tr>`});cross.className="cross";cross.innerHTML=h+"</tbody>"}
function renderFilter(){let v=pf.value;pf.innerHTML='<option value="">Alle spelers</option>'+season().playerIds.map(id=>`<option value="${id}">${pname(id)}</option>`).join("");pf.value=season().playerIds.includes(v)?v:""}
function renderGames(){
  let p=pf.value,s=sf.value;
  let list=season().games
    .filter(g=>(!p||g.p1===p||g.p2===p)&&(s==="all"||(s==="played"&&valid(g))||(s==="open"&&!valid(g))))
    .sort((a,b)=>(valid(b)-valid(a))||(valid(a)&&valid(b)?(b.date||"").localeCompare(a.date||""):0)||String(a.id).localeCompare(String(b.id)));

  matches.innerHTML=list.map(g=>`<tr>
    <td>${g.displayId ?? g.id}</td>
    <td><input class="date" type="date" data-id="${g.id}" value="${g.date||""}"></td>
    <td>${pname(g.p1)}</td><td>–</td><td>${pname(g.p2)}</td>
    <td>
      <input class="score" data-id="${g.id}" data-side="s1" value="${g.s1}">
      -
      <input class="score" data-id="${g.id}" data-side="s2" value="${g.s2}">
    </td>
    <td class="match-status" data-id="${g.id}">
      ${valid(g)?'<span class="ok">✓ Geldig</span>':(g.s1!==""||g.s2!==""?'<span class="muted">Vul beide scores in</span>':'<span class="muted">Nog te spelen</span>')}
    </td>
  </tr>`).join("");

  function updateLocalScoreState(game){
    const inputs=[...document.querySelectorAll(`.score[data-id="${game.id}"]`)];
    inputs.forEach(inp=>{
      let v=inp.value.replace(/[^0-7]/g,"").slice(0,1);
      inp.value=v;
      game[inp.dataset.side]=v;
    });

    const status=document.querySelector(`.match-status[data-id="${game.id}"]`);
    if(game.s1==="" && game.s2===""){
      status.innerHTML='<span class="muted">Nog te spelen</span>';
      return "empty";
    }
    if(game.s1==="" || game.s2===""){
      status.innerHTML='<span class="muted">Vul beide scores in</span>';
      return "incomplete";
    }
    if(Number(game.s1)+Number(game.s2)!==7 || Number(game.s1)===Number(game.s2)){
      status.innerHTML='<span class="err">Samen 7 legs</span>';
      return "invalid";
    }
    status.innerHTML='<span class="ok">Bezig met opslaan…</span>';
    return "complete";
  }

  document.querySelectorAll(".score").forEach(input=>{
    input.addEventListener("input",()=>{
      const g=season().games.find(x=>String(x.id)===String(input.dataset.id));
      updateLocalScoreState(g);
    });

    input.addEventListener("change",async()=>{
      const g=season().games.find(x=>String(x.id)===String(input.dataset.id));
      const state=updateLocalScoreState(g);

      if(state==="incomplete" || state==="empty") return;
      if(state==="invalid") return;

      try{
        await saveCentralMatch(g);
        renderStand();
        renderCross();
        renderGames();
      }catch(err){
        alert(err.message);
        location.reload();
      }
    });
  });

  document.querySelectorAll(".date").forEach(input=>{
    input.addEventListener("change",async()=>{
      const g=season().games.find(x=>String(x.id)===String(input.dataset.id));
      g.date=input.value;
      try{
        await saveCentralMatch(g);
        renderGames();
      }catch(err){
        alert(err.message);
        location.reload();
      }
    });
  });
}
async function insertCentralPlayer(name){
 const q=`mutation($name:String!){insert_Players_one(object:{name:$name,active:true}){id name active}}`;
 const d=await centralWrite(q,{name});
 if(!d.insert_Players_one)throw new Error("Speler kon niet centraal worden toegevoegd.");
 return d.insert_Players_one;
}
async function updateCentralPlayer(id,changes){
 const q=`mutation($id:uuid!,$changes:Players_set_input!){update_Players_by_pk(pk_columns:{id:$id},_set:$changes){id name active}}`;
 const d=await centralWrite(q,{id,changes});
 if(!d.update_Players_by_pk)throw new Error("Speler kon niet centraal worden gewijzigd.");
 return d.update_Players_by_pk;
}

function renderPlayers(){
 plist.innerHTML=players.slice().sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,"nl")).map(p=>`<tr><td><input class="name" data-id="${p.id}" value="${p.name}"></td><td class="${p.active?"ok":"muted"}">${p.active?"Actief":"Inactief"}</td><td><button class="toggle" data-id="${p.id}">${p.active?"Inactief zetten":"Actief zetten"}</button></td></tr>`).join("");

 document.querySelectorAll(".toggle").forEach(b=>b.onclick=async()=>{
   let p=players.find(x=>String(x.id)===String(b.dataset.id)),old=p.active;
   try{
     let u=await updateCentralPlayer(p.id,{active:!p.active});
     p.active=u.active;
     const changed=autoSyncRosterIfOpen();
     renderPlayers();
     if(changed){msg.textContent="Status centraal aangepast en verwerkt in het huidige seizoen.";renderAll();renderSeasons()}
     else if(seasonHasPlayedMatches()){msg.textContent="Status centraal aangepast. Het lopende seizoen blijft ongewijzigd omdat er al wedstrijden zijn gespeeld."}
     else msg.textContent="Status centraal aangepast.";
   }catch(err){p.active=old;alert(err.message);renderPlayers()}
 });

 document.querySelectorAll(".name").forEach(e=>e.onchange=async()=>{
   let p=players.find(x=>String(x.id)===String(e.dataset.id)),old=p.name,v=e.value.trim();
   if(!v||players.some(x=>String(x.id)!==String(p.id)&&x.name.toLowerCase()===v.toLowerCase())){e.value=p.name;msg.textContent="Naam leeg of bestaat al.";return}
   try{
     let u=await updateCentralPlayer(p.id,{name:v});
     p.name=u.name;msg.textContent="Naam centraal aangepast en overal doorgevoerd.";renderAll();renderPlayers()
   }catch(err){p.name=old;e.value=old;alert(err.message)}
 })
}
function seasonHasPlayedMatches(s=season()){
  return s.games.some(valid);
}


function autoSyncRosterIfOpen(){
  const s = season();
  if (seasonHasPlayedMatches(s)) return false;

  const ids = players.filter(p => p.active).map(p => p.id);
  if (ids.length < 2) return false;

  const same = ids.length === s.playerIds.length && ids.every((id, i) => s.playerIds[i] === id);
  if (same) return false;

  s.playerIds = ids;
  s.games = makeGames(ids);
  saveAll();
  return true;
}

function rebuildCurrentSeasonRoster(){
  const s = season();
  if (seasonHasPlayedMatches(s)) {
    seasonMsg.textContent = "De deelnemerslijst is vastgezet omdat er al wedstrijden zijn gespeeld.";
    return;
  }

  const ids = players.filter(p => p.active).map(p => p.id);
  if (ids.length < 2) {
    seasonMsg.textContent = "Er moeten minimaal 2 actieve spelers zijn.";
    return;
  }

  s.playerIds = ids;
  s.games = makeGames(ids);
  saveAll();
  seasonMsg.textContent = "De actieve spelers zijn overgenomen in het huidige seizoen.";
  renderAll();
  renderSeasons();
}


async function updateCentralSeason(id,changes){
  const q=`mutation($id:uuid!,$changes:seasons_set_input!){
    update_seasons_by_pk(pk_columns:{id:$id},_set:$changes){id name active}
  }`;
  const d=await centralWrite(q,{id,changes});
  if(!d.update_seasons_by_pk) throw new Error("Seizoen kon niet centraal worden gewijzigd.");
  return d.update_seasons_by_pk;
}

async function createCentralSeason(name,playerIds){
  // Eerst oude seizoenen centraal op inactief.
  await centralWrite(`mutation{
    update_seasons(where:{},_set:{active:false}){affected_rows}
  }`);

  const createSeason=`mutation($name:String!){
    insert_seasons_one(object:{name:$name,active:true}){id name active}
  }`;
  const sd=await centralWrite(createSeason,{name});
  const s=sd.insert_seasons_one;
  if(!s) throw new Error("Nieuw seizoen kon niet worden aangemaakt.");

  const objects=[];
  for(let i=0;i<playerIds.length;i++){
    for(let j=i+1;j<playerIds.length;j++){
      objects.push({
        season_id:s.id,
        player1_id:playerIds[i],
        player2_id:playerIds[j]
      });
    }
  }

  const createMatches=`mutation($objects:[matches_insert_input!]!){
    insert_matches(objects:$objects){affected_rows returning{id season_id player1_id player2_id speeldatum score1 score2}}
  }`;
  const md=await centralWrite(createMatches,{objects});
  if(!md.insert_matches) throw new Error("Wedstrijden voor het nieuwe seizoen konden niet worden aangemaakt.");

  return {season:s,matches:md.insert_matches.returning};
}

async function makeSeasonActiveCentral(id){
  await centralWrite(`mutation{
    update_seasons(where:{},_set:{active:false}){affected_rows}
  }`);
  return updateCentralSeason(id,{active:true});
}

function renderSeasons(){
  seasonList.innerHTML=data.list.map(s=>`<tr class="${s.id===data.current?"season-active":""}">
    <td><input class="season-name" data-id="${s.id}" value="${s.name}"></td>
    <td>${s.playerIds.length}</td>
    <td>${s.games.length}</td>
    <td>${s.id===data.current?'<span class="ok">Actief</span>':`<button class="choose" data-id="${s.id}">Actief maken</button>`}</td>
  </tr>`).join("");

  document.querySelectorAll(".season-name").forEach(input=>{
    input.onchange=async()=>{
      const s=data.list.find(x=>String(x.id)===String(input.dataset.id));
      const old=s.name,name=input.value.trim();
      if(!name){input.value=old;return}
      try{
        const u=await updateCentralSeason(s.id,{name});
        s.name=u.name;
        seasonMsg.textContent="Seizoensnaam centraal aangepast.";
        renderAll();renderSeasons();
      }catch(err){input.value=old;alert(err.message)}
    };
  });

  document.querySelectorAll(".choose").forEach(btn=>{
    btn.onclick=async()=>{
      try{
        const id=btn.dataset.id;
        await makeSeasonActiveCentral(id);
        data.list.forEach(s=>s.centralActive=String(s.id)===String(id));
        data.current=id;
        seasonMsg.textContent="Actief seizoen centraal gewijzigd.";
        renderAll();renderSeasons();
      }catch(err){alert(err.message)}
    };
  });

  // De oude lokale synchronisatieknop gebruiken we niet meer in deze centrale versie.
  syncRosterBtn.disabled=true;
  rosterLockInfo.textContent="Deelnemers van een centraal seizoen worden bij het aanmaken vastgelegd.";
}
function renderAll(){seasonTitle.textContent=season().name+" · "+season().playerIds.length+" deelnemers · "+season().games.length+" wedstrijden · 7 legs per wedstrijd";renderFilter();renderCross();renderGames();renderStand()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab,.panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active")});pf.onchange=sf.onchange=renderGames;
add.onsubmit=async e=>{
 e.preventDefault();
 let v=newname.value.trim();
 if(!v||players.some(x=>x.name.toLowerCase()===v.toLowerCase())){msg.textContent="Naam leeg of bestaat al.";return}
 try{
   let p=await insertCentralPlayer(v);
   players.push(p);
   newname.value="";
   const changed=autoSyncRosterIfOpen();
   msg.textContent=changed?v+" centraal toegevoegd en direct opgenomen in het huidige seizoen.":v+" centraal toegevoegd.";
   renderPlayers();
   if(changed){renderAll();renderSeasons()}
 }catch(err){alert(err.message)}
};
syncRosterBtn.onclick=rebuildCurrentSeasonRoster;
newSeasonForm.onsubmit=async e=>{
  e.preventDefault();
  const name=newSeasonName.value.trim();
  const ids=players.filter(p=>p.active).map(p=>p.id);

  if(!name||ids.length<2){
    seasonMsg.textContent="Geef een naam op en zorg voor minimaal 2 actieve spelers.";
    return;
  }
  if(!getStoredSession()?.accessToken){
    alert("Log eerst in via Beheerder.");
    return;
  }

  try{
    seasonMsg.textContent="Nieuw seizoen wordt centraal aangemaakt...";
    const created=await createCentralSeason(name,ids);

    data.list.forEach(s=>s.centralActive=false);
    const games=created.matches.map((m,index)=>({
      id:m.id,
      displayId:index+1,
      p1:m.player1_id,
      p2:m.player2_id,
      s1:"",
      s2:"",
      date:""
    }));

    data.list.push({
      id:created.season.id,
      name:created.season.name,
      playerIds:ids,
      games,
      centralActive:true
    });
    data.current=created.season.id;

    newSeasonName.value="";
    seasonMsg.textContent=`Nieuw seizoen centraal aangemaakt met ${ids.length} spelers en ${games.length} wedstrijden.`;
    renderAll();renderSeasons();
  }catch(err){
    seasonMsg.textContent="";
    alert(err.message);
  }
};
async function startApp() {
  try {
    const [centralPlayers, centralSeasons, centralMatches] = await Promise.all([
      loadCentralPlayers(),
      loadCentralSeasons(),
      loadCentralMatches()
    ]);

    if (centralPlayers.length) {
      players = centralPlayers.map(p => ({
        id: p.id,
        name: p.name,
        active: p.active
      }));
    }

    if (centralSeasons.length) {
      const activeCentralSeason =
        centralSeasons.find(s => s.active) ||
        centralSeasons[0];

      data = {
        current: activeCentralSeason.id,
        list: centralSeasons.map(s => {
          const seasonMatches = centralMatches
            .filter(m => m.season_id === s.id)
            .map((m, index) => ({
              id: m.id,
              displayId: index + 1,
              p1: m.player1_id,
              p2: m.player2_id,
              s1: m.score1 === null ? "" : String(m.score1),
              s2: m.score2 === null ? "" : String(m.score2),
              date: m.speeldatum || ""
            }));

          // Deelnemers van een seizoen leiden we in deze leestest af uit matches.
          // Als er nog maar weinig matches zijn, vullen we het actieve seizoen aan
          // met de actieve centrale spelers zodat de bestaande schermen bruikbaar blijven.
          const idsFromMatches = [...new Set(
            seasonMatches.flatMap(m => [m.p1, m.p2])
          )];

          const playerIds = s.id === activeCentralSeason.id
            ? players.filter(p => p.active).map(p => p.id)
            : idsFromMatches;

          return {
            id: s.id,
            name: s.name,
            playerIds,
            games: seasonMatches,
            centralActive: !!s.active
          };
        })
      };
    }

    const banner = document.createElement("div");
    banner.className = "panel active";
    banner.innerHTML = `<strong class="ok">✓ Competitiegegevens geladen</strong>
      <p></p>`;
    document.querySelector("main").insertBefore(
      banner,
      document.querySelector("main nav").nextSibling
    );

  } catch (err) {
    const banner = document.createElement("div");
    banner.className = "panel active";
    banner.innerHTML = `<strong class="err">Centrale gegevens konden niet volledig worden geladen.</strong>
      <p>${err.message}</p><p>Controleer Nhost en de public leesrechten.</p>`;
    document.querySelector("main").insertBefore(
      banner,
      document.querySelector("main nav").nextSibling
    );
  }

  renderPlayers();
  renderSeasons();
  renderAll();
}


function printSection(sectionId){
  const allowed=["kruis","uitslagen","stand"];
  if(!allowed.includes(sectionId)) return;
  document.body.classList.remove("print-kruis","print-uitslagen","print-stand");
  document.body.classList.add("print-"+sectionId);
  window.print();
}

window.addEventListener("afterprint",()=>{
  document.body.classList.remove("print-kruis","print-uitslagen","print-stand");
});

setupAuth();
startApp();