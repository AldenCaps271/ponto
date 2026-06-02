var SU='https://script.google.com/macros/s/AKfycbwc9l7LgctUalF0MEEz0hhzdENl2jH8GBVXhM6Ilu83t4CaqczLlVUcdh5eD-d6J444/exec';
var NS='acponto_';
var DB={
  getCfg:function(){return JSON.parse(localStorage.getItem(NS+'cfg')||'{"setor":"Alden Caps","senha":"1234"}');},
  getFuncs:function(){return JSON.parse(localStorage.getItem(NS+'funcs')||'[]');},
  getRegs:function(){return JSON.parse(localStorage.getItem(NS+'regs')||'[]');},
  setCfg:function(v){localStorage.setItem(NS+'cfg',JSON.stringify(v));},
  setFuncs:function(v){localStorage.setItem(NS+'funcs',JSON.stringify(v));},
  setRegs:function(v){localStorage.setItem(NS+'regs',JSON.stringify(v));}
};
var fa=null, feditId=null;

function ms(id){document.querySelectorAll('.s').forEach(function(t){t.classList.toggle('on',t.id===id);});}
function voltar(){fa=null;ms('ts');rl();}
function toast(msg,e){var el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+(e?'terr':'tok');setTimeout(function(){el.classList.remove('show');},2800);}

function tick(){
  var n=new Date(),p=function(v){return String(v).padStart(2,'0');};
  var el=document.getElementById('rel');
  if(el)el.textContent=p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds());
  var D=['Domingo','Segunda-feira','Terca-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sabado'];
  var M=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var de=document.getElementById('red');
  if(de)de.textContent=D[n.getDay()]+', '+n.getDate()+' de '+M[n.getMonth()]+' de '+n.getFullYear();
}

function rl(){
  var funcs=DB.getFuncs(),hoje=new Date().toISOString().slice(0,10);
  var el=document.getElementById('lista');
  var cfg=DB.getCfg();
  document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
  if(!funcs.length){el.innerHTML='<div class="empty">Nenhum funcionario ainda.<br>Painel Admin > Funcionarios</div>';return;}
  el.innerHTML=funcs.map(function(f){
    var r=DB.getRegs().filter(function(x){return x.fid===f.id&&x.data===hoje;});
    var t=r.map(function(x){return x.tipo;});
    var s,c;
    if(t.indexOf('SAIDA')>=0){s='Saiu';c='ok';}
    else if(t.indexOf('ENTRADA')>=0){s='Presente';c='pres';}
    else{s='Ausente';c='nd';}
    var ini=f.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    return '<button class="fb" data-id="'+f.id+'"><div class="av">'+ini+'</div><div><div class="fn">'+f.nome+'</div><div class="fc">'+(f.cargo||'-')+'</div></div><span class="fst '+c+'">'+s+'</span></button>';
  }).join('');
  document.querySelectorAll('#lista .fb').forEach(function(btn){
    btn.addEventListener('click',function(){ap(btn.dataset.id);});
  });
}

function ap(id){
  var funcs=DB.getFuncs();fa=null;
  for(var i=0;i<funcs.length;i++){if(funcs[i].id===id){fa=funcs[i];break;}}
  if(!fa)return;
  document.getElementById('pnome').textContent=fa.nome;
  document.getElementById('pcargo').textContent=fa.cargo||'Funcionario';
  document.getElementById('hini').textContent=fa.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  ms('tp');atBotoes();setSS('i');
}

function marcar(tipo){
  var n=new Date(),p=function(v){return String(v).padStart(2,'0');};
  var hora=p(n.getHours())+':'+p(n.getMinutes()),data=n.toISOString().slice(0,10);
  var regs=DB.getRegs();
  for(var i=0;i<regs.length;i++){if(regs[i].fid===fa.id&&regs[i].data===data&&regs[i].tipo===tipo){toast('Ja registrado!',1);return;}}
  var reg={id:Date.now(),fid:fa.id,tipo:tipo,hora:hora,data:data};
  regs.push(reg);DB.setRegs(regs);atBotoes();
  var lb={ENTRADA:'Entrada',SAIDA_ALMOCO:'Saida almoco',RETORNO_ALMOCO:'Retorno',SAIDA:'Saida'};
  toast(lb[tipo]+' as '+hora);rl();enviar(reg);
}

function setSS(s){
  var d=document.getElementById('sdot'),x=document.getElementById('stxt');
  if(!d)return;
  if(s==='ok'){d.className='dt dg';x.textContent='Enviado';}
  else if(s==='s'){d.className='dt da';x.textContent='Enviando...';}
  else if(s==='e'){d.className='dt dr';x.textContent='Offline';}
  else{d.className='dt da';x.textContent='-';}
}

function enviar(reg){
  setSS('s');
  var funcs=DB.getFuncs(),fu=null;
  for(var i=0;i<funcs.length;i++){if(funcs[i].id===reg.fid){fu=funcs[i];break;}}
  var pl={setor:DB.getCfg().setor,nome:fu?fu.nome:'-',cargo:fu?fu.cargo:'-',tipo:reg.tipo,hora:reg.hora,data:reg.data,timestamp:new Date().toISOString()};
  fetch(SU,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(pl)})
  .then(function(){setSS('ok');}).catch(function(){setSS('e');});
}

function atBotoes(){
  var hoje=new Date().toISOString().slice(0,10),f={};
  DB.getRegs().filter(function(x){return x.fid===fa.id&&x.data===hoje;}).forEach(function(x){f[x.tipo]=x.hora;});
  ['ENTRADA','SAIDA_ALMOCO','RETORNO_ALMOCO','SAIDA'].forEach(function(t){
    var b=document.getElementById('b'+t),h=document.getElementById('h'+t),r=document.getElementById('r'+t);
    if(f[t]){
      b.disabled=true;h.textContent=f[t];r.textContent=f[t];
      if(!b.querySelector('.ck')){var ok=document.createElement('span');ok.className='ck';ok.innerHTML='<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';b.appendChild(ok);}
    }else{
      b.disabled=false;h.textContent='';r.textContent='-';
      var ck=b.querySelector('.ck');if(ck)ck.remove();
    }
  });
}

function abrirAdmin(){
  document.getElementById('merr').style.display='none';
  document.getElementById('msenha').value='';
  document.getElementById('mod').style.display='flex';
  setTimeout(function(){document.getElementById('msenha').focus();},100);
}
function fecharMod(){document.getElementById('mod').style.display='none';}
function okAdm(){
  if(document.getElementById('msenha').value===DB.getCfg().senha){
    fecharMod();ms('ta');abaF();radAdm();
  }else{document.getElementById('merr').style.display='block';}
}

function abaF(){
  document.getElementById('tab-f').classList.add('on');document.getElementById('tab-c').classList.remove('on');
  document.getElementById('pf').classList.add('on');document.getElementById('pc').classList.remove('on');
  fecharEdit();radAdm();
}
function abaC(){
  document.getElementById('tab-c').classList.add('on');document.getElementById('tab-f').classList.remove('on');
  document.getElementById('pc').classList.add('on');document.getElementById('pf').classList.remove('on');
  document.getElementById('csetor').value=DB.getCfg().setor||'';
}

function radAdm(){
  var el=document.getElementById('adml'),funcs=DB.getFuncs();
  if(!funcs.length){el.innerHTML='<div class="empty">Nenhum funcionario</div>';return;}
  el.innerHTML=funcs.map(function(f){
    return '<div class="fcard"><div class="fav">'+f.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()+'</div><div style="flex:1"><div class="fn">'+f.nome+'</div><div style="font-size:12px;color:var(--t2)">'+(f.cargo||'-')+'</div></div><button class="bedt" data-id="'+f.id+'">&#9998;</button><button class="brm" data-id="'+f.id+'">&#10005;</button></div>';
  }).join('');
  document.querySelectorAll('#adml .brm').forEach(function(btn){btn.addEventListener('click',function(){rmF(btn.dataset.id);});});
  document.querySelectorAll('#adml .bedt').forEach(function(btn){btn.addEventListener('click',function(){abrirEdit(btn.dataset.id);});});
}

function abrirEdit(id){
  var funcs=DB.getFuncs(),f=null;
  for(var i=0;i<funcs.length;i++){if(funcs[i].id===id){f=funcs[i];break;}}
  if(!f)return;
  feditId=id;
  document.getElementById('enome').value=f.nome;
  document.getElementById('ecargo').value=f.cargo||'';
  document.getElementById('edit-box').style.display='block';
  document.getElementById('enome').focus();
}
function fecharEdit(){
  feditId=null;
  document.getElementById('edit-box').style.display='none';
  document.getElementById('enome').value='';
  document.getElementById('ecargo').value='';
}
function salvarEdit(){
  if(!feditId)return;
  var nome=document.getElementById('enome').value.trim();
  var cargo=document.getElementById('ecargo').value.trim();
  if(!nome){toast('Informe o nome',1);return;}
  var funcs=DB.getFuncs();
  for(var i=0;i<funcs.length;i++){if(funcs[i].id===feditId){funcs[i].nome=nome;funcs[i].cargo=cargo;break;}}
  DB.setFuncs(funcs);fecharEdit();radAdm();rl();toast('Atualizado!');
}

function addF(){
  var nome=document.getElementById('fnome').value.trim(),cargo=document.getElementById('fcargo').value.trim();
  if(!nome){toast('Informe o nome',1);return;}
  var funcs=DB.getFuncs();
  funcs.push({id:Date.now().toString(),nome:nome,cargo:cargo});
  DB.setFuncs(funcs);
  document.getElementById('fnome').value='';document.getElementById('fcargo').value='';
  radAdm();rl();toast('Adicionado!');
}
function rmF(id){
  if(!confirm('Remover?'))return;
  DB.setFuncs(DB.getFuncs().filter(function(f){return f.id!==id;}));
  radAdm();rl();toast('Removido');
}
function salvarC(){
  var cfg=DB.getCfg(),s=document.getElementById('csetor').value.trim(),p=document.getElementById('csenha').value.trim();
  if(s)cfg.setor=s;if(p&&p.length>=4)cfg.senha=p;DB.setCfg(cfg);
  document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
  document.getElementById('adm-setor').textContent=cfg.setor;
  toast('Salvo!');
}
function resetar(){
  if(!confirm('Apagar TUDO?'))return;
  [NS+'cfg',NS+'funcs',NS+'regs'].forEach(function(k){localStorage.removeItem(k);});
  location.reload();
}

function horaMin(h){if(!h)return 0;var p=h.split(':');return parseInt(p[0])*60+(parseInt(p[1])||0);}
function minHora(m){if(!m||m<=0)return '-';return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0');}

function abrirRelatorio(){
  var funcs=DB.getFuncs(),regs=DB.getRegs();
  var hoje=new Date(),mes=hoje.getMonth(),ano=hoje.getFullYear();
  var nM=['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var dS=['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
  var tMes=nM[mes]+' '+ano;
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatorio '+tMes+'</title>';
  html+='<style>body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#fff;color:#333}';
  html+='.topo{text-align:center;margin-bottom:20px}.topo h1{color:#C9A84C;margin:0;font-size:22px}.topo p{color:#888;font-size:13px;margin:4px 0}';
  html+='.bloco{margin-bottom:30px;border:1px solid #ccc;border-radius:8px;overflow:hidden;page-break-inside:avoid}';
  html+='.bloco-header{background:#1c1a10;color:#C9A84C;padding:10px 14px;font-weight:bold;font-size:13px}';
  html+='table{width:100%;border-collapse:collapse;font-size:11px}';
  html+='th{background:#f5f0e8;color:#333;padding:6px;text-align:center;border-bottom:2px solid #C9A84C}';
  html+='td{padding:5px 6px;text-align:center;border-bottom:1px solid #eee}';
  html+='.fds{background:#f0ece0;color:#aaa;font-style:italic}';
  html+='.totais{background:#2d2a1a;color:#C9A84C;font-weight:bold}';
  html+='.atraso{color:#c0392b;font-weight:bold}.extra{color:#27ae60;font-weight:bold}';
  html+='.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:16px 20px;border-top:1px solid #eee}';
  html+='.assin-campo{margin-top:30px;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:10px;color:#888}';
  html+='.assin-label{font-size:11px;color:#666;margin-bottom:0}';
  html+='@media print{.btn-print{display:none}body{padding:10px}}</style></head><body>';
  html+='<div class="topo"><h1>ALDEN CAPS — FOLHA DE PONTO</h1><p>Periodo: '+tMes+'</p></div>';

  var temDados=false;
  funcs.forEach(function(f){
    var rf=regs.filter(function(r){var d=new Date(r.data+'T12:00:00');return r.fid===f.id&&d.getMonth()===mes&&d.getFullYear()===ano;});
    if(!rf.length)return;
    temDados=true;
    var dm={};
    rf.forEach(function(r){if(!dm[r.data])dm[r.data]={};dm[r.data][r.tipo]=r.hora;});
    var tT=0,tA=0,tE=0;
    html+='<div class="bloco"><div class="bloco-header">'+f.nome+' &nbsp;|&nbsp; '+(f.cargo||'Funcionario')+'</div>';
    html+='<table><tr><th>Data</th><th>Dia</th><th>Entrada</th><th>S.Almoco</th><th>Retorno</th><th>Saida</th><th>Trabalhado</th><th>Atraso</th><th>H.Extras</th></tr>';
    Object.keys(dm).sort().forEach(function(dt,i){
      var r=dm[dt],d=new Date(dt+'T12:00:00'),ds=d.getDay(),fds=ds===0||ds===6;
      var en=r['ENTRADA']||'',sa=r['SAIDA_ALMOCO']||'',re=r['RETORNO_ALMOCO']||'',si=r['SAIDA']||'';
      var sT='-',sA='-',sE='-';
      if(en&&si){
        var eM=horaMin(en),siM=horaMin(si),alM=(sa&&re)?Math.max(0,horaMin(re)-horaMin(sa)):0;
        var tM=Math.max(0,siM-eM-alM);sT=minHora(tM);
        var espS=ds===5?17*60:18*60,espT=espS-8*60-60;
        if(eM>480){var at=eM-480;tA+=at;sA=minHora(at);}
        if(tM>espT){var ex=tM-espT;tE+=ex;sE=minHora(ex);}
        if(!fds)tT+=tM;
      }
      var cls=fds?'fds':'';
      html+='<tr class="'+cls+'"><td>'+dt+'</td><td>'+dS[ds]+'</td><td>'+(en||'-')+'</td><td>'+(sa||'-')+'</td><td>'+(re||'-')+'</td><td>'+(si||'-')+'</td><td>'+sT+'</td>';
      html+='<td class="'+(sA!=='-'?'atraso':'')+'">'+sA+'</td><td class="'+(sE!=='-'?'extra':'')+'">'+sE+'</td></tr>';
    });
    html+='<tr class="totais"><td colspan="6">TOTAIS DO MES</td><td>'+minHora(tT)+'</td><td>'+minHora(tA)+'</td><td>'+minHora(tE)+'</td></tr>';
    html+='</table><div class="assinaturas"><div><p class="assin-label">Assinatura do Colaborador</p><div class="assin-campo">'+f.nome+'</div></div>';
    html+='<div><p class="assin-label">Assinatura do Responsavel</p><div class="assin-campo">Gestor Responsavel</div></div></div></div>';
  });
  if(!temDados)html+='<p style="text-align:center;color:#aaa;padding:40px">Nenhum registro encontrado para '+tMes+'</p>';
  html+='<div style="text-align:center;margin:20px"><button class="btn-print" onclick="window.print()" style="background:#C9A84C;color:#1c1a10;border:none;padding:12px 36px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer">&#128438; Imprimir / Salvar PDF</button></div>';
  html+='</body></html>';
  var w=window.open('','_blank');
  w.document.write(html);w.document.close();
}

window.addEventListener('DOMContentLoaded',function(){
  var cfg=DB.getCfg();
  document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
  document.getElementById('adm-setor').textContent=cfg.setor;
  rl();setInterval(tick,1000);tick();ms('ts');
  document.getElementById('btn-admin').addEventListener('click',abrirAdmin);
  document.getElementById('btn-voltar1').addEventListener('click',voltar);
  document.getElementById('btn-voltar2').addEventListener('click',voltar);
  document.getElementById('btn-cancel').addEventListener('click',fecharMod);
  document.getElementById('btn-ok').addEventListener('click',okAdm);
  document.getElementById('msenha').addEventListener('keydown',function(e){if(e.key==='Enter')okAdm();});
  document.getElementById('tab-f').addEventListener('click',abaF);
  document.getElementById('tab-c').addEventListener('click',abaC);
  document.getElementById('btn-add').addEventListener('click',addF);
  document.getElementById('btn-salvarc').addEventListener('click',salvarC);
  document.getElementById('btn-reset').addEventListener('click',resetar);
  document.getElementById('btn-relatorio').addEventListener('click',abrirRelatorio);
  document.getElementById('btn-salvar-edit').addEventListener('click',salvarEdit);
  document.getElementById('btn-cancelar-edit').addEventListener('click',fecharEdit);
  document.getElementById('bENTRADA').addEventListener('click',function(){marcar('ENTRADA');});
  document.getElementById('bSAIDA_ALMOCO').addEventListener('click',function(){marcar('SAIDA_ALMOCO');});
  document.getElementById('bRETORNO_ALMOCO').addEventListener('click',function(){marcar('RETORNO_ALMOCO');});
  document.getElementById('bSAIDA').addEventListener('click',function(){marcar('SAIDA');});
});
