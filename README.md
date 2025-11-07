# 🛰️ FreeSWITCH Event Socket Client (Node.js)

A simple, lightweight, and fully reconnect-capable **FreeSWITCH Event Socket (ESL) client** written in pure Node.js — no dependencies.  
It allows you to connect to FreeSWITCH over TCP (typically port `8021`), authenticate, subscribe to events, send commands, and handle live call state in real-time.

---

## 🚀 Features

✅ Connects directly to FreeSWITCH’s **Event Socket Layer (ESL)**  
✅ Handles **auth, events, and command replies** natively  
✅ Supports **JSON event streaming** (`event json CHANNEL_CREATE ...`)  
✅ Includes **automatic reconnect with exponential backoff**  
✅ Preserves event subscriptions across reconnects  
✅ Clean, callback-based API  
✅ No external dependencies  

---

## 📦 Installation

Clone the repository and install:

```bash
git clone https://github.com/dev-sach-in/freeswitch-esl.git
cd freeswitch-event-client
npm install
```

## 🧠 Quick Example
```javascript
const FreeSwitch = require('./modules/freeswitch');

// Connect to FreeSWITCH event socket
const fsc = new FreeSwitch.client('127.0.0.1', 8021, 'ClueCon');

// When connected
fsc.on('connect', () => {
  console.log('✅ Connected to FreeSWITCH');
  // Subscribe to some call events
  fsc.event('CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_HANGUP CHANNEL_DESTROY');
});

// Handle channel create
fsc.on('CHANNEL_CREATE', (event) => {
  console.log('📞 Channel created:', event['Channel-Name'], event['Unique-ID']);
});

// Handle hangup
fsc.on('CHANNEL_HANGUP', (event) => {
  console.log('❌ Call ended:', event['Unique-ID']);
});

// Auto reconnect handler
fsc.on('disconnect', () => {
  console.log('⚠️ Disconnected, attempting to reconnect...');
});

fsc.connect();
```
## ⚙️ API Overview
`new FreeSwitch.client(host, port, password)`

Create a new client instance.
`.connect()`

Connect to FreeSWITCH and authenticate automatically.
`.on(eventName, callback)`

Attach an event handler for:
  - Built-in events like connect, disconnect, error
  - FreeSWITCH events like CHANNEL_CREATE, CHANNEL_DESTROY, etc.
`.event(types, callback)`

Subscribe to FreeSWITCH events:
```javascript
fsc.event('CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_HANGUP');
```
`.sendCommand(command, callback)`

Send a FreeSWITCH command and handle its reply:
```javascript
fsc.sendCommand('status', (header, body, success, message) => {
  console.log('Status:', success ? message : 'Error');
});
```
`.exit()`

Gracefully disconnect from the event socket.

## 🔁 Auto Reconnect Logic
If the socket disconnects or FreeSWITCH restarts:
 - The client automatically retries the connection with exponential backoff: 1s → 2s → 4s → 8s → up to 30s
 - Once reconnected, it re-authenticates and triggers your connect event again.

## 🧩 Typical Use Case
This client is perfect for:
 - Real-time call dashboards (e.g., display LEG-A and LEG-B info)
 - Call monitoring or logging tools
 - Event-driven integrations (e.g., CRM popups, click-to-call systems)
 - Custom dialer backends

