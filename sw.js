/* 岡山倉敷 初春手帖 — 離線快取 */
var VER = "2027-okayama-v5";
var CORE = "core-" + VER;
var FONTS = "fonts-" + VER;
var SHELL = ["./","./index.html","./manifest.webmanifest",
             "./icon-192.png","./icon-512.png","./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CORE).then(function(c){
    return Promise.all(SHELL.map(function(u){
      return c.add(u).catch(function(){
        /* 少數瀏覽器 Cache.add 會失敗，改成自己抓自己存 */
        return fetch(u).then(function(r){ if(r&&r.ok) return c.put(u,r); }).catch(function(){});
      });
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

  /* 開啟網頁本身（含主畫面圖示啟動）：離線時一律回快取裡的手帖 */
  if(req.mode==="navigate"){
    /* 一定要繞過瀏覽器自己的 HTTP 快取，不然更新過的網頁不會出現 */
    var fresh;
    try{ fresh=new Request(req.url,{cache:"no-store",mode:"same-origin",credentials:"same-origin",redirect:"follow"}); }
    catch(err){ fresh=req; }
    e.respondWith(
      fetch(fresh).then(function(r){
        if(r && r.ok){ var cp=r.clone(); caches.open(CORE).then(function(c){ c.put(req, cp); }); }
        return r;
      }).catch(function(){
        return caches.open(CORE).then(function(c){
          return c.match(req,{ignoreSearch:true})
            .then(function(h){ return h || c.match("./index.html"); })
            .then(function(h){ return h || c.match("./"); })
            .then(function(h){ return h || new Response(
              "<meta charset=utf-8><body style='font:16px system-ui;padding:40px'>離線內容還沒存好，請連上網路重新整理一次。",
              {headers:{"Content-Type":"text/html; charset=utf-8"}}); });
        });
      })
    );
    return;
  }

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
