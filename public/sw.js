// Cópia da ficha do aluno para abrir sem internet (PWA, registrado em /minha-inscricao).
// Só passa por aqui o que é deste endereço: requisições de terceiros (o Pixel do Meta, por
// exemplo) seguem direto para a rede e nunca são gravadas no aparelho. Versões anteriores
// guardavam também essas respostas; o activate as apaga do cache.
const CACHE='cvb-inscricao-v1';const ASSETS=['/minha-inscricao','/manifest.webmanifest'];const deFora=u=>new URL(u).origin!==self.location.origin;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.open(CACHE).then(c=>c.keys().then(reqs=>Promise.all(reqs.filter(r=>deFora(r.url)).map(r=>c.delete(r)))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||deFora(e.request.url))return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/minha-inscricao'))))});
