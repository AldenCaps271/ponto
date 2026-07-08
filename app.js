// v2.2
var SU='https://script.google.com/macros/s/AKfycbxy6lC0sg4vdwuyBw7BnAE4adYZbSd4AN-wvkTsWgheNArxpd7hczODPfjg1AjTAWXT/exec';

// Config local (preferencias de UI apenas)
var CFG={
  get:function(){return JSON.parse(localStorage.getItem('acponto_cfg')||'{"setor":"Alden Caps","senha":"1234"}');},
  set:function(v){localStorage.setItem('acponto_cfg',JSON.stringify(v));}
};

// Cache em memoria - nada vai para o localStorage exceto config
var _funcs=null;
var _regsUser={};
var fa=null,feditId=null,camStream=null,faceApiCarregado=false,modoCamera=null;
var _tentativasBio=0;

// ===== API =====
function apiGet(params,cb,errcb){
  var url=SU+'?'+Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
  fetch(url).then(function(r){return r.json();}).then(cb).catch(errcb||function(){});
}
function apiPost(data){
  return fetch(SU,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(function(){});
}

// ===== COLABORADORES =====
function carregarFuncs(cb){
  if(_funcs!==null){cb(_funcs);return;}
  apiGet({acao:'getColaboradores'},function(data){
    _funcs=data.ok?data.colaboradores:[];cb(_funcs);
  },function(){_funcs=[];cb([]);});
}
function invalidarFuncs(){_funcs=null;}
function sincronizarColaboradores(){
  if(!_funcs)return;
  apiPost({acao:'salvarColaboradores',colaboradores:_funcs});
}

// ===== FACE-API =====
function carregarFaceApi(cb){
  if(faceApiCarregado){cb();return;}
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
  s.onload=function(){
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
      faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model')
    ]).then(function(){faceApiCarregado=true;cb();}).catch(function(e){toast('Erro ao carregar reconhecimento facial',1);console.error(e);});
  };
  document.head.appendChild(s);
}

function abrirCamera(modo,onCaptura){
  modoCamera=modo;
  var modal=document.getElementById('cam-modal');
  if(modal.parentElement!==document.body)document.body.appendChild(modal);
  modal.style.zIndex='99999';
  var status=document.getElementById('cam-status');
  var btnCap=document.getElementById('cam-btn');
  modal.style.display='flex';
  status.textContent='Carregando reconhecimento facial...';
  btnCap.style.display='none';
  carregarFaceApi(function(){
    navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'}})
    .then(function(stream){
      camStream=stream;
      var video=document.getElementById('cam-video');
      video.srcObject=stream;video.play();
      status.textContent=modo==='cadastro'?'Posicione o rosto e clique em Capturar':'Olhe para a camera...';
      if(modo==='cadastro'){
        btnCap.style.display='block';
        btnCap.onclick=function(){capturarFoto(onCaptura);};
      } else {
        setTimeout(function(){reconhecerRosto(onCaptura);},1500);
      }
    }).catch(function(){status.textContent='Erro: permita o acesso a camera';toast('Permita o acesso a camera',1);});
  });
}

function fecharCamera(){
  if(camStream){camStream.getTracks().forEach(function(t){t.stop();});camStream=null;}
  document.getElementById('cam-modal').style.display='none';
  document.getElementById('cam-video').srcObject=null;
}

function capturarFoto(cb){
  var video=document.getElementById('cam-video');
  var canvas=document.getElementById('cam-canvas');
  canvas.width=video.videoWidth||320;canvas.height=video.videoHeight||240;
  canvas.getContext('2d').drawImage(video,0,0);
  document.getElementById('cam-status').textContent='Detectando rosto...';
  faceapi.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions())
  .withFaceLandmarks(true).withFaceDescriptor()
  .then(function(det){
    if(!det){toast('Rosto nao detectado. Tente novamente.',1);document.getElementById('cam-status').textContent='Rosto nao encontrado. Tente novamente.';return;}
    fecharCamera();cb(canvas.toDataURL('image/jpeg',0.7),Array.from(det.descriptor));
  }).catch(function(e){toast('Erro na deteccao',1);console.error(e);});
}

function reconhecerRosto(cb){
  var video=document.getElementById('cam-video');
  var funcs=(_funcs||[]).filter(function(f){return f.desc&&f.desc.length>0;});
  if(!funcs.length){fecharCamera();cb(null);return;}
  document.getElementById('cam-status').textContent='Reconhecendo...';
  var labeled=funcs.map(function(f){var d=f.desc;if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){d=d.split(',').map(Number);}}return new faceapi.LabeledFaceDescriptors(f.id,[new Float32Array(d||[])]);});
  var matcher=new faceapi.FaceMatcher(labeled,0.5);
  faceapi.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions())
  .withFaceLandmarks(true).withFaceDescriptor()
  .then(function(det){
    if(!det){document.getElementById('cam-status').textContent='Olhe para a camera...';setTimeout(function(){reconhecerRosto(cb);},2000);return;}
    var result=matcher.findBestMatch(det.descriptor);
    if(result.label==='unknown'){
_tentativasBio++;
document.getElementById('cam-status').textContent='Nao reconhecido ('+_tentativasBio+'/2)...';
if(_tentativasBio>=2){setTimeout(function(){fecharCamera();_tentativasBio=0;cb(null);},800);}
else{setTimeout(function(){reconhecerRosto(cb);},1500);}
} else {
      var f=(_funcs||[]).find(function(x){return x.id===result.label;})||null;
      document.getElementById('cam-status').textContent='Bem-vindo, '+(f?f.nome:'')+'!';
      setTimeout(function(){fecharCamera();cb(f);},800);
    }
  }).catch(function(e){fecharCamera();cb(null);console.error(e);});
}

// ===== UTILS =====
function ms(id){document.querySelectorAll('.s').forEach(function(t){t.classList.toggle('on',t.id===id);});}
function voltar(){fa=null;_regsUser={};ms('ts');rl();}
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

// ===== TELA PRINCIPAL =====
function rl(){
  var el=document.getElementById('lista');
  var cfg=CFG.get();
  document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
  el.innerHTML='<div class="empty">Carregando...</div>';
  var hoje=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  carregarFuncs(function(funcs){
    if(!funcs.length){el.innerHTML='<div class="empty">Nenhum colaborador ainda.<br>Painel Admin > Colaboradores</div>';return;}
    apiGet({acao:'getStatusHoje',data:hoje},function(data){
      renderLista(funcs,data.ok?data.status:{});
    },function(){renderLista(funcs,{});});
  });
}

function renderLista(funcs,statusMap){
  var el=document.getElementById('lista');
  el.innerHTML=funcs.map(function(f){
    var tipos=statusMap[f.id]||[];
    var s,c;
    if(tipos.indexOf('SAIDA')>=0){s='Saiu';c='ok';}
    else if(tipos.indexOf('ENTRADA')>=0){s='Presente';c='pres';}
    else{s='Ausente';c='nd';}
    var ini=f.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var avatar=f.foto?'<div class="av" style="background-image:url('+f.foto+');background-size:cover;background-position:center"></div>':'<div class="av">'+ini+'</div>';
    return '<button class="fb" data-id="'+f.id+'">'+avatar+'<div><div class="fn">'+f.nome+'</div><div class="fc">'+(f.cargo||'-')+'</div></div><span class="fst '+c+'">'+s+'</span></button>';
  }).join('');
  document.querySelectorAll('#lista .fb').forEach(function(btn){
    btn.addEventListener('click',function(){selecionarColaborador(btn.dataset.id);});
  });
}

// ===== SELECIONAR =====
function selecionarColaborador(id){
  if(!_funcs)return;
  var f=_funcs.find(function(x){return x.id===id;});
  if(!f)return;
  var comRosto=_funcs.some(function(x){return x.desc&&x.desc.length>0;});
  if(!comRosto){ap(id);return;}
  if(!f.desc||!f.desc.length){toast('Colaborador sem rosto cadastrado. Contate o admin.',1);return;}
  abrirCamera('reconhecimento',function(fRec){
    if(!fRec){mostrarSemBio(_funcs);return;}
    if(fRec.id!==id){toast('Rosto nao confere com '+f.nome,1);return;}
    ap(fRec.id);
  });
}

function mostrarSemBio(lista){mostrarRecadastro(lista);}
function mostrarRecadastro(lista){
var painel=document.getElementById('sem-bio');
var ul=document.getElementById('bio-lista');
ul.innerHTML='';
var semGestor=lista.filter(function(f){return !f.gestor;});
if(!semGestor.length){painel.style.display='none';toast('Contate o gestor',1);return;}
semGestor.forEach(function(f){
var ini=f.nome.split(' ').map(function(p){return p[0];}).join('').substring(0,2).toUpperCase();
var btn=document.createElement('button');
btn.className='bio-item';
btn.innerHTML='<div class="av">'+ini+'</div><div><div class="fn">'+f.nome+'</div><div class="fc">'+(f.cargo||'Colaborador')+'</div></div>';
btn.addEventListener('click',function(){
painel.style.display='none';
toast('Posicione seu rosto na câmera');
abrirCamera('cadastro',function(foto,desc){
f.foto=foto;f.desc=desc;sincronizarColaboradores();
var ov=document.createElement('div');
ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999';
var bx=document.createElement('div');
bx.style.cssText='background:#1a1a0f;border:2px solid #7dcf3a;border-radius:14px;padding:36px 44px;text-align:center;max-width:320px;width:88%';
bx.innerHTML='<div style="font-size:48px;margin-bottom:12px">✅</div><p style="color:#7dcf3a;font-size:1.1em;font-weight:bold;margin:0 0 8px">Biometria recadastrada com sucesso!</p><p style="color:#aaa;font-size:.9em;margin:0 0 24px">Seu gestor será notificado.</p><button style="background:#C9A84C;color:#111;border:none;padding:11px 40px;border-radius:8px;font-size:1.05em;font-weight:bold;cursor:pointer">OK</button>';
ov.appendChild(bx);document.body.appendChild(ov);
var gestor=(_funcs||[]).find(function(x){return x.gestor;});
if(gestor&&gestor.whatsapp&&gestor.wppKey){
var msg=encodeURIComponent('\u26a0\ufe0f Alden Caps\n'+f.nome+' recadastrou biometria em '+new Date().toLocaleString('pt-BR'));
fetch('https://api.callmebot.com/whatsapp.php?phone='+gestor.whatsapp+'&text='+msg+'&apikey='+gestor.wppKey,{mode:'no-cors'}).catch(function(){});
}
bx.querySelector('button').addEventListener('click',function(){ov.remove();ap(f.id);});
});
});
ul.appendChild(btn);
});
painel.style.display='flex';
}

function ap(id){
  if(!_funcs)return;
  fa=_funcs.find(function(x){return x.id===id;})||null;
  if(!fa)return;
  document.getElementById('pnome').textContent=fa.nome;
  document.getElementById('pcargo').textContent=fa.cargo||'Colaborador';
  var ini=fa.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  var el=document.getElementById('hini');
  if(fa.foto){el.style.backgroundImage='url('+fa.foto+')';el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.textContent='';}
  else{el.style.backgroundImage='';el.textContent=ini;}
  ms('tp');setSS('i');
  (function(){
    var sb=document.getElementById('saldo-banco');
    if(sb){ sb.style.display='none'; sb.className=''; sb.textContent=''; }
    apiGet({acao:'getSaldoBanco',nome:fa.nome},function(d){
      if(d&&d.ok&&d.temSaldo&&d.msg){
        sb.textContent=d.msg;
        sb.className=(d.tipo==='alerta')?'alerta':(d.tipo==='positivo')?'positivo':'';
        sb.style.display='block';
      }
    },function(){});
  })();['bENTRADA','bSAIDA_ALMOCO','bRETORNO_ALMOCO','bSAIDA'].forEach(function(b){var el=document.getElementById(b);if(el)el.disabled=true;});
  var hoje=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  apiGet({acao:'getRegistrosHoje',nome:fa.nome,data:hoje},function(data){
    _regsUser={};
    if(data.ok&&data.registros)data.registros.forEach(function(r){_regsUser[r.tipo]=r.hora;});
    atBotoes();
  },function(){['bENTRADA','bSAIDA_ALMOCO','bRETORNO_ALMOCO','bSAIDA'].forEach(function(b){var el=document.getElementById(b);if(el)el.disabled=true;});});
}

function marcar(tipo){
  if(!fa)return;
  if(_regsUser[tipo]){toast('Ja registrado!',1);return;}
  var n=new Date(),p=function(v){return String(v).padStart(2,'0');};
  var hora=p(n.getHours())+':'+p(n.getMinutes()),data=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  _regsUser[tipo]=hora;
  atBotoes();
  msgPonto(tipo);
  setSS('s');
  var cfg=CFG.get();
  var pl={setor:cfg.setor,nome:fa.nome,cargo:fa.cargo||'-',tipo:tipo,hora:hora,data:data,timestamp:new Date().toISOString()};
  fetch(SU,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(pl)})
    .then(function(){setSS('ok');}).catch(function(){setSS('e');});
}

function setSS(s){
  var d=document.getElementById('sdot'),x=document.getElementById('stxt');
  if(!d)return;
  if(s==='ok'){d.className='dt dg';x.textContent='Enviado';}
  else if(s==='s'){d.className='dt da';x.textContent='Enviando...';}
  else if(s==='e'){d.className='dt dr';x.textContent='Offline';}
  else{d.className='dt da';x.textContent='-';}
}

function msgPonto(tipo){
  var msgs={ENTRADA:'Ponto registrado!|Bom trabalho!',SAIDA_ALMOCO:'Ponto registrado!|Bom almoço!',RETORNO_ALMOCO:'Ponto registrado!|Bom trabalho!',SAIDA:'Ponto registrado!|Bom descanso!'};
  var p=(msgs[tipo]||'Ponto registrado!|').split('|');
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
  var bx=document.createElement('div');
  bx.style.cssText='background:#1a1a0f;border:2px solid #C9A84C;border-radius:14px;padding:36px 44px;text-align:center;max-width:300px;width:85%;';
  bx.innerHTML='<p style="color:#C9A84C;font-size:1em;font-weight:bold;margin:0 0 6px">'+p[0]+'</p><p style="color:#e7e2d4;font-size:1.35em;font-weight:600;margin:0 0 28px">'+p[1]+'</p><button style="background:#C9A84C;color:#111;border:none;padding:11px 40px;border-radius:8px;font-size:1.05em;font-weight:bold;cursor:pointer">OK</button>';
  ov.appendChild(bx);document.body.appendChild(ov);
  bx.querySelector('button').addEventListener('click',function(){ov.remove();});
}
function atBotoes(){
  var seq=['ENTRADA','SAIDA_ALMOCO','RETORNO_ALMOCO','SAIDA'];
  var nextIdx=seq.findIndex(function(t){return !_regsUser[t];});
  seq.forEach(function(t,idx){
    var b=document.getElementById('b'+t),h=document.getElementById('h'+t),r=document.getElementById('r'+t);
    if(!b)return;
    var hora=_regsUser[t];
    if(hora){
      b.disabled=true;h.textContent=hora;r.textContent=hora;
      if(!b.querySelector('.ck')){var ck2=document.createElement('span');ck2.className='ck';ck2.innerHTML='<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';b.appendChild(ck2);}
    } else {
      b.disabled=(idx!==nextIdx);
      h.textContent='';r.textContent='-';
      var ck=b.querySelector('.ck');if(ck)ck.remove();
    }
  });
}

// ===== ADMIN =====
function abrirAdmin(){
  var _mod=document.getElementById('mod');
  if(_mod.parentElement!==document.body)document.body.appendChild(_mod);
  _mod.style.zIndex='99999';
  document.getElementById('merr').style.display='none';
  document.getElementById('msenha').value='';
  document.getElementById('mod').style.display='flex';
  setTimeout(function(){document.getElementById('msenha').focus();},100);
}
function fecharMod(){document.getElementById('mod').style.display='none';}
function okAdm(){
  if(document.getElementById('msenha').value===CFG.get().senha){fecharMod();ms('ta');abaF();radAdm();}
  else{document.getElementById('merr').style.display='block';}
}
function abaF(){
  document.getElementById('tab-f').classList.add('on');document.getElementById('tab-c').classList.remove('on');
  document.getElementById('pf').classList.add('on');document.getElementById('pc').classList.remove('on');
  fecharEdit();radAdm();
}
function abaC(){
  document.getElementById('tab-c').classList.add('on');document.getElementById('tab-f').classList.remove('on');
  document.getElementById('pc').classList.add('on');document.getElementById('pf').classList.remove('on');
  preencherConfig(CFG.get());
  apiGet({acao:'getConfig'}, function(r){
    if(r&&r.ok&&r.config&&Object.keys(r.config).length){
      var merged=Object.assign({}, CFG.get(), r.config);
      CFG.set(merged);
      preencherConfig(merged);
    }
  });
}
function preencherConfig(c){
  c=c||{};
  function sv(id,val){var e=document.getElementById(id);if(e)e.value=val||'';}
  sv('csetor',c.setor);sv('ccnpj',c.cnpj);sv('crazao',c.razaoSocial);
  sv('cendereco',c.endereco);sv('ccidade',c.cidade);sv('ccep',c.cep);
  sv('cemail',c.email);sv('ctelefone',c.telefone);sv('cwhatsapp',c.whatsapp);sv('cwppkey',c.wppKey);
}

function radAdm(){
  carregarFuncs(function(funcs){
    var el=document.getElementById('adml');
    if(!funcs.length){el.innerHTML='<div class="empty">Nenhum colaborador</div>';return;}
    el.innerHTML=funcs.map(function(f){
      var temFoto=f.foto?'<img src="'+f.foto+'" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid '+(f.desc?'#7dcf3a':'#C9A84C')+'" />':'<div class="fav">'+f.nome.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()+'</div>';
      var badgeFace=f.desc?'<span style="font-size:10px;color:#7dcf3a;margin-right:4px">&#128247;&#10003;</span>':'<span style="font-size:10px;color:#f09595;margin-right:4px">&#128247;&#10005;</span>';
      function lin(rot,val){return val?'<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid rgba(201,168,76,.08)"><span style="color:var(--t2);font-size:11px">'+rot+'</span><span style="font-size:12px;text-align:right">'+val+'</span></div>':'';}
      var det='<div class="cdet" id="cdet-'+f.id+'" style="display:none;padding:10px 12px;background:rgba(0,0,0,.18);border-top:1px solid var(--b)">'
        +lin('CPF',f.cpf)+lin('RG',f.rg)+lin('Nascimento',f.dataNasc)+lin('Admiss\u00e3o',f.dataAdmissao)
        +lin('Endere\u00e7o',f.endereco)+lin('Cidade/UF',f.cidade)+lin('CEP',f.cep)
        +lin('E-mail',f.email)+lin('WhatsApp',f.whatsapp)+lin('Gestor',f.gestor?'Sim':'')
        +'</div>';
      return '<div class="fcard" style="flex-direction:column;align-items:stretch;padding:0;overflow:hidden">'
        +'<div style="display:flex;align-items:center;gap:10px;padding:12px 14px">'
        +'<button class="cexp" data-id="'+f.id+'" style="background:none;border:none;display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;text-align:left;color:inherit;padding:0">'
        +temFoto+'<div style="flex:1"><div class="fn">'+f.nome+'</div><div style="font-size:12px;color:var(--t2)">'+(f.cargo||'-')+' '+badgeFace+'</div></div>'
        +'<span class="cseta" id="cseta-'+f.id+'" style="color:var(--t2);font-size:12px">&#9656;</span></button>'
        +'<button class="bcam" data-id="'+f.id+'" title="Cadastrar rosto">&#128247;</button>'
        +'<button class="bedt" data-id="'+f.id+'" title="Editar">&#9998;</button>'
        +'<button class="brm" data-id="'+f.id+'" title="Remover">&#10005;</button>'
        +'</div>'+det+'</div>';
    }).join('');
    document.querySelectorAll('#adml .cexp').forEach(function(btn){btn.addEventListener('click',function(){var d=document.getElementById('cdet-'+btn.dataset.id);var s=document.getElementById('cseta-'+btn.dataset.id);if(d){var ab=d.style.display==='none';d.style.display=ab?'block':'none';if(s)s.innerHTML=ab?'&#9662;':'&#9656;';}});});
    document.querySelectorAll('#adml .brm').forEach(function(btn){btn.addEventListener('click',function(){rmF(btn.dataset.id);});});
    document.querySelectorAll('#adml .bedt').forEach(function(btn){btn.addEventListener('click',function(){abrirEdit(btn.dataset.id);});});
    document.querySelectorAll('#adml .bcam').forEach(function(btn){btn.addEventListener('click',function(){cadastrarRosto(btn.dataset.id);});});
  });
}

function cadastrarRosto(id){
  var f=(_funcs||[]).find(function(x){return x.id===id;});
  if(!f)return;
  toast('Posicione o rosto de '+f.nome+' na camera');
  abrirCamera('cadastro',function(foto,desc){
    f.foto=foto;f.desc=desc;
    sincronizarColaboradores();
    radAdm();toast('Rosto de '+f.nome+' cadastrado!');
  });
}

function abrirEdit(id){
  var f=(_funcs||[]).find(function(x){return x.id===id;});
  if(!f)return;
  feditId=id;
  function sv(eid,val){var e=document.getElementById(eid);if(e)e.value=val||'';}
  sv('enome',f.nome);sv('ecargo',f.cargo);sv('eemail',f.email);
  sv('ewhatsapp',f.whatsapp);sv('ewppkey',f.wppKey);
  sv('ecpf',f.cpf);sv('erg',f.rg);sv('edatanasc',f.dataNasc);sv('edataadm',f.dataAdmissao);
  sv('eendereco',f.endereco);sv('ecidade',f.cidade);sv('ecep',f.cep);
  var eg=document.getElementById('egestor');if(eg)eg.checked=!!f.gestor;
  var _eb=document.getElementById('edit-box');
  var _card=document.querySelector('#adml .fcard [data-id="'+id+'"]');
  _card=_card?_card.closest('.fcard'):null;
  if(_card){_card.appendChild(_eb);}
  _eb.style.display='block';
  document.getElementById('enome').focus();
}
function fecharEdit(){feditId=null;var _eb=document.getElementById('edit-box');if(_eb){_eb.style.display='none';var _pf=document.getElementById('pf');var _adml=document.getElementById('adml');if(_pf&&_adml&&_eb.parentElement!==_pf){_adml.insertAdjacentElement('afterend',_eb);}}}
function salvarEdit(){
  if(!feditId)return;
  var nome=document.getElementById('enome').value.trim(),cargo=document.getElementById('ecargo').value.trim();
  if(!nome){toast('Informe o nome',1);return;}
  var f=(_funcs||[]).find(function(x){return x.id===feditId;});
  if(!f)return;
  function gv(eid){var e=document.getElementById(eid);return e?e.value.trim():'';}
  f.nome=nome;f.cargo=cargo;f.email=gv('eemail');
  f.whatsapp=gv('ewhatsapp');f.wppKey=gv('ewppkey');
  f.cpf=gv('ecpf');f.rg=gv('erg');f.dataNasc=gv('edatanasc');f.dataAdmissao=gv('edataadm');
  f.endereco=gv('eendereco');f.cidade=gv('ecidade');f.cep=gv('ecep');
  var eg=document.getElementById('egestor');if(eg)f.gestor=eg.checked;
  sincronizarColaboradores();fecharEdit();radAdm();rl();toast('Atualizado!');
}
function testarWpp(p,k){var ph=(document.getElementById(p)||{}).value||'',ak=(document.getElementById(k)||{}).value||'';if(!ph||!ak){toast('Preencha WhatsApp e API Key',1);return;}fetch('https://api.callmebot.com/whatsapp.php?phone='+ph+'&text=Teste+-+Ponto+Alden+Caps&apikey='+ak,{mode:'no-cors'}).then(function(r){return r.text();}).then(function(t){toast(t.toLowerCase().includes('queued')?'Mensagem enviada!':'Enviado! Confira o WhatsApp.',0);}).catch(function(){toast('Erro. Verifique os dados.',1);});}
function toggleNovoColab(){
var f=document.getElementById('form-novo-colab');
if(f)f.style.display=f.style.display==='none'?'block':'none';
}
function addF(){
var nome=document.getElementById('fnome').value.trim();
var cargo=document.getElementById('fcargo').value.trim();
if(!nome){toast('Informe o nome',1);return;}
if(!_funcs)_funcs=[];
_funcs.push({
id:Date.now().toString(),nome:nome,cargo:cargo,
cpf:document.getElementById('fcpf')?.value.trim()||'',
rg:document.getElementById('frg')?.value.trim()||'',
dataNasc:document.getElementById('fdatanasc')?.value.trim()||'',
dataAdmissao:document.getElementById('fdataadm')?.value.trim()||'',
endereco:document.getElementById('fendereco')?.value.trim()||'',
cidade:document.getElementById('fcidade')?.value.trim()||'',
cep:document.getElementById('fcep')?.value.trim()||'',
email:document.getElementById('femail')?.value.trim()||'',
whatsapp:document.getElementById('fwhatsapp')?.value.trim()||'',
wppKey:document.getElementById('fwppkey')?.value.trim()||'',
gestor:document.getElementById('fgestor')?.checked||false,
foto:null,desc:null
});
sincronizarColaboradores();
['fnome','fcargo','fcpf','frg','fdatanasc','fdataadm','fendereco','fcidade','fcep','femail','fwhatsapp','fwppkey'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
var fg=document.getElementById('fgestor');if(fg)fg.checked=false;
var fb=document.getElementById('form-novo-colab');if(fb)fb.style.display='none';
radAdm();rl();toast('Colaborador adicionado! Cadastre o rosto clicando em 📷');
}
function rmF(id){
  if(!confirm('Remover colaborador?'))return;
  _funcs=(_funcs||[]).filter(function(f){return f.id!==id;});
  sincronizarColaboradores();radAdm();rl();toast('Removido');
}
function salvarC(){
var cfg=CFG.get();
var s=document.getElementById('csetor')?.value.trim();
var p=document.getElementById('csenha')?.value.trim();
if(s)cfg.setor=s;
if(p&&p.length>=4)cfg.senha=p;
cfg.cnpj=document.getElementById('ccnpj')?.value.trim()||cfg.cnpj||'';
cfg.razaoSocial=document.getElementById('crazao')?.value.trim()||cfg.razaoSocial||'';
cfg.endereco=document.getElementById('cendereco')?.value.trim()||cfg.endereco||'';
cfg.cidade=document.getElementById('ccidade')?.value.trim()||cfg.cidade||'';
cfg.cep=document.getElementById('ccep')?.value.trim()||cfg.cep||'';
cfg.email=document.getElementById('cemail')?.value.trim()||cfg.email||'';
cfg.telefone=document.getElementById('ctelefone')?.value.trim()||cfg.telefone||'';
cfg.whatsapp=document.getElementById('cwhatsapp')?.value.trim()||cfg.whatsapp||'';
cfg.wppKey=document.getElementById('cwppkey')?.value.trim()||cfg.wppKey||'';
CFG.set(cfg);
apiPost({acao:'salvarConfig',config:cfg});
if(document.getElementById('bsetor'))document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
if(document.getElementById('adm-setor'))document.getElementById('adm-setor').textContent=cfg.setor;
toast('Configurações salvas!');
}
function alterarSenhaAcesso(){
var nova=document.getElementById('csenha-acesso')?.value.trim();
var conf=document.getElementById('csenha-acesso2')?.value.trim();
if(!nova||nova.length<4){toast('Mínimo 4 caracteres',1);return;}
if(nova!==conf){toast('As senhas não conferem',1);return;}
var cfg=CFG.get();cfg.senhaAcesso=nova;CFG.set(cfg);
localStorage.setItem('ponto_acesso_senha',nova);
apiPost({acao:'salvarConfig',config:cfg});
document.getElementById('csenha-acesso').value='';
document.getElementById('csenha-acesso2').value='';
toast('Senha de acesso alterada!');
}


// ===== RELATORIO =====
function abrirRelatorio(){
var nM=['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var hoje=new Date();
var esc=prompt('Relatorio de qual periodo?\n\n1 = Mes atual ('+nM[hoje.getMonth()]+'/'+hoje.getFullYear()+')\n2 = Escolher mes\n3 = Todos os meses\n\nDigite 1, 2 ou 3:','1');
if(esc===null) return;
esc=String(esc).trim();
var modo='mes', mes=hoje.getMonth()+1, ano=hoje.getFullYear();
if(esc==='3'){ modo='tudo'; }
else if(esc==='2'){
  var mm=prompt('Digite o mes e ano (MM/AAAA):', ('0'+(hoje.getMonth()+1)).slice(-2)+'/'+hoje.getFullYear());
  if(mm===null) return;
  var pm=String(mm).split('/');
  mes=parseInt(pm[0],10); ano=parseInt(pm[1],10);
  if(!mes||!ano||mes<1||mes>12){ toast('Data invalida',1); return; }
}
toast('Gerando relatorio, aguarde...');
apiGet({acao:'getRelatorioHtml',mes:mes,ano:ano,modo:modo},function(data){
  if(!data||!data.ok||!data.html){ toast('Erro ao gerar relatorio',1); return; }
  var w=window.open('','_blank');
  if(!w){ toast('Permita pop-ups para ver o relatorio',1); return; }
  w.document.open(); w.document.write(data.html); w.document.close();
},function(){ toast('Erro ao gerar relatorio',1); });
}
function gerarRelatorioFolha(folha,tMes){
var fotoDe={};(_funcs||[]).forEach(function(f){fotoDe[f.nome]=f.foto;});
var _emp=CFG.get()||{};
var _logoUrl='https://aldencaps271.github.io/ponto/Logo%20Novo.png';
var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatorio '+tMes+'</title><style>';
html+='*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#333;font-size:11px}';
html+='.pagina{width:210mm;min-height:297mm;padding:10mm 12mm;page-break-after:always;display:flex;flex-direction:column}.pagina:last-of-type{page-break-after:avoid}';
html+='.topo{text-align:center;margin-bottom:6px;border-bottom:2px solid #C9A84C;padding-bottom:6px}.topo h1{color:#C9A84C;font-size:16px;margin:0}.topo p{color:#888;font-size:10px;margin:2px 0}';
html+='.cabec{display:flex;align-items:center;gap:14px;justify-content:flex-start;text-align:left}.logo-rel{width:60px;height:60px;object-fit:cover;border-radius:50%;border:2px solid #C9A84C;flex-shrink:0}.emp-info{flex:1}.emp-info h1{font-size:15px;margin:0}.emp-info p{margin:1px 0}.emp-info .periodo{color:#C9A84C;font-weight:bold;font-size:11px;margin-top:3px}';
html+='.info-func{display:flex;align-items:center;gap:10px;background:#1c1a10;color:#C9A84C;padding:8px 10px;border-radius:6px;margin-bottom:6px}';
html+='.info-func img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #C9A84C;flex-shrink:0}.info-func .nome{font-size:13px;font-weight:bold}.info-func .cargo{font-size:10px;color:#e8c86a}';
html+='table{width:100%;border-collapse:collapse;flex:1}thead tr{background:#2d2a1a}thead th{color:#C9A84C;padding:5px 4px;text-align:center;font-size:10px;border:1px solid #444}';
html+='tbody tr{height:22px}tbody tr:nth-child(even){background:#fafafa}tbody tr.fds{background:#f0ece0;color:#aaa;font-style:italic}tbody tr.falta{background:#fde2e2}tbody td{padding:3px 4px;text-align:center;border:1px solid #ddd;font-size:10px}';
html+='.td-data{text-align:left;font-weight:500;padding-left:6px}.atraso{color:#c0392b;font-weight:bold}.extra{color:#27ae60;font-weight:bold}.falta-txt{color:#c0392b;font-weight:bold}';
html+='.totais-row td{background:#2d2a1a;color:#C9A84C;font-weight:bold;border:1px solid #444;padding:5px 4px}';
html+='.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:12px 0 0;margin-top:8px;border-top:1px solid #ddd}.assin-campo{margin-top:28px;border-top:1px solid #333;padding-top:3px;text-align:center;font-size:9px;color:#888}.assin-label{font-size:10px;color:#666}';
html+='@media print{body{margin:0}.pagina{padding:8mm 10mm}button{display:none}}</style></head><body>';
Object.keys(folha).forEach(function(nome){
var d=folha[nome];var foto=fotoDe[nome];var fotoTag=foto?'<img src="'+foto+'" />':'';
var _razao=_emp.razaoSocial||_emp.setor||'ALDEN CAPS';
var _cnpjL=_emp.cnpj?'<p>CNPJ: '+_emp.cnpj+'</p>':'';
var _endL=_emp.endereco?'<p>'+_emp.endereco+(_emp.cidade?' - '+_emp.cidade:'')+(_emp.cep?' - CEP '+_emp.cep:'')+'</p>':'';
html+='<div class="pagina"><div class="topo"><div class="cabec"><img src="'+_logoUrl+'" class="logo-rel" onerror="this.style.display=\'none\'" /><div class="emp-info"><h1>'+_razao+'</h1>'+_cnpjL+_endL+'<p class="periodo">FOLHA DE PONTO - Periodo: '+tMes+'</p></div></div></div>';
html+='<div class="info-func">'+fotoTag+'<div><div class="nome">'+nome+'</div><div class="cargo">'+(d.cargo||'Colaborador')+'</div></div></div>';
html+='<table><thead><tr><th style="width:70px">Data</th><th style="width:40px">Dia</th><th>Entrada</th><th>S.Almoco</th><th>Retorno</th><th>Saida</th><th>Trabalhado</th><th>Atraso</th><th>H.Extras</th><th style="width:28px">%</th></tr></thead><tbody>';
d.linhas.forEach(function(L){
var cls=(L.tipo==='fds'||L.tipo==='feriado')?'fds':(L.falta?'falta':'');
var diaTxt=L.diaSem+(L.tipo==='feriado'?' Fer':'');
var trabTxt=L.falta?'<span class="falta-txt">FALTA</span>':(L.trabalhado||'-');
var en=(L.entrada&&L.entrada!=='-')?L.entrada:'-';var sa=(L.saidaAlmoco&&L.saidaAlmoco!=='-')?L.saidaAlmoco:'-';
var re=(L.retorno&&L.retorno!=='-')?L.retorno:'-';var si=(L.saida&&L.saida!=='-')?L.saida:'-';
html+='<tr class="'+cls+'"><td class="td-data">'+L.data+'</td><td>'+diaTxt+'</td><td>'+en+'</td><td>'+sa+'</td><td>'+re+'</td><td>'+si+'</td><td>'+trabTxt+'</td><td class="'+(L.atraso?'atraso':'')+'">'+(L.atraso||'-')+'</td><td class="'+(L.extra?'extra':'')+'">'+(L.extra||'-')+'</td><td>'+(L.extra?(L.pct+'%'):'-')+'</td></tr>';
});
var t=d.totais;
html+='<tr class="totais-row"><td colspan="6" style="text-align:center">TOTAIS DO MES</td><td>'+t.trabalhado+'</td><td>'+(t.atraso&&t.atraso!=='\u2014'?'<span style="color:#c0392b">'+t.atraso+'</span>':t.atraso)+'</td><td colspan="2">50%: '+t.extra50+' / 100%: '+t.extra100+'</td></tr></tbody></table>';
html+='<div class="assinaturas"><div><p class="assin-label">Assinatura do Colaborador</p><div class="assin-campo">'+nome+'</div></div><div><p class="assin-label">Assinatura do Responsavel</p><div class="assin-campo">Gestor Responsavel</div></div></div></div>';
});
html+='<div style="text-align:center;padding:20px"><button onclick="window.print()" style="background:#C9A84C;color:#1c1a10;border:none;padding:12px 36px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer">Imprimir / Salvar PDF</button></div></body></html>';
var w=window.open('','_blank');w.document.write(html);w.document.close();
}
window.addEventListener('DOMContentLoaded',function(){
  var cfg=CFG.get();
  apiGet({acao:'getConfig'}, function(r){
    if(r&&r.ok&&r.config&&Object.keys(r.config).length){
      var m=Object.assign({}, CFG.get(), r.config);
      CFG.set(m);
      if(r.config.senhaAcesso) localStorage.setItem('ponto_acesso_senha', r.config.senhaAcesso);
      if(document.getElementById('bsetor')) document.getElementById('bsetor').textContent=(m.setor||'').toUpperCase();
    }
  });
  document.getElementById('bsetor').textContent=cfg.setor.toUpperCase();
  document.getElementById('adm-setor').textContent=cfg.setor;
  carregarFuncs(function(){rl();});
  setInterval(tick,1000);tick();ms('ts');
  document.getElementById('btn-admin').addEventListener('click',abrirAdmin);
  
  document.getElementById('btn-voltar2').addEventListener('click',voltar);
  document.getElementById('btn-cancel').addEventListener('click',fecharMod);
  document.getElementById('btn-ok').addEventListener('click',okAdm);
  document.getElementById('msenha').addEventListener('keydown',function(e){if(e.key==='Enter')okAdm();});
  document.getElementById('tab-f').addEventListener('click',abaF);
  document.getElementById('tab-c').addEventListener('click',abaC);
  document.getElementById('btn-add').addEventListener('click',addF);document.getElementById('btn-test-wpp-edit')?.addEventListener('click',function(){testarWpp('ewhatsapp','ewppkey');});document.getElementById('btn-test-wpp-add')?.addEventListener('click',function(){testarWpp('fwhatsapp','fwppkey');});
  document.getElementById('btn-salvarc').addEventListener('click',salvarC);
document.getElementById('btn-salvar-empresa')?.addEventListener('click',salvarC);
document.getElementById('btn-salvar-senha-acesso')?.addEventListener('click',alterarSenhaAcesso);
  document.getElementById('btn-relatorio').addEventListener('click',abrirRelatorio);
  document.getElementById('btn-salvar-edit').addEventListener('click',salvarEdit);
  document.getElementById('btn-cancelar-edit').addEventListener('click',fecharEdit);
  document.getElementById('cam-fechar').addEventListener('click',fecharCamera);
  document.getElementById('bio-fechar') && document.getElementById('bio-fechar').addEventListener('click',function(){document.getElementById('sem-bio').style.display='none';fecharCamera();});
  document.getElementById('bENTRADA').addEventListener('click',function(){marcar('ENTRADA');});
  document.getElementById('bSAIDA_ALMOCO').addEventListener('click',function(){marcar('SAIDA_ALMOCO');});
  document.getElementById('bRETORNO_ALMOCO').addEventListener('click',function(){marcar('RETORNO_ALMOCO');});  document.getElementById('btn-home')?.addEventListener('click',voltar);
  document.getElementById('bSAIDA').addEventListener('click',function(){marcar('SAIDA');});
  document.addEventListener('abrirReconhecimento',function(){
    if(!_funcs){carregarFuncs(function(funcs){
      var comFoto=funcs.filter(function(f){return f.desc&&f.desc.length>0;});
      if(comFoto.length>0){abrirCamera('reconhecimento',function(f){if(f)ap(f.id);else mostrarSemBio(funcs);});}
      else{fecharCamera();mostrarSemBio(funcs);}
    });return;}
    var comFoto=(_funcs||[]).filter(function(f){return f.desc&&f.desc.length>0;});
    if(comFoto.length>0){abrirCamera('reconhecimento',function(f){if(f)ap(f.id);else mostrarSemBio(_funcs||[]);});}
    else{fecharCamera();mostrarSemBio(_funcs||[]);}
  });
  document.addEventListener('selecionarColaborador',function(e){if(e.detail)ap(e.detail.id);});
});
