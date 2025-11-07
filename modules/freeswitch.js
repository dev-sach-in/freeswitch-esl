var net = require('net');

exports.client = function (host, port, password) {
    var _socket = new net.Socket();
    _socket.setEncoding('utf8');

    var _connected = false;
    var _callbacksList = [];
    var _onHandlers = [];
    var _bgapiHandlers = [];

    let reconnectDelay = 1000; // 1 second initial retry delay
    let reconnectTimer = null;
    const MAX_DELAY = 30000; // 30 seconds max backoff

    const log = (...args) => console.log('[FreeSWITCH]', ...args);

    // --- Event registration
    this.on = function (event, callback) {
        var old = _onHandlers[event];
        _onHandlers[event] = callback;
        return old;
    };

    // --- Connect
    this.connect = function () {
        log(`Connecting to ${host}:${port}...`);
        _socket.connect(port, host);
    };

    this.connected = function () {
        return _connected;
    };

    this.sendCommand = function (command, callback) {
        _callbacksList.push(callback);
        _socket.write(command + '\n\n');
    };

    this.exit = function () {
        this.sendCommand('exit', function () {
            _connected = false;
        });
    };

    this.log = function (level, callback) {
        this.sendCommand('log ' + level, callback);
    };

    this.nolog = function (callback) {
        this.sendCommand('nolog', callback);
    };

    this.event = function (types, callback) {
        this.sendCommand('event json ' + types, callback);
    };

    this.nixevent = function (types, callback) {
        this.sendCommand('nixevent ' + types, callback);
    };

    this.noevent = function (callback) {
        this.sendCommand('noevent', callback);
    };

    // --- Reconnect logic
    const scheduleReconnect = () => {
        if (reconnectTimer) return; // already scheduled
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
        log(`Reconnecting in ${reconnectDelay / 1000}s...`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            this.connect();
        }, reconnectDelay);
    };

    const resetReconnect = () => {
        reconnectDelay = 1000;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    // --- Auth handler
    _onHandlers['auth/request'] = function () {
        _callbacksList.push(function (head, body, success) {
            if (success) {
                _connected = true;
                resetReconnect();
                log('Authenticated successfully!');
                if (_onHandlers['connect']) _onHandlers['connect']();
            } else {
                log('Authentication failed!');
                if (_onHandlers['error'])
                    _onHandlers['error'](head, body, success);
            }
        });
        _socket.write('auth ' + password + '\n\n');
    };

    // --- Command reply
    _onHandlers['command/reply'] = function (header, body) {
        var replyText = /^(\S+)\s?(.+)?/.exec(header['Reply-Text']);
        var callback = _callbacksList.shift();

        if (
            typeof header['Job-UUID'] !== 'undefined' &&
            replyText[1] == '+OK'
        ) {
            _bgapiHandlers[header['Job-UUID']] = callback;
        } else if (callback) {
            callback(header, body, replyText[1] == '+OK', replyText[2]);
        }
    };

    // --- JSON events
    _onHandlers['text/event-json'] = function (header, body) {
        var event = JSON.parse(body);
        if (event['Event-Name'] == 'BACKGROUND_JOB') {
            if (
                typeof event['Job-UUID'] !== 'undefined' &&
                typeof _bgapiHandlers[event['Job-UUID']] !== 'undefined'
            ) {
                var replyText = /^(\S+)\s?(.+)?/.exec(event['_body']);
                _bgapiHandlers[event['Job-UUID']](
                    header,
                    body,
                    replyText[1] == '+OK',
                    replyText[2]
                );
                delete _bgapiHandlers[event['Job-UUID']];
            }
        } else if (typeof _onHandlers[event['Event-Name']] !== 'undefined') {
            _onHandlers[event['Event-Name']](event, header);
        }
    };

    // --- Socket events
    _socket.on('connect', () => log('Connected to FreeSWITCH socket.'));
    _socket.on('error', (err) => log('Socket error:', err.message));

    _socket.on('close', () => {
        if (_connected) log('Disconnected from FreeSWITCH.');
        _connected = false;
        if (_onHandlers['disconnect']) _onHandlers['disconnect']();
        scheduleReconnect();
    });

    // --- Data handler
    var unparsedData = [];

    _socket.on('data', function (data) {
        var ud = unparsedData.shift();
        if (ud) data = ud + data;

        while (data.length > 0) {
            var pos = 0;
            var end = data.indexOf('\n\n');
            if (end == -1) {
                unparsedData.push(data);
                break;
            }
            if (end == 0) {
                data = data.substring(2);
                continue;
            }

            var hdrLines = data.substring(pos, end).split('\n');
            var header = [];
            var body = '';

            for (var i in hdrLines) {
                if (!hdrLines.hasOwnProperty(i)) continue;
                var arr = /^(\S+): (.+)/.exec(hdrLines[i]);
                if (arr) header[arr[1]] = arr[2];
            }

            if (typeof header['Content-Length'] !== 'undefined') {
                end += 2;
                pos = end;
                end += header['Content-Length'] * 1;

                if (end > data.length) {
                    unparsedData.push(data);
                    break;
                }
                body = data.substring(pos, end);
            }

            if (
                typeof header['Content-Type'] !== 'undefined' &&
                typeof _onHandlers[header['Content-Type']] != 'undefined'
            ) {
                _onHandlers[header['Content-Type']](header, body);
            }

            data = data.substring(end);
        }
    });
};
