{\rtf1\ansi\ansicpg950\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fmodern\fcharset0 Courier;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\paperw8617\paperh5442\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs26 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 // Service Worker for Offline PWA Support\
const CACHE_NAME = 'barcode-pwa-v1';\
const ASSETS_TO_CACHE = [\
  './',\
  './index.html',\
  './manifest.json',\
  'https://cdn.tailwindcss.com',\
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',\
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',\
  'https://unpkg.com/@zxing/library@latest/umd/index.min.js',\
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'\
];\
\
self.addEventListener('install', (event) => \{\
  event.waitUntil(\
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))\
  );\
  self.skipWaiting();\
\});\
\
self.addEventListener('activate', (event) => \{\
  event.waitUntil(\
    caches.keys().then((keys) => Promise.all(\
      keys.map((key) => \{\
        if (key !== CACHE_NAME) return caches.delete(key);\
      \})\
    ))\
  );\
  self.clients.claim();\
\});\
\
self.addEventListener('fetch', (event) => \{\
  event.respondWith(\
    caches.match(event.request).then((cachedResponse) => \{\
      return cachedResponse || fetch(event.request);\
    \})\
  );\
\});\
}