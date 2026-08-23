/* 岡山倉敷 初春手帖 — 離線快取 */
var VER = "2027-okayama-v2";
var CORE = "core-" + VER;
var FONTS = "fonts-" + VER;
var SHELL = ["./","./index.html","./manifest.webmanifest",
             "./icon-192.png","./icon-512.png","./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CORE).then(function(c){
    return Promise.all(SHELL.map(function(u){
      return c.add(new Request(u,{cache:"reload"})).catch(function(){});
    }));
  }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){
      if(k!==CORE && k!==FONTS) return caches.delete(k);
    }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req=e.request;
  if(req.method!=="GET") return;
  var url=new URL(req.url);

  /* Google Fonts：第一次連得上網時存起來，之後永遠從快取拿 */
  if(url.hostname==="fonts.googleapis.com" || url.hostname==="fonts.gstatic.com"){
    e.respondWith(caches.open(FONTS).then(function(c){
      return c.match(req).then(function(hit){
        var net=fetch(req).then(function(r){
          if(r && (r.ok || r.type==="opaque")) c.put(req, r.clone());
          return r;
        }).catch(function(){ return hit; });
        return hit || net;
      });
    }));
    return;
  }

  if(url.origin!==location.origin) return;

  /* 自己的檔案：先給快取（開得快、離線也開得了），背景再更新 */
  e.respondWith(caches.open(CORE).then(function(c){
    return c.match(req, {ignoreSearch:true}).then(function(hit){
      var net=fetch(req).then(function(r){
        if(r && r.ok) c.put(req, r.clone());
        return r;
      }).catch(function(){
        return hit || c.match("./index.html");
      });
      return hit || net;
    });
  }));
});
